const API_BASE_URL = 'https://career-coach-ai-3xap.onrender.com'; // Updated for Production

// Declare global variables with 'let' or without initial assignment.
// They will be assigned their DOM element references *inside* onUserLoggedIn/DOMContentLoaded.
let currentUser = null;

let welcomeMessage;
let statsRoadmapsP;
let statsResumesP;
let statsAssessmentsP;
let statsJobsP;
let logoutBtnSidebar;

// Variables for particle animation and scroll setup (declared globally, assigned in DOMContentLoaded)
let particlesContainer;
let animatedFeatureCards;

/**
 * This function will be called by auth.js when the user is confirmed to be logged in.
 * This is the primary entry point for dynamic content after authentication.
 * @param {firebase.User} user - The authenticated Firebase user object.
 */
function onUserLoggedIn(user) {
    currentUser = user;
    // console.log("Home page: User logged in. UID:", currentUser.uid, "Display Name:", user.displayName);

    // --- Assign DOM Element References here, ENSURING they exist ---
    welcomeMessage = document.getElementById('welcome-message');
    statsRoadmapsP = document.getElementById('stats-roadmaps');
    statsResumesP = document.getElementById('stats-resumes');
    statsAssessmentsP = document.getElementById('stats-assessments');
    statsJobsP = document.getElementById('stats-jobs');
    logoutBtnSidebar = document.getElementById('logout-btn-sidebar'); // Get this reference here

    // Display a personalized welcome message
    if (welcomeMessage) {
        if (user && user.displayName) {
            welcomeMessage.textContent = `Welcome, ${user.displayName}!`;
        } else {
            welcomeMessage.textContent = 'Welcome!';
        }
    }

    // --- Fetch and Display Dynamic Statistics ---
    fetchAndDisplayStats();

    // --- NEW: Fetch and Display Performance Standings ---
    loadPerformanceStanding();

    // --- Handle Logout ---
    const handleLogout = async () => {
        try {
            // 'auth' object is global from firebase-auth-compat.js
            await auth.signOut();
            // console.log('User signed out successfully.');
            // window.location.href = "index.html";
            // auth.js onAuthStateChanged listener handles redirection
        } catch (error) {
            console.error('Sign out error', error);
            alert("Failed to log out. Please try again.");
        }
    };

    if (logoutBtnSidebar) {
        logoutBtnSidebar.addEventListener('click', handleLogout);
    }

    // --- Navigation for Feature Cards (ensure elements are present) ---
    document.getElementById('roadmap-card')?.addEventListener('click', () => window.location.href = 'roadmap.html');
    document.getElementById('optimizer-card')?.addEventListener('click', () => window.location.href = 'optimizer.html');
    document.getElementById('assessment-card')?.addEventListener('click', () => window.location.href = 'assessment.html');
    document.getElementById('jobs-card')?.addEventListener('click', () => window.location.href = 'joblisting.html');
    document.getElementById('interview-card')?.addEventListener('click', () => window.location.href = 'interview.html');

    // After elements are initialized and event listeners set, run animations
    createParticles();
    setupScrollAnimations();

    // Setup click handlers for expandable cards to open modal
    document.getElementById('performance-card-assessments')?.addEventListener('click', () => openStatsModal('assessments'));
    document.getElementById('performance-card-interviews')?.addEventListener('click', () => openStatsModal('interviews'));
    document.getElementById('performance-card-ats')?.addEventListener('click', () => openStatsModal('ats'));
    document.getElementById('performance-card-progress')?.addEventListener('click', () => openStatsModal('progress'));

    // Close modal button
    document.querySelector('.close-button')?.addEventListener('click', closeStatsModal);
}

/**
 * Fetches and displays the performance standings (expandable cards).
 */
// Global variable to store recent activities for the modal
let recentActivities = {};

// Helper to update Performance UI
function updatePerformanceUI(stats) {
    recentActivities = stats.recent_activities || {};

    // Update stats on dashboard
    if (document.getElementById('avg-assessment-val'))
        document.getElementById('avg-assessment-val').textContent = `${Math.round(stats.avg_assessment || 0)}%`;
    if (document.getElementById('avg-interview-val'))
        document.getElementById('avg-interview-val').textContent = `${Math.round(stats.avg_interview || 0)}%`;
    if (document.getElementById('latest-ats-val'))
        document.getElementById('latest-ats-val').textContent = `${Math.round(stats.latest_ats || 0)}%`;
    if (document.getElementById('course-progress-val'))
        document.getElementById('course-progress-val').textContent = `${Math.round(stats.completion_rate || 0)}%`;

    // Update Feedback and Roadmap Reasoning
    const feedbackText = document.getElementById('performance-feedback-text');
    if (feedbackText && stats.composite_score !== undefined) {
        feedbackText.textContent = `Your overall performance index is ${Math.round(stats.composite_score)}%. Keeping a consistent pace is key to meeting your career goals.`;
    }

    const reasonContainer = document.getElementById('roadmap-reason-container');
    const reasonText = document.getElementById('roadmap-reason-text');
    if (reasonContainer && reasonText && stats.roadmap_reason) {
        reasonText.textContent = stats.roadmap_reason;
        reasonContainer.classList.remove('hidden');
    }
}

async function loadPerformanceStanding() {
    console.log("📊 Loading performance standing...");
    const user = currentUser || firebase.auth().currentUser;
    if (!user) return;

    // --- CACHE IMPLEMENTATION ---
    const cacheKey = `performance_standing_${user.uid}`;
    const cachedData = localStorage.getItem(cacheKey);

    if (cachedData) {
        console.log("⚡ Loaded performance stats from cache.");
        try {
            const parsedData = JSON.parse(cachedData);
            updatePerformanceUI(parsedData);
        } catch (e) {
            console.error("Error parsing cached performance data:", e);
        }
    }
    // ----------------------------

    try {
        const idToken = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/roadmap/performance`, {
            method: "GET",
            headers: { Authorization: `Bearer ${idToken}` }
        });

        if (!response.ok) {
            console.error("❌ Failed to fetch performance stats form server.");
            return;
        }

        const stats = await response.json();
        console.log("✅ Performance stats received from server:", stats);
        
        // --- SMART CACHE UPDATE & PRESERVATION (PERFORMANCE) ---
        let shouldUseCache = false;
        
        if (cachedData) {
            try {
                const parsedCache = JSON.parse(cachedData);
                // If server says 0 composite score (empty), but cache had a real score...
                if (stats.composite_score === 0 && parsedCache.composite_score > 0) {
                     console.warn("⚠️ Server returned 0 performance score, but cache has data. Preserving cache.");
                     shouldUseCache = true;
                }
            } catch (e) {
                // Ignore parse error, proceed with update
            }
        }
        
        if (shouldUseCache) {
             // Do nothing, UI already showing cached data.
             return; 
        }

        // Update Cache
        localStorage.setItem(cacheKey, JSON.stringify(stats));
        
        // Update UI with fresh data
        updatePerformanceUI(stats);

    } catch (err) {
        console.error("❌ Error loading performance standing:", err);
    }
}

// Modal Logic
function openStatsModal(category) {
    const modal = document.getElementById('stats-modal');
    const title = document.getElementById('modal-title');
    const container = document.getElementById('modal-details-container');

    if (!modal || !container) return;

    const categoryNames = {
        'assessments': 'Recent Assessments',
        'interviews': 'Mock Interviews',
        'ats': 'ATS Score History',
        'progress': 'Roadmap Progress'
    };

    title.textContent = categoryNames[category] || 'Activity Details';

    const items = recentActivities[category] || [];
    if (items.length === 0) {
        container.innerHTML = `<div class="activity-item"><p class="activity-feedback">No recent ${category} found.</p></div>`;
    } else {
        container.innerHTML = items.map(item => `
            <div class="activity-item">
                <div class="activity-header">
                    <span class="activity-name">${item.name}</span>
                    <span class="activity-rating">${item.score}${category === 'progress' ? '' : '%'}</span>
                </div>
                <p class="activity-feedback">${item.feedback}</p>
                <div class="activity-improvement">${item.improvement}</div>
            </div>
        `).join('');
    }

    modal.classList.remove('hidden');
    document.body.style.overflow = 'hidden';
}

function closeStatsModal() {
    const modal = document.getElementById('stats-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
}

// Close modal on outside click
window.addEventListener('click', (event) => {
    const modal = document.getElementById('stats-modal');
    if (event.target == modal) {
        closeStatsModal();
    }
});



// NEW: Smart refresh - Update stats when user returns to this tab
window.addEventListener('focus', () => {
    if (currentUser) {
        fetchAndDisplayStats();
        loadPerformanceStanding();
    }
});

/**
 * Renders activity history into the detail containers.
 */
function renderActivityDetails(activities) {
    const categories = ['assessments', 'interviews', 'ats', 'progress'];

    categories.forEach(cat => {
        const container = document.getElementById(`details-${cat}`);
        if (!container) return;

        const items = activities[cat] || [];
        if (items.length === 0) {
            container.innerHTML = '<div class="activity-item"><p class="activity-feedback">No recent activities found.</p></div>';
            return;
        }

        container.innerHTML = items.map(item => `
            <div class="activity-item">
                <div class="activity-header">
                    <span class="activity-name">${item.name}</span>
                    <span class="activity-rating">${item.score}${cat === 'progress' ? '' : '%'}</span>
                </div>
                <p class="activity-feedback">${item.feedback}</p>
                <div class="activity-improvement">${item.improvement}</div>
            </div>
        `).join('');
    });
}


// --- Particle Animation (moved outside onUserLoggedIn, but called by it) ---
function createParticles() {
    particlesContainer = document.getElementById('particles'); // Assign here
    if (!particlesContainer) {
        // console.warn("Particles container not found.");
        return;
    }
    particlesContainer.innerHTML = ''; // Clear existing particles if function called multiple times
    const particleCount = 40;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.random() * 6 + 2;
        particle.style.width = `${size}px`;
        particle.style.height = `${size}px`;

        particle.style.left = `${Math.random() * 100}vw`;
        particle.style.top = `${Math.random() * 100}vh`;

        const duration = Math.random() * 10 + 15;
        particle.style.animationDuration = `${duration}s`;
        particle.style.animationDelay = `${Math.random() * 15}s`;

        const translateX = (Math.random() - 0.5) * 200;
        particle.style.setProperty('--translateX', `${translateX}px`);

        particlesContainer.appendChild(particle);
    }
}

// --- Scroll Animations for Cards (moved outside onUserLoggedIn, but called by it) ---
function setupScrollAnimations() {
    animatedFeatureCards = document.querySelectorAll('.feature-card'); // Assign here
    if (!animatedFeatureCards.length) {
        console.warn("No feature cards found for scroll animation.");
        return;
    }

    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry, index) => {
            if (entry.isIntersecting) {
                entry.target.style.animationDelay = `${index * 0.1}s`;
                entry.target.style.animationPlayState = 'running';
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    animatedFeatureCards.forEach(element => {
        element.style.animationPlayState = 'paused';
        observer.observe(element);
    });
}


// Helper to update Stats Cards UI
function updateStatsUI(stats) {
    if (statsRoadmapsP) statsRoadmapsP.textContent = (stats.roadmaps_generated !== undefined) ? stats.roadmaps_generated : "0";
    if (statsResumesP) statsResumesP.textContent = (stats.resumes_optimized !== undefined) ? stats.resumes_optimized : "0";
    if (statsAssessmentsP) statsAssessmentsP.textContent = (stats.assessments_taken !== undefined) ? stats.assessments_taken : "0";
    if (statsJobsP) statsJobsP.textContent = (stats.jobs_matched !== undefined) ? stats.jobs_matched : "0";
}

/**
 * Fetches user-specific statistics from the backend and updates the UI.
 */
async function fetchAndDisplayStats() {
    if (!currentUser) {
        console.warn("fetchAndDisplayStats: No current user found.");
        // Defaults to 0/N/A
        if (statsRoadmapsP) statsRoadmapsP.textContent = '0';
        if (statsResumesP) statsResumesP.textContent = '0';
        if (statsAssessmentsP) statsAssessmentsP.textContent = '0';
        if (statsJobsP) statsJobsP.textContent = '0';
        return;
    }

    // --- CACHE IMPLEMENTATION ---
    const cacheKey = `user_stats_${currentUser.uid}`;
    const cachedStatsStr = localStorage.getItem(cacheKey);
    let cachedStats = null;

    if (cachedStatsStr) {
        // console.log("⚡ Loaded user stats from cache.");
        try {
            cachedStats = JSON.parse(cachedStatsStr);
            updateStatsUI(cachedStats);
        } catch (e) {
            console.error("Error parsing cached stats:", e);
        }
    }
    // ----------------------------

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/user/stats`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });

        if (!response.ok) {
            const errorData = await response.json();
            console.error('Failed to fetch user statistics:', errorData.detail || errorData.message);
            // Fallback: If no cache, show 0s.
            if (!cachedStats) {
                updateStatsUI({roadmaps_generated: 0, resumes_optimized: 0, assessments_taken: 0, jobs_matched: 0});
            }
            return;
        }

        const stats = await response.json();
        // console.log("Fetched user stats:", stats);

        // --- SMART CACHE UPDATE & PRESERVATION ---
        // Logic: If the server returns "clean slate" (all 0s), but we have meaningful history in cache,
        // we assume the user prefers to see their history (or the DB connection was temporary glitched).
        // This prevents the "blanking out" effect.
        
        let shouldUseCache = false;

        if (cachedStats) {
            const isServerEmpty = (stats.roadmaps_generated === 0 && stats.resumes_optimized === 0 && 
                                   stats.assessments_taken === 0 && stats.jobs_matched === 0);
            
            const isCacheHasData = (cachedStats.roadmaps_generated > 0 || cachedStats.resumes_optimized > 0 || 
                                    cachedStats.assessments_taken > 0 || cachedStats.jobs_matched > 0);

            if (isServerEmpty && isCacheHasData) {
                console.warn("⚠️ Server returned empty stats, but cache has data. Preserving cache as per user preference.");
                shouldUseCache = true;
            }
        }

        if (shouldUseCache && cachedStats) {
            // Do NOT overwrite localStorage.
            // visual update checks handled by 'cachedStats' load earlier, but we can re-enforce if needed.
            // In fact, we already updated UI with cache at start. So we just RETURN.
            // But if we want to be sure, we can update UI again just in case.
            updateStatsUI(cachedStats);
        } else {
            // Normal behavior: Update Cache with fresh data (even if 0, if cache was also 0 or empty)
            localStorage.setItem(cacheKey, JSON.stringify(stats));
            updateStatsUI(stats);
        }

    } catch (error) {
        console.error('Network error or unexpected response when fetching user statistics:', error);
        // Fallback or error message for the user, only if no cache
        if (!cachedStats) {
            updateStatsUI({roadmaps_generated: 0, resumes_optimized: 0, assessments_taken: 0, jobs_matched: 0});
        }
    }

}
