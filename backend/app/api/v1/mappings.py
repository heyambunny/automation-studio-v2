import re
from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.mapping import MappingCreate, MappingResponse, MappingEntryResponse
from app.models import Mapping, MappingEntry

router = APIRouter(prefix="/mappings", tags=["mappings"])

_EMAIL_RE = re.compile(r"^[^\s@,;]+@[^\s@,;]+\.[^\s@,;]+$")

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

def _split_recipients(value: str) -> list:
    # Mirrors the exact delimiter handling used at send time
    # (campaigns_execute.py: entry.to_recipients.replace(";", ",").split(",")),
    # so anything that passes here is guaranteed to parse the same way later.
    return [e.strip() for e in str(value or "").replace(";", ",").split(",") if e.strip()]

def _validate_entries(entries: list) -> list:
    """Reject a mapping before it's saved rather than letting bad rows
    surface only as an SMTP failure mid-campaign."""
    errors = []
    if not entries:
        return ["Mapping must have at least one entry"]
    seen_branches = {}
    for i, entry in enumerate(entries):
        row = i + 1
        if not isinstance(entry, dict):
            errors.append(f"Row {row}: invalid entry format")
            continue
        branch = str(entry.get("BranchName", entry.get("branch_name", "")) or "").strip()
        to_raw = str(entry.get("To", entry.get("to", "")) or "").strip()
        cc_raw = str(entry.get("CC", entry.get("cc", "")) or "").strip()

        if not branch:
            errors.append(f"Row {row}: BranchName is required")
            continue
        key = branch.lower()
        if key in seen_branches:
            errors.append(f'Row {row}: duplicate BranchName "{branch}" (already used in row {seen_branches[key]})')
            continue
        seen_branches[key] = row

        if not to_raw:
            errors.append(f"Row {row} ({branch}): To is required")
            continue
        bad_to = [e for e in _split_recipients(to_raw) if not _EMAIL_RE.match(e)]
        if bad_to:
            errors.append(f"Row {row} ({branch}): invalid email in To - {', '.join(bad_to)}")
            continue

        if cc_raw:
            bad_cc = [e for e in _split_recipients(cc_raw) if not _EMAIL_RE.match(e)]
            if bad_cc:
                errors.append(f"Row {row} ({branch}): invalid email in CC - {', '.join(bad_cc)}")
    return errors

@router.get("/", response_model=List[MappingResponse])
def get_mappings(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if role == "admin":
        return db.query(Mapping).all()
    return db.query(Mapping).filter_by(user_id=user_id).all()

@router.post("/", response_model=MappingResponse)
def create_mapping(mapping: MappingCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth

    errors = _validate_entries(mapping.entries)
    if errors:
        raise HTTPException(status_code=422, detail={"message": "Mapping validation failed", "errors": errors})

    new_mapping = Mapping(user_id=user_id, mapping_name=mapping.mapping_name, file_path="")
    db.add(new_mapping)
    db.flush()
    
    for entry in mapping.entries:
        new_entry = MappingEntry(
            mapping_id=new_mapping.id,
            branch_name=entry.get("BranchName", entry.get("branch_name", "")),
            to_recipients=entry.get("To", entry.get("to", "")),
            cc_recipients=entry.get("CC", entry.get("cc", ""))
        )
        db.add(new_entry)
    
    db.commit()
    db.refresh(new_mapping)
    return new_mapping

@router.get("/{mapping_id}/entries", response_model=List[MappingEntryResponse])
def get_mapping_entries(mapping_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    mapping = db.query(Mapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if role != "admin" and mapping.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(MappingEntry).filter_by(mapping_id=mapping_id).all()

@router.delete("/{mapping_id}")
def delete_mapping(mapping_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    mapping = db.query(Mapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if role != "admin" and mapping.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.query(MappingEntry).filter_by(mapping_id=mapping_id).delete()
    db.delete(mapping)
    db.commit()
    return {"message": "Mapping deleted"}
