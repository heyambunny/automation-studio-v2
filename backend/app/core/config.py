from pydantic_settings import BaseSettings
from typing import List, Optional

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://harishmotwani@localhost:5432/automation_studio"
    JWT_SECRET_KEY: str = "automation-studio-dev-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 1440  # ~1 day - the frontend never calls /auth/refresh, so this is the actual session length
    REFRESH_TOKEN_EXPIRE_DAYS: int = 1
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"  # base URL used to build links in outgoing emails
    PASSWORD_RESET_SMTP_PROFILE_ID: Optional[int] = None  # SMTP profile that sends forgot-password emails
    PASSWORD_RESET_TOKEN_MINUTES: int = 30

    class Config:
        env_file = ".env"

settings = Settings()
