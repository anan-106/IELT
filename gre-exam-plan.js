// Exam-date driven planning layer for GRE Prep.
(() => {
  "use strict";
  const KEY = "gre-prep-v1";
  const $ = (id) => document.getElementById(id);

  function dateKey(d = new Date()) {
    return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;
  }
  function dayNum(key) {
    const d = new Date(`${key}T00:00:00`);
    d.setHours(0,0,0,0);
    return Math.floor(d.getTime()/86400000);
  }
  function load() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function save(x) { localStorage.setItem(KEY, JSON.stringify(x)); }

  function phase(daysLeft) {
    if (daysLeft <= 7) return "考前冲刺";
    if (daysLeft <= 21) return "限时强化";
    if (daysLeft <= 45) return "专项强化";
    return "基础积累";
  }

  function examSnapshot() {
    const s = load();
    const examDate = String(s.settings?.examDate || "").trim();
    if (!examDate) return null;
    const today = dayNum(dateKey());
    const exam = dayNum(examDate);
    if (!Number.isFinite(exam) || exam < today) return null;
    const remaining = exam - today + 1;
    return { examDate, remaining, phase: phase(remaining) };
  }

  function applyExamDate(value) {
    const s = load();
    s.settings = s.settings || {};
    s.plan = s.plan || { startDate: dateKey() };
    s.settings.examDate = value || "";

    if (value) {
      const today = dayNum(dateKey());
      const exam = dayNum(value);
      if (Number.isFinite(exam) && exam >= today) {
        const elapsed = Math.max(0, today - dayNum(s.plan.startDate || dateKey()));
        const remaining = exam - today + 1;
        s.settings.planDays = Math.max(7, Math.min(180, elapsed + remaining));
      }
    }
    save(s);
  }

  function syncInput() {
    const input = $("examDateInput");
    if (!input) return;
    const s = load();
    input.value = s.settings?.examDate || "";
    if (input.dataset.greExamBound) return;
    input.dataset.greExamBound = "1";
    input.addEventListener("change", () => {
      applyExamDate(input.value);
      const snap = examSnapshot();
      const msg = snap
        ? `考试日期已设为 ${snap.examDate} · 还剩 ${snap.remaining} 天 · ${snap.phase}`
        : "已关闭考试日期驱动计划";
      const toast = $("toast");
      if (toast) {
        toast.textContent = msg;
        toast.classList.add("show");
        setTimeout(() => toast.classList.remove("show"), 1800);
      }
      setTimeout(() => location.reload(), 350);
    });
  }

  function annotatePlan() {
    const snap = examSnapshot();
    const panel = $("planPanel");
    if (!snap || !panel) return;
    let note = panel.querySelector(".exam-date-note");
    if (!note) {
      note = document.createElement("div");
      note.className = "exam-date-note";
      note.style.cssText = "margin-top:12px;padding:10px 12px;border:1px solid var(--line);border-radius:12px;color:var(--muted);font-size:.78rem;line-height:1.55";
      panel.appendChild(note);
    }
    note.innerHTML = `<strong>考试日期：</strong>${snap.examDate} · 距考试 <strong>${snap.remaining}</strong> 天 · 当前阶段 <strong>${snap.phase}</strong><br>计划天数会随考试日期自动换算；清空考试日期后恢复手动目标天数。`;
  }

  function boot() {
    syncInput();
    annotatePlan();
    const panel = $("planPanel");
    if (panel) new MutationObserver(() => requestAnimationFrame(annotatePlan)).observe(panel, {childList:true, subtree:true});
    document.querySelector("[data-view='settings']")?.addEventListener("click", () => setTimeout(syncInput, 0));
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__GRE_EXAM_PLAN__ = { examSnapshot, applyExamDate };
})();