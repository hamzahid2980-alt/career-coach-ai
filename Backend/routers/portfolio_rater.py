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
        # 1. Scrape Content (using Jina Reader for better JS/SPA support)
        jina_url = f"https://r.jina.ai/{req.url}"
        headers = {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/91.0.4472.124 Safari/537.36',
            'X-Return-Format': 'markdown'
        }
        
        try:
            res = requests.get(jina_url, headers=headers, timeout=25)
            res.raise_for_status()
            text_content = res.text[:8000] # Increased limit for markdown
        except requests.exceptions.RequestException as e:
            # Fallback to direct scraping if Jina fails (or for local testing)
            try:
                print(f"Jina failed ({e}), using fallback scraper...")
                res = requests.get(req.url, headers={'User-Agent': 'Mozilla/5.0'}, timeout=10)
                soup = BeautifulSoup(res.text, 'html.parser')
                text_content = soup.get_text(separator=' ', strip=True)[:6000]
            except Exception as e2:
                 raise HTTPException(status_code=400, detail=f"Failed to access URL: {str(e2)}")
            
        if not text_content or len(text_content) < 50:
             raise HTTPException(status_code=400, detail="Could not extract sufficient text from the provided URL. The site might be blocking bots or requires strict authentication.")

    except HTTPException as he:
        raise he
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Scraping failed: {str(e)}")

    # 2. AI Analysis
    prompt = f"""
    Act as a **Strict, No-Nonsense Lead Technical Recruiter**. code-name 'The Auditor'.
    Your job is to audit this portfolio for a job application.
    
    **CRITICAL RULES (READ CAREFULLY):**
    1. **NO HALLUCINATION**: Only use facts explicitly present in the [CONTENT] below. If a skill, project, or detail is not there, DO NOT invent it.
    2. **HONESTY**: If the portfolio has very little content, give it a LOW SCORE. Do not be nice.
    3. **VERIFICATION**: Identify if the user is a Developer, Designer, or Manager based ONLY on the evidence.
    4. **CONTENT CHECK**: If the content looks like an error page, a login screen, or "JavaScript required", stop immediately and return a score of 0 with a warning.

    ---
    **TARGET URL**: {req.url}
    
    **CONTENT START**:
    {text_content}
    **CONTENT END**
    ---

    **TASK:**
    1. Detect the Profession.
    2. Evaluate 'Hireability' (0-100). 
       - < 40: Empty/Broken/Terrible
       - 40-60: Junior/Generic
       - 60-80: Good/Competent
       - 80+: Exceptional/World-Class
    3. Extract **3 Specific Strong Points** directly from the text.
    4. Extract **3 Specific Red Flags** (e.g., "Generic descriptions", "No live links", "Typos", "Lack of complex projects").

    **RETURN JSON ONLY:**
    {{
        "detected_role": "Role Name",
        "hireability_score": 0,
        "recruiter_overview": "A brutally honest paragraph summarizing the candidate. Mention specific projects found in the text.",
        "metrics": {{
            "clarity": 0,
            "evidence_of_skill": 0,
            "culture_fit": 0
        }},
        "feedback": {{
            "strong_points": ["Specific Point 1", "Specific Point 2"],
            "red_flags": ["Critique 1", "Critique 2"]
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
