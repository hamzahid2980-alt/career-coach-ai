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
        self.api_key = os.getenv("GROQ_API_KEY")
        self.client = None
        self.model_name = "llama-3.3-70b-versatile" # High performance model
        
        if self.api_key:
            try:
                self.client = Groq(api_key=self.api_key)
                print("✅ GroqHandler initialized successfully.")
            except Exception as e:
                print(f"❌ Failed to initialize Groq client: {e}")
        else:
            print("❌ GROQ_API_KEY not found in .env")

    def call_groq(self, prompt: str, is_chat: bool = False, history: List = None) -> Optional[Any]:
        """
        Executes a Groq API call.
        Returns an object compatible with the expected response structure (response.text).
        """
        if not self.client:
            print("❌ Groq Client not available.")
            return None

        try:
            # Construct messages
            messages = []
            if history:
                # limited history support for now, simple transformation
                for h in history:
                    role = "user" if h.get("role") == "user" else "assistant"
                    messages.append({"role": role, "content": h.get("parts", [""])[0]})
            
            messages.append({"role": "user", "content": prompt})

            completion = self.client.chat.completions.create(
                messages=messages,
                model=self.model_name,
                temperature=0.3,
                max_tokens=2048,
            )
            
            # Wrap response to match Gemini's 'response.text' interface
            class MockResponse:
                def __init__(self, text):
                    self.text = text
            
            return MockResponse(completion.choices[0].message.content)

        except Exception as e:
            print(f"❌ Groq API Error: {e}")
            return None

# Singleton instance
groq_client = GroqHandler()
