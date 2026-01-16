import os
import json
from typing import Optional, Dict, Any
from groq import Groq

# Backend/core/portfolio_core.py

def generate_portfolio_website(resume_json: Dict[str, Any]) -> Optional[str]:
    try:
        resume_str = json.dumps(resume_json, indent=2)
        prompt = f"""
        You are an expert frontend developer. Create a stunning, responsive, single-file 
        Personal Portfolio Website based on the user's resume data:
        {resume_str}
        
        Requirements:
        1. Use HTML5, CSS3, and JavaScript. Use Tailwind CSS via CDN.
        2. Output ONLY the raw HTML code. Do not include markdown code blocks.
        """
        
        client = Groq(api_key=os.getenv("GROQ_API_KEY"))
        chat_completion = client.chat.completions.create(
            messages=[{"role": "user", "content": prompt}],
            # UPDATED: Use a currently supported model
            model="llama-3.3-70b-versatile", 
        )
        return chat_completion.choices[0].message.content.strip()
    except Exception as e:
        print(f"Error in Groq Generation: {e}")
        return None