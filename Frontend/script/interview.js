const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://localhost:8000' 
    : 'https://career-coach-ai-3xap.onrender.com';

document.addEventListener('DOMContentLoaded', () => {
    const API_URL = `${API_BASE_URL}/api/interview`;

    // --- DOM Element References ---
    const jobDescriptionCard = document.getElementById('job-description-card');
    const difficultyCard = document.getElementById('difficulty-card');
    const startPromptCard = document.getElementById('start-prompt-card');
    const interviewCard = document.getElementById('interview-card');
    const summaryCard = document.getElementById('summary-card');
    const spinnerOverlay = document.getElementById('spinner-overlay');
    const spinnerOverlayText = document.getElementById('spinner-overlay-text');
    const videoSpinner = document.getElementById('video-spinner-container');
    const videoSpinnertext = document.getElementById('video-spinner-text');
    const proceedToDifficultyBtn = document.getElementById('proceed-to-difficulty-btn');
    const jobDescriptionInput = document.getElementById('job-description-input');
    const difficultyButtons = document.querySelectorAll('.difficulty-btn');
    const startInterviewBtn = document.getElementById('start-interview-btn');
    const recordBtn = document.getElementById('record-btn');
    const stopBtn = document.getElementById('stop-btn');
    const endInterviewBtn = document.getElementById('end-interview-btn');
    const restartInterviewBtn = document.getElementById('restart-interview-btn');
    const confirmationDetails = document.getElementById('confirmation-details');
    const interviewHeaderTitle = document.getElementById('interview-header-title');
    const chatMessagesContainer = document.getElementById('chat-messages');
    const videoPreview = document.getElementById('video-preview');
    const recordingIndicator = document.getElementById('recording-indicator');
    const summaryContent = document.getElementById('summary-content');
    const toastNotification = document.getElementById('toast-notification');
    const alertSound = new Audio('./assets/alert.mp3');
    
    // --- Application State ---
    let jobDescription = '';
    let selectedDifficulty = 'medium';
    let chatHistory = [];
    let currentQuestion = '';
    let mediaRecorder;
    let recordedChunks = [];

    // --- PROCTORING STATE ---
    let totalWarnings = 0;
    const MAX_WARNINGS = 3;
    let tabSwitchCount = 0;
    let phoneDetectionCount = 0;
    let noPersonWarningCount = 0;
    let multiplePeopleWarningCount = 0;
    let isInterviewActive = false;
    let objectDetectionModel = null;
    let proctoringAlertCooldown = false;

    // --- Helper Functions ---
    const showSpinner = (message = "Loading...") => {
        spinnerOverlayText.textContent = message;
        spinnerOverlay.style.display = 'flex';
    };
    const hideSpinner = () => spinnerOverlay.style.display = 'none';

    const showVideoSpinner = (message = "Processing...") => {
        videoSpinnertext.textContent = message;
        videoSpinner.style.display = 'flex';
    };
    const hideVideoSpinner = () => videoSpinner.style.display = 'none';

    const showToast = (message, type = 'info') => {
        toastNotification.textContent = message;
        toastNotification.className = `toast show ${type}`;
        if (type === 'warning' || type === 'danger' || type === 'success') {
            alertSound.play().catch(e => console.warn("Alert sound play failed:", e));
        }
        setTimeout(() => { toastNotification.className = toastNotification.className.replace('show', ''); }, 5000);
    };
    
    const showTypingIndicator = () => {
        const typingMessage = document.createElement('div');
        typingMessage.className = 'message-row ai';
        typingMessage.id = 'typing-indicator';
        typingMessage.innerHTML = `
            <div class="avatar ai"></div>
            <div class="message ai-message">
                <div class="typing-indicator">
                    <span></span><span></span><span></span>
                </div>
            </div>`;
        chatMessagesContainer.appendChild(typingMessage);
        // chatMessagesContainer.scrollTop = chatMessagesContainer.scrollHeight;
    };

    const hideTypingIndicator = () => {
        const indicator = document.getElementById('typing-indicator');
        if (indicator) indicator.remove();
    };

    const addMessageToChat = (role, content) => {
        const isAI = role === 'model';
        const messageRow = document.createElement('div');
        messageRow.className = `message-row ${isAI ? 'ai' : 'user'}`;
        const avatar = document.createElement('div');
        avatar.className = `avatar ${isAI ? 'ai' : 'user'}`;
        const message = document.createElement('div');
        message.className = `message ${isAI ? 'ai-message' : 'user-message'}`;
        message.innerHTML = content.replace(/\n/g, '<br>');
        messageRow.appendChild(avatar);
        messageRow.appendChild(message);
        chatMessagesContainer.appendChild(messageRow);
        
        // setTimeout(() => {
            // messageRow.scrollIntoView({ behavior: "smooth", block: "end" });
        // }, 100);
    };

    // --- Central Warning & Termination Logic ---
    const handleWarning = (reason, detail) => {
        if (!isInterviewActive || proctoringAlertCooldown) return;
        totalWarnings++;
        showToast(`Warning ${totalWarnings}/${MAX_WARNINGS}: ${detail}`, 'warning');
        proctoringAlertCooldown = true;
        setTimeout(() => { proctoringAlertCooldown = false; }, 7000);
        
        if (totalWarnings >= MAX_WARNINGS) {
            forceEndInterview(`Exceeded maximum warnings (${reason})`);
        }
    };

    const forceEndInterview = (reason) => {
        if (!isInterviewActive) return;
        isInterviewActive = false;
        if (mediaRecorder?.state === 'recording') mediaRecorder.stop();
        if (videoPreview.srcObject) videoPreview.srcObject.getTracks().forEach(track => track.stop());
        interviewCard.style.display = 'none'; // Hide the card immediately

        // Show termination message first, clearly.
        showToast("Interview terminated due to malpractice warnings.", 'danger');

        // Wait 4 seconds before showing the summary spinner, so the user can read the message.
        setTimeout(() => {
            generateSummary({ termination_reason: reason });
        }, 3000);
    };

    // --- PROCTORING LOGIC ---
    document.addEventListener('visibilitychange', () => {
        if (isInterviewActive && document.visibilityState === 'hidden') {
            tabSwitchCount++;
            handleWarning("Tab Switch", "Switched to another tab or window.");
        }
    });

    const runObjectDetection = async () => {
        if (!isInterviewActive || !objectDetectionModel || videoPreview.paused || videoPreview.ended) return;

        const predictions = await objectDetectionModel.detect(videoPreview);
        let personCount = 0, phoneDetected = false;
        for (let p of predictions) {
            if (p.class === 'person' && p.score > 0.6) personCount++;
            if (p.class === 'cell phone' && p.score > 0.65) phoneDetected = true;
        }

        if (phoneDetected) {
            phoneDetectionCount++;
            handleWarning("Phone Detected", "A cell phone was detected.");
        } else if (personCount === 0) {
            noPersonWarningCount++;
            handleWarning("No Person", "Candidate not detected in frame.");
        } else if (personCount > 1) {
            multiplePeopleWarningCount++;
            handleWarning("Multiple People", "More than one person was detected.");
        }

        requestAnimationFrame(runObjectDetection);
    };

    // --- Core Workflow ---
    proceedToDifficultyBtn.addEventListener('click', () => {
        jobDescription = jobDescriptionInput.value;
        if (!jobDescription.trim()) return showToast('Please provide a job description.', 'warning');
        jobDescriptionCard.style.display = 'none';
        difficultyCard.style.display = 'block';
    });

    difficultyButtons.forEach(button => {
        button.addEventListener('click', () => {
            difficultyButtons.forEach(btn => btn.classList.remove('selected'));
            button.classList.add('selected');
            selectedDifficulty = button.dataset.difficulty;
            setTimeout(() => {
                difficultyCard.style.display = 'none';
                confirmationDetails.innerHTML = `<p><strong>Difficulty:</strong> ${selectedDifficulty.charAt(0).toUpperCase() + selectedDifficulty.slice(1)}</p>`;
                startPromptCard.style.display = 'block';
            }, 300);
        });
    });

    startInterviewBtn.addEventListener('click', async () => {
        startPromptCard.style.display = 'none';
        showSpinner("Setting up your interview...");
        
        if (!objectDetectionModel) {
            try { 
                objectDetectionModel = await cocoSsd.load(); 
            } catch (e) { 
                console.error("Failed to load model:", e); 
                showToast("Could not initialize proctoring AI.", 'danger');
                startPromptCard.style.display = 'block';
                hideSpinner();
                return;
            }
        }
        
        const hasCamera = await setupCameraAndRecorder();
        if (!hasCamera) {
            hideSpinner();
            showToast("Camera and microphone access is required.", 'danger');
            startPromptCard.style.display = 'block';
            return;
        }
        
        hideSpinner();
        interviewCard.style.display = 'block';
        isInterviewActive = true;
        await beginInterviewSession();
    });

    // --- Interview Logic ---
    const setupCameraAndRecorder = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({ video: true, audio: true });
            videoPreview.srcObject = stream;
            videoPreview.addEventListener('playing', runObjectDetection);
            const options = { mimeType: 'video/webm; codecs=vp8,opus' };
            mediaRecorder = new MediaRecorder(stream, MediaRecorder.isTypeSupported(options.mimeType) ? options : undefined);
            mediaRecorder.ondataavailable = (event) => { if (event.data.size > 0) recordedChunks.push(event.data); };
            mediaRecorder.onstop = () => {
                if (isInterviewActive) handleRecordingSubmission(new Blob(recordedChunks, { type: 'video/webm' }));
                recordedChunks = [];
            };
            return true;
        } catch (err) {
            console.error("Media Device Error:", err);
            return false;
        }
    };

    const beginInterviewSession = async () => {
        chatHistory = [];
        // This now shows a GREEN toast notification.
        showToast("The proctored session has started. Please maintain focus.", 'success');
        showTypingIndicator();
        try {
            const res = await fetch(`${API_URL}/chat`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ job_description: jobDescription, chat_history: [{ role: 'user', content: "Start the interview." }], difficulty: selectedDifficulty }),
            });
            if (!res.ok) throw new Error('Failed to get first question.');
            const data = await res.json();
            
            hideTypingIndicator();
            currentQuestion = data.reply;
            addMessageToChat('model', currentQuestion);
            recordBtn.disabled = false;
            endInterviewBtn.disabled = false;
        } catch (error) {
            hideTypingIndicator();
            console.error("Start Interview Error:", error);
            addMessageToChat('model', "Sorry, an error occurred. Please restart.");
        }
    };

    const handleRecordingSubmission = async (videoBlob) => {
        showVideoSpinner("Analyzing your response...");
        recordBtn.disabled = true;
        
        const formData = new FormData();
        formData.append('video_file', videoBlob, 'answer.webm');
        formData.append('question', currentQuestion);
        formData.append('job_description', jobDescription);
        
        try {
            const res = await fetch(`${API_URL}/video`, { method: 'POST', body: formData });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const data = await res.json();
            
            hideVideoSpinner();

            const combinedMessage = `<strong>Feedback:</strong><br>${data.feedback}<br><br><strong>Next question:</strong><br>${data.next_question}`;

            chatHistory.push(
                { role: 'model', content: `Question: ${currentQuestion}` }, 
                { role: 'user', content: `(Provided a spoken answer)` }, 
                { role: 'model', content: combinedMessage }
            );

            showTypingIndicator();

            setTimeout(() => {
                hideTypingIndicator();
                addMessageToChat('model', combinedMessage);
                currentQuestion = data.next_question;
                recordBtn.disabled = false;
            }, 1200);

        } catch (error) {
            hideVideoSpinner();
            console.error("Recording Submission Error:", error);
            addMessageToChat('model', "Sorry, an error occurred. Please try recording again.");
            recordBtn.disabled = false;
        }
    };
    
    // --- Event Listeners ---
    recordBtn.addEventListener('click', () => {
        if (mediaRecorder?.state === 'inactive') {
            mediaRecorder.start();
            recordBtn.disabled = true; stopBtn.disabled = false; endInterviewBtn.disabled = true;
            recordingIndicator.style.display = 'block';
        }
    });

    stopBtn.addEventListener('click', () => {
        if (mediaRecorder?.state === 'recording') {
            mediaRecorder.stop();
            stopBtn.disabled = true; endInterviewBtn.disabled = false;
            recordingIndicator.style.display = 'none';
        }
    });

    endInterviewBtn.addEventListener('click', () => {
        if (isInterviewActive && confirm("Are you sure you want to end the interview?")) {
            isInterviewActive = false; 
            if (videoPreview.srcObject) videoPreview.srcObject.getTracks().forEach(track => track.stop());
            generateSummary();
        }
    });

    const generateSummary = async (extraData = {}) => {
        showSpinner("Generating performance summary...");
        interviewCard.style.display = 'none';
        try {
            const res = await fetch(`${API_URL}/summarize`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ 
                    job_description: jobDescription, chat_history: chatHistory,
                    proctoring_data: { tab_switch_count: tabSwitchCount, phone_detection_count: phoneDetectionCount, no_person_warnings: noPersonWarningCount, multiple_person_warnings: multiplePeopleWarningCount, ...extraData }
                }),
            });
            if (!res.ok) throw new Error(`HTTP error! status: ${res.status}`);
            const summary = await res.json();
            displaySummary(summary);
            summaryCard.style.display = 'block';
        } catch (error) {
            console.error("Summary Error:", error);
            summaryContent.innerHTML = `<p>An error occurred generating feedback.</p>`;
            summaryCard.style.display = 'block';
        } finally {
            hideSpinner();
        }
    };

    const displaySummary = (summary) => {
        if (summary.termination_reason) {
            summaryContent.innerHTML = `
                <div class="termination-notice">
                    <i class="fas fa-ban"></i>
                    <h3>Interview Terminated</h3>
                    <p>This session was ended due to multiple malpractice warnings.</p>
                    <p><strong>Reason:</strong> ${summary.termination_reason}</p>
                </div>`;
            return;
        }
        const strengthsHtml = (summary.strengths || []).map(s => `<li class="strength">${s}</li>`).join('');
        const improvementsHtml = (summary.areas_for_improvement || []).map(i => `<li class="improvement">${i}</li>`).join('');
        summaryContent.innerHTML = `
            <h3>Overall Score: ${summary.overall_score || 'N/A'}/100</h3>
            <h3>Strengths</h3><ul>${strengthsHtml || '<li>Not identified.</li>'}</ul>
            <h3>Areas for Improvement</h3><ul>${improvementsHtml || '<li>Not identified.</li>'}</ul>
            <div id="overall-feedback"><h3>Overall Feedback</h3><p>${summary.overall_feedback || 'Not available.'}</p></div>`;
    };
    
    restartInterviewBtn.addEventListener('click', () => window.location.reload());
    
    document.getElementById("logoutButton")?.addEventListener("click", () => {
        firebase.auth().signOut().catch(error => console.error("Error signing out:", error));
    });
});
