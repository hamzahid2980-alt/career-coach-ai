# 🚀 AI Career Coach: Personalized Career and Skills Advisor

<p align="center">
  <strong>Stop guessing. Start building. AI-powered career roadmaps that turn your ambition into achievement.</strong>
</p>

<p align="center">
  <img src="https://img.shields.io/badge/Status-Live-brightgreen.svg" alt="Status"/>
  <img src="https://img.shields.io/badge/AI-Google%20Gemini%202.5-4285F4.svg" alt="Gemini API"/>
  <img src="https://img.shields.io/badge/Backend-FastAPI-009688.svg" alt="FastAPI"/>
  <img src="https://img.shields.io/badge/Frontend-Vanilla%20JS-F7DF1E.svg" alt="JavaScript"/>
  <img src="https://img.shields.io/badge/Database-Firebase-FFCA28.svg" alt="Firebase"/>
  <img src="https://img.shields.io/badge/License-MIT-green.svg" alt="License"/>
</p>

---

### ► The Problem: The Career Maze

The modern career landscape is a maze of endless options, emerging technologies, and generic advice. Students and professionals are left feeling lost, unprepared, and stuck with static, one-size-fits-all career plans. This creates a painful gap between talent and opportunity.

### ► Our Solution: A Personalized GPS for Your Career

**AI Career Coach** is an intelligent, end-to-end platform that acts as your personal career advisor. Powered by **Google Gemini**, it moves beyond generic suggestions to deliver a dynamic, actionable, and deeply personalized strategy to help you land your dream job, faster.

---
<h2 id="live-demo">🌐 Live Demo</h2>

Experience the AI Career Coach live in action! The latest version is deployed and available for you to test.

> **🚀[ Launch AI Career Coach](https://aicareer-coach.github.io/AI-Career-coach/)**
>
> *Note: The backend is hosted on Render's free tier, so the first request might take a moment to wake up the server. Please be patient!*

---
---
## 📋 Table of Contents

1.  [Key Capabilities](#key-capabilities)
2.  [Project File Structure](#project-file-structure)
3.  [Technology & Architecture](#technology-architecture)
4.  [Future Roadmap](#future-roadmap)
5.  [Getting Started: Setup and Installation](#getting-started)
    *   [Prerequisites](#prerequisites)
    *   [1. Clone the Repository](#1-clone-the-repository)
    *   [2. Backend Setup (FastAPI)](#2-backend-setup-fastapi)
    *   [3. Frontend Setup (Vanilla JS)](#3-frontend-setup-vanilla-js)
6.  [License](#license)

<h2 id="key-capabilities">✨ Key Capabilities</h2>

> ### 🗺️ Generate Your Dynamic Career Roadmap
> Forget rigid plans. Input your goal, and our AI crafts a personalized 3, 6, or 12-month roadmap. It's an adaptive timeline complete with curated courses, hands-on projects, and priority skills that evolves with your progress.

> ### 📄 Build a Winning Resume & LinkedIn Profile
> Get ahead of the competition. Our AI analyzes your resume, provides an ATS-compliance score, and generates powerful, keyword-optimized bullet points to ensure your profile gets noticed by recruiters.

> ### 🧩 Uncover & Eliminate Your Skill Gaps
> Know exactly where you stand. Beyond simple keyword matching, the platform performs a deep analysis of your skills against your target role, highlighting your strengths and providing a clear path to bridge any gaps.

> ### 💼 Find Jobs That Are a Perfect Match
> Stop the endless scrolling. We use the Adzuna API to intelligently match your unique profile to the top 7 verified job openings, curated just for you based on your skills, experience, and location preferences.

> ### 🎙️ Ace Your Interviews with AI-Powered Practice
> Walk into any interview with unshakable confidence. Our Mock Interview module provides domain-specific questions, lets you record video responses, gives instant feedback with dynamic follow-ups, and delivers a detailed performance summary. Advanced proctoring monitors presence, device usage, and tab activity to ensure a secure, realistic experience.

> ### 🤖 Get Unstuck, Instantly
> Never feel lost again. Our 24/7 AI Mentor Chatbot is always available for guidance. Hit the "I Am Stuck" button for immediate, detailed support on any career-related question.

---

<h2 id="project-file-structure">📂 Project File Structure</h2>

Our project is organized into distinct `Backend` and `Frontend` directories, ensuring a clean separation of concerns.

<details>
<summary><strong>Click to view the detailed project structure</strong></summary>

```GenAI_hack/
├── .gitignore              # Specifies files for Git to ignore
├── LICENSE                 # Project software license (MIT)
├── README.md               # You are here!
├── requirements.txt        # Python dependencies for the backend
│
├── Backend/
│   ├── __init__.py           # Makes 'Backend' a Python package
│   ├── .env                  # Stores environment variables and secrets (API keys)
│   ├── dependencies.py       # Manages FastAPI dependency injections
│   ├── main.py               # Main application entry point, initializes FastAPI
│   │
│   ├── core/                 # Core business logic of the application
│   │   ├── __init__.py
│   │   ├── adzuna_client.py  # Handles communication with the Adzuna Jobs API
│   │   ├── ai_core.py        # Manages all interactions with the Google Gemini API
│   │   ├── db_core.py        # Handles database operations with Firebase Firestore
│   │   └── job_processor.py  # Logic for processing and matching job data
│   │
│   └── routers/              # Defines all the API endpoints (routes)
│       ├── __init__.py
│       ├── assessment.py     # Routes for skill assessments
│       ├── auth.py           # Routes for user authentication (login, logout)
│       ├── interview.py      # Routes for the mock interview feature
│       ├── joblisting.py     # Routes for fetching and matching job listings
│       ├── resume.py         # Routes for resume parsing and optimization
│       ├── roadmap.py        # Routes for generating career roadmaps
│       └── user.py           # Routes for user profile management
│
└── Frontend/
    ├── assets/               # Static assets (images, logos, fonts)
    ├── script/               # JavaScript logic for each page
    │   ├── assessment.js
    │   ├── auth.js
    │   ├── home.js
    │   ├── index.js
    │   ├── joblisting.js
    │   ├── optimizer.js
    │   ├── profile.js
    │   └── roadmap.js
    │
    ├── style/                # CSS stylesheets for styling the application
    │   ├── index.css
    │   ├── login.css
    │   └── ...               # Additional stylesheets for other pages
    │
    ├── templates/            # Resume templates
    │
    ├── assessment.html       # Skill Assessment page
    ├── home.html             # Main dashboard page
    ├── index.html            # Application landing page
    ├── interview.html        # Mock Interview page
    ├── joblisting.html       # Job Matching results page
    ├── login.html            # User login and registration page
    ├── optimizer.html        # Resume & LinkedIn optimization tool page
    ├── profile.html          # User profile and settings page
    └── roadmap.html          # Career Roadmap visualization page

```
</details>

---

<h2 id="technology-architecture">🛠️ Technology & Architecture</h2>

Our platform is built on a modern, scalable, and secure tech stack, designed for performance and reliability.

| Area              | Technologies                                       |
| :---------------- | :------------------------------------------------- |
| **AI & ML Core**  | `Google Gemini 2.5 Flash`                          |
| **Resume Parsing**| `PyPDF2`                                           |
| **Backend**       | `Python`, `FastAPI`                                |
| **Frontend**      | `HTML5`, `CSS3`, `Vanilla JavaScript`              |
| **Database**      | `Firebase Firestore` (NoSQL)                       |
| **Authentication**| `Google OAuth 2.0`                                 |
| **Job API**       | `Adzuna Jobs API`                                  |
| **Speech to text**| `Grok Api`                                         |
| **Deployment**    | `Render` (Backend), `GitHub Pages` (Frontend)      |


## System Architecture 

```
                    ┌──────────────────────────────────────────────────────────────┐
                    │                          👤  End User                        |
                    │ (Uploads Resume,Sets Goals,Starts Assessments & Interviews)  │
                    └──────────────────────────────┬───────────────────────────────┘
                                                   │ (HTTPS Requests)
                                                   ▼
                    ┌───────────────────────────────────────────────────────────┐
                    │                          Frontend                         │
                    │            (HTML, CSS, JS, Google OAuth Login)            │
                    └──────────────────────────────┬────────────────────────────┘
                                                   │ (Secure API Calls to Backend)
                                                   ▼
┌──────────────────────────────────────────────────────────────────────────────────────────────────┐
│                                   Backend Server (FastAPI)                                       │
│                                                                                                  │
│   ┌───────────────────────────┐ (User Input & Data)    ┌────────────────────────────────────┐    │
│   │   - Roadmap Generation    │                        │                                    │    │   ┌───────────────────┐
│   │   - Resume Optimization   ├───────────────────────►│         AI Logic Engine            ├───►│ Google Gemini API     │
│   │   - Skill Assessment      │                        │  (Analyzes Text,Generates Content, │    │   └───────────────────┘
│   │   - Mock Interview        │                        │       Scores Responses)            │    │
│   └───────────────────────────┘                        └────────────────────────────────────┘    │
│                                                                                                  │
│                                                                                                  │
│   ┌───────────────────────────┐ (User Preferences)     ┌────────────────────────────────────┐    │   ┌───────────────────┐
│   │      - Job Matching       ├───────────────────────►│       Job Matching Engine          ├───►│    Adzuna API         │
│   └───────────────────────────┘                        └────────────────────────────────────┘    │   └───────────────────┘
│                                                                                                  │
│                                                                                                  │
│   ┌───────────────────────────┐  (Profile Data)        ┌────────────────────────────────────┐    │   ┌───────────────────┐
│   │ - User Profile Management ├───────────────────────►│        Database Interface          ├───►│ Firebase/Firestore    │
│   └───────────────────────────┘                        └────────────────────────────────────┘    │   └───────────────────┘
│                                                                                                  │
└──────────────────────────────────────────────────────────────────────────────────────────────────┘
```

---

<h2 id="future-roadmap">🔮 Future Roadmap</h2>

We are committed to continuous improvement. Here’s what’s next for AI Career Coach:

-    **Google Calendar & Tasks Integration:** Sync your roadmap tasks directly to your personal calendars.
-    **AI Portfolio Project Generator:** Get AI-driven suggestions for impactful projects to make your profile stand out.
-    **Real-time Job Market Insights:** A dashboard to visualize trending skills and salary data in your field.
-    **Gamified Learning:** Earn badges and achievements for completing milestones to stay motivated.

---

<h2 id="getting-started">🚀 Getting Started: Setup and Installation</h2>

Follow these instructions to get a local copy of the project up and running for development and testing purposes.

### Prerequisites

Ensure you have the following installed on your local machine:
*   [Git](https://git-scm.com/)
*   [Python 3.9+](https://www.python.org/downloads/)
*   An IDE of your choice, like [VS Code](https://code.visualstudio.com/)

#### 1. Clone the Repository

  - First, clone the project repository to your local machine:
    ```
    git clone https://github.com/your-username/Career_guider.git
    ```
#### 2. Backend Setup (FastAPI)

  - The backend server handles all the core logic, from AI interactions to database management.

    a. Navigate to the Backend Directory:
    
      ```
      cd Backend
      ```
    
    b. Create and Activate a Virtual Environment:
      - It's highly recommended to use a virtual environment to manage project dependencies.
    
      On macOS/Linux:
    
        
        python3 -m venv venv
        source venv/bin/activate
        
      
      On Windows:
    
        
        python -m venv venv
        .\venv\Scripts\activate
        
    
    c. Install Dependencies:
      - Install all the required Python packages listed in requirements.txt.
    
        ```
        pip install -r ../requirements.txt
        ```
    
    d. Configure Environment Variables:
      - The backend requires API keys and credentials to connect to external services.
      
      - Create a new file named .env inside the Backend directory.
      
      - Copy the contents of .env.example (if you have one) or use the template below and fill in your own credentials.
    
        ```
        # .env file
        
        # Google Gemini API Key
        GOOGLE_API_KEY="YOUR_GEMINI_API_KEY"
        
        # Adzuna API Credentials
        ADZUNA_APP_ID="YOUR_ADZUNA_APP_ID"
        ADZUNA_APP_KEY="YOUR_ADZUNA_APP_KEY"
        GROQ_API_KEY="YOUR_GROK_API_KEY"
        # Also make sure firebase-credentials.json file is their in backend directory
        ```
    
    e. Run the Backend Server:
      - With the dependencies installed and environment variables set, start the FastAPI server.
        ```
        uvicorn main:app --reload
        ```
      - The backend should now be running at http://127.0.0.1:8000. You can visit this URL in your browser to see the FastAPI docs.

#### 3. Frontend Setup (Vanilla JS)

  - Our frontend is built with pure HTML, CSS, and JavaScript. The easiest way to run it locally and connect it to the backend is with a live server.

      a. Open a New Terminal:
    
    - Keep your backend server running in the first terminal. Open a new terminal window and navigate back to the root project directory.
      
    b. Run the Frontend Server:
      
    - Navigate to the Frontend directory and start the server.

      ```
          cd Frontend
          python -m http.server 8080
       ```
  
  - The frontend will run at: **http://localhost:8080**  

#### 4. You're All Set!

  - The application should now be fully functional on your local machine. The frontend served by live-server will make API calls to your backend running on port 8000.

---

<h2 id="license">📜 License</h2>

This project is licensed under the **MIT License**. See the `LICENSE` file for more details.
