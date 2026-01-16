const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:8000/api' 
    : 'https://career-coach-ai-3xap.onrender.com/api';

document.addEventListener('DOMContentLoaded', () => {
    // Auth check handled by auth.js
    loadTrends();
    loadViability(); // New call
    createParticles();
    
    // Wire up Sync Button
    document.getElementById("syncBtn").addEventListener("click", handleSync);
});

// ... (Particle Animation & loadTrends remain largely same, just adding new functions below)

async function loadViability() {
    const grid = document.getElementById("viabilityGrid");
    
    try {
        const response = await fetch(`${API_BASE_URL}/trends/viability`);
        const result = await response.json();
        
        if (result.success && result.data) {
            renderViability(result.data);
        } else {
             grid.innerHTML = `<p class="error-msg">Could not load historical analysis.</p>`;
        }
    } catch (error) {
        console.error("Viability load failed:", error);
        grid.innerHTML = `<p class="error-msg">Analysis unavailable.</p>`;
    }
}

function renderViability(data) {
    const grid = document.getElementById("viabilityGrid");
    
    // Group by category
    const categories = {
        "Long-Term Staple": [],
        "Emerging High-Growth": [],
        "Stable / Niche": [],
        "Fad / Risky": []
    };
    
    data.forEach(item => {
        if (!categories[item.category]) categories[item.category] = [];
        categories[item.category].push(item);
    });
    
    let html = '<div class="viability-dashboard">';
    
    // Render each category as a column
    for (const [catName, items] of Object.entries(categories)) {
        if (items.length === 0) continue;
        
        let colorClass = "";
        if (catName.includes("Staple")) colorClass = "cat-staple";
        else if (catName.includes("Growth")) colorClass = "cat-growth";
        else if (catName.includes("Risky")) colorClass = "cat-risky";
        else colorClass = "cat-stable";
        
        html += `
            <div class="viability-col ${colorClass}">
                <h4>${catName}</h4>
                <div class="viability-list">
                    ${items.map(item => `
                        <div class="viability-item">
                            <span class="v-keyword">${item.keyword}</span>
                            <span class="v-stats">
                                <i class="fas fa-chart-line"></i> ${Math.round(item.avg_interest)}% avg
                            </span>
                        </div>
                    `).join('')}
                </div>
            </div>
        `;
    }
    html += '</div>';
    
    grid.innerHTML = html;
}

async function handleSync() {
    const btn = document.getElementById("syncBtn");
    const originalText = btn.innerHTML;
    
    if(!confirm("This triggers a 5-year data fetch and bulk load to BigQuery. Continue?")) return;
    
    try {
        btn.innerHTML = `<i class="fas fa-spinner fa-spin"></i> Syncing...`;
        btn.disabled = true;
        
        const user = firebase.auth().currentUser;
        if (!user) throw new Error("Must be logged in to sync.");
        
        const token = await user.getIdToken();
        const response = await fetch(`${API_BASE_URL}/trends/sync`, {
            method: "POST",
             headers: {
                'Authorization': `Bearer ${token}`
            }
        });
        
        const result = await response.json();
        if (result.success) {
            alert("Sync Complete: " + result.message);
            loadViability(); // Refresh view
        } else {
            alert("Sync Failed: " + (result.detail || "Unknown error"));
        }
        
    } catch (error) {
        console.error(error);
        alert("Sync Error: " + error.message);
    } finally {
        btn.innerHTML = originalText;
        btn.disabled = false;
    }
}

// ... (renderChart, renderInsights remain)

// Sidebar Logout (matches other pages)
document.getElementById('logout-btn-sidebar').addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
    });
});

// --- Particle Animation (Copied from home.js for consistency) ---
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

async function loadTrends() {
    const statusMsg = document.getElementById("statusMsg");
    const insightsGrid = document.getElementById("insightsGrid");

    try {
        // 1. Fetch Market Trends for Chart
        const marketResponse = await fetch(`${API_BASE_URL}/trends/market`);
        const marketResult = await marketResponse.json();

        if (marketResult.success) {
            statusMsg.style.display = "none";
            renderChart(marketResult.data);
        } else {
            statusMsg.innerText = "Unable to load market data.";
        }

        // 2. Fetch Personal Insights (requires token)
        const user = firebase.auth().currentUser;
        if (user) {
            user.getIdToken().then(async (token) => {
                const insightsResponse = await fetch(`${API_BASE_URL}/trends/personal-insights`, {
                    headers: {
                        'Authorization': `Bearer ${token}`
                    }
                });
                const insightsResult = await insightsResponse.json();
                
                if (insightsResult.success) {
                    renderInsights(insightsResult.data);
                } else {
                    insightsGrid.innerHTML = `<p class="error-msg">Could not load personal insights: ${insightsResult.message || "Unknown error"}</p>`;
                }
            });
        } else {
             // Retry once if auth not ready (though auth.js should handle redirect)
             setTimeout(() => {
                 const userRetry = firebase.auth().currentUser;
                 if(userRetry) loadTrends();
             }, 1000);
        }

    } catch (error) {
        console.error(error);
        statusMsg.innerText = "Server unavailable. Is the backend running?";
        statusMsg.style.display = "block";
    }
}

function renderChart(data) {
    const ctx = document.getElementById("skillsChart").getContext("2d");
    const labels = data.map((item) => item.keyword);
    const values = data.map((item) => item.interest_value);

    new Chart(ctx, {
        type: "bar",
        data: {
            labels: labels,
            datasets: [
                {
                    label: "Global Interest Index (12 Months)",
                    data: values,
                    backgroundColor: [
                        "#8A49FF",  // Primary
                        "#00EAD3",   // Cyan accent
                        "#FF5E5E",   // Red accent
                        "#FFC542", // Yellow
                        "#1A73E8"  // Blue
                    ],
                    borderRadius: 8,
                    borderSkipped: false,
                },
            ],
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            plugins: {
                legend: { display: false },
                tooltip: {
                    backgroundColor: '#1E1E24',
                    titleColor: '#fff',
                    bodyColor: '#A0A0A5',
                    titleFont: { family: 'Inter', size: 14 },
                    bodyFont: { family: 'Inter', size: 13 },
                    padding: 10,
                    cornerRadius: 8,
                    callbacks: {
                        label: function(context) {
                            return ` Interest: ${context.parsed.y}`;
                        }
                    }
                }
            },
            scales: {
                y: {
                    beginAtZero: true,
                    max: 100,
                    grid: { color: "rgba(255, 255, 255, 0.05)" },
                    ticks: { color: "#A0A0A5", font: { family: "Inter" } }
                },
                x: {
                    grid: { display: false },
                    ticks: { color: "#FFF", font: { family: "Inter", weight: "600" } }
                },
            },
            animation: {
                duration: 1500,
                easing: 'easeOutQuart'
            }
        },
    });
}

function renderInsights(data) {
    const grid = document.getElementById("insightsGrid");
    grid.innerHTML = ""; 

    // data structure: { analysis_summary: "...", recommendations: [...] }
    
    // Add Summary
    const summaryDiv = document.createElement("div");
    summaryDiv.className = "insights-summary";
    summaryDiv.innerHTML = `
        <h3><i class="fas fa-robot"></i> AI Analysis</h3>
        <p>${data.analysis_summary}</p>
    `;
    grid.appendChild(summaryDiv);

    // Add Cards
    if (data.recommendations && data.recommendations.length > 0) {
        const cardsContainer = document.createElement("div");
        cardsContainer.className = "recommendation-cards";
        
        data.recommendations.forEach((rec, index) => {
             const card = document.createElement("div");
             card.className = "rec-card";
             card.innerHTML = `
                <div class="rec-header">
                    <span class="rec-number">0${index + 1}</span>
                    <h4>${rec.skill}</h4>
                </div>
                <div class="rec-body">
                    <p class="trend-reason"><i class="fas fa-fire"></i> ${rec.trend_relevance}</p>
                    <p class="learning-path"><i class="fas fa-lightbulb"></i> ${rec.learning_path}</p>
                </div>
             `;
             cardsContainer.appendChild(card);
        });
        grid.appendChild(cardsContainer);
    }
}

// Sidebar Logout (matches other pages)
document.getElementById('logout-btn-sidebar').addEventListener('click', () => {
    firebase.auth().signOut().then(() => {
        window.location.href = 'index.html';
    });
});
