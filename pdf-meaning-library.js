// Robust library renderer for the 488 meaning deck.
// This bypasses the main app's legacy deck filter so the Word-extracted vocabulary
// is always visible in the library even if app.js does not know this newer deck id.
(() => {
  "use strict";
  const DATA = window.__IELT_DATA_V2__;
  const deck = DATA?.pdfMeaningDeck;
  if (!DATA || !deck) return;

  let active = false;
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function ensureButton() {
    const host = document.getElementById("deckFilter");
    if (!host) return;
    let btn = host.querySelector('[data-word488-filter="1"]');
    if (!btn) {
      btn = document.createElement("button");
      btn.className = "filter-button";
      btn.dataset.word488Filter = "1";
      btn.textContent = `488总表 · 词义记忆 · ${deck.words.length}`;
      host.insertBefore(btn, host.querySelector('[data-deck="academic"]') || null);
      btn.onclick = (e) => {
        e.preventDefault();
        e.stopPropagation();
        active = true;
        host.querySelectorAll(".filter-button").forEach((x) => x.classList.toggle("active", x === btn));
        const input = document.getElementById("librarySearch");
        if (input) input.value = "";
        render();
      };
    } else {
      btn.textContent = `488总表 · 词义记忆 · ${deck.words.length}`;
    }

    host.querySelectorAll('.filter-button:not([data-word488-filter="1"])').forEach((b) => {
      if (b.dataset.word488Bound === "1") return;
      b.dataset.word488Bound = "1";
      b.addEventListener("click", () => { active = false; });
    });
  }

  function render() {
    if (!active) return;
    const root = document.getElementById("libraryList");
    const input = document.getElementById("librarySearch");
    if (!root) return;
    const q = String(input?.value || "").trim().toLowerCase();
    const rows = (deck.words || []).filter((w) => !q || w.word.toLowerCase().includes(q) || String(w.chinese || "").includes(q));
    root.innerHTML = rows.length ? rows.map((w) => `
      <article class="library-item" data-card="${esc(w.cardId)}">
        <div class="library-item-top">
          <div><span class="library-word">${esc(w.word)}</span><span class="level-chip pdf-meaning-chip" style="margin-left:8px">488词义</span></div>
          <span class="memory-badge">英文→中文</span>
        </div>
        <div class="library-cn">${esc(w.chinese)}</div>
        <div class="library-syn">只记词义 · 不做同义替换</div>
      </article>`).join("") : '<div class="empty-state" style="min-height:220px"><p>没有匹配的 488 总表词。</p></div>';
  }

  const search = document.getElementById("librarySearch");
  search?.addEventListener("input", () => { if (active) setTimeout(render, 0); });

  const observer = new MutationObserver(() => {
    requestAnimationFrame(() => {
      ensureButton();
      if (active) render();
    });
  });
  observer.observe(document.body, { childList: true, subtree: true });
  ensureButton();
})();
