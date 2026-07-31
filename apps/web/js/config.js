/**
 * XIOM marketing site — local / Vercel preview / production URL routing.
 * Loads before main.js; sets app/API links for onboarding flow.
 */
(function () {
  'use strict';

  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var isVercel = host.indexOf('vercel.app') !== -1;

  // Vercel demo URLs (no custom domain yet)
  var VERCEL_MARKETING = 'https://xiom-marketing.vercel.app';
  var VERCEL_APP = 'https://xiom-app.vercel.app';

  // Production (after domain purchase)
  var PROD_MARKETING = 'https://xiom-ai.com';
  var PROD_APP = 'https://app.xiom-ai.com';
  var PROD_API = 'https://api.xiom-ai.com';

  window.XIOM_CONFIG = {
    appUrl: isLocal
      ? 'http://localhost:3002'
      : isVercel
        ? VERCEL_APP
        : PROD_APP,
    // API not on Vercel yet — keep prod host; /docs works once API is deployed
    apiUrl: isLocal ? 'http://localhost:3001' : PROD_API,
    marketingUrl: isLocal
      ? 'http://localhost:3000'
      : isVercel
        ? VERCEL_MARKETING
        : PROD_MARKETING,
    releasesUrl: 'https://github.com/xiomAI-core/Xiom-ai/releases',
  };

  function applyAppLinks() {
    document.querySelectorAll('[data-xiom-app-link]').forEach(function (el) {
      var path = el.getAttribute('data-xiom-app-path') || '/';
      if (!path.startsWith('/')) path = '/' + path;
      el.setAttribute('href', window.XIOM_CONFIG.appUrl + path);
    });

    document.querySelectorAll('[data-xiom-api-link]').forEach(function (el) {
      el.setAttribute('href', window.XIOM_CONFIG.apiUrl + '/docs');
    });

    document.querySelectorAll('[data-releases-link]').forEach(function (el) {
      el.setAttribute('href', window.XIOM_CONFIG.releasesUrl);
    });
  }

  function bindAppLinkClicks() {
    document.addEventListener('click', function (event) {
      var link = event.target.closest('a[data-xiom-app-link]');
      if (!link) return;

      var path = link.getAttribute('data-xiom-app-path') || '/';
      if (!path.startsWith('/')) path = '/' + path;
      var url = window.XIOM_CONFIG.appUrl + path;
      link.setAttribute('href', url);

      if (event.metaKey || event.ctrlKey || event.shiftKey || link.target === '_blank') {
        return;
      }

      event.preventDefault();
      window.location.assign(url);
    });
  }

  window.XIOM_APPLY_LINKS = applyAppLinks;

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', function () {
      applyAppLinks();
      bindAppLinkClicks();
    });
  } else {
    applyAppLinks();
    bindAppLinkClicks();
  }
})();
