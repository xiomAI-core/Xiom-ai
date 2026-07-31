/**
 * XIOM — typewriter intro sequence
 */
(function () {
  'use strict';

  var STORAGE_KEY = 'xiom_prompt_answered';
  var CHAR_MS = 28;
  var LINE_PAUSE = 320;
  var BLOCK_PAUSE = 500;

  var LABEL_TEXT = 'Personal AI Operating System';
  var BODY_LINES = [
    'AI generates text. You do all the work.',
    'Prompt. Copy. Paste. Verify. Repeat.',
  ];
  var QUESTION_TEXT = 'Do you agree? ';

  function sleep(ms) {
    return new Promise(function (resolve) {
      setTimeout(resolve, ms);
    });
  }

  function typeChar(el, ch) {
    el.textContent += ch;
  }

  async function typeString(el, text, speed) {
    for (var i = 0; i < text.length; i += 1) {
      typeChar(el, text.charAt(i));
      await sleep(speed || CHAR_MS);
    }
  }

  async function runSequence() {
    var label = document.getElementById('twLabel');
    var text = document.getElementById('twText');
    var question = document.getElementById('twQuestion');
    var buttons = document.getElementById('promptButtons');
    if (!label || !text || !question || !buttons) return;

    await sleep(600);

    await typeString(label, LABEL_TEXT, 22);
    await sleep(BLOCK_PAUSE);

    for (var i = 0; i < BODY_LINES.length; i += 1) {
      if (i > 0) text.textContent += '\n';
      await typeString(text, BODY_LINES[i], CHAR_MS);
      await sleep(LINE_PAUSE);
    }

    await sleep(LINE_PAUSE);
    await typeString(question, QUESTION_TEXT, CHAR_MS);

    var cursor = document.createElement('span');
    cursor.className = 'cursor-blink';
    cursor.textContent = '_';
    question.appendChild(cursor);

    buttons.classList.remove('is-hidden');
    buttons.classList.add('typewriter-reveal');
    buttons.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function showButtonsFallback() {
    var buttons = document.getElementById('promptButtons');
    var question = document.getElementById('twQuestion');
    if (!buttons || buttons.classList.contains('typewriter-reveal')) return;
    if (question && !question.querySelector('.cursor-blink')) {
      var cursor = document.createElement('span');
      cursor.className = 'cursor-blink';
      cursor.textContent = '_';
      question.appendChild(cursor);
    }
    buttons.classList.remove('is-hidden');
    buttons.classList.add('typewriter-reveal');
  }

  function skipToMenu() {
    var block = document.getElementById('typewriterBlock');
    if (block) block.classList.add('is-hidden');
    if (window.XIOM_SECTIONS && typeof window.XIOM_SECTIONS.unlockMenu === 'function') {
      window.XIOM_SECTIONS.unlockMenu();
    }
  }

  function init() {
    if (sessionStorage.getItem(STORAGE_KEY) === '1') {
      skipToMenu();
      return;
    }
    runSequence()
      .catch(function () {
        showButtonsFallback();
      });

    // Safety net — always reveal buttons if animation stalls
    setTimeout(showButtonsFallback, 12000);
  }

  window.XIOM_TYPEWRITER = {
    skipToMenu: skipToMenu,
  };

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
