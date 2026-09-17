// 17-day-style GRE list schedule inspired by exam4.us / 杨鹏复习法.
// Default: start 2026-09-20, 5 Lists per day, 31 Lists total (再要你命3000).
// Review gaps follow the newer exam4.us schedule: 1,2,4,7,15 days between review points,
// which yields offsets 0,1,3,7,14,29 days from initial study (0 = same-day evening review).
(() => {
  "use strict";

  const KEY = "gre-17day-plan-v1";
  const DEFAULTS = {
    startDate: "2026-09-20",
    listsPerDay: 5,
    totalLists: 31,
    listName: "List"
  };
  const REVIEW_OFFSETS = [0, 1, 3, 7, 14, 29];

  const esc = (v) => String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function read() {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(KEY) || "{}") || {}) }; }
    catch { return { ...DEFAULTS }; }
  }

  function write(next) {
    const value = { ...read(), ...next };
    localStorage.setItem(KEY, JSON.stringify(value));
    return value;
  }

  function dateKey(d) {
    const x = new Date(d);
    return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}-${String(x.getDate()).padStart(2, "0")}`;
  }

  function fromKey(key) {
    return new Date(`${key}T00:00:00`);
  }

  function addDays(key, days) {
    const d = fromKey(key);
    d.setDate(d.getDate() + days);
    return dateKey(d);
  }

  function formatDate(key) {
    const d = fromKey(key);
    const weekday = ["日","一","二","三","四","五","六"][d.getDay()];
    return `${d.getMonth() + 1}/${d.getDate()} 周${weekday}`;
  }

  function rangeLabel(items, name = "List") {
    if (!items?.length) return "—";
    if (items.length === 1) return `${name}${items[0]}`;
    const consecutive = items.every((v, i) => i === 0 || v === items[i - 1] + 1);
    return consecutive ? `${name}${items[0]}–${items[items.length - 1]}` : items.map(x => `${name}${x}`).join("、");
  }

  function buildPlan(settings = read()) {
    const start = settings.startDate || DEFAULTS.startDate;
    const perDay = Math.max(1, Math.min(20, Number(settings.listsPerDay) || 5));
    const total = Math.max(1, Math.min(200, Number(settings.totalLists) || 31));
    const name = String(settings.listName || "List").trim() || "List";
    const map = new Map();
    const batches = [];

    function row(key) {
      if (!map.has(key)) map.set(key, { date: key, newLists: [], reviewLists: [] });
      return map.get(key);
    }

    for (let i = 0; i < total; i += perDay) {
      const dayIndex = Math.floor(i / perDay);
      const key = addDays(start, dayIndex);
      const lists = Array.from({ length: Math.min(perDay, total - i) }, (_, j) => i + j + 1);
      batches.push({ date: key, lists });
      row(key).newLists.push(...lists);
      for (const off of REVIEW_OFFSETS) row(addDays(key, off)).reviewLists.push(...lists);
    }

    const rows = [...map.values()].sort((a, b) => a.date.localeCompare(b.date));
    return {
      settings: { ...settings, startDate: start, listsPerDay: perDay, totalLists: total, listName: name },
      rows,
      batches,
      newFinish: batches.at(-1)?.date || start,
      finalFinish: rows.at(-1)?.date || start,
      totalStudyDays: batches.length,
      reviewOffsets: REVIEW_OFFSETS.slice()
    };
  }

  function ensurePanel() {
    let panel = document.getElementById("gre17PlanPanel");
    if (panel) return panel;
    const anchor = document.getElementById("planPanel");
    if (!anchor) return null;
    panel = document.createElement("section");
    panel.id = "gre17PlanPanel";
    panel.className = "panel plan-panel";
    panel.style.marginTop = "14px";
    anchor.insertAdjacentElement("afterend", panel);
    return panel;
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;
    const plan = buildPlan();
    const s = plan.settings;
    panel.innerHTML = `
      <div class="section-head" style="margin:0 0 12px">
        <div>
          <div class="kicker">17-DAY METHOD · LIST PLAN</div>
          <h2 style="margin:3px 0">大三千 List 复习计划</h2>
          <p>每天 ${s.listsPerDay} 个 List · 共 ${s.totalLists} 个 · ${esc(s.startDate)} 开始</p>
        </div>
        <small class="muted">新词 ${esc(plan.newFinish)} 完成 · 最后一轮 ${esc(plan.finalFinish)} 完成</small>
      </div>
      <div class="metric-grid" style="margin-bottom:12px">
        <article class="metric"><span>每天新学</span><strong>${s.listsPerDay}</strong><small>List/Page</small></article>
        <article class="metric"><span>主词表</span><strong>${s.totalLists}</strong><small>再要你命3000 共31 List</small></article>
        <article class="metric"><span>新学阶段</span><strong>${plan.totalStudyDays}</strong><small>天</small></article>
        <article class="metric"><span>复习节点</span><strong>0/1/3/7/14/29</strong><small>距首次学习天数</small></article>
      </div>
      <details open>
        <summary style="cursor:pointer;font-weight:800">查看完整计划表</summary>
        <div style="overflow:auto;margin-top:10px">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead><tr>
              <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">日期</th>
              <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">上午新学</th>
              <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">下午/晚上复习 *</th>
            </tr></thead>
            <tbody>${plan.rows.map(r => `
              <tr>
                <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(formatDate(r.date))}</td>
                <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(rangeLabel(r.newLists, s.listName))}</td>
                <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(rangeLabel(r.reviewLists, s.listName))}</td>
              </tr>`).join("")}</tbody>
          </table>
        </div>
        <p class="muted" style="margin:10px 0 0">* 同日复习算作 12 小时后的第一轮；之后按 1、2、4、7、15 天的间隔继续复习，因此相对首次学习日的累计偏移是 0、1、3、7、14、29 天。</p>
      </details>`;
  }

  function ensureSettings() {
    const grid = document.querySelector("#view-settings .settings-grid");
    if (!grid || document.getElementById("gre17StartInput")) return;
    const s = read();
    const items = [
      ["gre17StartInput", "17天法开始日期", "date", s.startDate],
      ["gre17PerDayInput", "每天 List/Page", "number", s.listsPerDay],
      ["gre17TotalInput", "List/Page 总数", "number", s.totalLists]
    ];
    for (const [id, title, type, value] of items) {
      const label = document.createElement("label");
      label.className = "setting";
      label.innerHTML = `<span><strong>${esc(title)}</strong><small>按 exam4.us 新版间隔自动生成</small></span><input id="${id}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="1" max="200"' : ""} />`;
      grid.appendChild(label);
    }

    const actions = document.querySelector("#view-settings .actions");
    if (actions && !document.getElementById("saveGre17PlanBtn")) {
      const btn = document.createElement("button");
      btn.id = "saveGre17PlanBtn";
      btn.className = "ghost";
      btn.textContent = "保存List复习计划";
      btn.onclick = () => {
        write({
          startDate: document.getElementById("gre17StartInput")?.value || DEFAULTS.startDate,
          listsPerDay: Number(document.getElementById("gre17PerDayInput")?.value) || 5,
          totalLists: Number(document.getElementById("gre17TotalInput")?.value) || 31
        });
        render();
        const toast = document.getElementById("toast");
        if (toast) {
          toast.textContent = "List 复习计划已更新";
          toast.classList.add("show");
          setTimeout(() => toast.classList.remove("show"), 1500);
        }
      };
      actions.appendChild(btn);
    }
  }

  new MutationObserver(() => {
    ensurePanel();
    ensureSettings();
  }).observe(document.body, { childList: true, subtree: true });

  ensurePanel();
  ensureSettings();
  render();

  window.__GRE_17DAY_PLAN__ = { buildPlan, read, write, render, offsets: REVIEW_OFFSETS.slice() };
})();