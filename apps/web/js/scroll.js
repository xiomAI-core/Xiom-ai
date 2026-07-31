/**
 * XIOM Scroll Behaviors
 */
(function () {
  'use strict';

  const NAV_OFFSET = 80;

  function injectStyles() {
    const style = document.createElement('style');
    style.textContent = `
      .nav.scrolled {
        background: rgba(0, 0, 0, 0.95) !important;
        border-bottom: 1px solid rgba(255, 255, 255, 0.08) !important;
      }
      .nav-links a.active {
        color: #ffffff !important;
      }
      .counter.flash {
        transition: color 0.2s ease;
        color: rgba(255, 255, 255, 0.95);
      }
    `;
    document.head.appendChild(style);
  }

  function addRevealTargets() {
    const selectors = [
      '.card',
      '.comparison-row',
      '.loop-step',
      '.receipt-row',
      '.section-number',
      '.text-section-title',
      '.text-subsection',
      '.text-body',
    ];
    selectors.forEach((selector) => {
      const nodes = document.querySelectorAll(selector);
      nodes.forEach((el, idx) => {
        if (!el.classList.contains('reveal')) el.classList.add('reveal');
        if ((selector === '.text-section-title' || selector === '.text-subsection') && el.style.transitionDelay === '') {
          el.style.transitionDelay = `${(idx % 4) * 0.08}s`;
        }
      });
    });
  }

  function setupRevealObserver() {
    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;
          entry.target.classList.add('visible');
          observer.unobserve(entry.target);
        });
      },
      { threshold: 0.1, rootMargin: '0px 0px -30px 0px' }
    );

    document.querySelectorAll('.reveal').forEach((el) => observer.observe(el));
  }

  function setupNavScrollState() {
    // Nav removed — centered hero layout uses no top bar.
  }

  function setupActiveLinks() {
    // SPA navigation uses center menu; skip scroll-based active link tracking.
  }

  function setupSmoothAnchors() {
    document.querySelectorAll('a[href^="#"]').forEach((anchor) => {
      if (anchor.hasAttribute('data-section-id')) return;
      if (anchor.hasAttribute('data-xiom-app-link')) return;
      anchor.addEventListener('click', (event) => {
        const href = anchor.getAttribute('href');
        if (!href || href === '#') return;

        if (window.XIOM_SECTIONS && typeof window.XIOM_SECTIONS.showSection === 'function') {
          const id = href.replace(/^#/, '');
          const panel = document.getElementById(id);
          if (panel && panel.classList.contains('section-panel')) {
            event.preventDefault();
            if (typeof window.XIOM_SECTIONS.unlockMenu === 'function') {
              window.XIOM_SECTIONS.unlockMenu();
            }
            window.XIOM_SECTIONS.showSection(id);
            return;
          }
        }

        const target = document.querySelector(href);
        if (!target) return;

        event.preventDefault();
        const top = target.getBoundingClientRect().top + window.scrollY - NAV_OFFSET;
        window.scrollTo({ top, behavior: 'smooth' });
      });
    });
  }

  function typewriteSectionNumber(element) {
    if (element.dataset.typed === 'true') return;
    const fullText = element.dataset.fullText || element.textContent || '';
    element.dataset.fullText = fullText;
    element.textContent = '';
    element.dataset.typed = 'true';

    let i = 0;
    const tick = () => {
      if (i >= fullText.length) return;
      element.textContent += fullText.charAt(i);
      i += 1;
      setTimeout(tick, 28);
    };
    tick();
  }

  function setupSectionNumberTyping() {
    const numbers = Array.from(document.querySelectorAll('.section-number'));
    numbers.forEach((node) => {
      node.dataset.fullText = node.textContent || '';
    });

    const observer = new IntersectionObserver(
      (entries) => {
        entries.forEach((entry) => {
          if (entry.isIntersecting) {
            typewriteSectionNumber(entry.target);
            observer.unobserve(entry.target);
          }
        });
      },
      { threshold: 0.25 }
    );

    numbers.forEach((node) => observer.observe(node));

    document.addEventListener('xiom:section-shown', (event) => {
      const id = event.detail && event.detail.id;
      if (!id) return;
      const panel = document.getElementById(id);
      if (!panel) return;
      panel.querySelectorAll('.section-number').forEach((node) => {
        typewriteSectionNumber(node);
      });
    });
  }

  function formatNumber(value) {
    return Math.floor(value).toLocaleString('en-US');
  }

  function animateCounter(el, target, durationMs) {
    const start = performance.now();
    const from = Number(el.dataset.current || 0);
    const to = Number(target);

    function frame(now) {
      const progress = Math.min((now - start) / durationMs, 1);
      const eased = 1 - Math.pow(1 - progress, 3);
      const value = from + (to - from) * eased;
      el.textContent = formatNumber(value);
      if (progress < 1) {
        requestAnimationFrame(frame);
      } else {
        el.dataset.current = String(to);
        el.classList.add('flash');
        setTimeout(() => el.classList.remove('flash'), 220);
      }
    }
    requestAnimationFrame(frame);
  }

  function setupLiveCounters() {
    const counters = Array.from(document.querySelectorAll('.counter'));
    counters.forEach((counter) => {
      const target = Number(counter.getAttribute('data-target') || '0');
      animateCounter(counter, target, 2000);
    });
  }

  function init() {
    injectStyles();
    addRevealTargets();
    setupRevealObserver();
    setupNavScrollState();
    setupActiveLinks();
    setupSmoothAnchors();
    setupSectionNumberTyping();
    setupLiveCounters();
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
