from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from app.core.database import get_db
from app.core.security import decode_token
from app.models import AuditLog, User

router = APIRouter(prefix="/audit-logs", tags=["audit-logs"])

def get_current_admin(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return int(payload.get("sub"))

@router.get("/")
def get_audit_logs(db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    logs = db.query(AuditLog).order_by(AuditLog.created_at.desc()).limit(200).all()
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
