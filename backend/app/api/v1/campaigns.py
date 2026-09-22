from fastapi import APIRouter, Depends, HTTPException, Header, UploadFile, File
from sqlalchemy.orm import Session
from typing import List, Optional
import json
import os
import uuid
from datetime import datetime
from app.core.database import get_db
from app.core.security import decode_token
from app.schemas.campaign import CampaignExecuteRequest, CampaignRecipeCreate
from app.models import Mapping, MappingEntry, SMTPProfile, Execution

router = APIRouter(prefix="/campaigns", tags=["campaigns"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    return int(payload.get("sub")), payload.get("role", "viewer")

@router.post("/upload-files")
async def upload_files(files: List[UploadFile] = File(...), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    campaign_folder_id = str(uuid.uuid4())[:8]
    upload_dir = os.path.join("uploads", "campaigns", campaign_folder_id)
    os.makedirs(upload_dir, exist_ok=True)
    
    for file in files:
        file_path = os.path.join(upload_dir, file.filename)
        with open(file_path, "wb") as f:
            f.write(await file.read())
    
    return {"campaign_folder": upload_dir, "campaign_folder_id": campaign_folder_id, "files_uploaded": len(files)}

@router.post("/execute")
def execute_campaign(request: CampaignExecuteRequest, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    
    # Validate mapping
    mapping = db.query(Mapping).filter_by(id=request.mapping_id).first() if request.mapping_id else None
    if not mapping:
        raise HTTPException(status_code=404, detail="Mapping not found")
    
    entries = db.query(MappingEntry).filter_by(mapping_id=mapping.id).all()
    if not entries:
        raise HTTPException(status_code=404, detail="Mapping has no entries")
    
    # Validate SMTP profile
    profile = db.query(SMTPProfile).filter_by(profile_name=request.smtp_profile).first()
    if not profile:
        raise HTTPException(status_code=404, detail="SMTP profile not found")
    
    # Create execution record
    execution = Execution(
        user_id=user_id,
        campaign_name=request.report_type,
        status="queued",
        send_method="SMTP",
        mode="static/static",
        total_emails=len(entries),
        sent_count=0,
        failed_count=0
    )
    db.add(execution)
    db.commit()
    
    return {
        "message": "Campaign queued for execution",
        "execution_id": execution.id,
        "total_emails": len(entries)
    }

@router.get("/recipes")
def get_recipes(db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    recipes_dir = "recipes"
    if not os.path.exists(recipes_dir):
        return []

    recipes = []
    for f in os.listdir(recipes_dir):
        if f.endswith('.json'):
            with open(os.path.join(recipes_dir, f), 'r') as file:
                data = json.load(file)
                if role == "admin" or data.get('user_id') == user_id:
                    # Return the full saved config (not just display fields) so
                    # the campaign wizard can pre-fill for both Run and Edit.
                    recipes.append({**data, "filename": f, "saved_name": data.get('saved_name', 'Unnamed')})
    recipes.sort(key=lambda r: r.get("saved_at", ""), reverse=True)
    return recipes

@router.post("/recipes")
def save_recipe(recipe: CampaignRecipeCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    recipes_dir = "recipes"
    os.makedirs(recipes_dir, exist_ok=True)
    
    filename = f"{recipe.saved_name.replace(' ', '_')}_{datetime.now().strftime('%Y%m%d_%H%M%S')}.json"
    config = recipe.config
    config['saved_name'] = recipe.saved_name
    config['saved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    config['user_id'] = user_id
    
    with open(os.path.join(recipes_dir, filename), 'w') as f:
        json.dump(config, f, indent=2)

    return {"message": "Recipe saved", "filename": filename}

@router.put("/recipes/{filename}")
def update_recipe(filename: str, recipe: CampaignRecipeCreate, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    """Overwrite an existing recipe in place (used when saving from Edit), so
    editing a saved campaign updates it instead of creating a duplicate."""
    user_id, role = auth
    recipes_dir = "recipes"
    filename = os.path.basename(filename)
    file_path = os.path.join(recipes_dir, filename)
    if not os.path.exists(file_path):
        raise HTTPException(status_code=404, detail="Recipe not found")

    with open(file_path, 'r') as f:
        existing = json.load(f)
    if role != "admin" and existing.get('user_id') != user_id:
        raise HTTPException(status_code=403, detail="Not authorized to update this recipe")

    config = recipe.config
    config['saved_name'] = recipe.saved_name
    config['saved_at'] = datetime.now().strftime('%Y-%m-%d %H:%M:%S')
    config['user_id'] = existing.get('user_id', user_id)

    with open(file_path, 'w') as f:
        json.dump(config, f, indent=2)

    return {"message": "Recipe updated", "filename": filename}

@router.delete("/recipes/{filename}")
def delete_recipe(filename: str, db: Session = Depends(get_db), auth: tuple = Depends(get_current_user)):
    user_id, role = auth
    recipes_dir = "recipes"
    filename = os.path.basename(filename)
    file_path = os.path.join(recipes_dir, filename)
    if os.path.exists(file_path):
        os.remove(file_path)
        return {"message": "Recipe deleted"}
    raise HTTPException(status_code=404, detail="Recipe not found")
