from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.template import TemplateCreate, TemplateResponse
from app.models import Template

router = APIRouter(prefix="/templates", tags=["templates"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.get("/", response_model=List[TemplateResponse])
def get_templates(template_type: str = None, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    query = db.query(Template)
    if template_type:
        query = query.filter_by(template_type=template_type)
    if role == "admin":
        return query.all()
    return query.filter((Template.user_id == user_id) | (Template.user_id == 1)).all()

@router.post("/", response_model=TemplateResponse)
def create_template(template: TemplateCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    new_template = Template(user_id=user_id, **template.dict())
    db.add(new_template)
    db.commit()
    db.refresh(new_template)
    return new_template

@router.delete("/{template_id}")
def delete_template(template_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    template = db.query(Template).filter_by(id=template_id).first()
    if not template:
        raise HTTPException(status_code=404, detail="Template not found")
    if role != "admin" and template.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    db.delete(template)
    db.commit()
    return {"message": "Template deleted"}
