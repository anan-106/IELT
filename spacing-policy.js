// Same-day strengthening spacing policy.
// If a word was answered incorrectly, each later proof attempt must be separated
// from the previous attempt by at least 3 other questions. This is same-day
// learning spacing, not cross-day review scheduling.
(() => {
  "use strict";

  const STORAGE_KEY = "ielt-memory-v3";
  const MIN_GAP = 3;
  const DEFAULT_GAP = 4;

  function normalizeGap(value) {
    const n = Number(value);
    if (!Number.isFinite(n)) return DEFAULT_GAP;
    return Math.max(MIN_GAP, Math.min(10, Math.round(n)));
  }

  // Normalize saved state BEFORE app.js reads it.
  try {
    const raw = localStorage.getItem(STORAGE_KEY);
    if (raw) {
      const state = JSON.parse(raw);
      state.settings = state.settings || {};
      state.settings.repeatGap = normalizeGap(state.settings.repeatGap);
      localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    }
  } catch (err) {
    console.warn("Spacing policy state normalization skipped", err);
  }

  // The DOM already exists because this script is loaded at the end of body,
  // immediately before app.js.
  const input = document.getElementById("repeatGapInput");
  if (input) {
    input.min = String(MIN_GAP);
    input.max = "10";
    input.value = String(normalizeGap(input.value || DEFAULT_GAP));
    input.addEventListener("change", () => {
      input.value = String(normalizeGap(input.value));
    });
    input.addEventListener("blur", () => {
      input.value = String(normalizeGap(input.value));
    });
  }

  const saveBtn = document.getElementById("saveSettingsBtn");
  if (saveBtn && input) {
    // Capture phase runs before app.js's normal click handler.
    saveBtn.addEventListener("click", () => {
      input.value = String(normalizeGap(input.value));
    }, true);
  }

  const settingCard = input?.closest(".setting-card");
  if (settingCard) {
    const strong = settingCard.querySelector("strong");
    const small = settingCard.querySelector("small");
    if (strong) strong.textContent = "当天错词重新证明间隔";
    if (small) small.textContent = "两次证明不能连续出现；每次至少隔 3 道其它题";
  }

  window.__IELT_SAME_DAY_SPACING__ = {
    minGap: MIN_GAP,
    defaultGap: DEFAULT_GAP
  };
})();
