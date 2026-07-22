import os
import sys
from datetime import datetime, timezone
import firebase_admin
from firebase_admin import credentials, firestore

# Make sure we can find Backend files
sys.path.append(os.path.dirname(os.path.abspath(__file__)))

# Prevent charmap encoding error on Windows console
if sys.platform.startswith('win'):
    import io
    sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')
    sys.stderr = io.TextIOWrapper(sys.stderr.buffer, encoding='utf-8')

try:
    from core.db_core import DatabaseManager
    db = DatabaseManager()
    print("DatabaseManager loaded successfully.")
except Exception as e:
    print(f"Error loading DatabaseManager: {e}")
    sys.exit(1)

# Real running / upcoming hackathons seed data
demo_hackathons = [
    {
        "title": "Smart India Hackathon 2026",
        "description": "India's biggest national hackathon by the Ministry of Education. Solve pressing problems of government ministries, departments, and industries. Multi-month track with massive cash prizes.",
        "organizer": "Ministry of Education, Govt of India",
        "website": "https://sih.gov.in",
        "logo_url": "https://sih.gov.in/img/logo.png",
        "start_date": "2026-09-01",
        "end_date": "2026-12-15",
        "skills_required": ["python", "java", "blockchain", "react", "machine learning", "iot"],
        "listing_tier": "featured",
        "utr": "DEMOUTR00001",
        "submitted_by": "system",
        "submitted_by_email": "sih@gov.in",
        "status": "approved",
        "amount": 499,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "title": "Google Solution Challenge 2026",
        "description": "Build a solution to one or more of the United Nations 17 Sustainable Development Goals using Google technology. Open to students globally with mentoring, swag, and cash prizes.",
        "organizer": "Google Developer Groups",
        "website": "https://developers.google.com/community/gdsc-solution-challenge",
        "logo_url": None,
        "start_date": "2026-01-15",
        "end_date": "2026-05-30",
        "skills_required": ["firebase", "flutter", "tensorflow", "google cloud", "kotlin", "javascript"],
        "listing_tier": "featured",
        "utr": "DEMOUTR00002",
        "submitted_by": "system",
        "submitted_by_email": "solutionchallenge@google.com",
        "status": "approved",
        "amount": 499,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "title": "HackMIT 2026",
        "description": "MIT's flagship annual student hackathon. Join 1,000+ students from around the world for a weekend of hacking, learning, and collaborating in Cambridge, MA. Travel reimbursements available.",
        "organizer": "MIT Tech Partners",
        "website": "https://hackmit.org",
        "logo_url": None,
        "start_date": "2026-09-18",
        "end_date": "2026-09-20",
        "skills_required": ["python", "rust", "c++", "react", "typescript", "cybersecurity"],
        "listing_tier": "standard",
        "utr": "DEMOUTR00003",
        "submitted_by": "system",
        "submitted_by_email": "organizers@hackmit.org",
        "status": "approved",
        "amount": 199,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    },
    {
        "title": "MLH Prime: DevFest AI",
        "description": "Major League Hacking's AI-focused online hackathon. Build innovative tools, bots, algorithms, or platforms using modern generative AI and LLM APIs. Welcomes beginners and veterans.",
        "organizer": "Major League Hacking",
        "website": "https://mlh.io",
        "logo_url": None,
        "start_date": "2026-08-10",
        "end_date": "2026-08-12",
        "skills_required": ["python", "openai", "pytorch", "huggingface", "llms", "next.js"],
        "listing_tier": "standard",
        "utr": "DEMOUTR00004",
        "submitted_by": "system",
        "submitted_by_email": "league@mlh.io",
        "status": "approved",
        "amount": 199,
        "submitted_at": datetime.now(timezone.utc).isoformat()
    }
]

print("Seeding hackathons collection...")
for h in demo_hackathons:
    db.db.collection('hackathons').document(h["utr"]).set(h)
    print(f"Added {h['title']} (UTR: {h['utr']})")

print("Seeding complete.")
