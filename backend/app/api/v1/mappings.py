from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy.orm import Session
from typing import List
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.mapping import MappingCreate, MappingResponse, MappingEntryResponse
from app.models import Mapping, MappingEntry

router = APIRouter(prefix="/mappings", tags=["mappings"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.get("/", response_model=List[MappingResponse])
def get_mappings(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    if role == "admin":
        return db.query(Mapping).all()
    return db.query(Mapping).filter_by(user_id=user_id).all()

@router.post("/", response_model=MappingResponse)
def create_mapping(mapping: MappingCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    
    new_mapping = Mapping(user_id=user_id, mapping_name=mapping.mapping_name, file_path="")
    db.add(new_mapping)
    db.flush()
    
    for entry in mapping.entries:
        new_entry = MappingEntry(
            mapping_id=new_mapping.id,
            branch_name=entry.get("BranchName", entry.get("branch_name", "")),
            to_recipients=entry.get("To", entry.get("to", "")),
            cc_recipients=entry.get("CC", entry.get("cc", ""))
        )
        db.add(new_entry)
    
    db.commit()
    db.refresh(new_mapping)
    return new_mapping

@router.get("/{mapping_id}/entries", response_model=List[MappingEntryResponse])
def get_mapping_entries(mapping_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    mapping = db.query(Mapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if role != "admin" and mapping.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    return db.query(MappingEntry).filter_by(mapping_id=mapping_id).all()

@router.delete("/{mapping_id}")
def delete_mapping(mapping_id: int, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    mapping = db.query(Mapping).filter_by(id=mapping_id).first()
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    if role != "admin" and mapping.user_id != user_id:
        raise HTTPException(status_code=403, detail="Access denied")
    
    db.query(MappingEntry).filter_by(mapping_id=mapping_id).delete()
    db.delete(mapping)
    db.commit()
    return {"message": "Mapping deleted"}
