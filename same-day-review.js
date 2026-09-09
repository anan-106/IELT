// Optional same-day review after today's learning.
// This layer never advances or delays the cross-day Ebbinghaus schedule.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";
  const REVIEW_KEY_PREFIX = "ielt-same-day-review-v1:";
  const MIN_GAP = Math.max(3, Number(window.__IELT_SAME_DAY_SPACING__?.minGap || 3));
  const wordById = new Map((DATA.allWords || []).map((w) => [w.cardId, w]));
  const allWords = DATA.allWords || [];
  const coreWords = DATA.allPrimaryWords || [];

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
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
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  const attr = esc;

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
  }

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { cards: {} };
    } catch {
      return { cards: {} };
    }
  }

  function todayNewWords() {
    const state = readState();
    const today = dateKey();
    return allWords.filter((w) => {
      const c = state.cards?.[w.cardId];
      return c?.reps === 1 && c.lastReview && dateKey(c.lastReview) === today;
    });
  }

  function learnedFillerPool(excludeCardId) {
    const state = readState();
    return allWords.filter((w) => w.cardId !== excludeCardId && state.cards?.[w.cardId]?.reps > 0);
  }

  function readReviewHistory() {
    try {
      const raw = localStorage.getItem(REVIEW_KEY_PREFIX + dateKey());
      return raw ? JSON.parse(raw) : { rounds: [], seenPrompts: {} };
    } catch {
      return { rounds: [], seenPrompts: {} };
    }
  }

  function writeReviewHistory(history) {
    localStorage.setItem(REVIEW_KEY_PREFIX + dateKey(), JSON.stringify(history));
  }

  function synonymCluster(word) {
    return uniq([word.word, ...(word.sourceSynonyms || word.quizSynonyms || word.synonyms || [])]);
  }

  function buildQuestion(word, seenPrompts = []) {
    if (word.quizMode === "meaning") {
      const correct = word.chinese;
      const pool = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      return {
        prompt: word.word,
        correct,
        options: shuffle([correct, ...shuffle(pool).slice(0, 3)]),
        cluster: [word.word, word.chinese]
      };
    }

    const cluster = synonymCluster(word);
    if (cluster.length < 2) {
      const correct = word.chinese;
      const pool = uniq(allWords.filter((w) => w.cardId !== word.cardId && w.chinese).map((w) => w.chinese))
        .filter((x) => norm(x) !== norm(correct));
      return { prompt: word.word, correct, options: shuffle([correct, ...shuffle(pool).slice(0, 3)]), cluster };
    }

    const seen = new Set((seenPrompts || []).map(norm));
    let promptPool = cluster.filter((x) => !seen.has(norm(x)));
    if (!promptPool.length) promptPool = cluster;
    const prompt = promptPool[Math.floor(Math.random() * promptPool.length)];
    const answerPool = cluster.filter((x) => norm(x) !== norm(prompt));
    const correct = answerPool[Math.floor(Math.random() * answerPool.length)];
    const current = new Set(cluster.map(norm));
    const distractorPool = uniq(coreWords.filter((w) => w.cardId !== word.cardId).flatMap(synonymCluster))
      .filter((x) => !current.has(norm(x)));
    return { prompt, correct, options: shuffle([correct, ...shuffle(distractorPool).slice(0, 3)]), cluster };
  }

  function injectStyles() {
    if (document.getElementById("sameDayReviewStyle")) return;
    const style = document.createElement("style");
    style.id = "sameDayReviewStyle";
    style.textContent = `
      .same-day-review-box{margin-top:18px;padding:16px;border:1px solid var(--border);border-radius:12px;background:#faf8f4;text-align:left}
      .same-day-review-box h4{margin:0 0 6px;font-size:.96rem}.same-day-review-box p{margin:0 0 12px;color:var(--sub);font-size:.82rem;line-height:1.55}
      .same-day-review-meta{display:flex;gap:8px;flex-wrap:wrap;margin:8px 0 12px}.same-day-review-meta span{padding:4px 8px;border-radius:999px;background:#f0ece5;color:var(--sub);font-size:.72rem}
      .same-day-review-progress{margin:0 0 14px;color:var(--sub);font-size:.78rem}.same-day-review-progress strong{color:var(--text)}
      .same-day-review-note{margin-top:10px!important;font-size:.75rem!important}
    `;
    document.head.appendChild(style);
  }

  function reviewRecommendation(words, history) {
    if (!words.length) return "今天还没有新学并通过的词。";
    const latest = Math.max(...words.map((w) => readState().cards?.[w.cardId]?.lastReview || 0));
    const mins = Math.max(0, Math.floor((Date.now() - latest) / 60000));
    if (!history.rounds.length && mins < 30) return `刚学完约 ${mins} 分钟。现在可以快速回顾；更推荐至少间隔约 30 分钟后再做第一轮今日复习。`;
    if (!history.rounds.length) return "现在适合做第一轮今日间隔复习。";
    const firstAt = history.rounds[0]?.endedAt || history.rounds[0]?.startedAt || latest;
    const hours = (Date.now() - firstAt) / 3600000;
    if (history.rounds.length === 1 && hours < 3) return `第一轮已完成；第二轮更建议再间隔一些时间（当前约 ${hours.toFixed(1)} 小时）。`;
    if (history.rounds.length === 1) return "可以做第二轮今日复习；建议仍以主动检索为主，不重看答案。";
    return `今天已经完成 ${history.rounds.length} 轮可选复习；继续复习不会推进明天/后天的跨天阶段。`;
  }

  let reviewSession = null;

  function startReview() {
    const words = todayNewWords();
    if (!words.length) return;
    const history = readReviewHistory();
    const state = readState();
    const ordered = shuffle(words).sort((a, b) => {
      const ca = state.cards?.[a.cardId] || {};
      const cb = state.cards?.[b.cardId] || {};
      return (cb.wrong || 0) - (ca.wrong || 0);
    });

    reviewSession = {
      queue: ordered.map((w) => ({ cardId: w.cardId, correctsNeeded: 0, seenPrompts: [...(history.seenPrompts?.[w.cardId] || [])], isFiller: false })),
      baseTotal: ordered.length,
      passed: 0,
      attempts: 0,
      correct: 0,
      wrong: 0,
      currentQuestion: null,
      startedAt: Date.now(),
      history
    };
    renderReviewCard();
  }

  function ensureGap(item) {
    const queue = reviewSession.queue;
    const index = Math.min(MIN_GAP, queue.length);
    if (index >= MIN_GAP) {
      queue.splice(index, 0, item);
      return;
    }

    const existing = new Set(queue.map((x) => x.cardId));
    const fillers = shuffle(learnedFillerPool(item.cardId))
      .filter((w) => !existing.has(w.cardId))
      .slice(0, MIN_GAP - index)
      .map((w) => ({ cardId: w.cardId, correctsNeeded: 0, seenPrompts: [], isFiller: true }));
    queue.push(...fillers);
    const targetIndex = Math.min(MIN_GAP, queue.length);
    queue.splice(targetIndex, 0, item);
  }

  function renderReviewCard() {
    const root = document.getElementById("studyCard");
    if (!root || !reviewSession) return;

    if (!reviewSession.queue.length) {
      finishReview();
      return;
    }

    const item = reviewSession.queue[0];
    const word = wordById.get(item.cardId);
    if (!word) {
      reviewSession.queue.shift();
      renderReviewCard();
      return;
    }
    const q = buildQuestion(word, item.seenPrompts);
    reviewSession.currentQuestion = q;

    root.innerHTML = `
      <div class="word-card" data-card="${attr(word.cardId)}">
        <div class="word-card-head">
          <span class="deck-badge">${item.isFiller ? "今日复习·间隔题" : "今日复习"} · ${word.deckName || "IELTS"}</span>
          <span class="memory-badge">${item.correctsNeeded > 0 ? `还需答对 ${item.correctsNeeded} 次` : "不改变跨天到期日"}</span>
        </div>
        <div class="same-day-review-progress">今日复习通过 <strong>${reviewSession.passed} / ${reviewSession.baseTotal}</strong> · 作答 ${reviewSession.attempts}</div>
        <div class="word-main">
          <h3 class="word-title">${esc(q.prompt)}</h3>
          <div class="word-pos">${word.quizMode === "meaning" ? esc(word.pos) : "选择可互相替换的表达"}</div>
          <div class="word-actions"><button class="icon-button" id="sameDaySpeakBtn" title="发音">🔊</button></div>
          <div class="options" id="sameDayOptions">${q.options.map((o) => `<button class="option" data-option="${attr(o)}">${esc(o)}</button>`).join("")}</div>
        </div>
        <div class="answer-zone" id="sameDayAnswer" hidden></div>
        <div id="sameDayResult" hidden></div>
      </div>`;

    document.getElementById("sameDaySpeakBtn").onclick = () => speak(q.prompt);
    document.querySelectorAll("#sameDayOptions .option").forEach((btn) => {
      btn.onclick = () => handleReviewAnswer(btn, item, word, q);
    });
  }

  function handleReviewAnswer(btn, item, word, q) {
    const picked = btn.dataset.option;
    const ok = norm(picked) === norm(q.correct);
    reviewSession.attempts++;
    if (ok) reviewSession.correct++; else reviewSession.wrong++;
    item.seenPrompts = uniq([...(item.seenPrompts || []), q.prompt]);

    document.querySelectorAll("#sameDayOptions .option").forEach((b) => {
      b.disabled = true;
      if (norm(b.dataset.option) === norm(q.correct)) b.classList.add("correct");
      if (b === btn && !ok) b.classList.add("wrong");
    });

    let passed = false;
    let retry = false;
    if (item.isFiller) {
      passed = true;
    } else if (!ok) {
      item.correctsNeeded = 2;
      retry = true;
    } else if (item.correctsNeeded > 0) {
      item.correctsNeeded--;
      retry = item.correctsNeeded > 0;
      passed = !retry;
    } else {
      passed = true;
    }

    const answer = document.getElementById("sameDayAnswer");
    answer.hidden = false;
    answer.innerHTML = word.quizMode === "meaning"
      ? `<div class="answer-row"><span class="answer-label">答案</span><span class="answer-value">${esc(q.prompt)} → ${esc(q.correct)}</span></div>`
      : `<div class="answer-row"><span class="answer-label">本题替换</span><span class="answer-value">${esc(q.prompt)} ↔ ${esc(q.correct)}</span></div><div class="answer-row"><span class="answer-label">同义组</span><span class="answer-value">${q.cluster.map(esc).join(" · ")}</span></div>`;

    const result = document.getElementById("sameDayResult");
    result.hidden = false;
    let detail;
    if (item.isFiller) detail = "这是一道间隔题，用来保证同一错词的两次重新证明不会连续出现。";
    else if (!ok) detail = `答错：本轮后续需要重新答对 2 次；每次至少隔 ${MIN_GAP} 道其它题。`;
    else if (retry) detail = `答对：还需再答对 ${item.correctsNeeded} 次；下一次仍会和本题拉开间隔。`;
    else detail = "本词今日复习通过；不会改变明天/后天的跨天到期日。";

    result.innerHTML = `<div class="complete-banner" style="padding:14px 0 0"><p style="margin-bottom:10px;color:${ok ? 'var(--green)' : 'var(--red)'}">${ok ? "回答正确" : "回答错误"}</p><p style="margin-bottom:12px;color:var(--sub);font-size:.82rem">${esc(detail)}</p><button class="button button-primary" id="sameDayContinue">下一题</button></div>`;
    document.getElementById("sameDayContinue").onclick = () => {
      reviewSession.queue.shift();
      if (item.isFiller) {
        // Filler never changes the target-card review count or the cross-day schedule.
      } else if (retry) {
        ensureGap(item);
      } else if (passed) {
        reviewSession.passed++;
      }
      renderReviewCard();
    };
  }

  function finishReview() {
    const root = document.getElementById("studyCard");
    const history = reviewSession.history || { rounds: [], seenPrompts: {} };
    history.seenPrompts = history.seenPrompts || {};
    const targetWords = todayNewWords();
    for (const w of targetWords) {
      const itemPrompts = reviewSession.queue.find((x) => x.cardId === w.cardId)?.seenPrompts;
      if (itemPrompts?.length) history.seenPrompts[w.cardId] = uniq([...(history.seenPrompts[w.cardId] || []), ...itemPrompts]);
    }
    history.rounds = history.rounds || [];
    history.rounds.push({
      startedAt: reviewSession.startedAt,
      endedAt: Date.now(),
      targetCards: reviewSession.baseTotal,
      attempts: reviewSession.attempts,
      correct: reviewSession.correct,
      wrong: reviewSession.wrong
    });
    writeReviewHistory(history);

    const accuracy = reviewSession.attempts ? Math.round(reviewSession.correct / reviewSession.attempts * 100) : 0;
    root.innerHTML = `
      <div class="empty-state">
        <div class="empty-icon">✓</div>
        <h3>今日复习完成</h3>
        <p>复习了 ${reviewSession.baseTotal} 个今日新词 · 作答 ${reviewSession.attempts} 次 · 正确率 ${accuracy}%</p>
        <div class="same-day-review-box">
          <h4>跨天计划没有变化</h4>
          <p>这轮属于同一天的额外检索，不会把原本的 1 → 2 → 6 → 31 天计划提前或延后。</p>
        </div>
        <button class="button button-primary" id="sameDayReviewAgain">再复习一轮</button>
        <button class="button button-ghost" id="sameDayBack" style="margin-left:8px">返回今日学习</button>
      </div>`;
    document.getElementById("sameDayReviewAgain").onclick = startReview;
    document.getElementById("sameDayBack").onclick = () => location.reload();
    reviewSession = null;
  }

  // Low-latency speech for the standalone review mode.
  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let voice = null;
  function refreshVoice() {
    if (!synth) return;
    const voices = synth.getVoices();
    const en = voices.filter((v) => /^en([-_]|$)/i.test(v.lang || ""));
    voice = en.find((v) => /^en-GB$/i.test(v.lang) && v.localService) || en.find((v) => v.localService) || en[0] || voices[0] || null;
  }
  if (synth) {
    refreshVoice();
    synth.addEventListener?.("voiceschanged", refreshVoice);
  }
  function speak(text) {
    if (!synth) return;
    if (!voice) refreshVoice();
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (voice) { u.voice = voice; u.lang = voice.lang; } else u.lang = "en-GB";
    u.rate = 0.96;
    synth.speak(u);
  }

  function decorateCompletion() {
    if (reviewSession) return;
    const root = document.getElementById("studyCard");
    const title = root?.querySelector(".empty-state h3");
    if (!root || !title || title.textContent.trim() !== "今日任务完成") return;
    const empty = title.closest(".empty-state");
    if (!empty || empty.querySelector("#sameDayReviewBox")) return;

    const words = todayNewWords();
    if (!words.length) return;
    const history = readReviewHistory();
    const box = document.createElement("div");
    box.id = "sameDayReviewBox";
    box.className = "same-day-review-box";
    box.innerHTML = `
      <h4>今日复习（可选）</h4>
      <p>${esc(reviewRecommendation(words, history))}</p>
      <div class="same-day-review-meta"><span>今日新词 ${words.length}</span><span>已复习 ${history.rounds.length} 轮</span><span>不改变跨天计划</span></div>
      <button class="button button-primary" id="sameDayReviewBtn">开始今日复习</button>
      <p class="same-day-review-note">复习采用主动答题，不是重新浏览答案；如果复习时答错，同样要在后面分开重新答对 2 次。</p>`;
    empty.appendChild(box);
    document.getElementById("sameDayReviewBtn").onclick = startReview;
  }

  injectStyles();
  const observer = new MutationObserver(() => requestAnimationFrame(decorateCompletion));
  observer.observe(document.body, { childList: true, subtree: true });
  decorateCompletion();
})();
