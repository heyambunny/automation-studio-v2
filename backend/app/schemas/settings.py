from pydantic import BaseModel
from typing import Optional

from typing import Optional

class SMTPProfileCreate(BaseModel):
    profile_name: str
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_name: Optional[str] = ""
    password: Optional[str] = None
    use_tls: bool = True
    is_default: bool = False

class SMTPProfileResponse(BaseModel):
    id: int
    profile_name: str
    smtp_server: str
    smtp_port: int
    sender_email: str
    sender_name: Optional[str]
    password: Optional[str] = None
    use_tls: bool
    is_default: bool
    owner_name: Optional[str] = None
    owner_email: Optional[str] = None

    class Config:
        from_attributes = True

class SettingUpdate(BaseModel):
    default_sheet_name: Optional[str] = None
    default_starting_cell: Optional[str] = None
    notify_on_failure: Optional[bool] = None
