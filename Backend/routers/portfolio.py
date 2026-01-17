import uuid
import os
from fastapi import APIRouter, File, UploadFile, Request, Depends, HTTPException
from pydantic import BaseModel
from core.ai_core import extract_text_auto
from core.portfolio_services import PortfolioGenerator, GitHubPublisher, get_portfolio_data_from_gemini
from dependencies import get_current_user

router = APIRouter()

@router.post("/generate-direct")
async def generate_direct(request: Request, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    # 1. Extract Text
    file_bytes = await file.read()
    ext = os.path.splitext(file.filename)[1].lower()
    raw_text = extract_text_auto(file_bytes, ext) 
    
    if not raw_text:
        raise HTTPException(status_code=400, detail="Could not extract text from file.")

    # 2. Get Structured Data (Using robust Gemini prompt)
    try:
        portfolio_data = get_portfolio_data_from_gemini(raw_text)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Processing Failed: {str(e)}")

    # 3. Generate HTML
    html_code = PortfolioGenerator.generate_html(portfolio_data)
    
    if not html_code:
        raise HTTPException(status_code=500, detail="Failed to generate portfolio HTML.")

    # 4. Save as a hosted URL (Local)
    unique_id = uuid.uuid4().hex[:8]
    filename = f"portfolio_{unique_id}.html"
    os.makedirs("generated_portfolios", exist_ok=True)
    
    with open(f"generated_portfolios/{filename}", "w", encoding="utf-8") as f:
        f.write(html_code)

    base_url = str(request.base_url).rstrip("/")
    return {
        "url": f"{base_url}/generated_portfolios/{filename}",
        "slug": portfolio_data.get("personalInfo", {}).get("name", "portfolio").replace(" ", "-").lower(),
        "data": portfolio_data # Return data so frontend can potentially edit/publish
    }

class PublishRequest(BaseModel):
    data: dict

@router.post("/publish-json")
async def publish_json_portfolio(payload: PublishRequest, user: dict = Depends(get_current_user)):
    # ... logic ...
    pass

@router.post("/upload-resume")
async def upload_resume(file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    file_bytes = await file.read()
    print(f"DEBUG: upload_resume hit. Filename: {file.filename}, Size: {len(file_bytes)} bytes")
    ext = os.path.splitext(file.filename)[1].lower()
    raw_text = extract_text_auto(file_bytes, ext)
    if not raw_text:
        raise HTTPException(status_code=400, detail="Could not extract text")
    
    return {
        "filename": file.filename,
        "text_length": len(raw_text),
        "extracted_text": raw_text
    }

class GenerateFromTextRequest(BaseModel):
    content: str
    filename: str
    template: str = "creative" # Default to creative

@router.post("/generate-from-text")
async def generate_from_text_endpoint(payload: GenerateFromTextRequest, request: Request, user: dict = Depends(get_current_user)):
    # 1. Get Data
    try:
        portfolio_data = get_portfolio_data_from_gemini(payload.content)
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"AI Failed: {str(e)}")

    # 2. Generate HTML
    html_code = PortfolioGenerator.generate_html(portfolio_data, template=payload.template)

    # 3. Save
    unique_id = uuid.uuid4().hex[:8]
    filename = f"portfolio_{unique_id}.html"
    os.makedirs("generated_portfolios", exist_ok=True)
    with open(f"generated_portfolios/{filename}", "w", encoding="utf-8") as f:
        f.write(html_code)

    base_url = str(request.base_url).rstrip("/")
    
    return {
        "portfolio_data": portfolio_data,
        "html_content": html_code,
        "url": f"{base_url}/generated_portfolios/{filename}",
        "preview_url": f"{base_url}/generated_portfolios/{filename}",
        "skills_extracted": len(portfolio_data.get('skills', [])),
        "experience_count": len(portfolio_data.get('experience', [])),
        "projects_count": len(portfolio_data.get('projects', []))
    }

class RenderTemplateRequest(BaseModel):
    data: dict
    template: str

@router.post("/render-template")
async def render_template_endpoint(payload: RenderTemplateRequest):
    """
    Lightweight endpoint to purely re-render HTML with a different CSS template.
    Does NOT call AI.
    """
    html_code = PortfolioGenerator.generate_html(payload.data, template=payload.template)
    if not html_code:
        raise HTTPException(status_code=500, detail="Failed to render template")
    return {"html_content": html_code}

@router.post("/publish-portfolio")
async def publish_portfolio_endpoint(payload: dict, user: dict = Depends(get_current_user)):
    # Wrapper for publish-json to match expected endpoint name if needed, or use publish-json
    # payload is likely { ...portfolioData, preferredSlug: ... }
    # payload matches the structure of portfolioData primarily.
    
    # 1. Generate HTML (Reuse logic)
    # Extract template from payload, default to 'creative' if missing
    selected_template = payload.get("template", "creative")
    html_code = PortfolioGenerator.generate_html(payload, template=selected_template)
    
    if not html_code:
        raise HTTPException(status_code=500, detail="Failed to regenerate portfolio HTML.")

    # 2. Publish
    publisher = GitHubPublisher()
    try:
        base_slug = payload.get("personalInfo", {}).get("name", "portfolio").replace(" ", "-")
        # Override with preferred if exists
        if payload.get("preferredSlug"):
             base_slug = payload.get("preferredSlug")
             
        live_url = publisher.publish(base_slug, html_code)
        return {"url": live_url, "success": True}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub Publication Failed: {str(e)}")

@router.post("/publish-github")
async def publish_portfolio_github(request: Request, file: UploadFile = File(...), user: dict = Depends(get_current_user)):
    """
    Directly generates and publishes to GitHub Pages from a resume file.
    """
    # 1. Extract
    file_bytes = await file.read()
    ext = os.path.splitext(file.filename)[1].lower()
    raw_text = extract_text_auto(file_bytes, ext)
    if not raw_text: raise HTTPException(status_code=400, detail="No text found")

    # 2. Process
    data = get_portfolio_data_from_gemini(raw_text)
    html = PortfolioGenerator.generate_html(data)
    
    # 3. Publish
    publisher = GitHubPublisher()
    try:
        # Use name as base for slug
        base_slug = data.get("personalInfo", {}).get("name", "portfolio").replace(" ", "-")
        live_url = publisher.publish(base_slug, html)
        return {"success": True, "url": live_url, "message": "Published to GitHub Pages"}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"GitHub Publication Failed: {str(e)}")
