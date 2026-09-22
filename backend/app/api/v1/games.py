from fastapi import APIRouter, Depends, Header
from sqlalchemy.orm import Session
from pydantic import BaseModel
from typing import Optional
from app.core.database import get_db
from app.core.security import decode_token
from app.models import GameScore, User

router = APIRouter(prefix="/games", tags=["games"])

class ScoreCreate(BaseModel):
    game_name: str
    score: int

def get_current_user(authorization: str = Header(...)):
    token = authorization.replace("Bearer ", "")
    payload = decode_token(token)
    if not payload:
        return None
    return int(payload.get("sub"))

@router.post("/scores")
def submit_score(score_data: ScoreCreate, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    if not user_id:
        return {"message": "Not authenticated"}
    new_score = GameScore(user_id=user_id, game_name=score_data.game_name, score=score_data.score)
    db.add(new_score)
    db.commit()
    return {"message": "Score saved", "score": score_data.score}

@router.get("/leaderboard/{game_name}")
def get_leaderboard(game_name: str, db: Session = Depends(get_db)):
    scores = db.query(GameScore, User).join(User, GameScore.user_id == User.id).filter(GameScore.game_name == game_name).order_by(GameScore.score.desc()).limit(10).all()
    result = []
    for score, user in scores:
        result.append({
            "name": user.full_name or user.email,
            "avatar": user.avatar or "bear-brown",
            "score": score.score,
            "date": score.created_at.strftime("%Y-%m-%d %H:%M") if score.created_at else ""
        })
    return result

@router.get("/user-best/{game_name}")
def get_user_best(game_name: str, db: Session = Depends(get_db), user_id: int = Depends(get_current_user)):
    if not user_id:
        return {"best": 0}
    best = db.query(GameScore).filter_by(user_id=user_id, game_name=game_name).order_by(GameScore.score.desc()).first()
    return {"best": best.score if best else 0}
