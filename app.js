(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) {
    document.body.innerHTML = '<p style="padding:2rem">新版数据加载失败，请检查 data.js、academic-data.js 与 data-v2.js。</p>';
    return;
  }

  const STORAGE_KEY = "ielt-memory-v3";
  const LEGACY_KEY = "538-progress";
  const SCHEDULE_MODEL = "ebbinghaus-calendar-v2";
  const REVIEW_INTERVALS = [1, 2, 6, 31, 60, 120];
  const DAY = 86400000;
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  const allWords = (DATA.allWords || DATA.groups.flatMap((g) => g.words))
    .map((w) => ({ ...w, group: DATA.groups.find((g) => String(g.id) === String(w.groupId)) || null }));
  const wordById = new Map(allWords.map((w) => [w.cardId, w]));

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function startOfDayPlus(days, base = new Date()) {
    const d = new Date(base);
    d.setHours(0, 0, 0, 0);
    d.setDate(d.getDate() + days);
    return d.getTime();
  }

  function shuffle(input) {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function normText(v) {
    return String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  }

  function uniqueNonEmpty(items) {
    const out = [];
    for (const item of items || []) {
      const text = String(item ?? "").trim();
      if (text && !out.some((x) => normText(x) === normText(text))) out.push(text);
    }
    return out;
  }

  function freshState() {
    return {
      version: 4,
      scheduleModel: SCHEDULE_MODEL,
      scheduleIntervalsDays: REVIEW_INTERVALS,
      settings: { dailyNew: 20, repeatGap: 3 },
      cards: {},
      daily: {},
      migratedLegacy: false
    };
  }

  function loadState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (!raw) return freshState();
      const parsed = JSON.parse(raw);
      const base = freshState();
      return {
        ...base,
        ...parsed,
        settings: { ...base.settings, ...(parsed.settings || {}) },
        cards: parsed.cards || {},
        daily: parsed.daily || {}
      };
    } catch {
      return freshState();
    }
  }

  let state = loadState();

  function save() {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  }

  function blankCard() {
    return {
      reps: 0,
      lapses: 0,
      difficulty: 5,
      stability: 0,
      due: 0,
      lastReview: 0,
      correct: 0,
      wrong: 0,
      lastRating: 0,
      reviewStage: -1,
      scheduleModel: SCHEDULE_MODEL
    };
  }

  function card(cardId) {
    if (!state.cards[cardId]) state.cards[cardId] = blankCard();
    return state.cards[cardId];
  }

  function migrateLegacy() {
    if (state.migratedLegacy) return;
    try {
      const raw = localStorage.getItem(LEGACY_KEY);
      if (raw) {
        const legacy = JSON.parse(raw);
        const studied = Array.isArray(legacy.study) ? legacy.study : [];
        DATA.groups.forEach((g, gi) => {
          const n = clamp(Number(studied[gi] || 0), 0, g.words.length);
          g.words.slice(0, n).forEach((w) => {
            const c = card(w.cardId);
            if (!c.reps) {
              c.reps = 1;
              c.reviewStage = 0;
              c.stability = 1;
              c.lastReview = now();
              c.due = startOfDayPlus(1);
              c.lastRating = 3;
            }
          });
        });

        Object.entries(legacy.mistakes || {}).forEach(([oldId, value]) => {
          const w = DATA.allPrimaryWords.find((x) => String(x.id) === String(oldId));
          if (!w) return;
          const c = card(w.cardId);
          const n = Math.max(0, Number(value) || 0);
          c.wrong = Math.max(c.wrong, n);
          c.lapses = Math.max(c.lapses, n);
          c.difficulty = clamp(c.difficulty + Math.min(3, n) * 0.5, 1, 10);
          c.reviewStage = 0;
          c.stability = 1;
          c.due = startOfDayPlus(1);
        });
      }
    } catch (e) {
      console.warn("Legacy migration skipped", e);
    }
    state.migratedLegacy = true;
    save();
  }

  function migrateScheduleModel() {
    if (state.scheduleModel === SCHEDULE_MODEL) return;
    Object.values(state.cards || {}).forEach((c) => {
      if (!c?.reps) return;
      c.reviewStage = 0;
      c.scheduleModel = SCHEDULE_MODEL;
      c.stability = 1;
      c.due = startOfDayPlus(1);
    });
    state.scheduleModel = SCHEDULE_MODEL;
    state.scheduleIntervalsDays = REVIEW_INTERVALS;
    save();
  }

  function scheduleAfterDailyPass(c, hadError, wasNew) {
    let stage;
    if (wasNew || hadError || !Number.isInteger(c.reviewStage) || c.reviewStage < 0) {
      stage = 0;
    } else {
      stage = Math.min(c.reviewStage + 1, REVIEW_INTERVALS.length - 1);
    }

    const days = REVIEW_INTERVALS[stage];
    c.reps = (c.reps || 0) + 1;
    c.reviewStage = stage;
    c.scheduleModel = SCHEDULE_MODEL;
    c.stability = days;
    c.lastReview = now();
    c.lastRating = hadError ? 2 : 3;
    c.due = startOfDayPlus(days);
    return { days, due: c.due, stage };
  }

  function dueWords() {
    const ts = now();
    return allWords
      .filter((w) => state.cards[w.cardId]?.reps > 0 && state.cards[w.cardId].due <= ts)
      .sort((a, b) => (state.cards[a.cardId].due || 0) - (state.cards[b.cardId].due || 0));
  }

  function unseenWords(limit = state.settings.dailyNew) {
    return allWords.filter((w) => !state.cards[w.cardId]?.reps).slice(0, Math.max(0, Number(limit) || 0));
  }

  function memoryLabel(c) {
    if (!c?.reps) return "新词";
    if (c.lapses >= 2 || c.wrong > c.correct) return "薄弱";
    if ((c.stability || 0) >= 31) return "已掌握";
    return "学习中";
  }

  function weakScore(w) {
    const c = state.cards[w.cardId];
    if (!c?.reps) return 0;
    return c.lapses * 2.4 + c.wrong * 1.2 + c.difficulty * 0.3 + (c.reviewStage <= 0 ? 1 : 0);
  }

  function logAttempt(correct) {
    const k = dateKey();
    const d = state.daily[k] || { reviews: 0, correct: 0, wrong: 0, newCards: 0 };
    d.reviews++;
    if (correct) d.correct++;
    else d.wrong++;
    state.daily[k] = d;
  }

  function logCompletion(wasNew) {
    if (!wasNew) return;
    const k = dateKey();
    const d = state.daily[k] || { reviews: 0, correct: 0, wrong: 0, newCards: 0 };
    d.newCards++;
    state.daily[k] = d;
  }

  function streak() {
    let n = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 2000; i++) {
      const k = dateKey(d.getTime());
      if ((state.daily[k]?.reviews || 0) > 0) n++;
      else if (i > 0) break;
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  function makeItem(w, reason) {
    const c = state.cards[w.cardId];
    return {
      cardId: w.cardId,
      reason,
      wasNew: !c?.reps,
      hadError: false,
      correctsNeeded: 0,
      seenPrompts: []
    };
  }

  let session = { queue: [], total: 0, done: 0, active: false, answered: false, question: null, outcome: null };

  function buildSession(extraNew = null) {
    const due = dueWords().map((w) => makeItem(w, "到期复习"));
    const fresh = unseenWords(extraNew == null ? state.settings.dailyNew : extraNew)
      .map((w) => makeItem(w, "今日新词"));
    session = {
      queue: [...due, ...fresh],
      total: due.length + fresh.length,
      done: 0,
      active: true,
      answered: false,
      question: null,
      outcome: null
    };
    renderAll();
  }

  function requeueAfterGap(item) {
    const gap = clamp(Number(state.settings.repeatGap) || 3, 1, 10);
    const position = Math.min(gap, session.queue.length);
    session.queue.splice(position, 0, item);
  }

  function synonymCluster(word) {
    return uniqueNonEmpty([word.word, ...(word.sourceSynonyms || word.quizSynonyms || word.synonyms || [])]);
  }

  function buildQuestion(word, item) {
    if (word.quizMode === "meaning") {
      const correct = word.chinese;
      const pool = uniqueNonEmpty(
        allWords.filter((w) => w.cardId !== word.cardId && w.chinese && w.quizMode === "meaning").map((w) => w.chinese)
      ).filter((x) => normText(x) !== normText(correct));
      const distractors = shuffle(pool).slice(0, 3);
      if (distractors.length < 3) {
        const fallback = uniqueNonEmpty(allWords.map((w) => w.chinese))
          .filter((x) => normText(x) !== normText(correct) && !distractors.some((d) => normText(d) === normText(x)));
        distractors.push(...shuffle(fallback).slice(0, 3 - distractors.length));
      }
      return { prompt: word.word, correct, options: shuffle([correct, ...distractors]), cluster: [word.word, word.chinese], mode: "meaning" };
    }

    const cluster = synonymCluster(word);
    if (cluster.length < 2) {
      return { prompt: word.word, correct: word.chinese, options: [word.chinese], cluster, mode: "fallback" };
    }

    const seen = new Set((item.seenPrompts || []).map(normText));
    let promptCandidates = cluster.filter((x) => !seen.has(normText(x)));
    if (!promptCandidates.length) promptCandidates = cluster;
    const prompt = promptCandidates[Math.floor(Math.random() * promptCandidates.length)];
    const answerCandidates = cluster.filter((x) => normText(x) !== normText(prompt));
    const correct = answerCandidates[Math.floor(Math.random() * answerCandidates.length)];
    const currentSet = new Set(cluster.map(normText));

    const pool = uniqueNonEmpty(
      (DATA.allPrimaryWords || [])
        .filter((w) => w.cardId !== word.cardId)
        .flatMap((w) => synonymCluster(w))
    ).filter((x) => !currentSet.has(normText(x)));

    const distractors = shuffle(pool).slice(0, 3);
    return { prompt, correct, options: shuffle([correct, ...distractors]), cluster, mode: "synonym" };
  }

  function currentLevelSummary() {
    const nextGroup = DATA.groups.find((g) => g.words.some((w) => !state.cards[w.cardId]?.reps));
    if (!nextGroup) return DATA.academic?.words?.some((w) => !state.cards[w.cardId]?.reps) ? "538 已完成，新词进入 Academic" : "所有新词已学习";
    const label = nextGroup.shortLabel || nextGroup.levelName || `第${nextGroup.id}类考点词`;
    const order = nextGroup.rankMode === "equal" ? "组内重要性一致" : "按重要性顺序学习";
    return `当前新词优先：${label}（${order}）`;
  }

  function renderDashboard() {
    $("dueCount").textContent = dueWords().length;
    $("newCount").textContent = unseenWords().length;
    $("learnedCount").textContent = allWords.filter((w) => state.cards[w.cardId]?.reps).length;
    $("weakCount").textContent = allWords.filter((w) => weakScore(w) >= 5.5).length;
    $("streakCount").textContent = streak();
    $("dataCountText").textContent = `${DATA.counts.primaryWords} 个 538 主词 · ${DATA.counts.totalTargets} 个 538 学习目标 · Academic ${DATA.counts.academicUnique} 词`;
  }

  function renderProgress() {
    const pct = session.total ? Math.min(100, session.done / session.total * 100) : 0;
    $("sessionProgressText").textContent = `${session.done} / ${session.total}`;
    $("sessionProgressBar").style.width = `${pct}%`;
    $("todaySummary").textContent = `到期 ${dueWords().length} · 新词 ${unseenWords().length} · ${currentLevelSummary()} · 答错后当天需再答对2次`;
  }

  function deckBadge(word) {
    if (word.deckId === "academic") return `Academic · NAWL #${word.rank}`;
    const label = word.group?.shortLabel || word.group?.levelName || `第${word.groupId}类考点词`;
    return `${label} · #${word.id}`;
  }

  function answerZone(word, q) {
    if (word.deckId === "academic") {
      return `
        <div class="answer-row"><span class="answer-label">本题</span><span class="answer-value">${esc(q.prompt)} → ${esc(q.correct)}</span></div>
        <div class="answer-row"><span class="answer-label">中文</span><span class="answer-value">${esc(word.chinese)}</span></div>
        <div class="answer-row"><span class="answer-label">来源</span><span class="answer-value">New Academic Word List 1.2 · CC BY-SA 4.0</span></div>`;
    }

    return `
      <div class="answer-row"><span class="answer-label">本题替换</span><span class="answer-value">${esc(q.prompt)} ↔ ${esc(q.correct)}</span></div>
      <div class="answer-row"><span class="answer-label">完整同义组</span><span class="answer-value">${q.cluster.map(esc).join(" · ")}</span></div>
      <div class="answer-row"><span class="answer-label">常考词义</span><span class="answer-value">${esc(word.chinese)}</span></div>
      ${word.aliases?.length ? `<div class="answer-row"><span class="answer-label">拼写 / 别名</span><span class="answer-value">${word.aliases.map(esc).join(" · ")}</span></div>` : ""}
      ${word.sourceNote ? `<div class="answer-row"><span class="answer-label">数据校注</span><span class="answer-value">${esc(word.sourceNote)}</span></div>` : ""}
      ${word.example ? `<div class="answer-row"><span class="answer-label">例句</span><span class="answer-value example">${esc(word.example)}</span></div>` : ""}`;
  }

  function renderStudy() {
    renderProgress();
    const root = $("studyCard");

    if (!session.active) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◌</div>
          <h3>今日学习还没开始</h3>
          <p>系统只根据答题正确/错误判断；答错后会在当天后续题目中重新考，之后必须答对2次才算当天通过。</p>
          <button class="button button-primary" id="inlineStart">开始今日学习</button>
        </div>`;
      $("inlineStart").onclick = () => buildSession();
      return;
    }

    if (!session.queue.length) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">✓</div>
          <h3>今日任务完成</h3>
          <p>今天通过的词才会进入按天复习：1 → 2 → 6 → 31 天，之后进入 60 → 120 天长期维护。</p>
          <button class="button button-ghost" id="extraTen">再学 10 个新词</button>
        </div>`;
      $("extraTen").onclick = () => {
        const extra = unseenWords(10).map((w) => makeItem(w, "加练新词"));
        session.queue.push(...extra);
        session.total += extra.length;
        renderAll();
      };
      return;
    }

    const item = session.queue[0];
    const word = wordById.get(item.cardId);
    if (!word) {
      session.queue.shift();
      session.question = null;
      renderStudy();
      return;
    }

    const c = card(item.cardId);
    if (!session.question || session.question.cardId !== item.cardId) {
      session.question = { cardId: item.cardId, ...buildQuestion(word, item) };
    }
    const q = session.question;
    session.answered = false;
    session.outcome = null;

    const strengthenText = item.correctsNeeded > 0 ? ` · 当天还需答对 ${item.correctsNeeded} 次` : "";

    root.innerHTML = `
      <div class="word-card" data-card="${attr(word.cardId)}">
        <div class="word-card-head">
          <span class="deck-badge">${esc(deckBadge(word))}</span>
          <span class="memory-badge">${esc(item.reason)} · ${esc(memoryLabel(c))}${esc(strengthenText)}</span>
        </div>
        <div class="word-main">
          <h3 class="word-title">${esc(q.prompt)}</h3>
          <div class="word-pos">${word.deckId === "academic" ? esc(word.pos) : "选择可互相替换的表达"}</div>
          <div class="word-actions"><button class="icon-button" id="speakBtn" title="发音">🔊</button></div>
          <div class="options" id="options">
            ${q.options.map((o) => `<button class="option" data-option="${attr(o)}">${esc(o)}</button>`).join("")}
          </div>
        </div>
        <div class="answer-zone" id="answerZone" hidden>${answerZone(word, q)}</div>
        <div id="autoResult" hidden></div>
      </div>`;

    $("speakBtn").onclick = () => speak(q.prompt);
    document.querySelectorAll(".option").forEach((btn) => {
      btn.onclick = () => handleChoice(btn, q, item, word);
    });
  }

  function handleChoice(btn, q, item, word) {
    if (session.answered) return;
    session.answered = true;
    const picked = btn.dataset.option;
    const ok = normText(picked) === normText(q.correct);
    const c = card(item.cardId);

    document.querySelectorAll(".option").forEach((b) => {
      b.disabled = true;
      if (normText(b.dataset.option) === normText(q.correct)) b.classList.add("correct");
      if (b === btn && !ok) b.classList.add("wrong");
    });

    item.seenPrompts = uniqueNonEmpty([...(item.seenPrompts || []), q.prompt]);
    logAttempt(ok);

    if (ok) {
      c.correct = (c.correct || 0) + 1;
      if (item.correctsNeeded > 0) item.correctsNeeded--;
    } else {
      c.wrong = (c.wrong || 0) + 1;
      c.lapses = (c.lapses || 0) + 1;
      c.difficulty = clamp((c.difficulty || 5) + 0.6, 1, 10);
      item.hadError = true;
      item.correctsNeeded = 2;
    }

    let passed = false;
    let retry = false;
    let scheduleInfo = null;

    if (!ok) {
      retry = true;
      item.reason = "错词强化";
    } else if (item.correctsNeeded > 0) {
      retry = true;
      item.reason = "错词强化";
    } else {
      passed = true;
      scheduleInfo = scheduleAfterDailyPass(c, item.hadError, item.wasNew);
      logCompletion(item.wasNew);
    }

    state.scheduleModel = SCHEDULE_MODEL;
    state.scheduleIntervalsDays = REVIEW_INTERVALS;
    save();

    session.outcome = { ok, passed, retry, scheduleInfo };

    $("answerZone").hidden = false;
    const result = $("autoResult");
    result.hidden = false;

    let headline;
    let detail;
    if (!ok) {
      headline = "回答错误：本词今天还不能通过";
      detail = "之后必须在今天的后续题目里再答对 2 次；如果中途再次答错，会重新从 2 次开始。";
    } else if (retry) {
      headline = `回答正确：还需再答对 ${item.correctsNeeded} 次`;
      detail = "这是当天强化，不算跨天复习；下一次会换方向继续考同一同义组。";
    } else {
      headline = "当天通过";
      detail = `下一次跨天复习：${scheduleInfo.days} 天后（${dateKey(scheduleInfo.due)}）`;
    }

    result.innerHTML = `
      <div class="complete-banner" style="padding:16px 0 0">
        <p style="margin-bottom:10px;color:${passed ? 'var(--green)' : ok ? 'var(--text)' : 'var(--red)'}">${esc(headline)}</p>
        <p style="margin-bottom:12px;color:var(--sub);font-size:.82rem">${esc(detail)}</p>
        <button class="button button-primary" id="continueBtn">下一题</button>
      </div>`;

    $("continueBtn").onclick = () => advanceAfterAttempt(item);
  }

  function advanceAfterAttempt(item) {
    const outcome = session.outcome;
    session.queue.shift();
    if (outcome?.retry) {
      requeueAfterGap(item);
    } else if (outcome?.passed) {
      session.done++;
    }
    session.question = null;
    session.outcome = null;
    renderAll();
  }

  const synth = "speechSynthesis" in window ? window.speechSynthesis : null;
  let preferredVoice = null;

  function choosePreferredVoice(voices) {
    const english = voices.filter((v) => /^en([-_]|$)/i.test(v.lang || ""));
    return english.find((v) => /^en-GB$/i.test(v.lang) && v.localService) ||
      english.find((v) => v.localService) ||
      english.find((v) => /^en-GB$/i.test(v.lang)) ||
      english[0] ||
      voices.find((v) => v.localService) ||
      voices[0] || null;
  }

  function refreshVoices() {
    if (!synth) return;
    const voices = synth.getVoices();
    if (voices.length) preferredVoice = choosePreferredVoice(voices);
  }

  function initSpeech() {
    if (!synth) return;
    refreshVoices();
    if (typeof synth.addEventListener === "function") synth.addEventListener("voiceschanged", refreshVoices);
    document.addEventListener("pointerdown", refreshVoices, { once: true, passive: true });
  }

  function speak(text) {
    if (!synth) return toast("当前浏览器不支持朗读");
    if (!preferredVoice) refreshVoices();
    if (synth.speaking || synth.pending) synth.cancel();
    const u = new SpeechSynthesisUtterance(text);
    if (preferredVoice) {
      u.voice = preferredVoice;
      u.lang = preferredVoice.lang || "en-GB";
    } else {
      u.lang = "en-GB";
    }
    u.rate = 0.94;
    u.pitch = 1;
    synth.speak(u);
  }

  let filterDeck = "all";

  function renderFilters() {
    const items = [
      { id: "all", label: `全部 ${DATA.counts.studyCards}` },
      { id: "reading538", label: `新版 538 · ${DATA.counts.primaryWords}` },
      ...DATA.groups.map((g) => ({ id: `g${g.id}`, label: `${g.levelName || `第${g.id}类考点词`} · ${g.words.length}` })),
      { id: "academic", label: `Academic ${DATA.counts.academicUnique}` }
    ];
    $("deckFilter").innerHTML = items.map((x) => `<button class="filter-button ${filterDeck === x.id ? "active" : ""}" data-deck="${x.id}">${esc(x.label)}</button>`).join("");
    document.querySelectorAll(".filter-button").forEach((b) => {
      b.onclick = () => {
        filterDeck = b.dataset.deck;
        renderFilters();
        renderLibrary();
      };
    });
  }

  function matchesDeck(w) {
    if (filterDeck === "all") return true;
    if (filterDeck === "reading538") return w.deckId === "reading538";
    if (filterDeck === "academic") return w.deckId === "academic";
    if (/^g[123]$/.test(filterDeck)) return w.deckId === "reading538" && String(w.groupId) === filterDeck.slice(1);
    return true;
  }

  function renderLibrary() {
    const q = ($("librarySearch").value || "").trim().toLowerCase();
    let words = allWords.filter(matchesDeck);
    if (q) {
      words = words.filter((w) =>
        w.word.toLowerCase().includes(q) ||
        (w.chinese || "").includes(q) ||
        (w.aliases || []).some((s) => s.toLowerCase().includes(q)) ||
        (w.sourceSynonyms || []).some((s) => s.toLowerCase().includes(q))
      );
    }

    const visible = words.slice(0, 220);
    $("libraryList").innerHTML = visible.length ? visible.map((w) => {
      const c = state.cards[w.cardId];
      const detail = w.deckId === "academic"
        ? `NAWL #${w.rank} · ${esc(w.pos)}`
        : `同义组：${synonymCluster(w).slice(0, 6).map(esc).join(" · ")}`;
      return `<article class="library-item" data-card="${attr(w.cardId)}">
        <div class="library-item-top">
          <div><span class="library-word">${esc(w.word)}</span><span class="library-pos">${esc(w.pos)}</span></div>
          <span class="memory-badge">${esc(memoryLabel(c))}</span>
        </div>
        <div class="library-cn">${esc(w.chinese)}</div>
        <div class="library-syn">${detail}</div>
      </article>`;
    }).join("") : '<div class="empty-state" style="min-height:220px"><p>没有匹配的词。</p></div>';

    document.querySelectorAll(".library-item").forEach((el) => {
      el.onclick = () => {
        const w = wordById.get(el.dataset.card);
        session = { queue: [makeItem(w, "单词查看")], total: 1, done: 0, active: true, answered: false, question: null, outcome: null };
        switchView("today");
        renderStudy();
      };
    });
  }

  function renderStats() {
    const today = state.daily[dateKey()] || { reviews: 0, correct: 0, wrong: 0 };
    $("statTodayReviews").textContent = today.reviews || 0;
    $("statTodayAccuracy").textContent = today.reviews ? `${Math.round(today.correct / today.reviews * 100)}%` : "—";

    const learned = allWords.filter((w) => state.cards[w.cardId]?.reps).map((w) => state.cards[w.cardId]);
    $("statMastered").textContent = learned.filter((c) => (c.stability || 0) >= 31).length;
    const avgS = learned.length ? learned.reduce((a, c) => a + (c.stability || 0), 0) / learned.length : 0;
    $("statAvgStability").textContent = learned.length ? `${avgS.toFixed(1)} 天` : "—";

    const weak = allWords
      .filter((w) => state.cards[w.cardId]?.reps)
      .map((w) => ({ w, c: state.cards[w.cardId], score: weakScore(w) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    $("weakList").innerHTML = weak.length ? weak.map(({ w, c, score }) => `
      <div class="weak-row">
        <div><strong>${esc(w.word)} <small>${esc(w.chinese)}</small></strong><small>${esc(w.deckName || "")} · 错误 ${c.wrong || 0} · 遗忘 ${c.lapses || 0} · 当前间隔 ${c.stability || 0} 天</small></div>
        <span class="weak-score">${score.toFixed(1)}</span>
      </div>`).join("") : '<p style="color:var(--muted)">还没有学习记录。</p>';

    const days = [];
    let max = 1;
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      d.setDate(d.getDate() - i);
      const count = state.daily[dateKey(d.getTime())]?.reviews || 0;
      max = Math.max(max, count);
      days.push({ d, count });
    }
    $("activityChart").innerHTML = days.map(({ d, count }) => {
      const h = Math.max(3, Math.round(count / max * 132));
      const label = ["日", "一", "二", "三", "四", "五", "六"][d.getDay()];
      return `<div class="activity-day"><div class="activity-bar-wrap"><div class="activity-bar" style="height:${h}px" title="${count} 次"></div></div><small>周${label}</small></div>`;
    }).join("");
  }

  function switchView(name) {
    document.querySelectorAll(".view").forEach((v) => v.classList.toggle("active", v.id === `view-${name}`));
    document.querySelectorAll(".nav-tab").forEach((b) => b.classList.toggle("active", b.dataset.view === name));
    if (name === "library") {
      renderFilters();
      renderLibrary();
    }
    if (name === "stats") renderStats();
  }

  function exportData() {
    const blob = new Blob([JSON.stringify({ app: "IELT Memory", version: 4, exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `ielt-memory-${dateKey()}.json`;
    a.click();
    URL.revokeObjectURL(url);
    toast("学习记录已导出");
  }

  async function importData(file) {
    try {
      const parsed = JSON.parse(await file.text());
      const incoming = parsed.state || parsed;
      if (!incoming.cards) throw new Error("bad data");
      state = { ...freshState(), ...incoming, settings: { ...freshState().settings, ...(incoming.settings || {}) } };
      migrateScheduleModel();
      save();
      syncSettings();
      renderAll();
      toast("学习记录已导入");
    } catch {
      toast("导入失败：文件格式不正确");
    }
  }

  function resetData() {
    if (!confirm("确定清空所有学习记录吗？此操作无法撤销。")) return;
    state = freshState();
    save();
    session = { queue: [], total: 0, done: 0, active: false, answered: false, question: null, outcome: null };
    syncSettings();
    renderAll();
    toast("学习记录已清空");
  }

  function syncSettings() {
    $("dailyNewInput").value = state.settings.dailyNew;
    $("repeatGapInput").value = state.settings.repeatGap;
  }

  function saveSettings() {
    state.settings.dailyNew = clamp(Number($("dailyNewInput").value) || 0, 0, 100);
    state.settings.repeatGap = clamp(Number($("repeatGapInput").value) || 3, 1, 10);
    save();
    renderAll();
    toast("设置已保存");
  }

  function toast(text) {
    const t = $("toast");
    t.textContent = text;
    t.classList.add("show");
    clearTimeout(toast.timer);
    toast.timer = setTimeout(() => t.classList.remove("show"), 2000);
  }

  function esc(v) {
    return String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");
  }

  function attr(v) {
    return esc(v);
  }

  function renderAll() {
    renderDashboard();
    renderProgress();
    renderStudy();
    renderLibrary();
    renderStats();
  }

  function bind() {
    document.querySelectorAll(".nav-tab").forEach((b) => b.onclick = () => switchView(b.dataset.view));
    $("startSessionBtn").onclick = () => buildSession();
    $("rebuildSessionBtn").onclick = () => buildSession();
    $("librarySearch").oninput = renderLibrary;
    $("exportBtn").onclick = exportData;
    $("importInput").onchange = (e) => e.target.files?.[0] && importData(e.target.files[0]);
    $("resetBtn").onclick = resetData;
    $("saveSettingsBtn").onclick = saveSettings;
  }

  migrateLegacy();
  migrateScheduleModel();
  initSpeech();
  syncSettings();
  bind();
  renderAll();
})();
