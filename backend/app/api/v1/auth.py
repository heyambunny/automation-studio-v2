import hashlib
import html
import secrets
from datetime import datetime, timedelta
from fastapi import APIRouter, BackgroundTasks, Depends, HTTPException, status, Header
from pydantic import BaseModel
from sqlalchemy import func
from sqlalchemy.orm import Session
from app.core.audit import log_audit
from app.core.config import settings
from app.core.database import get_db
from app.core.security import verify_password, create_access_token, create_refresh_token, decode_token, hash_password
from app.schemas.auth import LoginRequest, TokenResponse, RefreshRequest
from app.models import User, SMTPProfile, PasswordResetToken
from app.api.v1.campaigns_execute import send_email, _smtp_config_from_profile

router = APIRouter(prefix="/auth", tags=["auth"])

MIN_PASSWORD_LENGTH = 8
# One reset email per account per minute - stops the form being used to
# flood someone's inbox, without making a genuine retry wait long.
RESET_REQUEST_COOLDOWN = timedelta(minutes=1)


class ForgotPasswordRequest(BaseModel):
    email: str


class ResetTokenCheck(BaseModel):
    token: str


class ResetPasswordRequest(BaseModel):
    token: str
    new_password: str

@router.post("/login", response_model=TokenResponse)
def login(request: LoginRequest, db: Session = Depends(get_db)):
    user = db.query(User).filter(User.email == request.email, User.is_active == 'Y').first()
    
    if not user or not verify_password(request.password, user.password_hash):
        raise HTTPException(status_code=status.HTTP_401_UNAUTHORIZED, detail="Invalid credentials")

    user.last_login = datetime.utcnow()
    db.commit()

    access_token = create_access_token(user.id, user.role.value if user.role else "viewer")
    refresh_token = create_refresh_token(user.id)
    
    return TokenResponse(
        access_token=access_token,
        refresh_token=refresh_token,
        user={
            "id": user.id,
            "email": user.email,
            "full_name": user.full_name,
            "role": user.role.value if user.role else "viewer"
        }
    )

@router.post("/change-password")
def change_password(request: dict, db: Session = Depends(get_db), authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    user_id = int(payload.get("sub"))
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    current_password = request.get("current_password", "")
    new_password = request.get("new_password", "")
    
    if not verify_password(current_password, user.password_hash):
        raise HTTPException(status_code=400, detail="Current password is incorrect")
    
    user.password_hash = hash_password(new_password)
    db.commit()
    return {"message": "Password changed successfully"}

@router.post("/refresh")
def refresh(request: RefreshRequest, db: Session = Depends(get_db)):
    payload = decode_token(request.refresh_token)
    if not payload or payload.get("type") != "refresh":
        raise HTTPException(status_code=401, detail="Invalid refresh token")
    
    user_id = int(payload.get("sub"))
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=401, detail="User not found")
    
    access_token = create_access_token(user.id, user.role.value if user.role else "viewer")
    return {"access_token": access_token, "token_type": "bearer"}


def _hash_reset_token(raw_token: str) -> str:
    return hashlib.sha256(raw_token.encode("utf-8")).hexdigest()


def _find_valid_reset_token(db: Session, raw_token: str):
    """Returns (token_row, user) for an unused, unexpired link belonging to an
    active account, else (None, None)."""
    if not raw_token:
        return None, None
    row = db.query(PasswordResetToken).filter_by(token_hash=_hash_reset_token(raw_token)).first()
    if not row or row.used_at is not None or row.expires_at <= datetime.utcnow():
        return None, None
    user = db.query(User).filter(User.id == row.user_id, User.is_active == 'Y').first()
    if not user:
        return None, None
    return row, user


def _build_password_reset_email(full_name: str, link: str, minutes: int) -> str:
    name = html.escape(full_name or "there")
    return f"""
    <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f4f4f7;padding:32px 0;font-family:-apple-system,'Segoe UI',Arial,sans-serif;">
      <tr><td align="center">
        <table role="presentation" width="480" cellpadding="0" cellspacing="0" style="background:#ffffff;border-radius:16px;overflow:hidden;">
          <tr><td style="background:#0A0A0A;padding:24px 32px;">
            <span style="color:#ffffff;font-size:18px;font-weight:700;">🔐 Automation Studio</span>
          </td></tr>
          <tr><td style="padding:28px 32px 4px 32px;">
            <h1 style="margin:0 0 8px 0;font-size:19px;color:#0A0A0A;">Reset your password</h1>
            <p style="margin:0;color:#52525b;font-size:14px;line-height:1.5;">Hi {name}, we received a request to reset the password for your Automation Studio account.</p>
          </td></tr>
          <tr><td style="padding:20px 32px 8px 32px;">
            <a href="{link}" style="display:block;text-align:center;background:#0A0A0A;color:#ffffff;text-decoration:none;padding:13px 0;border-radius:10px;font-size:14px;font-weight:600;">Choose a new password &rarr;</a>
          </td></tr>
          <tr><td style="padding:12px 32px 8px 32px;">
            <p style="margin:0;padding:14px 16px;background:#fafafa;border-radius:10px;font-size:12px;color:#52525b;line-height:1.5;">This link expires in {minutes} minutes and works only once. If you didn't ask to reset your password, you can ignore this email - your password won't change.</p>
          </td></tr>
          <tr><td style="padding:8px 32px 32px 32px;">
            <p style="margin:0;font-size:11px;color:#a1a1aa;line-height:1.5;word-break:break-all;">Button not working? Paste this into your browser:<br>{link}</p>
          </td></tr>
        </table>
      </td></tr>
    </table>
    """


def _send_password_reset_email(smtp_config: dict, to_email: str, body: str):
    result = send_email(smtp_config, [to_email], "Reset your Automation Studio password", body, copy_sender=False)
    if not result["success"]:
        print(f"DEBUG: password reset email to {to_email} failed - {result['message']}")


@router.post("/forgot-password")
def forgot_password(request: ForgotPasswordRequest, background_tasks: BackgroundTasks, db: Session = Depends(get_db)):
    profile = (
        db.query(SMTPProfile).filter_by(id=settings.PASSWORD_RESET_SMTP_PROFILE_ID).first()
        if settings.PASSWORD_RESET_SMTP_PROFILE_ID else None
    )
    if not profile:
        raise HTTPException(status_code=503, detail="Password reset by email isn't set up yet - please ask an admin to reset your password.")

    # Same answer whether or not the account exists, and the email is sent
    # after the response, so neither the message nor the response time
    # reveals which addresses have accounts.
    generic = {"message": "If an account exists for that email, a reset link is on its way."}

    email = (request.email or "").strip()
    user = db.query(User).filter(func.lower(User.email) == email.lower(), User.is_active == 'Y').first()
    if not user:
        return generic

    now = datetime.utcnow()
    recent = (
        db.query(PasswordResetToken)
        .filter(PasswordResetToken.user_id == user.id, PasswordResetToken.created_at > now - RESET_REQUEST_COOLDOWN)
        .first()
    )
    if recent:
        return generic

    # Only the newest link works - requesting again kills any earlier ones.
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).update({"used_at": now})

    raw_token = secrets.token_urlsafe(32)
    minutes = settings.PASSWORD_RESET_TOKEN_MINUTES
    db.add(PasswordResetToken(
        user_id=user.id,
        token_hash=_hash_reset_token(raw_token),
        expires_at=now + timedelta(minutes=minutes),
        created_at=now,
    ))
    db.commit()

    # Token rides in the URL fragment: browsers never send it to the server,
    # so it stays out of nginx/Next access logs and Referer headers.
    link = f"{settings.FRONTEND_URL}/reset-password#token={raw_token}"
    body = _build_password_reset_email(user.full_name, link, minutes)
    background_tasks.add_task(_send_password_reset_email, _smtp_config_from_profile(profile), user.email, body)
    return generic


@router.post("/reset-password/check")
def check_reset_token(request: ResetTokenCheck, db: Session = Depends(get_db)):
    row, _ = _find_valid_reset_token(db, request.token)
    return {"valid": row is not None}


@router.post("/reset-password")
def reset_password(request: ResetPasswordRequest, db: Session = Depends(get_db)):
    if len(request.new_password or "") < MIN_PASSWORD_LENGTH:
        raise HTTPException(status_code=400, detail=f"Password must be at least {MIN_PASSWORD_LENGTH} characters")

    row, user = _find_valid_reset_token(db, request.token)
    if not row:
        raise HTTPException(status_code=400, detail="This reset link is invalid or has expired. Please request a new one.")

    now = datetime.utcnow()
    user.password_hash = hash_password(request.new_password)
    db.query(PasswordResetToken).filter(
        PasswordResetToken.user_id == user.id, PasswordResetToken.used_at.is_(None)
    ).update({"used_at": now})
    db.commit()
    log_audit(db, user.id, "user.password_reset", "user", user.id, f"{user.email} reset their password via emailed link")
    return {"message": "Password updated. You can now sign in with your new password."}
