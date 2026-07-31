/**
 * XIOM — Metrics counter animation
 * Animates any element with [data-count] when it enters the viewport
 */
(function () {
  'use strict';

  function easeOutCubic(t) {
    return 1 - Math.pow(1 - t, 3);
  }

  function animateCounter(el, target, duration) {
    const start = performance.now();
    const isDecimal = String(target).includes('.');

    function frame(now) {
      const elapsed  = now - start;
      const progress = Math.min(elapsed / duration, 1);
      const value    = easeOutCubic(progress) * target;

      el.textContent = isDecimal
        ? value.toFixed(1)
        : Math.floor(value).toLocaleString('en-US');

      if (progress < 1) requestAnimationFrame(frame);
      else el.textContent = isDecimal ? target.toFixed(1) : target.toLocaleString('en-US');
    }
    requestAnimationFrame(frame);
  }

  const observer = new IntersectionObserver(
    (entries) => {
      entries.forEach((entry) => {
        if (!entry.isIntersecting) return;
        const el     = entry.target;
        const target = parseFloat(el.dataset['count'] ?? '0');
        const dur    = parseInt(el.dataset['duration'] ?? '2000', 10);
        observer.unobserve(el);
        animateCounter(el, target, dur);
      });
    },
    { threshold: 0.4 }
  );

  // Auto-observe on DOM ready
  function init() {
    document.querySelectorAll('[data-count]').forEach((el) => observer.observe(el));
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
