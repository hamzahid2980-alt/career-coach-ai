# 🚀 Deployment Guide: Career Guider

This guide covers how to deploy the **Frontend to Vercel** and the **Backend to Render**.

---

## 🏗️ 1. Prepare Backend for Deployment (Render)

We have already created the necessary `requirements.txt` file for the backend.

### **Steps:**
1.  **Push your code to GitHub:**
    *   Create a new repository on GitHub.
    *   Push your entire project folder (`Career_guider-main`) to this repository.

2.  **Create a Render Service:**
    *   Go to [dashboard.render.com](https://dashboard.render.com/).
    *   Click **New +** -> **Web Service**.
    *   Connect your GitHub account and select your repository.

3.  **Configure Render:**
    *   **Name:** `career-guider-backend` (or similar)
    *   **Region:** Choose the one closest to you (e.g., Frankfurt or Singapore).
    *   **Branch:** `main` (or your working branch).
    *   **Root Directory:** `Backend` (Important: Set this to the backend folder).
    *   **Runtime:** `Python 3`
    *   **Build Command:** `pip install -r requirements.txt` (Render should auto-detect this).
    *   **Start Command:** `uvicorn main:app --host 0.0.0.0 --port 10000`

4.  **Set Environment Variables (Crucial):**
    *   Scroll down to the **Environment Variables** section. Add the following:
        *   `PYTHON_VERSION`: `3.10.0` (Recommended)
        *   `FIREBASE_CREDENTIALS`: [Paste the **entire content** of `Backend/firebase-credentials.json` here].
        *   `GOOGLE_API_KEY`: [Check your `.env` file and paste the key].
        *   `GEMINI_API_KEY_1`: [Check your `.env` file].
        *   `GROQ_API_KEY`: [If you use Groq, paste that key].

5.  **Deploy:**
    *   Click **Create Web Service**.
    *   Wait for the build to finish. Once live, Render will give you a URL (e.g., `https://career-guider-backend.onrender.com`).
    *   **Copy this URL.**

---

## 🎨 2. Configure Frontend (Vercel)

I have updated your JavaScript files to automatically specific URL for production.

### **Changes Made:**
*   Files like `home.js`, `login.js`, `trends.js`, etc., now have logic like:
    ```javascript
    const API_BASE_URL = (window.location.hostname === 'localhost' ...) 
        ? 'http://localhost:8000' 
        : 'https://career-guider-backend.onrender.com';
    ```
*   **IMPORTANT:** If your Render URL is DIFFERENT from `https://career-guider-backend.onrender.com`, you must update this string in your local files and push again, OR (easier) simply rename your Render service to `career-guider-backend` if available.
    *   *Correction/Recommendation:* It is safer to do a global Find & Replace in VS Code for `https://career-guider-backend.onrender.com` replacing it with your *actual* Render URL once you have it.

### **Steps:**
1.  **Deploy to Vercel:**
    *   Go to [vercel.com](https://vercel.com).
    *   Click **Add New...** -> **Project**.
    *   Select the same GitHub repository.
    *   **Framework Preset:** `Other` (since it's plain HTML/JS).
    *   **Root Directory:** `Frontend` (Click 'Edit' next to Root Directory and select the `Frontend` folder).
    *   **Build Command:** (Leave empty).
    *   **Output Directory:** (Leave empty).

2.  **Deploy:**
    *   Click **Deploy**.
    *   Vercel will give you a frontend URL (e.g., `https://career-guider.vercel.app`).

---

## ✅ 3. Final Verification

1.  Open the Vercel URL.
2.  Try logging in.
3.  Check the Developer Console (`F12` -> Console) if anything fails.
    *   If you see "CORS error", make sure your Backend `main.py` allows origins (it is currently set to `["*"]` which allows everything, so it should work).
    *   If you see "Network Error", double-check that the `API_BASE_URL` in the frontend code matches your active Render URL.

**Good luck with your launch!** 🚀
