from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from sqlalchemy import func
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Execution, EmailLog, Schedule

router = APIRouter(prefix="/dashboard", tags=["dashboard"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return None
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.get("/stats")
def get_stats(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    
    # Base queries
    if role == "admin":
        executions = db.query(Execution).all()
        email_logs = db.query(EmailLog).all()
    else:
        executions = db.query(Execution).filter_by(user_id=user_id).all()
        email_logs = db.query(EmailLog).join(Execution).filter(Execution.user_id == user_id).all()
    
    total_campaigns = len(executions)
    completed = sum(1 for e in executions if e.status and e.status.value == "completed")
    failed = sum(1 for e in executions if e.status and e.status.value == "failed")
    in_progress = sum(1 for e in executions if e.status and e.status.value == "in_progress")
    
    total_emails = len(email_logs)
    sent_emails = sum(1 for l in email_logs if l.status == "sent")
    failed_emails = sum(1 for l in email_logs if l.status == "failed")
    
    success_rate = round((sent_emails / total_emails * 100), 1) if total_emails > 0 else 0
    
    # Schedules
    if role == "admin":
        schedules = db.query(Schedule).filter_by(enabled=True).count()
    else:
        schedules = db.query(Schedule).filter_by(user_id=user_id, enabled=True).count()
    
    # Email activity (last 30 days, sent vs failed). attempted_at is always
    # set regardless of outcome; sent_at is a fallback for rows logged before
    # that column existed (older successes only - older failures have no
    # timestamp at all and can't be placed on the trend).
    from datetime import datetime, timedelta
    last_30_days = datetime.utcnow() - timedelta(days=30)

    daily_counts = {}
    day_keys = []
    for i in range(30):
        day_date = datetime.utcnow() - timedelta(days=29 - i)
        key = day_date.strftime("%b %d")
        day_keys.append(key)
        daily_counts[key] = {"sent": 0, "failed": 0}

    for log in email_logs:
        ts = log.attempted_at or log.sent_at
        if not ts or ts < last_30_days:
            continue
        key = ts.strftime("%b %d")
        if key in daily_counts and log.status in ("sent", "failed"):
            daily_counts[key][log.status] += 1

    return {
        "total_campaigns": total_campaigns,
        "completed": completed,
        "failed": failed,
        "in_progress": in_progress,
        "total_emails": total_emails,
        "sent_emails": sent_emails,
        "failed_emails": failed_emails,
        "success_rate": success_rate,
        "schedules": schedules,
        "email_activity": [{"day": k, "sent": daily_counts[k]["sent"], "failed": daily_counts[k]["failed"]} for k in day_keys],
    }
