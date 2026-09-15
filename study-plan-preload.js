// Automatic study-plan preload. Runs before app.js so today's adaptive new-card quota
// is already present when the main app reads localStorage.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";
  const DEFAULT_DAYS = 30;

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function localDayNumber(value) {
    const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 86400000);
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : {};
    } catch {
      return {};
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function planWords() {
    return (DATA.allWords || []).filter((w) => w.quizMode !== "source-only");
  }

  function calculate(state) {
    const today = dateKey();
    const words = planWords();
    const cards = state.cards || {};
    const existing = state.studyPlan || {};
    const targetDays = Math.max(1, Math.min(365, Number(existing.targetDays) || DEFAULT_DAYS));
    const startDate = existing.startDate || today;
    const elapsed = Math.max(0, localDayNumber(today) - localDayNumber(startDate));
    const dayNumber = elapsed + 1;
    const remainingDays = Math.max(1, targetDays - elapsed);
    const completed = words.filter((w) => cards[w.cardId]?.reps > 0).length;
    const remaining = Math.max(0, words.length - completed);
    const fullDayTarget = remaining ? Math.ceil(remaining / remainingDays) : 0;
    const learnedToday = Number(state.daily?.[today]?.newCards || 0);
    const todayNewRemaining = Math.max(0, fullDayTarget - learnedToday);
    const enabled = existing.enabled !== false;

    return {
      enabled,
      targetDays,
      startDate,
      dayNumber,
      remainingDays,
      totalCards: words.length,
      completed,
      remaining,
      fullDayTarget,
      learnedToday,
      todayNewRemaining,
      lastCalculatedDate: today
    };
  }

  const state = readState();
  state.settings = state.settings || {};
  const snapshot = calculate(state);
  state.studyPlan = { ...(state.studyPlan || {}), ...snapshot };

  // When auto-plan is enabled, dailyNew means "remaining new cards for today".
  // This automatically catches up after missed days and decreases when ahead.
  if (snapshot.enabled) state.settings.dailyNew = snapshot.todayNewRemaining;

  writeState(state);
  window.__IELT_PLAN_PRELOAD__ = snapshot;
})();
