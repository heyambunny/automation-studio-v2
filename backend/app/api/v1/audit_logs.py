from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models import AuditLog, User
from app.services.weekly_digest import send_weekly_digest

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

def get_current_admin(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return int(payload.get("sub"))

LOGIN_ACTIONS = ("auth.login", "auth.login_failed", "auth.login_locked")


@router.post("/digest/send")
def send_digest_preview(db: Session = Depends(get_db), admin_id: int = Depends(get_current_admin)):
    """Emails this week's digest to the calling admin only - a preview, nobody else is mailed."""
    admin = db.query(User).filter_by(id=admin_id).first()
    result = send_weekly_digest(db, only_to=admin.email)
    if not result["success"]:
        raise HTTPException(status_code=502, detail=result["message"])
    return {"message": f"Digest sent to {admin.email}"}


@router.get("/")
def get_audit_logs(category: str = "all", db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    """category: "changes" (everything except sign-ins), "logins" (sign-ins, failures, lockouts) or "all".
    Sign-ins are frequent, so the split keeps them from pushing real changes out of the 300-row window."""
    query = db.query(AuditLog)
    if category == "logins":
        query = query.filter(AuditLog.action.in_(LOGIN_ACTIONS))
    elif category == "changes":
        query = query.filter(~AuditLog.action.in_(LOGIN_ACTIONS))
    logs = query.order_by(AuditLog.created_at.desc()).limit(300).all()
    result = []
    for l in logs:
        actor = db.query(User).filter_by(id=l.user_id).first() if l.user_id else None
        result.append({
            "id": l.id,
            "action": l.action,
            "entity_type": l.entity_type,
            "entity_id": l.entity_id,
            "details": l.details,
            "actor_name": actor.full_name if actor else None,
            "actor_email": actor.email if actor else None,
            "created_at": l.created_at.isoformat() if l.created_at else None,
        })
    return result
