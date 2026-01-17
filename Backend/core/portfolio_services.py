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
    def _get_skill_icon(skill_name: str) -> str:
        """Helper to map common skills to FontAwesome icons."""
        s = skill_name.lower()
        if 'python' in s: return '<i class="fab fa-python"></i>'
        if 'js' in s or 'javascript' in s: return '<i class="fab fa-js"></i>'
        if 'react' in s: return '<i class="fab fa-react"></i>'
        if 'node' in s: return '<i class="fab fa-node"></i>'
        if 'html' in s: return '<i class="fab fa-html5"></i>'
        if 'css' in s: return '<i class="fab fa-css3-alt"></i>'
        if 'java' in s and 'script' not in s: return '<i class="fab fa-java"></i>'
        if 'git' in s: return '<i class="fab fa-git-alt"></i>'
        if 'docker' in s: return '<i class="fab fa-docker"></i>'
        if 'aws' in s: return '<i class="fab fa-aws"></i>'
        if 'android' in s: return '<i class="fab fa-android"></i>'
        if 'database' in s or 'sql' in s: return '<i class="fas fa-database"></i>'
        if 'cloud' in s: return '<i class="fas fa-cloud"></i>'
        if 'data' in s or 'ai' in s or 'ml' in s: return '<i class="fas fa-brain"></i>'
        return '<i class="fas fa-code"></i>'

    @staticmethod
    def generate_html(data: Dict[str, Any], template: str = "creative") -> str:
        """Generate complete HTML portfolio with strict template selection."""
        # Ensure data elements exist
        personal_info = data.get('personalInfo', {})
        name = personal_info.get('name', 'Portfolio')
        title = personal_info.get('title', 'Professional')
        summary = data.get('summary', '')
        skills = data.get('skills', []) if isinstance(data.get('skills'), list) else [] 
        experience = data.get('experience', [])
        projects = data.get('projects', [])
        education = data.get('education', [])
        contact = data.get('contact', {})

        # --- SKILLS SECTION ---
        skills_html = ""
        if isinstance(data.get('skills'), dict):
            # Categorized skills
            for category, skill_list in data.get('skills').items():
                if skill_list:
                    skill_tags = "".join([f'<span class="skill-tag">{PortfolioGenerator._get_skill_icon(skill)} {skill}</span>' for skill in skill_list])
                    skills_html += f"""
                    <div class="skill-category">
                        <h3>{category.replace('_', ' ').title()}</h3>
                        <div class="skills-grid">{skill_tags}</div>
                    </div>
                    """
            skills_html = f'<section id="skills" class="section"><div class="container"><h2><i class="fas fa-laptop-code"></i> Skills & Expertise</h2>{skills_html}</div></section>'
        elif skills:
            # Flat list
            skills_items = "".join([f'<span class="skill-tag">{PortfolioGenerator._get_skill_icon(skill)} {skill}</span>' for skill in skills])
            skills_html = f"""
            <section id="skills" class="section">
                <div class="container">
                    <h2><i class="fas fa-laptop-code"></i> Skills & Expertise</h2>
                    <div class="skills-grid">
                        {skills_items}
                    </div>
                </div>
            </section>
            """
        
        # --- EXPERIENCE SECTION ---
        experience_html = ""
        if experience:
            exp_items = ""
            for exp in experience:
                # Use "punchy" presentation
                desc = exp.get('description', '')
                if len(desc) > 150: desc = desc[:150] + "..." # Truncate for visual cleanliness
                
                exp_items += f"""
                <div class="experience-item">
                    <div class="exp-header">
                        <h3>{exp.get('title', '')}</h3>
                        <span class="duration"><i class="far fa-calendar-alt"></i> {exp.get('duration', '')}</span>
                    </div>
                    <h4>{exp.get('company', '')}</h4>
                    <p>{desc}</p>
                </div>
                """
            experience_html = f"""
            <section id="experience" class="section">
                <div class="container">
                    <h2><i class="fas fa-briefcase"></i> Work Experience</h2>
                    <div class="experience-list">{exp_items}</div>
                </div>
            </section>
            """

        # --- PROJECTS SECTION ---
        projects_html = ""
        if projects:
            proj_items = ""
            for proj in projects:
                techs = proj.get('technologies', [])
                tech_tags = "".join([f'<span class="tech-tag">{t}</span>' for t in techs[:4]]) # Limit tags
                
                proj_items += f"""
                <div class="project-card">
                    <div class="card-content">
                        <h3>{proj.get('name', '')}</h3>
                        <p>{proj.get('description', '')}</p>
                        <div class="tech-stack">{tech_tags}</div>
                    </div>
                    {f'<a href="{proj.get("link")}" target="_blank" class="project-link">View Project <i class="fas fa-arrow-right"></i></a>' if proj.get("link") else ''}
                </div>
                """
            projects_html = f"""
            <section id="projects" class="section">
                <div class="container">
                    <h2><i class="fas fa-rocket"></i> Featured Projects</h2>
                    <div class="projects-grid">{proj_items}</div>
                </div>
            </section>
            """

        # --- EDUCATION SECTION ---
        education_html = ""
        if education:
            edu_items = ""
            for edu in education:
                edu_items += f"""
                <div class="education-item">
                    <div class="edu-icon"><i class="fas fa-graduation-cap"></i></div>
                    <div class="edu-details">
                        <h3>{edu.get('degree', '')}</h3>
                        <h4>{edu.get('school', '')}</h4>
                        <span class="year">{edu.get('graduation_year', '') or edu.get('year', '')}</span>
                    </div>
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

        # Get CSS based on template
        css = PortfolioGenerator.generate_css(template)

        return f"""<!DOCTYPE html>
<html lang="en">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>{name} - {title}</title>
    <link href="https://fonts.googleapis.com/css2?family=Outfit:wght@300;400;500;600;700;800&family=Playfair+Display:wght@400;700&family=Space+Grotesk:wght@400;500;700&display=swap" rel="stylesheet">
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.0.0/css/all.min.css">
    <style>
        {css}
    </style>
</head>
<body class="template-{template}">
    <nav class="navbar">
        <div class="nav-container">
            <div class="nav-logo">{name}</div>
            <ul class="nav-menu">
                <li><a href="#hero">Home</a></li>
                {f'<li><a href="#skills">Skills</a></li>' if skills else ''}
                {f'<li><a href="#experience">Experience</a></li>' if experience else ''}
                {f'<li><a href="#projects">Projects</a></li>' if projects else ''}
            </ul>
        </div>
    </nav>

    <header id="hero" class="hero">
        <div class="hero-content">
            <h1 class="hero-title">{name}</h1>
            <h2 class="hero-subtitle">{title}</h2>
            <p class="hero-description">{summary}</p>
            <div class="contact-links">
                {f'<a href="mailto:{contact.get("email")}"><i class="fas fa-envelope"></i> Contact Me</a>' if contact.get("email") else ''}
                {f'<a href="{contact.get("linkedin")}" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>' if contact.get("linkedin") else ''}
                {f'<a href="{contact.get("github")}" target="_blank"><i class="fab fa-github"></i> GitHub</a>' if contact.get("github") else ''}
            </div>
            <div class="scroll-indicator">
                <div class="mouse">
                    <div class="wheel"></div>
                </div>
            </div>
        </div>
        <div class="hero-bg">
            <div class="blob blob-1"></div>
            <div class="blob blob-2"></div>
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
            <div class="social-links">
                 {f'<a href="{contact.get("linkedin")}" target="_blank"><i class="fab fa-linkedin"></i></a>' if contact.get("linkedin") else ''}
                 {f'<a href="{contact.get("github")}" target="_blank"><i class="fab fa-github"></i></a>' if contact.get("github") else ''}
                 {f'<a href="mailto:{contact.get("email")}"><i class="fas fa-envelope"></i></a>' if contact.get("email") else ''}
            </div>
            <p>&copy; {datetime.now().year} {name}. All rights reserved.</p>
        </div>
    </footer>
</body>
</html>"""

    @staticmethod
    def generate_css(template: str) -> str:
        # ANIMATIONS & FONTS
        base_css = """
        @import url('https://fonts.googleapis.com/css2?family=Space+Grotesk:wght@300;700&family=Inter:wght@400;600&family=Playfair+Display:ital,wght@0,400;1,400&display=swap');
        
        * { margin: 0; padding: 0; box-sizing: border-box; }
        body { overflow-x: hidden; width: 100%; }
        
        /* Animations */
        .reveal { opacity: 0; transform: translateY(30px); animation: reveal 0.8s forwards; }
        @keyframes reveal { to { opacity: 1; transform: translateY(0); } }
        
        /* Font Awesome Fix */
        i { margin-right: 8px; }
        """

        if template == 'creative':
            return base_css + """
            /* NEON CYBERPUNK - RADICAL CHANGE */
            :root { --bg: #050505; --text: #ffffff; --accent: #ff00ff; --accent2: #00ffff; }
            body { background: var(--bg); color: var(--text); font-family: 'Space Grotesk', sans-serif; padding: 0 0 5rem 0; }
            
            /* Add padding to container so it doesn't stick to iframe edges */
            .container, main { width: 95%; max-width: 1400px; margin: 0 auto; padding: 0 1rem; }
            
            .navbar { position: fixed; width: 100%; top: 0; padding: 1.5rem 5%; display: flex; justify-content: space-between; background: rgba(0,0,0,0.8); backdrop-filter: blur(10px); z-index: 100; border-bottom: 1px solid #333; }
            .nav-logo { font-size: 1.5rem; font-weight: bold; text-transform: uppercase; color: var(--accent); text-shadow: 2px 2px var(--accent2); }
            .nav-menu { display: flex; gap: 2rem; list-style: none; }
            .nav-menu a { color: #fff; text-decoration: none; text-transform: uppercase; letter-spacing: 2px; font-size: 0.8rem; }
            
            /* Padding for Hero */
            .hero { min-height: 100vh; display: flex; flex-direction: column; justify-content: center; padding: 100px 10%; background: radial-gradient(circle at 50% 50%, #1a001a 0%, #000 70%); text-align: left; }
            .hero-title { font-size: 5rem; line-height: 0.9; text-transform: uppercase; -webkit-text-stroke: 2px var(--text); color: transparent; margin-bottom: 1rem; }
            .hero-title:hover { color: var(--accent); -webkit-text-stroke: 0; text-shadow: 0 0 20px var(--accent); }
            .hero-subtitle { font-size: 1.5rem; color: var(--accent2); font-weight: 300; margin-bottom: 3rem; }
            
            /* Logos & Contact Links */
            .contact-links { display: flex; gap: 1.5rem; margin-top: 1rem; }
            .contact-links a { 
                display: flex; align-items: center; gap: 10px;
                color: var(--accent2); text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; 
                border: 1px solid var(--accent2); padding: 0.8rem 1.5rem; transition: 0.3s;
            }
            .contact-links a i { font-size: 1.2rem; }
            .contact-links a:hover { background: var(--accent2); color: black; box-shadow: 0 0 20px var(--accent2); }

            .section { padding: 6rem 10%; border-top: 1px solid #222; }
            h2 { font-size: 3rem; margin-bottom: 3rem; color: var(--text); text-transform: uppercase; letter-spacing: -2px; border-left: 5px solid var(--accent); padding-left: 20px; }
            
            .experience-item { border-left: 2px solid #333; padding-left: 2rem; margin-bottom: 3rem; position: relative; }
            .experience-item::before { content: ''; position: absolute; left: -6px; top: 0; width: 10px; height: 10px; background: var(--accent2); border-radius: 50%; box-shadow: 0 0 10px var(--accent2); }
            .experience-item h3 { color: var(--accent); margin-bottom: 0.5rem; font-size: 1.5rem; }
            .experience-item h4 { color: #888; margin-bottom: 1rem; font-size: 1rem; }
            
            .skills-grid { display: flex; flex-wrap: wrap; gap: 1.5rem; }
            .skill-tag { background: rgba(255, 0, 255, 0.1); border: 1px solid var(--accent); color: var(--accent); padding: 0.5rem 1rem; text-transform: uppercase; font-size: 0.8rem; letter-spacing: 1px; }
            
            .projects-grid { display: grid; grid-template-columns: repeat(auto-fit, minmax(300px, 1fr)); gap: 2rem; }
            .project-card { background: #111; border: 1px solid #333; padding: 2rem; transition: 0.3s; position: relative; }
            .project-card h3 { font-size: 1.5rem; margin-bottom: 1rem; color: #fff; }
            .project-card:hover { border-color: var(--accent2); box-shadow: 0 0 20px rgba(0, 255, 255, 0.2); transform: translateY(-5px); }
            .tech-stack { margin-top: 1rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
            .tech-tag { font-size: 0.7rem; background: #222; color: #aaa; padding: 0.2rem 0.6rem; }
            
            .project-link { display: inline-block; margin-top: 1.5rem; color: var(--accent2); text-decoration: none; font-weight: bold; text-transform: uppercase; letter-spacing: 1px; border-bottom: 1px solid var(--accent2); }
            
            footer { padding: 4rem; text-align: center; color: #555; background: #000; border-top: 1px solid #222; }
            .social-links a { color: #fff; margin: 0 1rem; font-size: 1.5rem; }
            /* Scroll Indicator - Neon */
            .mouse { width: 30px; height: 50px; border: 2px solid var(--accent); border-radius: 20px; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); }
            .wheel { width: 4px; height: 8px; background: var(--accent); border-radius: 2px; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); animation: scroll 1.5s infinite; }
            @keyframes scroll { 0% { opacity: 1; top: 10px; } 100% { opacity: 0; top: 30px; } }
            """
        
        elif template == 'modern':
            return base_css + """
            /* SWISS MINIMAL - STARK BLACK & WHITE */
            :root { --bg: #ffffff; --text: #000000; --gray: #f4f4f4; }
            body { background: var(--bg); color: var(--text); font-family: 'Inter', sans-serif; padding: 0 0 5rem 0; }
            
            /* Container Padding */
            .container, main { width: 95%; max-width: 1400px; margin: 0 auto; padding: 0 1rem; }
            
            /* Animations */
            @keyframes slideUp { from { transform: translateY(50px); opacity: 0; } to { transform: translateY(0); opacity: 1; } }
            @keyframes scaleIn { from { transform: scale(0.9); opacity: 0; } to { transform: scale(1); opacity: 1; } }
            
            .navbar { padding: 2rem 5%; border-bottom: 4px solid black; display: flex; justify-content: space-between; align-items: center; position: sticky; top: 0; background: white; z-index: 100; }
            .nav-logo { font-size: 1.5rem; font-weight: 900; letter-spacing: -1px; background: black; color: white; padding: 0.5rem 1rem; }
            .nav-menu { display: flex; gap: 2rem; list-style: none; }
            .nav-menu a { color: black; text-decoration: none; font-weight: 600; text-transform: uppercase; font-size: 0.9rem; transition: 0.3s; }
            .nav-menu a:hover { text-decoration: underline; text-underline-offset: 4px; }
            
            .hero { padding: 5rem 5%; min-height: 70vh; display: flex; flex-direction: column; justify-content: center; } /* Reduced padding/height */
            .hero-title { font-size: 5rem; font-weight: 900; letter-spacing: -3px; line-height: 1; margin-bottom: 1.5rem; max-width: 1000px; animation: slideUp 0.8s ease-out; }
            .hero-subtitle { font-size: 1.5rem; font-weight: 400; color: #555; max-width: 600px; line-height: 1.4; border-left: 4px solid black; padding-left: 1.5rem; animation: slideUp 0.8s ease-out 0.2s backwards; }
            
            /* Logos & Contact Links (Modern Pill Style) */
            .contact-links { display: flex; justify-content: flex-start; gap: 1rem; margin-top: 2.5rem; flex-wrap: wrap; animation: slideUp 0.8s ease-out 0.4s backwards; }
            .contact-links a { 
                background: #000; color: white; padding: 1rem 2.5rem; border-radius: 50px; text-decoration: none; font-weight: 600; transition: 0.3s; 
                display: flex; align-items: center; gap: 10px; font-size: 1rem;
            }
            .contact-links a i { font-size: 1.1rem; }
            .contact-links a:hover { transform: translateY(-3px); box-shadow: 0 8px 16px rgba(0,0,0,0.15); background: #333; }

            .section { padding: 4rem 5%; } /* Reduced padding */
            /* Grid Layout - Fixed width for header to prevent overlap */
            .container { display: grid; grid-template-columns: 220px 1fr; gap: 3rem; border-top: 4px solid black; padding-top: 3rem; }
            h2 { grid-column: 1; font-size: 2.5rem; font-weight: 900; text-transform: uppercase; line-height: 1; margin-bottom: 2rem; } /* Removed sticky */
            
            .skills-grid, .experience-list, .projects-grid, .education-list, .skill-category { grid-column: 2; }
            
            /* Fixed Skills Grid - Modern */
            .skill-category { margin-bottom: 2rem; }
            .skill-category h3 { font-size: 1.2rem; margin-bottom: 1rem; font-weight: 700; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; color: #444; }
            .skills-grid { display: flex; flex-wrap: wrap; gap: 10px; }
            .skill-tag { 
                border: 2px solid black; padding: 0.6rem 1.4rem; display: inline-flex; align-items: center; gap: 8px;
                border-radius: 100px; font-weight: 700; font-size: 0.9rem; background: white; color: black; transition: 0.2s; 
            }
            .skill-tag i { font-size: 1rem; }
            .skill-tag:hover { background: black; color: white; transform: scale(1.05); cursor: default; }
            
            .experience-item { margin-bottom: 4rem; animation: scaleIn 0.5s ease-out; }
            .experience-item h3 { font-size: 2.2rem; margin-bottom: 0.4rem; font-weight: 800; letter-spacing: -1px; }
            .experience-item h4 { font-size: 1.1rem; font-weight: 500; border-bottom: 2px solid #eee; padding-bottom: 0.5rem; margin-bottom: 1rem; display: inline-block; color: #555; }
            .experience-item p { font-size: 1.1rem; line-height: 1.6; color: #333; max-width: 800px; }
            
            .project-card { background: var(--gray); padding: 3rem; margin-bottom: 2.5rem; transition: 0.3s; border-radius: 24px; animation: scaleIn 0.5s ease-out; }
            .project-card:hover { background: black; color: white; transform: scale(1.01); }
            .project-card h3 { font-size: 2rem; font-weight: 800; margin-bottom: 0.8rem; letter-spacing: -1px; }
            .project-card p { font-size: 1.1rem; margin-bottom: 1.5rem; }
            .project-card:hover .tech-tag { border-color: white; color: white; }
            .project-card:hover .project-link { color: white; }
            
            .tech-stack { display: flex; flex-wrap: wrap; gap: 8px; margin-bottom: 1.5rem; }
            .tech-tag { border: 2px solid black; padding: 0.4rem 0.8rem; display: inline-block; border-radius: 6px; font-size: 0.8rem; font-weight: 700; text-transform: uppercase; }
            
            .project-link { display: inline-flex; align-items: center; gap: 8px; margin-top: 0.5rem; color: black; text-decoration: none; font-weight: 900; font-size: 1rem; text-transform: uppercase; border-bottom: 3px solid currentColor; padding-bottom: 2px; }
            
            footer { padding: 6rem 5%; background: black; color: white; text-align: left; }
            .social-links { display: flex; gap: 1.5rem; margin-bottom: 1.5rem; }
            .social-links a { color: white; font-size: 2rem; transition: 0.3s; }
            .social-links a:hover { color: #888; transform: scale(1.1); }
            
            @media (max-width: 1100px) { 
                .container { grid-template-columns: 1fr; gap: 2rem; } 
                h2 { margin-bottom: 1.5rem; border-bottom: 1px solid #000; padding-bottom: 1rem; display: inline-block; }
                .hero-title { font-size: 3.5rem; }
                .hero { padding: 4rem 5%; min-height: auto; }
            }
            .mouse { width: 30px; height: 50px; border: 2px solid black; border-radius: 20px; position: absolute; bottom: 30px; left: 50%; transform: translateX(-50%); }
            .wheel { width: 4px; height: 8px; background: black; border-radius: 2px; position: absolute; top: 10px; left: 50%; transform: translateX(-50%); animation: scroll 1.5s infinite; }
            @keyframes scroll { 0% { opacity: 1; top: 10px; } 100% { opacity: 0; top: 30px; } }
            """

        elif template == 'professional':
            return base_css + """
            /* EDITORIAL - SERIF & PAPER */
            :root { --primary: #1a1a1a; --accent: #8c2f1b; --text: #333; --bg: #fcfbf9; }
            body { font-family: 'Playfair Display', serif; background: #fcfbf9; color: #333; background-image: linear-gradient(#e5e5e5 1px, transparent 1px); background-size: 40px 40px; padding: 0 0 5rem 0; }
            
            /* Add padding to container so it doesn't stick to iframe edges */
            .container, main { width: 95%; max-width: 1000px; margin: 0 auto; padding: 0 1rem; }
            
            .navbar { padding: 3rem 0; text-align: center; border-bottom: 1px solid #d4d4d4; max-width: 1000px; margin: 0 auto; }
            .nav-logo { font-size: 2.5rem; font-style: italic; font-weight: 700; color: var(--accent); }
            .nav-menu { justify-content: center; gap: 3rem; margin-top: 1.5rem; display: flex; list-style: none; }
            .nav-menu a { font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 0.75rem; letter-spacing: 2px; color: #444; text-decoration: none; font-weight: 600; }
            
            .hero { padding: 8rem 1rem; text-align: center; max-width: 900px; margin: 0 auto; border-bottom: 1px double #ddd; }
            .hero-title { font-size: 5rem; font-style: italic; margin-bottom: 1rem; color: #000; animation: fadeInUp 1s ease-out; }
            .hero-subtitle { font-family: 'Inter', sans-serif; font-size: 1.2rem; text-transform: uppercase; letter-spacing: 3px; color: #666; margin-bottom: 3rem; animation: fadeInUp 1s ease-out 0.2s backwards; }
            
            /* Logos & Contact Links (Editorial Style) */
            .contact-links { display: flex; justify-content: center; gap: 2rem; margin-top: 2rem; }
            .contact-links a { 
                color: #000; border-bottom: 2px solid #000; padding-bottom: 2px; text-decoration: none; font-family: 'Inter', sans-serif; font-weight: 600; font-size: 0.9rem; text-transform: uppercase; 
                display: flex; align-items: center; gap: 8px;
            }
            .contact-links a i { font-size: 1rem; }
            .contact-links a:hover { background: #000; color: #fff; padding: 0.2rem 0.5rem; }

            .section { border-bottom: 1px solid #000; padding: 6rem 0; background: #fff; }
            h2 { font-size: 2.2rem; text-align: center; margin-bottom: 4rem; font-style: italic; font-weight: 400; color: #444; }
            
            .experience-item { border-left: 4px solid #000; padding-left: 3rem; background: none; border-radius: 0; margin-bottom: 3rem; }
            .experience-item h3 { font-family: 'Playfair Display', serif; font-size: 1.8rem; font-style: italic; }
            .experience-item h4 { font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 0.9rem; letter-spacing: 1px; }
            
            .project-card { background: white; border: 2px solid #000; border-radius: 0; box-shadow: 8px 8px 0 #000; transition: 0.2s; padding: 2.5rem; margin-bottom: 2rem; }
            .project-card:hover { transform: translate(-4px, -4px); box-shadow: 12px 12px 0 #000; }
            
            /* FIXED SKILLS GRID */
            .skills-grid { display: flex; flex-wrap: wrap; justify-content: center; gap: 1rem; margin-top: 1rem; }
            .skill-tag { 
                border: 1px solid #000; color: #000; background: #fff;
                font-family: 'Inter', sans-serif; text-transform: uppercase; font-size: 0.8rem; font-weight: 700; letter-spacing: 1px;
                padding: 0.6rem 1.2rem; display: inline-flex; align-items: center; gap: 8px;
                transition: 0.2s;
            }
            .skill-tag:hover { background: #000; color: #fff; }

            .tech-stack { justify-content: center; margin-top: 1.5rem; display: flex; flex-wrap: wrap; gap: 0.5rem; }
            .tech-tag { background: #eee; font-family: monospace; padding: 0.2rem 0.6rem; font-size: 0.8rem; }
            
            footer { padding: 5rem 0; text-align: center; font-family: 'Inter', sans-serif; font-size: 0.8rem; color: #888; text-transform: uppercase; letter-spacing: 1px; }
            
            @media (max-width: 768px) { .experience-item { grid-template-columns: 1fr; gap: 1rem; } .hero-title { font-size: 3rem; } }
            .scroll-indicator { display: none; } /* Hide on professional */
            """
        
        return base_css

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
    ROLE: Expert Resume Architect.
    TASK: Convert resume text into JSON for a portfolio website.
    
    RESUME TEXT:
    {text_content[:8000]}
    
    INSTRUCTIONS:
    1.  **SUMMARY**: Create a high-energy, professional 2-sentence summary. Use terms like "Results-driven Engineer" or "Creative Designer".
    2.  **SKILLS**: EXTRACT ALL TECHNICAL SKILLS FOUND. Do not leave any relevant tool or language out. Group them intelligently.
        -   Suggested Categories: "Frontend", "Backend", "Languages", "Tools & DevOps", "Cloud", "AI & Data", "Mobile", "Soft Skills".
        -   If a skill fits multiple, pick the best one.
    3.  **EXPERIENCE**: MAX 2-3 BULLETS per role. Keep them concise and impact-focused (e.g., "reduced latency by 40%").
    4.  **PROJECTS**: Short names, 1-sentence descriptions.
    
    OUTPUT JSON FORMAT:
    {{
      "personalInfo": {{ "name": "...", "title": "...", "email": "...", "linkedin": "...", "github": "..." }},
      "summary": "...",
      "skills": {{ "Languages": ["Python", "Java"], "Frontend": ["React", "HTML5"], "Backend": ["Node.js"], "Tools": ["Git", "Docker"] }},
      "experience": [ {{ "title": "...", "company": "...", "duration": "...", "description": "• Bullet 1\\n• Bullet 2" }} ],
      "projects": [ {{ "name": "...", "description": "...", "technologies": ["..."], "link": "..." }} ],
      "education": [ {{ "degree": "...", "school": "...", "graduation_year": "..." }} ],
      "contact": {{ "email": "...", "linkedin": "...", "github": "..." }}
    }}
    """
    response = _call_gemini_with_fallback(prompt)
    if not response:
        raise HTTPException(status_code=500, detail="AI extraction failed")
    
    data = _safe_json_loads(response.text)
    if not data:
        raise HTTPException(status_code=500, detail="AI returned invalid JSON")
        
    return data
