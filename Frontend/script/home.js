const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com'; // Update this if your backend is hosted elsewhere


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
    loadPerformanceSummary(); // New: Fetch Performance Standing

    // NEW: Silent check for weekly auto-personalization to ensure insights are fresh
    checkAutoPersonalize();

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


/**
 * Fetches user-specific statistics from the backend and updates the UI.
 */
async function fetchAndDisplayStats() {
    if (!currentUser) {
        console.warn("fetchAndDisplayStats: No current user found.");
        // Set to N/A for visual feedback if user not logged in or currentUser is null
        if (statsRoadmapsP) statsRoadmapsP.textContent = '✨';
        if (statsResumesP) statsResumesP.textContent = '✨';
        if (statsAssessmentsP) statsAssessmentsP.textContent = '✨';
        if (statsJobsP) statsJobsP.textContent = '✨';
        return;
    }

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
            // Fallback: Display N/A on error
            if (statsRoadmapsP) statsRoadmapsP.textContent = '✨';
            if (statsResumesP) statsResumesP.textContent = '✨';
            if (statsAssessmentsP) statsAssessmentsP.textContent = '✨';
            if (statsJobsP) statsJobsP.textContent = '✨';
            return;
        }

        const stats = await response.json();
        // console.log("Fetched user stats:", stats);

        // Update DOM elements with fetched data (add null checks for safety)
        if (statsRoadmapsP) statsRoadmapsP.textContent = stats.roadmaps_generated || "✨";
        if (statsResumesP) statsResumesP.textContent = stats.resumes_optimized || "✨";
        if (statsAssessmentsP) statsAssessmentsP.textContent = stats.assessments_taken || "✨";
        if (statsJobsP) statsJobsP.textContent = stats.jobs_matched || "✨";

    } catch (error) {
        console.error('Network error or unexpected response when fetching user statistics:', error);
        // Fallback or error message for the user
        if (statsRoadmapsP) statsRoadmapsP.textContent = '✨';
        if (statsResumesP) statsResumesP.textContent = '✨';
        if (statsAssessmentsP) statsAssessmentsP.textContent = '✨';
        if (statsJobsP) statsJobsP.textContent = '✨';
    }


}

// ==========================================
// NEW: Performance Standing Logic (Ported)
// ==========================================

let recentActivities = {};

/**
 * Fetches the user's detailed performance metrics from the backend.
 * Populates the "Your Performance Standing" card.
 */
async function loadPerformanceSummary() {
    if (!currentUser) return;
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/roadmap/performance`, {
            method: "GET",
            headers: { Authorization: `Bearer ${idToken}` }
        });
        if (!response.ok) return;
        const stats = await response.json();

        recentActivities = stats.recent_activities || {};

        // DOM Elements for Stats
        const avgAssessmentVal = document.getElementById('avg-assessment-val');
        const avgInterviewVal = document.getElementById('avg-interview-val');
        const latestAtsVal = document.getElementById('latest-ats-val');
        const courseProgressVal = document.getElementById('course-progress-val');
        const feedbackText = document.getElementById('performance-feedback-text');

        if (avgAssessmentVal) avgAssessmentVal.textContent = `${Math.round(stats.avg_assessment || 0)}%`;
        if (avgInterviewVal) avgInterviewVal.textContent = `${Math.round(stats.avg_interview || 0)}%`;
        if (latestAtsVal) latestAtsVal.textContent = `${Math.round(stats.latest_ats || 0)}%`;
        if (courseProgressVal) courseProgressVal.textContent = `${Math.round(stats.completion_rate || 0)}%`;

        // Update Reasoning/Feedback
        const reasonContainer = document.getElementById('roadmap-reason-container');
        const reasonText = document.getElementById('roadmap-reason-text');

        // ALWAYS update the main feedback text (removing "Loading...")
        if (feedbackText) {
            // If we have a short feedback string from the backend, use it. Otherwise generate one.
            if (stats.composite_score < 30) feedbackText.textContent = "Getting Started: Build your foundation.";
            else if (stats.composite_score < 70) feedbackText.textContent = "Good progress! Keep optimizing.";
            else feedbackText.textContent = "Excellent standing! Ready for top roles.";
        }

        // Then show the detailed reason if available
        if (stats.roadmap_reason && reasonText) {
            reasonText.textContent = stats.roadmap_reason;
            if (reasonContainer) reasonContainer.classList.remove('hidden');
        }

    } catch (err) {
        console.error("Error loading performance summary:", err);
    }
}

/**
 * Modal Logic for Stats Detail
 */
// Make functions global so HTML onclick attributes can find them
window.openStatsModal = function (category) {
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
};

window.closeStatsModal = function () {
    const modal = document.getElementById('stats-modal');
    if (modal) modal.classList.add('hidden');
    document.body.style.overflow = '';
};

// Close modal on outside click
window.addEventListener('click', (event) => {
    const modal = document.getElementById('stats-modal');
    if (event.target == modal) {
        window.closeStatsModal();
    }
});


/**
 * Silent check for weekly auto-personalization.
 * This ensures the dashboard reflects the latest AI insights even if the user hasn't visited the roadmap page.
 */
async function checkAutoPersonalize() {
    if (!currentUser) return;
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/roadmap/check_auto_personalize`, {
            method: "POST",
            headers: { Authorization: `Bearer ${idToken}` }
        });

        if (!response.ok) return;
        const result = await response.json();

        if (result.is_updated) {
            // If updated, the backend has already saved the new feedback to the DB.
            // We can now update the UI directly with the returned feedback
            const feedbackText = document.getElementById('performance-feedback-text');
            const reasonText = document.getElementById('roadmap-reason-text');
            const reasonContainer = document.getElementById('roadmap-reason-container');

            if (result.feedback) {
                // Update feedback text
                if (reasonText) {
                    reasonText.textContent = result.feedback;
                    if (reasonContainer) reasonContainer.classList.remove('hidden');
                } else if (feedbackText) {
                    feedbackText.textContent = result.feedback;
                }

                // Also reload the stats summary to get any other derived changes
                loadPerformanceSummary();
            }
        }
    } catch (err) {
        console.error("Silent personalization check failed (Home):", err);
    }
}


