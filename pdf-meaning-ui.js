// UI integration for the separate PDF meaning-only deck.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  const deck = DATA?.pdfMeaningDeck;
  if (!DATA || !deck) return;

  const STORAGE_KEY = "ielt-memory-v3";
  const SEARCH_TOKEN = "PDF词义记忆";
  const byCard = new Map((deck.words || []).map((w) => [w.cardId, w]));

  function readState() {
    try {
      return JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}") || {};
    } catch {
      return {};
    }
  }

  function setText(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function ensureFilterButton() {
    const host = document.getElementById("deckFilter");
    if (!host) return;
    let btn = host.querySelector('[data-pdf-meaning-filter="1"]');
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "filter-button";
      btn.dataset.pdfMeaningFilter = "1";
      btn.textContent = `PDF词义记忆 · ${deck.learnableCount}`;
      host.insertBefore(btn, host.querySelector('[data-deck="academic"]') || null);
      btn.addEventListener("click", (event) => {
        event.preventDefault();
        event.stopPropagation();
        const input = document.getElementById("librarySearch");
        if (!input) return;
        host.querySelectorAll(".filter-button").forEach((b) => b.classList.remove("active"));
        btn.classList.add("active");
        input.value = SEARCH_TOKEN;
        input.dispatchEvent(new Event("input", { bubbles: true }));
      });
    }
  }

  function bindFilterReset() {
    const host = document.getElementById("deckFilter");
    if (!host || host.dataset.pdfMeaningResetBound === "1") return;
    host.dataset.pdfMeaningResetBound = "1";
    host.addEventListener("click", (event) => {
      const btn = event.target.closest?.(".filter-button");
      if (!btn || btn.dataset.pdfMeaningFilter === "1") return;
      const input = document.getElementById("librarySearch");
      if (input?.value === SEARCH_TOKEN) input.value = "";
    }, true);
  }

  function decorateLibrary() {
    document.querySelectorAll("#libraryList .library-item").forEach((item) => {
      const word = byCard.get(item.dataset.card);
      if (!word) return;
      const detail = item.querySelector(".library-syn");
      if (detail) detail.textContent = `只记词义：${word.chinese}`;

      const top = item.querySelector(".library-item-top > div");
      if (top && !top.querySelector(".pdf-meaning-chip")) {
        const chip = document.createElement("span");
        chip.className = "level-chip pdf-meaning-chip";
        chip.textContent = "PDF词义";
        chip.style.marginLeft = "8px";
        top.appendChild(chip);
      }
    });
  }

  function decorateStudyCard() {
    const cardEl = document.querySelector("#studyCard .word-card[data-card]");
    if (!cardEl) return;
    const word = byCard.get(cardEl.dataset.card);
    if (!word) return;

    setText(cardEl.querySelector(".deck-badge"), `PDF词义记忆 · #${word.rank}`);
    setText(cardEl.querySelector(".word-pos"), "选择正确中文词义 · 不考同义替换");

    const answer = cardEl.querySelector("#answerZone");
    if (answer) {
      answer.innerHTML = `
        <div class="answer-row"><span class="answer-label">英文</span><span class="answer-value">${escapeHtml(word.word)}</span></div>
        <div class="answer-row"><span class="answer-label">中文词义</span><span class="answer-value">${escapeHtml(word.chinese)}</span></div>
        <div class="answer-row"><span class="answer-label">训练规则</span><span class="answer-value">只记词义，不进行同义替换训练</span></div>
        <div class="answer-row"><span class="answer-label">来源</span><span class="answer-value">${escapeHtml(word.sourceNote || "用户上传 PDF")}</span></div>`;
    }

    const result = cardEl.querySelector("#autoResult");
    if (result && !result.hidden) {
      result.querySelectorAll("p").forEach((p) => {
        if (p.textContent.includes("换方向继续考同一同义组")) {
          p.textContent = "这是当天强化，不算跨天复习；下一次仍考这个英文词的中文意思，并与前一次分开出现。";
        }
      });
    }
  }

  function updateSummary() {
    const count = document.getElementById("dataCountText");
    if (count) {
      const academic = DATA.counts?.academicUnique ?? 0;
      count.textContent = `376 个538主词 · PDF词义 ${deck.learnableCount} 词 · Academic ${academic} 词`;
    }

    const state = readState();
    const unseenMeaning = (deck.words || []).filter((w) => !state.cards?.[w.cardId]?.reps).length;
    const summary = document.getElementById("todaySummary");
    if (summary && unseenMeaning > 0 && summary.textContent.includes("538 已完成，新词进入 Academic")) {
      summary.textContent = summary.textContent.replace("538 已完成，新词进入 Academic", `538 同义替换完成，新词进入 PDF词义记忆（剩 ${unseenMeaning}）`);
    }

    const input = document.getElementById("dailyNewInput");
    const small = input?.closest(".setting-card")?.querySelector("small");
    if (small) small.textContent = "第1类 → 第2类 → 第3类 → PDF词义记忆 → Academic";
  }

  function ensureNotice() {
    const library = document.getElementById("view-library");
    const toolbar = library?.querySelector(".library-toolbar");
    if (!library || !toolbar || document.getElementById("pdfMeaningNotice")) return;

    const note = document.createElement("article");
    note.id = "pdfMeaningNotice";
    note.className = "algorithm-note";
    note.style.marginBottom = "16px";
    const missing = deck.missingMeaningCount || 0;
    note.innerHTML = `
      <h3>PDF词义记忆</h3>
      <p>这部分只训练 <strong>英文 → 中文词义</strong>，不使用任何同义替换。当前有 <strong>${deck.learnableCount}</strong> 个词可直接学习。${missing ? `另有 <strong>${missing}</strong> 个总表词目前没有被已上传资料提供可靠中文释义，因此只保留在核验清单中，不自动出题。` : ""}</p>`;
    const audit = document.getElementById("printedTotalAuditNotice");
    (audit || toolbar).insertAdjacentElement("afterend", note);
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  let pending = false;
  function refresh() {
    pending = false;
    ensureFilterButton();
    bindFilterReset();
    decorateLibrary();
    decorateStudyCard();
    updateSummary();
    ensureNotice();
  }

  function scheduleRefresh() {
    if (pending) return;
    pending = true;
    requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("storage", scheduleRefresh);
  document.addEventListener("click", () => setTimeout(scheduleRefresh, 0));

  refresh();
})();
