// Startup integrity checks for GRE Prep data and local storage.
(() => {
  "use strict";
  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  function checkUnique(items, label) {
    const seen = new Set(), dup = [];
    for (const x of items || []) {
      const id = String(x?.id || "");
      if (!id) dup.push("(missing id)");
      else if (seen.has(id)) dup.push(id);
      else seen.add(id);
    }
    return dup.length ? [`${label} duplicate/missing IDs: ${[...new Set(dup)].join(", ")}`] : [];
  }

  function run() {
    const errors = [];
    const warnings = [];
    errors.push(...checkUnique(DATA.words, "Vocabulary"));
    errors.push(...checkUnique(DATA.verbal, "Verbal"));
    errors.push(...checkUnique(DATA.quant, "Quant"));

    for (const q of DATA.quant || []) {
      if (!q.area || !q.topic || !q.setting || !q.difficulty) warnings.push(`${q.id}: missing ETS-style Quant metadata`);
      if (q.numeric === undefined) {
        if (!Array.isArray(q.options) || !Array.isArray(q.answer) || !q.answer.length) errors.push(`${q.id}: invalid choice question structure`);
        else if (q.answer.some(i => !Number.isInteger(i) || i < 0 || i >= q.options.length)) errors.push(`${q.id}: answer index out of range`);
      } else if (!Number.isFinite(Number(q.numeric))) errors.push(`${q.id}: invalid numeric answer`);
    }

    if (!Array.isArray(DATA.words) || DATA.words.length < 500) warnings.push("Vocabulary deck is still small; GRE-CN cache may not have loaded yet.");
    const areas = new Set((DATA.quant || []).map(q => q.area));
    ["Arithmetic","Algebra","Geometry","Data Analysis"].forEach(a => { if (!areas.has(a)) warnings.push(`Quant has no ${a} questions`); });

    let storageOK = true;
    try {
      const k = "__gre_health_test__";
      localStorage.setItem(k, "1");
      storageOK = localStorage.getItem(k) === "1";
      localStorage.removeItem(k);
    } catch { storageOK = false; }
    if (!storageOK) errors.push("localStorage is unavailable.");

    return { errors, warnings, storageOK, checkedAt: Date.now() };
  }

  function updateButton(report) {
    const btn = document.getElementById("healthBtn");
    if (!btn) return;
    if (report.errors.length) {
      btn.textContent = `⚠ 自检 ${report.errors.length}`;
      btn.title = report.errors.join("\n");
    } else {
      btn.textContent = report.warnings.length ? `✓ 自检通过 · ${report.warnings.length}提示` : "✓ 自检通过";
      btn.title = report.warnings.length ? report.warnings.join("\n") : "数据结构与本地存储检查通过";
    }
    btn.onclick = () => {
      const r = run();
      const lines = [
        "GRE 启动自检",
        `词汇：${DATA.words.length}`,
        `Verbal：${DATA.verbal.length}`,
        `Quant：${DATA.quant.length}`,
        `本地存储：${r.storageOK ? "正常" : "异常"}`,
        "",
        r.errors.length ? "错误：" + r.errors.join("\n- ") : "错误：0",
        r.warnings.length ? "\n提示：" + r.warnings.join("\n- ") : ""
      ];
      alert(lines.join("\n"));
    };
  }

  function boot() {
    const report = run();
    updateButton(report);
    window.__GRE_HEALTH_REPORT__ = report;
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__GRE_HEALTH__ = { run };
})();