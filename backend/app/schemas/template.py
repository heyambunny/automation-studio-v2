from pydantic import BaseModel
from typing import Optional

class TemplateCreate(BaseModel):
    template_name: str
    template_type: str
    content: str

class TemplateResponse(BaseModel):
    id: int
    template_name: str
    template_type: str
    content: str
    
    class Config:
        from_attributes = True
