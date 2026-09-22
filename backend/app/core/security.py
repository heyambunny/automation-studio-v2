from datetime import datetime, timedelta
from typing import Optional
import hashlib
import hmac
import bcrypt
from jose import JWTError, jwt
from app.core.config import settings

def hash_password(password: str) -> str:
    return bcrypt.hashpw(password.encode('utf-8'), bcrypt.gensalt()).decode('utf-8')

def _verify_legacy_pbkdf2(plain_password: str, stored_hash: str) -> bool:
    # Format produced by the (now-unused) User.hash_password() in
    # app/models/user.py: "<salt-hex>:<pbkdf2-sha256-hex>". Some accounts in
    # the shared production DB were created with that method before this app
    # standardized on bcrypt; verified here too so those logins keep working.
    try:
        salt, hash_val = stored_hash.split(":")
        computed = hashlib.pbkdf2_hmac('sha256', plain_password.encode('utf-8'), salt.encode('utf-8'), 100000).hex()
        return hmac.compare_digest(computed, hash_val)
    except (ValueError, AttributeError):
        return False

def verify_password(plain_password: str, hashed_password: str) -> bool:
    if hashed_password.startswith(("$2a$", "$2b$", "$2y$")):
        try:
            return bcrypt.checkpw(plain_password.encode('utf-8'), hashed_password.encode('utf-8'))
        except ValueError:
            return False
    if ":" in hashed_password:
        return _verify_legacy_pbkdf2(plain_password, hashed_password)
    return False

def create_access_token(user_id: int, role: str) -> str:
    expire = datetime.utcnow() + timedelta(minutes=settings.ACCESS_TOKEN_EXPIRE_MINUTES)
    payload = {"sub": str(user_id), "role": role, "exp": expire, "type": "access"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def create_refresh_token(user_id: int) -> str:
    expire = datetime.utcnow() + timedelta(days=settings.REFRESH_TOKEN_EXPIRE_DAYS)
    payload = {"sub": str(user_id), "exp": expire, "type": "refresh"}
    return jwt.encode(payload, settings.JWT_SECRET_KEY, algorithm=settings.JWT_ALGORITHM)

def decode_token(token: str) -> Optional[dict]:
    try:
        payload = jwt.decode(token, settings.JWT_SECRET_KEY, algorithms=[settings.JWT_ALGORITHM])
        return payload
    except JWTError:
        return None
