from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List, Optional
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Execution, EmailLog

router = APIRouter(prefix="/executions", tags=["executions"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.get("/")
def get_executions(
    status: Optional[str] = None,
    search: Optional[str] = None,
    db: Session = Depends(get_db),
    auth: tuple = Depends(get_current_user)
):
    user_id, role = auth
    query = db.query(Execution)
    
    if role != "admin":
        query = query.filter_by(user_id=user_id)
    if status:
        query = query.filter(Execution.status == status)
    if search:
        query = query.filter(Execution.campaign_name.ilike(f"%{search}%"))
    
    executions = query.order_by(Execution.created_at.desc()).all()
    
    result = []
    for e in executions:
        result.append({
            "id": e.id,
            "campaign_name": e.campaign_name,
            "status": e.status.value if e.status else "N/A",
            "send_method": e.send_method,
            "mode": e.mode,
            "total_emails": e.total_emails,
            "sent_count": e.sent_count,
            "failed_count": e.failed_count,
            "created_at": e.created_at.strftime("%Y-%m-%d %H:%M") if e.created_at else "",
            "completed_at": e.completed_at.strftime("%Y-%m-%d %H:%M") if e.completed_at else ""
        })
    return result

@router.get("/{execution_id}/logs")
def get_email_logs(execution_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    execution = db.query(Execution).filter_by(id=execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if role != "admin" and execution.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    logs = db.query(EmailLog).filter_by(execution_id=execution_id).all()
    result = []
    for l in logs:
        result.append({
            "id": l.id,
            "branch_name": l.branch_name,
            "recipient_to": l.recipient_to,
            "recipient_cc": l.recipient_cc,
            "subject": l.subject,
            "status": l.status,
            "sent_at": l.sent_at.strftime("%Y-%m-%d %H:%M:%S") if l.sent_at else "",
            "error_message": l.error_message
        })
    return result

@router.post("/{execution_id}/retry")
def retry_execution(execution_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    execution = db.query(Execution).filter_by(id=execution_id).first()
    if not execution:
        raise HTTPException(status_code=404, detail="Execution not found")
    if role != "admin" and execution.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    failed_logs = db.query(EmailLog).filter_by(execution_id=execution_id, status="failed").all()
    if not failed_logs:
        return {"message": "No failed emails to retry"}
    
    return {"message": f"Retrying {len(failed_logs)} failed emails", "count": len(failed_logs)}
