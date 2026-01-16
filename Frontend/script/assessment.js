const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com'; // Update this if your backend is hosted elsewhere

let currentUser = null;
let assessmentQuestions = [];
let currentQuestionIndex = 0;
let userAnswers = [];

// --- Predefined Assessment Data ---
const predefinedAssessments = {
    "software_developer": {
        skills: "Python, JavaScript, Data Structures, Algorithms, Git, REST APIs, HTML, CSS, Software Design Principles, Unit Testing",
        targetRolePlaceholder: "e.g., Junior Software Engineer, Senior Backend Developer"
    },
    "data_scientist": {
        skills: "Python, R, SQL, Machine Learning, Statistics, Data Visualization, Deep Learning, A/B Testing, Predictive Modeling",
        targetRolePlaceholder: "e.g., Entry-level Data Scientist, Lead AI/ML Researcher"
    },
    "cybersecurity_analyst": {
        skills: "Network Security, Cryptography, Incident Response, Linux, Python Scripting, SIEM, Vulnerability Assessment, Threat Intelligence, Compliance",
        targetRolePlaceholder: "e.g., Cybersecurity Analyst, Security Engineer"
    },
    "cloud_engineer": {
        skills: "AWS, Azure, GCP, Docker, Kubernetes, CI/CD, Infrastructure as Code (Terraform), Networking, System Administration",
        targetRolePlaceholder: "e.g., Cloud DevOps Engineer, Azure Solutions Architect"
    },
    "custom": {
        skills: "", // User will input custom skills
        targetRolePlaceholder: "Your custom target role (e.g., UX Designer, Blockchain Developer)"
    }
};


// --- DOM Element References ---
const assessmentSetupSection = document.getElementById('assessment-setup-section');
const activeAssessmentSection = document.getElementById('active-assessment-section');
const assessmentResultsSection = document.getElementById('assessment-results-section');
const loadingDiv = document.getElementById('loading');

// Setup Form Elements
const assessmentSetupForm = document.getElementById('assessment-setup-form');
const assessmentTypeSelect = document.getElementById('assessment-type-select');
const skillsToAssessTextarea = document.getElementById('skills-to-assess');
const targetRoleInput = document.getElementById('target-role');
const startAssessmentBtn = document.getElementById('start-assessment-btn');
const setupStatusMessageDiv = document.getElementById('setup-status-message');

// Active Assessment Elements
const prevQuestionBtn = document.getElementById('prev-question-btn');
const nextQuestionBtn = document.getElementById('next-question-btn');
const progressBar = document.getElementById('progress-bar');
const currentQuestionCountSpan = document.getElementById('current-question-count');
const questionTextH3 = document.getElementById('question-text');
const questionOptionsDiv = document.getElementById('question-options');
const questionShortAnswerTextarea = document.getElementById('question-short-answer');
const assessmentStatusMessageDiv = document.getElementById('assessment-status-message');

// Results Elements
const overallScoreP = document.getElementById('overall-score');
const skillsMasteredP = document.getElementById('skills-mastered');
const areasToImproveP = document.getElementById('areas-to-improve');
const skillBreakdownChartCanvas = document.getElementById('skill-breakdown-chart');
const strengthsListUl = document.getElementById('strengths-list');
const weaknessesListUl = document.getElementById('weaknesses-list');
const recommendationsListUl = document.getElementById('recommendations-list');
const retakeAssessmentBtn = document.getElementById('retake-assessment-btn');
const resultsStatusMessageDiv = document.getElementById('results-status-message');

const logoutButton = document.getElementById('logoutButton');

let skillBreakdownChartInstance = null;

function onUserLoggedIn(user) {
    currentUser = user;

    // Initial setup for the form
    initializeAssessmentSetupForm();

    // Event Listeners
    assessmentSetupForm.addEventListener('submit', handleStartAssessment);
    nextQuestionBtn.addEventListener('click', handleNextQuestion);
    prevQuestionBtn.addEventListener('click', handlePreviousQuestion);
    retakeAssessmentBtn.addEventListener('click', resetAssessmentUI);
    
    assessmentTypeSelect.addEventListener('change', updateSkillsAndRolePlaceholder);

    if (logoutButton) {
        logoutButton.addEventListener('click', handleLogout);
    }
}

function initializeAssessmentSetupForm() {
    // Attempt to autofill skills from profile first
    fetchAndAutofillSkills(); // This will fill the textarea if data is available

    // Set default placeholder for target role
    targetRoleInput.placeholder = predefinedAssessments.custom.targetRolePlaceholder;
    
    // If the textarea is empty after autofill, or if 'custom' is selected by default,
    // ensure the skills textarea is enabled for editing.
    if (!skillsToAssessTextarea.value.trim() || assessmentTypeSelect.value === 'custom') {
        skillsToAssessTextarea.disabled = false;
    }
}


async function fetchAndAutofillSkills() {
    if (!currentUser) {
        return;
    }

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/user/profile`, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`,
                'Content-Type': 'application/json'
            }
        });
        const data = await response.json();

        if (!response.ok) {
            console.warn('Failed to fetch profile/resume for autofill, user can still input manually.');
            return;
        }

        const resumeContent = data.resume_content;
        let allSkills = [];
        if (resumeContent && resumeContent.skills) {
            for (const category in resumeContent.skills) {
                allSkills = allSkills.concat(resumeContent.skills[category]);
            }
        }
        if (allSkills.length > 0) {
            skillsToAssessTextarea.value = allSkills.join(', ');
            // If we autofilled, set assessment type to custom and enable editing
            assessmentTypeSelect.value = 'custom';
            skillsToAssessTextarea.disabled = false;
            targetRoleInput.placeholder = predefinedAssessments.custom.targetRolePlaceholder;
        }
        
        // console.log('Skills autofilled from resume (if available).');
    } catch (error) {
        console.warn(error);
    }
}

function updateSkillsAndRolePlaceholder() {
    const selectedType = assessmentTypeSelect.value;
    const data = predefinedAssessments[selectedType];

    if (data) {
        skillsToAssessTextarea.value = data.skills;
        targetRoleInput.placeholder = data.targetRolePlaceholder;

        // If 'custom' is selected, enable skills textarea for editing
        skillsToAssessTextarea.disabled = (selectedType !== 'custom');
    } else {
        // Fallback if somehow an invalid option is selected
        skillsToAssessTextarea.value = '';
        skillsToAssessTextarea.disabled = false;
        targetRoleInput.placeholder = predefinedAssessments.custom.targetRolePlaceholder;
    }
}


async function handleStartAssessment(e) {
    e.preventDefault();
    if (!currentUser) {
        showStatus(setupStatusMessageDiv, 'User not authenticated. Please log in.', true);
        return;
    }

    const selectedAssessmentType = assessmentTypeSelect.value;
    const skills = skillsToAssessTextarea.value.trim();
    const targetRole = targetRoleInput.value.trim();

    if (!selectedAssessmentType || !skills) {
        showStatus(setupStatusMessageDiv, 'Please select an assessment type and ensure skills are entered.', true);
        return;
    }

    showLoading(true, startAssessmentBtn, "Generating Questions...");
    showStatus(setupStatusMessageDiv, '', false, true); // Clear previous messages

    const assessmentRequestData = {
        assessment_type: selectedAssessmentType,
        skills: skills.split(',').map(s => s.trim()).filter(s => s !== ''),
        target_role: targetRole
    };

    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/assessment/start`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(assessmentRequestData)
        });

        const result = await response.json();

        if (response.ok) {
            assessmentQuestions = result.questions;
            userAnswers = Array(assessmentQuestions.length).fill(null);
            currentQuestionIndex = 0;
            if (assessmentQuestions.length > 0) {
                assessmentSetupSection.classList.add('hidden');
                activeAssessmentSection.classList.remove('hidden');
                renderQuestion();
            } else {
                showStatus(setupStatusMessageDiv, 'No questions could be generated for the specified skills. Please try again.', true);
            }
        } else {
            throw new Error(result.detail || result.message || 'Failed to start assessment.');
        }
    } catch (error) {
        console.error('Error starting assessment:', error);
        showStatus(setupStatusMessageDiv, `Error: ${error.message}`, true);
    } finally {
        showLoading(false, startAssessmentBtn, "Start Assessment");
    }
}

/**
 * Renders the current question and updates UI.
 */
function renderQuestion() {
    const question = assessmentQuestions[currentQuestionIndex];
    if (!question) {
        console.error("No question to render at index:", currentQuestionIndex);
        return;
    }

    questionTextH3.textContent = question.question_text;
    currentQuestionCountSpan.textContent = `Question ${currentQuestionIndex + 1} of ${assessmentQuestions.length}`;
    updateProgressBar();
    hideStatus(assessmentStatusMessageDiv);

    questionOptionsDiv.innerHTML = '';
    questionShortAnswerTextarea.classList.add('hidden');
    // FIX: Remove old listener to prevent memory leaks if this function is called multiple times for the same question type
    questionShortAnswerTextarea.removeEventListener('input', captureAnswer);

    if (question.question_type === 'multiple_choice' || question.question_type === 'single_choice') {
        questionOptionsDiv.classList.remove('hidden');
        question.options.forEach((option, index) => {
            const inputType = question.question_type === 'single_choice' ? 'radio' : 'checkbox';
            const optionId = `option-${currentQuestionIndex}-${index}`;
            const isChecked = Array.isArray(userAnswers[currentQuestionIndex]) 
                ? userAnswers[currentQuestionIndex].includes(option)
                : userAnswers[currentQuestionIndex] === option;
            
            // FIX: Changed HTML structure to match CSS for custom radio/checkbox styling and improve accessibility
            questionOptionsDiv.innerHTML += `
                <label for="${optionId}" class="option-item">
                    <input type="${inputType}" id="${optionId}" name="question-${currentQuestionIndex}" value="${option}" ${isChecked ? 'checked' : ''}>
                    <span>${option}</span>
                </label>
            `;
        });
        questionOptionsDiv.querySelectorAll(`input[name="question-${currentQuestionIndex}"]`).forEach(input => {
            input.addEventListener('change', captureAnswer);
        });

    } else if (question.question_type === 'short_answer' || question.question_type === 'coding_challenge') {
        questionOptionsDiv.classList.add('hidden');
        questionShortAnswerTextarea.classList.remove('hidden');
        questionShortAnswerTextarea.value = userAnswers[currentQuestionIndex] || '';
        // FIX: Add event listener to capture short answer text as user types
        questionShortAnswerTextarea.addEventListener('input', captureAnswer);
    }

    prevQuestionBtn.disabled = currentQuestionIndex === 0;
    nextQuestionBtn.textContent = (currentQuestionIndex === assessmentQuestions.length - 1) 
        ? "Submit Assessment" 
        : "Next";
    nextQuestionBtn.querySelector('i').className = (currentQuestionIndex === assessmentQuestions.length - 1) 
        ? "fas fa-check-circle" 
        : "fas fa-arrow-right";
}


function captureAnswer() {
    const question = assessmentQuestions[currentQuestionIndex];
    if (!question) return;

    if (question.question_type === 'short_answer' || question.question_type === 'coding_challenge') {
        userAnswers[currentQuestionIndex] = questionShortAnswerTextarea.value;
    } else {
        const selectedOptions = Array.from(
            questionOptionsDiv.querySelectorAll(`input[name="question-${currentQuestionIndex}"]:checked`)
        ).map(input => input.value);

        if (question.question_type === 'single_choice') {
            userAnswers[currentQuestionIndex] = selectedOptions[0] || null;
        } else if (question.question_type === 'multiple_choice') {
            userAnswers[currentQuestionIndex] = selectedOptions;
        }
    }
    // console.log("Answer for question", currentQuestionIndex + 1, ":", userAnswers[currentQuestionIndex]);
}

async function handleNextQuestion() {
    captureAnswer();

    const currentAnswer = userAnswers[currentQuestionIndex];
    if (currentAnswer === null || (Array.isArray(currentAnswer) && currentAnswer.length === 0) || (typeof currentAnswer === 'string' && currentAnswer.trim() === '')) {
        showStatus(assessmentStatusMessageDiv, 'Please answer the current question before proceeding.', true);
        return;
    }

    if (currentQuestionIndex < assessmentQuestions.length - 1) {
        currentQuestionIndex++;
        renderQuestion();
    } else {
        await handleSubmitAssessment();
    }
}

function handlePreviousQuestion() {
    captureAnswer();
    if (currentQuestionIndex > 0) {
        currentQuestionIndex--;
        renderQuestion();
    }
}

function updateProgressBar() {
    const progress = ((currentQuestionIndex + 1) / assessmentQuestions.length) * 100;
    progressBar.style.width = `${progress}%`;
}

async function handleSubmitAssessment() {
    const submitButtonText = "Submit Assessment";
    showLoading(true, nextQuestionBtn, "Submitting...");
    hideStatus(assessmentStatusMessageDiv);

    const answersPayload = {
        // The backend should generate a unique ID. Using UID is not ideal for multiple assessments.
        // Assuming this is the expected behavior based on original code.
        assessment_id: currentUser.uid, 
        answers: userAnswers.map((answer, index) => ({
            question_id: assessmentQuestions[index].question_id,
            answer: answer
        }))
    };
    
    try {
        const idToken = await currentUser.getIdToken();
        const response = await fetch(`${API_BASE_URL}/api/assessment/submit`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${idToken}`
            },
            body: JSON.stringify(answersPayload)
        });

        const result = await response.json();

        if (response.ok) {
            displayResults(result);
            activeAssessmentSection.classList.add('hidden');
            assessmentResultsSection.classList.remove('hidden');
        } else {
            throw new Error(result.detail || result.message || 'Failed to submit assessment.');
        }
    } catch (error) {
        console.error('Error submitting assessment:', error);
        showStatus(assessmentStatusMessageDiv, `Error: ${error.message}`, true);
    } finally {
        showLoading(false, nextQuestionBtn, submitButtonText);
    }
}

function displayResults(results) {
    overallScoreP.textContent = `${results.overall_score || 0}%`;
    skillsMasteredP.textContent = results.skills_mastered || 0;
    areasToImproveP.textContent = results.areas_to_improve || 0;

    strengthsListUl.innerHTML = results.strengths 
        ? results.strengths.map(s => `<li class="strength"><i class="fas fa-plus-circle"></i> ${s}</li>`).join('')
        : '<li>No specific strengths identified.</li>';
    weaknessesListUl.innerHTML = results.weaknesses
        ? results.weaknesses.map(w => `<li class="weakness"><i class="fas fa-minus-circle"></i> ${w}</li>`).join('')
        : '<li>No specific weaknesses identified.</li>';
    recommendationsListUl.innerHTML = results.recommendations
        ? results.recommendations.map(r => `<li><i class="fas fa-lightbulb"></i> ${r}</li>`).join('')
        : '<li>No recommendations available at this time.</li>';

    if (results.skill_scores) {
        renderSkillBreakdownChart(results.skill_scores);
    }
}

function renderSkillBreakdownChart(skillScores) {
    const ctx = skillBreakdownChartCanvas.getContext('2d');
    if (skillBreakdownChartInstance) {
        skillBreakdownChartInstance.destroy();
    }

    const labels = Object.keys(skillScores);
    const data = Object.values(skillScores);

    const primaryGenaiColor = getComputedStyle(document.documentElement).getPropertyValue('--primary').trim();
    const textLight = getComputedStyle(document.documentElement).getPropertyValue('--text-light').trim();
    const textMedium = getComputedStyle(document.documentElement).getPropertyValue('--text-muted').trim();
    const borderDark = getComputedStyle(document.documentElement).getPropertyValue('--border-color').trim();
    const cardBgDark = getComputedStyle(document.documentElement).getPropertyValue('--bg-card').trim();

    skillBreakdownChartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: labels,
            datasets: [{
                label: 'Your Proficiency',
                data: data,
                backgroundColor: `${primaryGenaiColor}40`, // 40 is hex for 25% opacity
                borderColor: primaryGenaiColor,
                borderWidth: 2,
                pointBackgroundColor: primaryGenaiColor,
                pointBorderColor: '#fff',
                pointHoverBackgroundColor: '#fff',
                pointHoverBorderColor: primaryGenaiColor
            }]
        },
        options: {
            responsive: true,
            maintainAspectRatio: false,
            elements: { line: { borderWidth: 3 } },
            plugins: {
                legend: { display: true, labels: { color: textLight } },
                tooltip: {
                    titleColor: textLight,
                    bodyColor: textMedium,
                    backgroundColor: cardBgDark,
                    borderColor: primaryGenaiColor,
                    borderWidth: 1
                }
            },
            scales: {
                r: {
                    angleLines: { color: borderDark },
                    grid: { color: borderDark },
                    pointLabels: { color: textMedium, font: { size: 12 } },
                    ticks: {
                        backdropColor: cardBgDark,
                        color: textLight,
                        beginAtZero: true,
                        max: 100,
                        min: 0,
                        stepSize: 25
                    }
                }
            }
        }
    });
}


function resetAssessmentUI() {
    assessmentSetupSection.classList.remove('hidden');
    activeAssessmentSection.classList.add('hidden');
    assessmentResultsSection.classList.add('hidden');
    loadingDiv.classList.add('hidden');

    assessmentQuestions = [];
    currentQuestionIndex = 0;
    userAnswers = [];

    assessmentSetupForm.reset();
    initializeAssessmentSetupForm();

    overallScoreP.textContent = '--%';
    skillsMasteredP.textContent = '0';
    areasToImproveP.textContent = '0';
    strengthsListUl.innerHTML = '';
    weaknessesListUl.innerHTML = '';
    recommendationsListUl.innerHTML = '';
    if (skillBreakdownChartInstance) {
        skillBreakdownChartInstance.destroy();
        skillBreakdownChartInstance = null;
    }

    hideAllStatusMessages();
}

/**
 * REFACTORED: Simplified and fixed the button loading state logic.
 * @param {boolean} show - Whether to show the loading state.
 * @param {HTMLElement} button - The button element to modify.
 * @param {string} text - The text to display on the button (loading text or original text).
 */
function showLoading(show, button, text) {
    loadingDiv.classList.toggle('hidden', !show);

    const buttonIcon = button.querySelector('i');
    const iconHtml = buttonIcon ? buttonIcon.outerHTML : '';
    
    button.disabled = show;
    button.innerHTML = `${iconHtml} ${text}`.trim();

    if (show) {
        // Disable all major buttons during an async operation
        if (prevQuestionBtn) prevQuestionBtn.disabled = true;
        if (nextQuestionBtn) nextQuestionBtn.disabled = true;
        if (startAssessmentBtn) startAssessmentBtn.disabled = true;
        if (retakeAssessmentBtn) retakeAssessmentBtn.disabled = true;
        if (logoutButton) logoutButton.disabled = true;
    } else {
        // Restore button states based on the current context, not just enabling all
        if (startAssessmentBtn) startAssessmentBtn.disabled = false;
        if (retakeAssessmentBtn) retakeAssessmentBtn.disabled = false;
        if (logoutButton) logoutButton.disabled = false;
        
        // Only enable prev/next buttons if the active assessment section is visible
        if (!activeAssessmentSection.classList.contains('hidden')) {
            if (prevQuestionBtn) prevQuestionBtn.disabled = currentQuestionIndex === 0;
            if (nextQuestionBtn) nextQuestionBtn.disabled = false;
        }
    }
}

function showStatus(div, message, isError = false, clearOnly = false) {
    if (clearOnly) {
        div.textContent = '';
        div.classList.add('hidden');
        return;
    }
    div.textContent = message;
    div.className = isError ? 'status-message error' : 'status-message success';
    div.classList.remove('hidden');
}

function hideStatus(div) {
    if (div) {
        div.classList.add('hidden');
        div.textContent = '';
    }
}

function hideAllStatusMessages() {
    hideStatus(setupStatusMessageDiv);
    hideStatus(assessmentStatusMessageDiv);
    hideStatus(resultsStatusMessageDiv);
}

async function handleLogout() {
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error("Error signing out:", error);
        // Show status on the most likely visible status div
        const statusDiv = assessmentResultsSection.classList.contains('hidden') ? setupStatusMessageDiv : resultsStatusMessageDiv;
        showStatus(statusDiv, "Failed to log out. Please try again.", true);
    }

}


