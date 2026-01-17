
import os
import sys
import json
import re
from typing import Optional, Tuple, Dict, Any, List
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi.params import Query
import firebase_admin
from firebase_admin import firestore
from firebase_admin import credentials

def initialize_firebase():
    if not firebase_admin._apps:
        # Check for service account key in various common locations
        # PRIORITIZED: firebase-credentials.json (genaihack) over service-account.json (carbide)
        possible_keys = [
            Path(__file__).parent.parent / "firebase-credentials.json",
            Path("firebase-credentials.json"),
            Path(__file__).parent.parent / "service-account.json",  
            Path("service-account.json"),
        ]
        
        cred_path = None
        for path in possible_keys:
            if path.exists():
                cred_path = str(path)
                break
        
        try:
            if cred_path:
                cred = credentials.Certificate(cred_path)
                firebase_admin.initialize_app(cred)
                print(f"✅ Firebase initialized with credentials from: {cred_path}")
            else:
                # Default initialization (works if Google Application Credentials env var is set)
                firebase_admin.initialize_app()
                print("✅ Firebase initialized with default credentials/environment variable.")
        except Exception as e:
            print(f"⚠️ Warning: Firebase initialization failed: {e}")

initialize_firebase()

def _stringify_list_content(content: Any) -> str:
    """Safely converts a list of strings or dicts into a single newline-separated string."""
    if not isinstance(content, list): return str(content or "")
    string_parts = []
    for item in content:
        if isinstance(item, str): string_parts.append(item)
        elif isinstance(item, dict):
            string_parts.append(", ".join([f"{k.replace('_', ' ').title()}: {v}" for k, v in item.items()]))
        else: string_parts.append(str(item))
    return "\n".join(string_parts)


def calculate_stats(numbers):
    """Calculates mean and median for a list of numbers."""
    if not numbers:
        return {"mean": 0, "median": 0}
        
    numbers = sorted(numbers)
    n = len(numbers)
    mean = sum(numbers) / n

    if n % 2 == 1:
        median = numbers[n // 2]
    else:
        median = (numbers[n // 2 - 1] + numbers[n // 2]) / 2

    return {
        "mean": mean,
        "median": median
    }

def _convert_firestore_timestamps(obj: Any) -> Any:
    """
    Recursively converts Firestore DatetimeWithNanoseconds objects (and standard datetime objects)
    to ISO 8601 strings to make them JSON serializable.
    Also handles Firestore 'Sentinel' objects (like SERVER_TIMESTAMP) by converting to current time.
    """
    if isinstance(obj, dict):
        return {k: _convert_firestore_timestamps(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [_convert_firestore_timestamps(elem) for elem in obj]
    elif isinstance(obj, datetime):
        return obj.isoformat()
    
    # Handle Firestore Sentinel objects or other non-serializable types
    if not isinstance(obj, (str, int, float, bool, type(None))):
        try:
            name = type(obj).__name__
            if 'Sentinel' in name:
                return datetime.now().isoformat()
            if 'DatetimeWithNanoseconds' in name:
                return obj.isoformat()
        except:
            pass
    return obj


class DatabaseManager:
    """
    Handles all interactions with the Firebase Firestore database.
    Assumes Firebase Admin SDK has already been initialized by main.py.
    """

    _standard_to_db_collections_map = {
        'work_experience': 'work_experiences',
        'education': 'education',
        'projects': 'projects',
        'internships': 'internships',
        'certifications': 'certifications',
        'skills': 'skills',
        'additional_sections': 'additional_sections'
    }

    _ai_key_to_standard_map = {
        'personal_info': ['personal_info'],
        'summary': ['summary'],
        'work_experience': ['work_experience', 'professional_experience', 'experience', 'work_history'],
        'education': ['education', 'academic_background'],
        'projects': ['projects', 'personal_projects'],
        'internships': ['internships', 'internship_experience'],
        'certifications': ['certifications', 'licenses_&_certifications'],
        'skills': ['skills'],
    }

    def __init__(self):
        """
        Initializes the DatabaseManager.
        It expects firebase_admin.initialize_app() to have been called already by main.py.
        """
        try:
            self.db = firestore.client()
        except Exception as e:
            print(f"❌ ERROR: DatabaseManager failed to get Firestore client. Is Firebase Admin SDK initialized? {e}")
            raise 

    def _map_ai_section_to_standard_key(self, ai_key: str) -> Optional[str]:
        normalized_key = ai_key.lower().replace(" ", "_").replace("-", "_")
        for standard_key, variations in self._ai_key_to_standard_map.items():
            if normalized_key in variations: return standard_key
        return None
    
    def fetch_resume_relational(self, user_uid: str, get_optimized: bool = False) -> Optional[Dict[str, Any]]:
        user_doc_ref = self.db.collection('users').document(user_uid)
        user_doc = user_doc_ref.get()

        if not user_doc.exists:
            print(f"User document with UID {user_uid} not found.")
            return None

        user_data = user_doc.to_dict()
        
        # Apply the conversion to the entire user_data dictionary once, immediately after fetching.
        user_data = _convert_firestore_timestamps(user_data) 

        resume_data: Dict[str, Any] = {}

        # Fetch top-level personal info
        personal_info = {
            'name': user_data.get('name'),
            'email': user_data.get('email'),
            'phone': user_data.get('phone'),
            'linkedin': user_data.get('linkedin'),
            'github': user_data.get('github')
        }
        if any(v for v in personal_info.values() if v is not None and v != ''):
            resume_data['personal_info'] = personal_info

        # Fetch the stored raw text and metadata
        raw_resume_text = user_data.get('raw_resume_text')
        if raw_resume_text:
            resume_data['raw_text'] = raw_resume_text

        resume_metadata = user_data.get('resume_metadata')
        if resume_metadata:
            resume_data['resume_metadata'] = resume_metadata

        # NEW: Fetch saved structured_resume_data and categorized_skills directly
        structured_resume_data = user_data.get('structured_resume_data')
        categorized_skills = user_data.get('categorized_skills')

        if structured_resume_data:
            resume_data.update(structured_resume_data) # Add all structured fields
            if categorized_skills:
                resume_data['skills'] = categorized_skills # Override with categorized skills if present

        # Get summary, prioritizing optimized if requested and available (from legacy 'resume' map or current 'summary' field)
        summary_to_use = None
        if get_optimized:
            # Check current structured data first
            if resume_data.get('optimized_summary'):
                summary_to_use = resume_data['optimized_summary']
            elif user_data.get('resume', {}).get('optimized_summary'): # Fallback to legacy field
                summary_to_use = user_data.get('resume', {}).get('optimized_summary')
        
        if not summary_to_use: # If no optimized summary, use the base summary
            if resume_data.get('summary'):
                summary_to_use = resume_data['summary']
            elif user_data.get('resume', {}).get('summary'): # Fallback to legacy field
                summary_to_use = user_data.get('resume', {}).get('summary')

        if summary_to_use:
            resume_data['summary'] = summary_to_use


        # --- Fetch sub-collection data ---
        # This part ensures that if structured_resume_data (above) didn't fully capture
        # all sub-collection details (e.g., if you only store a summary of projects there),
        # these individual documents are still fetched. However, if structured_resume_data
        # already contains the full list for a section, this might be redundant or require
        # careful merging. For now, it overrides with sub-collection details.
        for standard_key, collection_name in self._standard_to_db_collections_map.items():
            if standard_key in ['skills', 'additional_sections']:
                continue 
            
            docs = user_doc_ref.collection(collection_name).stream()
            data_list = []
            for doc in docs:
                item_data = doc.to_dict()
                item_data = _convert_firestore_timestamps(item_data) # Apply conversion to each sub-collection item

                desc_to_use = (
                    item_data.get('optimized_description')
                    if get_optimized and item_data.get('optimized_description')
                    else item_data.get('description')
                )
                
                item = {k: v for k, v in item_data.items() if k not in ['optimized_description', 'description']}
                
                if desc_to_use:
                    item['description'] = desc_to_use.split('\n') if isinstance(desc_to_use, str) else desc_to_use
                
                data_list.append(item)
            if data_list:
                resume_data[standard_key] = data_list

        # Skills (explicitly fetched from sub-collection even if top-level exists, for optimized_data view)
        # Note: This will override any 'skills' key from structured_resume_data fetched earlier if present.
        # This prioritizes the detailed sub-collection for the optimized view.
        docs = user_doc_ref.collection(self._standard_to_db_collections_map['skills']).stream()
        skills_dict: Dict[str, Any] = {}
        for doc in docs:
            item = doc.to_dict()
            item = _convert_firestore_timestamps(item) # Apply conversion
            category = item.get('category')
            skill_name = item.get('skill_name')
            if category and skill_name:
                if category not in skills_dict:
                    skills_dict[category] = []
                skills_dict[category].append(skill_name)
        if skills_dict:
            resume_data['skills'] = skills_dict;

        # Additional sections
        docs = user_doc_ref.collection(self._standard_to_db_collections_map['additional_sections']).stream()
        for doc in docs:
            item = doc.to_dict()
            item = _convert_firestore_timestamps(item) # Apply conversion
            desc_to_use = (
                item.get('optimized_description')
                if get_optimized and item.get('optimized_description')
                else item.get('description')
            )
            section_name = item.get('section_name')
            if section_name and desc_to_use:
                resume_data[section_name] = desc_to_use.split('\n') if isinstance(desc_to_use, str) else desc_to_use

        return _convert_firestore_timestamps({k: v for k, v in resume_data.items() if v})

    def update_resume_relational(self, user_uid: str, parsed_data: Dict[str, Any]) -> bool:
        """
        Updates resume data and clears/re-inserts sub-collections.
        Intended for initial uploads or when structured data needs full refresh.
        """
        try:
            user_doc_ref = self.db.collection('users').document(user_uid)
            
            user_doc_ref.set({'lastUpdatedAt': firestore.SERVER_TIMESTAMP}, merge=True)
            print(f" -> Ensured user document exists for {user_uid}")

            collections_to_delete = list(self._standard_to_db_collections_map.values())
            for coll_name in collections_to_delete:
                docs = user_doc_ref.collection(coll_name).stream()
                for doc in docs:
                    doc.reference.delete()
            print(f" -> Cleared old resume sub-collections for user {user_uid}")

            p_info = parsed_data.get('personal_info', {})
            
            update_fields = {
                'name': p_info.get('name'),
                'email': p_info.get('email'),
                'phone': p_info.get('phone'),
                'linkedin': p_info.get('linkedin'),
                'github': p_info.get('github'),
                'raw_resume_text': parsed_data.get('raw_text'),
                'resume_metadata': parsed_data.get('resume_metadata'),
                'structured_resume_data': {k:v for k,v in parsed_data.items() if k not in ['skills', 'raw_text', 'resume_metadata']}, # Save core structured data
                'categorized_skills': parsed_data.get('skills'), # Save categorized skills
                'resume.summary': parsed_data.get('summary'), # Keep for backwards compatibility
                'resume.optimized_summary': None, # Reset optimized summary
                'lastUpdatedAt': firestore.SERVER_TIMESTAMP
            }

            filtered_update_fields = {k: v for k, v in update_fields.items() if v is not None}
            if 'resume' in filtered_update_fields and isinstance(filtered_update_fields['resume'], dict):
                filtered_update_fields['resume'] = {k: v for k, v in filtered_update_fields['resume'].items() if v is not None}
            
            user_doc_ref.update(filtered_update_fields)
            print(f" -> Updated main user document for {user_uid} with personal info, raw text, metadata, structured data, and summary.")

            for ai_section_key, section_content in parsed_data.items():
                if ai_section_key in ['personal_info', 'summary', 'skills', 'resume_metadata', 'raw_text', 'optimized_summary']:
                    continue
                
                standard_key = self._map_ai_section_to_standard_key(ai_section_key)
                
                if standard_key and standard_key in self._standard_to_db_collections_map:
                    collection_name = self._standard_to_db_collections_map[standard_key]
                    if isinstance(section_content, list):
                        for item in section_content:
                            if isinstance(item, dict):
                                item_to_save = item.copy()
                                if 'description' in item_to_save:
                                    item_to_save['description'] = _stringify_list_content(item_to_save['description'])
                                item_to_save['optimized_description'] = None
                                user_doc_ref.collection(collection_name).add(item_to_save)
                else: # For custom/additional sections
                    description = _stringify_list_content(section_content)
                    user_doc_ref.collection(self._standard_to_db_collections_map['additional_sections']).add({
                        'section_name': ai_section_key,
                        'description': description,
                        'optimized_description': None
                    })
            

            print(f" -> Successfully re-inserted new resume sub-collection data for user {user_uid}.")
            return True

        except Exception as e:
            print(f"Error updating resume for user {user_uid}: {e}")
            return False


    def update_optimized_resume_relational(self, user_uid: str, optimized_data: Dict[str, Any]):
        user_doc_ref = self.db.collection('users').document(user_uid)

        # Update the summary field in the top-level structured_resume_data
        if 'summary' in optimized_data:
            user_doc_ref.update({'structured_resume_data.summary': optimized_data['summary']})
            user_doc_ref.update({'structured_resume_data.optimized_summary': optimized_data['summary']}) # Store optimized summary directly

        # This part iterates sub-collections and updates 'optimized_description'
        def update_item_optimized_description(collection_name: str, items: list, match_keys: list):
            for item_to_match in items:
                optimized_desc_str = _stringify_list_content(item_to_match.get('description', []))
                
                query = user_doc_ref.collection(collection_name)
                for key in match_keys:
                    if item_to_match.get(key):
                        query = query.where(key, '==', item_to_match.get(key))
                
                docs = query.limit(1).stream()
                for doc in docs:
                    doc.reference.update({'optimized_description': optimized_desc_str})

        if 'work_experience' in optimized_data: update_item_optimized_description(self._standard_to_db_collections_map['work_experience'], optimized_data['work_experience'], ['role', 'company'])
        if 'education' in optimized_data: update_item_optimized_description(self._standard_to_db_collections_map['education'], optimized_data['education'], ['institution', 'degree'])
        if 'projects' in optimized_data: update_item_optimized_description(self._standard_to_db_collections_map['projects'], optimized_data['projects'], ['title'])
        if 'internships' in optimized_data: update_item_optimized_description(self._standard_to_db_collections_map['internships'], optimized_data['internships'], ['role', 'company'])
        if 'certifications' in optimized_data: update_item_optimized_description(self._standard_to_db_collections_map['certifications'], optimized_data['certifications'], ['name'])

        for key, content in optimized_data.items():
            if self._map_ai_section_to_standard_key(key) is None and key not in ['personal_info', 'summary', 'skills', 'resume_metadata', 'raw_text', 'structured_resume_data', 'categorized_skills', 'optimized_summary']:
                optimized_desc_str = _stringify_list_content(content)
                docs = user_doc_ref.collection(self._standard_to_db_collections_map['additional_sections']).where('section_name', '==', key).limit(1).stream()
                for doc in docs:
                    doc.reference.update({'optimized_description': optimized_desc_str})
        
        user_doc_ref.update({'lastUpdatedAt': firestore.SERVER_TIMESTAMP})
        print(f" -> Optimized data for user UID {user_uid} has been fully updated in Firestore.")



    def get_leaderboard(self, limit: int = 50) -> List[Dict[str, Any]]:
        """
        Fetches users and sorts them by a calculated 'activity score'.
        Score = roadmaps + resumes + assessments + jobs_matched.
        """
        try:
            users_ref = self.db.collection('users')
            # Fetch all users but ONLY necessary fields to keep it lightweight
            # This drastically reduces bandwidth by ignoring large 'resume_text' fields
            docs = users_ref.select(['name', 'email', 'stats', 'categorized_skills', 'linkedin', 'github']).stream()
            
            leaderboard_data = []
            for doc in docs:
                data = doc.to_dict()
                stats = data.get('stats', {})
                
                # Calculate Total Score
                score = (
                    stats.get('roadmaps_generated', 0) +
                    stats.get('resumes_optimized', 0) +
                    stats.get('assessments_taken', 0) +
                    stats.get('jobs_matched', 0)
                )
                
                # Only include users with some activity
                if score >= 0: 
                    user_info = {
                        "name": data.get('name', 'Anonymous User'),
                        "email": data.get('email', 'Hidden'),
                        "linkedin": data.get('linkedin'),
                        "github": data.get('github'),
                        "skills": data.get('categorized_skills', {}), 
                        "score": score,
                        "stats": stats
                    }
                    leaderboard_data.append(user_info)
            
            # Sort by score descending (Highest first)
            leaderboard_data.sort(key=lambda x: x['score'], reverse=True)
            
            return _convert_firestore_timestamps(leaderboard_data[:limit])
            
        except Exception as e:
            print(f"❌ Error fetching leaderboard: {e}")
            return []
        
    def close_connection(self):
        pass


    # NEW/MODIFIED: Function to safely increment user statistics
    def increment_user_stat(self, uid: str, stat_name: str, increment_by: int = 1):
        user_doc_ref = self.db.collection('users').document(uid)
        try:
            # Check if 'stats' map exists and is a dictionary
            user_doc = user_doc_ref.get()
            if not user_doc.exists:
                # If document doesn't exist, create it with initial stats
                print(f"ℹ️ User document for {uid} does not exist. Creating with initial stats.")
                user_doc_ref.set({
                    'stats': {
                        'roadmaps_generated': 0,
                        'resumes_optimized': 0,
                        'assessments_taken': 0,
                        'jobs_matched': 0,
                        stat_name: firestore.Increment(increment_by) # Include current increment
                    }
                })
            else:
                user_data = user_doc.to_dict()
                if 'stats' not in user_data or not isinstance(user_data['stats'], dict):
                    # If 'stats' is missing or not a dict, initialize it safely
                    print(f"ℹ️ 'stats' field missing or malformed for {uid}. Initializing and setting stat.")
                    user_doc_ref.update({
                        'stats': {
                            'roadmaps_generated': 0,
                            'resumes_optimized': 0,
                            'assessments_taken': 0,
                            'jobs_matched': 0,
                            stat_name: firestore.Increment(increment_by) # Include current increment
                        }
                    })
                else:
                    # 'stats' map exists, proceed with incrementing the specific field
                    user_doc_ref.update({
                        f'stats.{stat_name}': firestore.Increment(increment_by)
                    })
            print(f"✅ Incremented stat '{stat_name}' for user {uid} by {increment_by}.")
        except Exception as e:
            print(f"❌ Critical Error incrementing stat '{stat_name}' for user {uid}: {e}")
            raise # Re-raise to ensure error is propagated

    # NEW: Helper methods to call increment_user_stat for specific actions
    def record_resume_optimization(self, uid: str):
        self.increment_user_stat(uid, 'resumes_optimized', 1)

    def record_roadmap_generation(self, uid: str):
        self.increment_user_stat(uid, 'roadmaps_generated', 1)

    def record_assessment_taken(self, uid: str):
        self.increment_user_stat(uid, 'assessments_taken', 1)

    def record_jobs_matched(self, uid: str, num_jobs: int = 1):
        self.increment_user_stat(uid, 'jobs_matched', num_jobs)

    # --- NEW: Performance Tracking Methods ---

    def save_assessment_result(self, uid: str, results: Dict[str, Any]):
        """Saves a detailed assessment result to the user's assessments collection."""
        try:
            # Create a copy so we don't pollute the original dict with Firestore objects
            db_data = results.copy()
            db_data['timestamp'] = firestore.SERVER_TIMESTAMP
            self.db.collection('users').document(uid).collection('assessments').add(db_data)
            self.increment_user_stat(uid, 'assessments_taken')
            print(f"✅ Assessment result saved for user {uid}.")
        except Exception as e:
            print(f"❌ Error saving assessment result for {uid}: {e}")

    def save_interview_result(self, uid: str, results: Dict[str, Any]):
        """Saves a detailed interview result to the user's interviews collection."""
        try:
            # Create a copy so we don't pollute the original dict with Firestore objects
            db_data = results.copy()
            db_data['timestamp'] = firestore.SERVER_TIMESTAMP
            self.db.collection('users').document(uid).collection('interviews').add(db_data)
            self.increment_user_stat(uid, 'interviews_taken')
            print(f"✅ Interview result saved for user {uid}.")
        except Exception as e:
            print(f"❌ Error saving interview result for {uid}: {e}")

    def save_ats_score_history(self, uid: str, score: int, job_role: str):
        """Saves an ATS optimization score to the user's history."""
        try:
            data = {
                'score': score,
                'job_role': job_role,
                'timestamp': firestore.SERVER_TIMESTAMP
            }
            self.db.collection('users').document(uid).collection('ats_history').add(data)
            print(f"✅ ATS score ({score}) saved for user {uid}.")
        except Exception as e:
            print(f"❌ Error saving ATS score for {uid}: {e}")

    async def get_user_performance_summary(self, uid: str) -> Dict[str, Any]:
        """
        Aggregates recent performance data to determine user's standing.
        Returns average scores for assessments, interviews, and latest ATS score.
        Also calculates roadmap completion rate.
        """
        try:
            user_ref = self.db.collection('users').document(uid)
            
            # Helper to get score with fallbacks from different possible AI response field names
            def get_score(data, primary_key='overall_score', fallback_keys=['score', 'rating', 'percentage', 'grade']):
                if not data: return 0
                val = data.get(primary_key)
                if val is not None and isinstance(val, (int, float)): return val
                for key in fallback_keys:
                    val = data.get(key)
                    if val is not None and isinstance(val, (int, float)): return val
                return 0

            # 1. Assessments - Fetch Top 6 (extra one to check for more) using Query
            # We use 'limit(6)' to fetch just what we need.
            assessments_ref = user_ref.collection('assessments')
            # Order by timestamp descending
            query = assessments_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(6)
            assessments_list = [doc.to_dict() for doc in query.stream()]
            
            # If for some reason timestamp is missing, our order_by might drop them.
            # But we save timestamp on creation, so this should remain robust for new data.
            # Fallback sort in python just in case some docs were returned out of order or if we want to be safe
            assessments_list.sort(key=lambda x: str(x.get('timestamp', '0')), reverse=True)
            
            assessment_scores = [get_score(data) for data in assessments_list[:5]]
            assessment_stats = calculate_stats(assessment_scores)
            avg_assessment = assessment_stats['mean']
            
            recent_assessments = []
            for data in assessments_list[:3]:
                recent_assessments.append({
                    'name': data.get('assessment_type', 'Skill Assessment'),
                    'score': get_score(data),
                    'feedback': data.get('strengths', ["Good results"])[0] if data.get('strengths') and isinstance(data.get('strengths'), list) else (data.get('overall_feedback') or "Steady progress."),
                    'improvement': data.get('areas_for_improvement', ["Keep practicing"])[0] if data.get('areas_for_improvement') and isinstance(data.get('areas_for_improvement'), list) else (data.get('weaknesses', ["Focus on core concepts."])[0] if isinstance(data.get('weaknesses'), list) and data.get('weaknesses') else "Refine your approach."),
                    'timestamp': data.get('timestamp')
                })

            # 2. Interviews - Fetch Top 6
            interviews_ref = user_ref.collection('interviews')
            query = interviews_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(6)
            interviews_list = [doc.to_dict() for doc in query.stream()]
            
            interviews_list.sort(key=lambda x: str(x.get('timestamp', '0')), reverse=True)
            
            interview_scores = [get_score(data) for data in interviews_list[:5]]
            interview_stats = calculate_stats(interview_scores)
            avg_interview = interview_stats['mean']
            
            recent_interviews = []
            for data in interviews_list[:3]:
                recent_interviews.append({
                    'name': data.get('job_role', 'Mock Interview'),
                    'score': get_score(data),
                    'feedback': data.get('overall_feedback', 'Balanced performance.'),
                    'improvement': data.get('areas_for_improvement', ["Work on clarity"])[0] if data.get('areas_for_improvement') and isinstance(data.get('areas_for_improvement'), list) else "Refine your STAR responses.",
                    'timestamp': data.get('timestamp')
                })

            # 3. Latest ATS Score and History - Fetch Top 6
            ats_ref = user_ref.collection('ats_history')
            query = ats_ref.order_by('timestamp', direction=firestore.Query.DESCENDING).limit(6)
            ats_list = [doc.to_dict() for doc in query.stream()]
            
            ats_list.sort(key=lambda x: str(x.get('timestamp', '0')), reverse=True)
            
            latest_ats = get_score(ats_list[0], primary_key='score') if ats_list else 0
            
            recent_ats = []
            for data in ats_list[:3]:
                recent_ats.append({
                    'name': data.get('job_role', 'Resume Optimization'),
                    'score': get_score(data, primary_key='score'),
                    'feedback': "ATS optimization checked.",
                    'improvement': "Incorporate more industry keywords.",
                    'timestamp': data.get('timestamp')
                })

            
            roadmap = await self.get_user_roadmap(uid)
            completion_rate = 0
            total_tasks = 0
            completed_tasks = 0
            recent_progress_tasks = []
            roadmap_reason = "Welcome! Start an activity to see your career performance trends."
            
            if roadmap:
                if 'last_adjustment_reason' in roadmap and roadmap['last_adjustment_reason']:
                    roadmap_reason = roadmap['last_adjustment_reason']
                elif composite_score > 0:
                    # Fallback Trend Text if AI reason hasn't been generated yet but stats exist
                    roadmap_reason = f"Your current performance index is {int(composite_score)}%. "
                    if avg_assessment < 50: roadmap_reason += "Focus on improving your assessment scores."
                    elif avg_interview < 50: roadmap_reason += "Try more mock interviews to boost confidence."
                    elif latest_ats < 60: roadmap_reason += "Your resume optimization could use some work."
                    else: roadmap_reason += "You are on a great track! Keep completing roadmap tasks."
                
                if 'detailed_roadmap' in roadmap:
                    all_completed = []
                    for phase in roadmap['detailed_roadmap']:
                        topics = phase.get('topics', [])
                        for topic in topics:
                            total_tasks += 1
                            if isinstance(topic, dict) and topic.get('is_completed'):
                                completed_tasks += 1
                                all_completed.append(topic)
                    
                    completion_rate = (completed_tasks / total_tasks * 100) if total_tasks > 0 else 0
                    
                    # Sort by completed_at if available
                    all_completed.sort(key=lambda x: x.get('completed_at', ''), reverse=True)
                    for task in all_completed[:3]:
                        recent_progress_tasks.append({
                            'name': task.get('name', 'Roadmap Task'),
                            'score': 100, # completed
                            'feedback': "Task successfully completed.",
                            'improvement': "Continue to the next objective.",
                            'timestamp': task.get('completed_at')
                        })

            # --- Composite Score Calculation (General) ---
            # Weights: Progress (30%), Assessment (25%), Interview (25%), ATS (20%)
            composite_score = (completion_rate * 0.30) + (avg_assessment * 0.25) + (avg_interview * 0.25) + (latest_ats * 0.20)


            return _convert_firestore_timestamps({
                'avg_assessment': avg_assessment,
                'avg_interview': avg_interview,
                'latest_ats': latest_ats,
                'completion_rate': completion_rate,
                'composite_score': round(composite_score, 2),
                'roadmap_reason': roadmap_reason,
                'total_assessments': len(assessment_scores),
                'total_interviews': len(interview_scores),
                'tasks_completed': completed_tasks,
                'total_tasks': total_tasks,
                'recent_activities': {
                    'assessments': recent_assessments,
                    'interviews': recent_interviews,
                    'ats': recent_ats,
                    'progress': recent_progress_tasks
                }
            })
        except Exception as e:
            print(f"❌ Error fetching performance summary for {uid}: {e}")
            import traceback
            traceback.print_exc()
            return {
                'error': str(e),
                'avg_assessment': 0, 'avg_interview': 0, 'latest_ats': 0, 
                'completion_rate': 0, 'total_assessments': 0, 'total_interviews': 0,
                'tasks_completed': 0, 'total_tasks': 0,
                'recent_activities': {
                    'assessments': [], 'interviews': [], 'ats': [], 'progress': []
                }
            }

    # MODIFIED LOGIC: This function now deletes all previous roadmaps before creating the new one.
    async def save_user_roadmap(self, user_uid: str, new_roadmap_data: Dict[str, Any], last_adjustment_reason: Optional[str] = None) -> bool:
        """
        Ensures only one roadmap exists by deleting all previous roadmap documents
        for the user before creating the new one.
        """
        try:
            roadmaps_collection = self.db.collection('users').document(user_uid).collection('roadmaps')
            
            # Step 1: Find and delete all existing documents in the sub-collection.
            existing_docs = roadmaps_collection.stream()
            for doc in existing_docs:
                print(f"  -> Deleting old roadmap document: {doc.id}")
                doc.reference.delete()

            # Step 2: Create the new roadmap document.
            data_to_add = {
                'createdAt': firestore.SERVER_TIMESTAMP,
                'last_adjustment_reason': last_adjustment_reason,
                **new_roadmap_data
            }
            roadmaps_collection.add(data_to_add)

            
            print(f"✅ New roadmap created after clearing previous for user {user_uid}.")
            return True
        except Exception as e:
            print(f"❌ Error during delete-then-create for roadmap (user: {user_uid}): {e}")
            raise

    # This function now correctly finds the one and only roadmap document.
    async def get_user_roadmap(self, user_uid: str) -> Optional[Dict[str, Any]]:
        """Retrieves the single roadmap document for a user."""
        try:
            roadmaps_collection = self.db.collection('users').document(user_uid).collection('roadmaps')
            # Since there's only one, we can just get the first result from the stream.
            docs = roadmaps_collection.limit(1).stream()
            the_only_roadmap_doc = next(docs, None)

            if the_only_roadmap_doc:
                return _convert_firestore_timestamps(the_only_roadmap_doc.to_dict())
            else:
                return None
        except Exception as e:
            print(f"❌ Error fetching the roadmap for user {user_uid}: {e}")
            raise

    # This function also correctly finds and updates the one and only roadmap document.
    async def update_roadmap_task_status(self, user_uid: str, phase_title: str, topic_name: str, is_completed: bool) -> bool:
        """Finds the single roadmap document and updates a task's status with a completion timestamp."""
        try:
            roadmaps_collection = self.db.collection('users').document(user_uid).collection('roadmaps')
            # Since we ensure only one roadmap exists per user, we don't need sorting which can exclude docs missing the field.
            docs = roadmaps_collection.limit(1).stream()
            the_only_roadmap_doc = next(docs, None)


            if not the_only_roadmap_doc:
                print(f"❌ No roadmap document found for user {user_uid}. Cannot update.")
                return False

            roadmap_content = the_only_roadmap_doc.to_dict()
            doc_ref = the_only_roadmap_doc.reference

            if 'detailed_roadmap' not in roadmap_content: return False

            updated_detailed_roadmap = roadmap_content['detailed_roadmap']
            task_found_and_updated = False
            for phase in updated_detailed_roadmap:
                if phase.get('phase_title') == phase_title and isinstance(phase.get('topics'), list):
                    for topic in phase['topics']:
                        if isinstance(topic, dict) and topic.get('name') == topic_name:
                            topic['is_completed'] = is_completed
                            if is_completed:
                                topic['completed_at'] = datetime.now().isoformat()
                            elif 'completed_at' in topic:
                                del topic['completed_at']
                            task_found_and_updated = True
                            break
                if task_found_and_updated:
                    break

            if task_found_and_updated:
                doc_ref.update({'detailed_roadmap': updated_detailed_roadmap})
                print(f"✅ Task '{topic_name}' updated for user {user_uid}.")
                return True
            else:
                return False
        except Exception as e:
            print(f"❌ Error updating roadmap task status for user {user_uid}: {e}")
            raise

    async def get_performance_history(self, uid: str) -> Dict[str, Any]:
        """
        Calculates cumulative performance trends:
        1. Recent (This Week): Last 7 days.
        2. Prior (Previous Weeks): Everything before that.
        3. Total (Collective): Overall averages.
        """
        try:
            now = datetime.now(timezone.utc)
            one_week_ago = now - timedelta(days=7)
            user_ref = self.db.collection('users').document(uid)

            def aggregate_scores(collection_name, field='overall_score'):
                recent = []
                prior = []
                # Query Optimization: Only fetch timestamp and the score field
                # This prevents downloading huge feedback/analysis text logs.
                docs = user_ref.collection(collection_name).select(['timestamp', field]).stream()
                for doc in docs:
                    data = doc.to_dict()
                    ts = data.get('timestamp')
                    # Firestore timestamps are datetime objects if using recent SDK
                    # But we sanitize them to strings in get_user_performance_summary
                    # Here we need to handle them carefully.
                    if ts and isinstance(ts, datetime):
                        score = data.get(field, 0)
                        if ts > one_week_ago:
                            recent.append(score)
                        else:
                            prior.append(score)
                
                recent_avg = calculate_stats(recent)['mean']
                prior_avg = calculate_stats(prior)['mean']
                total_avg = calculate_stats(recent + prior)['mean']
                return recent_avg, prior_avg, total_avg

            # 1. Assessments
            rec_ass, pri_ass, tot_ass = aggregate_scores('assessments')

            # 2. Interviews
            rec_int, pri_int, tot_int = aggregate_scores('interviews')

            # 3. ATS Scores
            rec_ats, pri_ats, tot_ats = aggregate_scores('ats_history', field='score')

            # 4. Progress Tracking
            # We count tasks completed this week vs total prior
            roadmap = await self.get_user_roadmap(uid)
            rec_progress = 0
            pri_progress = 0
            total_tasks_count = 0
            if roadmap and 'detailed_roadmap' in roadmap:
                for phase in roadmap['detailed_roadmap']:
                    for topic in phase.get('topics', []):
                        total_tasks_count += 1
                        if topic.get('is_completed'):
                            comp_at_str = topic.get('completed_at')
                            if comp_at_str:
                                try:
                                    comp_at = datetime.fromisoformat(comp_at_str)
                                    if comp_at.tzinfo is None:
                                        comp_at = comp_at.replace(tzinfo=timezone.utc)
                                    if comp_at > one_week_ago:
                                        rec_progress += 1
                                    else:
                                        pri_progress += 1
                                except ValueError:
                                    pri_progress += 1 # Fallback
                            else:
                                pri_progress += 1 # Old completions

            # --- 5. Composite Score Calculation ---
            # Weights: Progress (30%), Assessment (25%), Interview (25%), ATS (20%)
            # For Progress, we use (completed/total) * 100
            
            total_completion_rate = (rec_progress + pri_progress) / total_tasks_count * 100 if total_tasks_count > 0 else 0
            # Weekly completion rate could be (rec_progress / expected_per_week) but we'll use a simplified version:
            # (rec_progress / (total_tasks_count / total_weeks)) if we knew total weeks.
            # Let's just use the total averages for now as specified.
            
            comp_prog = total_completion_rate
            comp_ass = tot_ass
            comp_int = tot_int
            comp_ats = tot_ats
            
            # Weighted average
            composite_score = (comp_prog * 0.30) + (comp_ass * 0.25) + (comp_int * 0.25) + (comp_ats * 0.20)

            return {
                "assessments": {"recent": rec_ass, "prior": pri_ass, "total": tot_ass},
                "interviews": {"recent": rec_int, "prior": pri_int, "total": tot_int},
                "ats": {"recent": rec_ats, "prior": pri_ats, "total": tot_ats},
                "progress": {"recent_count": rec_progress, "prior_count": pri_progress, "total_count": rec_progress + pri_progress, "total_tasks": total_tasks_count},
                "composite_score": round(composite_score, 2),
                "trends": {
                    "assessment_diff": rec_ass - pri_ass if pri_ass > 0 else 0,
                    "interview_diff": rec_int - pri_int if pri_int > 0 else 0,
                    "ats_diff": rec_ats - pri_ats if pri_ats > 0 else 0
                }
            }
        except Exception as e:
            print(f"❌ Error getting performance history for {uid}: {e}")
            return {}
