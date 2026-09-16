// Personal adaptive layer: response-time analytics + confusion matrix + adaptive distractors.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-adaptive-v1";
  const allWords = DATA.allWords || [];
  const wordById = new Map(allWords.map((w) => [w.cardId, w]));

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const uniq = (items = []) => {
    const out = [];
    for (const item of items) {
      const text = String(item ?? "").trim();
      if (text && !out.some((x) => norm(x) === norm(text))) out.push(text);
    }
    return out;
  };

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

  function stateShape() {
    const state = readState();
    state.cards = state.cards || {};
    state.globalRt = Array.isArray(state.globalRt) ? state.globalRt.slice(-100) : [];
    return state;
  }

  function synonymCluster(word) {
    return uniq([word.word, ...(word.sourceSynonyms || word.quizSynonyms || word.synonyms || [])]);
  }

  const optionCatalog = new Set();
  for (const w of DATA.allPrimaryWords || []) synonymCluster(w).forEach((x) => optionCatalog.add(norm(x)));

  let currentToken = "";
  let shownAt = 0;

  function median(values) {
    const a = values.filter(Number.isFinite).sort((x, y) => x - y);
    if (!a.length) return 0;
    const mid = Math.floor(a.length / 2);
    return a.length % 2 ? a[mid] : (a[mid - 1] + a[mid]) / 2;
  }

  function currentQuestion() {
    const cardEl = document.querySelector("#studyCard .word-card[data-card]");
    if (!cardEl || cardEl.offsetParent === null) return null;
    const prompt = cardEl.querySelector(".word-title")?.textContent?.trim() || "";
    const options = [...cardEl.querySelectorAll(".option[data-option]")].filter((b) => !b.disabled);
    if (!prompt || !options.length) return null;
    const token = `${cardEl.dataset.card}|${prompt}|${options.map((b) => b.dataset.option).join("|")}`;
    return { cardEl, cardId: cardEl.dataset.card, prompt, options, token };
  }

  function markQuestionStart() {
    const q = currentQuestion();
    if (!q || q.token === currentToken) return;
    currentToken = q.token;
    shownAt = performance.now();
    personalizeDistractors(q);
  }

  function cardAdaptive(state, cardId) {
    state.cards[cardId] = state.cards[cardId] || { confusions: {}, rtRecent: [], correct: 0, wrong: 0, slowCorrect: 0 };
    const c = state.cards[cardId];
    c.confusions = c.confusions || {};
    c.rtRecent = Array.isArray(c.rtRecent) ? c.rtRecent.slice(-30) : [];
    return c;
  }

  function recordAttempt(button) {
    const cardEl = button?.closest?.(".word-card[data-card]");
    if (!cardEl || button.dataset.adaptiveRecorded === "1") return;
    button.dataset.adaptiveRecorded = "1";

    const cardId = cardEl.dataset.card;
    const picked = button.dataset.option || "";
    const isWrong = button.classList.contains("wrong");
    const isCorrect = button.classList.contains("correct") && !isWrong;
    if (!isWrong && !isCorrect) return;

    const rt = Math.max(0, Math.round(performance.now() - shownAt));
    const state = stateShape();
    const c = cardAdaptive(state, cardId);
    const priorMedian = median(state.globalRt);
    const slowThreshold = Math.max(6000, priorMedian ? priorMedian * 2 : 6000);

    if (rt >= 150 && rt <= 120000) {
      c.rtRecent.push(rt);
      c.rtRecent = c.rtRecent.slice(-30);
      state.globalRt.push(rt);
      state.globalRt = state.globalRt.slice(-100);
      c.lastRt = rt;
    }

    if (isWrong) {
      c.wrong = Number(c.wrong || 0) + 1;
      const k = norm(picked);
      if (k) c.confusions[k] = Number(c.confusions[k] || 0) + 1;
    } else {
      c.correct = Number(c.correct || 0) + 1;
      if (rt > slowThreshold) c.slowCorrect = Number(c.slowCorrect || 0) + 1;
    }

    c.updatedAt = Date.now();
    writeState(state);
    renderAdaptiveStats();
  }

  function personalizedCandidates(cardId, forbidden) {
    const state = stateShape();
    const c = state.cards?.[cardId];
    if (!c?.confusions) return [];
    return Object.entries(c.confusions)
      .filter(([term]) => optionCatalog.has(norm(term)) && !forbidden.has(norm(term)))
      .sort((a, b) => b[1] - a[1])
      .map(([term]) => term);
  }

  function personalizeDistractors(q) {
    const word = wordById.get(q.cardId);
    if (!word || word.quizMode === "meaning" || word.deckId !== "reading538") return;

    const cluster = synonymCluster(word);
    const clusterSet = new Set(cluster.map(norm));
    const correctButtons = q.options.filter((b) => clusterSet.has(norm(b.dataset.option)) && norm(b.dataset.option) !== norm(q.prompt));
    if (correctButtons.length !== 1) return;

    const correct = correctButtons[0];
    const forbidden = new Set([...clusterSet, norm(correct.dataset.option), norm(q.prompt)]);
    const candidates = personalizedCandidates(q.cardId, forbidden);
    if (!candidates.length) return;

    const wrongButtons = q.options.filter((b) => b !== correct);
    const used = new Set(q.options.map((b) => norm(b.dataset.option)));
    let changed = 0;
    for (const btn of wrongButtons) {
      const candidate = candidates.find((term) => !used.has(norm(term)));
      if (!candidate) continue;
      used.delete(norm(btn.dataset.option));
      btn.dataset.option = candidate;
      btn.textContent = candidate;
      used.add(norm(candidate));
      changed++;
    }

    if (changed) {
      q.cardEl.dataset.adaptiveDistractors = String(changed);
      const badge = q.cardEl.querySelector(".memory-badge");
      if (badge && !badge.textContent.includes("个人化干扰")) badge.textContent += " · 个人化干扰";
    }
  }

  function topConfusions(limit = 6) {
    const state = stateShape();
    const rows = [];
    for (const [cardId, c] of Object.entries(state.cards || {})) {
      const word = wordById.get(cardId);
      if (!word) continue;
      for (const [picked, count] of Object.entries(c.confusions || {})) {
        rows.push({ word: word.word, picked, count });
      }
    }
    return rows.sort((a, b) => b.count - a.count).slice(0, limit);
  }

  function renderAdaptiveStats() {
    const view = document.getElementById("view-stats");
    if (!view) return;
    let panel = document.getElementById("adaptiveStatsPanel");
    if (!panel) {
      panel = document.createElement("article");
      panel.id = "adaptiveStatsPanel";
      panel.className = "activity-panel";
      view.appendChild(panel);
    }

    const state = stateShape();
    const globalMedian = median(state.globalRt);
    const totalSlow = Object.values(state.cards || {}).reduce((sum, c) => sum + Number(c.slowCorrect || 0), 0);
    const confusions = topConfusions();
    panel.innerHTML = `
      <div class="panel-heading"><div><h3>个性化学习信号</h3><p>反应时间只作辅助，不改变“对/错”判定；历史误选会优先成为之后的干扰项。</p></div></div>
      <div class="stats-grid" style="margin:10px 0 14px">
        <article class="stat-panel"><span>近期中位反应</span><strong>${globalMedian ? `${(globalMedian / 1000).toFixed(1)}s` : "—"}</strong></article>
        <article class="stat-panel"><span>慢速答对</span><strong>${totalSlow}</strong></article>
        <article class="stat-panel"><span>混淆对</span><strong>${confusions.length}</strong></article>
        <article class="stat-panel"><span>自适应干扰</span><strong>ON</strong></article>
      </div>
      ${confusions.length ? `<div class="weak-list">${confusions.map((x) => `<div class="weak-row"><div><strong>${x.word}</strong><small>曾误选 ${x.picked}</small></div><span class="weak-score">${x.count}</span></div>`).join("")}</div>` : `<p style="color:var(--muted)">积累一些答题记录后，这里会显示你最常混淆的词。</p>`}`;
  }

  document.addEventListener("click", (event) => {
    const option = event.target.closest?.("#studyCard .option");
    if (!option) return;
    setTimeout(() => recordAttempt(option), 0);
  });

  const root = document.getElementById("studyCard");
  if (root) {
    new MutationObserver(() => requestAnimationFrame(markQuestionStart)).observe(root, { childList: true, subtree: true });
  }

  document.addEventListener("click", () => setTimeout(markQuestionStart, 0));
  window.addEventListener("storage", renderAdaptiveStats);
  markQuestionStart();
  renderAdaptiveStats();

  window.__IELT_ADAPTIVE__ = { topConfusions, state: stateShape };
})();
