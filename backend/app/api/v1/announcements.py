from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from datetime import datetime
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Announcement, AnnouncementView, User

router = APIRouter(prefix="/announcements", tags=["announcements"])

VIEW_LIMIT = 3

class AnnouncementCreate(BaseModel):
    title: str
    content: str

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

def _serialize(a: Announcement, db: Session):
    author = db.query(User).filter_by(id=a.created_by).first() if a.created_by else None
    return {
        "id": a.id,
        "title": a.title,
        "content": a.content,
        "created_at": a.created_at.isoformat() if a.created_at else None,
        "created_by_name": author.full_name if author else None,
    }

@router.get("/")
def get_announcements(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    announcements = db.query(Announcement).order_by(Announcement.created_at.desc()).all()
    return [_serialize(a, db) for a in announcements]

@router.get("/banner")
def get_banner(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    """Called once per login (gated client-side) to decide whether to show
    the post-login "what's new" banner, and record that this counts as one
    of the user's 3 allotted views of the latest announcement."""
    user_id, role = auth
    latest = db.query(Announcement).order_by(Announcement.created_at.desc()).first()
    if not latest:
        return {"announcement": None}

    view = db.query(AnnouncementView).filter_by(user_id=user_id, announcement_id=latest.id).first()
    if not view:
        view = AnnouncementView(user_id=user_id, announcement_id=latest.id, view_count=0)
        db.add(view)

    if view.view_count >= VIEW_LIMIT:
        return {"announcement": None}

    view.view_count += 1
    view.last_viewed_at = datetime.utcnow()
    db.commit()

    return {"announcement": _serialize(latest, db), "view_number": view.view_count, "view_limit": VIEW_LIMIT}

@router.post("/")
def create_announcement(data: AnnouncementCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    announcement = Announcement(title=data.title, content=data.content, created_by=user_id)
    db.add(announcement)
    db.commit()
    db.refresh(announcement)
    return _serialize(announcement, db)

@router.delete("/{announcement_id}")
def delete_announcement(announcement_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if role != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    announcement = db.query(Announcement).filter_by(id=announcement_id).first()
    if not announcement:
        raise HTTPException(status_code=404, detail="Announcement not found")
    db.query(AnnouncementView).filter_by(announcement_id=announcement_id).delete()
    db.delete(announcement)
    db.commit()
    return {"message": "Announcement deleted"}
