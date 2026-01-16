const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com';

// Get references to all the HTML elements on this page
const fileInput = document.getElementById("resume_file");
const uploadForm = document.getElementById("upload-form");
const resumeOptimizeForm = document.getElementById("optimize-form-resume");
const linkedinOptimizeForm = document.getElementById("optimize-form-linkedin");

const loadingDiv = document.getElementById("loading");
const uploadSection = document.getElementById("upload-section");
const choiceSection = document.getElementById("choice-section");

// NEW: Define local storage key for job description
const JOB_DESCRIPTION_LOCAL_STORAGE_KEY = 'currentJobDescription'; 

const resumeOptimizerSection = document.getElementById("resume-optimizer-section");
const linkedinOptimizerSection = document.getElementById("linkedin-optimizer-section");

// NEW: Full Analysis Report Section elements
const fullAnalysisReportSection = document.getElementById("full-analysis-report-section");
const reportJobRole = document.getElementById("report-job-role");
// Removed from display: reportAnalysisDate and reportAiModel as per previous request
const reportOverallScore = document.getElementById("report-overall-score");
const reportOverallGrade = document.getElementById("report-overall-grade");
const displayResumeScore = document.getElementById("display-resume-score");
const captionResumeGrade = document.getElementById("caption-resume-grade");
const displayAtsScore = document.getElementById("display-ats-score");
const captionAtsScoreGrade = document.getElementById("caption-ats-score-grade");
const profProfileSummary = document.getElementById("prof-profile-summary");
const educationSummary = document.getElementById("education-summary");
const experienceSummary = document.getElementById("experience-summary");
const skillsSummary = document.getElementById("skills-summary");
const keyStrengthsList = document.getElementById("key-strengths-list");
const areasForImprovementList = document.getElementById("areas-for-improvement-list");
const overallAssessmentSummary = document.getElementById("overall-assessment-summary");

const proceedToOptimizationBtn = document.getElementById("proceedToOptimizationBtn");
const uploadNewResumeFromAnalysisBtn = document.getElementById("uploadNewResumeFromAnalysisBtn"); 
const jobDescriptionTextarea = document.getElementById("job_description"); 

const showResumeOptimizerCard = document.getElementById("show-resume-optimizer-card");
const showLinkedinOptimizerCard = document.getElementById("show-linkedin-optimizer-card");
const linkedinContentDiv = document.getElementById("linkedin-content");

const uploadErrorMessageDiv = document.getElementById("upload-error-message");
const resumeOptimizerErrorMessageDiv = document.getElementById("resume-optimize-error-message");
const linkedinOptimizerErrorMessageDiv = document.getElementById("linkedin-optimize-error-message");
const fullAnalysisErrorMessageDiv = document.getElementById("full-analysis-error-message"); 

const startOverLink = document.getElementById("start-over-link");
const backLinks = document.querySelectorAll(".back-link");

const resumeUserRequestTextarea = document.getElementById("resume_user_request");
const linkedinUserRequestTextarea = document.getElementById("linkedin_user_request");

const fileNameSpan = document.getElementById('fileName');
const customFileButtonLabel = document.querySelector('label.custom-file-button');
const useSavedResumeCheckbox = document.getElementById('useSavedResumeCheckbox');

// NEW: Saved Resume Display elements
const savedResumeDisplayDiv = document.getElementById('saved-resume-display');
const savedResumeNameSpan = document.getElementById('savedResumeName');
// const savedResumeDateSpan = document.getElementById('savedResumeDate');

const resumeInputContainer = document.getElementById('resume-input-container'); // NEW: Reference the new container
const fileUploadElements = document.getElementById('file-upload-elements'); // NEW: Reference the file upload elements div


let currentUser = null;
let currentResumeId = null;
let fetchedResumeContent = null;

/**
 * Called by auth.js when the user's authentication state changes and they are logged in.
 * @param {firebase.User} user - The authenticated Firebase user object.
 */
function onUserLoggedIn(user) {
    currentUser = user;
    currentResumeId = user.uid;
    // console.log("Optimizer page: User logged in. currentResumeId:", currentResumeId);

    resetUI(); // Ensures a clean state and clears local storage job description
    fetchAndSuggestOptimizations();

    // Event listeners for navigation
    showResumeOptimizerCard.addEventListener("click", () => {
        choiceSection.classList.add("hidden");
        resumeOptimizerSection.classList.remove("hidden");
        hideAllErrors();
    });
    showLinkedinOptimizerCard.addEventListener("click", () => {
        choiceSection.classList.add("hidden");
        linkedinOptimizerSection.classList.remove("hidden");
        hideAllErrors();
    });

    // Add the event listener for the logout button
    const logoutButton = document.getElementById("logoutButton");
    if (logoutButton) {
        logoutButton.addEventListener("click", async () => {
            try {
                await firebase.auth().signOut();
                localStorage.removeItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY); // NEW: Clear job description from local storage on logout
                // console.log('Job description cleared from local storage on logout.');
            } catch (error) {
                console.error("Error signing out:", error);
                alert("Failed to log out. Please try again.");
            }
        });
    }

    // --- Custom File Input Listener with Debugging ---
    fileInput.addEventListener('change', (event) => { 
        // console.log('File input change event fired.');
        // console.log('fileInput.files:', fileInput.files); // Log the FileList object

        if (fileInput.files.length > 0) {
            const selectedFile = fileInput.files[0];
            fileNameSpan.textContent = selectedFile.name;
            // console.log('Selected file name:', selectedFile.name);
            // console.log('Selected file type:', selectedFile.type);
            // console.log('Selected file size:', selectedFile.size, 'bytes');
        } else {
            fileNameSpan.textContent = 'No file chosen';
            // console.log('No file chosen.');
        }
    });

    // --- Event listener for "Use Saved Resume" checkbox ---
    useSavedResumeCheckbox.addEventListener('change', toggleFileUploadInput);
    // Initial call to set state based on default checkbox status
    toggleFileUploadInput();

    // NEW: Event listeners for Full Analysis Report section buttons
    proceedToOptimizationBtn.addEventListener('click', () => {
        fullAnalysisReportSection.classList.add('hidden');
        choiceSection.classList.remove('hidden');
        hideAllErrors();
    });

    uploadNewResumeFromAnalysisBtn.addEventListener('click', () => {
        resetUI(); // This will clear analysis section and show upload section
    });

    // NEW: Try to populate job description input from local storage on initial page load (after reset)
    const savedJobDescription = localStorage.getItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY);
    if (savedJobDescription) {
        jobDescriptionTextarea.value = savedJobDescription;
        // console.log('Populated job description from local storage on load:', savedJobDescription);
    }
}

/**
 * Toggles the visibility/required status of the file upload input based on checkbox.
 * Also manages the display of saved resume info.
 */
function toggleFileUploadInput() {
    const isUsingSavedResume = useSavedResumeCheckbox.checked;
    
    if (isUsingSavedResume) {
        // Hide file upload UI completely
        fileUploadElements.classList.add('hidden-by-js'); // Use new class for hiding
        fileInput.removeAttribute('required');
        fileInput.value = ''; // Clear any selected file
        fileNameSpan.textContent = 'No file chosen'; // Reset displayed file name

        // Show saved resume info
        savedResumeDisplayDiv.classList.remove('hidden'); 
        // console.log("Using saved resume: File upload elements hidden, saved info shown.");
        
        // Populate saved resume info if fetchedResumeContent is available
        if (fetchedResumeContent && fetchedResumeContent.resume_metadata) {
            savedResumeNameSpan.textContent = fetchedResumeContent.resume_metadata.file_name || 'N/A';
        } else {
            savedResumeNameSpan.textContent = 'No saved resume details found.'; // More informative message
            // savedResumeDateSpan.textContent = 'N/A';
        }

    } else {
        // Show file upload UI
        fileUploadElements.classList.remove('hidden-by-js');
        fileInput.setAttribute('required', 'true');
        
        // Hide saved resume info
        savedResumeDisplayDiv.classList.add('hidden');
        savedResumeNameSpan.textContent = 'N/A'; 
        // savedResumeDateSpan.textContent = 'N/A'; 
        // console.log("Not using saved resume: File upload elements shown, saved info hidden.");
    }
    hideAllErrors();
}


/**
 * Fetches user's profile and resume data from the backend.
 * Used for initial state and to suggest optimization requests.
 * This also populates the 'saved resume' display if applicable.
 */
async function fetchAndSuggestOptimizations() {
    if (!currentUser) {
        showStatus(uploadErrorMessageDiv, 'User not authenticated. Please log in.', true);
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
            console.error('Failed to fetch profile/resume for suggestions:', data.detail || data.message);
            // Don't show error to user if no resume is found yet, it's a normal state.
            // showStatus(uploadErrorMessageDiv, 'Could not fetch resume for optimization suggestions. User can manually input requests.', true);
            fetchedResumeContent = null; // Ensure it's cleared if fetch fails
            return;
        }

        // Assuming data.resume_content now directly contains the structured resume data
        fetchedResumeContent = data.resume_content; 
        // console.log('Resume content fetched for optimization suggestions:', fetchedResumeContent);

        // Update placeholders based on fetched content
        const summary = fetchedResumeContent ? fetchedResumeContent.summary : '';
        const work_experience = fetchedResumeContent ? fetchedResumeContent.work_experience : [];

        if (summary) {
            resumeUserRequestTextarea.placeholder = "e.g., 'Summary: make it more impactful and concise'";
        } else if (work_experience && work_experience.length > 0) {
            resumeUserRequestTextarea.placeholder = "e.g., 'Work experience: quantify achievements in my latest role'";
        } else {
            resumeUserRequestTextarea.placeholder = "e.g., 'Improve overall clarity' or 'Add a strong summary'";
        }
        
        if (summary || (work_experience && work_experience.length > 0) || (fetchedResumeContent && fetchedResumeContent.projects && fetchedResumeContent.projects.length > 0)) {
             linkedinUserRequestTextarea.placeholder = "e.g., 'Generate strong headlines and an About section' or 'Highlight my key achievements for LinkedIn'";
        } else {
            linkedinUserRequestTextarea.placeholder = "e.g., 'Generate a professional summary for my LinkedIn profile'";
        }

        // NEW: Update saved resume display immediately if checkbox is checked
        if (useSavedResumeCheckbox.checked) {
            toggleFileUploadInput(); // Re-run to populate saved resume info
        }

    } catch (error) {
        console.error('Error fetching resume for optimization suggestions:', error);
        showStatus(uploadErrorMessageDiv, 'Network error when trying to fetch resume suggestions.', true);
    }
}


// --- UI State Management ---
function resetUI() {
  choiceSection.classList.add("hidden");
  resumeOptimizerSection.classList.add("hidden");
  linkedinOptimizerSection.classList.add("hidden");
  fullAnalysisReportSection.classList.add("hidden"); // Hide full analysis section
  uploadSection.classList.remove("hidden");
  linkedinContentDiv.innerHTML = "";
  hideAllErrors();
  
  fileInput.value = '';
  fileNameSpan.textContent = 'No file chosen';
  useSavedResumeCheckbox.checked = false; 
  toggleFileUploadInput();

  jobDescriptionTextarea.value = ''; // Ensure input is cleared visually
  localStorage.removeItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY); // NEW: Clear job description from local storage
  // console.log('Job description cleared from local storage during reset.');


  // Clear Full Analysis Report displays
  reportJobRole.textContent = 'N/A';
  // reportAnalysisDate.textContent = 'N/A'; // Removed from display
  // reportAiModel.textContent = 'N/A'; // Removed from display
  reportOverallScore.textContent = 'N/A';
  reportOverallGrade.textContent = 'N/A';
  displayResumeScore.textContent = 'N/A';
  captionResumeGrade.textContent = 'N/A';
  displayAtsScore.textContent = 'N/A';
  captionAtsScoreGrade.textContent = 'N/A';
  profProfileSummary.textContent = 'N/A';
  educationSummary.textContent = 'N/A';
  experienceSummary.textContent = 'N/A';
  skillsSummary.textContent = 'N/A';
  keyStrengthsList.innerHTML = '<li>No key strengths identified.</li>';
  areasForImprovementList.innerHTML = '<li>No specific areas for improvement identified.</li>';
  overallAssessmentSummary.textContent = 'N/A';


  resumeUserRequestTextarea.value = '';
  linkedinUserRequestTextarea.value = '';
}
startOverLink.addEventListener("click", (e) => {
  e.preventDefault();
  resetUI();
  fetchAndSuggestOptimizations();
});

// --- Form Submission Logic: Initial Resume File Upload ---
uploadForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  const file = fileInput.files[0];
  const useSavedResume = useSavedResumeCheckbox.checked;
  const jobDescription = jobDescriptionTextarea.value.trim();

  // Debugging log for upload process initiation
  console.log('Upload form submitted.');
  console.log('useSavedResume:', useSavedResume);
  console.log('file present:', !!file);
  if (file) {
      // console.log('File details for submission:', file.name, file.type, file.size);
  }


  if (!useSavedResume && !file) {
    showStatus(uploadErrorMessageDiv, "Please select a file to upload or check 'Use my already uploaded resume'.", true);
    return;
  }
  if (useSavedResume && file) {
      showStatus(uploadErrorMessageDiv, "Please either upload a new resume OR use your saved resume, not both.", true);
      return;
  }
  if (!currentUser) {
      showStatus(uploadErrorMessageDiv, "User not authenticated. Please log in.", true);
      return;
  }

  showLoading(true);
  let backendResponseData;

  try {
    const idToken = await currentUser.getIdToken();
    // console.log("Optimizer Upload: Sending ID Token:", idToken);

    const formData = new FormData();
    if (!useSavedResume && file) { 
        formData.append("file", file);
    }
    formData.append("use_saved_resume", useSavedResume.toString());
    if (jobDescription) {
        formData.append("job_description", jobDescription);
    }

    const response = await fetch(`${API_BASE_URL}/api/resume/upload`, {
      method: "POST",
      headers: { 
          'Authorization': `Bearer ${idToken}`
          // Content-Type for FormData is automatically set by fetch, do not manually set
      },
      body: formData, 
    });
    
    backendResponseData = await response.json(); // Always try to read JSON for errors

    if (!response.ok) {
      throw new Error(backendResponseData.detail || backendResponseData.message || 'Upload/analysis failed.');
    }
    
    // console.log("Resume processed successfully:", backendResponseData);

    uploadSection.classList.add("hidden");
    fullAnalysisReportSection.classList.remove("hidden"); // Show full analysis section
    displayFullAnalysisReport(backendResponseData.full_analysis_report); 
    fetchAndSuggestOptimizations(); 

    // NEW: Save job description to local storage after successful analysis
    if (jobDescription) {
        localStorage.setItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY, jobDescription);
        // console.log('Job description saved to local storage:', jobDescription);
    } else {
        localStorage.removeItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY);
        // console.log('No job description provided, cleared from local storage.');
    }

  } catch (error) {
    console.error("Upload and analysis failed:", error);
    showStatus(uploadErrorMessageDiv, error.message || "Upload and analysis failed.", true);
  } finally {
    const uploadButton = document.getElementById("uploadResumeButton");
    if (uploadButton) {
        setButtonLoading(uploadButton, false, "Analyze & Optimize");
    }
    showLoading(false);
  }
});

// Function to display the full analysis report
function displayFullAnalysisReport(reportData) {
    if (!reportData) {
        showStatus(fullAnalysisErrorMessageDiv, "No comprehensive analysis report received.", true);
        return;
    }
    hideStatus(fullAnalysisErrorMessageDiv);

    reportJobRole.textContent = reportData.job_role_context || 'N/A';
    // reportAnalysisDate.textContent = reportData.analysis_date || 'N/A'; // Removed from display
    // reportAiModel.textContent = reportData.ai_model || 'N/A'; // Removed from display
    reportOverallScore.textContent = reportData.overall_resume_score !== undefined ? reportData.overall_resume_score : 'N/A';
    reportOverallGrade.textContent = reportData.overall_resume_grade || 'N/A';
    
    displayResumeScore.textContent = reportData.overall_resume_score !== undefined ? reportData.overall_resume_score : 'N/A';
    captionResumeGrade.textContent = reportData.overall_resume_grade || 'N/A';

    displayAtsScore.textContent = reportData.ats_optimization_score !== undefined ? reportData.ats_optimization_score : 'N/A';
    captionAtsScoreGrade.textContent = reportData.ats_optimization_score >= 80 ? 'Excellent Match' : 
                                       reportData.ats_optimization_score >= 60 ? 'Good Match' : 
                                       (reportData.ats_optimization_score !== undefined ? 'Needs Work' : 'N/A');

    profProfileSummary.textContent = reportData.professional_profile_analysis ? reportData.professional_profile_analysis.summary : 'N/A';
    educationSummary.textContent = reportData.education_analysis ? reportData.education_analysis.summary : 'N/A';
    experienceSummary.textContent = reportData.experience_analysis ? reportData.experience_analysis.summary : 'N/A';
    skillsSummary.textContent = reportData.skills_analysis ? reportData.skills_analysis.summary : 'N/A';

    // Populate Key Strengths
    keyStrengthsList.innerHTML = '';
    if (reportData.key_strengths && reportData.key_strengths.length > 0) {
        reportData.key_strengths.forEach(strength => {
            const li = document.createElement('li');
            li.textContent = strength;
            keyStrengthsList.appendChild(li);
        });
    } else {
        keyStrengthsList.innerHTML = '<li>No key strengths identified.</li>';
    }

    // Populate Areas for Improvement (combining general + ATS issues)
    areasForImprovementList.innerHTML = '';
    if (reportData.areas_for_improvement && reportData.areas_for_improvement.length > 0) {
        reportData.areas_for_improvement.forEach(area => {
            const li = document.createElement('li');
            li.textContent = area;
            areasForImprovementList.appendChild(li);
        });
    } else {
        areasForImprovementList.innerHTML = '<li>No specific areas for improvement identified.</li>';
    }

    overallAssessmentSummary.textContent = reportData.overall_assessment || 'N/A';
}


// --- UI Navigation Logic ---
backLinks.forEach((link) => {
  link.addEventListener("click", (e) => {
    e.preventDefault();
    resumeOptimizerSection.classList.add("hidden");
    linkedinOptimizerSection.classList.add("hidden");
    choiceSection.classList.remove("hidden");
    hideAllErrors();
    resumeUserRequestTextarea.value = '';
    linkedinUserRequestTextarea.value = '';
    linkedinContentDiv.innerHTML = '';
    // Job description in local storage will persist unless a new analysis is run or user logs out/resets
  });
});


// --- Resume Optimization Logic ---
resumeOptimizeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentResumeId) {
    showStatus(resumeOptimizerErrorMessageDiv, "Resume ID is missing. Please upload a resume first.", true);
    return;
  }
  if (!currentUser) {
      showStatus(resumeOptimizerErrorMessageDiv, "User not authenticated. Please log in.", true);
      return;
  }

  const userRequest = resumeUserRequestTextarea.value;
  const jobDescriptionContext = localStorage.getItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY); // NEW: Get job description from local storage
  // console.log('Resume Optimization: Using Job Description from local storage:', jobDescriptionContext);

  const requestBody = { 
      user_request: userRequest,
      job_description: jobDescriptionContext // NEW: Add job_description to request body
  };
  
  const button = resumeOptimizeForm.querySelector("button");
  setButtonLoading(button, true, "Optimizing...");
  try {
    const idToken = await currentUser.getIdToken();
    // console.log("Optimize: Sending ID Token:", idToken);

    const optimizeResponse = await fetch(`${API_BASE_URL}/api/resume/optimize`, {
      method: "POST",
      headers: { 
          "Content-Type": "application/json",
          'Authorization': `Bearer ${idToken}`
      },
      body: JSON.stringify(requestBody),
    });
    if (!optimizeResponse.ok) {
      throw await optimizeResponse.json();
    }
    const optimizeData = await optimizeResponse.json();

    if (optimizeData.download_url) {
        showLoading(true);
        showStatus(resumeOptimizerErrorMessageDiv, 'Download starting...', false);
        const downloadUrl = `${API_BASE_URL}${optimizeData.download_url}`;

        // console.log("Download: Making authenticated fetch for URL:", downloadUrl);
        // console.log("Download: Using ID Token for GET request:", idToken);

        const downloadResponse = await fetch(downloadUrl, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${idToken}`
            }
        });

        if (!downloadResponse.ok) {
            let errorText = await downloadResponse.text();
            try {
                const errorJson = JSON.parse(errorText);
                errorText = errorJson.detail || errorJson.message || errorText;
            } catch (e) { /* not JSON */ }
            throw new Error(`Failed to download optimized resume. Status: ${downloadResponse.status}, Response: ${errorText}`);
        }

        const contentDisposition = downloadResponse.headers.get('Content-Disposition');
        let filename = 'Optimized_Resume.docx';
        if (contentDisposition) {
            const filenameMatch = contentDisposition.match(/filename="([^"]+)"/);
            if (filenameMatch && filenameMatch[1]) {
                filename = filenameMatch[1];
            }
        }
        
        const blob = await downloadResponse.blob();
        const url = window.URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        document.body.appendChild(a);
        a.click();
        a.remove();
        window.URL.revokeObjectURL(url);
        
        showStatus(resumeOptimizerErrorMessageDiv, 'Optimized resume downloaded successfully!', false);

    } else {
        showStatus(resumeOptimizerErrorMessageDiv, 'Optimization successful, but no download URL was provided by the backend.', true);
    }
  } catch (error) {
    console.error("Resume optimization or download failed:", error);
    showStatus(resumeOptimizerErrorMessageDiv, error.message || error.detail || "Resume optimization or download failed.", true);
  } finally {
    setButtonLoading(button, false, "Optimize & Download");
    showLoading(false);
  }
});

// --- LinkedIn Optimization Logic ---
linkedinOptimizeForm.addEventListener("submit", async (e) => {
  e.preventDefault();
  if (!currentResumeId) {
    showStatus(linkedinOptimizerErrorMessageDiv, "Resume ID is missing. Please upload a resume first.", true);
    return;
  }
  if (!currentUser) {
      showStatus(linkedinOptimizerErrorMessageDiv, "User not authenticated. Please log in.", true);
      return;
  }

  const userRequest = linkedinUserRequestTextarea.value;
  const jobDescriptionContext = localStorage.getItem(JOB_DESCRIPTION_LOCAL_STORAGE_KEY); // NEW: Get job description from local storage
  // console.log('LinkedIn Optimization: Using Job Description from local storage:', jobDescriptionContext);

  const requestBody = { 
      user_request: userRequest,
      job_description: jobDescriptionContext // NEW: Add job_description to request body
  };
  
  const button = linkedinOptimizeForm.querySelector("button");
  setButtonLoading(button, true, "Generating...");
  linkedinContentDiv.innerHTML = '<div class="spinner"></div>';
  try {
    const idToken = await currentUser.getIdToken();
    // console.log("LinkedIn Optimize: Sending ID Token:", idToken);

    const response = await fetch(
      `${API_BASE_URL}/api/resume/linkedin-optimize`,
      {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            'Authorization': `Bearer ${idToken}`
        },
        body: JSON.stringify(requestBody),
      }
    );
    if (!response.ok) {
      throw await response.json();
    }
    const data = await response.json();
    displayLinkedInContent(data);
  } catch (error) {
    console.error("LinkedIn content generation failed:", error);
    showStatus(linkedinOptimizerErrorMessageDiv, error.detail || "LinkedIn content generation failed.", true);
    linkedinContentDiv.innerHTML = "";
  } finally {
    setButtonLoading(button, false, "Generate Content");
  }
});

// --- Helper Functions ---
function displayLinkedInContent(data) {
  let html = "";
  if (data.headlines && data.headlines.length > 0) {
    html +=
      "<h3>Headline Suggestions</h3><ul>" +
      data.headlines.map((h) => `<li>${h}</li>`).join("") +
      "</ul>";
      
  }
  if (data.about_section) {
    html += '<br>'; // NEW: Add line break
    html += `<h3>About Section</h3><p>${data.about_section.replace(
      /\n/g,
      "<br>"
    )}</p>`;
  }
  if (data.optimized_experiences && data.optimized_experiences.length > 0) {
    html += '<br>'; // NEW: Add line break    
    html += "<h3>Experience Suggestions</h3>";
    data.optimized_experiences.forEach((exp) => {
      html += `<h4>${exp.title}</h4><p>${exp.description}</p>`;
    });
  }
  if (data.optimized_projects && data.optimized_projects.length > 0) {
    html += '<br>'; // NEW: Add line break
    html += "<h3>Project Suggestions</h3>";
    data.optimized_projects.forEach((proj) => {
      html += `<h4>${proj.title}</h4><p>${proj.description}</p>`;
    });
  }
  linkedinContentDiv.innerHTML = html;
}
function showLoading(isLoading) {
  loadingDiv.classList.toggle("hidden", !isLoading);
  hideAllErrors();
}
function setButtonLoading(button, isLoading, loadingText) {
  button.disabled = isLoading;
  button.textContent = isLoading
    ? loadingText
    : (button.form.id.includes("resume")
        ? "Optimize & Download"
        : (button.form.id.includes("linkedin")
            ? "Generate Content"
            : "Analyze & Optimize"));
}

/**
 * Displays a status message in a given div.
 * @param {HTMLElement} targetDiv - The div element to display the message in.
 * @param {string} message - The message content.
 * @param {boolean} isError - True if it's an error message (red/error class), false for success (green/success class).
 */
function showStatus(targetDiv, message, isError = false) {
    if (targetDiv) {
        targetDiv.textContent = message;
        targetDiv.className = isError ? 'status-message error' : 'status-message success';
        targetDiv.classList.remove("hidden");
    } else {
        console.error("Error: targetDiv for status message is null or undefined.", message);
        alert(`Status Message Error: ${message}`);
    }
}

/**
 * Hides a status message div.
 * @param {HTMLElement} targetDiv - The div element to hide.
 */
function hideStatus(targetDiv) {
    if (targetDiv) {
        targetDiv.classList.add("hidden");
        targetDiv.textContent = '';
    }
}

function hideAllErrors() { 
    hideStatus(uploadErrorMessageDiv);
    hideStatus(resumeOptimizerErrorMessageDiv);
    hideStatus(linkedinOptimizerErrorMessageDiv);
    hideStatus(fullAnalysisErrorMessageDiv); 
}

// Initial check for user authentication state is handled by auth.js

// auth.js will call onUserLoggedIn if a user is already signed in.


