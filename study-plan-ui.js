// Automatic plan dashboard + settings. Loaded after app.js.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";

  const esc = (v) => String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function localDayNumber(value) {
    const d = typeof value === "string" ? new Date(`${value}T00:00:00`) : new Date(value);
    d.setHours(0, 0, 0, 0);
    return Math.floor(d.getTime() / 86400000);
  }

  function addDays(key, days) {
    const d = new Date(`${key}T00:00:00`);
    d.setDate(d.getDate() + days);
    return dateKey(d.getTime());
  }

  function displayDate(key) {
    const d = new Date(`${key}T00:00:00`);
    return `${d.getMonth() + 1}/${d.getDate()}`;
  }

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
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

  function snapshot(state = readState()) {
    const today = dateKey();
    const words = planWords();
    const cards = state.cards || {};
    const plan = state.studyPlan || {};
    const targetDays = Math.max(1, Math.min(365, Number(plan.targetDays) || 30));
    const startDate = plan.startDate || today;
    const elapsed = Math.max(0, localDayNumber(today) - localDayNumber(startDate));
    const dayNumber = elapsed + 1;
    const remainingDays = Math.max(1, targetDays - elapsed);
    const completed = words.filter((w) => cards[w.cardId]?.reps > 0).length;
    const remaining = Math.max(0, words.length - completed);
    const learnedToday = Number(state.daily?.[today]?.newCards || 0);
    const fullDayTarget = remaining ? Math.ceil(remaining / remainingDays) : 0;
    const todayNewRemaining = Math.max(0, fullDayTarget - learnedToday);
    const now = Date.now();
    const dueToday = words.filter((w) => cards[w.cardId]?.reps > 0 && Number(cards[w.cardId].due || 0) <= now).length;
    const goalDate = addDays(startDate, targetDays - 1);
    const completionPct = words.length ? Math.round(completed / words.length * 100) : 0;
    return {
      enabled: plan.enabled !== false,
      targetDays,
      startDate,
      goalDate,
      dayNumber,
      remainingDays,
      totalCards: words.length,
      completed,
      remaining,
      learnedToday,
      fullDayTarget,
      todayNewRemaining,
      dueToday,
      completionPct,
      overdue: elapsed >= targetDays && remaining > 0
    };
  }

  function estimateForecast(days = 7) {
    const state = readState();
    const s = snapshot(state);
    const words = planWords();
    const cards = state.cards || {};
    const today = dateKey();
    const rows = Array.from({ length: days }, (_, i) => ({
      date: addDays(today, i),
      newCount: 0,
      reviewCount: 0
    }));
    const byDate = new Map(rows.map((r) => [r.date, r]));

    for (const w of words) {
      const c = cards[w.cardId];
      if (!c?.reps || !c.due) continue;
      const dueKey = dateKey(c.due);
      if (byDate.has(dueKey)) byDate.get(dueKey).reviewCount++;
    }

    let remaining = s.remaining;
    let remainingDays = s.remainingDays;
    for (let i = 0; i < days && remaining > 0; i++) {
      const row = rows[i];
      const planned = Math.min(remaining, Math.ceil(remaining / Math.max(1, remainingDays)));
      row.newCount = i === 0 ? Math.max(0, planned - s.learnedToday) : planned;
      remaining -= planned;
      remainingDays = Math.max(1, remainingDays - 1);

      // The current app uses expanding intervals between successful reviews:
      // learning day -> +1 -> +2 -> +6, so cumulative dates are +1 / +3 / +9.
      [addDays(row.date, 1), addDays(row.date, 3), addDays(row.date, 9)].forEach((key) => {
        if (byDate.has(key)) byDate.get(key).reviewCount += planned;
      });
    }

    return rows;
  }

  function ensurePlanPanel() {
    let panel = document.getElementById("studyPlanPanel");
    if (panel) return panel;
    const nav = document.querySelector(".nav-tabs");
    if (!nav) return null;
    panel = document.createElement("section");
    panel.id = "studyPlanPanel";
    panel.className = "level-progress-panel";
    panel.setAttribute("aria-label", "自动学习计划");
    nav.insertAdjacentElement("beforebegin", panel);
    return panel;
  }

  function renderPlanPanel() {
    const panel = ensurePlanPanel();
    if (!panel) return;
    const s = snapshot();
    const forecast = estimateForecast(7);
    const signature = JSON.stringify({
      targetDays: s.targetDays,
      dayNumber: s.dayNumber,
      totalCards: s.totalCards,
      completed: s.completed,
      remaining: s.remaining,
      learnedToday: s.learnedToday,
      todayNewRemaining: s.todayNewRemaining,
      dueToday: s.dueToday,
      goalDate: s.goalDate,
      enabled: s.enabled,
      forecast
    });
    if (panel.dataset.signature === signature) return;
    panel.dataset.signature = signature;

    const status = s.remaining === 0
      ? "全部新词已进入记忆系统"
      : s.overdue
        ? "目标日期已到，建议延长计划或增加每日新词"
        : `Day ${Math.min(s.dayNumber, s.targetDays)} / ${s.targetDays}`;
    const totalToday = s.dueToday + s.todayNewRemaining;

    panel.innerHTML = `
      <div class="level-progress-title">
        <div><span class="section-kicker">AUTO STUDY PLAN</span><h2>${s.targetDays} 天自动计划</h2></div>
        <small>${esc(status)} · 目标 ${esc(s.goalDate)}</small>
      </div>
      <div class="stats-grid" style="margin-bottom:14px">
        <article class="stat-panel"><span>计划总卡</span><strong>${s.totalCards}</strong></article>
        <article class="stat-panel"><span>已完成新学</span><strong>${s.completed}</strong></article>
        <article class="stat-panel"><span>今日新学</span><strong>${s.todayNewRemaining}</strong></article>
        <article class="stat-panel"><span>今日到期复习</span><strong>${s.dueToday}</strong></article>
      </div>
      <div class="level-track" title="计划完成 ${s.completionPct}%"><div class="level-fill" style="width:${s.completionPct}%;background:#527fa3"></div></div>
      <div class="level-progress-foot"><span>完成 ${s.completionPct}% · 剩 ${s.remaining}</span><span>今日基础任务约 ${totalToday} 张（错题强化另算）</span></div>
      <details style="margin-top:12px">
        <summary style="cursor:pointer;font-size:.82rem;font-weight:700">未来 7 天预计任务量</summary>
        <div style="overflow:auto;margin-top:10px">
          <table style="width:100%;border-collapse:collapse;font-size:.78rem">
            <thead><tr><th style="text-align:left;padding:6px">日期</th><th style="text-align:right;padding:6px">新学</th><th style="text-align:right;padding:6px">预计复习</th><th style="text-align:right;padding:6px">基础总量</th></tr></thead>
            <tbody>${forecast.map((r) => `<tr><td style="padding:6px">${displayDate(r.date)}</td><td style="text-align:right;padding:6px">${r.newCount}</td><td style="text-align:right;padding:6px">${r.reviewCount}</td><td style="text-align:right;padding:6px">${r.newCount + r.reviewCount}</td></tr>`).join("")}</tbody>
          </table>
        </div>
        <p style="margin:8px 0 0;color:var(--sub);font-size:.72rem">复习数是按当前到期卡 + 计划中新词的复习间隔估算；实际数量会随答错、补答和进度变化自动调整。</p>
      </details>`;
  }

  function ensurePlanSettings() {
    const view = document.getElementById("view-settings");
    const heading = view?.querySelector(".section-heading");
    if (!view || !heading || document.getElementById("studyPlanSettings")) return;
    const s = snapshot();
    const box = document.createElement("article");
    box.id = "studyPlanSettings";
    box.className = "algorithm-note";
    box.style.marginBottom = "18px";
    box.innerHTML = `
      <h3>自动学习计划</h3>
      <p>默认目标是 30 天。系统每天根据“剩余未学卡 ÷ 剩余天数”重新计算新词量；漏学一天，后面会自动补进度。到期复习不设人为上限，当天所有到期卡都应优先完成。</p>
      <div style="display:flex;gap:10px;align-items:end;flex-wrap:wrap;margin-top:12px">
        <label style="display:grid;gap:5px;font-size:.78rem">目标天数
          <input id="studyPlanDays" type="number" min="7" max="180" value="${s.targetDays}" style="min-width:110px" />
        </label>
        <label style="display:flex;align-items:center;gap:6px;font-size:.78rem;padding-bottom:9px">
          <input id="studyPlanEnabled" type="checkbox" ${s.enabled ? "checked" : ""} /> 自动控制每日新词
        </label>
        <button class="button button-primary" id="saveStudyPlanBtn">应用计划</button>
        <button class="button button-ghost" id="restartStudyPlanBtn">从今天重新开始</button>
      </div>`;
    heading.insertAdjacentElement("afterend", box);

    document.getElementById("saveStudyPlanBtn").onclick = () => {
      const state = readState();
      state.studyPlan = state.studyPlan || {};
      state.studyPlan.targetDays = Math.max(7, Math.min(180, Number(document.getElementById("studyPlanDays").value) || 30));
      state.studyPlan.enabled = document.getElementById("studyPlanEnabled").checked;
      if (!state.studyPlan.startDate) state.studyPlan.startDate = dateKey();
      writeState(state);
      location.reload();
    };

    document.getElementById("restartStudyPlanBtn").onclick = () => {
      const state = readState();
      state.studyPlan = state.studyPlan || {};
      state.studyPlan.startDate = dateKey();
      state.studyPlan.targetDays = Math.max(7, Math.min(180, Number(document.getElementById("studyPlanDays").value) || 30));
      state.studyPlan.enabled = true;
      writeState(state);
      location.reload();
    };
  }

  function refresh() {
    renderPlanPanel();
    ensurePlanSettings();
  }

  let scheduled = false;
  const observer = new MutationObserver(() => {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(() => {
      scheduled = false;
      refresh();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("storage", refresh);
  document.addEventListener("click", () => setTimeout(refresh, 0));
  refresh();
})();
