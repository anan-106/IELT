// Persist unfinished "wrong -> prove twice" reinforcement across reloads.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const MAIN_KEY = "ielt-memory-v3";
  const RECOVERY_KEY = "ielt-reinforcement-recovery-v1";
  const MIN_GAP = Math.max(3, Number(window.__IELT_SAME_DAY_SPACING__?.minGap || 3));
  const allWords = DATA.allWords || [];
  const wordById = new Map(allWords.map((w) => [w.cardId, w]));

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const attr = esc;
  const uniq = (items = []) => {
    const out = [];
    for (const item of items) {
      const text = String(item ?? "").trim();
      if (text && !out.some((x) => norm(x) === norm(text))) out.push(text);
    }
    return out;
  };
  const shuffle = (input) => {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  };

  function readJSON(key, fallback) {
    try { return JSON.parse(localStorage.getItem(key) || "null") || fallback; }
    catch { return fallback; }
  }
  function writeJSON(key, value) { localStorage.setItem(key, JSON.stringify(value)); }
  function mainState() { return readJSON(MAIN_KEY, { cards: {}, daily: {} }); }
  function recoveryState() {
    const s = readJSON(RECOVERY_KEY, { pending: {} });
    s.pending = s.pending || {};
    return s;
  }

  function scheduleSnapshot(card) {
    const c = card || {};
    return {
      reps: Number(c.reps || 0),
      reviewStage: Number.isInteger(c.reviewStage) ? c.reviewStage : -1,
      stability: Number(c.stability || 0),
      due: Number(c.due || 0),
      lastReview: Number(c.lastReview || 0),
      lastRating: Number(c.lastRating || 0)
    };
  }

  function restoreSchedule(card, snap) {
    if (!card || !snap) return;
    card.reps = snap.reps;
    card.reviewStage = snap.reviewStage;
    card.stability = snap.stability;
    card.due = snap.due;
    card.lastReview = snap.lastReview;
    card.lastRating = snap.lastRating;
  }

  function startOfTomorrow() {
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + 1);
    return d.getTime();
  }

  function pendingCount() {
    return Object.keys(recoveryState().pending).length;
  }

  function trackAnsweredOption(button) {
    const cardEl = button?.closest?.(".word-card[data-card]");
    if (!cardEl || cardEl.dataset.recoverySession === "1") return;
    const cardId = cardEl.dataset.card;
    if (!cardId || !wordById.has(cardId)) return;

    const wrong = button.classList.contains("wrong");
    const correct = button.classList.contains("correct") && !wrong;
    if (!wrong && !correct) return;

    const rs = recoveryState();
    const ms = mainState();
    ms.cards = ms.cards || {};
    const c = ms.cards[cardId] || {};
    const entry = rs.pending[cardId];

    if (wrong) {
      rs.pending[cardId] = {
        cardId,
        needed: 2,
        startedAt: entry?.startedAt || Date.now(),
        lastWrongAt: Date.now(),
        schedule: entry?.schedule || scheduleSnapshot(c)
      };
    } else if (entry) {
      entry.needed = Math.max(0, Number(entry.needed || 2) - 1);
      entry.lastCorrectAt = Date.now();
      if (entry.needed > 0) {
        // If a reload caused the core session to think the first proof was enough,
        // roll back only the cross-day schedule. Correct/wrong counters stay intact.
        restoreSchedule(c, entry.schedule);
        ms.cards[cardId] = c;
      } else {
        delete rs.pending[cardId];
      }
    }

    writeJSON(RECOVERY_KEY, rs);
    writeJSON(MAIN_KEY, ms);
    renderBanner();
  }

  document.addEventListener("click", (event) => {
    const option = event.target.closest?.("#studyCard .option");
    if (!option) return;
    setTimeout(() => trackAnsweredOption(option), 0);
  });

  function synonymCluster(word) {
    return uniq([word.word, ...(word.sourceSynonyms || word.quizSynonyms || word.synonyms || [])]);
  }

  function buildQuestion(word) {
    if (word.quizMode === "meaning") {
      const correct = word.chinese;
      const pool = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      return { prompt: word.word, correct, options: shuffle([correct, ...shuffle(pool).slice(0, 3)]), mode: "meaning", cluster: [word.word, word.chinese] };
    }

    const cluster = synonymCluster(word);
    if (cluster.length < 2) {
      const correct = word.chinese;
      const pool = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      return { prompt: word.word, correct, options: shuffle([correct, ...shuffle(pool).slice(0, 3)]), mode: "meaning", cluster };
    }

    const prompt = cluster[Math.floor(Math.random() * cluster.length)];
    const answers = cluster.filter((x) => norm(x) !== norm(prompt));
    const correct = answers[Math.floor(Math.random() * answers.length)];
    const current = new Set(cluster.map(norm));
    const distractors = uniq((DATA.allPrimaryWords || []).filter((w) => w.cardId !== word.cardId).flatMap(synonymCluster))
      .filter((x) => !current.has(norm(x)));
    return { prompt, correct, options: shuffle([correct, ...shuffle(distractors).slice(0, 3)]), mode: "synonym", cluster };
  }

  let session = null;

  function fillerPool(excludeCardId) {
    const ms = mainState();
    return allWords.filter((w) => w.cardId !== excludeCardId && Number(ms.cards?.[w.cardId]?.reps || 0) > 0);
  }

  function requeueWithGap(item) {
    const queue = session.queue;
    if (queue.length >= MIN_GAP) {
      queue.splice(MIN_GAP, 0, item);
      return;
    }
    const need = MIN_GAP - queue.length;
    const pool = shuffle(fillerPool(item.cardId));
    for (let i = 0; i < need && pool.length; i++) {
      const w = pool[i % pool.length];
      queue.push({ cardId: w.cardId, needed: 0, isFiller: true });
    }
    queue.splice(Math.min(MIN_GAP, queue.length), 0, item);
  }

  function startRecovery() {
    const rs = recoveryState();
    const items = Object.values(rs.pending).filter((x) => wordById.has(x.cardId));
    if (!items.length) return renderBanner();

    session = {
      queue: shuffle(items.map((x) => ({ cardId: x.cardId, needed: Math.max(1, Number(x.needed || 2)), isFiller: false }))),
      total: items.length,
      done: 0,
      attempts: 0
    };
    showTodayView();
    renderQuestion();
  }

  function showTodayView() {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === "view-today"));
    document.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === "today"));
  }

  function renderQuestion() {
    const root = document.getElementById("studyCard");
    if (!root || !session) return;
    if (!session.queue.length) return finishRecovery();

    const item = session.queue[0];
    const word = wordById.get(item.cardId);
    if (!word) {
      session.queue.shift();
      return renderQuestion();
    }
    const q = buildQuestion(word);

    root.innerHTML = `
      <div class="word-card" data-card="${attr(word.cardId)}" data-recovery-session="1">
        <div class="word-card-head">
          <span class="deck-badge">${item.isFiller ? "恢复强化·间隔题" : "恢复未完成强化"}</span>
          <span class="memory-badge">${item.isFiller ? "不计通过数" : `还需答对 ${item.needed} 次`}</span>
        </div>
        <div class="word-main">
          <h3 class="word-title">${esc(q.prompt)}</h3>
          <div class="word-pos">${q.mode === "meaning" ? "选择正确中文词义" : "选择可互相替换的表达"}</div>
          <div class="options">${q.options.map((o) => `<button class="option" data-option="${attr(o)}">${esc(o)}</button>`).join("")}</div>
        </div>
        <div class="answer-zone" id="recoveryAnswer" hidden></div>
        <div id="recoveryResult" hidden></div>
      </div>`;

    document.querySelectorAll("#studyCard .option").forEach((btn) => {
      btn.onclick = () => handleAnswer(btn, item, word, q);
    });
  }

  function handleAnswer(btn, item, word, q) {
    if (btn.disabled) return;
    const picked = btn.dataset.option;
    const ok = norm(picked) === norm(q.correct);
    session.attempts++;

    document.querySelectorAll("#studyCard .option").forEach((b) => {
      b.disabled = true;
      if (norm(b.dataset.option) === norm(q.correct)) b.classList.add("correct");
      if (b === btn && !ok) b.classList.add("wrong");
    });

    let retry = false;
    let passed = false;
    if (item.isFiller) {
      passed = true;
    } else if (!ok) {
      item.needed = 2;
      retry = true;
      const ms = mainState();
      ms.cards = ms.cards || {};
      const c = ms.cards[item.cardId] || {};
      c.wrong = Number(c.wrong || 0) + 1;
      c.lapses = Number(c.lapses || 0) + 1;
      ms.cards[item.cardId] = c;
      writeJSON(MAIN_KEY, ms);
      const rs = recoveryState();
      const old = rs.pending[item.cardId] || {};
      rs.pending[item.cardId] = { ...old, cardId: item.cardId, needed: 2, lastWrongAt: Date.now(), schedule: old.schedule || scheduleSnapshot(c) };
      writeJSON(RECOVERY_KEY, rs);
    } else {
      item.needed = Math.max(0, item.needed - 1);
      retry = item.needed > 0;
      passed = !retry;
      const rs = recoveryState();
      if (rs.pending[item.cardId]) {
        rs.pending[item.cardId].needed = item.needed;
        rs.pending[item.cardId].lastCorrectAt = Date.now();
        if (!retry) delete rs.pending[item.cardId];
        writeJSON(RECOVERY_KEY, rs);
      }
    }

    if (passed && !item.isFiller) {
      const ms = mainState();
      ms.cards = ms.cards || {};
      const c = ms.cards[item.cardId] || {};
      c.reps = Math.max(1, Number(c.reps || 0) + 1);
      c.reviewStage = 0;
      c.stability = 1;
      c.lastReview = Date.now();
      c.lastRating = 2;
      c.due = startOfTomorrow();
      c.correct = Number(c.correct || 0) + 1;
      ms.cards[item.cardId] = c;
      writeJSON(MAIN_KEY, ms);
    }

    const answer = document.getElementById("recoveryAnswer");
    answer.hidden = false;
    answer.innerHTML = q.mode === "meaning"
      ? `<div class="answer-row"><span class="answer-label">正确答案</span><span class="answer-value">${esc(q.prompt)} → ${esc(q.correct)}</span></div>`
      : `<div class="answer-row"><span class="answer-label">正确替换</span><span class="answer-value">${esc(q.prompt)} ↔ ${esc(q.correct)}</span></div>`;

    const result = document.getElementById("recoveryResult");
    result.hidden = false;
    const detail = item.isFiller
      ? "间隔题完成。"
      : !ok
        ? `答错：重新需要答对 2 次，每次至少隔 ${MIN_GAP} 道其它题。`
        : retry
          ? `答对：还需再答对 ${item.needed} 次。`
          : "本词恢复强化完成；跨天复习从明天重新开始。";
    result.innerHTML = `<div class="complete-banner" style="padding:14px 0 0"><p style="margin-bottom:10px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? "回答正确" : "回答错误"}</p><p style="margin-bottom:12px;color:var(--sub);font-size:.82rem">${esc(detail)}</p><button class="button button-primary" id="recoveryContinue">下一题</button></div>`;

    document.getElementById("recoveryContinue").onclick = () => {
      session.queue.shift();
      if (item.isFiller) {
        // no-op
      } else if (retry) {
        requeueWithGap(item);
      } else if (passed) {
        session.done++;
      }
      renderQuestion();
    };
  }

  function finishRecovery() {
    const root = document.getElementById("studyCard");
    root.innerHTML = `<div class="empty-state"><div class="empty-icon">✓</div><h3>未完成强化已恢复</h3><p>需要补做的错词已经全部重新证明；现在可以继续今日正常学习。</p><button class="button button-primary" id="resumeNormalStudy">继续今日学习</button></div>`;
    session = null;
    document.getElementById("resumeNormalStudy").onclick = () => document.getElementById("startSessionBtn")?.click();
    renderBanner();
  }

  function ensureBannerHost() {
    let host = document.getElementById("recoveryBannerHost");
    if (host) return host;
    const today = document.getElementById("view-today");
    const toolbar = today?.querySelector(".session-toolbar");
    if (!today || !toolbar) return null;
    host = document.createElement("div");
    host.id = "recoveryBannerHost";
    toolbar.insertAdjacentElement("afterend", host);
    return host;
  }

  function renderBanner() {
    const host = ensureBannerHost();
    if (!host) return;
    const n = pendingCount();
    if (!n) {
      host.innerHTML = "";
      return;
    }
    host.innerHTML = `<div class="algorithm-note" style="margin-bottom:12px;border-color:#e6c7a8;background:#fffaf3"><strong>有 ${n} 个错词强化尚未完成</strong><p style="margin-top:5px">即使刷新或关闭页面，也不会丢掉“还需答对2次”的要求。</p><button class="button button-primary" id="startRecoveryBtn" style="margin-top:10px">先恢复未完成强化</button></div>`;
    document.getElementById("startRecoveryBtn").onclick = startRecovery;
  }

  // Enforce recovery before starting a fresh daily session.
  document.addEventListener("click", (event) => {
    const start = event.target.closest?.("#startSessionBtn, #inlineStart");
    if (!start || !pendingCount() || session) return;
    event.preventDefault();
    event.stopImmediatePropagation();
    startRecovery();
  }, true);

  document.addEventListener("keydown", (event) => {
    if (event.key !== "Enter") return;
    const btn = document.getElementById("recoveryContinue");
    if (btn && btn.offsetParent !== null) {
      event.preventDefault();
      btn.click();
    }
  });

  renderBanner();
  window.addEventListener("storage", renderBanner);
  window.__IELT_RECOVERY__ = { pendingCount, startRecovery };
})();
