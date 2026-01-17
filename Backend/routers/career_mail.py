from fastapi import APIRouter, Depends, HTTPException, Request
from fastapi.responses import RedirectResponse, JSONResponse
from dependencies import get_db_manager, get_current_user
from services.google_suite import GoogleSuiteService
from core.ai_core import extract_event_details
import json
import datetime
import asyncio

router = APIRouter()

@router.get("/auth-url")
async def get_google_auth_url(redirect_uri: str, user=Depends(get_current_user)):
    """
    Generates the Google OAuth authorization URL.
    """
    try:
        flow = GoogleSuiteService.get_auth_flow(redirect_uri)
        # Use user's email as login_hint to streamline the auth flow
        authorization_url, state = flow.authorization_url(
            access_type='offline',
            include_granted_scopes='true',
            prompt='consent',
            login_hint=user.get('email') 
        )
        return {"auth_url": authorization_url, "state": state}
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

@router.post("/oauth-callback")
async def oauth_callback(code: str, redirect_uri: str, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Exchanges the auth code for tokens and saves them to the user's profile.
    """
    try:
        print(f"DEBUG: Processing OAuth callback. Code: {code[:10]}..., Redirect URI: {redirect_uri}")
        
        # Ensure env var is set here too just in case
        import os
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
        
        flow = GoogleSuiteService.get_auth_flow(redirect_uri)
        print("DEBUG: Flow created successfully.")
        
        flow.fetch_token(code=code)
        print("DEBUG: Token fetched successfully.")
        
        creds = flow.credentials
        creds_json = creds.to_json()
        
        # Store in Firestore under the user's document
        # We store it as a string or map. String is safer for simple storage/retrieval via JSON.
        user_ref = db.db.collection('users').document(user['uid'])
        user_ref.update({
            'google_oauth_creds': creds_json,
            'google_auth_timestamp': datetime.datetime.now(datetime.timezone.utc)
        })
        print("DEBUG: Credentials saved to Firestore.")
        
        return {"status": "success", "message": "Google account connected successfully."}
    except Exception as e:
        print(f"CRITICAL OAUTH ERROR: {e}")
        import traceback
        traceback.print_exc()
        # Return generic error to client but log detailed one
        raise HTTPException(status_code=500, detail=f"Failed to connect Google account: {str(e)}")



@router.post("/interview-feedback")
async def submit_interview_feedback(
    feedback_text: str = Depends(lambda x: x),  # Placeholder, should be Body
    user=Depends(get_current_user), db=Depends(get_db_manager)
):
    # NOTE: In real usage, feedback_text should probably come from a Pydantic model
    pass 
# Re-implementing correctly below with Pydantic model

class FeedbackRequest(json.JSONDecoder): # Just using a dummy class for now, better to define Pydantic model at top
    pass

from pydantic import BaseModel
class FeedbackModel(BaseModel):
    feedback_text: str

@router.post("/process-feedback")
async def process_interview_feedback(request: FeedbackModel, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Analyzes new interview feedback, saves it to history, and updates cumulative stats.
    """
    user_id = user['uid']
    user_ref = db.db.collection('users').document(user_id)
    history_ref = user_ref.collection('career_interview_history')
    
    # 1. Fetch current Aggregate Context (to help AI)
    doc = user_ref.get()
    current_analysis = {}
    if doc.exists:
        current_analysis = doc.to_dict().get('career_mail_analysis', {})
    
    # 2. AI Analysis
    from core.ai_core import analyze_interview_feedback
    new_analysis = analyze_interview_feedback(current_analysis, request.feedback_text)
    
    if not new_analysis:
        raise HTTPException(status_code=500, detail="AI Analysis failed")
    
    # 3. Create History Entry
    history_entry = {
        "timestamp": datetime.datetime.now(datetime.timezone.utc),
        "feedback_text": request.feedback_text,
        "analysis": new_analysis, # Contains specific skills, sentiment, etc.
        "topics": new_analysis.get('latest_interview_topics', []),
        "skill_scores": new_analysis.get('skill_scores', {})
    }
    
    # Save to Sub-collection
    history_ref.add(history_entry)
    
    # 4. Re-Aggregate Cumulative Profile
    # Fetch all history to rebuild aggregates (Robust way)
    # Note: For massive scale, we'd do incremental. For personal use, fetching 50 docs is fine.
    all_history = history_ref.stream()
    
    agg_weaknesses = set()
    agg_strengths = set()
    agg_topics = set()
    agg_improvements = set()
    
    for h_doc in all_history:
        h_data = h_doc.to_dict()
        anl = h_data.get('analysis', {})
        
        # Aggregate lists
        agg_weaknesses.update(anl.get('weaknesses', []))
        agg_strengths.update(anl.get('strengths', []))
        agg_topics.update(anl.get('recurring_topics', []))
        agg_improvements.update(anl.get('improvement_areas', []))
        
    updated_aggregate = {
        'career_mail_analysis': {
            'weaknesses': list(agg_weaknesses),
            'strengths': list(agg_strengths),
            'recurring_topics': list(agg_topics),
            'improvement_areas': list(agg_improvements),
            'last_updated': datetime.datetime.now(datetime.timezone.utc),
            'latest_entry': new_analysis,
            'cumulative_advice': new_analysis.get('cumulative_advice', "Keep practicing to generate more insights.")
        }
    }
    
    user_ref.update(updated_aggregate)
    
    return {
        "status": "success", 
        "analysis": new_analysis,
        "aggregate": updated_aggregate['career_mail_analysis']
    }

@router.get("/interview-history")
async def get_interview_history(user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Fetches the full history of interview feedback entries.
    """
    user_id = user['uid']
    history_ref = db.db.collection('users').document(user_id).collection('career_interview_history')
    
    # Sort by timestamp descending
    docs = history_ref.order_by("timestamp", direction=db.db.DESCENDING if hasattr(db.db, 'DESCENDING') else 'DESCENDING').stream()
    
    history = []
    for doc in docs:
        data = doc.to_dict()
        data['id'] = doc.id
        # Convert timestamp to ISO string for JSON
        if isinstance(data.get('timestamp'), datetime.datetime):
            data['timestamp'] = data['timestamp'].isoformat()
        history.append(data)
        
    return history

@router.delete("/interview-history/{entry_id}")
async def delete_interview_entry(entry_id: str, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Deletes a specific interview entry and re-calculates the cumulative profile.
    """
    user_id = user['uid']
    user_ref = db.db.collection('users').document(user_id)
    history_ref = user_ref.collection('career_interview_history')
    
    # 1. Delete Document
    history_ref.document(entry_id).delete()
    
    # 2. Re-Aggregate (Same logic as process)
    all_history = history_ref.stream()
    
    agg_weaknesses = set()
    agg_strengths = set()
    agg_topics = set()
    agg_improvements = set()
    
    count = 0
    for h_doc in all_history:
        count += 1
        h_data = h_doc.to_dict()
        anl = h_data.get('analysis', {})
        agg_weaknesses.update(anl.get('weaknesses', []))
        agg_strengths.update(anl.get('strengths', []))
        agg_topics.update(anl.get('recurring_topics', []))
        agg_improvements.update(anl.get('improvement_areas', []))
    
    # Update User Profile
    if count == 0:
         # Reset if no history
         updated_aggregate = {'career_mail_analysis': {}}
    else:
        updated_aggregate = {
            'career_mail_analysis': {
                'weaknesses': list(agg_weaknesses),
                'strengths': list(agg_strengths),
                'recurring_topics': list(agg_topics),
                'improvement_areas': list(agg_improvements),
                'last_updated': datetime.datetime.now(datetime.timezone.utc)
            }
        }
    
    user_ref.update(updated_aggregate)
    
    return {"status": "success", "message": "Entry deleted and stats updated.", "new_aggregate": updated_aggregate['career_mail_analysis']}

@router.get("/analysis")
async def get_career_analysis(user=Depends(get_current_user), db=Depends(get_db_manager)):
    user_id = user['uid']
    doc = db.db.collection('users').document(user_id).get()
    if not doc.exists: raise HTTPException(status_code=404)
    return doc.to_dict().get('career_mail_analysis', {})

class DraftRequest(BaseModel):
    job_description: str
    email_type: str = "application"
    user_name: str = None  # Optional override from frontend

class CreateDraftRequest(BaseModel):
    recipient: str = ""
    subject: str
    body: str

@router.post("/draft-email")
async def draft_career_email(request: DraftRequest, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Generates a draft email content using AI (Groq). Auto-fetches user profile.
    """
    user_id = user['uid']
    doc = db.db.collection('users').document(user_id).get()
    user_data = doc.to_dict()
    
    # 1. Fetch Profile Summary Automatically
    resume_summary = "General Professional"
    if user_data.get('resume', {}).get('summary'):
        resume_summary = user_data['resume']['summary']
    
    # 2. Add Skills/Experience to context if available
    skills = ", ".join(user_data.get('resume', {}).get('skills', []))
    if skills:
        resume_summary += f". Key Skills: {skills}"

    # Determine name: Request > Profile > Default
    candidate_name = request.user_name or user_data.get('display_name') or user_data.get('name')

    from core.ai_core import draft_application_email
    draft = draft_application_email(request.job_description, resume_summary, request.email_type, user_name=candidate_name)
    
    if not draft:
        raise HTTPException(status_code=500, detail="Draft generation failed")

    # Parse Subject and Body
    lines = draft.strip().split('\n')
    subject = "No Subject"
    body_start_index = 0
    
    if lines and lines[0].lower().startswith("subject:"):
        subject = lines[0][8:].strip()
        body_start_index = 1
    
    # Reassemble body, skipping empty leading lines if any
    body = "\n".join(lines[body_start_index:]).strip()
    
    return {"subject": subject, "body": body}

@router.post("/create-email-draft")
async def create_gmail_draft(request: CreateDraftRequest, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Actually creates the draft in Gmail.
    """
    user_id = user['uid']
    user_doc = db.db.collection('users').document(user_id).get()
    creds_json = user_doc.to_dict().get('google_oauth_creds')
    
    if not creds_json:
        raise HTTPException(status_code=401, detail="Google account not connected.")
        
    creds_dict = json.loads(creds_json)
    google_service = GoogleSuiteService(creds_dict)
    
    if not google_service.is_authenticated():
         # Attempt refresh or fail
         if not google_service.refresh_credentials():
             raise HTTPException(status_code=401, detail="Google auth expired.")
    
    # User email extraction from ID token would be better, but for draft 'me' works for userId, 
    # but 'from' header needs address. We can try to get it from profile or Google API.
    # For now, let's fetch profile info from Google.
    try:
        profile = google_service.service.users().getProfile(userId='me').execute()
        user_email = profile['emailAddress']
    except:
        user_email = user.get('email', 'me') # Fallback
        
    draft = google_service.create_draft(user_email, request.recipient, request.subject, request.body)
    
    if not draft:
         raise HTTPException(status_code=500, detail="Failed to create draft in Gmail.")
         
    # Return link to open draft
    # https://mail.google.com/mail/u/0/#drafts/{id}
    return {
        "status": "success", 
        "message": "Draft created in Gmail.", 
        "draft_id": draft['id'],
        "email_used": user_email,
        "open_link": f"https://mail.google.com/mail/u/?authuser={user_email}#drafts/{draft['id']}" if user_email and '@' in user_email else f"https://mail.google.com/mail/u/0/#drafts/{draft['id']}"
    }

@router.get("/get-all-tasks")
async def get_all_tasks(user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Fetches processed tasks from Firestore (persisted during sync).
    """
    user_id = user['uid']
    tasks_ref = db.db.collection('users').document(user_id).collection('career_tasks_log')
    docs = tasks_ref.stream()
    return [doc.to_dict() for doc in docs]

# --- SYNC STATE MANAGEMENT ---
# In-memory store for active sync jobs. 
# Structure: { user_id: { "status": "running"|"completed"|"failed", "events": [], "tasks": [], "message": "" } }
SYNC_STATE = {}

from fastapi import BackgroundTasks

async def _process_single_email(email, google_service, db, user_id, events_ref, tasks_log_ref, batch):
    """Helper to process a single email asynchronously."""
    # Run CPU/Sync-bound AI extraction in a separate thread to not block the event loop
    loop = asyncio.get_event_loop()
    event_details = await loop.run_in_executor(None, extract_event_details, email['subject'], email['body'], email.get('date'))
    
    results = {'events': [], 'tasks': []}
    
    if event_details and event_details.get('is_event'):
        event_details['source_email_id'] = email['id']
        event_details['source_subject'] = email['subject']
        event_details['id'] = email['id'] # Use email ID as Event ID for idempotency
        
        # Create Calendar Event (Sync Call)
        cal_link = await loop.run_in_executor(None, google_service.create_calendar_event, event_details)
        
        if cal_link:
            event_details['calendar_link'] = cal_link
            results['events'].append(event_details)
        
        # Create Tasks
        if event_details.get('preparation_tasks'):
            for task_txt in event_details['preparation_tasks']:
                # Create Task (Sync Call)
                tid = await loop.run_in_executor(None, google_service.create_task, f"Prep: {task_txt}", f"For event: {event_details.get('event_title')} (Source: {email['subject']})")
                
                if tid:
                    task_obj = {
                        "id": tid, 
                        "title": task_txt, 
                        "source_event": event_details.get('event_title'),
                        "source_email": email['subject'],
                        "status": "needsAction"
                    }
                    results['tasks'].append(task_obj)
                    
    return results

async def _background_sync_process(user_id: str, creds_json: str, db):
    """
    The actual heavy-lifting sync function running in background.
    Optimized with "Redis-like" caching (skipping processed IDs) and Parallel Processing.
    """
    global SYNC_STATE
    SYNC_STATE[user_id] = { "status": "running", "events": [], "tasks": [], "message": "Starting sync..." }
    
    try:
        creds_dict = json.loads(creds_json)
        google_service = GoogleSuiteService(creds_dict)
        
        # Check Auth
        if not google_service.is_authenticated():
             if google_service.refresh_credentials():
                 # Update DB with new tokens - simplified here
                 pass
             else:
                 SYNC_STATE[user_id]['status'] = 'failed'
                 SYNC_STATE[user_id]['message'] = 'Auth expired'
                 return

        # 1. Fetch Processed IDs ("Redis-like" check)
        events_ref = db.db.collection('users').document(user_id).collection('career_events')
        tasks_log_ref = db.db.collection('users').document(user_id).collection('career_tasks_log')
        
        # Optimized: Select only IDs
        # Note: If filtering strictly by event ID derived from email ID.
        try:
             existing_docs = events_ref.select([]).stream() 
             processed_ids = {doc.id for doc in existing_docs}
        except:
             # Fallback if select([]) not supported in this client version
             existing_docs = events_ref.stream()
             processed_ids = {doc.id for doc in existing_docs}
        
        # 2. Fetch Emails
        emails = google_service.fetch_career_emails(max_results=30) 
        
        # 3. Filter New Emails
        new_emails = [e for e in emails if e['id'] not in processed_ids]
        
        if not new_emails:
            SYNC_STATE[user_id]['status'] = 'completed'
            SYNC_STATE[user_id]['message'] = 'Sync complete. No new emails found.'
            return

        SYNC_STATE[user_id]['message'] = f"Found {len(new_emails)} new emails. Analyzing..."
        
        # 4. Parallel Processing
        # Process in chunks of 5 to avoid overwhelming quotas
        chunk_size = 5
        all_results = []
        
        for i in range(0, len(new_emails), chunk_size):
            chunk = new_emails[i:i + chunk_size]
            SYNC_STATE[user_id]['message'] = f"Analyzing batch {i//chunk_size + 1}..."
            tasks = [_process_single_email(email, google_service, db, user_id, events_ref, tasks_log_ref, None) for email in chunk]
            chunk_results = await asyncio.gather(*tasks)
            all_results.extend(chunk_results)

        # 5. Batch Write to DB
        batch = db.db.batch()
        batch_count = 0 
        
        for res in all_results:
            for evt in res['events']:
                doc_ref = events_ref.document(evt['id'])
                batch.set(doc_ref, evt)
                SYNC_STATE[user_id]['events'].append(evt)
                batch_count += 1
                
            for tsk in res['tasks']:
                t_ref = tasks_log_ref.document(tsk['id'])
                batch.set(t_ref, tsk)
                SYNC_STATE[user_id]['tasks'].append(tsk)
                batch_count += 1
        
        if batch_count > 0:
            try:
                batch.commit()
            except Exception as batch_error:
                print(f"Batch commit error: {batch_error}")

        SYNC_STATE[user_id]['status'] = 'completed'
        SYNC_STATE[user_id]['message'] = 'Sync complete.'
        
    except Exception as e:
        print(f"Background Sync Error: {e}")
        import traceback
        traceback.print_exc()
        SYNC_STATE[user_id]['status'] = 'failed'
        SYNC_STATE[user_id]['message'] = str(e)


@router.post("/sync")
async def sync_career_mail(
    background_tasks: BackgroundTasks,
    user=Depends(get_current_user), 
    db=Depends(get_db_manager)
):
    """
    Triggers background sync. Returns immediately.
    """
    user_id = user['uid']
    user_doc = db.db.collection('users').document(user_id).get()
    
    if not user_doc.exists: raise HTTPException(status_code=404)
    creds_json = user_doc.to_dict().get('google_oauth_creds')
    
    if not creds_json:
        raise HTTPException(status_code=401, detail="Google account not connected.")

    # Start Background Task
    background_tasks.add_task(_background_sync_process, user_id, creds_json, db)
    
    return {"status": "started", "message": "Sync started in background."}

@router.get("/sync/status")
async def get_sync_status(user=Depends(get_current_user)):
    user_id = user['uid']
    state = SYNC_STATE.get(user_id)
    if not state:
        return {"status": "idle", "events": [], "tasks": []}
    return state

@router.delete("/events/{event_id}")
async def delete_career_event(event_id: str, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Deletes event from Firestore. (Ideally also from Google Calendar if we stored the eventID properly)
    """
    user_id = user['uid']
    # Delete from Firestore
    db.db.collection('users').document(user_id).collection('career_events').document(event_id).delete()
    # Note: We aren't deleting from Google Calendar here because we didn't store the GCal Event ID, only the link.
    # Future improvement: Store GCal ID.
    return {"status": "success", "message": "Event removed from dashboard."}

@router.delete("/tasks/{task_id}")
async def delete_career_task(task_id: str, user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Deletes task from Firestore.
    """
    user_id = user['uid']
    db.db.collection('users').document(user_id).collection('career_tasks_log').document(task_id).delete()
    return {"status": "success", "message": "Task removed."}


@router.get("/events")
async def get_career_events(user=Depends(get_current_user), db=Depends(get_db_manager)):
    """
    Fetches the synced career events from Firestore for the dashboard.
    """
    user_id = user['uid']
    events_ref = db.db.collection('users').document(user_id).collection('career_events')
    
    # Get all events, maybe limit to recent or future?
    # For now, get all.
    docs = events_ref.stream()
    
    events = []
    for doc in docs:
        d = doc.to_dict()
        # Ensure ID is present for UI keying
        if 'id' not in d: d['id'] = doc.id
        events.append(d)
        
    # Sort locally by start_time if possible
    try:
        events.sort(key=lambda x: x.get('start_time', '9999-12-31'))
    except:
        pass
        
    return events
