"""Admin-only cleanup of old campaign upload folders.

Nothing here deletes on its own: GET /cleanup-preview lists what is old enough
to remove, and POST /cleanup only deletes the folders an admin names AND
explicitly confirms, after re-checking each one server-side.
"""
import json
import os
import re
import shutil
import time
from datetime import datetime

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel
from sqlalchemy.orm import Session

from app.core.audit import log_audit
from app.core.config import settings
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Execution, Schedule

router = APIRouter(prefix="/storage", tags=["storage"])

UPLOADS_ROOT = os.path.join("uploads", "campaigns")
_FOLDER_NAME_RE = re.compile(r"^[A-Za-z0-9_-]{4,64}$")


def get_current_admin(authorization: str = Header(...)):
    payload = decode_token(authorization.replace("Bearer ", ""))
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return int(payload.get("sub"))


class CleanupRequest(BaseModel):
    names: list
    confirm: bool = False


def _folder_name(campaign_folder) -> str:
    return os.path.basename(os.path.normpath(campaign_folder or "")) if campaign_folder else ""


def _scan_folder(path: str) -> dict:
    size = files = 0
    newest = os.path.getmtime(path)
    for dirpath, _, filenames in os.walk(path):
        for fn in filenames:
            fp = os.path.join(dirpath, fn)
            try:
                st = os.stat(fp)
            except OSError:
                continue
            size += st.st_size
            files += 1
            newest = max(newest, st.st_mtime)
    return {"bytes": size, "files": files, "newest": newest}


def _references(db: Session):
    """folder name -> (protected_reason or None, [labels of executions that used it])."""
    protected, used_by = {}, {}
    now = datetime.now()
    for s in db.query(Schedule).all():
        try:
            folder = _folder_name(json.loads(s.campaign_config or "{}").get("campaign_folder"))
        except ValueError:
            continue
        if folder and (s.enabled or (s.next_run and s.next_run > now)):
            protected[folder] = f"Still needed by the schedule \"{s.schedule_name}\""
    for e in db.query(Execution).all():
        try:
            folder = _folder_name(json.loads(e.campaign_config or "{}").get("campaign_folder"))
        except ValueError:
            continue
        if not folder:
            continue
        status = e.status.value if hasattr(e.status, "value") else e.status
        if status in ("in_progress", "queued"):
            protected[folder] = f"A campaign is still sending from it ({e.campaign_name})"
        used_by.setdefault(folder, []).append(f"{e.campaign_name or 'Campaign'} ({e.created_at:%d %b %Y})" if e.created_at else (e.campaign_name or "Campaign"))
    return protected, used_by


def _candidates(db: Session):
    protected, used_by = _references(db)
    root = os.path.realpath(UPLOADS_ROOT)
    cutoff = time.time() - settings.UPLOAD_RETENTION_DAYS * 86400
    candidates, kept_protected, total_bytes, total_folders = [], [], 0, 0
    if not os.path.isdir(root):
        return candidates, kept_protected, total_bytes, total_folders
    for name in sorted(os.listdir(root)):
        path = os.path.join(root, name)
        if not os.path.isdir(path) or not _FOLDER_NAME_RE.match(name):
            continue
        info = _scan_folder(path)
        total_bytes += info["bytes"]
        total_folders += 1
        if info["newest"] > cutoff:
            continue
        item = {
            "name": name,
            "bytes": info["bytes"],
            "files": info["files"],
            "age_days": int((time.time() - info["newest"]) // 86400),
            "used_by": used_by.get(name, [])[:3],
        }
        if name in protected:
            kept_protected.append({**item, "reason": protected[name]})
        else:
            candidates.append(item)
    return candidates, kept_protected, total_bytes, total_folders


@router.get("/cleanup-preview")
def cleanup_preview(db: Session = Depends(get_db), admin_id: int = Depends(get_current_admin)):
    candidates, kept, total_bytes, total_folders = _candidates(db)
    candidates.sort(key=lambda c: c["age_days"], reverse=True)
    return {
        "retention_days": settings.UPLOAD_RETENTION_DAYS,
        "total_folders": total_folders,
        "total_bytes": total_bytes,
        "candidates": candidates,
        "candidate_bytes": sum(c["bytes"] for c in candidates),
        "protected": kept,
    }


@router.post("/cleanup")
def cleanup(request: CleanupRequest, db: Session = Depends(get_db), admin_id: int = Depends(get_current_admin)):
    if not request.confirm:
        raise HTTPException(status_code=400, detail="Deleting needs explicit confirmation")
    candidates, _, _, _ = _candidates(db)
    allowed = {c["name"]: c for c in candidates}
    root = os.path.realpath(UPLOADS_ROOT)

    deleted, skipped, freed = [], [], 0
    for name in dict.fromkeys(str(n) for n in request.names):
        if not _FOLDER_NAME_RE.match(name):
            skipped.append({"name": name, "reason": "Not a campaign upload folder"})
            continue
        if name not in allowed:
            skipped.append({"name": name, "reason": "No longer eligible (recently used, or still needed by a schedule)"})
            continue
        path = os.path.realpath(os.path.join(root, name))
        if os.path.dirname(path) != root:
            skipped.append({"name": name, "reason": "Outside the uploads folder"})
            continue
        shutil.rmtree(path, ignore_errors=True)
        deleted.append(name)
        freed += allowed[name]["bytes"]

    if deleted:
        log_audit(
            db, admin_id, "storage.cleanup", "storage", None,
            f"Deleted {len(deleted)} campaign upload folder(s) older than {settings.UPLOAD_RETENTION_DAYS} days, freeing {freed / 1_048_576:.1f} MB: {', '.join(deleted[:15])}",
        )
    return {"deleted": len(deleted), "freed_bytes": freed, "skipped": skipped}
