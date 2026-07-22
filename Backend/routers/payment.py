"""
Payment Request Router — Manual UPI Verification Flow
------------------------------------------------------
POST /api/payment/request   → User submits UTR after paying
GET  /api/payment/admin/approve/{utr}?secret=KEY  → Admin approves
GET  /api/payment/admin/reject/{utr}?secret=KEY   → Admin rejects
GET  /api/payment/admin/pending?secret=KEY         → List all pending
"""

import os
import smtplib
import razorpay
from datetime import datetime, timedelta
from email.mime.text import MIMEText
from email.mime.multipart import MIMEMultipart

from fastapi import APIRouter, HTTPException, Depends
from fastapi.responses import HTMLResponse
from pydantic import BaseModel, EmailStr

from core.db_core import DatabaseManager
from dependencies import get_db_manager, get_current_user

router = APIRouter()

# ── Config from environment ────────────────────────────────────────────────────
ADMIN_EMAIL   = os.getenv("ADMIN_EMAIL", "zahidhamdule12@gmail.com")
SMTP_EMAIL    = os.getenv("SMTP_EMAIL", "")          # Gmail address used for sending
SMTP_PASSWORD = os.getenv("SMTP_PASSWORD", "")       # Gmail App Password (not account password)
ADMIN_SECRET  = os.getenv("ADMIN_SECRET", "aicareercoach2026")  # Change this!
BACKEND_URL   = os.getenv("BACKEND_URL", "https://ai-career-coach-1.onrender.com")

RAZORPAY_KEY_ID     = os.getenv("RAZORPAY_KEY_ID", "rzp_test_TGX1z9hpaK4uK4")
RAZORPAY_KEY_SECRET = os.getenv("RAZORPAY_KEY_SECRET", "rggr9o3kl4SMKISl4Hhb3YQY")

# Initialize Razorpay Client
razorpay_client = razorpay.Client(auth=(RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET))

PLAN_META = {
    "pro":     {"name": "Pro (Career Accelerator)", "amount": 199},
    "premium": {"name": "Premium (Career Elite)",   "amount": 399},
}

# ── Pydantic models ────────────────────────────────────────────────────────────
class PaymentRequest(BaseModel):
    plan: str        # "pro" or "premium"
    amount: int
    utr: str         # UTR / Transaction ID entered by user
    user_email: str

class RazorpayOrderRequest(BaseModel):
    plan: str
    billing: str = "monthly"

class RazorpayVerificationRequest(BaseModel):
    razorpay_payment_id: str
    razorpay_order_id: str
    razorpay_signature: str
    plan: str
    billing: str = "monthly"


# ── Email helper ───────────────────────────────────────────────────────────────
def _send_email(to: str, subject: str, html_body: str):
    """Send an email via Gmail SMTP with App Password."""
    if not SMTP_EMAIL or not SMTP_PASSWORD:
        print(f"[Payment] EMAIL NOT CONFIGURED — would have sent to {to}: {subject}")
        return

    msg = MIMEMultipart("alternative")
    msg["Subject"] = subject
    msg["From"]    = f"AI Career Coach <{SMTP_EMAIL}>"
    msg["To"]      = to
    msg.attach(MIMEText(html_body, "html"))

    try:
        with smtplib.SMTP_SSL("smtp.gmail.com", 465) as server:
            server.login(SMTP_EMAIL, SMTP_PASSWORD)
            server.sendmail(SMTP_EMAIL, to, msg.as_string())
        print(f"[Payment] Email sent to {to}")
    except Exception as e:
        print(f"[Payment] Email failed: {e}")


def _admin_email_html(req: dict) -> str:
    approve_url = f"{BACKEND_URL}/api/payment/admin/approve/{req['utr']}?secret={ADMIN_SECRET}"
    reject_url  = f"{BACKEND_URL}/api/payment/admin/reject/{req['utr']}?secret={ADMIN_SECRET}"
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:560px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#8A49FF,#FF4DB8);padding:1.5rem 2rem;">
        <h2 style="margin:0;color:white;font-size:1.2rem;">🟡 New Upgrade Request</h2>
      </div>
      <div style="padding:2rem;">
        <table style="width:100%;border-collapse:collapse;margin-bottom:1.5rem;">
          <tr><td style="padding:.5rem 0;color:#8E8C99;font-size:.9rem;">User Email</td>
              <td style="padding:.5rem 0;font-weight:600;">{req['user_email']}</td></tr>
          <tr><td style="padding:.5rem 0;color:#8E8C99;font-size:.9rem;">Plan</td>
              <td style="padding:.5rem 0;font-weight:600;">{req['plan_name']}</td></tr>
          <tr><td style="padding:.5rem 0;color:#8E8C99;font-size:.9rem;">Amount</td>
              <td style="padding:.5rem 0;font-weight:600;color:#8A49FF;">₹{req['amount']}</td></tr>
          <tr><td style="padding:.5rem 0;color:#8E8C99;font-size:.9rem;">UTR Number</td>
              <td style="padding:.5rem 0;font-weight:700;font-family:monospace;font-size:1rem;">{req['utr']}</td></tr>
          <tr><td style="padding:.5rem 0;color:#8E8C99;font-size:.9rem;">Submitted At</td>
              <td style="padding:.5rem 0;">{req['timestamp']}</td></tr>
        </table>

        <p style="background:rgba(138,73,255,.1);border:1px solid rgba(138,73,255,.3);border-radius:10px;padding:1rem;font-size:.88rem;color:#c5c7d3;margin-bottom:1.5rem;">
          👉 <strong>Verify:</strong> Open GPay / PhonePe → Transaction History → search UTR <strong>{req['utr']}</strong> → confirm it shows ₹{req['amount']} credit.
        </p>

        <div style="display:flex;gap:1rem;flex-wrap:wrap;">
          <a href="{approve_url}" style="display:inline-block;background:#50daa0;color:#0A090F;font-weight:700;padding:.8rem 1.8rem;border-radius:10px;text-decoration:none;font-size:.95rem;">
            ✅ APPROVE ACCESS
          </a>
          <a href="{reject_url}" style="display:inline-block;background:rgba(255,77,184,.15);color:#FF4DB8;font-weight:700;padding:.8rem 1.8rem;border-radius:10px;text-decoration:none;font-size:.95rem;border:1px solid rgba(255,77,184,.3);">
            ❌ REJECT
          </a>
        </div>
      </div>
    </div>
    """


def _user_confirm_html(email: str, plan_name: str, amount: int, utr: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#8A49FF,#FF4DB8);padding:1.5rem 2rem;">
        <h2 style="margin:0;color:white;font-size:1.2rem;">Payment Request Received 🎉</h2>
      </div>
      <div style="padding:2rem;">
        <p style="color:#8E8C99;margin-bottom:1.5rem;">Hi there! We've received your payment notification for <strong style="color:#EAEBF0">{plan_name}</strong>.</p>
        <div style="background:rgba(138,73,255,.08);border:1px solid rgba(138,73,255,.2);border-radius:12px;padding:1.25rem;margin-bottom:1.5rem;">
          <p style="margin:.3rem 0;font-size:.9rem;"><span style="color:#8E8C99;">Plan:</span> <strong>{plan_name}</strong></p>
          <p style="margin:.3rem 0;font-size:.9rem;"><span style="color:#8E8C99;">Amount:</span> <strong style="color:#8A49FF;">₹{amount}</strong></p>
          <p style="margin:.3rem 0;font-size:.9rem;"><span style="color:#8E8C99;">UTR:</span> <strong style="font-family:monospace;">{utr}</strong></p>
        </div>
        <p style="font-size:.9rem;line-height:1.6;color:#8E8C99;">
          ⏱ We'll verify your payment and activate your plan within <strong style="color:#EAEBF0">2–4 hours</strong>. 
          You'll receive another email once access is granted.<br><br>
          If you don't hear back within 4 hours, reply to this email or contact us on WhatsApp.
        </p>
      </div>
    </div>
    """


def _user_approved_html(plan_name: str) -> str:
    return f"""
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;">
      <div style="background:linear-gradient(90deg,#50daa0,#20c997);padding:1.5rem 2rem;">
        <h2 style="margin:0;color:white;font-size:1.2rem;">✅ Your Plan is Now Active!</h2>
      </div>
      <div style="padding:2rem;">
        <p style="margin-bottom:1rem;">Your <strong>{plan_name}</strong> has been activated successfully. Log in to start using all premium features!</p>
        <a href="https://aicareer-coach.github.io/AI-Career-coach/home.html"
           style="display:inline-block;background:linear-gradient(90deg,#8A49FF,#702cf8);color:white;font-weight:700;padding:.9rem 2rem;border-radius:12px;text-decoration:none;font-size:1rem;">
          Go to Dashboard →
        </a>
        <p style="margin-top:1.5rem;font-size:.82rem;color:#8E8C99;">Your subscription is valid for 30 days from today. Enjoy!</p>
      </div>
    </div>
    """


def _user_rejected_html() -> str:
    return """
    <div style="font-family:Inter,sans-serif;max-width:520px;margin:0 auto;background:#13111C;color:#EAEBF0;border-radius:16px;overflow:hidden;">
      <div style="background:#FF4DB8;padding:1.5rem 2rem;">
        <h2 style="margin:0;color:white;font-size:1.2rem;">Payment Verification Failed</h2>
      </div>
      <div style="padding:2rem;">
        <p style="margin-bottom:1rem;color:#8E8C99;">We could not verify your payment with the UTR number provided. This could happen if:</p>
        <ul style="color:#8E8C99;font-size:.9rem;margin-left:1.2rem;margin-bottom:1.5rem;">
          <li>The UTR number was entered incorrectly</li>
          <li>The payment amount did not match</li>
          <li>The payment was not completed</li>
        </ul>
        <p style="font-size:.9rem;color:#8E8C99;">Please reply to this email with the correct UTR number or a screenshot of your payment, and we'll sort it out immediately.</p>
      </div>
    </div>
    """


# ── Endpoints ──────────────────────────────────────────────────────────────────

@router.post("/request")
async def submit_payment_request(
    req: PaymentRequest,
    user: dict = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_manager)
):
    """User calls this after paying. Saves request + notifies admin + confirms to user."""

    # Support Hackathon Listing plans
    PLAN_META_ALL = {**PLAN_META, 
        "hackathon_standard": {"name": "Hackathon Standard Listing", "amount": 199},
        "hackathon_featured": {"name": "Hackathon Featured Listing", "amount": 499}
    }

    plan_info = PLAN_META_ALL.get(req.plan)
    if not plan_info:
        raise HTTPException(status_code=400, detail="Invalid plan chosen.")

    if req.amount != plan_info["amount"]:
        # Allow validation bypass for annual pricing calculations done on client
        pass

    utr = req.utr.strip()
    if len(utr) < 6:
        raise HTTPException(status_code=400, detail="Invalid UTR number.")

    # Check for duplicate UTR
    existing = db.db.collection("pending_upgrades").document(utr).get()
    if existing.exists:
        raise HTTPException(status_code=409, detail="This UTR has already been submitted.")

    timestamp = datetime.utcnow().strftime("%d %b %Y, %H:%M UTC")

    # Save to Firebase
    db.db.collection("pending_upgrades").document(utr).set({
        "user_email": req.user_email,
        "user_uid":   user["uid"],
        "plan":       req.plan,
        "plan_name":  plan_info["name"],
        "amount":     req.amount,
        "utr":        utr,
        "timestamp":  timestamp,
        "status":     "pending"
    })

    # Email admin
    admin_data = {
        "user_email": req.user_email,
        "plan_name":  plan_info["name"],
        "amount":     req.amount,
        "utr":        utr,
        "timestamp":  timestamp
    }
    _send_email(
        to=ADMIN_EMAIL,
        subject=f"🟡 Upgrade Request — {plan_info['name']} — {req.user_email}",
        html_body=_admin_email_html(admin_data)
    )

    # Confirm to user
    _send_email(
        to=req.user_email,
        subject="Payment Received — AI Career Coach",
        html_body=_user_confirm_html(req.user_email, plan_info["name"], req.amount, utr)
    )

    return {"status": "ok", "message": "Payment request submitted. You'll get a confirmation email within 2-4 hours."}


@router.get("/admin/approve/{utr}", response_class=HTMLResponse)
async def admin_approve(utr: str, secret: str = ""):
    """Admin clicks this link from email to grant access."""
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")

    doc_ref = None
    try:
        from core.db_core import DatabaseManager
        _db = DatabaseManager()
        doc_ref = _db.db.collection("pending_upgrades").document(utr)
        doc = doc_ref.get()
        if not doc.exists:
            return HTMLResponse("<h2>UTR not found.</h2>", status_code=404)

        data = doc.to_dict()
        if data.get("status") == "approved":
            return HTMLResponse(f"<h2>Already approved for {data.get('user_email')}.</h2>")

        # Update user subscription in Firebase
        user_uid = data.get("user_uid")
        plan     = data.get("plan")
        expires  = (datetime.utcnow() + timedelta(days=30)).isoformat()

        user_update = {
            "subscription_expires": expires,
            "upgraded_at": datetime.utcnow().isoformat()
        }

        # If it is a hackathon host plan, enable organizer privileges
        if plan.startswith("hackathon"):
            user_update["can_host_hackathons"] = True
            user_update["hackathon_host_tier"] = plan
        else:
            user_update["subscription_tier"] = plan

        _db.db.collection("users").document(user_uid).set(user_update, merge=True)

        # Mark as approved
        doc_ref.update({"status": "approved", "approved_at": datetime.utcnow().isoformat()})

        # Email user
        _send_email(
            to=data["user_email"],
            subject="✅ Your AI Career Coach Plan is Now Active!",
            html_body=_user_approved_html(data["plan_name"])
        )

        return HTMLResponse(f"""
        <html><body style="font-family:sans-serif;background:#0A090F;color:#EAEBF0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#13111C;padding:3rem;border-radius:16px;border:1px solid rgba(80,218,160,.3);">
            <div style="font-size:3rem;margin-bottom:1rem;">✅</div>
            <h2 style="color:#50daa0;margin-bottom:.5rem;">Approved!</h2>
            <p style="color:#8E8C99;">User: <strong style="color:#EAEBF0">{data['user_email']}</strong><br>
            Plan: <strong style="color:#8A49FF">{data['plan_name']}</strong> (₹{data['amount']})<br>
            UTR: <code>{utr}</code></p>
            <p style="color:#8E8C99;margin-top:1rem;font-size:.9rem;">Confirmation email sent to user.</p>
          </div>
        </body></html>
        """)

    except Exception as e:
        return HTMLResponse(f"<h2>Error: {e}</h2>", status_code=500)


@router.get("/admin/reject/{utr}", response_class=HTMLResponse)
async def admin_reject(utr: str, secret: str = ""):
    """Admin clicks this to reject a fraudulent/invalid request."""
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")

    try:
        from core.db_core import DatabaseManager
        _db = DatabaseManager()
        doc_ref = _db.db.collection("pending_upgrades").document(utr)
        doc = doc_ref.get()
        if not doc.exists:
            return HTMLResponse("<h2>UTR not found.</h2>", status_code=404)

        data = doc.to_dict()
        doc_ref.update({"status": "rejected", "rejected_at": datetime.utcnow().isoformat()})

        _send_email(
            to=data["user_email"],
            subject="Payment Verification Issue — AI Career Coach",
            html_body=_user_rejected_html()
        )

        return HTMLResponse(f"""
        <html><body style="font-family:sans-serif;background:#0A090F;color:#EAEBF0;display:flex;align-items:center;justify-content:center;height:100vh;margin:0;">
          <div style="text-align:center;background:#13111C;padding:3rem;border-radius:16px;border:1px solid rgba(255,77,184,.3);">
            <div style="font-size:3rem;margin-bottom:1rem;">❌</div>
            <h2 style="color:#FF4DB8;margin-bottom:.5rem;">Rejected</h2>
            <p style="color:#8E8C99;">UTR <code>{utr}</code> for <strong style="color:#EAEBF0">{data.get('user_email','')}</strong> has been rejected.<br>
            Rejection email sent to user.</p>
          </div>
        </body></html>
        """)

    except Exception as e:
        return HTMLResponse(f"<h2>Error: {e}</h2>", status_code=500)


@router.get("/admin/pending", response_class=HTMLResponse)
async def admin_list_pending(secret: str = ""):
    """Simple admin dashboard — lists all pending requests."""
    if secret != ADMIN_SECRET:
        raise HTTPException(status_code=403, detail="Invalid admin secret.")

    try:
        from core.db_core import DatabaseManager
        _db = DatabaseManager()
        docs = _db.db.collection("pending_upgrades").where("status", "==", "pending").stream()
        rows = ""
        count = 0
        for doc in docs:
            d = doc.to_dict()
            count += 1
            approve = f"{BACKEND_URL}/api/payment/admin/approve/{d['utr']}?secret={ADMIN_SECRET}"
            reject  = f"{BACKEND_URL}/api/payment/admin/reject/{d['utr']}?secret={ADMIN_SECRET}"
            rows += f"""
            <tr style="border-bottom:1px solid rgba(255,255,255,.07);">
              <td style="padding:.8rem;">{d.get('user_email','')}</td>
              <td style="padding:.8rem;">{d.get('plan_name','')}</td>
              <td style="padding:.8rem;color:#8A49FF;font-weight:700;">₹{d.get('amount','')}</td>
              <td style="padding:.8rem;font-family:monospace;">{d.get('utr','')}</td>
              <td style="padding:.8rem;color:#8E8C99;font-size:.85rem;">{d.get('timestamp','')}</td>
              <td style="padding:.8rem;">
                <a href="{approve}" style="background:#50daa0;color:#0A090F;padding:.4rem .9rem;border-radius:6px;font-weight:700;font-size:.82rem;text-decoration:none;margin-right:.3rem;">✅ Approve</a>
                <a href="{reject}" style="background:rgba(255,77,184,.15);color:#FF4DB8;padding:.4rem .9rem;border-radius:6px;font-weight:700;font-size:.82rem;text-decoration:none;border:1px solid rgba(255,77,184,.3);">❌ Reject</a>
              </td>
            </tr>"""

        return HTMLResponse(f"""
        <html><head><meta charset="UTF-8"><title>Pending Upgrades</title></head>
        <body style="font-family:Inter,sans-serif;background:#0A090F;color:#EAEBF0;padding:2rem;">
          <h2 style="color:#8A49FF;margin-bottom:1.5rem;">⏳ Pending Upgrade Requests ({count})</h2>
          <div style="overflow-x:auto;">
          <table style="width:100%;border-collapse:collapse;background:#13111C;border-radius:12px;overflow:hidden;">
            <thead>
              <tr style="background:rgba(138,73,255,.15);font-size:.85rem;color:#8E8C99;">
                <th style="padding:.8rem;text-align:left;">Email</th>
                <th style="padding:.8rem;text-align:left;">Plan</th>
                <th style="padding:.8rem;text-align:left;">Amount</th>
                <th style="padding:.8rem;text-align:left;">UTR</th>
                <th style="padding:.8rem;text-align:left;">Submitted</th>
                <th style="padding:.8rem;text-align:left;">Actions</th>
              </tr>
            </thead>
            <tbody>{rows if rows else '<tr><td colspan="6" style="padding:2rem;text-align:center;color:#8E8C99;">No pending requests 🎉</td></tr>'}</tbody>
          </table>
          </div>
        </body></html>
        """)

    except Exception as e:
        return HTMLResponse(f"<h2>Error: {e}</h2>", status_code=500)


@router.post("/create-order")
async def rzp_create_order(
    req: RazorpayOrderRequest,
    user: dict = Depends(get_current_user)
):
    # Support all plans
    PLAN_META_ALL = {**PLAN_META, 
        "hackathon_standard": {"name": "Hackathon Standard Listing", "amount": 199},
        "hackathon_featured": {"name": "Hackathon Featured Listing", "amount": 499}
    }
    plan_info = PLAN_META_ALL.get(req.plan)
    if not plan_info:
        raise HTTPException(status_code=400, detail="Invalid plan chosen.")
    
    # Pro and Premium annual pricing calculations
    amount_rs = plan_info["amount"]
    if req.billing == "annual":
        if req.plan == "pro":
            amount_rs = 159 * 12
        elif req.plan == "premium":
            amount_rs = 319 * 12
    
    amount_paise = amount_rs * 100
    
    try:
        rzp_order = razorpay_client.order.create(data={
            "amount": amount_paise,
            "currency": "INR",
            "payment_capture": 1
        })
        return {
            "order_id": rzp_order["id"],
            "amount": amount_paise,
            "key_id": RAZORPAY_KEY_ID
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"Razorpay order creation failed: {str(e)}")


@router.post("/verify")
async def rzp_verify_payment(
    req: RazorpayVerificationRequest,
    user: dict = Depends(get_current_user),
    db: DatabaseManager = Depends(get_db_manager)
):
    try:
        # Verify signature
        params = {
            'razorpay_order_id': req.razorpay_order_id,
            'razorpay_payment_id': req.razorpay_payment_id,
            'razorpay_signature': req.razorpay_signature
        }
        razorpay_client.utility.verify_payment_signature(params)
    except Exception:
        raise HTTPException(status_code=400, detail="Payment signature verification failed.")
    
    # Grant subscription
    user_uid = user["uid"]
    expires = (datetime.utcnow() + timedelta(days=30)).isoformat()
    if req.billing == "annual":
        expires = (datetime.utcnow() + timedelta(days=365)).isoformat()
    
    user_update = {
        "subscription_expires": expires,
        "upgraded_at": datetime.utcnow().isoformat()
    }
    
    if req.plan.startswith("hackathon"):
        user_update["can_host_hackathons"] = True
        user_update["hackathon_host_tier"] = req.plan
    else:
        user_update["subscription_tier"] = req.plan
        
    db.db.collection("users").document(user_uid).set(user_update, merge=True)
    
    # Log verified transaction record in database
    db.db.collection("payments").document(req.razorpay_payment_id).set({
        "user_uid": user_uid,
        "user_email": user.get("email", "unknown"),
        "plan": req.plan,
        "billing": req.billing,
        "razorpay_order_id": req.razorpay_order_id,
        "razorpay_payment_id": req.razorpay_payment_id,
        "status": "success",
        "timestamp": datetime.utcnow().isoformat()
    })
    
    # Send activation email
    PLAN_META_ALL = {**PLAN_META, 
        "hackathon_standard": {"name": "Hackathon Standard Listing", "amount": 199},
        "hackathon_featured": {"name": "Hackathon Featured Listing", "amount": 499}
    }
    plan_name = PLAN_META_ALL.get(req.plan, {}).get("name", req.plan)
    _send_email(
        to=user.get("email", ""),
        subject="✅ Your AI Career Coach Plan is Now Active!",
        html_body=_user_approved_html(plan_name)
    )
    
    return {"status": "ok", "message": "Payment verified and subscription activated successfully!"}
