const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:8000/api/portfolio-rater' 
    : 'https://career-coach-ai-3xap.onrender.com/api/portfolio-rater';


// Global user variable to store the authenticated Firebase user
let currentUser = null;

// Auth Guard callback (called by auth.js)
function onUserLoggedIn(user) {
    console.log("Portfolio Rater: User authed", user.uid);
    currentUser = user;
}

async function auditSite() {
    const urlInput = document.getElementById('urlInput');
    const url = urlInput.value.trim();
    const btn = document.getElementById('btn');
    const msg = document.getElementById('statusMsg');
    const dash = document.getElementById('dashboard');

    if(!url) {
        msg.innerText = "Please enter a valid URL.";
        msg.style.color = "#ef4444";
        return;
    }

    if (!url.startsWith('http')) {
        msg.innerText = "Please include http:// or https://";
        msg.style.color = "#ef4444";
        return;
    }

    // Check Authentication
    if (!currentUser) {
        msg.innerText = "⚠️ Authentication checking... please wait a moment.";
        msg.style.color = "#fbbf24";
        // Attempt to wait briefly if auth is extremely slow, or just fail
        setTimeout(() => {
            if(!currentUser) {
                msg.innerText = "❌ Error: Not authenticated. Please login again.";
                msg.style.color = "#ef4444";
            } else {
                auditSite(); // Retry once
            }
        }, 1000);
        return;
    }

    btn.disabled = true;
    btn.innerHTML = '<i class="fas fa-spinner fa-spin"></i> Auditing...';
    msg.innerText = "🤖 AI is visiting your site and analyzing content...";
    msg.style.color = "#8A49FF";
    dash.classList.add('hidden');

    try {
        // GET FRESH TOKEN
        const token = await currentUser.getIdToken();

        const res = await fetch(`${API_BASE_URL}/rate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${token}`
            },
            body: JSON.stringify({ url: url })
        });

        const data = await res.json();
        
        if (!res.ok) {
            throw new Error(data.detail || data.error || "Analysis failed");
        }

        // 1. Top Section
        animateScore(data.hireability_score || 0);
        document.getElementById('roleTag').innerText = data.detected_role || "Unknown Role";
        document.getElementById('overviewText').innerText = data.recruiter_overview || "No overview available.";

        // 2. Metrics Bars
        setBar('barClarity', data.metrics.clarity || 0);
        setBar('barEvidence', data.metrics.evidence_of_skill || 0);
        setBar('barCulture', data.metrics.culture_fit || 0);

        // 3. Lists
        fillList('goodList', data.feedback.strong_points);
        fillList('badList', data.feedback.red_flags);

        dash.classList.remove('hidden');
        msg.innerText = "";
        
        // Scroll to results
        dash.scrollIntoView({ behavior: 'smooth', block: 'start' });

    } catch(e) {
        msg.innerText = "❌ Error: " + e.message;
        msg.style.color = "#ef4444";
        console.error(e);
    } finally {
        btn.disabled = false;
        btn.innerText = "Analyze Portfolio";
    }
}

function setBar(id, value) {
    const el = document.getElementById(id);
    el.style.width = "0%";
    setTimeout(() => {
        el.style.width = value + "%";
    }, 100);
}

function fillList(id, items) {
    const ul = document.getElementById(id);
    ul.innerHTML = "";
    if(!items || items.length === 0) {
        ul.innerHTML = "<li>No significant points found.</li>";
        return;
    }
    items.forEach(i => {
        const li = document.createElement('li');
        li.innerText = i;
        ul.appendChild(li);
    });
}

function animateScore(target) {
    let current = 0;
    const el = document.getElementById('scoreText');
    const stepTime = 20;
    const steps = 50; 
    const inc = target / steps;
    
    const timer = setInterval(() => {
        current += inc;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        el.innerText = Math.floor(current);
    }, stepTime);
}
