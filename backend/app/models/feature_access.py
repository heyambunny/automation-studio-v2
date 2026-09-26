# models/feature_access.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, ForeignKey
from datetime import datetime

from app.core.database import Base


class FeatureAccess(Base):
    """An override that turns a feature on/off for either an entire role or
    one specific user. Exactly one of `role`/`user_id` is set per row; a
    user-level row takes precedence over a role-level row. Absence of any
    row for a feature means it defaults to enabled."""
    __tablename__ = "feature_access"

    id = Column(Integer, primary_key=True, autoincrement=True)
    feature_key = Column(String(50), nullable=False)
    role = Column(String(20), nullable=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=True)
    enabled = Column(Boolean, nullable=False, default=True)
    updated_at = Column(DateTime, default=datetime.utcnow, onupdate=datetime.utcnow)

    def __repr__(self):
        target = f"role={self.role}" if self.role else f"user_id={self.user_id}"
        return f"<FeatureAccess {self.feature_key} {target} enabled={self.enabled}>"
