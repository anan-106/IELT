// Startup integrity checks + optional persistent browser storage request.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const checks = [];
  const allWords = DATA.allWords || [];
  const primary = DATA.allPrimaryWords || [];
  const groups = DATA.groups || [];

  function add(name, ok, detail, severity = "error") {
    checks.push({ name, ok: Boolean(ok), detail: String(detail || ""), severity });
  }

  function runChecks() {
    checks.length = 0;
    add("376 主词", primary.length === 376, `当前 ${primary.length}`);
    add("三类数量", groups.length >= 3 && groups[0]?.words?.length === 20 && groups[1]?.words?.length === 100 && groups[2]?.words?.length === 256,
      `当前 ${groups.slice(0, 3).map((g) => g.words?.length || 0).join(" / ")}`);

    const ids = allWords.map((w) => w.cardId).filter(Boolean);
    add("cardId 唯一", new Set(ids).size === ids.length, `总卡 ${ids.length}，唯一 ${new Set(ids).size}`);

    const meaningWords = allWords.filter((w) => w.quizMode === "meaning");
    const missingMeaning = meaningWords.filter((w) => !String(w.chinese || "").trim());
    add("词义卡完整", missingMeaning.length === 0, missingMeaning.length ? `缺中文义 ${missingMeaning.length} 项` : `${meaningWords.length} 张词义卡均有中文`);

    const meaningDeckCount = Number(DATA.pdfMeaningDeck?.words?.length || 0);
    add("488 词义 deck", meaningDeckCount > 0, `当前 ${meaningDeckCount} 词`);

    const weakSynonymRows = primary.filter((w) => {
      const cluster = [w.word, ...(w.sourceSynonyms || w.quizSynonyms || w.synonyms || [])].filter(Boolean);
      return new Set(cluster.map((x) => String(x).toLowerCase().trim())).size < 2;
    });
    add("538 替换数据", weakSynonymRows.length === 0, weakSynonymRows.length ? `${weakSynonymRows.length} 个主词缺可测替换` : "全部主词都有可测替换", "warning");

    let storageOk = false;
    try {
      const key = "__ielt_storage_test__";
      localStorage.setItem(key, "1");
      storageOk = localStorage.getItem(key) === "1";
      localStorage.removeItem(key);
    } catch {}
    add("本地存储", storageOk, storageOk ? "localStorage 可读写" : "localStorage 不可用");

    renderBadge();
    renderSettings();
    console.info("[IELT health check]", checks);
    return checks;
  }

  function issueCounts() {
    return {
      errors: checks.filter((x) => !x.ok && x.severity === "error").length,
      warnings: checks.filter((x) => !x.ok && x.severity === "warning").length
    };
  }

  function ensureBadge() {
    let badge = document.getElementById("healthCheckChip");
    if (badge) return badge;
    const streak = document.querySelector(".streak-chip");
    if (!streak) return null;
    badge = document.createElement("button");
    badge.id = "healthCheckChip";
    badge.className = "streak-chip";
    badge.style.cursor = "pointer";
    badge.style.marginLeft = "8px";
    streak.insertAdjacentElement("afterend", badge);
    badge.onclick = () => {
      const lines = checks.map((x) => `${x.ok ? "✓" : x.severity === "warning" ? "△" : "✕"} ${x.name}: ${x.detail}`).join("\n");
      alert(`IELT 启动自检\n\n${lines}`);
    };
    return badge;
  }

  function renderBadge() {
    const badge = ensureBadge();
    if (!badge) return;
    const { errors, warnings } = issueCounts();
    if (!errors && !warnings) {
      badge.textContent = "✓ 数据自检";
      badge.style.color = "#2f6948";
      badge.style.borderColor = "#b8d4c1";
    } else if (!errors) {
      badge.textContent = `△ 自检 ${warnings}`;
      badge.style.color = "#8a6426";
      badge.style.borderColor = "#e7d4a7";
    } else {
      badge.textContent = `✕ 自检 ${errors}`;
      badge.style.color = "#a23b35";
      badge.style.borderColor = "#ecc6c2";
    }
  }

  async function storagePersistenceStatus() {
    if (!navigator.storage?.persisted) return { supported: false, persisted: false };
    try { return { supported: true, persisted: await navigator.storage.persisted() }; }
    catch { return { supported: true, persisted: false }; }
  }

  async function requestPersistence() {
    const hint = document.getElementById("persistentStorageHint");
    if (!navigator.storage?.persist) {
      if (hint) hint.textContent = "当前浏览器不支持持久存储请求；请继续定期导出 JSON 备份。";
      return;
    }
    try {
      const granted = await navigator.storage.persist();
      if (hint) hint.textContent = granted
        ? "已获得持久存储：浏览器不会因存储压力自动清理本项目数据；手动清除站点数据仍会删除。"
        : "浏览器未授予持久存储；学习记录仍会正常保存在本地，建议定期导出 JSON。";
    } catch {
      if (hint) hint.textContent = "请求失败；学习记录仍保存在本地，建议定期导出 JSON。";
    }
  }

  async function renderSettings() {
    const view = document.getElementById("view-settings");
    const dataPanel = view?.querySelector(".data-panel");
    if (!view || !dataPanel) return;
    let box = document.getElementById("storageHealthPanel");
    if (!box) {
      box = document.createElement("article");
      box.id = "storageHealthPanel";
      box.className = "algorithm-note";
      box.style.marginTop = "14px";
      dataPanel.insertAdjacentElement("afterend", box);
    }

    const { errors, warnings } = issueCounts();
    const storage = await storagePersistenceStatus();
    box.innerHTML = `
      <h3>数据与本地存储健康</h3>
      <p>启动自检：${errors ? `<strong>${errors} 个错误</strong>` : "无错误"}${warnings ? ` · ${warnings} 个警告` : ""}。点击页面顶部“数据自检”可查看明细。</p>
      <p id="persistentStorageHint" style="margin-top:7px">${storage.supported ? (storage.persisted ? "当前站点已获得持久存储。" : "当前仍是浏览器默认的 best-effort 存储，可申请更强的数据保护。") : "当前浏览器未提供持久存储状态 API。"}</p>
      <button class="button button-ghost" id="requestPersistentStorage" style="margin-top:10px">保护本地学习数据</button>`;
    document.getElementById("requestPersistentStorage").onclick = requestPersistence;
  }

  runChecks();
  window.addEventListener("storage", runChecks);
  window.__IELT_HEALTH__ = { runChecks, checks };
})();
