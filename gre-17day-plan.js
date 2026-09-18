// Editable 17-day-style GRE list schedule inspired by exam4.us / 杨鹏复习法.
// Auto schedule: start date + Lists/day + total Lists + review offsets.
// The generated full table can also be switched into manual edit mode; custom rows persist in localStorage.
(() => {
  "use strict";

  const KEY = "gre-17day-plan-v2";
  const LEGACY_KEY = "gre-17day-plan-v1";
  const DEFAULTS = {
    startDate: "2026-09-20",
    listsPerDay: 5,
    totalLists: 31,
    listName: "List",
    customRows: null
  };
  const REVIEW_OFFSETS = [0, 1, 3, 7, 14, 29];
  let editMode = false;
  let draftRows = null;

  const esc = (v) => String(v ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#039;");

  function read() {
    try {
      const current = JSON.parse(localStorage.getItem(KEY) || "null");
      if (current) return { ...DEFAULTS, ...current };
      const legacy = JSON.parse(localStorage.getItem(LEGACY_KEY) || "null");
      if (legacy) {
        const migrated = { ...DEFAULTS, ...legacy, customRows: null };
        localStorage.setItem(KEY, JSON.stringify(migrated));
        return migrated;
      }
      return { ...DEFAULTS };
    } catch {
      return { ...DEFAULTS };
    }
  }

  function write(next) {
    const value = { ...read(), ...next };
    localStorage.setItem(KEY, JSON.stringify(value));
    return value;
  }

  function toast(msg) {
    const t = document.getElementById("toast");
    if (!t) return;
    t.textContent = msg;
    t.classList.add("show");
    clearTimeout(t._gre17tm);
    t._gre17tm = setTimeout(() => t.classList.remove("show"), 1600);
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
    if (Number.isNaN(d.getTime())) return key || "—";
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

  function autoRowsToEditable(plan) {
    return plan.rows.map(r => ({
      date: r.date,
      newText: rangeLabel(r.newLists, plan.settings.listName),
      reviewText: rangeLabel(r.reviewLists, plan.settings.listName)
    }));
  }

  function cleanCustomRows(rows) {
    return (rows || [])
      .map(r => ({
        date: String(r.date || "").trim(),
        newText: String(r.newText || "—").trim() || "—",
        reviewText: String(r.reviewText || "—").trim() || "—"
      }))
      .filter(r => r.date || r.newText !== "—" || r.reviewText !== "—");
  }

  function displayPlan() {
    const s = read();
    const auto = buildPlan(s);
    const custom = Array.isArray(s.customRows) && s.customRows.length ? cleanCustomRows(s.customRows) : null;
    if (!custom) {
      return {
        ...auto,
        displayRows: autoRowsToEditable(auto),
        manual: false
      };
    }

    const sorted = [...custom].sort((a,b) => String(a.date).localeCompare(String(b.date)));
    const newRows = sorted.filter(r => r.newText && r.newText !== "—");
    return {
      ...auto,
      displayRows: sorted,
      manual: true,
      totalStudyDays: newRows.length,
      newFinish: newRows.at(-1)?.date || auto.newFinish,
      finalFinish: sorted.at(-1)?.date || auto.finalFinish
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

  function inputRow(r, i) {
    return `
      <tr data-edit-row="${i}">
        <td style="padding:6px;border-bottom:1px solid var(--line)">
          <input data-field="date" type="date" value="${esc(r.date)}" style="width:145px;max-width:100%;padding:7px;border:1px solid var(--line);border-radius:8px" />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--line)">
          <input data-field="newText" value="${esc(r.newText)}" placeholder="如 List1–5" style="width:100%;min-width:150px;padding:7px;border:1px solid var(--line);border-radius:8px" />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--line)">
          <input data-field="reviewText" value="${esc(r.reviewText)}" placeholder="如 List1–5、List6–10" style="width:100%;min-width:180px;padding:7px;border:1px solid var(--line);border-radius:8px" />
        </td>
        <td style="padding:6px;border-bottom:1px solid var(--line);white-space:nowrap">
          <button class="ghost" data-delete-row="${i}" type="button">删除</button>
        </td>
      </tr>`;
  }

  function viewRow(r) {
    return `
      <tr>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(formatDate(r.date))}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(r.newText)}</td>
        <td style="padding:7px;border-bottom:1px solid var(--line)">${esc(r.reviewText)}</td>
      </tr>`;
  }

  function readDraftFromTable() {
    const panel = document.getElementById("gre17PlanPanel");
    if (!panel) return [];
    return [...panel.querySelectorAll("[data-edit-row]")].map(tr => ({
      date: tr.querySelector('[data-field="date"]')?.value || "",
      newText: tr.querySelector('[data-field="newText"]')?.value || "—",
      reviewText: tr.querySelector('[data-field="reviewText"]')?.value || "—"
    }));
  }

  function bindEditor(plan) {
    const panel = document.getElementById("gre17PlanPanel");
    if (!panel) return;

    panel.querySelector("#editGre17FullPlanBtn")?.addEventListener("click", () => {
      editMode = true;
      draftRows = plan.displayRows.map(r => ({...r}));
      render();
    });

    panel.querySelector("#cancelGre17EditBtn")?.addEventListener("click", () => {
      editMode = false;
      draftRows = null;
      render();
    });

    panel.querySelector("#addGre17RowBtn")?.addEventListener("click", () => {
      draftRows = readDraftFromTable();
      const last = draftRows.at(-1)?.date || plan.finalFinish || plan.settings.startDate;
      draftRows.push({ date: addDays(last, 1), newText: "—", reviewText: "—" });
      render();
    });

    panel.querySelectorAll("[data-delete-row]").forEach(btn => {
      btn.addEventListener("click", () => {
        draftRows = readDraftFromTable();
        draftRows.splice(Number(btn.dataset.deleteRow), 1);
        render();
      });
    });

    panel.querySelector("#saveGre17FullPlanBtn")?.addEventListener("click", () => {
      const rows = cleanCustomRows(readDraftFromTable());
      write({ customRows: rows });
      editMode = false;
      draftRows = null;
      toast("完整计划表已保存");
      render();
    });

    panel.querySelector("#resetGre17FullPlanBtn")?.addEventListener("click", () => {
      if (!confirm("恢复自动生成的完整计划表？手动修改会被清除。")) return;
      write({ customRows: null });
      editMode = false;
      draftRows = null;
      toast("已恢复自动计划");
      render();
    });
  }

  function render() {
    const panel = ensurePanel();
    if (!panel) return;

    const plan = displayPlan();
    const s = plan.settings;
    const rowsForEdit = editMode
      ? (draftRows?.length ? draftRows : plan.displayRows.map(r => ({...r})))
      : plan.displayRows;

    panel.innerHTML = `
      <div class="section-head" style="margin:0 0 12px">
        <div>
          <div class="kicker">17-DAY METHOD · EDITABLE LIST PLAN</div>
          <h2 style="margin:3px 0">大三千 List 复习计划</h2>
          <p>每天 ${s.listsPerDay} 个 List · 共 ${s.totalLists} 个 · ${esc(s.startDate)} 开始${plan.manual ? " · 当前使用手动计划" : ""}</p>
        </div>
        <small class="muted">新词 ${esc(plan.newFinish)} 完成 · 最后一轮 ${esc(plan.finalFinish)} 完成</small>
      </div>

      <div class="metric-grid" style="margin-bottom:12px">
        <article class="metric"><span>每天新学</span><strong>${s.listsPerDay}</strong><small>自动计划参数</small></article>
        <article class="metric"><span>主词表</span><strong>${s.totalLists}</strong><small>再要你命3000 List</small></article>
        <article class="metric"><span>新学阶段</span><strong>${plan.totalStudyDays}</strong><small>天</small></article>
        <article class="metric"><span>计划模式</span><strong>${plan.manual ? "手动" : "自动"}</strong><small>${plan.manual ? "完整表已自定义" : "0/1/3/7/14/29"}</small></article>
      </div>

      <details open>
        <summary style="cursor:pointer;font-weight:800">查看完整计划表</summary>

        <div style="display:flex;gap:8px;flex-wrap:wrap;margin:10px 0">
          ${editMode
            ? `<button class="primary" id="saveGre17FullPlanBtn" type="button">保存完整计划</button>
               <button class="ghost" id="addGre17RowBtn" type="button">新增一天</button>
               <button class="ghost" id="cancelGre17EditBtn" type="button">取消编辑</button>`
            : `<button class="primary" id="editGre17FullPlanBtn" type="button">编辑完整计划表</button>
               ${plan.manual ? '<button class="ghost" id="resetGre17FullPlanBtn" type="button">恢复自动计划</button>' : ""}`}
        </div>

        <div style="overflow:auto;margin-top:6px">
          <table style="width:100%;border-collapse:collapse;font-size:.82rem">
            <thead>
              <tr>
                <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">日期</th>
                <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">上午新学</th>
                <th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">下午/晚上复习 *</th>
                ${editMode ? '<th style="text-align:left;padding:7px;border-bottom:1px solid var(--line)">操作</th>' : ""}
              </tr>
            </thead>
            <tbody>
              ${editMode ? rowsForEdit.map(inputRow).join("") : rowsForEdit.map(viewRow).join("")}
            </tbody>
          </table>
        </div>

        <p class="muted" style="margin:10px 0 0">
          * 自动模式按 0、1、3、7、14、29 天累计偏移生成。进入“编辑完整计划表”后，可直接修改日期、新学内容和复习内容，也可新增/删除日期；保存后手动表会覆盖自动表的显示。
        </p>
      </details>`;

    bindEditor(plan);
  }

  function ensureSettings() {
    const grid = document.querySelector("#view-settings .settings-grid");
    if (!grid || document.getElementById("gre17StartInput")) return;
    const s = read();
    const items = [
      ["gre17StartInput", "List计划开始日期", "date", s.startDate],
      ["gre17PerDayInput", "每天 List/Page", "number", s.listsPerDay],
      ["gre17TotalInput", "List/Page 总数", "number", s.totalLists]
    ];

    for (const [id, title, type, value] of items) {
      const label = document.createElement("label");
      label.className = "setting";
      label.innerHTML = `<span><strong>${esc(title)}</strong><small>修改后可重新生成自动计划；手动完整表可单独编辑</small></span><input id="${id}" type="${type}" value="${esc(value)}" ${type === "number" ? 'min="1" max="200"' : ""} />`;
      grid.appendChild(label);
    }

    const actions = document.querySelector("#view-settings .actions");
    if (actions && !document.getElementById("saveGre17PlanBtn")) {
      const btn = document.createElement("button");
      btn.id = "saveGre17PlanBtn";
      btn.className = "ghost";
      btn.textContent = "保存并重生成自动List计划";
      btn.onclick = () => {
        const hadCustom = Array.isArray(read().customRows) && read().customRows.length;
        if (hadCustom && !confirm("当前完整计划表有手动修改。重新生成自动计划会清除这些手动修改，继续吗？")) return;

        write({
          startDate: document.getElementById("gre17StartInput")?.value || DEFAULTS.startDate,
          listsPerDay: Number(document.getElementById("gre17PerDayInput")?.value) || 5,
          totalLists: Number(document.getElementById("gre17TotalInput")?.value) || 31,
          customRows: null
        });
        editMode = false;
        draftRows = null;
        render();
        toast("自动 List 计划已重新生成");
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

  window.__GRE_17DAY_PLAN__ = {
    buildPlan,
    displayPlan,
    read,
    write,
    render,
    offsets: REVIEW_OFFSETS.slice()
  };
})();