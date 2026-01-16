const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com';

let currentUser = null;
let currentRoadmapData = null; // To store the generated/fetched roadmap
let chatHistory = [];

// --- DOM Element References ---
const formCard = document.getElementById("form-card");
const resultsSection = document.getElementById("results-section");
const loadingDiv = document.getElementById("loading");
const roadmapGenerationForm = document.getElementById(
  "roadmap-generation-form"
);
const currentSkillsInput = document.getElementById("currentSkillsInput");
const currentLevelSelect = document.getElementById("currentLevel");
const goalInput = document.getElementById("goalInput");
const goalLevelSelect = document.getElementById("goalLevel");
const durationSelect = document.getElementById("duration");
const studyHoursInput = document.getElementById("studyHours");
const generateRoadmapButton = document.getElementById("generateRoadmapButton");
const imStuckButton = document.getElementById("imStuckButton");
const roadmapStatusDiv = document.getElementById("roadmap-status");
const scoreValueSpan = document.getElementById("score-value");
const scoreSummaryP = document.getElementById("score-summary");
const summaryListUl = document.getElementById("summary-list");
const timelineChartCanvas = document.getElementById("timeline-chart");
const detailedRoadmapContainer = document.getElementById(
  "detailed-roadmap-container"
);
const projectsContainer = document.getElementById("projects-container");
const coursesContainer = document.getElementById("courses-container");
const startNewRoadmapButton = document.getElementById("startNewRoadmapButton");
const regenerateRoadmapButton = document.getElementById(
  "regenerateRoadmapButton"
);
const downloadRoadmapBtn = document.getElementById("downloadRoadmapBtn");
const overallProgressBar = document.getElementById("overall-progress-bar");
const overallProgressPercentageSpan = document.getElementById(
  "overall-progress-percentage"
);
const tutorModal = document.getElementById("tutor-modal");
const closeTutorModalButton = document.getElementById("closeTutorModalButton");
const modalTopicTitle = document.getElementById("modal-topic-title");
const tutorLoadingState = document.getElementById("tutor-loading-state");
const tutorResponseContent = document.getElementById("tutor-response-content");
const analogyTextP = document.getElementById("analogy-text");
const technicalDefinitionTextDiv = document.getElementById(
  "technical-definition-text"
);
const prerequisitesListUl = document.getElementById("prerequisites-list");
const chatbotFloatButton = document.getElementById("chatbot-float-button");
const chatbotWindow = document.getElementById("chatbot-window");
const closeChatbotButton = document.getElementById("close-chatbot-button");
const chatMessagesDiv = document.getElementById("chat-messages");
const chatInput = document.getElementById("chat-input");
const chatbotForm = document.getElementById("chatbot-form");
const logoutButton = document.getElementById("logoutButton");
const personalizeRoadmapBtn = document.getElementById("personalizeRoadmapBtn");
const avgAssessmentVal = document.getElementById("avg-assessment-val");
const avgInterviewVal = document.getElementById("avg-interview-val");
const latestAtsVal = document.getElementById("latest-ats-val");
const courseProgressVal = document.getElementById("course-progress-val");
const compositeScoreVal = document.getElementById("composite-score-val");
const performanceFeedbackText = document.getElementById("performance-feedback-text");

let timelineChartInstance = null;

/**
 * Main entry point called by auth.js on successful login.
 * @param {firebase.User} user The authenticated user object.
 */
function onUserLoggedIn(user) {
  currentUser = user;
  // console.log("Roadmap page: User logged in. UID:", currentUser.uid);
  initializeEventListeners();
  loadOrCreateRoadmap();
  fetchAndAutofillSkills();
}

/**
 * Sets up all static event listeners for the page.
 */
function initializeEventListeners() {
  if (roadmapGenerationForm)
    roadmapGenerationForm.addEventListener("submit", handleGenerateRoadmap);
  if (imStuckButton)
    imStuckButton.addEventListener("click", () => toggleChatbot(true));
  if (closeTutorModalButton)
    closeTutorModalButton.addEventListener("click", () =>
      tutorModal.classList.add("hidden")
    );

  const resetFunc = () => resetRoadmapUI(true);
  if (startNewRoadmapButton)
    startNewRoadmapButton.addEventListener("click", resetFunc);
  if (regenerateRoadmapButton)
    regenerateRoadmapButton.addEventListener("click", resetFunc);
  if (downloadRoadmapBtn)
    downloadRoadmapBtn.addEventListener("click", () =>
      alert("Download functionality to be implemented.")
    );

  if (chatbotFloatButton)
    chatbotFloatButton.addEventListener("click", () => toggleChatbot(true));
  if (closeChatbotButton)
    closeChatbotButton.addEventListener("click", () => toggleChatbot(false));
  if (chatbotForm) chatbotForm.addEventListener("submit", handleChatbotSubmit);

  if (detailedRoadmapContainer) {
    detailedRoadmapContainer.addEventListener("click", handleHelpButtonClick);
    detailedRoadmapContainer.addEventListener(
      "change",
      handleTaskCheckboxChange
    );
  }

  if (logoutButton) logoutButton.addEventListener("click", handleLogout);
  if (personalizeRoadmapBtn) {
    console.log("✅ Personalize Roadmap button found, attaching listener.");
    personalizeRoadmapBtn.addEventListener("click", handlePersonalizeRoadmap);
  } else {
    console.warn("❌ Personalize Roadmap button NOT found in DOM.");
  }
}

/**
 * Fetches the user's latest roadmap from the server or shows the creation form.
 */
async function loadOrCreateRoadmap() {
  showLoading(true, null, "Checking for saved plan...");
  hideStatus(roadmapStatusDiv);

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/latest`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` },
    });

    if (response.ok) {
      const roadmap = await response.json();
      currentRoadmapData = roadmap;
      displayRoadmap(roadmap);
      formCard.classList.add("hidden");
      resultsSection.classList.remove("hidden");
      chatbotFloatButton.classList.remove("hidden");

      // NEW: Silent check for weekly auto-personalization
      checkAutoPersonalize();
    } else if (response.status === 404) {
      formCard.classList.remove("hidden");
      resultsSection.classList.add("hidden");
      chatbotFloatButton.classList.add("hidden");
    } else {
      const errorData = await response.json();
      throw new Error(errorData.detail || "Failed to load roadmap.");
    }
  } catch (error) {
    console.error("Error fetching roadmap:", error);
    // showStatus(roadmapStatusDiv, `Error: ${error.message}`, true);
    formCard.classList.remove("hidden");
    resultsSection.classList.add("hidden");
  } finally {
    showLoading(false);
  }
}

/**
 * Fetches skills from user profile to pre-fill the form.
 */
async function fetchAndAutofillSkills() {
  if (!currentUser) return;
  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
      headers: { Authorization: `Bearer ${idToken}` },
    });
    if (!response.ok) return;

    const data = await response.json();
    const content = data.resume_content;
    let autofill = "";
    if (content?.skills) {
      autofill += `Skills: ${Object.values(content.skills)
        .flat()
        .join(", ")}\n`;
    }
    if (content?.projects?.length) {
      autofill += `Projects: ${content.projects
        .map((p) => {
          // Join the description array into a single string if it exists
          const description = Array.isArray(p.description) ? p.description.join(' ') : p.description;
          // Return a formatted string with both title and description
          return `${p.title} - ${description || 'No description'}`;
        })
        .join("\n")}`; // Use a semicolon to better separate full project entries
    }
    currentSkillsInput.value = autofill;
  } catch (error) {
    console.error("Error auto-filling skills:", error);
  }
}

// Add this to your DOM Element References
const syncToGoogleBtn = document.getElementById("syncToGoogleBtn"); // Ensure this button exists in HTML

// Add this to initializeEventListeners()
if (syncToGoogleBtn) {
  syncToGoogleBtn.addEventListener("click", handleSyncToGoogle);
}

// Add this new function
async function handleSyncToGoogle() {
  if (!currentRoadmapData) {
    alert("Please generate a roadmap first!");
    return;
  }

  // 1. Retrieve the token we saved during login
  const googleAccessToken = sessionStorage.getItem('googleAccessToken');

  if (!googleAccessToken) {
    alert("Google Access Token missing. Please logout and login again to grant permissions.");
    return;
  }

  showLoading(true, syncToGoogleBtn, "Syncing to Google...");

  try {
    const idToken = await currentUser.getIdToken(); // Firebase Auth Token for backend security

    const response = await fetch(`${API_BASE_URL}/api/roadmap/sync`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        google_access_token: googleAccessToken, // Send the Google Token
        roadmap_data: currentRoadmapData        // Send the roadmap to parse
      }),
    });

    const result = await response.json();

    if (!response.ok) throw new Error(result.detail || "Sync failed");

    alert("✅ Success! " + result.message);

  } catch (error) {
    console.error("Sync Error:", error);
    alert("❌ Error: " + error.message);
  } finally {
    showLoading(false, syncToGoogleBtn, "Sync to Google Calendar");
  }
}
/**
 * Handles the form submission to generate a new roadmap.
 * @param {Event} e The form submission event.
 */
async function handleGenerateRoadmap(e) {
  e.preventDefault();
  if (!currentSkillsInput.value.trim() || !goalInput.value.trim()) {
    showStatus(roadmapStatusDiv, "Please fill in all required fields.", true);
    return;
  }

  showLoading(true, generateRoadmapButton, "Generating...");
  hideStatus(roadmapStatusDiv);

  const requestData = {
    current_skills_input: currentSkillsInput.value.trim(),
    current_level: currentLevelSelect.value,
    goal_input: goalInput.value.trim(),
    goal_level: goalLevelSelect.value,
    duration: durationSelect.value,
    study_hours: studyHoursInput.value,
  };

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/generate`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify(requestData),
    });
    const result = await response.json();
    if (!response.ok)
      throw new Error(result.detail || "Failed to generate roadmap.");

    currentRoadmapData = result;
    displayRoadmap(result);
    formCard.classList.add("hidden");
    resultsSection.classList.remove("hidden");
    chatbotFloatButton.classList.remove("hidden");
  } catch (error) {
    console.error("Error generating roadmap:", error);
    showStatus(roadmapStatusDiv, `Error: ${error.message}`, true);
  } finally {
    showLoading(false, generateRoadmapButton, "Generate My Strategic Plan");
  }
}

/**
 * Populates the entire results section with roadmap data.
 * @param {object} roadmap The roadmap data object.
 */
function displayRoadmap(roadmap) {
  if (!roadmap) return;
  if (roadmap.job_match_score) renderScore(roadmap.job_match_score);
  if (roadmap.skills_to_learn_summary)
    renderSummary(roadmap.skills_to_learn_summary);
  if (roadmap.timeline_chart_data)
    renderTimelineChart(roadmap.timeline_chart_data);
  if (roadmap.detailed_roadmap)
    renderInteractiveRoadmap(roadmap.detailed_roadmap);
  if (roadmap.suggested_projects) renderProjects(roadmap.suggested_projects);
  if (roadmap.suggested_courses) renderCourses(roadmap.suggested_courses);
  updateOverallProgressBar();
  loadPerformanceSummary();
}

/**
 * Fetches the user's performance metrics from the backend.
 */
// Global variable for modal data
let recentActivities = {};

async function loadPerformanceSummary() {
  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/performance`, {
      method: "GET",
      headers: { Authorization: `Bearer ${idToken}` }
    });
    if (!response.ok) return;
    const stats = await response.json();
    recentActivities = stats.recent_activities || {};

    if (avgAssessmentVal) avgAssessmentVal.textContent = `${Math.round(stats.avg_assessment || 0)}%`;
    if (avgInterviewVal) avgInterviewVal.textContent = `${Math.round(stats.avg_interview || 0)}%`;
    if (latestAtsVal) latestAtsVal.textContent = `${Math.round(stats.latest_ats || 0)}%`;
    if (courseProgressVal) courseProgressVal.textContent = `${Math.round(stats.completion_rate || 0)}%`;
    if (compositeScoreVal) compositeScoreVal.textContent = `${Math.round(stats.composite_score || 0)}%`;

    // Update Reasoning
    const reasonContainer = document.getElementById('roadmap-reason-container');
    const reasonText = document.getElementById('roadmap-reason-text');
    if (reasonContainer && reasonText && stats.roadmap_reason) {
      reasonText.textContent = stats.roadmap_reason;
      reasonContainer.classList.remove('hidden');
    }

    const performanceDetails = document.getElementById('performance-details');
    if (performanceDetails) performanceDetails.classList.remove('hidden');

  } catch (err) {
    console.error("Error loading performance summary:", err);
  }
}

/**
 * Modal Logic for Roadmap Page
 */
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


/**
 * Sends a request to dynamically personalize the roadmap based on performance.
 */
async function handlePersonalizeRoadmap() {
  console.log("🚀 Personalize button clicked!");
  if (!currentRoadmapData) {
    console.warn("⚠️ No roadmap data loaded yet.");
    return;
  }

  const confirmUpdate = confirm("This will analyze your progress and scores to adjust your roadmap. This might add new topics or change your project tasks. Continue?");
  if (!confirmUpdate) return;

  console.log("📊 Starting evaluation process...");
  showLoading(true, personalizeRoadmapBtn, "Analyzing Progress...");

  try {
    const idToken = await currentUser.getIdToken();
    const googleAccessToken = sessionStorage.getItem('googleAccessToken');

    console.log(`Calling API: ${API_BASE_URL}/api/roadmap/evaluate_and_update`);
    const response = await fetch(`${API_BASE_URL}/api/roadmap/evaluate_and_update`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${idToken}`
      },
      body: JSON.stringify({
        google_access_token: googleAccessToken // Optional: can be used for auto-resync
      })
    });

    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Personalization failed.");

    if (result.is_updated) {
      currentRoadmapData = result.roadmap;
      displayRoadmap(currentRoadmapData);

      // SHOW REASONING MODAL instead of alert
      showReasoningModal("Roadmap Personalized!", result.message, result.feedback);

    } else {
      showReasoningModal("No Changes Needed", result.message, "Your current progress is perfectly on track. Maintain this pace!");
    }

    if (performanceFeedbackText) {
      performanceFeedbackText.textContent = result.feedback;
      performanceFeedbackText.parentElement.classList.remove("hidden");
    }

    // If updated and we have google access, suggest re-sync
    if (result.is_updated && googleAccessToken) {
      const resync = confirm("Your roadmap changed. Would you like to re-sync it to your Google Calendar now?");
      if (resync) handleSyncToGoogle();
    }

  } catch (error) {
    console.error("Personalization Error:", error);
    alert("❌ Error: " + error.message);
  } finally {
    showLoading(false, personalizeRoadmapBtn, "Personalize My Roadmap");
  }
}

/**
 * Silent check for weekly auto-personalization.
 */
async function checkAutoPersonalize() {
  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/check_auto_personalize`, {
      method: "POST",
      headers: { Authorization: `Bearer ${idToken}` }
    });

    if (!response.ok) return;
    const result = await response.json();

    if (result.is_updated) {
      currentRoadmapData = result.roadmap;
      displayRoadmap(currentRoadmapData);

      // Show notification banner/toast
      showAutoUpdateNotification(result.message, result.feedback);
    }
  } catch (err) {
    console.error("Silent personalization check failed:", err);
  }
}

/**
 * Displays a non-intrusive notification banner for auto-updates.
 */
/**
 * Displays the Unified AI Reasoning Modal (Popup).
 */
function showReasoningModal(title, message, reasoningText) {
  // Remove existing modal if any
  const existing = document.querySelector('.reasoning-modal');
  if (existing) existing.remove();

  const modalOverlay = document.createElement('div');
  modalOverlay.className = 'reasoning-modal';

  modalOverlay.innerHTML = `
      <div class="reasoning-content">
          <i class="fas fa-brain reasoning-icon"></i>
          <h2 class="reasoning-title">${title}</h2>
          <p class="reasoning-message">${message}</p>
          
          <div class="reasoning-box">
              <span class="reasoning-label">AI Logic & Reasoning:</span>
              <p class="reasoning-text">"${reasoningText}"</p>
          </div>

          <button class="reasoning-close-btn">Understood, Continue Journey</button>
      </div>
  `;

  document.body.appendChild(modalOverlay);

  // Close Handler
  const closeBtn = modalOverlay.querySelector('.reasoning-close-btn');
  closeBtn.onclick = () => {
    modalOverlay.style.animation = 'fadeOut 0.3s ease-out';
    setTimeout(() => modalOverlay.remove(), 280);
  };
}

/**
 * Displays a non-intrusive notification banner for auto-updates.
 * @deprecated Replaced by showReasoningModal for consistency.
 */
function showAutoUpdateNotification(message, feedback) {
  showReasoningModal("Automatic Weekly Update", message, feedback);
}


/**
 * Renders the job match score and donut chart.
 * @param {object} scoreData Contains 'score' and 'summary'.
 */
function renderScore(scoreData) {
  scoreValueSpan.textContent = `${scoreData.score || 0}%`;
  const scoreCircle = document.querySelector(".score-circle");
  if (scoreCircle) {
    scoreCircle.style.background = `conic-gradient(var(--primary) ${scoreData.score * 3.6
      }deg, var(--border-color) 0deg)`;
  }
  scoreSummaryP.textContent = scoreData.summary || "N/A";
}

/**
 * Renders the list of priority skills.
 * @param {string[]} summary Array of skills.
 */
function renderSummary(summary) {
  summaryListUl.innerHTML = summary?.length
    ? summary.map((item) => `<li>${item}</li>`).join("")
    : "<li>No priority skills identified.</li>";
}

/**
 * Renders the timeline bar chart.
 * @param {object} chartData Contains 'labels' and 'durations'.
 */
function renderTimelineChart(chartData) {
  const ctx = timelineChartCanvas.getContext("2d");
  if (timelineChartInstance) timelineChartInstance.destroy();
  const styles = getComputedStyle(document.documentElement);
  timelineChartInstance = new Chart(ctx, {
    type: "bar",
    data: {
      labels: chartData.labels,
      datasets: [
        {
          label: "Duration in Weeks",
          data: chartData.durations,
          backgroundColor: styles.getPropertyValue("--primary").trim(),
        },
      ],
    },
    options: {
      indexAxis: "y",
      responsive: true,
      maintainAspectRatio: false,
      plugins: { legend: { display: false } },
      scales: {
        x: {
          beginAtZero: true,
          title: {
            display: true,
            text: "Weeks",
            color: styles.getPropertyValue("--text-light").trim(),
          },
          grid: { color: styles.getPropertyValue("--border-color").trim() },
          ticks: { color: styles.getPropertyValue("--text-muted").trim() },
        },
        y: {
          grid: { display: false },
          ticks: { color: styles.getPropertyValue("--text-muted").trim() },
        },
      },
    },
  });
}

/**
 * Renders the interactive roadmap with checkboxes.
 * @param {object[]} detailedRoadmap Array of roadmap phases.
 */
function renderInteractiveRoadmap(detailedRoadmap) {
  detailedRoadmapContainer.innerHTML = detailedRoadmap?.length
    ? detailedRoadmap
      .map(
        (phase) => `
            <div class="roadmap-phase card">
                <h4>${phase.phase_title} (${phase.phase_duration} weeks)</h4>
                <ul class="task-list">
                    ${(phase.topics || [])
            .map(
              (topic) => `
                        <li class="task-item">
                            <label class="task-label">
                                <input type="checkbox" data-phase="${phase.phase_title
                }" data-topic="${topic.name}" ${topic.is_completed ? "checked" : ""
                }>
                                <span class="task-text">${topic.name}</span>
                            </label>
                            <button class="help-btn btn secondary-btn" data-topic="${topic.name
                }"><i class="fas fa-question-circle"></i> I'm Stuck</button>
                        </li>`
            )
            .join("")}
                </ul>
            </div>`
      )
      .join("")
    : "<p>No detailed steps available.</p>";
}

/** Renders suggested projects. */
function renderProjects(projects) {
  projectsContainer.innerHTML = projects?.length
    ? projects
      .map(
        (proj) => `
            <div class="project-card card">
                <h4>${proj.project_title} <span class="tag">${proj.project_level
          }</span></h4>
                <p><strong>Skills Covered:</strong> ${proj.skills_mapped.join(
            ", "
          )}</p>
                <p>${proj.what_you_will_learn}</p>
                <strong>Implementation Plan:</strong>
                <ol>${proj.implementation_plan
            .map((step) => `<li>${step}</li>`)
            .join("")}</ol>
            </div>`
      )
      .join("")
    : "<p>No project suggestions available.</p>";
}

/** Renders recommended courses. */
function renderCourses(courses) {
  coursesContainer.innerHTML = courses?.length
    ? courses
      .map(
        (course) => `
            <div class="course-card card">
                <h4><a href="${course.url}" target="_blank" rel="noopener noreferrer">${course.course_name} <i class="fas fa-external-link-alt"></i></a></h4>
                <p><span class="tag platform-tag">${course.platform}</span></p>
                <p class="mapping">${course.mapping}</p>
            </div>`
      )
      .join("")
    : "<p>No course recommendations available.</p>";
}

/**
 * Handles checkbox changes to track and save progress.
 * @param {Event} event The change event from a checkbox.
 */
async function handleTaskCheckboxChange(event) {
  const checkbox = event.target;
  if (!checkbox.matches('input[type="checkbox"]')) return;

  const phaseTitle = checkbox.dataset.phase;
  const topicName = checkbox.dataset.topic;
  const isCompleted = checkbox.checked;

  const phase = currentRoadmapData.detailed_roadmap.find(
    (p) => p.phase_title === phaseTitle
  );
  const topic = phase?.topics.find((t) => t.name === topicName);
  if (topic) {
    topic.is_completed = isCompleted;
  }
  updateOverallProgressBar();

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(
      `${API_BASE_URL}/api/roadmap/update_task_status`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${idToken}`,
        },
        body: JSON.stringify({
          phase_title: phaseTitle,
          topic_name: topicName,
          is_completed: isCompleted,
        }),
      }
    );
    if (!response.ok) throw await response.json();
    hideStatus(roadmapStatusDiv);
  } catch (error) {
    if (topic) topic.is_completed = !isCompleted; // Revert state on error
    checkbox.checked = !isCompleted;
    updateOverallProgressBar();
    showStatus(
      roadmapStatusDiv,
      `Failed to save progress: ${error.detail || "Unknown error"}`,
      true
    );
  }
}

/**
 * Calculates and updates the UI for the overall progress bar.
 */
function updateOverallProgressBar() {
  if (!currentRoadmapData?.detailed_roadmap) {
    overallProgressPercentageSpan.textContent = "0%";
    overallProgressBar.style.width = "0%";
    return;
  }
  const allTopics = currentRoadmapData.detailed_roadmap.flatMap(
    (phase) => phase.topics || []
  );
  const completedCount = allTopics.filter((topic) => topic.is_completed).length;
  const totalCount = allTopics.length;
  const percentage =
    totalCount > 0 ? Math.round((completedCount / totalCount) * 100) : 0;
  overallProgressPercentageSpan.textContent = `${percentage}%`;
  overallProgressBar.style.width = `${percentage}%`;
}

/**
 * Resets the UI to the initial form state, clearing any displayed results.
 * @param {boolean} clearStoredData If true, clears the `currentRoadmapData` object.
 */
function resetRoadmapUI(clearStoredData = false) {
  formCard.classList.remove("hidden");
  resultsSection.classList.add("hidden");
  chatbotFloatButton.classList.add("hidden");
  chatbotWindow.classList.add("hidden");
  hideStatus(roadmapStatusDiv);

  if (clearStoredData) {
    currentRoadmapData = null;
    chatHistory = [];
    if (chatMessagesDiv) chatMessagesDiv.innerHTML = "";
  }

  if (roadmapGenerationForm) roadmapGenerationForm.reset();
  fetchAndAutofillSkills();
  updateOverallProgressBar();
}

/**
 * Toggles the main loading spinner.
 * @param {boolean} show Whether to show or hide the spinner.
 * @param {HTMLElement} [button] An optional button to disable and update text.
 * @param {string} [loadingText] Text to show on the button while loading.
 */
function showLoading(show, button = null, loadingText = "Loading...") {
  loadingDiv.classList.toggle("hidden", !show);
  if (button) {
    button.disabled = show;
    const icon = button.querySelector("i");
    const iconHTML = icon ? icon.outerHTML : "";
    if (!button.dataset.originalText) {
      button.dataset.originalText = button.textContent.trim();
    }
    button.innerHTML = show
      ? `${iconHTML} ${loadingText}`
      : `${iconHTML} ${button.dataset.originalText}`;
  }
}

/** Displays a status message (error or success). */
function showStatus(div, message, isError = false) {
  div.textContent = message;
  div.className = isError ? "status-message error" : "status-message success";
  div.classList.remove("hidden");
}

/** Hides a status message div. */
function hideStatus(div) {
  if (div) div.classList.add("hidden");
}

/** Handles user logout via Firebase. */
async function handleLogout() {
  try {
    await firebase.auth().signOut();
  } catch (error) {
    console.error("Error signing out:", error);
  }
}

// --- Tutor and Chatbot Functions (Complete) ---

async function handleHelpButtonClick(event) {
  const helpBtn = event.target.closest(".help-btn");
  if (!helpBtn) return;
  const topic = helpBtn.dataset.topic;
  if (!topic) return;

  tutorModal.classList.remove("hidden");
  tutorLoadingState.classList.remove("hidden");
  tutorResponseContent.classList.add("hidden");
  modalTopicTitle.textContent = `Explaining: ${topic}`;

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/tutor`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({ topic }),
    });
    if (!response.ok) throw await response.json();
    const data = await response.json();
    renderTutorResponse(data);
  } catch (error) {
    analogyTextP.textContent = `Could not fetch explanation. Error: ${error.detail || error.message
      }`;
    technicalDefinitionTextDiv.innerHTML = "";
    prerequisitesListUl.innerHTML = "";
    tutorResponseContent.classList.remove("hidden");
  } finally {
    tutorLoadingState.classList.add("hidden");
  }
}

function renderTutorResponse(data) {
  analogyTextP.textContent = data.analogy || "N/A";
  technicalDefinitionTextDiv.innerHTML = data.technical_definition || "N/A";
  prerequisitesListUl.innerHTML = data.prerequisites?.length
    ? data.prerequisites.map((item) => `<li>${item}</li>`).join("")
    : "<li>None specified.</li>";
  tutorResponseContent.classList.remove("hidden");
}

function toggleChatbot(show) {
  if (show) {
    chatbotWindow.classList.remove("hidden");
    chatbotFloatButton.classList.add("hidden");
    if (chatHistory.length === 0) {
      appendChatMessage(
        "model",
        "Hello! Ask me anything about your current career plan."
      );
    }
    chatInput.focus();
  } else {
    chatbotWindow.classList.add("hidden");
    chatbotFloatButton.classList.remove("hidden");
  }
}

async function handleChatbotSubmit(e) {
  e.preventDefault();
  const query = chatInput.value.trim();
  if (!query) return;

  appendChatMessage("user", query);
  chatInput.value = "";
  chatInput.disabled = true;
  const typingIndicator = appendTypingIndicator();

  try {
    const idToken = await currentUser.getIdToken();
    const response = await fetch(`${API_BASE_URL}/api/roadmap/chat`, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${idToken}`,
      },
      body: JSON.stringify({
        query,
        history: chatHistory,
        career_plan: currentRoadmapData || {},
      }),
    });
    const result = await response.json();
    if (!response.ok) throw new Error(result.detail || "Chatbot failed.");
    appendChatMessage("model", result.response);
  } catch (error) {
    appendChatMessage("model", `Sorry, I ran into an error: ${error.message}`);
  } finally {
    typingIndicator.remove();
    chatInput.disabled = false;
    chatInput.focus();
  }
}

function appendChatMessage(role, message) {
  const isUser = role === "user";
  chatHistory.push({ role, content: message });
  const messageElement = document.createElement("div");
  messageElement.classList.add("chat-message", role);
  messageElement.innerHTML = `
        <div class="msg-author">${isUser ? "You" : "AI"}:</div>
        <div class="msg-bubble">${message.replace(/\n/g, "<br>")}</div>`;
  chatMessagesDiv.appendChild(messageElement);
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
}

function appendTypingIndicator() {
  const el = document.createElement("div");
  el.classList.add("chat-message", "model", "typing-indicator");
  el.innerHTML = `
      <div class="msg-author">AI:</div>
      <div class="msg-bubble"><div class="typing-dots"><span></span><span></span><span></span></div></div>`;
  chatMessagesDiv.appendChild(el);
  chatMessagesDiv.scrollTop = chatMessagesDiv.scrollHeight;
  return el;
}
