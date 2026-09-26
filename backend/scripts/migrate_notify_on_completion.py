"""One-off migration: adds settings.notify_on_completion, which gates the new
"campaign finished" summary email (sent on every completion, success or
failure) separately from the older, narrower notify_on_failure column.
Safe to re-run.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_notify_on_completion.py
"""
from sqlalchemy import inspect, text
from app.core.database import engine

inspector = inspect(engine)

setting_columns = [c["name"] for c in inspector.get_columns("settings")]
if "notify_on_completion" not in setting_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE settings ADD COLUMN notify_on_completion BOOLEAN DEFAULT TRUE"))
        conn.commit()
    print("Added settings.notify_on_completion")
else:
    print("settings.notify_on_completion already exists")
