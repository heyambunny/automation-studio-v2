"""One-off migration: creates the password_reset_tokens table used by the
forgot-password flow. Safe to re-run (checks before creating).
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_password_reset.py
"""
from sqlalchemy import inspect
from app.core.database import engine
from app.models import PasswordResetToken

inspector = inspect(engine)

if "password_reset_tokens" not in inspector.get_table_names():
    PasswordResetToken.__table__.create(bind=engine)
    print("Created password_reset_tokens table")
else:
    print("password_reset_tokens table already exists")
