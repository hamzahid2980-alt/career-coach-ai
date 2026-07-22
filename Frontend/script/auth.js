const firebaseConfig = {
    apiKey: "AIzaSyDtuYr4icwQf2HsvByrCZeqbEex28lL6GI", // <--- IMPORTANT: Replace with your actual Firebase API key
    authDomain: "genaihack-240d7.firebaseapp.com",
    projectId: "genaihack-240d7",
    storageBucket: "genaihack-240d7.firebasestorage.app",
    messagingSenderId: "1095624251792",
    appId: "1:1095624251792:web:8b4be21e68c1a8bcc2bb15"
};

// Initialize Firebase if it hasn't been already
if (!firebase.apps.length) {
    firebase.initializeApp(firebaseConfig);
}
const auth = firebase.auth();

// Inject Global Upgrade Plan Modal on protected dashboard pages
function injectPricingModal() {
    // Avoid double injection
    if (document.getElementById('global-upgrade-modal')) return;

    // 1. Inject Styles
    const style = document.createElement('style');
    style.innerHTML = `
        .pricing-modal-overlay {
            position: fixed; inset: 0; background: rgba(10,9,15,.85);
            backdrop-filter: blur(10px); z-index: 10000;
            display: none; align-items: center; justify-content: center;
            opacity: 0; transition: opacity .3s ease; padding: 20px;
            overflow-y: auto;
        }
        .pricing-modal-overlay.show { display: flex; opacity: 1; }
        .pricing-modal-container {
            background: #13111C; border: 1px solid rgba(138, 73, 255, 0.25);
            border-radius: 20px; max-width: 1050px; width: 100%;
            padding: 3.2rem 2rem 2.2rem; position: relative;
            box-shadow: 0 20px 50px rgba(0,0,0,0.6);
            animation: modalPop .4s cubic-bezier(.175,.885,.32,1.1) forwards;
            max-height: 90vh; overflow-y: auto;
            -ms-overflow-style: none;  /* IE and Edge */
            scrollbar-width: none;  /* Firefox */
        }
        .pricing-modal-container::-webkit-scrollbar {
            display: none; /* Chrome, Safari and Opera */
        }
        @keyframes modalPop {
            from { transform: scale(.9) translateY(30px); opacity: 0; }
            to { transform: scale(1) translateY(0); opacity: 1; }
        }
        .modal-close-btn {
            position: absolute; top: 20px; right: 20px;
            background: transparent; border: none; color: #8E8C99;
            font-size: 1.4rem; cursor: pointer; transition: color .2s;
            z-index: 10002;
        }
        .modal-close-btn:hover { color: #EAEBF0; }
        
        .modal-hero { text-align: center; margin-bottom: 2rem; }
        .modal-hero h2 { font-size: 2rem; font-weight: 800; color: #EAEBF0; margin-bottom: .4rem; }
        .modal-hero p { color: #8E8C99; font-size: .95rem; }
        
        .limit-alert-banner {
            background: rgba(255, 77, 184, 0.1);
            border: 1px solid rgba(255, 77, 184, 0.3);
            border-radius: 12px; padding: 10px 48px 10px 16px;
            color: #FF4DB8; font-size: .88rem; font-weight: 600;
            margin-bottom: 1.5rem; text-align: center;
            display: none; align-items: center; justify-content: center; gap: 8px;
        }

        /* Billing period selector */
        .modal-toggle-wrap {
            display: flex; align-items: center; justify-content: center;
            gap: .85rem; margin-bottom: 2rem;
        }
        .modal-toggle-label { font-size: .9rem; font-weight: 600; color: #8E8C99; }
        .modal-toggle-label.active { color: #EAEBF0; }
        .modal-toggle-switch {
            position: relative; width: 44px; height: 24px;
            border-radius: 50px; background: rgba(138, 73, 255, 0.25);
            cursor: pointer; border: none; transition: background .3s;
        }
        .modal-toggle-switch.active { background: #8A49FF; }
        .modal-toggle-thumb {
            position: absolute; top: 3px; left: 3px; width: 18px; height: 18px;
            border-radius: 50%; background: #fff; transition: transform .3s;
        }
        .modal-toggle-switch.active .modal-toggle-thumb { transform: translateX(20px); }
        .modal-save-badge {
            background: linear-gradient(90deg, #8A49FF, #FF4DB8);
            color: #fff; font-size: .7rem; padding: 2px 8px; border-radius: 50px; font-weight: 700;
        }

        /* Cards grid */
        .modal-grid {
            display: grid; grid-template-columns: repeat(3, 1fr); gap: 1.5rem;
            margin-bottom: 2rem;
        }
        .modal-card {
            background: #1A1726; border: 1px solid rgba(138, 73, 255, 0.15);
            border-radius: 16px; padding: 1.8rem 1.4rem; display: flex; flex-direction: column;
            position: relative; transition: border-color .3s, transform .3s;
        }
        .modal-card:hover { transform: translateY(-4px); border-color: rgba(138,73,255,.4); }
        .modal-card.pro {
            border-color: rgba(138, 73, 255, 0.4);
            background: linear-gradient(160deg, rgba(138, 73, 255, 0.06) 0%, #1A1726 60%);
        }
        .modal-card-tag {
            position: absolute; top: 0; left: 50%; transform: translateX(-50%);
            background: linear-gradient(90deg, #8A49FF, #FF4DB8); color: #fff;
            font-size: .65rem; font-weight: 700; padding: 4px 12px; border-bottom-left-radius: 8px;
            border-bottom-right-radius: 8px; text-transform: uppercase; letter-spacing: .5px;
        }
        .modal-tier-badge {
            align-self: flex-start; font-size: .68rem; font-weight: 700;
            padding: 3px 10px; border-radius: 50px; text-transform: uppercase;
            letter-spacing: .5px; margin-bottom: .8rem;
        }
        .badge-free { background: rgba(100, 220, 170, 0.12); color: #50daa0; border: 1px solid rgba(100, 220, 170, 0.25); }
        .badge-pro { background: rgba(138, 73, 255, 0.15); color: #8A49FF; border: 1px solid rgba(138, 73, 255, 0.3); }
        .badge-premium { background: rgba(255, 195, 40, 0.12); color: #f5c430; border: 1px solid rgba(255, 195, 40, 0.3); }
        
        .modal-tier-name { font-size: 1.15rem; font-weight: 700; margin-bottom: .6rem; }
        .modal-price-wrap { display: flex; align-items: baseline; gap: 2px; margin-bottom: 1.2rem; }
        .modal-price-val { font-size: 2.5rem; font-weight: 800; color: #EAEBF0; line-height: 1; }
        .modal-price-period { font-size: .85rem; color: #8E8C99; }
        
        .modal-card.pro .modal-price-val {
            background: linear-gradient(90deg, #8A49FF, #FF4DB8); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }
        .modal-card.premium .modal-price-val {
            background: linear-gradient(90deg, #f5c430, #ffaa00); -webkit-background-clip: text; -webkit-text-fill-color: transparent;
        }

        .modal-btn {
            display: flex; align-items: center; justify-content: center; gap: 8px;
            font-weight: 700; font-size: .88rem; padding: .75rem; border-radius: 10px;
            cursor: pointer; text-decoration: none; border: 1px solid transparent;
            margin-bottom: 1.2rem; width: 100%; transition: all .2s;
        }
        .modal-btn-free { background: transparent; color: #EAEBF0; border-color: rgba(255,255,255,.09); }
        .modal-btn-free:hover { background: rgba(255,255,255,.03); border-color: #8A49FF; }
        .modal-btn-pro { background: #8A49FF; color: #fff; }
        .modal-btn-pro:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(138,73,255,.3); }
        .modal-btn-premium { background: #f5c430; color: #13111C; }
        .modal-btn-premium:hover { transform: translateY(-1px); box-shadow: 0 4px 12px rgba(245,196,48,.3); }

        .modal-features { list-style: none; display: flex; flex-direction: column; gap: .6rem; }
        .modal-features li { display: flex; align-items: flex-start; gap: 8px; font-size: .8rem; color: #8E8C99; }
        .modal-features li i { font-size: .75rem; margin-top: 3px; flex-shrink: 0; }
        .modal-features li.included { color: #EAEBF0; }
        .modal-features li.locked { opacity: .4; }
        .modal-features li i.fa-check { color: #50daa0; }
        .modal-features li i.fa-crown { color: #f5c430; }

        .no-thanks-btn {
            display: block; margin: 1.5rem auto 0.5rem; background: transparent; border: none;
            color: #8E8C99; font-weight: 600; font-size: .9rem; cursor: pointer;
            transition: color .2s; text-decoration: underline;
        }
        .no-thanks-btn:hover { color: #EAEBF0; }

        .compare-toggle-btn {
            background: linear-gradient(135deg, rgba(30, 27, 46, 0.4), rgba(17, 15, 26, 0.4));
            border: 1px solid rgba(138, 73, 255, 0.35);
            color: #C084FC; font-weight: 700; font-size: .8rem; padding: 8px 18px;
            border-radius: 50px; cursor: pointer; transition: all .3s ease;
            margin: 2.2rem auto 0.75rem; display: inline-flex; align-items: center; justify-content: center;
            backdrop-filter: blur(8px);
            box-shadow: 0 4px 15px rgba(0, 0, 0, 0.2);
            font-family: 'Inter', sans-serif;
            letter-spacing: 0.5px;
        }
        .compare-toggle-btn:hover {
            color: #FFF; border-color: #FF4DB8;
            box-shadow: 0 0 15px rgba(255, 77, 184, 0.25);
            transform: translateY(-1px);
        }
        
        .compare-table-wrapper {
            max-height: 0; overflow: hidden; transition: max-height 0.4s cubic-bezier(0.4, 0, 0.2, 1);
            width: 100%;
            border-radius: 12px;
            background: rgba(10, 9, 15, 0.3);
            border: 1px solid rgba(255, 255, 255, 0.03);
        }
        .compare-table-wrapper.open {
            max-height: 380px; overflow-y: auto; margin-bottom: 2rem; margin-top: 1.5rem;
            border-color: rgba(255, 255, 255, 0.06);
            box-shadow: inset 0 0 20px rgba(0, 0, 0, 0.5);
            -ms-overflow-style: none; scrollbar-width: none;
        }
        .compare-table-wrapper.open::-webkit-scrollbar { display: none; }

        .compare-table {
            width: 100%; border-collapse: collapse; text-align: left;
            font-size: 0.78rem; font-family: 'Inter', sans-serif;
        }
        .compare-table th, .compare-table td {
            padding: 10px 16px; border-bottom: 1px solid rgba(255, 255, 255, 0.04);
        }
        .compare-table th {
            color: #EAEBF0; font-weight: 700; background: rgba(17, 15, 26, 0.95);
            position: sticky; top: 0; z-index: 2;
            border-bottom: 1px solid rgba(138, 73, 255, 0.15);
            text-transform: uppercase; font-size: 0.72rem; letter-spacing: 0.8px;
        }
        .compare-table td { color: #9CA3AF; }
        .compare-table tr:last-child td { border-bottom: none; }
        .compare-table td.feat-name { color: #EAEBF0; font-weight: 600; }
        .compare-table tr:hover td { background: rgba(138, 73, 255, 0.04); color: #FFF; }
        .compare-table td strong { color: #FFF; font-weight: 700; }
        .compare-table td.val-free { color: #8E8C99; }
        .compare-table td.val-pro { color: #D8B4FE; }
        .compare-table td.val-premium { color: #FDE047; font-weight: 700; }
        .compare-table td i.fa-check { color: #34D399; font-size: 0.85rem; }
        .compare-table td i.fa-crown { color: #F5C430; font-size: 0.85rem; }
        .compare-table td i.fa-times { color: #FF4DB8; opacity: 0.25; font-size: 0.8rem; }
        .compare-table td .status-na { color: rgba(255, 255, 255, 0.15); font-weight: 400; }

        @media (max-width: 860px) {
            .modal-grid { grid-template-columns: 1fr; }
            .pricing-modal-container { max-height: 95vh; }
        }
    `;
    document.head.appendChild(style);

    // 2. Inject Modal HTML Markup
    const overlay = document.createElement('div');
    overlay.id = 'global-upgrade-modal';
    overlay.className = 'pricing-modal-overlay';
    overlay.innerHTML = `
        <div class="pricing-modal-container">
            <button class="modal-close-btn" onclick="hideUpgradeModal()"><i class="fas fa-times"></i></button>
            
            <div class="limit-alert-banner" id="modal-limit-banner">
                <i class="fas fa-circle-exclamation"></i>
                <span id="modal-limit-text">You have exhausted your daily free tier limits!</span>
            </div>

            <div class="modal-hero">
                <h2>Upgrade Your Account</h2>
                <p>Choose a plan that fits your career acceleration goals</p>
            </div>

            <div class="modal-toggle-wrap">
                <span class="modal-toggle-label active" id="modal-lbl-monthly">Monthly</span>
                <button class="modal-toggle-switch" id="modal-toggle-btn" onclick="toggleModalBilling()">
                    <span class="modal-toggle-thumb"></span>
                </button>
                <span class="modal-toggle-label" id="modal-lbl-annual">Annual</span>
                <span class="modal-save-badge">Save 20%</span>
            </div>

            <div class="modal-grid">
                <!-- Free Card -->
                <div class="modal-card">
                    <span class="modal-tier-badge badge-free">Starter</span>
                    <h3 class="modal-tier-name">Free</h3>
                    <div class="modal-price-wrap">
                        <span class="modal-price-val">₹0</span>
                        <span class="modal-price-period">/month</span>
                    </div>
                    <button class="modal-btn modal-btn-free" onclick="hideUpgradeModal()">Current Active Plan</button>
                    <ul class="modal-features">
                        <li class="included"><i class="fas fa-check"></i><span>ATS Analysis <strong>1x/mo</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Career Roadmap <strong>1 roadmap</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Skills Assessment <strong>2/mo</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Mock Interview <strong>2 sessions</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>AI Chatbot <strong>10 msgs/day</strong></span></li>
                        <li class="locked"><i class="fas fa-lock"></i><span>Hackathon alerts locked</span></li>
                    </ul>
                </div>

                <!-- Pro Card -->
                <div class="modal-card pro">
                    <span class="modal-card-tag">Most Popular</span>
                    <span class="modal-tier-badge badge-pro">Pro</span>
                    <h3 class="modal-tier-name">Career Accelerator</h3>
                    <div class="modal-price-wrap">
                        <span class="modal-price-val" id="modal-price-pro">₹199</span>
                        <span class="modal-price-period" id="modal-period-pro">/month</span>
                    </div>
                    <button class="modal-btn modal-btn-pro" onclick="proceedModalUpgrade('pro')">Upgrade to Pro</button>
                    <ul class="modal-features">
                        <li class="included"><i class="fas fa-check"></i><span>ATS Analysis <strong>5x/mo</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Roadmaps <strong>3/mo + editable</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Skills Assessment <strong>10/mo</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>Mock Interview <strong>10 sessions</strong></span></li>
                        <li class="included"><i class="fas fa-check"></i><span>AI Chatbot <strong>50 msgs/day</strong></span></li>
                        <li class="locked"><i class="fas fa-lock"></i><span>Hackathon alerts locked</span></li>
                    </ul>
                </div>

                <!-- Premium Card -->
                <div class="modal-card premium">
                    <span class="modal-tier-badge badge-premium">Elite</span>
                    <h3 class="modal-tier-name">Career Elite</h3>
                    <div class="modal-price-wrap">
                        <span class="modal-price-val" id="modal-price-premium">₹399</span>
                        <span class="modal-price-period" id="modal-period-premium">/month</span>
                    </div>
                    <button class="modal-btn modal-btn-premium" onclick="proceedModalUpgrade('premium')">Go Elite</button>
                    <ul class="modal-features">
                        <li class="included"><i class="fas fa-crown"></i><span><strong>Everything in Pro</strong></span></li>
                        <li class="included"><i class="fas fa-crown"></i><span>ATS Analysis <strong>Unlimited</strong></span></li>
                        <li class="included"><i class="fas fa-crown"></i><span>Career Roadmaps <strong>Unlimited</strong></span></li>
                        <li class="included"><i class="fas fa-crown"></i><span>Skills Assessment <strong>Unlimited</strong></span></li>
                        <li class="included"><i class="fas fa-crown"></i><span><strong>AI Avatar Interviewer</strong></span></li>
                        <li class="included"><i class="fas fa-crown"></i><span><strong>Hackathon Alerts</strong></span></li>
                    </ul>
                </div>
            </div>

            <div style="text-align:center;">
                <button class="compare-toggle-btn" id="modal-compare-btn" onclick="toggleCompareTable()">
                    Compare All Features <i class="fas fa-chevron-down" style="margin-left:6px;"></i>
                </button>
            </div>
            
            <div class="compare-table-wrapper" id="modal-compare-wrapper">
                <table class="compare-table">
                    <thead>
                        <tr>
                            <th>Feature Details</th>
                            <th>Free (Starter)</th>
                            <th>Pro (Accelerator)</th>
                            <th>Elite (Premium)</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr><td class="feat-name">Resume ATS Optimization</td><td class="val-free">1x/month</td><td class="val-pro">5x/month</td><td class="val-premium"><strong>Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Career Roadmap Builder</td><td class="val-free">1 roadmap</td><td class="val-pro">3/month + editable</td><td class="val-premium"><strong>Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Skills Assessment</td><td class="val-free">2/month</td><td class="val-pro">10/month</td><td class="val-premium"><strong>Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Mock Interview Sessions</td><td class="val-free">2 sessions (5 Qs)</td><td class="val-pro">10 sessions (10 Qs)</td><td class="val-premium"><strong>Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Interview Summary PDF Report</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro">Standard Summary</td><td class="val-premium"><strong>Full Report + PDF</strong></td></tr>
                        <tr><td class="feat-name">AI Avatar (Voice + Face)</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><span class="status-na">—</span></td><td class="val-premium"><strong><i class="fas fa-crown"></i> Included</strong></td></tr>
                        <tr><td class="feat-name">Live Mic Responses</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><span class="status-na">—</span></td><td class="val-premium"><strong><i class="fas fa-crown"></i> Included</strong></td></tr>
                        <tr><td class="feat-name">Job Matching Results</td><td class="val-free">2 results/search</td><td class="val-pro">10 results/search</td><td class="val-premium"><strong>20 results/search</strong></td></tr>
                        <tr><td class="feat-name">AI Chatbot Queries</td><td class="val-free">10 msgs/day</td><td class="val-pro">50 msgs/day</td><td class="val-premium"><strong>200 msgs/day</strong></td></tr>
                        <tr><td class="feat-name">Career Mail Writer</td><td class="val-free">1 email/day</td><td class="val-pro">5 emails/day</td><td class="val-premium"><strong>Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Portfolio Website Generator</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><span class="status-na">—</span></td><td class="val-premium"><strong><i class="fas fa-crown"></i> Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Portfolio Design Rater</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><span class="status-na">—</span></td><td class="val-premium"><strong><i class="fas fa-crown"></i> Unlimited</strong></td></tr>
                        <tr><td class="feat-name">Google Calendar Sync</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><i class="fas fa-check"></i></td><td class="val-premium"><strong><i class="fas fa-check"></i></strong></td></tr>
                        <tr><td class="feat-name">Hackathon Alerts (Curated)</td><td class="val-free">Browse Only</td><td class="val-pro">Browse Only</td><td class="val-premium"><strong>Skill-Matched Alerts</strong></td></tr>
                        <tr><td class="feat-name">Daily Job Alert Emails</td><td class="val-free"><span class="status-na">—</span></td><td class="val-pro"><span class="status-na">—</span></td><td class="val-premium"><strong><i class="fas fa-crown"></i> Included</strong></td></tr>
                    </tbody>
                </table>
            </div>

            <button class="no-thanks-btn" onclick="hideUpgradeModal()">No Thanks, continue as free</button>
        </div>
    `;
    document.body.appendChild(overlay);

    // 3. Close modal when overlay clicked
    overlay.addEventListener('click', (e) => {
        if (e.target === overlay) hideUpgradeModal();
    });
}

// Global modal triggers
let modalBillingPeriod = 'monthly';

window.toggleModalBilling = function() {
    const btn = document.getElementById('modal-toggle-btn');
    const lblMonthly = document.getElementById('modal-lbl-monthly');
    const lblAnnual = document.getElementById('modal-lbl-annual');
    
    const pricePro = document.getElementById('modal-price-pro');
    const periodPro = document.getElementById('modal-period-pro');
    const pricePremium = document.getElementById('modal-price-premium');
    const periodPremium = document.getElementById('modal-period-premium');

    if (modalBillingPeriod === 'monthly') {
        modalBillingPeriod = 'annual';
        btn.classList.add('active');
        lblMonthly.classList.remove('active');
        lblAnnual.classList.add('active');
        
        pricePro.textContent = '₹159';
        periodPro.textContent = '/month, billed annually';
        pricePremium.textContent = '₹319';
        periodPremium.textContent = '/month, billed annually';
    } else {
        modalBillingPeriod = 'monthly';
        btn.classList.remove('active');
        lblMonthly.classList.add('active');
        lblAnnual.classList.remove('active');
        
        pricePro.textContent = '₹199';
        periodPro.textContent = '/month';
        pricePremium.textContent = '₹399';
        periodPremium.textContent = '/month';
    }
};

window.toggleCompareTable = function() {
    const wrapper = document.getElementById('modal-compare-wrapper');
    const btn = document.getElementById('modal-compare-btn');
    const icon = btn.querySelector('i');
    
    wrapper.classList.toggle('open');
    if (wrapper.classList.contains('open')) {
        icon.className = 'fas fa-chevron-up';
    } else {
        icon.className = 'fas fa-chevron-down';
    }
};

window.showUpgradeModal = function(reason = "") {
    injectPricingModal();
    const banner = document.getElementById('modal-limit-banner');
    const bannerText = document.getElementById('modal-limit-text');
    if (reason) {
        bannerText.textContent = reason;
        banner.style.display = 'flex';
    } else {
        banner.style.display = 'none';
    }
    document.getElementById('global-upgrade-modal').classList.add('show');
    document.body.style.overflow = 'hidden';
};

window.hideUpgradeModal = function() {
    const modal = document.getElementById('global-upgrade-modal');
    if (modal) {
        modal.classList.remove('show');
        document.body.style.overflow = '';
    }
};

window.proceedModalUpgrade = function(plan) {
    window.location.href = `upgrade.html?plan=${plan}&billing=${modalBillingPeriod}`;
};

// Sidebar navigation interceptor setup using robust event delegation
function setupSidebarModalInterceptor() {
    document.addEventListener('click', (e) => {
        const anchor = e.target.closest('a');
        if (anchor && anchor.getAttribute('href') === 'select_plan.html') {
            e.preventDefault();
            e.stopPropagation();
            window.showUpgradeModal();
        }
    });
}


auth.onAuthStateChanged(user => {
    if (user) {
        // If a function named 'onUserLoggedIn' exists on the page, call it.
        if (typeof onUserLoggedIn === "function") {
            onUserLoggedIn(user);
        }
        
        // Inject global popup capability & intercept sidebar link
        injectPricingModal();
        setupSidebarModalInterceptor();
        
        // Enforce subscription-based access control
        enforceSubscriptionRestrictions(user);

        // Redirect authenticated users from login/index to home or the requested redirect URL
        if (window.location.pathname === '/login.html' || window.location.pathname === '/' || window.location.pathname === '/index.html') {
             const params = new URLSearchParams(window.location.search);
             const redirectUrl = params.get('redirect');
             if (redirectUrl) {
                 // Keep parameters like ?plan=pro&billing=annual&from=hackathon_pricing intact
                 const plan    = params.get('plan');
                 const billing = params.get('billing');
                 const from    = params.get('from');
                 let targetUrl = redirectUrl;
                 const queryParams = [];
                 if (plan)    queryParams.push(`plan=${plan}`);
                 if (billing) queryParams.push(`billing=${billing}`);
                 if (from)    queryParams.push(`from=${from}`);
                 if (queryParams.length > 0) {
                     targetUrl += `?${queryParams.join('&')}`;
                 }
                 window.location.href = targetUrl;
             } else {
                 window.location.href = '/home.html';
             }
        }
    } else {
        // If not logged in and on a protected page, redirect to index.html
        const protectedPaths = ['/home.html', '/profile.html', '/optimizer.html', '/roadmap.html', '/joblisting.html','/assessment.html','/interview.html', '/hackathons.html'];
        if (protectedPaths.includes(window.location.pathname) || (window.location.pathname.startsWith('/script') && !window.location.pathname.includes('login.js'))) {
            window.location.href = '/index.html';
        }
    }
});

function applySubscriptionLocks(tier) {
    const currentPath = window.location.pathname.split('/').pop();
    
    // Determine what is locked based on the tier
    let lockedPages = [];
    if (tier === 'free') {
        lockedPages = ['portfolio_generator.html', 'portfolio_rater.html', 'career_mail.html'];
    } else if (tier === 'pro') {
        lockedPages = ['portfolio_generator.html', 'portfolio_rater.html'];
    }

    // 1. Direct page access gate
    if (lockedPages.includes(currentPath)) {
        let triggerVal = '1';
        if (currentPath === 'portfolio_generator.html') triggerVal = 'portfolio_generator';
        else if (currentPath === 'portfolio_rater.html') triggerVal = 'portfolio_rater';
        else if (currentPath === 'career_mail.html') triggerVal = 'career_mail';
        window.location.href = `home.html?trigger_upgrade=${triggerVal}`;
        return;
    }

    // 2. Visually lock or unlock sidebar links
    const allPremiumPages = ['portfolio_generator.html', 'portfolio_rater.html', 'career_mail.html'];
    allPremiumPages.forEach(page => {
        const links = document.querySelectorAll(`a[href="${page}"]`);
        links.forEach(link => {
            if (lockedPages.includes(page)) {
                link.style.opacity = '0.55';
                if (!link.querySelector('.fa-lock')) {
                    const lock = document.createElement('i');
                    lock.className = 'fas fa-lock';
                    lock.style.cssText = 'margin-left: auto; font-size: 0.72rem; color: #8E8C99;';
                    link.appendChild(lock);
                }
                
                // Override navigation click handler
                link.onclick = (e) => {
                    e.preventDefault();
                    e.stopPropagation();
                    let msg = `This feature is locked on your current '${tier.toUpperCase()}' plan. Upgrade to access!`;
                    if (page === 'portfolio_generator.html') {
                        msg = `Portfolio Generator is locked on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!`;
                    } else if (page === 'portfolio_rater.html') {
                        msg = `Portfolio Rater is locked on the ${tier.charAt(0).toUpperCase() + tier.slice(1)} tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!`;
                    } else if (page === 'career_mail.html') {
                        msg = `Career Mail is locked on the Free tier. This feature requires the Career Accelerator (Pro) plan. Upgrade now to gain instant access!`;
                    }
                    window.showUpgradeModal(msg);
                };
            } else {
                // Unlock
                link.style.opacity = '';
                const lock = link.querySelector('.fa-lock');
                if (lock) lock.remove();
                link.onclick = null; // restore standard navigation
            }
        });
    });

    // 3. Lock or Unlock dashboard feature cards on home.html
    const cardLocks = [
        { id: 'portfolio-card', page: 'portfolio_generator.html', btnText: '🔒 Unlock Generator', originalBtnText: 'Generate Portfolio' },
        { id: 'rater-card', page: 'portfolio_rater.html', btnText: '🔒 Unlock Rater', originalBtnText: 'Rate Portfolio' },
        { id: 'mail-card', page: 'career_mail.html', btnText: '🔒 Unlock Mail', originalBtnText: 'Draft Email' }
    ];
    cardLocks.forEach(item => {
        const card = document.getElementById(item.id);
        if (card) {
            if (lockedPages.includes(item.page)) {
                card.style.opacity = '0.65';
                card.style.position = 'relative';
                
                if (!card.querySelector('.dashboard-lock-badge')) {
                    const badge = document.createElement('div');
                    badge.className = 'dashboard-lock-badge';
                    badge.style.cssText = 'position: absolute; top: 16px; right: 16px; background: rgba(10, 9, 15, 0.85); border: 1px solid rgba(255, 77, 184, 0.4); border-radius: 20px; padding: 4px 12px; color: #FF4DB8; font-size: 0.72rem; font-weight: 700; display: flex; align-items: center; gap: 4px; z-index: 5;';
                    badge.innerHTML = '<i class="fas fa-lock"></i> Locked';
                    card.appendChild(badge);
                }

                const btn = card.querySelector('button');
                if (btn) {
                    btn.textContent = item.btnText;
                    btn.style.background = 'rgba(255,255,255,0.02)';
                    btn.style.border = '1px solid rgba(255,255,255,0.1)';
                    btn.style.color = '#8E8C99';
                }
            } else {
                // Ensure card is completely unlocked and responsive
                card.style.opacity = '';
                card.style.position = '';
                const badge = card.querySelector('.dashboard-lock-badge');
                if (badge) badge.remove();

                const btn = card.querySelector('button');
                if (btn) {
                    btn.textContent = item.originalBtnText;
                    btn.style.background = '';
                    btn.style.border = '';
                    btn.style.color = '';
                }
            }
        }
    });

    // 4. Capture-phase global click interceptor (delegated to active lockedPages)
    if (!window.hasGlobalClickInterceptor) {
        window.hasGlobalClickInterceptor = true;
        document.addEventListener('click', (e) => {
            const currentTier = localStorage.getItem('subscription_tier') || 'free';
            let activeLockedPages = [];
            if (currentTier === 'free') {
                activeLockedPages = ['portfolio_generator.html', 'portfolio_rater.html', 'career_mail.html'];
            } else if (currentTier === 'pro') {
                activeLockedPages = ['portfolio_generator.html', 'portfolio_rater.html'];
            }
            
            if (activeLockedPages.length > 0) {
                const target = e.target.closest('button, a');
                if (target) {
                    const onclickAttr = target.getAttribute('onclick') || '';
                    const hrefAttr = target.getAttribute('href') || '';
                    const destination = onclickAttr + hrefAttr;
                    
                    if (activeLockedPages.some(page => destination.includes(page))) {
                        e.preventDefault();
                        e.stopPropagation();
                        let targetPage = activeLockedPages.find(page => destination.includes(page));
                        let msg = `This feature is locked on your current '${currentTier.toUpperCase()}' plan. Upgrade to access!`;
                        if (targetPage === 'portfolio_generator.html') {
                            msg = `Portfolio Generator is locked on the ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!`;
                        } else if (targetPage === 'portfolio_rater.html') {
                            msg = `Portfolio Rater is locked on the ${currentTier.charAt(0).toUpperCase() + currentTier.slice(1)} tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!`;
                        } else if (targetPage === 'career_mail.html') {
                            msg = `Career Mail is locked on the Free tier. This feature requires the Career Accelerator (Pro) plan. Upgrade now to gain instant access!`;
                        }
                        window.showUpgradeModal(msg);
                    }
                }
            }
        }, true);
    }
}

async function enforceSubscriptionRestrictions(user) {
    const API_BASE_URL = (window.location.hostname === 'localhost' || window.location.hostname === '127.0.0.1')
        ? 'http://localhost:8000'
        : 'https://career-coach-ai-3xap.onrender.com';

    // 1. Run locking synchronously using the cached value from localStorage (0ms latency)
    const cachedTier = localStorage.getItem('subscription_tier') || 'free';
    applySubscriptionLocks(cachedTier);

    // 2. Fetch fresh tier status from database in background to keep local settings synced
    try {
        const idToken = await user.getIdToken();
        const res = await fetch(`${API_BASE_URL}/api/user/profile`, {
            headers: { 'Authorization': `Bearer ${idToken}` }
        });
        if (res.ok) {
            const data = await res.json();
            const freshTier = data.subscription_tier || 'free';
            
            // If the tier has changed (e.g. upgraded), update cache and reload the layout
            if (freshTier !== cachedTier) {
                localStorage.setItem('subscription_tier', freshTier);
                window.location.reload(); // Refresh the page to render unlocked controls
            }
        }
    } catch (err) {
        console.error("Error keeping subscription status synchronized", err);
    }
}

// Check for redirect triggers after DOM is ready
window.addEventListener('DOMContentLoaded', () => {
    const params = new URLSearchParams(window.location.search);
    const trigger = params.get('trigger_upgrade');
    if (trigger) {
        // Clear params to avoid loop pops
        const cleanUrl = window.location.protocol + "//" + window.location.host + window.location.pathname;
        window.history.replaceState({}, '', cleanUrl);
        
        let msg = "This premium feature is locked on the Free tier. Upgrade your plan to gain instant access!";
        if (trigger === 'portfolio_generator') {
            msg = "Portfolio Generator is locked on the Free tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!";
        } else if (trigger === 'portfolio_rater') {
            msg = "Portfolio Rater is locked on the Free tier. This feature requires the Career Elite (Premium) plan. Upgrade now to gain instant access!";
        } else if (trigger === 'career_mail') {
            msg = "Career Mail is locked on the Free tier. This feature requires the Career Accelerator (Pro) plan. Upgrade now to gain instant access!";
        }
        
        setTimeout(() => {
            window.showUpgradeModal(msg);
        }, 500);
    }
});

// Global fetch interceptor to catch any Subscription Limit Exceeded 403 error
const originalFetch = window.fetch;
window.fetch = async function(...args) {
    const response = await originalFetch(...args);
    if (response.status === 403) {
        const cloned = response.clone();
        try {
            const data = await cloned.json();
            if (data.detail && (data.detail.includes('Limit Exceeded') || data.detail.includes('Subscription Limit') || data.detail.includes('subscription limit'))) {
                // Instantly open the upgrade popup modal with the backend message
                window.showUpgradeModal(data.detail);
                
                // Hide any global or local loading spinners
                const spinners = document.querySelectorAll('#loading, .spinner, .fa-spinner, #loading-section');
                spinners.forEach(s => {
                    s.classList.add('hidden');
                    s.style.display = 'none';
                });
                
                // If there's an error message container on the page, clear it so it doesn't duplicate
                const errorContainers = document.querySelectorAll('[id*="error-message"], [id*="error-container"], [id*="status"]');
                errorContainers.forEach(container => {
                    container.textContent = '';
                    container.classList.add('hidden');
                    container.style.display = 'none';
                });
            }
        } catch (e) {}
    }
    return response;
};





