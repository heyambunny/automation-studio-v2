from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List
from datetime import datetime
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Schedule
from app.api.v1.campaigns_execute import CampaignExecuteRequest

router = APIRouter(prefix="/schedules", tags=["schedules"])

FREQUENCIES = ("once", "daily", "weekly", "monthly")

class ScheduleCreateRequest(BaseModel):
    schedule_name: str
    frequency: str  # once, daily, weekly, monthly
    run_at: datetime  # first (or only) run time, as local time - matches next_run
    campaign: CampaignExecuteRequest

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.post("/")
def create_schedule(payload: ScheduleCreateRequest, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if payload.frequency not in FREQUENCIES:
        raise HTTPException(status_code=400, detail=f"frequency must be one of {FREQUENCIES}")
    if not payload.campaign.campaign_folder:
        raise HTTPException(status_code=400, detail="Upload branch files before scheduling")

    schedule = Schedule(
        user_id=user_id,
        schedule_name=payload.schedule_name or payload.campaign.report_type or "Scheduled Campaign",
        campaign_config=payload.campaign.model_dump_json(),
        frequency=payload.frequency,
        next_run=payload.run_at,
        enabled=True,
    )
    db.add(schedule)
    db.commit()
    db.refresh(schedule)
    return {
        "id": schedule.id,
        "schedule_name": schedule.schedule_name,
        "next_run": schedule.next_run.strftime("%Y-%m-%d %H:%M"),
    }

@router.get("/")
def get_schedules(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if role == "admin":
        schedules = db.query(Schedule).order_by(Schedule.next_run).all()
    else:
        schedules = db.query(Schedule).filter_by(user_id=user_id).order_by(Schedule.next_run).all()
    
    result = []
    for s in schedules:
        result.append({
            "id": s.id,
            "schedule_name": s.schedule_name,
            "frequency": s.frequency,
            "next_run": s.next_run.strftime("%Y-%m-%d %H:%M") if s.next_run else "N/A",
            "enabled": s.enabled,
            "created_at": s.created_at.strftime("%Y-%m-%d") if s.created_at else ""
        })
    return result

@router.delete("/{schedule_id}")
def cancel_schedule(schedule_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    schedule = db.query(Schedule).filter_by(id=schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if role != "admin" and schedule.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    schedule.enabled = False
    db.commit()
    return {"message": "Schedule cancelled"}
