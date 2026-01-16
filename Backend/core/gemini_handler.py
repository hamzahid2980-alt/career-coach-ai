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
        
        # 2. Legacy Fallback (optional, for backward compatibility)
        if not self.api_keys:
            single_key = os.getenv("GOOGLE_API_KEY") or os.getenv("GEMINI_API_KEY")
            if single_key:
                self.api_keys.append(single_key)

        if self.api_keys:
            print(f"✅ GeminiHandler initialized with {len(self.api_keys)} keys.")
        else:
            print("❌ No Gemini API keys found in .env")

    def call_gemini(self, prompt: str, image_data: str = None, is_chat: bool = False, history: List = None) -> Optional[Any]:
        if not self.api_keys:
            print("❌ Gemini keys not configured.")
            return None

        num_keys = len(self.api_keys)
        
        # Try each key exactly once, starting from the last known good/next index
        for i in range(num_keys):
            # Calculate actual index based on offset
            idx = (self.current_index + i) % num_keys
            key = self.api_keys[idx]
            
            try:
                genai.configure(api_key=key)
                model = genai.GenerativeModel('gemini-1.5-flash')
                
                safety_settings = [
                    { "category": "HARM_CATEGORY_HARASSMENT", "threshold": "BLOCK_NONE" },
                    { "category": "HARM_CATEGORY_HATE_SPEECH", "threshold": "BLOCK_NONE" },
                    { "category": "HARM_CATEGORY_SEXUALLY_EXPLICIT", "threshold": "BLOCK_NONE" },
                    { "category": "HARM_CATEGORY_DANGEROUS_CONTENT", "threshold": "BLOCK_NONE" },
                ]

                if image_data:
                    # Vision request
                    image_parts = [{"mime_type": "image/jpeg", "data": image_data}]
                    response = model.generate_content([prompt, image_parts[0]], safety_settings=safety_settings)
                
                elif is_chat:
                    chat_session = model.start_chat(history=history or [])
                    response = chat_session.send_message(prompt)
                else:
                    response = model.generate_content(prompt, safety_settings=safety_settings)
                
                # SUCCESS: Update the pointer to this working key for next time
                if i > 0:
                    print(f"✅ Key index {idx} worked. Updating pointer.")
                    self.current_index = idx
                
                return response

            except google_exceptions.ResourceExhausted as e:
                print(f"⚠️ Key index {idx} Rate Limited. Rotating to next...")
                # We simply continue loop; the next iteration will check the next key.
                # Pointer will be updated effectively when a later key works.
                continue 

            except (google_exceptions.PermissionDenied, 
                    google_exceptions.InternalServerError,
                    google_exceptions.ServiceUnavailable) as e:
                print(f"⚠️ Key index {idx} Failed ({type(e).__name__}). Rotating...")
                continue 
                
            except Exception as e:
                print(f"⚠️ Unexpected Error with Key index {idx}: {e}. Rotating...")
                continue

        print("❌ All Gemini keys exhausted or failed. Attempting Fallback to Groq...")
        
        # FALLBACK TO GROQ
        try:
            from core.groq_handler import groq_client
            print("🔄 Switching to Groq Llama-3...")
            return groq_client.call_groq(prompt, is_chat, history)
        except Exception as e:
            print(f"❌ Fallback to Groq failed: {e}")
            return None

# Singleton instance for easy import
gemini_client = GeminiHandler()
