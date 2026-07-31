/**
 * XIOM Marketing — section SPA navigation
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'xiom_prompt_answered';
  var menuUnlocked = false;
  var activeSectionId = null;

  var SECTIONS = [
    { id: 'intro', label: 'Introduction' },
    { id: 'problem', label: 'Problem' },
    { id: 'product', label: 'Product' },
    { id: 'levels', label: 'Agency Levels' },
    { id: 'science', label: 'Science' },
    { id: 'memory', label: 'Memory' },
    { id: 'roadmap', label: 'Roadmap' },
    { id: 'connect', label: 'Connect' },
    { id: 'download-desktop', label: 'Download Desktop' },
  ];

  function getPanels() {
    return Array.from(document.querySelectorAll('.section-panel'));
  }

  function getMenu() {
    return document.getElementById('menuGrid');
  }

  function getStage() {
    return document.getElementById('sectionStage');
  }

  function getHomeView() {
    return document.getElementById('homeView');
  }

  function setBodyState() {
    document.body.classList.toggle('menu-unlocked', menuUnlocked);
    document.body.classList.toggle('section-open', Boolean(activeSectionId));
  }

  function updateMenuActive(id, scrollToId) {
    var menu = getMenu();
    if (!menu) return;
    menu.querySelectorAll('.hud-nav-item[data-section-id]').forEach(function (btn) {
      var btnSection = btn.getAttribute('data-section-id');
      var btnScroll = btn.getAttribute('data-scroll-to');
      var match = btnSection === id && (!scrollToId || btnScroll === scrollToId);
      btn.classList.toggle('is-active', match);
      if (match) btn.setAttribute('aria-current', 'page');
      else btn.removeAttribute('aria-current');
    });
  }

  function triggerSectionReveals(panel) {
    if (!panel) return;
    panel.querySelectorAll('.reveal').forEach(function (el) {
      el.classList.add('visible');
    });
    panel.querySelectorAll('.stagger').forEach(function (el) {
      el.classList.add('visible');
    });
    document.dispatchEvent(
      new CustomEvent('xiom:section-shown', { detail: { id: panel.id } })
    );
  }

  function showSection(id, scrollToId) {
    if (!menuUnlocked) return;
    var panel = document.getElementById(id);
    if (!panel || !panel.classList.contains('section-panel')) return;

    activeSectionId = id;
    getPanels().forEach(function (p) {
      p.classList.toggle('is-active', p.id === id);
    });

    var stage = getStage();
    var home = getHomeView();
    if (stage) stage.classList.add('has-active');
    if (home) home.classList.add('is-behind');

    updateMenuActive(id, scrollToId);
    setBodyState();

    var hash = scrollToId || id;
    if (history.replaceState) {
      history.replaceState(null, '', '#' + hash);
    } else {
      location.hash = hash;
    }

    triggerSectionReveals(panel);

    if (stage) stage.scrollTop = 0;
    window.scrollTo(0, 0);

    if (scrollToId) {
      window.setTimeout(function () {
        var anchor = document.getElementById(scrollToId);
        if (!anchor) return;
        var stageEl = getStage();
        if (stageEl) {
          var top = anchor.getBoundingClientRect().top - stageEl.getBoundingClientRect().top + stageEl.scrollTop - 24;
          stageEl.scrollTo({ top: top, behavior: 'smooth' });
        }
      }, 80);
    }
  }

  function hideSection() {
    activeSectionId = null;
    getPanels().forEach(function (p) {
      p.classList.remove('is-active');
    });
    var stage = getStage();
    var home = getHomeView();
    if (stage) stage.classList.remove('has-active');
    if (home) home.classList.remove('is-behind');
    updateMenuActive(null);
    setBodyState();
    if (history.replaceState) {
      history.replaceState(null, '', location.pathname + location.search);
    }
    window.scrollTo(0, 0);
  }

  function enterDashboard() {
    var home = getHomeView();
    if (home) home.classList.add('dashboard-mode');

    document.querySelectorAll('.hud-chrome').forEach(function (el) {
      el.setAttribute('aria-hidden', 'false');
    });

    if (typeof window.XIOM_APPLY_LINKS === 'function') {
      window.XIOM_APPLY_LINKS();
    }

    window.dispatchEvent(new Event('resize'));
  }

  function unlockMenu() {
    if (menuUnlocked) return;
    menuUnlocked = true;
    sessionStorage.setItem(STORAGE_KEY, '1');

    var block = document.getElementById('typewriterBlock');
    if (block) block.classList.add('is-hidden');

    enterDashboard();
    setBodyState();

    var hash = (location.hash || '').replace(/^#/, '');
    if (hash === 'research-foundations') {
      showSection('science', 'research-foundations');
    } else if (hash && document.getElementById(hash)) {
      showSection(hash);
    }
  }

  function restorePromptState() {
    if (sessionStorage.getItem(STORAGE_KEY) !== '1') return;
    unlockMenu();
  }

  function bindMenu() {
    var menu = getMenu();
    if (!menu) return;

    menu.addEventListener('click', function (event) {
      var target = event.target.closest('.hud-nav-item[data-section-id]');
      if (!target) return;
      event.preventDefault();
      var id = target.getAttribute('data-section-id');
      var scrollTo = target.getAttribute('data-scroll-to');
      if (id) showSection(id, scrollTo || null);
    });
  }

  function bindHashChange() {
    window.addEventListener('hashchange', function () {
      if (!menuUnlocked) return;
      var hash = (location.hash || '').replace(/^#/, '');
      if (!hash) {
        hideSection();
        return;
      }
      if (hash === 'research-foundations') {
        showSection('science', 'research-foundations');
        return;
      }
      if (document.getElementById(hash)) showSection(hash);
    });
  }

  function bindBackLinks() {
    document.querySelectorAll('[data-back-menu]').forEach(function (btn) {
      btn.addEventListener('click', function (event) {
        event.preventDefault();
        hideSection();
      });
    });
  }

  function init() {
    bindMenu();
    bindHashChange();
    bindBackLinks();
    restorePromptState();
  }

  window.XIOM_SECTIONS = {
    unlockMenu: unlockMenu,
    showSection: showSection,
    hideSection: hideSection,
    SECTIONS: SECTIONS,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
