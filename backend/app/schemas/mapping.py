from pydantic import BaseModel
from typing import Optional, Any
from datetime import datetime

class MappingCreate(BaseModel):
    mapping_name: str
    entries: list

class MappingResponse(BaseModel):
    id: int
    mapping_name: str
    created_at: Optional[Any] = None
    updated_at: Optional[Any] = None
    
    class Config:
        from_attributes = True

class MappingEntryResponse(BaseModel):
    id: int
    branch_name: str
    to_recipients: str
    cc_recipients: Optional[str] = ""
    
    class Config:
        from_attributes = True
