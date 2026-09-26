from pydantic_settings import BaseSettings
from typing import List

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql://harishmotwani@localhost:5432/automation_studio"
    JWT_SECRET_KEY: str = "automation-studio-dev-secret-key-2026"
    JWT_ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 60
    REFRESH_TOKEN_EXPIRE_DAYS: int = 7
    CORS_ORIGINS: List[str] = ["http://localhost:3000"]
    FRONTEND_URL: str = "http://localhost:3000"  # base URL used to build links in outgoing emails
    
    class Config:
        env_file = ".env"

settings = Settings()
