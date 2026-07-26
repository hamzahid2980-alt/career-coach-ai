/* =========================================================
   legal.js – Shared interactivity for privacy.html & terms.html
   Reuses the same patterns already used in index.html:
   createParticles, setupBackToTop, setupMobileMenu
   plus a smooth-scroll helper for the table-of-contents links.
   ========================================================= */

/** Floating background particles (same as index.html inline script) */
function createParticles() {
    const container = document.getElementById('particles');
    if (!container) return;
    const particleCount = 25;

    for (let i = 0; i < particleCount; i++) {
        const particle = document.createElement('div');
        particle.classList.add('particle');

        const size = Math.random() * 10 + 5;
        particle.style.width  = `${size}px`;
        particle.style.height = `${size}px`;
        particle.style.left   = `${Math.random() * 100}vw`;
        particle.style.top    = `${Math.random() * 100}vh`;
        particle.style.animationDelay = `${Math.random() * 15}s`;

        container.appendChild(particle);
    }
}

/** Back-to-top button (same as index.html inline script) */
function setupBackToTop() {
    const backToTopBtn = document.getElementById('back-to-top');
    if (!backToTopBtn) return;

    window.addEventListener('scroll', () => {
        if (window.pageYOffset > 300) {
            backToTopBtn.classList.add('visible');
        } else {
            backToTopBtn.classList.remove('visible');
        }
    });

    backToTopBtn.addEventListener('click', (e) => {
        e.preventDefault();
        window.scrollTo({ top: 0, behavior: 'smooth' });
    });
}

/** Mobile slide-in menu (same as index.html inline script) */
function setupMobileMenu() {
    const menuBtn    = document.getElementById('mobile-menu-btn');
    const closeBtn   = document.getElementById('close-menu');
    const mobileMenu = document.getElementById('mobile-menu');
    const overlay    = document.getElementById('overlay');

    if (!menuBtn || !closeBtn || !mobileMenu || !overlay) return;

    function openMenu() {
        mobileMenu.classList.add('open');
        overlay.classList.add('open');
        document.body.style.overflow = 'hidden';
    }

    function closeMenu() {
        mobileMenu.classList.remove('open');
        overlay.classList.remove('open');
        document.body.style.overflow = 'auto';
    }

    menuBtn.addEventListener('click', openMenu);
    closeBtn.addEventListener('click', closeMenu);
    overlay.addEventListener('click', closeMenu);

    // Close menu when any link inside it is clicked
    mobileMenu.querySelectorAll('a').forEach(link => {
        link.addEventListener('click', closeMenu);
    });
}

/**
 * Smooth-scroll for the table-of-contents anchor links,
 * offsetting by the sticky header height (≈ 90 px).
 */
function setupSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', (e) => {
            const targetId = anchor.getAttribute('href');
            const target   = document.querySelector(targetId);
            if (target) {
                e.preventDefault();
                const HEADER_OFFSET = 90;
                const top = target.getBoundingClientRect().top + window.pageYOffset - HEADER_OFFSET;
                window.scrollTo({ top, behavior: 'smooth' });
            }
        });
    });
}

/** Boot everything once the DOM is ready */
document.addEventListener('DOMContentLoaded', () => {
    createParticles();
    setupBackToTop();
    setupMobileMenu();
    setupSmoothScroll();
});
