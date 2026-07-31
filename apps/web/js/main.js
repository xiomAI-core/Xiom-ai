/**
 * XIOM Main Interactions
 */
(function () {
  'use strict';

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .mobile-nav-toggle {
        display: none;
        border: 1px solid rgba(255,255,255,0.2);
        background: transparent;
        color: #fff;
        width: 40px;
        height: 32px;
        cursor: pointer;
        font-size: 16px;
      }
      .mobile-menu {
        display: none;
        position: absolute;
        top: 64px;
        left: 0;
        right: 0;
        background: rgba(0,0,0,0.98);
        border-top: 1px solid rgba(255,255,255,0.08);
        border-bottom: 1px solid rgba(255,255,255,0.08);
        padding: 12px 20px 16px;
        z-index: 150;
      }
      .mobile-menu.open { display: grid; gap: 10px; }
      .mobile-menu a {
        color: rgba(255,255,255,0.7);
        font-size: 0.75rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
      }
      .copy-btn {
        position: absolute;
        top: 8px;
        right: 8px;
        border: 1px solid rgba(255,255,255,0.2);
        background: rgba(0,0,0,0.9);
        color: rgba(255,255,255,0.7);
        font-size: 0.65rem;
        letter-spacing: 0.08em;
        text-transform: uppercase;
        padding: 0.3rem 0.5rem;
        cursor: pointer;
      }
      .copy-btn:hover { color: #fff; border-color: rgba(255,255,255,0.4); }
      .metric-updated {
        transition: all 0.2s ease;
        color: #ffffff;
        text-shadow: 0 0 8px rgba(255,255,255,0.25);
      }
      .phase-progress-track {
        width: 100%;
        height: 3px;
        background: rgba(255,255,255,0.08);
        position: relative;
        overflow: hidden;
      }
      .phase-progress-fill {
        width: 0%;
        height: 100%;
        background: rgba(255,255,255,0.8);
        transition: width 1.5s ease;
      }
      @media (max-width: 768px) {
        .mobile-nav-toggle { display: inline-flex; align-items: center; justify-content: center; }
        .nav-links { display: none !important; }
        .nav-cta { display: none !important; }
      }
    `;
    document.head.appendChild(style);
  }

  function animateValue(from, to, onUpdate, duration) {
    const start = performance.now();
    const tick = (now) => {
      const p = Math.min((now - start) / duration, 1);
      const eased = 1 - Math.pow(1 - p, 3);
      const value = Math.floor(from + (to - from) * eased);
      onUpdate(value);
      if (p < 1) requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  }

  // Prompt interaction — hide typewriter, show two-column menu
  window.handlePromptAnswer = function handlePromptAnswer() {
    sessionStorage.setItem('xiom_prompt_answered', '1');

    var block = document.getElementById('typewriterBlock');
    if (block) block.classList.add('fade-out');

    setTimeout(function () {
      if (block) block.classList.add('is-hidden');
      if (window.XIOM_SECTIONS && typeof window.XIOM_SECTIONS.unlockMenu === 'function') {
        window.XIOM_SECTIONS.unlockMenu();
      }
    }, 380);
  };

  // 3) Mobile nav toggle
  function setupMobileNav() {
    const navInner = document.querySelector('.nav-inner');
    const navLinks = document.querySelector('.nav-links');
    if (!navInner || !navLinks) return;

    const toggle = document.createElement('button');
    toggle.className = 'mobile-nav-toggle';
    toggle.type = 'button';
    toggle.setAttribute('aria-label', 'Toggle navigation menu');
    toggle.textContent = '≡';

    const mobileMenu = document.createElement('div');
    mobileMenu.className = 'mobile-menu';
    mobileMenu.id = 'mobile-menu';
    mobileMenu.innerHTML = navLinks.innerHTML;

    navInner.appendChild(toggle);
    navInner.appendChild(mobileMenu);

    toggle.addEventListener('click', () => {
      const open = mobileMenu.classList.toggle('open');
      toggle.textContent = open ? '×' : '≡';
    });

    mobileMenu.querySelectorAll('a').forEach((link) => {
      link.addEventListener('click', () => {
        mobileMenu.classList.remove('open');
        toggle.textContent = '≡';
      });
    });
  }

  // 4) Copy buttons for code blocks
  function setupCodeCopyButtons() {
    const blocks = document.querySelectorAll('.code-block');
    blocks.forEach((block) => {
      const wrapper = block;
      wrapper.style.position = 'relative';
      const btn = document.createElement('button');
      btn.className = 'copy-btn';
      btn.type = 'button';
      btn.textContent = 'Copy';
      btn.addEventListener('click', async () => {
        try {
          await navigator.clipboard.writeText(block.textContent || '');
          btn.textContent = 'Copied!';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        } catch {
          btn.textContent = 'Failed';
          setTimeout(() => { btn.textContent = 'Copy'; }, 2000);
        }
      });
      wrapper.appendChild(btn);
    });
  }

  // 5) Live metrics polling
  function setupLiveMetricsPolling() {
    const nodesEl = document.querySelector('.metric-nodes');
    const edgesEl = document.querySelector('.metric-edges');
    if (!nodesEl && !edgesEl) return;

    async function fetchMetrics() {
      try {
        const apiUrl = window.XIOM_CONFIG?.apiUrl ?? 'https://api.xiom-ai.com';
        const res = await fetch(`${apiUrl}/api/site-metrics`, {
          method: 'GET',
          headers: { Accept: 'application/json' },
        });
        if (!res.ok) return;
        const json = await res.json();
        const nodes = Number(json?.nodes ?? 0);
        const edges = Number(json?.edges ?? 0);

        if (nodesEl) {
          const current = Number(nodesEl.dataset.current || 0);
          animateValue(current, nodes, (v) => {
            nodesEl.textContent = v.toLocaleString('en-US');
          }, 500);
          nodesEl.dataset.current = String(nodes);
          nodesEl.classList.add('metric-updated');
          setTimeout(() => nodesEl.classList.remove('metric-updated'), 250);
        }

        if (edgesEl) {
          const current = Number(edgesEl.dataset.current || 0);
          animateValue(current, edges, (v) => {
            edgesEl.textContent = v.toLocaleString('en-US');
          }, 500);
          edgesEl.dataset.current = String(edges);
          edgesEl.classList.add('metric-updated');
          setTimeout(() => edgesEl.classList.remove('metric-updated'), 250);
        }
      } catch {
        // silent failure
      }
    }

    fetchMetrics();
    setInterval(fetchMetrics, 30000);
  }

  // 6) Roadmap progress animation
  function setupRoadmapProgress() {
    const section = document.getElementById('roadmap');
    const bar = document.querySelector('.phase-progress-bar');
    if (!section || !bar) return;

    const track = document.createElement('div');
    track.className = 'phase-progress-track';
    const fill = document.createElement('div');
    fill.className = 'phase-progress-fill';
    track.appendChild(fill);
    bar.parentNode.insertBefore(track, bar.nextSibling);

    function runProgress() {
      fill.style.width = '80%';
    }

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          runProgress();
          observer.disconnect();
        });
      },
      { threshold: 0.25 }
    );
    observer.observe(section);

    document.addEventListener('xiom:section-shown', (event) => {
      if (event.detail && event.detail.id === 'roadmap') runProgress();
    });
  }

  function setupFooterSectionLinks() {
    document.querySelectorAll('.footer-section-link').forEach((link) => {
      link.addEventListener('click', (event) => {
        const id = link.getAttribute('data-section-id');
        if (!id || !window.XIOM_SECTIONS) return;
        event.preventDefault();
        if (typeof window.XIOM_SECTIONS.unlockMenu === 'function') {
          window.XIOM_SECTIONS.unlockMenu();
        }
        if (typeof window.XIOM_SECTIONS.showSection === 'function') {
          window.XIOM_SECTIONS.showSection(id);
        }
      });
    });
  }

  function init() {
    injectStyles();
    setupCodeCopyButtons();
    setupLiveMetricsPolling();
    setupRoadmapProgress();
    setupFooterSectionLinks();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
