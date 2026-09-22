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
    
    # Email activity (last 7 days)
    from datetime import datetime, timedelta
    last_7_days = datetime.utcnow() - timedelta(days=7)
    recent_logs = [l for l in email_logs if l.sent_at and l.sent_at >= last_7_days and l.status == "sent"]
    
    daily_counts = {}
    for i in range(7):
        day = (datetime.utcnow() - timedelta(days=6-i)).strftime("%a")
        daily_counts[day] = 0
    for log in recent_logs:
        day = log.sent_at.strftime("%a")
        if day in daily_counts:
            daily_counts[day] += 1
    
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
        "email_activity": [{"day": k, "sent": v} for k, v in daily_counts.items()],
    }
