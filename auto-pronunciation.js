// Automatic British-English pronunciation for every study question.
// Uses the browser's Web Speech API, prefers a local en-GB voice, and keeps
// the setting in a separate localStorage key so it cannot be overwritten by
// the main learning-state save cycle.
(() => {
  "use strict";

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  if (!synth) return;

  const SETTINGS_KEY = "ielt-pronunciation-v1";
  const DEFAULTS = { enabled: true, lang: "en-GB", rate: 0.94 };
  let preferredVoice = null;
  let lastSpokenToken = "";
  let pendingTimer = null;

  function readSettings() {
    try {
      return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {}) };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function writeSettings(next) {
    localStorage.setItem(SETTINGS_KEY, JSON.stringify({ ...readSettings(), ...next }));
  }

  function isBritishVoice(voice) {
    return /^en[-_]GB$/i.test(String(voice?.lang || ""));
  }

  function voiceScore(voice) {
    let score = 0;
    if (isBritishVoice(voice)) score += 100;
    if (voice?.localService) score += 40;
    if (/sonia|libby|george|daniel|serena|kate|hazel|british|united kingdom/i.test(voice?.name || "")) score += 15;
    return score;
  }

  function refreshVoice() {
    const voices = synth.getVoices?.() || [];
    if (!voices.length) return;
    const british = voices.filter(isBritishVoice).sort((a, b) => voiceScore(b) - voiceScore(a));
    preferredVoice = british[0] || null;
    updateSettingHint();
  }

  function speakBritish(text, { force = false } = {}) {
    const settings = readSettings();
    const clean = String(text || "").trim();
    if (!clean || (!settings.enabled && !force)) return;

    if (!preferredVoice) refreshVoice();
    if (synth.speaking || synth.pending) synth.cancel();

    const u = new SpeechSynthesisUtterance(clean);
    u.lang = "en-GB";
    u.rate = Number(settings.rate) || DEFAULTS.rate;
    u.pitch = 1;
    u.volume = 1;
    if (preferredVoice) u.voice = preferredVoice;
    synth.speak(u);
  }

  function currentQuestion() {
    const title = document.querySelector("#studyCard .word-title");
    const card = title?.closest?.(".word-card[data-card]");
    if (!title || !card || title.offsetParent === null) return null;
    const text = title.textContent.trim();
    if (!text) return null;
    return { text, token: `${card.dataset.card || ""}|${text}` };
  }

  function autoSpeakCurrent() {
    const q = currentQuestion();
    if (!q || q.token === lastSpokenToken) return;
    lastSpokenToken = q.token;
    clearTimeout(pendingTimer);
    // Small defer lets the new card finish painting while voices are already cached.
    pendingTimer = setTimeout(() => speakBritish(q.text), 12);
  }

  function ensureSettingCard() {
    const grid = document.querySelector("#view-settings .settings-grid");
    if (!grid || document.getElementById("autoPronounceInput")) return;

    const settings = readSettings();
    const label = document.createElement("label");
    label.className = "setting-card";
    label.innerHTML = `
      <span><strong>自动英音发音</strong><small id="autoPronounceHint">每道题出现时自动朗读英文题干；优先使用本机 en-GB 英音</small></span>
      <input id="autoPronounceInput" type="checkbox" ${settings.enabled ? "checked" : ""} />`;
    grid.appendChild(label);

    const input = document.getElementById("autoPronounceInput");
    input.addEventListener("change", () => {
      writeSettings({ enabled: input.checked });
      if (input.checked) {
        lastSpokenToken = "";
        autoSpeakCurrent();
      } else if (synth.speaking || synth.pending) {
        synth.cancel();
      }
      updateSettingHint();
    });
    updateSettingHint();
  }

  function updateSettingHint() {
    const hint = document.getElementById("autoPronounceHint");
    if (!hint) return;
    if (preferredVoice) {
      hint.textContent = `当前英音：${preferredVoice.name} (${preferredVoice.lang})；每道题自动朗读`;
    } else {
      hint.textContent = "每道题自动朗读；优先调用浏览器/系统的 en-GB 英音";
    }
  }

  function bindManualReplayCapture() {
    document.addEventListener("click", (event) => {
      const btn = event.target.closest?.("#speakBtn, #sameDaySpeakBtn");
      if (!btn) return;
      const title = document.querySelector("#studyCard .word-title");
      if (!title?.textContent.trim()) return;
      // Run after the app's own click handler; this guarantees an en-GB replay.
      setTimeout(() => speakBritish(title.textContent.trim(), { force: true }), 0);
    });
  }

  refreshVoice();
  if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refreshVoice);
  document.addEventListener("pointerdown", refreshVoice, { once: true, passive: true });

  const studyRoot = document.getElementById("studyCard");
  if (studyRoot) {
    const observer = new MutationObserver(() => requestAnimationFrame(autoSpeakCurrent));
    observer.observe(studyRoot, { childList: true, subtree: true, characterData: true });
  }

  const bodyObserver = new MutationObserver(() => ensureSettingCard());
  bodyObserver.observe(document.body, { childList: true, subtree: true });

  ensureSettingCard();
  bindManualReplayCapture();
  setTimeout(autoSpeakCurrent, 0);

  window.__IELT_PRONUNCIATION__ = {
    speakBritish,
    refreshVoice,
    getVoice: () => preferredVoice,
    settings: readSettings
  };
})();
