# models/announcement.py
from sqlalchemy import Column, Integer, String, DateTime, Text, ForeignKey
from datetime import datetime

from app.core.database import Base

class Announcement(Base):
    __tablename__ = "announcements"

    id = Column(Integer, primary_key=True, autoincrement=True)
    title = Column(String(255), nullable=False)
    content = Column(Text, nullable=False)
    created_by = Column(Integer, ForeignKey("users.id"), nullable=True)
    created_at = Column(DateTime, default=datetime.utcnow)

    def __repr__(self):
        return f"<Announcement {self.title}>"


class AnnouncementView(Base):
    """Tracks how many times a user has been shown the post-login banner
    for a given announcement, so it stops appearing after 3 logins."""
    __tablename__ = "announcement_views"

    id = Column(Integer, primary_key=True, autoincrement=True)
    user_id = Column(Integer, ForeignKey("users.id"), nullable=False)
    announcement_id = Column(Integer, ForeignKey("announcements.id"), nullable=False)
    view_count = Column(Integer, default=0)
    last_viewed_at = Column(DateTime)

    def __repr__(self):
        return f"<AnnouncementView user={self.user_id} announcement={self.announcement_id} count={self.view_count}>"
