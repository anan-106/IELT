// Persistent wrong-word notebook + one-click daily review.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";
  const META_KEY = "ielt-wrongbook-meta-v1";
  const HISTORY_KEY = "ielt-wrongbook-history-v1";
  const MIN_GAP = Math.max(3, Number(window.__IELT_SAME_DAY_SPACING__?.minGap || 3));
  const allWords = DATA.allWords || [];
  const coreWords = DATA.allPrimaryWords || [];
  const wordById = new Map(allWords.map((w) => [w.cardId, w]));

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const attr = esc;
  const shuffle = (input) => {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };
  const uniq = (items = []) => {
    const out = [];
    for (const item of items) {
      const text = String(item ?? "").trim();
      if (text && !out.some((x) => norm(x) === norm(text))) out.push(text);
    }
    return out;
  };

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
    catch { return fallback; }
  }
  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function readState() { return readJSON(STORAGE_KEY, { cards: {} }); }
  function writeState(state) { writeJSON(STORAGE_KEY, state); }
  function readMeta() { return readJSON(META_KEY, {}); }
  function writeMeta(meta) { writeJSON(META_KEY, meta); }
  function readHistory() { return readJSON(HISTORY_KEY, {}); }
  function writeHistory(history) { writeJSON(HISTORY_KEY, history); }

  function synonymCluster(word) {
    return uniq([word.word, ...(word.sourceSynonyms || word.quizSynonyms || word.synonyms || [])]);
  }

  function wrongWords() {
    const state = readState();
    const meta = readMeta();
    return allWords
      .filter((w) => Number(state.cards?.[w.cardId]?.wrong || 0) > 0)
      .map((w) => ({ w, c: state.cards[w.cardId], m: meta[w.cardId] || {} }))
      .sort((a, b) =>
        (b.c.wrong || 0) - (a.c.wrong || 0) ||
        (b.c.lapses || 0) - (a.c.lapses || 0) ||
        (b.m.lastWrongAt || 0) - (a.m.lastWrongAt || 0)
      );
  }

  function recordWrongFromButton(button) {
    if (!button?.classList?.contains("wrong")) return;
    const cardEl = button.closest?.(".word-card[data-card]");
    const cardId = cardEl?.dataset?.card;
    if (!cardId || !wordById.has(cardId)) return;
    const meta = readMeta();
    const old = meta[cardId] || {};
    meta[cardId] = {
      ...old,
      lastWrongAt: Date.now(),
      lastPicked: button.dataset.option || button.textContent.trim(),
      seenWrongCount: Number(old.seenWrongCount || 0) + 1
    };
    writeMeta(meta);
    refreshWrongBook();
  }

  document.addEventListener("click", (event) => {
    const option = event.target.closest?.("#studyCard .option");
    if (!option) return;
    setTimeout(() => recordWrongFromButton(option), 0);
  });

  function buildQuestion(word) {
    if (word.quizMode === "meaning") {
      const correct = word.chinese;
      const pool = uniq(allWords
        .filter((w) => w.cardId !== word.cardId && w.chinese && w.quizMode === "meaning")
        .map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      const fallback = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      const distractors = shuffle(pool).slice(0, 3);
      if (distractors.length < 3) {
        distractors.push(...shuffle(fallback.filter((x) => !distractors.some((d) => norm(d) === norm(x)))).slice(0, 3 - distractors.length));
      }
      return { prompt: word.word, correct, options: shuffle([correct, ...distractors]), cluster: [word.word, word.chinese], mode: "meaning" };
    }

    const cluster = synonymCluster(word);
    if (cluster.length < 2) {
      const correct = word.chinese;
      const pool = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      return { prompt: word.word, correct, options: shuffle([correct, ...shuffle(pool).slice(0, 3)]), cluster, mode: "meaning" };
    }

    const prompt = cluster[Math.floor(Math.random() * cluster.length)];
    const answers = cluster.filter((x) => norm(x) !== norm(prompt));
    const correct = answers[Math.floor(Math.random() * answers.length)];
    const current = new Set(cluster.map(norm));
    const distractors = uniq(coreWords.filter((w) => w.cardId !== word.cardId).flatMap(synonymCluster))
      .filter((x) => !current.has(norm(x)));
    return { prompt, correct, options: shuffle([correct, ...shuffle(distractors).slice(0, 3)]), cluster, mode: "synonym" };
  }

  let wbSession = null;

  function fillerPool(excludeCardId) {
    const state = readState();
    return allWords.filter((w) => w.cardId !== excludeCardId && state.cards?.[w.cardId]?.reps > 0);
  }

  function requeueWithGap(item) {
    const queue = wbSession.queue;
    if (queue.length >= MIN_GAP) {
      queue.splice(MIN_GAP, 0, item);
      return;
    }
    const need = MIN_GAP - queue.length;
    const pool = shuffle(fillerPool(item.cardId));
    const fillers = [];
    if (pool.length) {
      for (let i = 0; i < need; i++) {
        const w = pool[i % pool.length];
        fillers.push({ cardId: w.cardId, correctsNeeded: 0, isFiller: true });
      }
    }
    queue.push(...fillers);
    queue.splice(Math.min(MIN_GAP, queue.length), 0, item);
  }

  function startWrongBookReview() {
    const entries = wrongWords();
    if (!entries.length) return;
    wbSession = {
      queue: shuffle(entries.map(({ w }) => ({ cardId: w.cardId, correctsNeeded: 0, isFiller: false }))),
      total: entries.length,
      passed: 0,
      attempts: 0,
      correct: 0,
      wrong: 0,
      startedAt: Date.now()
    };
    showStudyView();
    renderWrongQuestion();
  }

  function showStudyView() {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-today"));
    document.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === "today"));
    document.getElementById("studyCard")?.scrollIntoView({ behavior: "smooth", block: "start" });
  }

  function renderWrongQuestion() {
    const root = document.getElementById("studyCard");
    if (!root || !wbSession) return;
    if (!wbSession.queue.length) return finishWrongBookReview();

    const item = wbSession.queue[0];
    const word = wordById.get(item.cardId);
    if (!word) {
      wbSession.queue.shift();
      return renderWrongQuestion();
    }
    const q = buildQuestion(word);

    root.innerHTML = `
      <div class="word-card" data-card="${attr(word.cardId)}">
        <div class="word-card-head">
          <span class="deck-badge">${item.isFiller ? "错词本·间隔题" : "错词本·每日复习"}</span>
          <span class="memory-badge">${item.correctsNeeded > 0 ? `还需答对 ${item.correctsNeeded} 次` : `通过 ${wbSession.passed} / ${wbSession.total}`}</span>
        </div>
        <div class="word-main">
          <h3 class="word-title">${esc(q.prompt)}</h3>
          <div class="word-pos">${q.mode === "meaning" ? "选择正确中文词义" : "选择可互相替换的表达"}</div>
          <div class="word-actions"><button class="icon-button" id="wrongBookSpeakBtn" title="发音">🔊</button></div>
          <div class="options" id="wrongBookOptions">${q.options.map((o) => `<button class="option" data-option="${attr(o)}">${esc(o)}</button>`).join("")}</div>
        </div>
        <div class="answer-zone" id="wrongBookAnswer" hidden></div>
        <div id="wrongBookResult" hidden></div>
      </div>`;

    document.getElementById("wrongBookSpeakBtn").onclick = () => {
      const api = window.__IELT_PRONUNCIATION__;
      if (api?.speakBritish) api.speakBritish(q.prompt, { force: true });
    };

    document.querySelectorAll("#wrongBookOptions .option").forEach((btn) => {
      btn.onclick = () => handleWrongBookAnswer(btn, item, word, q);
    });
  }

  function handleWrongBookAnswer(btn, item, word, q) {
    const picked = btn.dataset.option;
    const ok = norm(picked) === norm(q.correct);
    wbSession.attempts++;
    if (ok) wbSession.correct++; else wbSession.wrong++;

    document.querySelectorAll("#wrongBookOptions .option").forEach((b) => {
      b.disabled = true;
      if (norm(b.dataset.option) === norm(q.correct)) b.classList.add("correct");
      if (b === btn && !ok) b.classList.add("wrong");
    });

    let retry = false;
    let passed = false;
    if (item.isFiller) {
      passed = true;
    } else if (!ok) {
      item.correctsNeeded = 2;
      retry = true;
      const state = readState();
      state.cards = state.cards || {};
      const c = state.cards[item.cardId] || {};
      c.wrong = Number(c.wrong || 0) + 1;
      c.lapses = Number(c.lapses || 0) + 1;
      state.cards[item.cardId] = c;
      writeState(state);
    } else if (item.correctsNeeded > 0) {
      item.correctsNeeded--;
      retry = item.correctsNeeded > 0;
      passed = !retry;
    } else {
      passed = true;
    }

    const answer = document.getElementById("wrongBookAnswer");
    answer.hidden = false;
    answer.innerHTML = q.mode === "meaning"
      ? `<div class="answer-row"><span class="answer-label">正确答案</span><span class="answer-value">${esc(q.prompt)} → ${esc(q.correct)}</span></div>`
      : `<div class="answer-row"><span class="answer-label">正确替换</span><span class="answer-value">${esc(q.prompt)} ↔ ${esc(q.correct)}</span></div><div class="answer-row"><span class="answer-label">同义组</span><span class="answer-value">${q.cluster.map(esc).join(" · ")}</span></div>`;

    const result = document.getElementById("wrongBookResult");
    result.hidden = false;
    const detail = item.isFiller
      ? "间隔题完成，不计入错词本通过数。"
      : !ok
        ? `答错：本轮后续必须再答对 2 次，每次至少隔 ${MIN_GAP} 道其它题。`
        : retry
          ? `答对：还需再答对 ${item.correctsNeeded} 次，下一次仍会分开出现。`
          : "本词今日错词本复习通过。";
    result.innerHTML = `<div class="complete-banner" style="padding:14px 0 0"><p style="margin-bottom:10px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? "回答正确" : "回答错误"}</p><p style="margin-bottom:12px;color:var(--sub);font-size:.82rem">${esc(detail)}</p><button class="button button-primary" id="wrongBookContinue">下一题</button></div>`;

    document.getElementById("wrongBookContinue").onclick = () => {
      wbSession.queue.shift();
      if (item.isFiller) {
        // no-op
      } else if (retry) {
        requeueWithGap(item);
      } else if (passed) {
        wbSession.passed++;
      }
      renderWrongQuestion();
    };
  }

  function finishWrongBookReview() {
    const endedAt = Date.now();
    const history = readHistory();
    history[dateKey()] = {
      completedAt: endedAt,
      total: wbSession.total,
      attempts: wbSession.attempts,
      correct: wbSession.correct,
      wrong: wbSession.wrong
    };
    writeHistory(history);

    const root = document.getElementById("studyCard");
    const accuracy = wbSession.attempts ? Math.round(wbSession.correct / wbSession.attempts * 100) : 0;
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><h3>今日错词本复习完成</h3><p>复习 ${wbSession.total} 个错词 · 作答 ${wbSession.attempts} 次 · 正确率 ${accuracy}%</p><button class="button button-ghost" id="backWrongBookBtn">返回错词本</button></div>`;
    document.getElementById("backWrongBookBtn").onclick = openWrongBook;
    wbSession = null;
    refreshWrongBook();
  }

  function ensureUI() {
    const nav = document.querySelector(".nav-tabs");
    if (!nav) return;
    if (!document.getElementById("wrongBookTab")) {
      const btn = document.createElement("button");
      btn.id = "wrongBookTab";
      btn.className = "nav-tab";
      btn.dataset.view = "wrongbook";
      btn.textContent = "错词本";
      nav.insertBefore(btn, nav.querySelector('[data-view="stats"]') || null);
      btn.onclick = openWrongBook;
    }

    if (!document.getElementById("view-wrongbook")) {
      const section = document.createElement("section");
      section.className = "view";
      section.id = "view-wrongbook";
      section.innerHTML = `
        <div class="session-toolbar">
          <div><div class="section-kicker">WRONG WORD NOTEBOOK</div><h2>错词本</h2><p id="wrongBookSummary">自动收集所有答错过的词。</p></div>
          <div><button class="button button-primary" id="startWrongBookReviewBtn">开始今日错词复习</button></div>
        </div>
        <div class="stats-grid" id="wrongBookStats"></div>
        <div class="library-list" id="wrongBookList"></div>`;
      document.getElementById("view-settings")?.insertAdjacentElement("beforebegin", section);
      document.getElementById("startWrongBookReviewBtn").onclick = startWrongBookReview;
    }
  }

  function openWrongBook() {
    ensureUI();
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-wrongbook"));
    document.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === "wrongbook"));
    refreshWrongBook();
  }

  function refreshWrongBook() {
    ensureUI();
    const entries = wrongWords();
    const history = readHistory();
    const todayRecord = history[dateKey()];
    const totalWrong = entries.reduce((sum, x) => sum + Number(x.c.wrong || 0), 0);
    const weak = entries.filter((x) => Number(x.c.wrong || 0) >= 2).length;

    const tab = document.getElementById("wrongBookTab");
    if (tab) tab.textContent = `错词本${entries.length ? ` ${entries.length}` : ""}`;

    const summary = document.getElementById("wrongBookSummary");
    if (summary) summary.textContent = todayRecord
      ? `今日已完成错词本复习：${todayRecord.total} 个词，${todayRecord.attempts} 次作答。仍可再次复习。`
      : `当前 ${entries.length} 个错词；每天都可以单独复习一次或多次。`;

    const stats = document.getElementById("wrongBookStats");
    if (stats) stats.innerHTML = `
      <article class="stat-panel"><span>错词数量</span><strong>${entries.length}</strong></article>
      <article class="stat-panel"><span>累计错误</span><strong>${totalWrong}</strong></article>
      <article class="stat-panel"><span>重复错 ≥2次</span><strong>${weak}</strong></article>
      <article class="stat-panel"><span>今日错词复习</span><strong>${todayRecord ? "已完成" : "未完成"}</strong></article>`;

    const start = document.getElementById("startWrongBookReviewBtn");
    if (start) {
      start.disabled = !entries.length;
      start.textContent = entries.length ? `开始今日错词复习 · ${entries.length}` : "暂无错词";
    }

    const list = document.getElementById("wrongBookList");
    if (list) {
      list.innerHTML = entries.length ? entries.map(({ w, c, m }) => `
        <article class="library-item" data-card="${attr(w.cardId)}">
          <div class="library-item-top"><div><span class="library-word">${esc(w.word)}</span><span class="library-pos">${esc(w.deckName || "")}</span></div><span class="memory-badge">错 ${c.wrong || 0} 次</span></div>
          <div class="library-cn">${esc(w.chinese || "同义替换题")}</div>
          <div class="library-syn">${w.quizMode === "meaning" ? "词义题" : `同义组：${synonymCluster(w).slice(0, 5).map(esc).join(" · ")}`} ${m.lastWrongAt ? `· 最近错于 ${new Date(m.lastWrongAt).toLocaleDateString()}` : ""}</div>
        </article>`).join("") : '<div class="empty-state" style="min-height:240px"><div class="empty-icon">✓</div><h3>目前没有错词</h3><p>后续答错的词会自动出现在这里。</p></div>';
    }
  }

  ensureUI();
  refreshWrongBook();
  window.addEventListener("storage", refreshWrongBook);
  document.addEventListener("click", () => setTimeout(refreshWrongBook, 0));
})();
