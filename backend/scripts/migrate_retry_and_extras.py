"""One-off migration for: retry-failed-emails (executions.campaign_config)
and the dashboard trend chart (email_logs.attempted_at). Safe to re-run.
Run with: PYTHONPATH=. venv/bin/python3 scripts/migrate_retry_and_extras.py
"""
from sqlalchemy import inspect, text
from app.core.database import engine

inspector = inspect(engine)

exec_columns = [c["name"] for c in inspector.get_columns("executions")]
if "campaign_config" not in exec_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE executions ADD COLUMN campaign_config TEXT"))
        conn.commit()
    print("Added executions.campaign_config")
else:
    print("executions.campaign_config already exists")

log_columns = [c["name"] for c in inspector.get_columns("email_logs")]
if "attempted_at" not in log_columns:
    with engine.connect() as conn:
        conn.execute(text("ALTER TABLE email_logs ADD COLUMN attempted_at TIMESTAMP"))
        conn.commit()
    print("Added email_logs.attempted_at")
else:
    print("email_logs.attempted_at already exists")
