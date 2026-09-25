from sqlalchemy.orm import Session
from app.models import AuditLog


def log_audit(db: Session, user_id: int, action: str, entity_type: str = None, entity_id: int = None, details: str = None):
    """Record an admin-sensitive action. Never raises - a broken audit write
    should never block the action it's describing."""
    try:
        db.add(AuditLog(
            user_id=user_id,
            action=action,
            entity_type=entity_type,
            entity_id=entity_id,
            details=details,
        ))
        db.commit()
    except Exception as e:
        db.rollback()
        print(f"DEBUG: audit log write failed - {e}")
