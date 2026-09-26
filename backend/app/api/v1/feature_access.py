from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from app.core.database import get_db
from app.core.security import decode_token
from app.core.audit import log_audit
from app.models import FeatureAccess, User

router = APIRouter(prefix="/feature-access", tags=["feature-access"])

# The set of pages that can be turned on/off. Dashboard and Settings are
# intentionally excluded - Settings hosts this control panel and must stay
# reachable, and Dashboard is the landing page everyone lands on after login.
FEATURE_REGISTRY = [
    {"key": "new_campaign", "label": "New Campaign"},
    {"key": "laboratory", "label": "Laboratory"},
    {"key": "mappings", "label": "Mappings"},
    {"key": "history", "label": "History"},
    {"key": "recipes", "label": "Saved Campaigns"},
    {"key": "templates", "label": "Templates"},
    {"key": "schedules", "label": "Schedules"},
    {"key": "announcements", "label": "Announcements"},
    {"key": "data_browser", "label": "Data Browser"},
    {"key": "audit_log", "label": "Audit Log"},
    {"key": "user_activity", "label": "User Activity"},
    {"key": "games", "label": "Mini Games"},
]
FEATURE_KEYS = {f["key"] for f in FEATURE_REGISTRY}


class RoleFeatureUpdate(BaseModel):
    feature_key: str
    role: str
    enabled: bool


class UserFeatureUpdate(BaseModel):
    feature_key: str
    user_id: int
    enabled: bool


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
    return int(payload.get("sub")), payload.get("role", "viewer")


def _validate_feature_key(feature_key: str):
    if feature_key not in FEATURE_KEYS:
        raise HTTPException(status_code=400, detail="Unknown feature")


@router.get("/")
def get_feature_access(db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    role_rows = db.query(FeatureAccess).filter(FeatureAccess.role.isnot(None)).all()
    user_rows = db.query(FeatureAccess).filter(FeatureAccess.user_id.isnot(None)).all()
    users_by_id = {u.id: u for u in db.query(User).all()}
    return {
        "features": FEATURE_REGISTRY,
        "role_overrides": [
            {"feature_key": r.feature_key, "role": r.role, "enabled": r.enabled} for r in role_rows
        ],
        "user_overrides": [
            {
                "feature_key": r.feature_key,
                "user_id": r.user_id,
                "enabled": r.enabled,
                "user_email": users_by_id[r.user_id].email if r.user_id in users_by_id else None,
                "user_name": users_by_id[r.user_id].full_name if r.user_id in users_by_id else None,
            }
            for r in user_rows
        ],
    }


@router.get("/effective")
def get_effective_features(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    """What the current logged-in user can see: role default (enabled),
    overridden by any role-level row, overridden again by any user-specific
    row for them personally."""
    user_id, role = auth
    result = {f["key"]: True for f in FEATURE_REGISTRY}

    for r in db.query(FeatureAccess).filter_by(role=role).all():
        if r.feature_key in result:
            result[r.feature_key] = r.enabled

    for r in db.query(FeatureAccess).filter_by(user_id=user_id).all():
        if r.feature_key in result:
            result[r.feature_key] = r.enabled

    return result


@router.put("/role")
def set_role_feature(data: RoleFeatureUpdate, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    _validate_feature_key(data.feature_key)
    if data.role not in ("admin", "manager"):
        raise HTTPException(status_code=400, detail="Invalid role")
    existing = db.query(FeatureAccess).filter_by(feature_key=data.feature_key, role=data.role).first()
    if existing:
        existing.enabled = data.enabled
    else:
        db.add(FeatureAccess(feature_key=data.feature_key, role=data.role, enabled=data.enabled))
    db.commit()
    log_audit(db, auth, "feature_access.role_update", "feature_access", None,
              f"Set {data.feature_key} = {'enabled' if data.enabled else 'disabled'} for role {data.role}")
    return {"message": "Updated"}


@router.delete("/role/{feature_key}/{role}")
def reset_role_feature(feature_key: str, role: str, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    db.query(FeatureAccess).filter_by(feature_key=feature_key, role=role).delete()
    db.commit()
    log_audit(db, auth, "feature_access.role_reset", "feature_access", None,
              f"Reset {feature_key} for role {role} to default")
    return {"message": "Reset"}


@router.put("/user")
def set_user_feature(data: UserFeatureUpdate, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    _validate_feature_key(data.feature_key)
    target = db.query(User).filter_by(id=data.user_id).first()
    if not target:
        raise HTTPException(status_code=404, detail="User not found")
    existing = db.query(FeatureAccess).filter_by(feature_key=data.feature_key, user_id=data.user_id).first()
    if existing:
        existing.enabled = data.enabled
    else:
        db.add(FeatureAccess(feature_key=data.feature_key, user_id=data.user_id, enabled=data.enabled))
    db.commit()
    log_audit(db, auth, "feature_access.user_update", "feature_access", data.user_id,
              f"Set {data.feature_key} = {'enabled' if data.enabled else 'disabled'} for {target.email}")
    return {"message": "Updated"}


@router.delete("/user/{feature_key}/{user_id}")
def reset_user_feature(feature_key: str, user_id: int, db: Session = Depends(get_db), auth: int = Depends(get_current_admin)):
    db.query(FeatureAccess).filter_by(feature_key=feature_key, user_id=user_id).delete()
    db.commit()
    log_audit(db, auth, "feature_access.user_reset", "feature_access", user_id,
              f"Reset {feature_key} for user {user_id} to default")
    return {"message": "Reset"}
