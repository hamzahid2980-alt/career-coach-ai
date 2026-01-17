
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:8000/api/career-mail' 
    : 'https://career-coach-ai-3xap.onrender.com/api/career-mail';
let currentUser = null;

// Initialize when auth works
// Initialize when auth works
window.onUserLoggedIn = async (user) => {
    currentUser = user;
    const userNameEl = document.getElementById('userName');
    const userAvatarEl = document.getElementById('userAvatar');
    if(userNameEl) userNameEl.textContent = user.displayName || "User";
    if(userAvatarEl && user.photoURL) userAvatarEl.src = user.photoURL;

    // Start Particles
    createParticles();


    // Check for OAuth Callback
    const urlParams = new URLSearchParams(window.location.search);
    const code = urlParams.get('code');
    
    if (code) {
        await handleOAuthCallback(code);
    } else {
        await checkStatusAndLoad();
    }
};

async function getAuthHeaders() {
    if (!currentUser) return {};
    const token = await currentUser.getIdToken();
    return {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
    };
}

// --- Particle Animation (Adapted from home.js) ---
function createParticles() {
    const particlesContainer = document.getElementById('particles');
    if (!particlesContainer) return;

    particlesContainer.innerHTML = ''; 
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

// --- OAuth Flow ---

document.getElementById('connectGoogleBtn').addEventListener('click', async () => {
    try {
        const headers = await getAuthHeaders();
        // Redirect URI must match what is registered in Google Cloud Console
        const redirectUri = window.location.origin + window.location.pathname; 
        console.log("DEBUG: Using Redirect URI:", redirectUri);
        alert(`About to redirect. Please ensure this URI is added to Google Cloud Console:\n${redirectUri}`);
        
        const response = await fetch(`${API_BASE_URL}/auth-url?redirect_uri=${encodeURIComponent(redirectUri)}`, {
            headers: headers
        });
        const data = await response.json();
        if (data.auth_url) {
            window.location.href = data.auth_url;
        }
    } catch (error) {
        console.error("Auth URL Error:", error);
        alert("Failed to initiate Google Login.");
    }
});

async function handleOAuthCallback(code) {
    console.log("DEBUG: Handling OAuth Callback with code", code);
    const statusMsg = document.getElementById('syncStatusMsg');
    if(statusMsg) {
        statusMsg.textContent = "Connecting Google Account...";
        statusMsg.className = "sync-message loading";
    }
    
    try {
        const headers = await getAuthHeaders();
        const redirectUri = window.location.origin + window.location.pathname;
        console.log("DEBUG: Sending callback to backend with URI:", redirectUri);
        
        const response = await fetch(`${API_BASE_URL}/oauth-callback?code=${code}&redirect_uri=${encodeURIComponent(redirectUri)}`, {
            method: 'POST',
            headers: headers
        });
        
        console.log("DEBUG: Callback response status:", response.status);

        if (response.ok) {
            console.log("DEBUG: Callback successful. Cleaning URL.");
            // Clean URL
            window.history.replaceState({}, document.title, window.location.pathname);
            
            if(statusMsg) {
                statusMsg.textContent = "Connected successfully!";
                statusMsg.className = "sync-message success";
            }
            
            const connectBtn = document.getElementById('connectGoogleBtn');
            const syncBtn = document.getElementById('syncBtn');
            
            if(connectBtn) connectBtn.classList.add('hidden');
            if(syncBtn) syncBtn.classList.remove('hidden');
            
            // Auto sync on first connect
            console.log("DEBUG: Starting auto-sync.");
            await startSyncArgs(); 
        } else {
            const errorText = await response.text();
            console.error("DEBUG: Callback failed response:", errorText);
            throw new Error(`Callback failed: ${response.status} ${response.statusText}`);
        }
    } catch (error) {
        console.error("DEBUG: Error in handleOAuthCallback:", error);
        if(statusMsg) {
            statusMsg.textContent = "Connection failed: " + error.message;
            statusMsg.className = "sync-message error";
        }
        alert("Connection Logic Error: " + error.message);
    }
}

// --- Sync Logic ---


// --- Sync Logic with Real-Time Polling ---

document.getElementById('syncBtn').addEventListener('click', startSyncArgs);
if(document.getElementById('refreshScheduleBtn')) {
    document.getElementById('refreshScheduleBtn').addEventListener('click', () => {
        loadSchedule();
        loadTasks();
    });
}

// Polling Loop Variable
let syncInterval = null;

async function startSyncArgs() {
    const statusMsg = document.getElementById('syncStatusMsg');
    statusMsg.textContent = "Starting sync...";
    statusMsg.className = "sync-message loading";
    
    const syncBtn = document.getElementById('syncBtn');
    syncBtn.disabled = true;

    try {
        const headers = await getAuthHeaders();
        // 1. Trigger Sync
        const response = await fetch(`${API_BASE_URL}/sync`, { method: 'POST', headers: headers });
        const data = await response.json();
        
        if (response.ok) {
            statusMsg.textContent = "Sync started. Watching for updates...";
            // 2. Start Polling
            if(syncInterval) clearInterval(syncInterval);
            syncInterval = setInterval(pollSyncStatus, 1500); // Poll every 1.5s
        } else {
            if (response.status === 401) {
                handleAuthError();
                return;
            }
            throw new Error(data.detail || "Failed to start sync");
        }
    } catch (error) {
        console.error(error);
        statusMsg.textContent = "Sync failed start: " + error.message;
        statusMsg.className = "sync-message error";
        syncBtn.disabled = false;
    }
}

async function pollSyncStatus() {
    const statusMsg = document.getElementById('syncStatusMsg');
    const syncBtn = document.getElementById('syncBtn');
    
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/sync/status`, { headers: headers });
        const state = await response.json();
        
        // Update Message
        if(state.message) statusMsg.textContent = state.message;
        
        // Update UI Real-time (Appending/Re-rendering)
        // Optimization: Only render if counts change? For simplicity, we re-render list or append.
        // Let's re-render for cleanliness as lists are usually small (<50 items).
        if(state.events && state.events.length > 0) renderSchedule(state.events);
        if(state.tasks && state.tasks.length > 0) renderTasks(state.tasks);
        
        // Check completion
        if (state.status === 'completed' || state.status === 'failed') {
            clearInterval(syncInterval);
            syncBtn.disabled = false;
            
            if(state.status === 'completed') {
                statusMsg.className = "sync-message success";
                loadAnalysis(); // Refresh stats
            } else {
                statusMsg.className = "sync-message error";
            }
        }
        
    } catch (e) {
        console.error("Polling error", e);
        // Don't stop polling immediately on one network blip, but maybe warn?
    }
}

function handleAuthError() {
    console.log("DEBUG: 401 received. Resetting UI to Connect state.");
    document.getElementById('connectGoogleBtn').classList.remove('hidden');
    document.getElementById('syncBtn').classList.add('hidden');
    const sm = document.getElementById('syncStatusMsg');
    sm.textContent = "Session expired. Please connect again.";
    sm.className = "sync-message error";
}



async function checkStatusAndLoad() {
    // Optimistically load data first
    loadAnalysis();
    loadSchedule();
    loadTasks();
    loadInterviewHistory(); // New
    
    // Explicitly check backend status to set button state
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/sync/status`, { headers: headers });
        
        const connectBtn = document.getElementById('connectGoogleBtn');
        const syncBtn = document.getElementById('syncBtn');

        if (response.ok) {
            // Backend says we are connected (or at least authorized)
            if(connectBtn) connectBtn.classList.add('hidden'); 
            if(syncBtn) syncBtn.classList.remove('hidden'); 
        } else {
             // 401 or other error implies not fully connected to Google
             console.log("Check Status: Not connected to Google (or token expired).");
             if(connectBtn) connectBtn.classList.remove('hidden'); 
             if(syncBtn) syncBtn.classList.add('hidden'); 
        }
    } catch (e) {
        console.error("Check status failed:", e);
        // Default to showing Connect if uncertain
        document.getElementById('connectGoogleBtn').classList.remove('hidden'); 
        document.getElementById('syncBtn').classList.add('hidden'); 
    }
}

async function loadSchedule() {
    const container = document.getElementById('scheduleContent');
    const refreshBtn = document.getElementById('refreshScheduleBtn');
    if(refreshBtn) refreshBtn.classList.add('fa-spin');
    
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/events`, { headers: headers });
        const data = await response.json();
        if(Array.isArray(data)) renderSchedule(data);
    } catch (e) {
        console.error("Failed to load schedule:", e);
        container.innerHTML = '<p class="error-text">Failed to load schedule.</p>';
    } finally {
        if(refreshBtn) refreshBtn.classList.remove('fa-spin');
    }
}

async function loadTasks() {
    const container = document.getElementById('tasksContent');
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/get-all-tasks`, { headers: headers });
        const data = await response.json();
        if(Array.isArray(data)) renderTasks(data);
    } catch (e) {
        console.error("Failed to load tasks:", e);
        container.innerHTML = '<p class="error-text">Failed to load tasks.</p>';
    }
}

function renderSchedule(events) {
    const interviewContainer = document.getElementById('interviewList');
    const hackathonContainer = document.getElementById('hackathonList');
    const genericContainer = document.getElementById('scheduleContent');
    
    // Clear all
    if(interviewContainer) interviewContainer.innerHTML = "";
    if(hackathonContainer) hackathonContainer.innerHTML = "";
    if(genericContainer) genericContainer.innerHTML = "";
    
    let hasInterviews = false;
    let hasHackathons = false;
    
    if(!events || events.length === 0) {
        if(interviewContainer) interviewContainer.innerHTML = '<p class="placeholder-text">No upcoming interviews.</p>';
        if(hackathonContainer) hackathonContainer.innerHTML = '<p class="placeholder-text">No upcoming hackathons.</p>';
        return;
    }
    
    events.forEach(evt => {
        const dateObj = new Date(evt.start_time);
        const dateStr = dateObj.toLocaleDateString(undefined, { month: 'short', day: 'numeric', weekday: 'short' });
        const timeStr = dateObj.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
        
        const card = document.createElement('div');
        card.className = 'event-card';
        card.style.marginBottom = '10px'; // Add spacing
        
        let iconClass = 'fa-calendar';
        let targetContainer = genericContainer;
        
        const type = (evt.event_type || "").toLowerCase();
        
        if(type.includes('interview')) {
            iconClass = 'fa-user-tie';
            targetContainer = interviewContainer;
            hasInterviews = true;
        } else if(type.includes('hackathon')) {
            iconClass = 'fa-code';
            targetContainer = hackathonContainer;
            hasHackathons = true;
        } else if(type.includes('conference')) {
             iconClass = 'fa-users';
        }

        // Source Tooltip
        const sourceHtml = evt.source_subject ? `<div class="source-tag" title="From Email: ${evt.source_subject}"><i class="fa-solid fa-envelope"></i> Source</div>` : '';

        card.innerHTML = `
            <div class="event-icon"><i class="fa-solid ${iconClass}"></i></div>
            <div class="event-details">
                <h4>${evt.event_title}</h4>
                <div class="event-meta">
                    <span><i class="fa-regular fa-clock"></i> ${dateStr}, ${timeStr}</span>
                    ${evt.event_type ? `<span class="badge ${evt.event_type.toLowerCase()}">${evt.event_type}</span>` : ''}
                </div>
            </div>
            <div class="card-actions">
                ${sourceHtml}
                ${evt.calendar_link ? `<a href="${evt.calendar_link}" target="_blank" class="btn-icon-small" title="Open Calendar"><i class="fa-solid fa-external-link-alt"></i></a>` : ''}
                <button class="btn-icon-small delete-btn" onclick="window.deleteEvent('${evt.id}', this)" title="Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        
        if(targetContainer) targetContainer.appendChild(card);
    });
    
    // Set Placeholders if empty
    if(!hasInterviews && interviewContainer) interviewContainer.innerHTML = '<p class="placeholder-text">No upcoming interviews.</p>';
    if(!hasHackathons && hackathonContainer) hackathonContainer.innerHTML = '<p class="placeholder-text">No upcoming hackathons.</p>';
}

function renderTasks(tasks) {
    const container = document.getElementById('tasksContent');
    container.innerHTML = "";
    
    if(!tasks || tasks.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No pending tasks.</p>';
        return;
    }
    
    tasks.forEach(task => {
        const card = document.createElement('div');
        card.className = 'event-card task-card'; // Reuse style
        
        const sourceHtml = task.source_email ? `<div class="source-tag" title="From Email: ${task.source_email}"><i class="fa-solid fa-envelope"></i> Source</div>` : '';

        card.innerHTML = `
            <div class="event-icon"><i class="fa-solid fa-check-circle"></i></div>
            <div class="event-details">
                <h4>${task.title}</h4>
                <div class="event-meta">
                    <span>${task.source_event ? `For: ${task.source_event}` : 'General Task'}</span>
                </div>
            </div>
            <div class="card-actions">
                ${sourceHtml}
                <button class="btn-icon-small delete-btn" onclick="window.deleteTask('${task.id}', this)" title="Complete/Delete"><i class="fa-solid fa-trash"></i></button>
            </div>
        `;
        container.appendChild(card);
    });
}

// Global scope for onclick handlers
window.deleteEvent = async (id, btn) => {
    if(!confirm("Delete this event?")) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/events/${id}`, { method: 'DELETE', headers });
        if(res.ok) {
            btn.closest('.event-card').remove();
        } else alert("Failed to delete event.");
    } catch(e) { console.error(e); }
};

window.deleteTask = async (id, btn) => {
    if(!confirm("Remove this task?")) return;
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/tasks/${id}`, { method: 'DELETE', headers });
        if(res.ok) {
            btn.closest('.event-card').remove();
        } else alert("Failed to delete task.");
    } catch(e) { console.error(e); }
};


// --- Analysis & Visuals ---

async function loadAnalysis() {
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/analysis`, { headers: headers });
        const data = await response.json();
        
        if (data && (data.weaknesses || data.strengths)) {
            renderStats(data);
            renderChart(data);
            
            // Render Advice
            const adviceText = document.getElementById('cumulativeAdviceText');
            if (adviceText) {
                adviceText.textContent = data.cumulative_advice || "Keep submitting feedback to generate a personalized training plan.";
                 // Remove italic style if real advice is present
                if (data.cumulative_advice) adviceText.style.fontStyle = 'normal';
            }

            if (data.next_interview_suggestions && data.next_interview_suggestions.length > 0) {
                 const sb = document.getElementById('suggestionBox');
                 const st = document.getElementById('suggestionText');
                 if(sb) sb.classList.remove('hidden');
                 if(st) st.textContent = "Tip: " + data.next_interview_suggestions[0];
            }
        } else {
             // document.getElementById('analysisContent').innerHTML = "<p>No data yet. Sync emails or submit feedback to get started.</p>";
             // Keep structure but show placeholders
        }
    } catch (e) {
        console.error("Failed to load analysis", e);
    }
}

function renderStats(data) {
    document.getElementById('statsRow').classList.remove('hidden');
    
    const wList = document.getElementById('weaknessList');
    wList.innerHTML = "";
    (data.weaknesses || []).slice(0, 3).forEach(w => {
        const li = document.createElement('li'); li.textContent = w; wList.appendChild(li);
    });
    
    const sList = document.getElementById('strengthList');
    sList.innerHTML = "";
    (data.strengths || []).slice(0, 3).forEach(s => {
        const li = document.createElement('li'); li.textContent = s; sList.appendChild(li);
    });
}

function renderChart(data) {
    document.getElementById('chartContainer').classList.remove('hidden');
    const ctx = document.getElementById('topicsChart').getContext('2d');
    
    // Check if chart instance exists
    if(window.mainTopicsChart) window.mainTopicsChart.destroy();

    // Mock data based on recurring topics counts (we only have list of strings, so we count occurrences)
    const topics = data.recurring_topics || [];
    const counts = {};
    topics.forEach(t => counts[t] = (counts[t] || 0) + 1);
    
    window.mainTopicsChart = new Chart(ctx, {
        type: 'doughnut',
        data: {
            labels: Object.keys(counts),
            datasets: [{
                data: Object.values(counts),
                backgroundColor: ['#6C63FF', '#03dac6', '#ff0266', '#ffde03'],
                borderWidth: 0
            }]
        },
        options: {
            responsive: true,
            plugins: {
                legend: { position: 'right', labels: { color: 'white' } }
            }
        }
    });
}

// --- History Logic ---

if(document.getElementById('refreshHistoryBtn')) {
    document.getElementById('refreshHistoryBtn').addEventListener('click', loadInterviewHistory);
}

document.addEventListener('DOMContentLoaded', () => {
    loadInterviewHistory();
});

async function loadInterviewHistory() {
    const historyList = document.getElementById('historyList');
    if(!historyList) return;
    
    try {
        const refreshBtn = document.getElementById('refreshHistoryBtn');
        if(refreshBtn) refreshBtn.classList.add('fa-spin');
        
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/interview-history`, { headers: headers });
        
        if(!response.ok) throw new Error("Failed to load history");
        
        const historyData = await response.json();
        renderHistory(historyData);
    } catch (e) {
        console.error(e);
        historyList.innerHTML = '<p class="error-text">Failed to load history.</p>';
    } finally {
        const refreshBtn = document.getElementById('refreshHistoryBtn');
        if(refreshBtn) refreshBtn.classList.remove('fa-spin');
    }
}

function renderHistory(data) {
    const container = document.getElementById('historyList');
    container.innerHTML = "";
    
    if(!data || data.length === 0) {
        container.innerHTML = '<p class="placeholder-text">No interview history yet.</p>';
        return;
    }
    
    data.forEach(entry => {
        const dateObj = new Date(entry.timestamp);
        const dateStr = dateObj.toLocaleDateString() + ' ' + dateObj.toLocaleTimeString([], {hour: '2-digit', minute:'2-digit'});
        
        // Creating Accordion Item
        const item = document.createElement('div');
        item.className = 'history-item';
        item.style.background = 'rgba(255,255,255,0.03)';
        item.style.borderRadius = '8px';
        item.style.overflow = 'hidden';
        item.style.marginBottom = '10px';
        
        const feedbackSnippet = entry.feedback_text.length > 50 ? entry.feedback_text.substring(0, 50) + "..." : entry.feedback_text;
        
        // Header
        const header = document.createElement('div');
        header.className = 'history-header';
        header.style.padding = '15px';
        header.style.cursor = 'pointer';
        header.style.display = 'flex';
        header.style.justifyContent = 'space-between';
        header.style.alignItems = 'center';
        header.innerHTML = `
            <div>
                <strong style="color:var(--primary);">${dateStr}</strong>
                <div style="font-size:0.85rem; color: #ccc; margin-top:5px;">${feedbackSnippet}</div>
            </div>
            <i class="fa-solid fa-chevron-down toggle-icon" style="transition: transform 0.3s;"></i>
        `;
        
        // Content Body
        const body = document.createElement('div');
        body.className = 'history-body hidden';
        body.style.padding = '15px';
        body.style.borderTop = '1px solid rgba(255,255,255,0.1)';
        
        // Build inner HTML for body
        // Skills Chart Canvas ID
        const chartId = `chart-${entry.id}`;
        
        body.innerHTML = `
            <div style="margin-bottom: 15px;">
                <h5 style="margin:0 0 5px 0; color:#fff;">Full Feedback:</h5>
                <p style="font-size:0.9rem; color:#ccc; background: rgba(0,0,0,0.2); padding:10px; border-radius:5px;">${entry.feedback_text}</p>
            </div>
            
            <div style="display:flex; flex-wrap:wrap; gap:15px; margin-bottom:15px;">
                <div style="flex:1; min-width: 200px;">
                    <h5 style="color:#fff;">Skills Insights:</h5>
                    <ul style="font-size:0.9rem; padding-left:20px;">
                        ${(entry.analysis.strengths || []).map(s => `<li style="color:#03dac6;">${s}</li>`).join('')}
                        ${(entry.analysis.weaknesses || []).map(w => `<li style="color:#ff0266;">${w}</li>`).join('')}
                    </ul>
                </div>
                <!-- Radar Chart Container -->
                <div style="flex:1; min-width: 200px; max-width: 300px;">
                     <canvas id="${chartId}"></canvas>
                </div>
            </div>
            
            <div style="text-align:right;">
                <button class="btn-icon-small" onclick="window.deleteHistoryEntry('${entry.id}', this)" style="color:#ff0266; border:1px solid #ff0266; padding:5px 10px; border-radius:4px; cursor:pointer; background:transparent;">
                    <i class="fa-solid fa-trash"></i> Delete Entry
                </button>
            </div>
        `;
        
        // Toggle Logic
        header.addEventListener('click', () => {
             const isHidden = body.classList.contains('hidden');
             if(isHidden) {
                 body.classList.remove('hidden');
                 header.querySelector('.toggle-icon').style.transform = 'rotate(180deg)';
                 // Init Chart ONLY when opened to save resources
                 if(!item.dataset.chartInitialized && entry.skill_scores) {
                     renderEntryChart(chartId, entry.skill_scores);
                     item.dataset.chartInitialized = "true";
                 }
             } else {
                 body.classList.add('hidden');
                 header.querySelector('.toggle-icon').style.transform = 'rotate(0deg)';
             }
        });
        
        item.appendChild(header);
        item.appendChild(body);
        container.appendChild(item);
    });
}

function renderEntryChart(canvasId, scores) {
    const ctx = document.getElementById(canvasId).getContext('2d');
    
    // Default keys if missing
    const labels = Object.keys(scores).length ? Object.keys(scores) : ['Tech', 'Comm', 'Problem Solving', 'Confidence', 'Cul. Fit'];
    const dataVals = Object.keys(scores).length ? Object.values(scores) : [5,5,5,5,5]; // Fallback
    
    new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Performance Score',
                data: dataVals,
                backgroundColor: 'rgba(108, 99, 255, 0.2)',
                borderColor: '#6C63FF',
                pointBackgroundColor: '#fff',
                pointBorderColor: '#6C63FF',
                borderWidth: 2
            }]
        },
        options: {
            scales: {
                r: {
                    angleLines: { color: 'rgba(255,255,255,0.1)' },
                    grid: { color: 'rgba(255,255,255,0.1)' },
                    pointLabels: { color: 'white', font: {size: 10} },
                    suggestedMin: 0,
                    suggestedMax: 10
                }
            },
            plugins: {
                legend: { display: false }
            }
        }
    });
}

window.deleteHistoryEntry = async (id, btn) => {
    if(!confirm("Delete this interview record? It will be removed from your cumulative stats.")) return;
    
    // Find parent item to remove visuals immediately
    const item = btn.closest('.history-item');
    
    try {
        const headers = await getAuthHeaders();
        const res = await fetch(`${API_BASE_URL}/interview-history/${id}`, { method: 'DELETE', headers });
        
        if(res.ok) {
            const data = await res.json();
            item.remove();
            alert("Entry deleted. Updating stats...");
            
            // Immediate UI Update using returned aggregate
            if(data.new_aggregate) {
                renderStats({
                    weaknesses: data.new_aggregate.weaknesses,
                    strengths: data.new_aggregate.strengths
                });
                renderChart({ recurring_topics: data.new_aggregate.recurring_topics });
            } else {
                loadAnalysis(); // Fallback
            } 
            // Also check if history list is empty
            const list = document.getElementById('historyList');
            if(list.children.length === 0) list.innerHTML = '<p class="placeholder-text">No interview history yet.</p>';
        } else {
            alert("Failed to delete entry.");
        }
    } catch (e) { console.error(e); }
};


// --- Feedback & Drafting ---

document.getElementById('submitFeedbackBtn').addEventListener('click', async () => {
    const text = document.getElementById('feedbackInput').value;
    if (!text) return alert("Please enter some feedback.");
    
    const btn = document.getElementById('submitFeedbackBtn');
    btn.textContent = "Analyzing...";
    btn.disabled = true;
    
    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/process-feedback`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ feedback_text: text })
        });
        
        const data = await response.json();

        if (response.ok) {
            alert("Analysis updated successfully!");
            document.getElementById('feedbackInput').value = "";
            
            // Immediate UI Update
            if(data.aggregate) {
                renderStats({
                    weaknesses: data.aggregate.weaknesses,
                    strengths: data.aggregate.strengths
                });
                renderChart({ recurring_topics: data.aggregate.recurring_topics });
                
                // Update advice
                const adviceText = document.getElementById('cumulativeAdviceText');
                if (adviceText) {
                    adviceText.textContent = data.aggregate.cumulative_advice || "Analysis updated. Keep going!";
                    adviceText.style.fontStyle = 'normal';
                } 
            } else {
                 loadAnalysis(); // Fallback
            }
            
            loadInterviewHistory(); // Refresh history list immediately
        } else {
            alert("Analysis failed.");
        }
    } catch (e) { console.error(e); alert("Error submitting feedback."); }
    finally { btn.textContent = "Analyze Session"; btn.disabled = false; }
});
console.log("Career Mail Script Loaded");


document.getElementById('draftEmailBtn').addEventListener('click', async () => {
    const context = document.getElementById('jobDescInput').value;
    const type = document.getElementById('emailType').value;
    
    const btn = document.getElementById('draftEmailBtn');
    btn.textContent = "Drafting with AI...";
    btn.disabled = true;
    
    try {
        const headers = await getAuthHeaders();
        // Send user name for better signature
        const userName = currentUser ? currentUser.displayName : "Candidate";
        
        const response = await fetch(`${API_BASE_URL}/draft-email`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ 
                job_description: context || "General Inquiry", 
                email_type: type,
                user_name: userName 
            })
        });
        
        const data = await response.json();
        if (data.subject && data.body) {
            document.getElementById('draftResult').classList.remove('hidden');
            
            // Store original result
            document.getElementById('draftResult').dataset.subject = data.subject;
            document.getElementById('draftResult').dataset.body = data.body;
            
            // Populate Textarea
            const fullText = `Subject: ${data.subject}\n\n${data.body}`;
            document.getElementById('draftContent').value = fullText;
        } else {
            alert("Failed to generate draft.");
        }
    } catch (e) { console.error(e); alert("Error generating draft."); }
    finally { btn.textContent = "Draft Email"; btn.disabled = false; }
});

// --- Edit / Save Logic ---
const editBtn = document.getElementById('editDraftBtn');
const saveBtn = document.getElementById('saveDraftBtn');
const draftArea = document.getElementById('draftContent');

if(editBtn && saveBtn && draftArea) {
    editBtn.addEventListener('click', () => {
        draftArea.removeAttribute('readonly');
        draftArea.focus();
        draftArea.style.borderColor = 'var(--primary)';
        editBtn.classList.add('hidden');
        saveBtn.classList.remove('hidden');
    });

    saveBtn.addEventListener('click', () => {
        draftArea.setAttribute('readonly', 'true');
        draftArea.style.borderColor = 'var(--border-color)';
        saveBtn.classList.add('hidden');
        editBtn.classList.remove('hidden');
        // Optional: Update dataset if we want to persit changes structurally, 
        // but normally we just parse the text area on "Create Draft"
    });
}


const createValuesBtn = document.getElementById('createGmailDraftBtn');
if (createValuesBtn) {
    createValuesBtn.addEventListener('click', async () => {
    
    const recipient = document.getElementById('recipientEmailInput').value;
    // Recipient is optional for drafts usually, but good to have
    
    // Parse current content (Edited or Original)
    const content = document.getElementById('draftContent').value;
    
    let subject = "Career Email";
    let body = content;

    // Standard format: "Subject: <Subject>\n\n<Body>"
    if (content.startsWith("Subject:")) {
        const firstLineEnd = content.indexOf('\n');
        if (firstLineEnd !== -1) {
            subject = content.substring(8, firstLineEnd).trim();
            body = content.substring(firstLineEnd).trim();
        }
    }

    const btn = document.getElementById('createGmailDraftBtn');
    const originalText = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-spinner fa-spin"></i> Creating...';
    btn.disabled = true;

    try {
        const headers = await getAuthHeaders();
        const response = await fetch(`${API_BASE_URL}/create-email-draft`, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify({ 
                recipient: recipient, 
                subject: subject, 
                body: body 
            })
        });
        
        const data = await response.json();
        if(response.ok) {
            if(data.open_link) {
                 const confirmOpen = confirm(`Draft created successfully!\n\nID: ${data.draft_id}\n\nOpen Gmail now?`);
                 if(confirmOpen) window.open(data.open_link, '_blank');
            } else {
                 alert(`Draft created successfully!`);
            }
        } else {
             if(response.status === 401 || (data.detail && data.detail.includes('expired'))) {
                 alert("Permissions Update Required: Please connect Google Account.");
             } else {
                 alert("Failed to create draft: " + JSON.stringify(data.detail));
             }
        }
    } catch(e) {
        console.error("Draft Exception:", e);
        alert("Error creating draft: " + e.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
});
}

document.getElementById('copyDraftBtn').addEventListener('click', () => {
    const text = document.getElementById('draftContent').value;
    navigator.clipboard.writeText(text);
    const btn = document.getElementById('copyDraftBtn');
    const original = btn.innerHTML;
    btn.innerHTML = '<i class="fa-solid fa-check"></i> Copied!';
    setTimeout(() => btn.innerHTML = original, 2000);
});

// Logout (Standard)
// Logout (Standard)
const logoutBtn = document.getElementById('logout-btn-sidebar') || document.getElementById('logoutBtn');
if (logoutBtn) {
    logoutBtn.addEventListener('click', () => {
        firebase.auth().signOut().then(() => {
            window.location.href = 'index.html';
        });
    });
}
