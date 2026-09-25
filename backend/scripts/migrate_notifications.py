"""One-off migration: creates the notifications table and adds
settings.notify_on_failure. Safe to re-run (checks before creating/altering).
Run with: venv/bin/python3 scripts/migrate_notifications.py
"""
from sqlalchemy import inspect, text
from app.core.database import engine, Base
from app.models import Notification

inspector = inspect(engine)

if "notifications" not in inspector.get_table_names():
    Notification.__table__.create(bind=engine)
    print("Created notifications table")
else:
    print("notifications table already exists")

settings_columns = [c["name"] for c in inspector.get_columns("settings")]
if "notify_on_failure" not in settings_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN notify_on_failure BOOLEAN DEFAULT TRUE"))
        conn.commit()
    print("Added settings.notify_on_failure")
else:
    print("settings.notify_on_failure already exists")
