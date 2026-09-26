"""One-off migration: adds schedules.last_reminder_sent_for, used to avoid
re-sending the "starting in 15 minutes" email more than once per occurrence.
Safe to re-run.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_schedule_reminder.py
"""
from sqlalchemy import inspect, text
from app.core.database import engine

inspector = inspect(engine)

schedule_columns = [c["name"] for c in inspector.get_columns("schedules")]
if "last_reminder_sent_for" not in schedule_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE schedules ADD COLUMN last_reminder_sent_for TIMESTAMP"))
        conn.commit()
    print("Added schedules.last_reminder_sent_for")
else:
    print("schedules.last_reminder_sent_for already exists")
