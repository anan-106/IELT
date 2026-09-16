// Explicitly surface historical overdue reviews in the automatic daily plan.
// The core app already schedules every due<=now card before new cards; this layer
// makes that review debt visible and keeps the plan priority understandable.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function localStartOfToday() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    return d.getTime();
  }

  function uniqueCards(items) {
    const seen = new Set();
    return (items || []).filter((w) => {
      if (!w?.cardId || w.quizMode === "source-only" || seen.has(w.cardId)) return false;
      seen.add(w.cardId);
      return true;
    });
  }

  function planWords() {
    return uniqueCards([
      ...(DATA.allPrimaryWords || []),
      ...(DATA.pdfMeaningDeck?.words || []),
      ...(DATA.academic?.words || [])
    ]);
  }

  function reviewSnapshot() {
    const state = readState();
    const cards = state.cards || {};
    const words = planWords();
    const todayStart = localStartOfToday();
    const tomorrowStart = todayStart + 86400000;

    let overdue = 0;
    let dueToday = 0;
    const overdueByDeck = { reading538: 0, pdfMeaning: 0, academic: 0 };

    for (const w of words) {
      const c = cards[w.cardId];
      if (!c?.reps || !c.due) continue;
      const due = Number(c.due || 0);
      if (due < todayStart) {
        overdue++;
        if (w.deckId in overdueByDeck) overdueByDeck[w.deckId]++;
      } else if (due < tomorrowStart) {
        dueToday++;
      }
    }

    const plan = state.studyPlan || {};
    const newToday = Math.max(0, Number(plan.todayNewRemaining ?? state.settings?.dailyNew ?? 0));
    const mandatoryReviews = overdue + dueToday;

    return {
      overdue,
      dueToday,
      mandatoryReviews,
      newToday,
      totalToday: mandatoryReviews + newToday,
      overdueByDeck
    };
  }

  function ensurePanel() {
    const planPanel = document.getElementById("studyPlanPanel");
    if (!planPanel) return null;

    let panel = document.getElementById("reviewBacklogPlan");
    if (!panel) {
      panel = document.createElement("div");
      panel.id = "reviewBacklogPlan";
      panel.style.margin = "0 0 14px";
      const firstGrid = planPanel.querySelector(".stats-grid");
      if (firstGrid) firstGrid.insertAdjacentElement("beforebegin", panel);
      else planPanel.appendChild(panel);
    }
    return panel;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;

    const s = reviewSnapshot();
    const signature = JSON.stringify(s);
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    const priority = s.overdue > 0
      ? "历史欠复习 → 今日到期复习 → 今日新学"
      : "今日到期复习 → 今日新学";

    const backlogNote = s.overdue > 0
      ? `有 ${s.overdue} 张历史欠复习，系统已把它们计入今天复习负荷，并自动压低部分新词量。`
      : "当前没有历史欠复习。";

    panel.innerHTML = `
      <div class="stats-grid" style="margin:0 0 10px">
        <article class="stat-panel">
          <span>历史欠复习</span>
          <strong>${s.overdue}</strong>
          <small style="color:var(--sub)">优先清理</small>
        </article>
        <article class="stat-panel">
          <span>今天到期</span>
          <strong>${s.dueToday}</strong>
          <small style="color:var(--sub)">按记忆计划</small>
        </article>
        <article class="stat-panel">
          <span>今日新学</span>
          <strong>${s.newToday}</strong>
          <small style="color:var(--sub)">随目标天数变化</small>
        </article>
        <article class="stat-panel">
          <span>今日必做总量</span>
          <strong>${s.totalToday}</strong>
          <small style="color:var(--sub)">错题强化另算</small>
        </article>
      </div>
      <div class="algorithm-note" style="padding:12px 14px;margin:0">
        <p style="margin:0"><strong>今日顺序：</strong>${priority}</p>
        <p style="margin:5px 0 0">${backlogNote}</p>
      </div>`;
  }

  let scheduled = false;
  function scheduleRender() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      render();
    });
  }

  new MutationObserver(scheduleRender).observe(document.body, { childList: true, subtree: true });
  window.addEventListener("storage", scheduleRender);
  document.addEventListener("click", () => setTimeout(scheduleRender, 0));
  render();

  window.__IELT_REVIEW_BACKLOG_PLAN__ = { reviewSnapshot, render };
})();
