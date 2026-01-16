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

I have already updated your JavaScript files to use your **specific Render URL**:
`https://career-coach-ai-3xap.onrender.com`

### **Steps:**
1.  **Deploy to Vercel:**
    *   Go to [vercel.com](https://vercel.com).
    *   Click **Add New...** -> **Project**.
    *   Select the **`career-coach-ai`** repository.
    *   **Framework Preset:** Select `Other`.
    *   **Root Directory:** 
        *   Click **Edit**.
        *   Select the `Frontend` folder.
    *   **Build Command:** (Leave empty).
    *   **Output Directory:** (Leave empty).

2.  **Deploy:**
    *   Click **Deploy**.
    *   Vercel will give you a frontend URL (e.g., `https://career-coach-ai.vercel.app`).

---

## ✅ 3. Final Verification

1.  Open your new Vercel URL.
2.  **Login:** Try logging in with Google.
3.  **Check Connection:**
    *   If login works, your Frontend is correctly talking to your Backend!
    *   If you see "Network Error", check the Console (F12) to see if it's trying to reach `career-coach-ai-3xap.onrender.com`.

**Good luck with your launch!** 🚀
