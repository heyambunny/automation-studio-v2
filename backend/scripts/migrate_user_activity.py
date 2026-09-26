"""One-off migration for the admin User Activity view: adds users.last_login.
Safe to re-run.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_user_activity.py
"""
from sqlalchemy import inspect, text
from app.core.database import engine

inspector = inspect(engine)

user_columns = [c["name"] for c in inspector.get_columns("users")]
if "last_login" not in user_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE users ADD COLUMN last_login TIMESTAMP"))
        conn.commit()
    print("Added users.last_login")
else:
    print("users.last_login already exists")
