document.addEventListener("DOMContentLoaded", () => {
    const podiumContainer = document.getElementById("podium-container");
    const leaderboardBody = document.getElementById("leaderboard-body");
    const skillFilterInput = document.getElementById("skill-filter");

    let allUsers = []; // Store fetched users for local filtering
    let selectedEmails = []; // Track selected users for comparison

    // Helper to create Podium HTML
    const createPodiumCard = (user, rank) => {
        let medalIcon = "fa-trophy";
        let rankClass = `rank-${rank}`;
        
        return `
            <div class="podium-card ${rankClass}">
                <i class="fas ${medalIcon} medal-icon"></i>
                <div class="podium-name">${user.name}</div>
                <div class="podium-score">${user.score} XP</div>
                <div class="podium-stats">
                    <p><span>Roadmaps:</span> <span>${user.stats.roadmaps_generated || 0}</span></p>
                    <p><span>Assessments:</span> <span>${user.stats.assessments_taken || 0}</span></p>
                    <p><span>Resumes:</span> <span>${user.stats.resumes_optimized || 0}</span></p>
                </div>
                <a href="mailto:${user.email}" class="contact-btn"><i class="fas fa-envelope"></i> Contact</a>
            </div>
        `;
    };

    // Helper to create Table Row HTML (Main Row + Details Row)
    const createTableRow = (user, rank) => {
        // Prepare skills HTML
        let skillsHtml = '';
        if (user.skills) {
             // flatten skills object or array
             const skillList = Array.isArray(user.skills) ? user.skills : Object.values(user.skills).flat();
             // Take top 5 unique skills
             const uniqueSkills = [...new Set(skillList)].slice(0, 5);
             skillsHtml = uniqueSkills.map(s => `<span class="skill-tag">${s}</span>`).join('');
        }

        // Helper to ensure URL is absolute
        const ensureAbsoluteUrl = (url) => {
            if (!url) return '#';
            if (url.startsWith('http://') || url.startsWith('https://')) {
                return url;
            }
            return 'https://' + url;
        };

        // Prepare Social Links
        let socialLinks = `
            <a href="mailto:${user.email}" class="profile-link email" target="_blank"><i class="fas fa-envelope"></i> Email</a>
        `;
        if (user.linkedin) {
            socialLinks += `<a href="${ensureAbsoluteUrl(user.linkedin)}" class="profile-link linkedin" target="_blank"><i class="fab fa-linkedin"></i> LinkedIn</a>`;
        }
        if (user.github) {
            socialLinks += `<a href="${ensureAbsoluteUrl(user.github)}" class="profile-link github" target="_blank"><i class="fab fa-github"></i> GitHub</a>`;
        }

        return `
            <!-- Main Row -->
            <tr class="user-row">
                <td>
                    <input type="checkbox" class="compare-checkbox" 
                           data-email="${user.email}" 
                           onchange="toggleSelection(this, '${user.email}')">
                </td>
                <td><span class="rank-badge">${rank}</span></td>
                <td>
                    <div style="font-weight: 600;">${user.name}</div>
                    <div style="font-size: 0.8rem; color: #8E8C99;">${user.email}</div>
                </td>
                <td style="color: #8A49FF; font-weight: 700;">${user.score}</td>
                <td>${user.stats.roadmaps_generated || 0}</td>
                <td>${user.stats.assessments_taken || 0}</td>
                <td>
                    <button class="toggle-details-btn" onclick="toggleDetails(this)">
                        <i class="fas fa-chevron-down"></i>
                    </button>
                </td>
            </tr>
            <!-- Details Row (Hidden by default) -->
            <tr class="details-row">
                <td colspan="7" style="padding: 0; border: none;">
                    <div class="details-content-wrapper">
                        <div class="details-content">
                            <div class="profile-section">
                                <h4>Connect</h4>
                                <div class="profile-links">
                                    ${socialLinks}
                                </div>
                            </div>
                            <div class="profile-section">
                                <h4>Top Skills</h4>
                                <div class="skills-tags">
                                    ${skillsHtml || '<span style="color: #8E8C99; font-size: 0.9rem;">No specific skills listed.</span>'}
                                </div>
                            </div>
                        </div>
                    </div>
                </td>
            </tr>
        `;
    };

    // Global function for toggle (needs to be on window to access from onclick attribute)
    window.toggleDetails = (btn) => {
        const row = btn.closest('tr'); // The main row
        const detailsRow = row.nextElementSibling; // The details row immediately after
        
        btn.classList.toggle('active');
        detailsRow.classList.toggle('active');
    };

    const renderLeaderboard = (users) => {
         // 1. Render Podium (Top 3)
         const top3 = users.slice(0, 3);
         podiumContainer.innerHTML = top3.map((user, index) => createPodiumCard(user, index + 1)).join("");

         // 2. Render List (Everyone else, starting from rank 4)
         const rest = users.slice(3);
         if (rest.length > 0) {
             leaderboardBody.innerHTML = rest.map((user, index) => createTableRow(user, index + 4)).join("");
         } else {
             leaderboardBody.innerHTML = `<tr><td colspan="6" style="text-align:center; padding: 2rem; color: #8E8C99;">No contenders matched your criteria.</td></tr>`;
         }
    };

    const filterUsers = (query) => {
        if (!query) {
            renderLeaderboard(allUsers);
            return;
        }

        const lowerQuery = query.toLowerCase();
        const filtered = allUsers.filter(user => {
            // Check skills
            let hasSkill = false;
            if (user.skills) {
                const skillList = Array.isArray(user.skills) ? user.skills : Object.values(user.skills).flat();
                hasSkill = skillList.some(s => s.toLowerCase().includes(lowerQuery));
            }
            // Check name
            const nameMatch = user.name.toLowerCase().includes(lowerQuery);
            
            return hasSkill || nameMatch;
        });

        renderLeaderboard(filtered);
    };

    skillFilterInput.addEventListener('input', (e) => {
        filterUsers(e.target.value);
    });

    const fetchLeaderboard = async (user) => {
        try {
            const token = await user.getIdToken();
            const response = await fetch("http://127.0.0.1:8000/api/leaderboard/", {
                headers: {
                    "Authorization": `Bearer ${token}`
                }
            });

            if (!response.ok) throw new Error("Failed to fetch leaderboard");

            allUsers = await response.json();
            renderLeaderboard(allUsers);

        } catch (error) {
            console.error(error);
            podiumContainer.innerHTML = `<p style="color:red">Error loading leaderboard.</p>`;
        }
    };

    firebase.auth().onAuthStateChanged((user) => {
        if (user) {
            fetchLeaderboard(user);
        } else {
             // Auth redirect handled by auth.js
        }
    });

    // Comparison Logic
    const compareBtn = document.getElementById("compare-btn");
    const comparisonModal = document.getElementById("comparison-modal");
    const closeComparisonBtn = document.getElementById("close-comparison");
    const comparisonBody = document.getElementById("comparison-body");

    window.toggleSelection = (checkbox, email) => {
        if (checkbox.checked) {
            if (selectedEmails.length >= 2) {
                checkbox.checked = false;
                alert("You can only compare 2 users at a time.");
                return;
            }
            selectedEmails.push(email);
        } else {
            selectedEmails = selectedEmails.filter(e => e !== email);
        }
        updateCompareButton();
    };

    const updateCompareButton = () => {
        const count = selectedEmails.length;
        compareBtn.innerHTML = `<i class="fas fa-balance-scale"></i> Compare Selected (${count}/2)`;
        compareBtn.disabled = count !== 2;
    };

    compareBtn.addEventListener("click", async () => {
        if (selectedEmails.length !== 2) return;

        // Open Modal
        comparisonModal.classList.add("active");
        comparisonBody.innerHTML = `
            <div class="loading-spinner">
                <i class="fas fa-circle-notch fa-spin"></i> Analyzing profiles with AI...
            </div>
        `;

        // Find user objects
        const user1 = allUsers.find(u => u.email === selectedEmails[0]);
        const user2 = allUsers.find(u => u.email === selectedEmails[1]);
        
        if (!user1 || !user2) return;

        try {
            const user = firebase.auth().currentUser;
            const token = await user.getIdToken();

            const response = await fetch("http://127.0.0.1:8000/api/leaderboard/compare", {
                method: "POST",
                headers: {
                    "Content-Type": "application/json",
                    "Authorization": `Bearer ${token}`
                },
                body: JSON.stringify({ user1, user2 })
            });

            if (!response.ok) throw new Error("Comparison failed");

            const data = await response.json();
            renderComparisonResult(data, user1.name, user2.name);

        } catch (error) {
            console.error(error);
            comparisonBody.innerHTML = `<p style="color:red; text-align:center;">Failed to generate comparison. Please try again.</p>`;
        }
    });

    const renderComparisonResult = (data, name1, name2) => {
        comparisonBody.innerHTML = `
            <div class="comparison-grid">
                <div class="candidate-col">
                    <h3>${name1}</h3>
                    <div class="comparison-section">
                        <h4>Top Strengths</h4>
                        <ul>
                            ${data.user1_strengths.map(s => `<li><i class="fas fa-check" style="color:#4caf50; margin-right:8px;"></i>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
                <div class="candidate-col">
                    <h3>${name2}</h3>
                    <div class="comparison-section">
                        <h4>Top Strengths</h4>
                        <ul>
                            ${data.user2_strengths.map(s => `<li><i class="fas fa-check" style="color:#4caf50; margin-right:8px;"></i>${s}</li>`).join('')}
                        </ul>
                    </div>
                </div>
            </div>
            
            <div class="comparison-section">
                <h4><i class="fas fa-equals"></i> Common Skills</h4>
                <div class="skills-tags">
                     ${data.common_skills.length ? data.common_skills.map(s => `<span class="skill-tag">${s}</span>`).join('') : '<span style="color:#888">No exact skill matches found.</span>'}
                </div>
            </div>

             <div class="comparison-section">
                <h4><i class="fas fa-compress-arrows-alt"></i> Comparison Summary</h4>
                <p>${data.comparison_summary}</p>
            </div>

            <div class="recommendation-box">
                <h4><i class="fas fa-lightbulb"></i> Artificial Intelligence Recommendation</h4>
                <p>${data.recommendation}</p>
            </div>
        `;
    };

    closeComparisonBtn.addEventListener("click", () => {
        comparisonModal.classList.remove("active");
    });

    window.addEventListener("click", (e) => {
        if (e.target === comparisonModal) {
            comparisonModal.classList.remove("active");
        }
    });

});