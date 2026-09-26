from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime
import json
from app.core.database import get_db
from app.core.security import decode_token
from app.models import Schedule, SMTPProfile, Setting, User
from app.api.v1.campaigns_execute import (
    CampaignExecuteRequest, send_email, _build_schedule_confirmation_email, _smtp_config_from_profile,
)
from app.services.mascot_service import generate_bounce_gif

router = APIRouter(prefix="/schedules", tags=["schedules"])

FREQUENCIES = ("once", "daily", "weekly", "monthly")

class ScheduleCreateRequest(BaseModel):
    schedule_name: str
    frequency: str  # once, daily, weekly, monthly
    run_at: datetime  # first (or only) run time, as local time - matches next_run
    campaign: CampaignExecuteRequest

class ScheduleUpdateRequest(BaseModel):
    schedule_name: Optional[str] = None
    frequency: Optional[str] = None
    next_run: Optional[datetime] = None
    enabled: Optional[bool] = None

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

    try:
        _send_schedule_confirmation(db, schedule)
    except Exception as e:
        print(f"DEBUG: schedule confirmation email failed - {e}")

    return {
        "id": schedule.id,
        "schedule_name": schedule.schedule_name,
        "next_run": schedule.next_run.strftime("%Y-%m-%d %H:%M"),
    }


def _send_schedule_confirmation(db: Session, schedule: Schedule):
    setting = db.query(Setting).filter_by(user_id=schedule.user_id).first()
    notify_enabled = setting.notify_on_completion if (setting and setting.notify_on_completion is not None) else True
    if not notify_enabled:
        return

    user = db.query(User).filter_by(id=schedule.user_id).first()
    if not user or not user.email:
        return

    config = json.loads(schedule.campaign_config)
    profile = db.query(SMTPProfile).filter_by(profile_name=config.get("smtp_profile")).first()
    if not profile:
        return

    body = _build_schedule_confirmation_email(schedule.schedule_name, schedule.frequency, schedule.next_run)
    mascot = generate_bounce_gif((29, 78, 216), "excited")
    send_email(_smtp_config_from_profile(profile), [user.email], f"📅 \"{schedule.schedule_name}\" scheduled", body, inline_images=[("mascot", mascot)])

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

@router.put("/{schedule_id}")
def update_schedule(schedule_id: int, payload: ScheduleUpdateRequest, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    schedule = db.query(Schedule).filter_by(id=schedule_id).first()
    if not schedule:
        raise HTTPException(status_code=404, detail="Schedule not found")
    if role != "admin" and schedule.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")

    if payload.frequency is not None:
        if payload.frequency not in FREQUENCIES:
            raise HTTPException(status_code=400, detail=f"frequency must be one of {FREQUENCIES}")
        schedule.frequency = payload.frequency
    if payload.schedule_name is not None:
        schedule.schedule_name = payload.schedule_name
    if payload.next_run is not None:
        schedule.next_run = payload.next_run
    if payload.enabled is not None:
        schedule.enabled = payload.enabled

    db.commit()
    return {
        "id": schedule.id,
        "schedule_name": schedule.schedule_name,
        "frequency": schedule.frequency,
        "next_run": schedule.next_run.strftime("%Y-%m-%d %H:%M") if schedule.next_run else "N/A",
        "enabled": schedule.enabled,
    }

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
