// theme.js — dark/light mode toggle, shared across all pages.
// Preference is saved in the visitor's own browser (localStorage) so it
// persists between visits, and defaults to their system preference.

(function () {
  const stored = localStorage.getItem('theme');
  const systemPrefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  const initial = stored || (systemPrefersDark ? 'dark' : 'light');
  document.documentElement.setAttribute('data-theme', initial);

  function applyIcon() {
    const btn = document.getElementById('theme-toggle');
    if (!btn) return;
    const current = document.documentElement.getAttribute('data-theme');
    btn.textContent = current === 'dark' ? '☀️' : '🌙';
  }

  window.addEventListener('DOMContentLoaded', () => {
    applyIcon();
    const btn = document.getElementById('theme-toggle');
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        document.documentElement.setAttribute('data-theme', next);
        localStorage.setItem('theme', next);
        applyIcon();
      });
    }

    // Back-to-top button: appears after scrolling down, smooth-scrolls to top
    const topBtn = document.getElementById('back-to-top');
    if (topBtn) {
      window.addEventListener('scroll', () => {
        topBtn.classList.toggle('visible', window.scrollY > 400);
      });
      topBtn.addEventListener('click', () => {
        window.scrollTo({ top: 0, behavior: 'smooth' });
      });
    }
  });
})();
