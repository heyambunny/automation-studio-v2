"""One-off migration: creates the announcements and announcement_views
tables. Safe to re-run (checks before creating).
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_announcements.py
"""
from sqlalchemy import inspect
from app.core.database import engine
from app.models import Announcement, AnnouncementView

inspector = inspect(engine)
existing = inspector.get_table_names()

if "announcements" not in existing:
    Announcement.__table__.create(bind=engine)
    print("Created announcements table")
else:
    print("announcements table already exists")

if "announcement_views" not in existing:
    AnnouncementView.__table__.create(bind=engine)
    print("Created announcement_views table")
else:
    print("announcement_views table already exists")
