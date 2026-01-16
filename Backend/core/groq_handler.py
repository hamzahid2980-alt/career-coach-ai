import os
from groq import Groq
from dotenv import load_dotenv
from typing import Optional, Any, List

load_dotenv()

class GroqHandler:
    _instance = None
    
    def __new__(cls):
        if cls._instance is None:
            cls._instance = super(GroqHandler, cls).__new__(cls)
            cls._instance._initialize()
        return cls._instance

    def _initialize(self):
        self.api_keys = []
        self.model_name = "llama-3.3-70b-versatile"
        
        # 1. Try new comma-separated format
        keys_str = os.getenv("GROQ_API_KEYS")
        if keys_str:
            self.api_keys = [k.strip() for k in keys_str.split(',') if k.strip()]
        
        # 2. Fallback to single key
        if not self.api_keys:
            single = os.getenv("GROQ_API_KEY")
            if single:
                self.api_keys.append(single)
                
        if self.api_keys:
            print(f"✅ GroqHandler initialized with {len(self.api_keys)} keys.")
        else:
            print("❌ No GROQ_API_KEYS found in .env")

    def call_groq(self, prompt: str, is_chat: bool = False, history: List = None) -> Optional[Any]:
        """
        Executes a Groq API call with key rotation.
        """
        if not self.api_keys:
            print("❌ Groq Client not configured.")
            return None

        for i, key in enumerate(self.api_keys):
            try:
                # Initialize client with current key
                client = Groq(api_key=key)
                
                # Construct messages
                messages = []
                if history:
                    for h in history:
                        role = "user" if h.get("role") == "user" else "assistant"
                        messages.append({"role": role, "content": h.get("parts", [""])[0]})
                
                messages.append({"role": "user", "content": prompt})

                completion = client.chat.completions.create(
                    messages=messages,
                    model=self.model_name,
                    temperature=0.3,
                    max_tokens=2048,
                )
                
                # Mock Wrapper for Compatibility
                class MockResponse:
                    def __init__(self, text):
                        self.text = text
                
                return MockResponse(completion.choices[0].message.content)

            except Exception as e:
                print(f"⚠️ Groq Key #{i+1} Failed: {e}. Rotating...")
                continue
        
        print("❌ All Groq keys exhausted.")
        return None

# Singleton instance
groq_client = GroqHandler()
