// Keep the app's in-memory daily-new setting aligned with the automatic plan
// if the user starts/rebuilds another session without reloading the page.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;
  const STORAGE_KEY = "ielt-memory-v3";

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function dayNumber(value) {
    const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 86400000);
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function desiredQuota() {
    const state = readState();
    const plan = state.studyPlan || {};
    if (plan.enabled === false) return null;
    const today = dateKey();
    const learnedToday = Number(state.daily?.[today]?.newCards || 0);

    // Prefer the review-load-smoothed target calculated at page load.
    if (plan.lastCalculatedDate === today && Number.isFinite(Number(plan.smoothedDailyTarget))) {
      return Math.max(0, Number(plan.smoothedDailyTarget) - learnedToday);
    }

    // Fallback for older saved plans that predate load smoothing.
    const targetDays = Math.max(1, Number(plan.targetDays) || 30);
    const startDate = plan.startDate || today;
    const elapsed = Math.max(0, dayNumber(today) - dayNumber(startDate));
    const remainingDays = Math.max(1, targetDays - elapsed);
    const words = (DATA.allWords || []).filter((w) => w.quizMode !== "source-only");
    const cards = state.cards || {};
    const remaining = words.filter((w) => !cards[w.cardId]?.reps).length;
    const fullTarget = remaining ? Math.ceil(remaining / remainingDays) : 0;
    return Math.max(0, fullTarget - learnedToday);
  }

  function syncQuotaIntoApp() {
    const quota = desiredQuota();
    if (quota == null) return;
    const input = document.getElementById("dailyNewInput");
    const saveBtn = document.getElementById("saveSettingsBtn");
    if (!input || !saveBtn?.onclick) return;
    if (Number(input.value) === quota) return;
    input.value = String(quota);
    saveBtn.onclick();
    const toast = document.getElementById("toast");
    if (toast) toast.classList.remove("show");
  }

  function wrap(id) {
    const btn = document.getElementById(id);
    if (!btn || btn.dataset.planSyncWrapped === "1") return;
    const original = btn.onclick;
    if (typeof original !== "function") return;
    btn.dataset.planSyncWrapped = "1";
    btn.onclick = function (event) {
      syncQuotaIntoApp();
      return original.call(this, event);
    };
  }

  wrap("startSessionBtn");
  wrap("rebuildSessionBtn");
})();
