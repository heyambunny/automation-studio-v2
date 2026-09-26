"""One-off migration: creates the feature_access table used by the admin
Feature Control panel (Settings > Features). Safe to re-run.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_feature_access.py
"""
from sqlalchemy import inspect
from app.core.database import engine
from app.models import FeatureAccess

inspector = inspect(engine)
existing = inspector.get_table_names()

if "feature_access" not in existing:
    FeatureAccess.__table__.create(bind=engine)
    print("Created feature_access table")
else:
    print("feature_access table already exists")
