from fastapi import APIRouter, HTTPException, Depends
from pydantic import BaseModel
import requests
from bs4 import BeautifulSoup
import json
from dependencies import get_current_user

# Use the centralized gemini handler for key rotation and robustness
from core.gemini_handler import gemini_client

router = APIRouter()

# --- CONFIG ---
# No local config needed; gemini_client handles keys internally

class RateRequest(BaseModel):
    url: str

@router.post("/rate")
async def rate_portfolio(req: RateRequest, user: dict = Depends(get_current_user)):
    """
    Analyzes a portfolio URL and returns a recruiter-style rating.
    Requires user authentication.
    """
    try:
        # 1. Scrape Content
        headers = {'User-Agent': 'Mozilla/5.0'}
        try:
            res = requests.get(req.url, headers=headers, timeout=10)
            res.raise_for_status()
        except requests.exceptions.RequestException as e:
            raise HTTPException(status_code=400, detail=f"Failed to access URL: {str(e)}")
            
        soup = BeautifulSoup(res.text, 'html.parser')
        # Limit text content to avoid token limits
        text_content = soup.get_text(separator=' ', strip=True)[:6000]
        
        if not text_content:
             raise HTTPException(status_code=400, detail="Could not extract text from the provided URL.")

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

    # 2. AI Analysis
    prompt = f"""
    Act as a Lead Technical Recruiter. Audit this portfolio for a job application.
    
    TARGET URL: {req.url}
    CONTENT: {text_content}

    **TASK:**
    1. Detect the Profession (e.g., Designer, Developer, Writer).
    2. Adapt criteria: Developers need code/GitHub; Designers need visual galleries.
    3. Calculate 'Hireability': A strict score of how likely you are to interview them.

    **RETURN JSON ONLY:**
    {{
        "detected_role": "Role Name",
        "hireability_score": 0,
        "recruiter_overview": "2-3 sentences summarizing the candidate's appeal to a hiring manager.",
        "metrics": {{
            "clarity": 0,
            "evidence_of_skill": 0,
            "culture_fit": 0
        }},
        "feedback": {{
            "strong_points": ["Point 1", "Point 2"],
            "red_flags": ["Point 1", "Point 2"]
        }}
    }}
    """
    
    try:
        # Use the robust handler
        response = gemini_client.call_gemini(prompt)
        
        if not response:
            raise HTTPException(status_code=503, detail="AI Service currently unavailable (All keys exhausted)")

        raw = response.text.replace("```json", "").replace("```", "").strip()
        return json.loads(raw)
    except Exception as e:
        print(f"AI Analysis Error: {e}")
        raise HTTPException(status_code=500, detail=f"AI Analysis Failed: {str(e)}")
