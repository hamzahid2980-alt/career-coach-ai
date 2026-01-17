from fastapi import APIRouter, HTTPException, UploadFile, File, Form
from pydantic import BaseModel
from typing import List, Dict, Optional

# Corrected imports from ai_core
from core.ai_core import get_interview_chat_response, get_interview_summary, process_audio_answer
from core.db_core import DatabaseManager
from dependencies import get_db_manager, get_current_user
from fastapi import Depends

router = APIRouter(
    tags=["Mock Interview"]
)

# ==========================================================
# Pydantic Models
# ==========================================================

class ChatMessage(BaseModel):
    role: str
    content: str

class ChatRequest(BaseModel):
    job_description: str
    chat_history: List[ChatMessage]
    difficulty: str

class ChatResponse(BaseModel):
    reply: str

class ProctoringData(BaseModel):
    tab_switch_count: int = 0
    phone_detection_count: int = 0
    no_person_warnings: int = 0
    multiple_person_warnings: int = 0
    loud_noise_warnings: int = 0
    termination_reason: Optional[str] = None

class SummarizeRequest(BaseModel):
    job_description: str
    chat_history: List[ChatMessage]
    proctoring_data: Optional[ProctoringData] = None

class SummaryResponse(BaseModel):
    overall_score: int
    strengths: List[str]
    areas_for_improvement: List[str]
    overall_feedback: str

class VideoFeedbackResponse(BaseModel):
    feedback: str
    next_question: str

# ==========================================================
# Endpoints
# ==========================================================

@router.post("/chat", response_model=ChatResponse, summary="Get the next interview question")
async def conduct_interview_chat(request: ChatRequest):
    if not request.job_description or not request.job_description.strip():
        raise HTTPException(status_code=400, detail="Job description cannot be empty.")
    response_data = get_interview_chat_response(
        job_description=request.job_description,
        history=[msg.dict() for msg in request.chat_history],
        difficulty=request.difficulty
    )
    if not response_data or "reply" not in response_data:
        raise HTTPException(status_code=500, detail="AI failed to generate a chat response.")
    return response_data

@router.post("/video", response_model=VideoFeedbackResponse, summary="Analyze a recorded audio answer")
async def analyze_video_answer(
    video_file: UploadFile = File(...),
    question: str = Form(...),
    job_description: str = Form(...)
):
    audio_content = await video_file.read()
    feedback_data = process_audio_answer(
        audio_content=audio_content,
        question=question,
        job_description=job_description
    )
    if not feedback_data:
        raise HTTPException(status_code=500, detail="AI failed to process the audio answer.")
    return feedback_data

@router.post("/summarize", response_model=SummaryResponse, summary="Summarize the interview performance")
async def summarize_interview(request: SummarizeRequest,
                              user: dict = Depends(get_current_user),
                              db: DatabaseManager = Depends(get_db_manager)):
    # *** THIS IS THE CORE FIX ***
    # We now check if the history is empty. If it is, we ONLY proceed if
    # there is a valid termination_reason. Otherwise, we raise an error.
    if not request.chat_history:
        if not (request.proctoring_data and request.proctoring_data.termination_reason):
             raise HTTPException(status_code=400, detail="Chat history cannot be empty for a normal summary.")

    # Convert Pydantic model to dict for the AI function, handling the case where it might be None
    proctoring_dict = request.proctoring_data.dict() if request.proctoring_data else None

    summary_data = get_interview_summary(
        job_description=request.job_description,
        history=[msg.dict() for msg in request.chat_history],
        proctoring_data=proctoring_dict
    )
    
    if not summary_data:
        raise HTTPException(status_code=500, detail="AI failed to generate an interview summary.")
        
    db.save_interview_result(user['uid'], summary_data)
        
    return summary_data