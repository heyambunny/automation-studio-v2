"""In-app (bell) notifications for user and security events.

Campaign completed/failed notifications are created in campaigns_execute.py;
this module covers everything else. Failures are swallowed on purpose: a
notification must never break the sign-in, save or send that triggered it.
"""
from typing import Optional

from sqlalchemy.orm import Session

from app.models import Notification, User, UserRole


def notify_user(db: Session, user_id: int, type: str, title: str, message: Optional[str] = None, link: Optional[str] = None) -> None:
    try:
        db.add(Notification(user_id=user_id, type=type, title=title, message=message, link=link))
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"DEBUG: notification '{type}' for user {user_id} failed - {e}")


def notify_admins(db: Session, type: str, title: str, message: Optional[str] = None, link: Optional[str] = None,
                  exclude_user_id: Optional[int] = None) -> None:
    """One notification per active admin, skipping exclude_user_id (the person
    who caused the event already knows)."""
    try:
        admins = db.query(User.id).filter(User.role == UserRole.ADMIN, User.is_active == "Y").all()
        for (admin_id,) in admins:
            if admin_id != exclude_user_id:
                db.add(Notification(user_id=admin_id, type=type, title=title, message=message, link=link))
        db.commit()
    except Exception as e:  # noqa: BLE001
        db.rollback()
        print(f"DEBUG: admin notification '{type}' failed - {e}")
