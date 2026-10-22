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
    PASSWORD_RESET_SMTP_PROFILE_ID: Optional[int] = None  # system mailbox: sends forgot-password emails and the weekly admin digest
    PASSWORD_RESET_TOKEN_MINUTES: int = 30
    WEEKLY_DIGEST_ENABLED: bool = True  # Monday 09:00 server time; sent from the same system mail profile as password resets
    # Fernet key that encrypts SMTP mailbox passwords at rest (generate with
    # `python -c "from cryptography.fernet import Fernet; print(Fernet.generate_key().decode())"`).
    # Unset = passwords are stored and read as plain text, as before. Losing the key
    # makes already-encrypted passwords unrecoverable (profiles need re-entering).
    SMTP_ENCRYPTION_KEY: Optional[str] = None
    # Laboratory (Split / Analyze / Kitchen) guard rails: openpyxl needs ~450-830 bytes
    # of RAM per cell, so an oversized workbook can take the whole server down.
    LAB_MAX_UPLOAD_MB: int = 40
    LAB_MAX_CELLS: int = 2_500_000
    BACKUP_DIR: str = "/var/backups/automation-studio"  # where ops/backup-db.sh writes dumps
    UPLOAD_RETENTION_DAYS: int = 30  # campaign upload folders older than this are offered for cleanup

    class Config:
        env_file = ".env"

settings = Settings()
