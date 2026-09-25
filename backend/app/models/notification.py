# models/notification.py
from sqlalchemy import Column, Integer, String, Boolean, DateTime, Text, ForeignKey
from datetime import datetime

from app.core.database import Base

class Notification(Base):
    __tablename__ = "notifications"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    type = Column(String(50), nullable=False)  # campaign_completed, campaign_failed
    title = Column(String(255), nullable=False)
    message = Column(Text)
    link = Column(String(255))  # frontend route to open when clicked, e.g. /history
    is_read = Column(Boolean, default=False)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Notification {self.type} for user {self.user_id}>"
