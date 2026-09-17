// Stable automatic British-English pronunciation for long study sessions.
// Keeps a single speech channel, prefers local en-GB voices, avoids queue buildup,
// and periodically soft-resets synthesis so latency/speed do not drift over time.
(() => {
  "use strict";

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  if (!synth) return;

  const SETTINGS_KEY = "ielt-pronunciation-v1";
  const DEFAULTS = { enabled: true, lang: "en-GB", rate: 1.0 };
  const RESET_EVERY = 30;
  const CANCEL_SETTLE_MS = 22;

  let preferredVoice = null;
  let lastSpokenToken = "";
  let pendingTimer = null;
  let activeUtterance = null;
  let generation = 0;
  let utteranceCount = 0;
  let lastStartLatencyMs = 0;

  function readSettings() {
    try {
      const raw = JSON.parse(localStorage.getItem(SETTINGS_KEY) || "{}") || {};
      return { ...DEFAULTS, ...raw, rate: Number(raw.rate || DEFAULTS.rate) };
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
    // Local voices are preferred because remote services can add latency.
    if (voice?.localService) score += 60;
    if (/sonia|libby|george|daniel|serena|kate|hazel|ryan|british|united kingdom|microsoft/i.test(voice?.name || "")) score += 18;
    if (voice?.default) score += 3;
    return score;
  }

  function refreshVoice() {
    const voices = synth.getVoices?.() || [];
    if (!voices.length) return;
    const british = voices.filter(isBritishVoice).sort((a, b) => voiceScore(b) - voiceScore(a));
    preferredVoice = british[0] || null;
    updateSettingHint();
  }

  function hardClearQueue() {
    clearTimeout(pendingTimer);
    pendingTimer = null;
    generation++;
    try { synth.cancel(); } catch {}
    // A synthesizer can remain paused even when no utterance is active.
    if (synth.paused) {
      try { synth.resume(); } catch {}
    }
    activeUtterance = null;
  }

  function periodicSoftReset() {
    utteranceCount++;
    if (utteranceCount % RESET_EVERY !== 0) return;
    hardClearQueue();
    refreshVoice();
  }

  function speakBritish(text, { force = false } = {}) {
    const settings = readSettings();
    const clean = String(text || "").trim();
    if (!clean || (!settings.enabled && !force)) return;

    if (!preferredVoice) refreshVoice();
    periodicSoftReset();

    const requestGeneration = ++generation;
    clearTimeout(pendingTimer);

    const start = () => {
      if (requestGeneration !== generation) return;
      if (synth.paused) {
        try { synth.resume(); } catch {}
      }

      const u = new SpeechSynthesisUtterance(clean);
      u.lang = settings.lang || "en-GB";
      u.rate = Math.max(0.8, Math.min(1.25, Number(settings.rate) || DEFAULTS.rate));
      u.pitch = 1;
      u.volume = 1;
      if (preferredVoice) u.voice = preferredVoice;

      const requestedAt = performance.now();
      u.onstart = () => {
        if (requestGeneration !== generation) return;
        activeUtterance = u;
        lastStartLatencyMs = Math.round(performance.now() - requestedAt);
        updateSettingHint();
      };
      u.onend = () => {
        if (activeUtterance === u) activeUtterance = null;
      };
      u.onerror = (event) => {
        if (activeUtterance === u) activeUtterance = null;
        // canceled/interrupted are expected when the user quickly moves on.
        if (!['canceled', 'interrupted'].includes(String(event?.error || ''))) {
          console.warn('[IELT TTS]', event?.error || event);
        }
      };

      activeUtterance = u;
      synth.speak(u);
    };

    // Single-flight policy: never let old utterances pile up behind new ones.
    // If something is active/pending, clear once and allow a short settle window.
    if (synth.speaking || synth.pending || activeUtterance) {
      try { synth.cancel(); } catch {}
      if (synth.paused) {
        try { synth.resume(); } catch {}
      }
      activeUtterance = null;
      pendingTimer = setTimeout(start, CANCEL_SETTLE_MS);
    } else {
      // Idle path starts immediately, avoiding the old unconditional cancel/speak churn.
      start();
    }
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
    pendingTimer = setTimeout(() => speakBritish(q.text), 8);
  }

  function ensureSettingCard() {
    const grid = document.querySelector("#view-settings .settings-grid");
    if (!grid || document.getElementById("autoPronounceInput")) return;

    const settings = readSettings();
    const label = document.createElement("label");
    label.className = "setting-card";
    label.innerHTML = `
      <span><strong>自动英音发音</strong><small id="autoPronounceHint">每道题自动朗读；优先本机 en-GB 英音</small></span>
      <input id="autoPronounceInput" type="checkbox" ${settings.enabled ? "checked" : ""} />`;
    grid.appendChild(label);

    const speedLabel = document.createElement("label");
    speedLabel.className = "setting-card";
    speedLabel.innerHTML = `
      <span><strong>英音语速</strong><small>默认 1.00×；长时间学习保持固定速度</small></span>
      <select id="pronounceRateInput">
        <option value="0.9">0.90×</option>
        <option value="1">1.00×</option>
        <option value="1.1">1.10×</option>
        <option value="1.2">1.20×</option>
      </select>`;
    grid.appendChild(speedLabel);

    const input = document.getElementById("autoPronounceInput");
    const rateInput = document.getElementById("pronounceRateInput");
    rateInput.value = String(settings.rate || DEFAULTS.rate);

    input.addEventListener("change", () => {
      writeSettings({ enabled: input.checked });
      if (input.checked) {
        lastSpokenToken = "";
        autoSpeakCurrent();
      } else {
        hardClearQueue();
      }
      updateSettingHint();
    });

    rateInput.addEventListener("change", () => {
      writeSettings({ rate: Number(rateInput.value) || DEFAULTS.rate });
      hardClearQueue();
      updateSettingHint();
    });
    updateSettingHint();
  }

  function updateSettingHint() {
    const hint = document.getElementById("autoPronounceHint");
    if (!hint) return;
    const settings = readSettings();
    const voiceText = preferredVoice ? `${preferredVoice.name} (${preferredVoice.lang})` : "en-GB";
    const localText = preferredVoice?.localService ? "本机" : "浏览器/系统";
    const latency = lastStartLatencyMs ? ` · 最近启动 ${lastStartLatencyMs}ms` : "";
    hint.textContent = `${localText}英音：${voiceText} · ${Number(settings.rate).toFixed(2)}×${latency}`;
  }

  function bindManualReplayCapture() {
    document.addEventListener("click", (event) => {
      const btn = event.target.closest?.("#speakBtn, #sameDaySpeakBtn, #wrongBookSpeakBtn");
      if (!btn) return;
      const title = document.querySelector("#studyCard .word-title");
      if (!title?.textContent.trim()) return;
      setTimeout(() => speakBritish(title.textContent.trim(), { force: true }), 0);
    });
  }

  // Start from a clean synthesis state on page load.
  hardClearQueue();
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

  document.addEventListener("visibilitychange", () => {
    if (document.hidden) hardClearQueue();
    else {
      refreshVoice();
      lastSpokenToken = "";
    }
  });

  ensureSettingCard();
  bindManualReplayCapture();
  setTimeout(autoSpeakCurrent, 0);

  window.__IELT_PRONUNCIATION__ = {
    speakBritish,
    refreshVoice,
    hardClearQueue,
    getVoice: () => preferredVoice,
    getDiagnostics: () => ({
      speaking: synth.speaking,
      pending: synth.pending,
      paused: synth.paused,
      utteranceCount,
      lastStartLatencyMs,
      voice: preferredVoice?.name || null,
      localService: preferredVoice?.localService ?? null
    }),
    settings: readSettings
  };
})();
