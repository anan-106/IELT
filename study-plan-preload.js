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

  function addDays(key, days) {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + days);
    return dateKey(d.getTime());
  }

  function localDayNumber(value) {
    const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 86400000);
  }

  function clamp(n, a, b) {
    return Math.max(a, Math.min(b, n));
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

  function uniqueCards(items) {
    const seen = new Set();
    return (items || []).filter((w) => {
      if (!w?.cardId || w.quizMode === "source-only" || seen.has(w.cardId)) return false;
      seen.add(w.cardId);
      return true;
    });
  }

  // Explicit plan membership and order. The 488 meaning deck is a first-class part
  // of the plan, not merely included accidentally through DATA.allWords.
  function planWords() {
    return uniqueCards([
      ...(DATA.allPrimaryWords || []),
      ...(DATA.pdfMeaningDeck?.words || []),
      ...(DATA.academic?.words || [])
    ]);
  }

  function deckKey(w) {
    if (w.deckId === "reading538") return "reading538";
    if (w.deckId === "pdf-meaning") return "pdfMeaning";
    if (w.deckId === "academic") return "academic";
    return "other";
  }

  function deckBreakdown(words, cards) {
    const out = {
      reading538: { total: 0, completed: 0, remaining: 0 },
      pdfMeaning: { total: 0, completed: 0, remaining: 0 },
      academic: { total: 0, completed: 0, remaining: 0 }
    };
    for (const w of words) {
      const key = deckKey(w);
      if (!out[key]) continue;
      out[key].total++;
      if (cards[w.cardId]?.reps > 0) out[key].completed++;
      else out[key].remaining++;
    }
    return out;
  }

  function newBreakdown(words, cards, count) {
    const out = { reading538: 0, pdfMeaning: 0, academic: 0 };
    const unseen = words.filter((w) => !cards[w.cardId]?.reps).slice(0, Math.max(0, count));
    for (const w of unseen) {
      const key = deckKey(w);
      if (key in out) out[key]++;
    }
    return out;
  }

  // Review load distinguishes reviews missed before today from reviews whose due
  // date is today. Both are mandatory and both reduce the day's new-card pressure.
  function reviewLoad(words, cards, today, days = 7) {
    const rows = Array.from({ length: days }, (_, i) => ({
      date: addDays(today, i),
      count: 0,
      overdue: 0,
      dueOnDate: 0
    }));
    const index = new Map(rows.map((r, i) => [r.date, i]));
    const todayNum = localDayNumber(today);

    for (const w of words) {
      const c = cards[w.cardId];
      if (!c?.reps || !c.due) continue;
      const dueKey = dateKey(c.due);
      const dueNum = localDayNumber(dueKey);
      if (dueNum < todayNum) {
        rows[0].count++;
        rows[0].overdue++;
      } else if (dueNum === todayNum) {
        rows[0].count++;
        rows[0].dueOnDate++;
      } else if (index.has(dueKey)) {
        const row = rows[index.get(dueKey)];
        row.count++;
        row.dueOnDate++;
      }
    }
    return rows;
  }

  function smoothedTarget(baseTarget, remaining, remainingDays, loadRows) {
    if (!baseTarget || !remaining) return 0;
    if (remainingDays <= 2 || remaining <= baseTarget * 2) return Math.min(remaining, baseTarget);

    const dueToday = loadRows[0]?.count || 0;
    const overdue = loadRows[0]?.overdue || 0;
    const avgDue = loadRows.length
      ? loadRows.reduce((sum, r) => sum + r.count, 0) / loadRows.length
      : dueToday;

    // First smooth against the normal 7-day review load.
    const adjustment = Math.round((avgDue - dueToday) * 0.25);
    const lower = Math.max(baseTarget > 0 ? 1 : 0, Math.ceil(baseTarget * 0.6));
    const upper = Math.max(lower, Math.ceil(baseTarget * 1.4));
    let target = Math.min(remaining, clamp(baseTarget + adjustment, lower, upper));

    // Historical review debt receives explicit priority. We lower new learning
    // conservatively instead of letting old due cards pile up behind new material.
    if (overdue > 0) {
      const backlogPenalty = Math.min(
        Math.ceil(baseTarget * 0.5),
        Math.ceil(overdue / 4)
      );
      target = Math.max(0, target - backlogPenalty);
    }

    return Math.min(remaining, target);
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
    const baseDailyTarget = remaining ? Math.ceil(remaining / remainingDays) : 0;
    const loadRows = reviewLoad(words, cards, today, 7);
    const smoothedDailyTarget = smoothedTarget(baseDailyTarget, remaining, remainingDays, loadRows);
    const learnedToday = Number(state.daily?.[today]?.newCards || 0);
    const todayNewRemaining = Math.max(0, smoothedDailyTarget - learnedToday);
    const enabled = existing.enabled !== false;
    const avgDueNext7 = loadRows.length
      ? Number((loadRows.reduce((sum, r) => sum + r.count, 0) / loadRows.length).toFixed(1))
      : 0;
    const overdueReviews = Number(loadRows[0]?.overdue || 0);
    const todayDueReviews = Number(loadRows[0]?.dueOnDate || 0);
    const mandatoryReviewsToday = overdueReviews + todayDueReviews;

    return {
      enabled,
      targetDays,
      startDate,
      dayNumber,
      remainingDays,
      totalCards: words.length,
      completed,
      remaining,
      deckBreakdown: deckBreakdown(words, cards),
      todayNewBreakdown: newBreakdown(words, cards, todayNewRemaining),
      baseDailyTarget,
      smoothedDailyTarget,
      fullDayTarget: smoothedDailyTarget,
      learnedToday,
      todayNewRemaining,
      overdueReviews,
      todayDueReviews,
      mandatoryReviewsToday,
      dueToday: mandatoryReviewsToday,
      avgDueNext7,
      reviewLoadNext7: loadRows,
      loadAdjustment: smoothedDailyTarget - baseDailyTarget,
      lastCalculatedDate: today
    };
  }

  const state = readState();
  state.settings = state.settings || {};
  const snapshot = calculate(state);
  state.studyPlan = { ...(state.studyPlan || {}), ...snapshot };

  if (snapshot.enabled) state.settings.dailyNew = snapshot.todayNewRemaining;

  writeState(state);
  window.__IELT_PLAN_PRELOAD__ = snapshot;
})();
