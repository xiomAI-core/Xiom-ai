/**
 * XIOM marketing site — local vs production URL routing.
 * Loads before main.js; sets app/API links for onboarding flow.
 */
(function () {
  'use strict';

  var isLocal =
    location.hostname === 'localhost' || location.hostname === '127.0.0.1';

  window.XIOM_CONFIG = {
    appUrl: isLocal ? 'http://localhost:3002' : 'https://app.xiom-ai.com',
    apiUrl: isLocal ? 'http://localhost:3001' : 'https://api.xiom-ai.com',
    marketingUrl: isLocal ? 'http://localhost:3000' : 'https://xiom-ai.com',
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
