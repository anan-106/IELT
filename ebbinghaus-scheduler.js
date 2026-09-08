// Day-based Ebbinghaus review scheduler.
// Original day-level checkpoints: 1d -> 2d -> 6d -> 31d.
// Long-term maintenance extension used by this app: 60d -> 120d.
(() => {
  "use strict";

  const STORAGE_KEY = "ielt-memory-v3";
  const MODEL_ID = "ebbinghaus-day-v1";
  const INTERVALS = [1, 2, 6, 31, 60, 120];

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : null;
    } catch {
      return null;
    }
  }

  function writeState(state) {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function startOfDayPlus(days, base = new Date()) {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  function isoDay(ts) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function nextIntervalForStage(stage) {
    const index = Math.max(0, Math.min(INTERVALS.length - 1, stage));
    return INTERVALS[index];
  }

  function completedIntervalForStage(stage) {
    if (stage <= 0) return 1;
    return INTERVALS[Math.max(0, Math.min(INTERVALS.length - 1, stage - 1))];
  }

  // Existing D/S/R data is migrated conservatively: any learned card enters the
  // first day-level checkpoint so no old card is accidentally postponed.
  function migrateExistingCards() {
    const state = readState();
    if (!state?.cards || state.scheduleModel === MODEL_ID) return;

    Object.values(state.cards).forEach((c) => {
      if (!c?.reps) return;
      if (!Number.isInteger(c.ebbinghausStage)) c.ebbinghausStage = 0;
      c.scheduleModel = MODEL_ID;
      c.stability = 1;
      c.due = startOfDayPlus(1);
    });

    state.scheduleModel = MODEL_ID;
    state.scheduleIntervalsDays = INTERVALS;
    writeState(state);
  }

  function applyAnswer(cardId, correct) {
    const state = readState();
    const c = state?.cards?.[cardId];
    if (!state || !c) return null;

    let stage = Number.isInteger(c.ebbinghausStage) ? c.ebbinghausStage : -1;

    if (correct) {
      stage = Math.min(stage + 1, INTERVALS.length - 1);
    } else {
      // Wrong answer: same-session requeue is handled by app.js; cross-day
      // schedule returns to tomorrow's review.
      stage = -1;
    }

    const nextStage = correct ? stage : 0;
    const days = nextIntervalForStage(nextStage);
    const due = startOfDayPlus(days);

    c.ebbinghausStage = stage;
    c.scheduleModel = MODEL_ID;
    c.nextIntervalDays = days;
    c.due = due;
    // Keep compatibility with existing progress UI. Stability now means the
    // longest day checkpoint actually completed, not a free-form D/S/R value.
    c.stability = correct ? completedIntervalForStage(stage) : 1;
    c.lastRating = correct ? 3 : 1;

    state.scheduleModel = MODEL_ID;
    state.scheduleIntervalsDays = INTERVALS;
    writeState(state);

    return { days, due, stage, correct };
  }

  function updateResultText(result) {
    if (!result) return;
    const box = document.getElementById("autoResult");
    const ps = box?.querySelectorAll("p");
    if (ps?.[1]) {
      ps[1].textContent = `下次复习：${result.days} 天后（${isoDay(result.due)}）`;
    }
  }

  function updateSettingsCopy() {
    const retention = document.getElementById("retentionInput");
    const card = retention?.closest(".setting-card");
    if (card) card.style.display = "none";

    const note = document.querySelector(".algorithm-note");
    if (note) {
      note.innerHTML = `
        <h3>艾宾浩斯按天复习</h3>
        <p>跨天复习固定按 <strong>1 → 2 → 6 → 31 天</strong>推进；31 天后进入本项目的长期维护扩展 <strong>60 → 120 天</strong>。回答正确才进入下一档；回答错误会在本轮再次出现，并把跨天复习重置到明天。所有到期时间按本地日历日计算，不按“满24小时”计算。</p>`;
    }
  }

  migrateExistingCards();
  updateSettingsCopy();

  document.addEventListener("click", (event) => {
    const button = event.target.closest?.(".option");
    if (!button) return;

    // app.js handles scoring first. Run on the next task to overwrite only the
    // cross-day due date with the Ebbinghaus day schedule.
    setTimeout(() => {
      const cardEl = button.closest(".word-card[data-card]");
      if (!cardEl) return;
      const correct = button.classList.contains("correct") && !button.classList.contains("wrong");
      const result = applyAnswer(cardEl.dataset.card, correct);
      updateResultText(result);
      window.dispatchEvent(new Event("ielt-schedule-updated"));
    }, 0);
  });
})();
