from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import decode_token, hash_password
from app.core.audit import log_audit
from app.models import User, UserRole

router = APIRouter(prefix="/users", tags=["users"])

from typing import Optional

class UserCreate(BaseModel):
    email: str
    password: Optional[str] = None
    full_name: str
    role: str = "manager"
    avatar: str = "bear-brown"

class UserSelfUpdate(BaseModel):
    full_name: Optional[str] = None
    avatar: Optional[str] = None

def get_current_admin(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload or payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return int(payload.get("sub"))

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub"))

def _serialize_user(u: User):
    return {"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value if u.role else "viewer", "avatar": u.avatar or "bear-brown"}

@router.get("/")
def get_users(db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    users = db.query(User).all()
    return [{"id": u.id, "email": u.email, "full_name": u.full_name, "role": u.role.value if u.role else "viewer", "avatar": u.avatar or "bear-brown"} for u in users]

@router.post("/")
def create_user(user_data: UserCreate, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    existing = db.query(User).filter_by(email=user_data.email).first()
    if existing:
        raise HTTPException(status_code=400, detail="Email already exists")
    new_user = User(
        email=user_data.email,
        password_hash=hash_password(user_data.password),
        full_name=user_data.full_name,
        role=UserRole.ADMIN if user_data.role == "admin" else UserRole.MANAGER,
        avatar=user_data.avatar
    )
    db.add(new_user)
    db.commit()
    db.refresh(new_user)
    log_audit(db, auth, "user.create", "user", new_user.id, f"Created {new_user.email} ({new_user.role.value})")
    return {"id": new_user.id, "email": new_user.email, "full_name": new_user.full_name, "role": new_user.role.value}

@router.get("/me")
def get_my_profile(db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    return _serialize_user(user)

@router.put("/me")
def update_my_profile(user_data: UserSelfUpdate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    if user_data.full_name is not None:
        user.full_name = user_data.full_name
    if user_data.avatar is not None:
        user.avatar = user_data.avatar
    db.commit()
    return _serialize_user(user)

@router.put("/{user_id}")
def update_user(user_id: int, user_data: UserCreate, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    user.full_name = user_data.full_name
    user.email = user_data.email
    user.avatar = user_data.avatar
    user.role = UserRole.ADMIN if user_data.role == "admin" else UserRole.MANAGER
    if user_data.password:
        user.password_hash = hash_password(user_data.password)
    db.commit()
    log_audit(db, auth, "user.update", "user", user.id, f"Updated {user.email} ({user.role.value})")
    return {"message": "User updated"}

@router.delete("/{user_id}")
def delete_user(user_id: int, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    user = db.query(User).filter_by(id=user_id).first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    deleted_email = user.email

    # Delete related records
    from app.models import Setting, SMTPProfile, Mapping, Template, Execution, Schedule, GameScore
    db.query(Setting).filter_by(user_id=user_id).delete()
    db.query(SMTPProfile).filter_by(user_id=user_id).delete()
    db.query(Mapping).filter_by(user_id=user_id).delete()
    db.query(Template).filter_by(user_id=user_id).delete()
    db.query(Execution).filter_by(user_id=user_id).delete()
    db.query(Schedule).filter_by(user_id=user_id).delete()
    db.query(GameScore).filter_by(user_id=user_id).delete()

    db.delete(user)
    db.commit()
    log_audit(db, auth, "user.delete", "user", user_id, f"Deleted {deleted_email}")
    return {"message": "User deleted"}
