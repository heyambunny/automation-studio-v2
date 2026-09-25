from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_token
from app.core.audit import log_audit
from app.schemas.settings import SMTPProfileCreate, SMTPProfileResponse, SettingUpdate
from app.models import SMTPProfile, Setting
from fastapi import Header

router = APIRouter(prefix="/settings", tags=["settings"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.post("/test-smtp")
def test_smtp(profile: dict, auth: tuple = Depends(get_current_user)):
    import smtplib
    try:
        smtp_server = profile.get("smtp_server", "")
        smtp_port = int(profile.get("smtp_port", 587))
        sender_email = profile.get("sender_email", "")
        password = profile.get("password", "")
        use_tls = profile.get("use_tls", True)
        
        if not smtp_server or not sender_email or not password:
            return {"success": False, "message": "Missing server, email, or password"}
        
        if use_tls:
            server = smtplib.SMTP(smtp_server, smtp_port, timeout=10)
            server.starttls()
        else:
            server = smtplib.SMTP_SSL(smtp_server, smtp_port, timeout=10)
        server.login(sender_email, password)
        server.quit()
        return {"success": True, "message": "Connection successful"}
    except Exception as e:
        return {"success": False, "message": str(e)}

@router.get("/smtp-profiles", response_model=List[SMTPProfileResponse])
def get_profiles(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    # SMTP profiles carry plaintext mailbox passwords - only admins see every
    # profile; everyone else sees only the ones they created.
    user_id, role = auth
    if role == "admin":
        return db.query(SMTPProfile).all()
    return db.query(SMTPProfile).filter_by(user_id=user_id).all()

@router.post("/smtp-profiles", response_model=SMTPProfileResponse)
def create_profile(profile: SMTPProfileCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if profile.is_default:
        db.query(SMTPProfile).filter_by(user_id=user_id, is_default=True).update({"is_default": False})
    
    new_profile = SMTPProfile(user_id=user_id, **profile.dict())
    db.add(new_profile)
    db.commit()
    db.refresh(new_profile)
    return new_profile

@router.put("/smtp-profiles/{profile_id}")
def update_profile(profile_id: int, profile: SMTPProfileCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    existing = db.query(SMTPProfile).filter_by(id=profile_id).first()
    if not existing:
        raise HTTPException(status_code=404, detail="Profile not found")
    if role != "admin" and existing.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    existing.profile_name = profile.profile_name
    existing.smtp_server = profile.smtp_server
    existing.smtp_port = profile.smtp_port
    existing.sender_email = profile.sender_email
    existing.sender_name = profile.sender_name
    existing.use_tls = profile.use_tls
    if profile.password:
        existing.password = profile.password
    db.commit()
    return {"message": "Profile updated"}

@router.delete("/smtp-profiles/{profile_id}")
def delete_profile(profile_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    profile = db.query(SMTPProfile).filter_by(id=profile_id).first()
    if not profile:
        raise HTTPException(status_code=404, detail="Profile not found")
    if role != "admin" and profile.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    profile_name = profile.profile_name
    owner_id = profile.user_id
    db.delete(profile)
    db.commit()
    log_audit(db, user_id, "smtp_profile.delete", "smtp_profile", profile_id, f"Deleted profile \"{profile_name}\" (owner user {owner_id})")
    return {"message": "Profile deleted"}

@router.get("/settings")
def get_settings(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    setting = db.query(Setting).filter_by(user_id=user_id).first()
    if not setting:
        return {"default_sheet_name": "Summary", "default_starting_cell": "B5", "notify_on_failure": True}
    return {
        "default_sheet_name": setting.default_sheet_name,
        "default_starting_cell": setting.default_starting_cell,
        "notify_on_failure": setting.notify_on_failure if setting.notify_on_failure is not None else True,
    }

@router.put("/settings")
def update_settings(update: SettingUpdate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    setting = db.query(Setting).filter_by(user_id=user_id).first()
    if not setting:
        setting = Setting(user_id=user_id, **update.dict(exclude_none=True))
        db.add(setting)
    else:
        if update.default_sheet_name:
            setting.default_sheet_name = update.default_sheet_name
        if update.default_starting_cell:
            setting.default_starting_cell = update.default_starting_cell
        if update.notify_on_failure is not None:
            setting.notify_on_failure = update.notify_on_failure
    db.commit()
    return {"message": "Settings updated"}
