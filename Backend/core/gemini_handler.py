import os
import sys
import google.generativeai as genai
from google.api_core import exceptions as google_exceptions
from dotenv import load_dotenv
from typing import Optional, Any, List

import time

# Load env vars
load_dotenv()

class GeminiHandler:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GeminiHandler, cls).__new__(cls)
            cls._instance._initialize_keys()
        return cls._instance

    def _initialize_keys(self):
        """
        Loads API keys from a single comma-separated env variable 'GEMINI_API_KEYS'
        or falls back to legacy single keys.
        """
        self.api_keys = []
        # Updated to 'lite' model which often has better availability/quota limits in EAP
        self.model_name = "models/gemini-2.5-flash"

        # 1. Try new comma-separated format
        keys_str = os.getenv("GEMINI_API_KEYS")
        if keys_str:
            self.api_keys = [k.strip() for k in keys_str.split(',') if k.strip()]
        
        # 2. Fallback to legacy format (GEMINI_API_KEY_1, etc.)
        if not self.api_keys:
            i = 1
            while True:
                key = os.getenv(f"GEMINI_API_KEY_{i}")
                if not key and i == 1:
                    key = os.getenv("GOOGLE_API_KEY")
                
                if key:
                    self.api_keys.append(key)
                    i += 1
                else:
                    break
        
        if not self.api_keys:
            print("CRITICAL ERROR: No Gemini API Keys found in .env (GEMINI_API_KEYS).")
            # We don't exit here to allow app to start, but calls will fail.
        else:
            print(f"✅ GeminiHandler initialized with {len(self.api_keys)} keys.")

    def call_gemini(self, prompt: str, is_chat: bool = False, history: List = None) -> Optional[Any]:
        """
        Executes a Gemini API call with automatic key rotation and SMART RETRY on rate limits.
        """
        if not self.api_keys:
            print("❌ No API keys available.")
            return None

        safety_settings = {
            'HARM_CATEGORY_HARASSMENT': 'BLOCK_NONE',
            'HARM_CATEGORY_HATE_SPEECH': 'BLOCK_NONE',
            'HARM_CATEGORY_SEXUALLY_EXPLICIT': 'BLOCK_NONE',
            'HARM_CATEGORY_DANGEROUS_CONTENT': 'BLOCK_NONE'
        }

        # Try all keys in rotation
        for i, key in enumerate(self.api_keys):
            try:
                # print(f"DEBUG(GeminiHandler): Try Key #{i + 1}") 
                genai.configure(api_key=key)
                model = genai.GenerativeModel(self.model_name)
                
                if is_chat:
                    chat_session = model.start_chat(history=history or [])
                    response = chat_session.send_message(prompt)
                else:
                    response = model.generate_content(prompt, safety_settings=safety_settings)
                
                return response

            except google_exceptions.ResourceExhausted as e:
                # RATE LIMIT HIT: Wait properly before rotating
                wait_time = 5 # Wait 5 seconds to let quota recover slightly
                print(f"⚠️ API Key #{i + 1} Rate Limited (ResourceExhausted). Cooling down for {wait_time}s...")
                time.sleep(wait_time) 
                print(f"🔄 Rotating to next key...")
                continue 

            except (google_exceptions.PermissionDenied, 
                    google_exceptions.InternalServerError,
                    google_exceptions.ServiceUnavailable) as e:
                print(f"⚠️ API Key #{i + 1} Failed ({type(e).__name__}). Rotating...")
                continue 
                
            except Exception as e:
                print(f"⚠️ Unexpected Error with Key #{i + 1}: {e}. Rotating...")
                continue

        print("❌ All Gemini keys exhausted or failed. Request failed.")
        return None

# Singleton instance for easy import
gemini_client = GeminiHandler()
