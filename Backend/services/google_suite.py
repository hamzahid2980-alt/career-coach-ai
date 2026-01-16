import os
import json
from google.oauth2.credentials import Credentials
from google_auth_oauthlib.flow import Flow
from google.auth.transport.requests import Request
from googleapiclient.discovery import build
import datetime
from pathlib import Path
import base64
from email.mime.text import MIMEText

# Allow OAuth over HTTP for development (Module level safety)
os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'

# Scopes required for Career Mail
SCOPES = [
    'https://www.googleapis.com/auth/gmail.readonly',
    'https://www.googleapis.com/auth/gmail.compose',
    'https://www.googleapis.com/auth/calendar',
    'https://www.googleapis.com/auth/tasks'
]

CREDENTIALS_FILE = Path(__file__).parent.parent / "client_secret.json"

class GoogleSuiteService:
    def __init__(self, user_creds_dict=None):
        # Allow OAuth over HTTP for development
        os.environ['OAUTHLIB_INSECURE_TRANSPORT'] = '1'
        # Relax scope validation (Google sometimes returns extra scopes like openid)
        os.environ['OAUTHLIB_RELAX_TOKEN_SCOPE'] = '1'
        self.creds = None
        if user_creds_dict:
            self.creds = Credentials.from_authorized_user_info(user_creds_dict, SCOPES)

    @staticmethod
    def get_auth_flow(redirect_uri):
        """Creates an OAuth flow instance."""
        if not CREDENTIALS_FILE.exists():
            raise FileNotFoundError(f"Client secrets file not found at {CREDENTIALS_FILE}")
            
        flow = Flow.from_client_secrets_file(
            str(CREDENTIALS_FILE),
            scopes=SCOPES,
            redirect_uri=redirect_uri
        )
        return flow

    def is_authenticated(self):
        return self.creds and self.creds.valid

    def refresh_credentials(self):
        if self.creds and self.creds.expired and self.creds.refresh_token:
            self.creds.refresh(Request())
            return True
        return False

    def get_gmail_service(self):
        if not self.is_authenticated(): return None
        return build('gmail', 'v1', credentials=self.creds)

    def get_calendar_service(self):
        if not self.is_authenticated(): return None
        return build('calendar', 'v3', credentials=self.creds)

    def get_tasks_service(self):
        if not self.is_authenticated(): return None
        return build('tasks', 'v1', credentials=self.creds)

    def fetch_career_emails(self, max_results=20):
        """
        Fetches emails filtered by career-related keywords.
        Keywords: Interview, Schedule, Hackathon, Offer, Tech Conference
        """
        import logging
        # Silence the discovery_cache warning
        logging.getLogger('googleapiclient.discovery_cache').setLevel(logging.ERROR)

        service = self.get_gmail_service()
        if not service:
            return []

        # Standard query
        query = "subject:(Interview OR Schedule OR Hackathon OR Offer OR Conference) -category:promotions -category:social"
        
        try:
            results = service.users().messages().list(userId='me', q=query, maxResults=max_results).execute()
            messages = results.get('messages', [])
            
            email_data = []
            for msg in messages:
                msg_detail = service.users().messages().get(userId='me', id=msg['id'], format='full').execute()
                headers = {h['name']: h['value'] for h in msg_detail['payload']['headers']}
                
                email_data.append({
                    'id': msg['id'],
                    'snippet': msg_detail.get('snippet', ''),
                    'subject': headers.get('Subject', 'No Subject'),
                    'from': headers.get('From', 'Unknown'),
                    'date': headers.get('Date', ''),
                    'body': self._get_email_body(msg_detail)
                })
            return email_data
        except Exception as e:
            print(f"Error fetching emails: {e}")
            return []

    def _get_email_body(self, msg_detail):
        """Helper to extract plain text body from email payload."""
        try:
            if 'parts' in msg_detail['payload']:
                for part in msg_detail['payload']['parts']:
                    if part['mimeType'] == 'text/plain':
                        import base64
                        data = part['body']['data']
                        return base64.urlsafe_b64decode(data).decode()
            elif 'body' in msg_detail['payload']:
                import base64
                data = msg_detail['payload']['body'].get('data')
                if data:
                    return base64.urlsafe_b64decode(data).decode()
        except Exception:
            return ""
        return ""

    def create_calendar_event(self, event_data: dict):
        """
        Creates a Google Calendar event.
        event_data schema: {summary, location, description, start_time (ISO), end_time (ISO)}
        """
        service = self.get_calendar_service()
        if not service: return None

        event = {
            'summary': event_data.get('event_title', 'Career Event'),
            'location': event_data.get('location', ''),
            'description': event_data.get('description', ''),
            'start': {
                'dateTime': event_data.get('start_time'),
                'timeZone': 'UTC', # Adjust if we know user timezone
            },
            'end': {
                'dateTime': event_data.get('end_time'),
                'timeZone': 'UTC',
            },
            'reminders': {
                'useDefault': False,
                'overrides': [
                    {'method': 'email', 'minutes': 24 * 60},
                    {'method': 'popup', 'minutes': 30},
                ],
            },
        }

        try:
            created_event = service.events().insert(calendarId='primary', body=event).execute()
            return created_event.get('htmlLink')
        except Exception as e:
            print(f"Error creating calendar event: {e}")
            return None

    def create_task(self, title: str, notes: str = None, due_date: str = None):
        """
        Creates a task in the default list.
        """
        service = self.get_tasks_service()
        if not service: return None

        task_body = {
            'title': title,
            'notes': notes
        }
        if due_date:
            # Tasks API requires RFC 3339 timestamp ending in Z
            task_body['due'] = due_date 

        try:
            result = service.tasks().insert(tasklist='@default', body=task_body).execute()
            return result.get('id')
        except Exception as e:
            print(f"Error creating task: {e}")
            return None

    def create_draft(self, user_email, to, subject, message_body):
        """
        Creates a draft email in the user's Gmail account.
        """
        if not self.creds: return None
        try:
            service = build('gmail', 'v1', credentials=self.creds)
            
            message = MIMEText(message_body)
            message['to'] = to
            message['from'] = user_email
            message['subject'] = subject
            
            # Encode the message
            raw_message = base64.urlsafe_b64encode(message.as_bytes()).decode()
            body = {'message': {'raw': raw_message}}
            
            draft = service.users().drafts().create(userId="me", body=body).execute()
            print(f"Draft id: {draft['id']}")
            return draft
        except Exception as e:
            print(f"An error occurred creating draft: {e}")
            return None
