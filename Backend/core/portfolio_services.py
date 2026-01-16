import os
import re
import json
import base64
import requests
import hashlib
from datetime import datetime
from typing import Dict, Any, Optional, List
from fastapi import HTTPException
from core.ai_core import _call_gemini_with_fallback, _safe_json_loads

# Configuration
GITHUB_API_BASE = "https://api.github.com"
GITHUB_TOKEN = os.getenv("GITHUB_TOKEN")
GITHUB_USERNAME = os.getenv("GITHUB_USERNAME")
REPO_NAME = os.getenv("REPO_NAME", "auto-portfolios")

class PortfolioGenerator:
    @staticmethod
    def generate_html(data: Dict[str, Any]) -> str:
        """Generate complete HTML portfolio"""
        # Ensure data elements exist
        personal_info = data.get('personalInfo', {})
        name = personal_info.get('name', 'Portfolio')
        title = personal_info.get('title', 'Professional')
        summary = data.get('summary', '')
        skills = data.get('skills', []) if isinstance(data.get('skills'), list) else [] # Handle if it comes as dict
        experience = data.get('experience', [])
        projects = data.get('projects', [])
        education = data.get('education', [])
        contact = data.get('contact', {})

        # Normalize skills if it's a dict (from new prompt) to list for display, or handle categories
        skills_html = ""
        if isinstance(skills, dict):
            # Categorized skills
            for category, skill_list in skills.items():
                if skill_list:
                    skill_tags = "".join([f'<span class="skill-tag">{skill}</span>' for skill in skill_list])
                    skills_html += f"""
                    <div class="skill-category">
                        <h3>{category.replace('_', ' ').title()}</h3>
                        <div class="skills-grid">{skill_tags}</div>
                    </div>
                    """
            skills_html = f'<section id="skills" class="section"><div class="container"><h2>Skills</h2>{skills_html}</div></section>'
        elif skills:
            # Flat list
            skills_items = "".join([f'<span class="skill-tag">{skill}</span>' for skill in skills])
            skills_html = f"""
            <section id="skills" class="section">
                <div class="container">
                    <h2>Skills</h2>
                    <div class="skills-grid">
                        {skills_items}
                    </div>
                </div>
            </section>
            """
        
        # ... (Rest of HTML generation similar to original, tailored for the template) ...
        # I'll use a simplified version of what was in the main.py but ensures it works with the data structure
        
        # Experience
        experience_html = ""
        if experience:
            exp_items = ""
            for exp in experience:
                exp_items += f"""
                <div class="experience-item">
                    <h3>{exp.get('title', '')}</h3>
                    <h4>{exp.get('company', '')}</h4>
                    <span class="duration">{exp.get('duration', '')}</span>
                    <p>{exp.get('description', '')}</p>
                </div>
                """
            experience_html = f"""
            <section id="experience" class="section">
                <div class="container">
                    <h2>Experience</h2>
                    <div class="experience-list">{exp_items}</div>
                </div>
            </section>
            """

        # Projects
        projects_html = ""
        if projects:
            proj_items = ""
            for proj in projects:
                techs = proj.get('technologies', [])
                tech_tags = "".join([f'<span class="tech-tag">{t}</span>' for t in techs])
                proj_items += f"""
                <div class="project-card">
                    <h3>{proj.get('name', '')}</h3>
                    <p>{proj.get('description', '')}</p>
                    <div class="tech-stack">{tech_tags}</div>
                    {f'<a href="{proj.get("link")}" target="_blank">View Project</a>' if proj.get("link") else ''}
                </div>
                """
            projects_html = f"""
            <section id="projects" class="section">
                <div class="container">
                    <h2>Projects</h2>
                    <div class="projects-grid">{proj_items}</div>
                </div>
            </section>
            """

        # Education
        education_html = ""
        if education:
            edu_items = ""
            for edu in education:
                edu_items += f"""
                <div class="education-item">
                    <h3>{edu.get('degree', '')}</h3>
                    <h4>{edu.get('school', '')}</h4>
                    <span class="year">{edu.get('graduation_year', '') or edu.get('year', '')}</span>
                </div>
                """
            education_html = f"""
            <section id="education" class="section">
                <div class="container">
                    <h2>Education</h2>
                    <div class="education-list">{edu_items}</div>
                </div>
            </section>
            """

        # Contact
        contact_html = ""
        # ... logic to build contact section ...
        
        # CSS (Inline for single file portability)
        css = PortfolioGenerator.generate_css()

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name} - {title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@300;400;500;600;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        {css}
    </style>
</head>
<body>
    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-logo">{name}</div>
            <ul class="nav-menu">
                <li><a href="#hero">Home</a></li>
                {f'<li><a href="#skills">Skills</a></li>' if skills else ''}
                {f'<li><a href="#experience">Experience</a></li>' if experience else ''}
                {f'<li><a href="#projects">Projects</a></li>' if projects else ''}
                {f'<li><a href="#education">Education</a></li>' if education else ''}
            </ul>
        </div>
    </nav>

    <header id="hero" class="hero">
        <div class="hero-content">
            <h1 class="hero-title">{name}</h1>
            <h2 class="hero-subtitle">{title}</h2>
            <p class="hero-description">{summary}</p>
            <div class="contact-links">
                {f'<a href="mailto:{contact.get("email")}"><i class="fas fa-envelope"></i> Email</a>' if contact.get("email") else ''}
                {f'<a href="{contact.get("linkedin")}" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>' if contact.get("linkedin") else ''}
                {f'<a href="{contact.get("github")}" target="_blank"><i class="fab fa-github"></i> GitHub</a>' if contact.get("github") else ''}
            </div>
        </div>
    </header>

    <main>
        {skills_html}
        {experience_html}
        {projects_html}
        {education_html}
    </main>

    <footer>
        <div class="container">
            <p>&copy; {datetime.now().year} {name}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>"""

    @staticmethod
    def generate_css() -> str:
        return """
        :root { --primary: #6366f1; --secondary: #a855f7; --dark: #0f172a; --light: #f8fafc; }
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { font-family: 'Inter', sans-serif; background: var(--dark); color: var(--light); line-height: 1.6; }
        .container { max-width: 1200px; margin: 0 auto; padding: 0 2rem; }
        
        /* Nav */
        .navbar { position: fixed; top: 0; width: 100%; background: rgba(15, 23, 42, 0.9); backdrop-filter: blur(10px); z-index: 1000; border-bottom: 1px solid rgba(255,255,255,0.1); padding: 1rem 0; }
        .nav-container { display: flex; justify-content: space-between; align-items: center; }
        .nav-logo { font-size: 1.5rem; font-weight: 700; color: white; }
        .nav-menu { display: flex; list-style: none; gap: 2rem; }
        .nav-menu a { color: #94a3b8; text-decoration: none; transition: 0.3s; }
        .nav-menu a:hover { color: white; }

        /* Hero */
        .hero { min-height: 100vh; display: flex; align-items: center; justify-content: center; text-align: center; background: radial-gradient(circle at top right, rgba(99, 102, 241, 0.15), transparent 40%), radial-gradient(circle at bottom left, rgba(168, 85, 247, 0.15), transparent 40%); padding-top: 80px; }
        .hero-title { font-size: 4rem; font-weight: 800; background: linear-gradient(to right, #c084fc, #6366f1); -webkit-background-clip: text; -webkit-text-fill-color: transparent; margin-bottom: 1rem; }
        .hero-subtitle { font-size: 1.5rem; color: #cbd5e1; margin-bottom: 2rem; font-weight: 400; }
        .hero-description { max-width: 600px; margin: 0 auto 2rem; color: #94a3b8; font-size: 1.1rem; }
        .contact-links { display: flex; gap: 1rem; justify-content: center; }
        .contact-links a { display: inline-flex; align-items: center; gap: 0.5rem; padding: 0.75rem 1.5rem; background: rgba(255,255,255,0.1); border-radius: 9999px; color: white; text-decoration: none; transition: 0.3s; border: 1px solid rgba(255,255,255,0.1); }
        .contact-links a:hover { background: rgba(255,255,255,0.2); transform: translateY(-2px); }

        /* Sections */
        .section { padding: 5rem 0; }
        h2 { font-size: 2.5rem; margin-bottom: 3rem; text-align: center; }
        
        /* Skills */
        .skill-category { margin-bottom: 2rem; }
        .skill-category h3 { margin-bottom: 1rem; color: #cbd5e1; }
        .skills-grid { display: flex; flex-wrap: wrap; gap: 0.75rem; justify-content: center; }
        .skill-tag { padding: 0.5rem 1rem; background: rgba(99, 102, 241, 0.1); color: #818cf8; border-radius: 8px; border: 1px solid rgba(99, 102, 241, 0.2); }

        /* Experience */
        .experience-list { max-width: 800px; margin: 0 auto; display: grid; gap: 2rem; }
        .experience-item { padding: 2rem; background: rgba(30, 41, 59, 0.5); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); transition: 0.3s; }
        .experience-item:hover { transform: translateY(-5px); border-color: rgba(99, 102, 241, 0.3); }
        .experience-item h3 { font-size: 1.25rem; color: white; margin-bottom: 0.5rem; }
        .experience-item h4 { color: #94a3b8; margin-bottom: 0.5rem; }
        .duration { display: block; font-size: 0.9rem; color: #64748b; margin-bottom: 1rem; }
        
        /* Projects */
        .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
        .project-card { padding: 2rem; background: rgba(30, 41, 59, 0.5); border-radius: 16px; border: 1px solid rgba(255,255,255,0.05); display: flex; flex-direction: column; gap: 1rem; }
        .tech-stack { display: flex; flex-wrap: wrap; gap: 0.5rem; margin-top: auto; }
        .tech-tag { font-size: 0.8rem; padding: 0.25rem 0.75rem; background: rgba(255,255,255,0.05); border-radius: 999px; }
        .project-card a { color: var(--primary); text-decoration: none; margin-top: 1rem; display: inline-block; }

        /* Education */
        .education-list { display: grid; gap: 1.5rem; max-width: 800px; margin: 0 auto; }
        .education-item { display: flex; justify-content: space-between; align-items: center; padding: 1.5rem; background: rgba(30, 41, 59, 0.3); border-radius: 12px; }
        .year { color: #64748b; font-family: monospace; }
        
        footer { padding: 3rem 0; text-align: center; color: #64748b; border-top: 1px solid rgba(255,255,255,0.05); margin-top: 5rem; }
        
        @media (max-width: 768px) {
            .hero-title { font-size: 2.5rem; }
            .nav-menu { display: none; }
        }
        """

class GitHubPublisher:
    def __init__(self):
        self.token = GITHUB_TOKEN
        self.username = GITHUB_USERNAME
        self.repo = REPO_NAME
        self.headers = {
            "Authorization": f"token {self.token}",
            "Accept": "application/vnd.github.v3+json",
            "Content-Type": "application/json"
        }
    
    def sanitize_slug(self, input_slug: str) -> str:
        """Create a safe slug for GitHub Pages"""
        slug = re.sub(r'[^a-zA-Z0-9\-_]', '', input_slug.lower())
        if slug and not slug[0].isalpha():
            slug = f"portfolio-{slug}"
        if len(slug) < 3:
            slug = f"portfolio-{hashlib.md5(input_slug.encode()).hexdigest()[:8]}"
        return slug
    
    def check_portfolio_exists(self, slug: str) -> bool:
        try:
            url = f"{GITHUB_API_BASE}/repos/{self.username}/{self.repo}/contents/portfolios/{slug}"
            response = requests.get(url, headers=self.headers)
            return response.status_code == 200
        except:
            return False

    def ensure_repo_exists(self):
        try:
            url = f"{GITHUB_API_BASE}/repos/{self.username}/{self.repo}"
            response = requests.get(url, headers=self.headers)
            
            if response.status_code == 404:
                create_url = f"{GITHUB_API_BASE}/user/repos"
                repo_data = {
                    "name": self.repo,
                    "description": "Auto-generated portfolios",
                    "private": False,
                    "has_pages": True
                }
                requests.post(create_url, headers=self.headers, json=repo_data)
                # Enable pages logic here if needed, but usually handled by user or separated
            return True
        except:
            return False

    def publish(self, slug: str, html_content: str) -> str:
        """Publishes the HTML content to the repository and returns the live URL."""
        if not self.token:
            raise HTTPException(status_code=500, detail="GitHub Token not configured")

        self.ensure_repo_exists()
        
        # 1. Create unique slug
        final_slug = self.sanitize_slug(slug)
        if self.check_portfolio_exists(final_slug):
             final_slug = f"{final_slug}-{hashlib.md5(datetime.now().isoformat().encode()).hexdigest()[:4]}"

        # 2. Upload file
        file_path = f"portfolios/{final_slug}/index.html"
        url = f"{GITHUB_API_BASE}/repos/{self.username}/{self.repo}/contents/{file_path}"
        encoded_content = base64.b64encode(html_content.encode('utf-8')).decode('utf-8')
        
        data = {
            "message": f"Publish portfolio for {final_slug}",
            "content": encoded_content
        }
        
        response = requests.put(url, headers=self.headers, json=data)
        if response.status_code not in [200, 201]:
             raise HTTPException(status_code=500, detail=f"Failed to upload to GitHub: {response.text}")
        
        # 3. Return Pages URL
        return f"https://{self.username}.github.io/{self.repo}/portfolios/{final_slug}/"

def get_portfolio_data_from_gemini(text_content: str) -> Dict[str, Any]:
    prompt = f"""
    EXTRACT DETAILS FOR A PORTFOLIO WEBSITE.
    
    Resume Content:
    {text_content}
    
    Return a JSON object with this exact structure:
    {{
      "personalInfo": {{ "name": "", "title": "", "email": "", "linkedin": "", "github": "" }},
      "summary": "Professional summary...",
      "skills": {{ 
         "Frontend": ["React", "CSS"], 
         "Backend": ["Python"],
         "Tools": ["Git"]
      }},
      "experience": [
        {{ "title": "", "company": "", "duration": "", "description": "" }}
      ],
      "projects": [
        {{ "name": "", "description": "", "technologies": ["Tech1", "Tech2"], "link": "" }}
      ],
      "education": [
        {{ "degree": "", "school": "", "graduation_year": "" }}
      ],
      "contact": {{ "email": "", "linkedin": "", "github": "" }}
    }}
    """
    response = _call_gemini_with_fallback(prompt)
    if not response:
        raise HTTPException(status_code=500, detail="AI extraction failed")
    
    data = _safe_json_loads(response.text)
    if not data:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
        
    return data
