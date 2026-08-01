/**
 * XIOM marketing site — local / Vercel preview / production URL routing.
 * Loads before main.js; sets app/API links and desktop download URLs.
 */
(function () {
  'use strict';

  var host = location.hostname;
  var isLocal = host === 'localhost' || host === '127.0.0.1';
  var isVercel = host.indexOf('vercel.app') !== -1;
  // Custom domain currently fronts the Vercel marketing deploy (not full xiom-ai.com prod yet)
  var isXiomFun = host === 'xiom.fun' || host === 'www.xiom.fun';
  var useVercelLinks = isVercel || isXiomFun;

  // Vercel demo URLs
  var VERCEL_MARKETING = 'https://xiom-marketing.vercel.app';
  var VERCEL_APP = 'https://xiom-ai-app.vercel.app';

  // Production (full stack on xiom-ai.com — not used for xiom.fun yet)
  var PROD_MARKETING = 'https://xiom-ai.com';
  var PROD_APP = 'https://app.xiom-ai.com';
  var PROD_API = 'https://api.xiom-ai.com';

  var RELEASES_URL = 'https://github.com/xiomAI-core/Xiom-ai/releases';
  var RELEASES_API =
    'https://api.github.com/repos/xiomAI-core/Xiom-ai/releases/latest';

  // Fallback if GitHub API is unreachable (matches published desktop-v0.1.0)
  var FALLBACK_DOWNLOADS = {
    windows:
      'https://github.com/xiomAI-core/Xiom-ai/releases/download/desktop-v0.1.0/XIOM_0.1.0_x64-setup.exe',
    'windows-arm':
      'https://github.com/xiomAI-core/Xiom-ai/releases/download/desktop-v0.1.0/XIOM_0.1.0_arm64-setup.exe',
    macos:
      'https://github.com/xiomAI-core/Xiom-ai/releases/download/desktop-v0.1.0/XIOM_0.1.0_aarch64.dmg',
    linux: null,
  };

  window.XIOM_CONFIG = {
    appUrl: isLocal
      ? 'http://localhost:3002'
      : useVercelLinks
        ? VERCEL_APP
        : PROD_APP,
    // Live API host (Cloud Run). Docs UI is hosted on marketing until API is public.
    apiUrl: isLocal ? 'http://localhost:3001' : PROD_API,
    // Interactive docs: Vercel marketing (and xiom.fun) until prod docs exist
    docsUrl: isLocal
      ? 'http://localhost:3000/docs/'
      : useVercelLinks
        ? VERCEL_MARKETING + '/docs/'
        : PROD_MARKETING + '/docs/',
    marketingUrl: isLocal
      ? 'http://localhost:3000'
      : isXiomFun
        ? 'https://xiom.fun'
        : useVercelLinks
          ? VERCEL_MARKETING
          : PROD_MARKETING,
    releasesUrl: RELEASES_URL,
    desktopDownloads: Object.assign({}, FALLBACK_DOWNLOADS),
  };

  function applyAppLinks() {
    document.querySelectorAll('[data-xiom-app-link]').forEach(function (el) {
      var path = el.getAttribute('data-xiom-app-path') || '/';
      if (!path.startsWith('/')) path = '/' + path;
      el.setAttribute('href', window.XIOM_CONFIG.appUrl + path);
    });

    document.querySelectorAll('[data-xiom-api-link]').forEach(function (el) {
      // xiom.fun / Vercel demo → Vercel docs; local & future prod marketing → same-origin /docs
      var docsHref =
        useVercelLinks
          ? window.XIOM_CONFIG.docsUrl
          : host === 'xiom-ai.com' ||
              host === 'www.xiom-ai.com' ||
              isLocal
            ? '/docs/'
            : window.XIOM_CONFIG.docsUrl;
      el.setAttribute('href', docsHref);
    });

    document.querySelectorAll('[data-releases-link]').forEach(function (el) {
      el.setAttribute('href', window.XIOM_CONFIG.releasesUrl);
    });

    applyDesktopDownloadLinks();
  }

  function applyDesktopDownloadLinks() {
    var downloads = window.XIOM_CONFIG.desktopDownloads || {};

    document.querySelectorAll('[data-desktop-download]').forEach(function (el) {
      var key = el.getAttribute('data-desktop-download');
      var url = downloads[key];

      if (url) {
        el.setAttribute('href', url);
        el.removeAttribute('target');
        el.setAttribute('download', '');
        if (key === 'linux') {
          el.textContent = 'Download for Linux →';
        }
        return;
      }

      // No asset yet — send users to the releases page
      el.setAttribute('href', window.XIOM_CONFIG.releasesUrl);
      el.setAttribute('target', '_blank');
      el.setAttribute('rel', 'noopener');
      el.removeAttribute('download');
      if (el.getAttribute('data-desktop-fallback') === 'releases') {
        el.textContent = 'Coming soon →';
      }
    });
  }

  function pickDesktopDownloads(assets) {
    var result = {
      windows: null,
      'windows-arm': null,
      macos: null,
      linux: null,
    };
    var winMsi = null;
    var winArmMsi = null;

    assets.forEach(function (asset) {
      var name = (asset.name || '').toLowerCase();
      var url = asset.browser_download_url;
      if (!url) return;

      if (name.indexOf('x64-setup.exe') !== -1) {
        result.windows = url;
      } else if (name.indexOf('arm64-setup.exe') !== -1) {
        result['windows-arm'] = url;
      } else if (/x64.*\.msi$/.test(name)) {
        winMsi = url;
      } else if (/arm64.*\.msi$/.test(name)) {
        winArmMsi = url;
      } else if (name.endsWith('.dmg') && !result.macos) {
        result.macos = url;
      } else if (
        !result.linux &&
        (name.endsWith('.appimage') ||
          name.endsWith('.deb') ||
          name.endsWith('.rpm'))
      ) {
        result.linux = url;
      }
    });

    if (!result.windows) result.windows = winMsi;
    if (!result['windows-arm']) result['windows-arm'] = winArmMsi;

    return result;
  }

  function resolveDesktopDownloads() {
    applyDesktopDownloadLinks();

    fetch(RELEASES_API, {
      headers: { Accept: 'application/vnd.github+json' },
    })
      .then(function (res) {
        if (!res.ok) throw new Error('releases ' + res.status);
        return res.json();
      })
      .then(function (data) {
        var picked = pickDesktopDownloads(data.assets || []);
        var merged = Object.assign({}, FALLBACK_DOWNLOADS);

        Object.keys(picked).forEach(function (key) {
          if (picked[key]) merged[key] = picked[key];
        });

        window.XIOM_CONFIG.desktopDownloads = merged;
        applyDesktopDownloadLinks();

        var versionEl = document.querySelector('[data-desktop-version]');
        if (versionEl && data.tag_name) {
          versionEl.textContent = 'Latest: ' + data.tag_name;
        }
      })
      .catch(function () {
        // Keep hardcoded fallbacks from the HTML / FALLBACK_DOWNLOADS
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
      resolveDesktopDownloads();
    });
  } else {
    applyAppLinks();
    bindAppLinkClicks();
    resolveDesktopDownloads();
  }
})();
