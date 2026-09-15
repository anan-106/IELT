// UI summary for the uploaded printed "488" total-list audit.
(() => {
  "use strict";
  const DATA = window.__IELT_DATA_V2__;
  const audit = DATA?.totalListAudit;
  if (!DATA || !audit) return;

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function updateCountText() {
    const el = document.getElementById("dataCountText");
    if (!el) return;
    const academic = DATA.counts?.academicUnique ?? 0;
    setText(el, `376 个主词 · 后附总表 ${audit.uniqueTerms}/${audit.uniqueTerms} 已纳入 · 新补 ${audit.supplementAdded} 项 · Academic ${academic} 词`);
  }

  function ensureNotice() {
    const library = document.getElementById("view-library");
    const toolbar = library?.querySelector(".library-toolbar");
    if (!library || !toolbar || document.getElementById("printedTotalAuditNotice")) return;

    const note = document.createElement("article");
    note.id = "printedTotalAuditNotice";
    note.className = "algorithm-note";
    note.style.marginBottom = "16px";
    const sourceOnlyText = audit.sourceOnlyAdded
      ? `其中 ${audit.sourceOnlyAdded} 项目前只有原书总表词形、没有被你上传的中文释义表覆盖，因此已纳入索引但暂不自动出题，避免凭空补义。`
      : "所有新增项都有你上传资料可支持的中文释义，可进入学习。";
    note.innerHTML = `
      <h3>后附“488”总表核验</h3>
      <p>你上传的扫描页标题写“488 个雅思阅读考点词库总表”。逐格数据化后，本项目识别到 <strong>${audit.filledCells}</strong> 个非空格，去除重复的 <strong>${(audit.duplicates || []).join(" / ") || "无"}</strong> 后为 <strong>${audit.uniqueTerms}</strong> 个唯一词/词组。</p>
      <p style="margin-top:8px">此前的 376 主词 + 同义替换结构已经覆盖 <strong>${audit.coveredBeforeSupplement}</strong> 项；本次自动补入 <strong>${audit.supplementAdded}</strong> 项，其中 <strong>${audit.learnableSupplementAdded || 0}</strong> 项可直接学习。${sourceOnlyText}</p>`;
    toolbar.insertAdjacentElement("afterend", note);
  }

  function updateSettingsCopy() {
    const input = document.getElementById("dailyNewInput");
    const small = input?.closest(".setting-card")?.querySelector("small");
    setText(small, "第1类 → 第2类 → 第3类 → 后附总表补充 → Academic");
  }

  function refresh() {
    updateCountText();
    ensureNotice();
    updateSettingsCopy();
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
  refresh();
})();
