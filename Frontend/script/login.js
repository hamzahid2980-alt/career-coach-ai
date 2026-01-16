const firebaseConfig = {
    apiKey: "YOUR_FIREBASE_API_KEY", // Replace with your actual key in production (or use environment variables if applicable)
    authDomain: "genaihack-240d7.firebaseapp.com",
    projectId: "genaihack-240d7",
    storageBucket: "genaihack-240d7.firebasestorage.app",
    messagingSenderId: "1095624251792",
    appId: "1:1095624251792:web:8b4be21e68c1a8bcc2bb15"
};

firebase.initializeApp(firebaseConfig);
const auth = firebase.auth();
const provider = new firebase.auth.GoogleAuthProvider();

// IMPORTANT: Ensure this matches your running backend URL (127.0.0.1 is safer than localhost)
const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1') 
    ? 'http://127.0.0.1:8000' 
    : 'https://career-coach-ai-3xap.onrender.com'; 

// --- DOM Element References ---
const loginFormContainer = document.getElementById('login-form-container');
const signupFormContainer = document.getElementById('signup-form-container');
const loginForm = document.getElementById('login-form');
const signupForm = document.getElementById('signup-form');
const showSignupLink = document.getElementById('show-signup');
const showLoginLink = document.getElementById('show-login');
const googleSignInBtn = document.getElementById('google-signin-btn');
const googleSignInBtnSignup = document.getElementById('google-signin-btn-signup');
const errorMessageDiv = document.getElementById('error-message');

// --- Global Flag for Race Condition Fix ---
let isGoogleLoginPending = false;

// --- Auth State Guard ---
auth.onAuthStateChanged(user => {
    // FIX: Only redirect if we are NOT in the middle of a Google Login.
    // If we are, handleGoogleAuth() will handle the redirect after saving the token.
    if (user && !isGoogleLoginPending) {
        // console.log("User is signed in, redirecting to home.");
        document.body.classList.add('auth-success');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 500);
    }
});

// --- UI Toggling Logic for Fade Animation ---
showSignupLink.addEventListener('click', (e) => {
    e.preventDefault();
    loginFormContainer.classList.remove('active');
    signupFormContainer.classList.add('active');
    hideError();
});

showLoginLink.addEventListener('click', (e) => {
    e.preventDefault();
    signupFormContainer.classList.remove('active');
    loginFormContainer.classList.add('active');
    hideError();
});

// --- Form Submission Handlers ---
signupForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const name = document.getElementById('signup-name').value;
    const email = document.getElementById('signup-email').value;
    const password = document.getElementById('signup-password').value;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });

        const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email: email, password: password, name: name })
        });

        if (!response.ok) { throw await response.json(); }
        
        // Redirect is handled by onAuthStateChanged because isGoogleLoginPending is false
    } catch (error) {
        showError(error.detail || error.message);
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    try {
        await auth.signInWithEmailAndPassword(email, password);
    } catch (error) {
        showError(error.message);
    }
});
// --- REPLACE YOUR handleGoogleAuth FUNCTION WITH THIS ---

const handleGoogleAuth = async () => {
    hideError();
    isGoogleLoginPending = true; 

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
        provider.addScope('https://www.googleapis.com/auth/tasks');
        
        // FORCE CONSENT to ensure we get a token
        provider.setCustomParameters({ prompt: 'consent' });

        const result = await auth.signInWithPopup(provider);
        
        // --- DEBUGGING LOGS ---
        console.log("Login Result:", result);
        
        let googleAccessToken = null;
        
        // Check method 1 (Standard)
        if (result.credential && result.credential.accessToken) {
            googleAccessToken = result.credential.accessToken;
            console.log("Found token in result.credential");
        } 
        // Check method 2 (Helper)
        else if (firebase.auth.GoogleAuthProvider.credentialFromResult) {
            const cred = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
            if (cred) {
                googleAccessToken = cred.accessToken;
                console.log("Found token via credentialFromResult");
            }
        }

        if (googleAccessToken) {
            sessionStorage.setItem('googleAccessToken', googleAccessToken);
            console.log("✅ TOKEN SAVED:", googleAccessToken); // Look for this in console
        } else {
            console.error("❌ NO TOKEN FOUND IN RESULT. Check scopes.");
        }

        // Proceed with backend login
        const idToken = await result.user.getIdToken(); 
        const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ id_token: idToken })
        });

        if (!response.ok) { throw await response.json(); }
        
        document.body.classList.add('auth-success');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 500);

    } catch (error) {
        console.error("Google Auth Error:", error);
        showError(error.detail || error.message);
        isGoogleLoginPending = false; 
    }
};

googleSignInBtn.addEventListener('click', handleGoogleAuth);
if (googleSignInBtnSignup) {
    googleSignInBtnSignup.addEventListener('click', handleGoogleAuth);
}

// --- Helper Functions ---
function showError(message) {
    errorMessageDiv.textContent = message;
    errorMessageDiv.classList.add('visible');
}
function hideError() {
    errorMessageDiv.classList.remove('visible');
}

// --- Password Visibility Toggle Logic ---
document.querySelectorAll('.toggle-password').forEach(toggle => {
    toggle.addEventListener('click', function() {
        const targetId = this.dataset.target;
        const passwordInput = document.getElementById(targetId);
        const icon = this.querySelector('i');

        if (passwordInput.type === 'password') {
            passwordInput.type = 'text';
            icon.classList.remove('fa-eye');
            icon.classList.add('fa-eye-slash');
        } else {
            passwordInput.type = 'password';
            icon.classList.remove('fa-eye-slash');
            icon.classList.add('fa-eye');
        }
    });
});