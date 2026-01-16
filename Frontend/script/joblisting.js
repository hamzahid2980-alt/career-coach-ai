const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com';

let currentUser = null;
// CORRECTED: Initialize fetchedResumeContent to an empty object to prevent ReferenceErrors
let fetchedResumeContent = {}; 

// DOM Elements
const resumeUploadInput = document.getElementById('resumeUpload');
const fileNameDisplay = document.getElementById('file-name-display');
const dropzone = document.getElementById('dropzone'); // This is the upload-area div
const useSavedResumeCheckbox = document.getElementById('useSavedResumeCheckbox');
const locationInput = document.getElementById('locationInput');
// Removed: const experienceSelect = document.getElementById('experience'); // Remove if not in HTML
const findJobsButton = document.getElementById('findJobsButton');
const jobSearchStatusDiv = document.getElementById('job-search-status');
const searchPanel = document.querySelector('.search-panel-wrapper');

const loadingDiv = document.getElementById('loading');
const resultsContainer = document.getElementById('results-container');
const skillsListUl = document.getElementById('skills-list');
const jobsListDiv = document.getElementById('jobs-list');
const matchCountBadge = document.getElementById('matchCount');
const noJobsMessageDiv = document.getElementById('no-jobs-message');
const startNewSearchButton = document.getElementById('startNewSearchButton');
const logoutButton = document.getElementById('logoutButton');

// NEW: Saved Resume Display Elements
const uploadAreaContainer = document.getElementById('upload-area-container'); // Parent of dropzone and saved-info
const savedResumeInfoDisplay = document.getElementById('saved-resume-info-display');
const savedResumeNameSpan = document.getElementById('savedResumeName');
// REMOVED: const savedResumeDateSpan = document.getElementById('savedResumeDate'); // No longer needed


/**
 * Called by auth.js when the user's authentication state changes.
 */
async function onUserLoggedIn(user) { // CORRECTED: Made async
    currentUser = user;
    // console.log("JobListing page: User logged in:", currentUser.uid);
    initializeEventListeners();
    // CORRECTED: Await this call to ensure fetchedResumeContent is populated BEFORE toggle
    await fetchAndPopulateSavedResumeInfo(); 
    toggleResumeInputVisibility(); // Call after fetch completes to set initial UI state
}

function initializeEventListeners() {
    findJobsButton.addEventListener('click', handleFindJobs);
    startNewSearchButton.addEventListener('click', resetJobSearchUI);
    logoutButton.addEventListener('click', handleLogout);

    // File upload and drag-drop listeners
    resumeUploadInput.addEventListener('change', updateFileName);
    dropzone.addEventListener('click', () => resumeUploadInput.click());
    ['dragenter', 'dragover', 'dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, preventDefaults, false);
    });
    ['dragenter', 'dragover'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.add('dragover'), false);
    });
    ['dragleave', 'drop'].forEach(eventName => {
        dropzone.addEventListener(eventName, () => dropzone.classList.remove('dragover'), false);
    });
    dropzone.addEventListener('drop', handleDrop, false);

    // NEW: Listener for the "Use my saved resume" checkbox
    useSavedResumeCheckbox.addEventListener('change', toggleResumeInputVisibility);
    // Initial call to set correct state on load is now done in onUserLoggedIn after fetch
}

function preventDefaults(e) {
    e.preventDefault();
    e.stopPropagation();
}

function handleDrop(e) {
    const dt = e.dataTransfer;
    const files = dt.files;
    if (files.length > 0) {
        resumeUploadInput.files = files;
        updateFileName();
    }
}

function updateFileName() {
    if (resumeUploadInput.files.length > 0) {
        fileNameDisplay.innerHTML = `<strong>File:</strong> ${resumeUploadInput.files[0].name}`;
        useSavedResumeCheckbox.checked = false; // Uncheck if a new file is selected
        toggleResumeInputVisibility(); // Update visibility based on this change
    } else {
        fileNameDisplay.innerHTML = '<strong>Click to upload</strong> or drag & drop resume';
    }
    hideStatus(jobSearchStatusDiv);
}

/**
 * Fetches user's saved resume metadata to populate the "saved resume" display.
 * Makes a call to /api/user/profile.
 */
async function fetchAndPopulateSavedResumeInfo() {
    if (!currentUser) {
        // console.log('User not logged in, cannot fetch saved resume info.');
        fetchedResumeContent = {}; // Ensure it's an empty object if no user
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
            // console.error('Failed to fetch user profile for saved resume info:', data.detail || data.message);
            fetchedResumeContent = {}; // Ensure it's an empty object on error
            return;
        }

        // console.log('API Response data from /api/user/profile:', data);
        
        // This part depends on how your /api/user/profile endpoint returns resume data.
        // Assuming it either has 'resume_content.resume_metadata' or 'resume_metadata' directly.
        if (data.resume_content && data.resume_content.resume_metadata) {
            fetchedResumeContent = data.resume_content;
            // console.log('Fetched resume_content with metadata from user profile:', fetchedResumeContent);
        } else if (data.resume_metadata) { // Fallback if resume_metadata is directly top-level
            fetchedResumeContent = { resume_metadata: data.resume_metadata };
            // console.log('Fetched top-level resume_metadata from user profile:', fetchedResumeContent);
        }
        else {
            fetchedResumeContent = {}; // No resume info found
            // console.warn('No "resume_content" or "resume_metadata" found in user profile data.');
        }

    } catch (error) {
        console.error('Network error fetching saved resume info:', error);
        fetchedResumeContent = {}; // Ensure it's an empty object on network error
    }
}


/**
 * Manages the visibility of the file upload area vs. the saved resume info display
 * based on the 'useSavedResumeCheckbox' state.
 */
function toggleResumeInputVisibility() {
    const isUsingSavedResume = useSavedResumeCheckbox.checked;

    if (isUsingSavedResume) {
        // Hide the file upload input elements
        dropzone.classList.add('hidden-by-js'); // Add class to hide dropzone
        resumeUploadInput.removeAttribute('required'); // No longer required
        resumeUploadInput.value = ''; // Clear any selected file
        fileNameDisplay.textContent = 'No file chosen'; // Reset displayed file name

        // Show the saved resume info display
        savedResumeInfoDisplay.classList.remove('hidden');

        // Populate saved resume info (only name)
        // console.log('Populating saved resume info. fetchedResumeContent:', fetchedResumeContent);
        
        // Access properties defensively using optional chaining
        const resumeMetadata = fetchedResumeContent?.resume_metadata; 
        const fileName = resumeMetadata?.file_name;
        // REMOVED: const uploadedAt = resumeMetadata?.uploaded_at; // No longer needed

        if (fileName) {
            savedResumeNameSpan.textContent = fileName;
            // console.log('Displaying saved file name:', fileName);
        } else {
            savedResumeNameSpan.textContent = 'No saved resume found.'; // More explicit message
            console.warn('No file_name found in fetchedResumeContent?.resume_metadata to display.');
        }
        
        // REMOVED: Date display logic
        // savedResumeDateSpan.textContent = 'N/A'; // Ensure it's cleared if it was ever set

        // console.log('Toggle: Using saved resume. Upload hidden, saved info shown (only name).');

    } else {
        // Show the file upload input elements
        dropzone.classList.remove('hidden-by-js'); // Show dropzone
        resumeUploadInput.setAttribute('required', 'true'); // Make required again

        // Hide the saved resume info display
        savedResumeInfoDisplay.classList.add('hidden');
        savedResumeNameSpan.textContent = 'N/A';
        // REMOVED: savedResumeDateSpan.textContent = 'N/A';
        // console.log('Toggle: Not using saved resume. Upload shown, saved info hidden.');
    }
    hideStatus(jobSearchStatusDiv); // Clear any old status messages
}

async function handleFindJobs(e) {
    e.preventDefault();
    hideStatus(jobSearchStatusDiv);
    
    if (!currentUser) {
        showStatus(jobSearchStatusDiv, 'Please log in to find jobs.', true);
        return;
    }

    const location = locationInput.value.trim();
    const useSavedResume = useSavedResumeCheckbox.checked;
    const file = resumeUploadInput.files[0]; // Get file here to check if it's new

    // Frontend validation to prevent sending empty data to backend
    if (!useSavedResume && !file) { 
        showStatus(jobSearchStatusDiv, 'Please upload a resume or check "Use my saved resume".', true);
        return;
    }
    if (!location) {
        showStatus(jobSearchStatusDiv, 'Please enter a location.', true);
        return;
    }

    showLoading(true);
    searchPanel.classList.add('hidden');
    resultsContainer.classList.add('hidden');
    noJobsMessageDiv.classList.add('hidden');

    const formData = new FormData();
    if (!useSavedResume && file) { // Only append file if not using saved and a file is present
        formData.append('file', file);
    }
    formData.append('use_saved_resume', useSavedResume); // Always send this flag

    try {
        const idToken = await currentUser.getIdToken();
        // IMPORTANT: /api/jobs/find_jobs is the endpoint that needs to take these params.
        // The router for jobs.py will handle this.
        const apiUrl = `${API_BASE_URL}/api/jobs/find_jobs/?location=${encodeURIComponent(location)}`;
        
        const response = await fetch(apiUrl, {
            method: 'POST',
            headers: { 'Authorization': `Bearer ${idToken}` },
            body: formData // Always send formData, let backend handle logic based on flags
        });

        const data = await response.json();

        if (!response.ok) {
            throw new Error(data.detail || `HTTP error! Status: ${response.status}`);
        }

        renderJobResults(data);

    } catch (error) {
        console.error("Error fetching job data:", error);
        showStatus(jobSearchStatusDiv, `Error: ${error.message}`, true);
        searchPanel.classList.remove('hidden'); // Show search panel again on error
    } finally {
        showLoading(false);
    }
}

function renderJobResults(data) {
    jobsListDiv.innerHTML = ''; // Clear previous job results
    skillsListUl.innerHTML = ''; // Clear previous skills

    if (data.skills && data.skills.length > 0) {
        skillsListUl.innerHTML = data.skills.map(skill => `<li>${skill}</li>`).join('');
        skillsListUl.parentElement.classList.remove('hidden');
    } else {
        skillsListUl.parentElement.classList.add('hidden');
    }

    matchCountBadge.textContent = `${data.jobs?.length || 0} Matches`;

    if (data.jobs && data.jobs.length > 0) {
        resultsContainer.classList.remove('hidden'); // Show results container if jobs found
        data.jobs.forEach(job => {
            const matchScore = job.rating || 0;
            const matchClass = matchScore >= 8 ? 'good' : 'medium';
            const jobCard = `
                <div class="job-card card">
                    <div class="card-header">
                        <div class="company-logo"><i class="fas fa-building"></i></div>
                        <div>
                            <h3><a href="${job.url}" target="_blank" rel="noopener noreferrer">${job.title || 'N/A'}</a></h3>
                            <div class="company-name">${job.company || 'N/A'}</div>
                        </div>
                        <div class="match-badge ${matchClass}">
                            <i class="fas fa-check-circle"></i> ${matchScore * 10}% Match
                        </div>
                    </div>
                    <div class="card-meta">
                        <span><i class="fas fa-map-marker-alt"></i> ${job.location || 'N/A'}</span>
                        <span><i class="fas fa-briefcase"></i> Full-time</span>
                    </div>
                    <div class="card-footer">
                        <p class="ai-reason"><strong>AI Insight:</strong> "${job.reason || 'Good skill alignment.'}"</p>
                        <a href="${job.url}" target="_blank" rel="noopener noreferrer" class="btn apply-btn">Apply</a>
                    </div>
                </div>
            `;
            jobsListDiv.innerHTML += jobCard;
        });
    } else {
        noJobsMessageDiv.classList.remove('hidden');
        resultsContainer.classList.remove('hidden'); // Show results container even if no jobs, to show message
    }
}

function resetJobSearchUI() {
    searchPanel.classList.remove('hidden');
    resultsContainer.classList.add('hidden');
    noJobsMessageDiv.classList.add('hidden');
    
    resumeUploadInput.value = '';
    updateFileName(); // Resets filename display AND calls toggleResumeInputVisibility
    useSavedResumeCheckbox.checked = false; // Ensure checkbox is unchecked
    toggleResumeInputVisibility(); // NEW: Explicitly call to reset UI state
    hideStatus(jobSearchStatusDiv);
}

function showStatus(targetDiv, message, isError = false) {
    targetDiv.textContent = message;
    targetDiv.className = isError ? 'status-message error' : 'status-message success';
    targetDiv.classList.remove("hidden");
}

function hideStatus(targetDiv) {
    targetDiv.classList.add("hidden");
    targetDiv.textContent = '';
}

function showLoading(show) {
    loadingDiv.classList.toggle('hidden', !show);
    findJobsButton.disabled = show;
}

async function handleLogout() {
    try {
        await firebase.auth().signOut();
    } catch (error) {
        console.error("Error signing out:", error);
        alert("Failed to log out. Please try again.");
    }
}

// Initial check for user authentication state is handled by auth.js

// auth.js will call onUserLoggedIn if a user is already signed in.



