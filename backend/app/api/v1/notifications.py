from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Notification

router = APIRouter(prefix="/notifications", tags=["notifications"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

def _serialize(n: Notification):
    return {
        "id": n.id,
        "type": n.type,
        "title": n.title,
        "message": n.message,
        "link": n.link,
        "is_read": n.is_read,
        "created_at": n.created_at.isoformat() if n.created_at else None,
    }

@router.get("/")
def get_notifications(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    # Notifications are inherently personal - always scoped to the caller,
    # admin included, regardless of role.
    user_id, role = auth
    notifications = (
        db.query(Notification)
        .filter_by(user_id=user_id)
        .order_by(Notification.created_at.desc())
        .limit(50)
        .all()
    )
    return [_serialize(n) for n in notifications]

@router.get("/unread-count")
def get_unread_count(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    count = db.query(Notification).filter_by(user_id=user_id, is_read=False).count()
    return {"count": count}

@router.post("/{notification_id}/read")
def mark_read(notification_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    notification = db.query(Notification).filter_by(id=notification_id).first()
    if not notification:
        raise HTTPException(status_code=404, detail="Notification not found")
    if notification.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    notification.is_read = True
    db.commit()
    return {"message": "Marked as read"}

@router.post("/read-all")
def mark_all_read(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    db.query(Notification).filter_by(user_id=user_id, is_read=False).update({"is_read": True})
    db.commit()
    return {"message": "All marked as read"}
