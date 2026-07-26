const firebaseConfig = {
    apiKey: "AIzaSyA-D0XcXpB5agZm9XdPV0CjHv9uJZd9Z2c",
    authDomain: "ai-career-coach-70a8d.firebaseapp.com",
    projectId: "ai-career-coach-70a8d",
    storageBucket: "ai-career-coach-70a8d.firebasestorage.app",
    messagingSenderId: "54181501139",
    appId: "1:54181501139:web:fd42aaeb0a0b2ae8539c26"
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

// --- Global Flag for Auth Redirection Control ---
let isAuthActionPending = false;

// --- Auth State Guard ---
auth.onAuthStateChanged(user => {
    // Only redirect if we are NOT in the middle of a form submit or Google login action.
    // If we are, the specific handlers below will manage the redirect after completing sync.
    if (user && !isAuthActionPending) {
        document.body.classList.add('auth-success');
        setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect');
            if (redirectUrl) {
                const plan = params.get('plan');
                const billing = params.get('billing');
                let targetUrl = redirectUrl;
                const queryParams = [];
                if (plan) queryParams.push(`plan=${plan}`);
                if (billing) queryParams.push(`billing=${billing}`);
                if (queryParams.length > 0) {
                    targetUrl += `?${queryParams.join('&')}`;
                }
                window.location.href = targetUrl;
            } else {
                window.location.href = 'home.html';
            }
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

    isAuthActionPending = true;

    try {
        const userCredential = await auth.createUserWithEmailAndPassword(email, password);
        await userCredential.user.updateProfile({ displayName: name });

        // Sync with backend database
        try {
            const response = await fetch(`${API_BASE_URL}/api/auth/signup`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ email: email, password: password, name: name })
            });
            if (!response.ok) { console.warn("Backend signup sync warned:", await response.json()); }
        } catch (backendError) {
            console.error("Backend signup registration sync failed, continuing to redirect:", backendError);
        }
        
        document.body.classList.add('auth-success');
        setTimeout(() => {
            window.location.href = 'home.html';
        }, 500);
    } catch (error) {
        showError(error.detail || error.message);
        isAuthActionPending = false;
    }
});

loginForm.addEventListener('submit', async (e) => {
    e.preventDefault();
    hideError();
    const email = document.getElementById('login-email').value;
    const password = document.getElementById('login-password').value;

    isAuthActionPending = true;

    try {
        await auth.signInWithEmailAndPassword(email, password);
        document.body.classList.add('auth-success');
        setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect');
            if (redirectUrl) {
                const plan = params.get('plan');
                const billing = params.get('billing');
                let targetUrl = redirectUrl;
                const queryParams = [];
                if (plan) queryParams.push(`plan=${plan}`);
                if (billing) queryParams.push(`billing=${billing}`);
                if (queryParams.length > 0) {
                    targetUrl += `?${queryParams.join('&')}`;
                }
                window.location.href = targetUrl;
            } else {
                window.location.href = 'home.html';
            }
        }, 500);
    } catch (error) {
        showError(error.message);
        isAuthActionPending = false;
    }
});

// --- Google Authentication Handler ---
const handleGoogleAuth = async () => {
    hideError();
    isAuthActionPending = true; 

    try {
        const provider = new firebase.auth.GoogleAuthProvider();
        provider.addScope('https://www.googleapis.com/auth/calendar.events');
        provider.addScope('https://www.googleapis.com/auth/tasks');
        
        // FORCE CONSENT to ensure we get a token
        provider.setCustomParameters({ prompt: 'consent' });

        const result = await auth.signInWithPopup(provider);
        console.log("Login Result:", result);
        
        let googleAccessToken = null;
        if (result.credential && result.credential.accessToken) {
            googleAccessToken = result.credential.accessToken;
        } else if (firebase.auth.GoogleAuthProvider.credentialFromResult) {
            const cred = firebase.auth.GoogleAuthProvider.credentialFromResult(result);
            if (cred) googleAccessToken = cred.accessToken;
        }

        if (googleAccessToken) {
            sessionStorage.setItem('googleAccessToken', googleAccessToken);
            console.log("✅ TOKEN SAVED:", googleAccessToken);
        }

        // Sync token with backend database
        try {
            const idToken = await result.user.getIdToken(); 
            const response = await fetch(`${API_BASE_URL}/api/auth/login`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ id_token: idToken })
            });
            if (!response.ok) { console.warn("Backend login sync warned:", await response.json()); }
        } catch (backendError) {
            console.error("Backend login registration sync failed, continuing to redirect:", backendError);
        }
        
        document.body.classList.add('auth-success');
        setTimeout(() => {
            const params = new URLSearchParams(window.location.search);
            const redirectUrl = params.get('redirect');
            if (redirectUrl) {
                const plan = params.get('plan');
                const billing = params.get('billing');
                let targetUrl = redirectUrl;
                const queryParams = [];
                if (plan) queryParams.push(`plan=${plan}`);
                if (billing) queryParams.push(`billing=${billing}`);
                if (queryParams.length > 0) {
                    targetUrl += `?${queryParams.join('&')}`;
                }
                window.location.href = targetUrl;
            } else {
                window.location.href = 'home.html';
            }
        }, 500);

    } catch (error) {
        console.error("Google Auth Error:", error);
        // Fallback: If user successfully authenticated in Firebase, redirect them anyway!
        if (auth.currentUser) {
            console.log("Firebase credentials active. Redirecting user despite sync error.");
            document.body.classList.add('auth-success');
            setTimeout(() => {
                window.location.href = 'home.html';
            }, 500);
        } else {
            showError(error.detail || error.message);
            isAuthActionPending = false; 
        }
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