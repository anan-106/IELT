// Keyboard-first study controls + correct-answer British pronunciation.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const wordById = new Map((DATA.allWords || []).map((w) => [w.cardId, w]));

  function isTypingTarget(target) {
    if (!target) return false;
    const tag = String(target.tagName || "").toLowerCase();
    return target.isContentEditable || tag === "input" || tag === "textarea" || tag === "select";
  }

  function isVisible(el) {
    if (!el) return false;
    const style = getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden" && el.getClientRects().length > 0;
  }

  function activeOptions() {
    return [...document.querySelectorAll("#studyCard .option:not(:disabled)")].filter(isVisible).slice(0, 4);
  }

  function decorateOptions() {
    [...document.querySelectorAll("#studyCard .option")].filter(isVisible).forEach((btn, index) => {
      if (index > 3) return;
      btn.dataset.shortcut = String(index + 1);
      const optionText = btn.dataset.option || btn.childNodes?.[0]?.textContent?.trim() || btn.textContent.trim();
      btn.title = `${index + 1} · ${optionText}`;
    });
  }

  function speakCorrectSynonym(button) {
    const cardEl = button?.closest?.(".word-card[data-card]");
    if (!cardEl) return;
    const word = wordById.get(cardEl.dataset.card);
    if (!word || word.quizMode === "meaning") return;

    const correct = [...cardEl.querySelectorAll(".option.correct")].find(isVisible);
    // IMPORTANT: use data-option, not textContent. After answer, option-meanings.js
    // appends a Chinese gloss, which must never be sent to the English TTS voice.
    const text = correct?.dataset?.option || "";
    if (!text.trim()) return;

    // Use the en-GB voice layer already installed by auto-pronunciation.js.
    setTimeout(() => {
      const api = window.__IELT_PRONUNCIATION__;
      if (api?.speakBritish) api.speakBritish(text, { force: true });
      else if ("speechSynthesis" in window) {
        const u = new SpeechSynthesisUtterance(text);
        u.lang = "en-GB";
        u.rate = 0.94;
        window.speechSynthesis.cancel();
        window.speechSynthesis.speak(u);
      }
    }, 45);
  }

  document.addEventListener("click", (event) => {
    const option = event.target.closest?.("#studyCard .option");
    if (!option) return;
    // Let the quiz handler mark .correct/.wrong first.
    setTimeout(() => speakCorrectSynonym(option), 0);
  });

  document.addEventListener("keydown", (event) => {
    if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey || isTypingTarget(event.target)) return;

    if (/^[1-4]$/.test(event.key)) {
      const options = activeOptions();
      const index = Number(event.key) - 1;
      const btn = options[index];
      if (!btn) return;
      event.preventDefault();
      btn.click();
      return;
    }

    if (event.key === "Enter") {
      const selectors = ["#continueBtn", "#sameDayContinue", "#wrongBookContinue"];
      const next = selectors.map((s) => document.querySelector(s)).find(isVisible);
      if (!next) return;
      event.preventDefault();
      next.click();
    }
  });

  function injectStyles() {
    if (document.getElementById("keyboardShortcutStyles")) return;
    const style = document.createElement("style");
    style.id = "keyboardShortcutStyles";
    style.textContent = `
      #studyCard .option[data-shortcut]{position:relative;padding-left:42px}
      #studyCard .option[data-shortcut]::before{
        content:attr(data-shortcut);position:absolute;left:12px;top:50%;transform:translateY(-50%);
        width:20px;height:20px;display:grid;place-items:center;border-radius:6px;
        background:#ece9e2;color:#6f716b;font-size:.7rem;font-weight:800
      }
      .keyboard-hint{margin:8px auto 0;color:var(--muted);font-size:.72rem;text-align:center}
    `;
    document.head.appendChild(style);
  }

  function ensureHint() {
    const options = document.querySelector("#studyCard .options, #sameDayOptions, #wrongBookOptions");
    if (!options || !isVisible(options)) return;
    const parent = options.parentElement;
    if (!parent || parent.querySelector(":scope > .keyboard-hint")) return;
    const hint = document.createElement("div");
    hint.className = "keyboard-hint";
    hint.textContent = "键盘：1–4 选择 · Enter 下一题";
    options.insertAdjacentElement("afterend", hint);
  }

  function loadOptionMeanings() {
    if (window.__IELT_OPTION_MEANINGS__ || document.querySelector('script[data-option-meanings="1"]')) return;
    const script = document.createElement("script");
    script.src = "option-meanings.js";
    script.dataset.optionMeanings = "1";
    document.body.appendChild(script);
  }

  let scheduled = false;
  function refresh() {
    scheduled = false;
    decorateOptions();
    ensureHint();
  }
  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  injectStyles();
  loadOptionMeanings();
  const root = document.getElementById("studyCard");
  if (root) new MutationObserver(scheduleRefresh).observe(root, { childList: true, subtree: true });
  document.addEventListener("click", () => setTimeout(scheduleRefresh, 0));
  refresh();
})();
