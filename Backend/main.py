import os
import json
import sys
from pathlib import Path
from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
import firebase_admin
from firebase_admin import credentials, initialize_app
from routers import auth, resume, roadmap, user, joblisting, assessment, interview, leaderboard, trends # <--- Added trends
# ------------------------------
# Firebase Admin SDK Initialization
# ------------------------------
if not firebase_admin._apps:
    try:
        firebase_creds = os.environ.get("FIREBASE_CREDENTIALS")
        if firebase_creds:
            # Load credentials from environment variable (Render/Production)
            cred_dict = json.loads(firebase_creds)
            cred = credentials.Certificate(cred_dict)
        else:
            # Fallback to local JSON file (for local dev)
            credentials_path = Path(__file__).parent / "firebase-credentials.json"
            if not credentials_path.exists():
                # Try looking one level up just in case
                credentials_path = Path(__file__).parent.parent / "firebase-credentials.json"
            
            if credentials_path.exists():
                cred = credentials.Certificate(credentials_path)
            else:
                cred = None
                print("⚠️ Warning: 'firebase-credentials.json' not found.")
        
        if cred:
            initialize_app(cred)
            print("✅ Firebase Admin SDK initialized successfully.")
    except Exception as e:
        print(f"❌ Failed to initialize Firebase Admin SDK: {e}")
else:
    print("ℹ️ Firebase Admin SDK already initialized.")

# ------------------------------
# FastAPI App Setup
# ------------------------------
app = FastAPI(title="AI Career Coach API", version="2.0.0")

# --- CORS (Fixes 'Failed to fetch') ---
app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:8080",
        "http://127.0.0.1:8000",
        "https://ai-career-coach-hackwins.vercel.app"
    ],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# ------------------------------
# NEW: Serve Generated Portfolios
# ------------------------------
# Create directory if it doesn't exist
os.makedirs("generated_portfolios", exist_ok=True)
# Mount it so files are accessible at http://127.0.0.1:8000/generated_portfolios/filename.html
app.mount("/generated_portfolios", StaticFiles(directory="generated_portfolios"), name="generated_portfolios")

# ------------------------------
# Include Routers
# ------------------------------
# Ensure 'portfolio.py' exists in the 'routers' folder!
@app.get("/api/debug-auth")
async def debug_auth():
    """
    Temporary endpoint to diagnose Firebase Auth issues on Render.
    """
    import os
    import json
    
    # 1. Check Env Var
    creds_env = os.environ.get("FIREBASE_CREDENTIALS")
    env_status = "Missing"
    if creds_env:
        try:
            json.loads(creds_env)
            env_status = f"Present (Valid JSON, Length: {len(creds_env)})"
        except json.JSONDecodeError:
            env_status = "Present (INVALID JSON)"
            
    # 2. Check Initialization
    is_initialized = bool(firebase_admin._apps)
    
    return {
        "firebase_admin_initialized": is_initialized,
        "environment_variable_status": env_status,
        "backend_pid": os.getpid(),
        "python_version": sys.version
    }

from routers import auth, resume, roadmap, user, joblisting, assessment, interview, portfolio, career_mail, portfolio_rater

# Register the routes
app.include_router(auth.router, prefix="/api/auth", tags=["Authentication"])
app.include_router(resume.router, prefix="/api/resume", tags=["Resume and Optimization"])
app.include_router(roadmap.router, prefix="/api/roadmap", tags=["Career Roadmap"])
app.include_router(user.router, prefix="/api/user", tags=["User Profile"])
app.include_router(joblisting.router, prefix="/api/jobs", tags=["Job Listing and Matching"])
app.include_router(assessment.router, prefix="/api/assessment", tags=["Skill Assessment"])
app.include_router(interview.router, prefix="/api/interview", tags=["Mock Interview"])
app.include_router(portfolio.router, prefix="/api/portfolio", tags=["Portfolio Builder"])
app.include_router(leaderboard.router, prefix="/api/leaderboard", tags=["Leaderboard"])
app.include_router(trends.router, prefix="/api/trends", tags=["Market Trends"])
app.include_router(career_mail.router, prefix="/api/career-mail", tags=["Career Mail Agent"])
app.include_router(portfolio_rater.router, prefix="/api/portfolio-rater", tags=["Portfolio Rater"])

# ------------------------------
# Root Endpoint
# ------------------------------
@app.get("/")
async def root():
    return {"message": "AI Career Coach Backend is running!"}

# ------------------------------
# Local Development Only
# ------------------------------
if __name__ == "__main__":
    import uvicorn
    uvicorn.run("main:app", host="127.0.0.1", port=8000, reload=True)