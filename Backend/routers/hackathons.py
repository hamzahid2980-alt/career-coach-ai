import os
import smtplib
from datetime import datetime, timezone
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart
from typing import List, Dict, Any, Optional
from fastapi import APIRouter, HTTPException, Depends, Query
from pydantic import BaseModel, HttpUrl
from core.db_core import DatabaseManager
from dependencies import get_db_manager, get_current_user
from fastapi.responses import HTMLResponse

router = APIRouter()

ADMIN_EMAIL = os.getenv("ADMIN_EMAIL", "zahidhamdule12@gmail.com")
SMTP_EMAIL = os.getenv("SMTP_EMAIL", "")
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")
ADMIN_SECRET = os.getenv("ADMIN_SECRET", "aicareercoach2026")
BACKEND_URL = os.getenv("BACKEND_URL", "https://ai-career-coach-1.onrender.com")

class HackathonSubmission(BaseModel):
    title: str
    description: str
    organizer: str
    website: HttpUrl
    logo_url: Optional[str] = None
    start_date: str
    end_date: str
    skills_required: List[str]
    listing_tier: str  # "standard" (199) or "featured" (499)
    utr: str           # Transaction ID for manual listing verification

def _send_email(to: str, subject: str, html_body: str):
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[Hackathons] EMAIL NOT CONFIGURED — would have sent to {to}: {subject}")
        return
    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"] = f"AI Career Coach <{SMTP_EMAIL}>"
    msg["To"] = to
    msg.attach(MIMEText(html_body, "html"))
    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to, msg.as_string())
    except Exception as e:
        print(f"[Hackathons] Direct email alerts failed: {e}")

@router.post("/submit")
async def submit_hackathon(
    req: HackathonSubmission,
    user: dict = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_manager)
):
    """
    Submits a hackathon request for listing approval.
    """
    uid = user['uid']
    try:
        amount = 199 if req.listing_tier == 'standard' else 499
        hackathon_data = {
            "title": req.title,
            "description": req.description,
            "organizer": req.organizer,
            "website": str(req.website),
            "logo_url": req.logo_url,
            "start_date": req.start_date,
            "end_date": req.end_date,
            "skills_required": [s.strip().lower() for s in req.skills_required],
            "listing_tier": req.listing_tier,
            "utr": req.utr.strip(),
            "submitted_by": uid,
            "submitted_by_email": user.get('email', 'Unknown'),
            "status": "pending_approval",
            "amount": amount,
            "submitted_at": datetime.now(timezone.utc).isoformat()
        }

        # 1. Save submission to Firestore
        db.db.collection('hackathons').document(req.utr.strip()).set(hackathon_data)

        # 2. Email Admin for manual payment verification
        admin_subject = f"🔔 New Hackathon Listing Request: {req.title}"
        approve_url = f"{BACKEND_URL}/api/hackathons/admin/approve/{req.utr}?secret={ADMIN_SECRET}"
        reject_url = f"{BACKEND_URL}/api/hackathons/admin/reject/{req.utr}?secret={ADMIN_SECRET}"
        
        admin_body = f"""
        <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;border:1px solid rgba(138, 73, 255, 0.2);">
          <div style="background:linear-gradient(90deg,#8A49FF,#FF4DB8);padding:1.5rem;color:white;">
             <h2 style="margin:0;">🚀 New Hackathon Listing Request</h2>
          </div>
          <div style="padding:1.5rem;line-height:1.6;">
             <p><strong>Title:</strong> {req.title}</p>
             <p><strong>Organizer:</strong> {req.organizer}</p>
             <p><strong>Website:</strong> <a href="{req.website}" style="color:#8A49FF;">{req.website}</a></p>
             <p><strong>Tier:</strong> {req.listing_tier.upper()} (₹{amount})</p>
             <p><strong>UTR Code:</strong> <code style="background:rgba(255,255,255,0.06);padding:2px 6px;border-radius:4px;">{req.utr}</code></p>
             <p><strong>Start Date:</strong> {req.start_date}</p>
             <hr style="border:0;border-top:1px solid rgba(138,73,255,0.15);margin:1.5rem 0;" />
             <div style="display:flex;gap:10px;">
                <a href="{approve_url}" style="background:#50daa0;color:#0a090f;padding:10px 20px;border-radius:8px;text-decoration:none;font-weight:bold;">Approve Listing</a>
                <a href="{reject_url}" style="background:transparent;border:1px solid #FF4DB8;color:#FF4DB8;padding:10px 20px;border-radius:8px;text-decoration:none;">Reject</a>
             </div>
          </div>
        </div>
        """
        _send_email(ADMIN_EMAIL, admin_subject, admin_body)
        return {"status": "success", "message": "Hackathon submitted for manual verification."}
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Failed to submit: {str(e)}")

@router.get("/list")
async def list_hackathons(db: DatabaseManager = Depends(get_db_manager)):
    """
    Returns only verified approved hackathons, sorted with featured ones first.
    """
    try:
        hackathons_ref = db.db.collection('hackathons')
        # Fetch active/approved items
        query = hackathons_ref.where('status', '==', 'approved').stream()
        results = [doc.to_dict() for doc in query]
        
        # Sort so 'featured' items appear first
        results.sort(key=lambda x: 1 if x.get('listing_tier') == 'featured' else 0, reverse=True)
        return results
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/approve/{utr}")
async def approve_hackathon(utr: str, secret: str, db: DatabaseManager = Depends(get_db_manager)):
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    
    try:
        doc_ref = db.db.collection('hackathons').document(utr)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        
        h_data = doc.to_dict()
        doc_ref.update({"status": "approved"})

        # Send alert notification emails to Premium subscribers matching the skills
        skills_needed = set(h_data.get('skills_required', []))
        
        # Query premium users
        users = db.db.collection('users').where('subscription_tier', '==', 'premium').stream()
        for u in users:
            u_data = u.to_dict()
            u_email = u_data.get('email')
            if not u_email:
                continue
            
            # Fetch user skills
            user_skills = set([s.lower() for s in u_data.get('categorized_skills', {}).get('technical', [])])
            if user_skills.intersection(skills_needed):
                alert_subject = f"🎯 Skill Match Alert: Hackathon '{h_data['title']}' needs your skills!"
                alert_body = f"""
                <div style="font-family:sans-serif;max-width:560px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;border:1px solid rgba(138, 73, 255, 0.25);">
                  <div style="background:linear-gradient(90deg,#8A49FF,#FF4DB8);padding:1.5rem;color:white;">
                     <h3 style="margin:0;"><i class="fas fa-crown"></i> Personalized Elite Alert</h3>
                  </div>
                  <div style="padding:1.5rem;line-height:1.6;">
                     <h3>Hi {u_data.get('name', 'Developer')},</h3>
                     <p>A new hackathon matching your skills has just been listed on AI Career Coach!</p>
                     <div style="background:rgba(255,255,255,0.03);padding:1rem;border-radius:10px;margin:1.5rem 0;">
                        <h4 style="margin:0;color:#8A49FF;">{h_data['title']}</h4>
                        <p style="font-size:0.88rem;color:#8E8C99;margin:5px 0;">Organized by: {h_data['organizer']}</p>
                        <p>{h_data['description']}</p>
                        <p><strong>Required skills matched:</strong> {', '.join(user_skills.intersection(skills_needed))}</p>
                     </div>
                     <a href="{h_data['website']}" style="display:inline-block;background:#8A49FF;color:white;padding:12px 24px;border-radius:8px;text-decoration:none;font-weight:bold;">Register Now</a>
                  </div>
                </div>
                """
                _send_email(u_email, alert_subject, alert_body)

        # Notify submitter
        submitter_email = h_data.get('submitted_by_email')
        if submitter_email:
            _send_email(
                submitter_email,
                "🎉 Hackathon Approved & Listed!",
                f"<p>Congratulations! Your hackathon <strong>{h_data['title']}</strong> is now live on our platform.</p>"
            )

        return HTMLResponse(
            "<html><body style='font-family:sans-serif;background:#0A090F;color:#EAEBF0;padding:3rem;text-align:center;'>"
            "<h2 style='color:#50daa0;'>✅ Hackathon Approved Successfully!</h2>"
            "<p>Email alerts have been dispatched to matching Elite subscribers.</p>"
            "</body></html>"
        )
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.get("/admin/reject/{utr}")
async def reject_hackathon(utr: str, secret: str, db: DatabaseManager = Depends(get_db_manager)):
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=401, detail="Unauthorized")
    try:
        doc_ref = db.db.collection('hackathons').document(utr)
        doc = doc_ref.get()
        if not doc.exists:
            raise HTTPException(status_code=404, detail="Submission not found")
        h_data = doc.to_dict()
        doc_ref.delete()

        submitter_email = h_data.get('submitted_by_email')
        if submitter_email:
            _send_email(
                submitter_email,
                "⚠️ Hackathon Submission Declined",
                f"<p>We were unable to verify the transaction details (UTR: {utr}) for your hackathon listing request <strong>{h_data['title']}</strong>. The request has been declined.</p>"
            )
        return HTMLResponse("<html><body style='font-family:sans-serif;background:#0A090F;color:#EAEBF0;padding:3rem;text-align:center;'><h2>❌ Submission Rejected & Submitter Notified</h2></body></html>")
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))
