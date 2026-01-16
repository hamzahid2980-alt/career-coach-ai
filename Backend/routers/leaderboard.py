import sys
from pathlib import Path

# Ensure backend directory is in sys.path
current_file_dir = Path(__file__).resolve().parent
backend_dir = current_file_dir.parent
if str(backend_dir) not in sys.path:
    sys.path.insert(0, str(backend_dir))

from fastapi import APIRouter, HTTPException, Depends
from typing import List, Dict, Any
from pydantic import BaseModel
from core.ai_core import generate_user_comparison

from core.db_core import DatabaseManager
from dependencies import get_db_manager, get_current_user

router = APIRouter()

@router.get("/", response_model=List[Dict[str, Any]])
async def get_leaderboard_data(
    user: dict = Depends(get_current_user), 
    db: DatabaseManager = Depends(get_db_manager)
):
    """
    Returns the top users based on activity stats.
    """
    try:
        leaderboard = db.get_leaderboard(limit=50)
        return leaderboard
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to fetch leaderboard: {str(e)}")

class CompareRequest(BaseModel):
    user1: Dict[str, Any]
    user2: Dict[str, Any]

@router.post("/compare")
async def compare_users(
    request: CompareRequest,
    user: dict = Depends(get_current_user)
):
    """
    Compares two users using AI.
    """
    try:
        comparison_result = generate_user_comparison(request.user1, request.user2)
        if not comparison_result:
             raise HTTPException(status_code=500, detail="AI failed to generate comparison.")
        return comparison_result
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to compare users: {str(e)}")