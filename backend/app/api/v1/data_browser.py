from fastapi import APIRouter, Depends, HTTPException, Header
from sqlalchemy import inspect, text
from sqlalchemy.orm import Session
from app.core.database import get_db, engine
from app.core.security import decode_token

router = APIRouter(prefix="/data-browser", tags=["data-browser"])

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        raise HTTPException(status_code=401, detail="Invalid token")
    if payload.get("role") != "admin":
        raise HTTPException(status_code=403, detail="Admin only")
    return int(payload.get("sub"))

@router.get("/tables")
def get_tables(auth: int = Depends(get_current_user)):
    inspector = inspect(engine)
    tables = inspector.get_table_names()
    return {"tables": tables}

@router.get("/table/{table_name}")
def get_table_data(table_name: str, db: Session = Depends(get_db), auth: int = Depends(get_current_user)):
    try:
        result = db.execute(text(f"SELECT * FROM {table_name} LIMIT 100"))
        rows = result.fetchall()
        columns = result.keys()
        data = [dict(zip(columns, row)) for row in rows]
        # Convert datetime objects to strings
        for row in data:
            for key, value in row.items():
                if hasattr(value, 'strftime'):
                    row[key] = value.strftime('%Y-%m-%d %H:%M:%S')
                elif hasattr(value, 'value'):
                    row[key] = value.value
        return {"rows": data}
    except Exception as e:
        raise HTTPException(status_code=400, detail=str(e))
