(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) {
    document.body.innerHTML = '<p style="padding:2rem">新版数据加载失败，请检查 data.js 与 data-v2.js。</p>';
    return;
  }

  const STORAGE_KEY = "ielt-memory-v3";
  const LEGACY_KEY = "538-progress";
  const DAY = 86400000;
  const $ = (id) => document.getElementById(id);
  const clamp = (n, a, b) => Math.max(a, Math.min(b, n));
  const now = () => Date.now();

  const allWords = DATA.groups.flatMap((g) => g.words.map((w) => ({ ...w, group: g })));
  const wordById = new Map(allWords.map((w) => [w.cardId, w]));

  function dateKey(ts = Date.now()) {
    const d = new Date(ts);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  }

  function shuffle(input) {
    const a = [...input];
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function freshState() {
    return {
      version: 3,
      settings: {
        dailyNew: 20,
        targetRetention: 0.90,
        repeatGap: 3
      },
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
      lastRating: 0
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
              c.stability = 1.5;
              c.lastReview = now() - DAY;
              c.due = now();
              c.lastRating = 3;
            }
          });
        });

        Object.entries(legacy.mistakes || {}).forEach(([oldId, value]) => {
          const w = allWords.find((x) => String(x.id) === String(oldId));
          if (!w) return;
          const c = card(w.cardId);
          const n = Math.max(0, Number(value) || 0);
          c.wrong = Math.max(c.wrong, n);
          c.lapses = Math.max(c.lapses, n);
          c.difficulty = clamp(c.difficulty + Math.min(3, n) * 0.5, 1, 10);
          c.due = now();
        });
      }
    } catch (e) {
      console.warn("Legacy migration skipped", e);
    }
    state.migratedLegacy = true;
    save();
  }

  // D/S/R 轻量自适应记忆模型：
  // D = difficulty, S = stability(days), R = retrievability.
  // R 使用指数遗忘曲线，目标保持率决定下一次复习间隔。
  function retrievability(c, ts = now()) {
    if (!c.reps || !c.stability || !c.lastReview) return 0;
    const elapsed = Math.max(0, (ts - c.lastReview) / DAY);
    return Math.pow(0.9, elapsed / Math.max(0.05, c.stability));
  }

  function intervalDays(stability) {
    const target = clamp(Number(state.settings.targetRetention) || 0.9, 0.80, 0.97);
    return Math.max(5 / 1440, stability * Math.log(target) / Math.log(0.9));
  }

  function schedule(c, grade, persist = true) {
    grade = clamp(Number(grade), 1, 4);
    const ts = now();
    const oldR = retrievability(c, ts);
    const first = !c.reps || !c.stability;

    if (first) {
      const initialS = [0, 0.15, 0.7, 2.2, 5.2][grade];
      c.stability = initialS;
      c.difficulty = clamp(7 - grade * 0.8, 1, 10);
      if (grade === 1) c.lapses++;
    } else if (grade === 1) {
      c.lapses++;
      c.difficulty = clamp(c.difficulty + 0.9, 1, 10);
      c.stability = Math.max(0.12, c.stability * (0.30 + 0.03 * (10 - c.difficulty)));
    } else {
      const gradeFactor = { 2: 0.55, 3: 1.0, 4: 1.65 }[grade];
      const forgettingBoost = 1 + (1 - oldR) * 2.2;
      const difficultyPenalty = 1 - (c.difficulty - 5) * 0.045;
      c.stability = Math.max(0.15, c.stability * (1 + gradeFactor * forgettingBoost * difficultyPenalty));
      c.difficulty = clamp(c.difficulty + (3 - grade) * 0.22 - (grade === 4 ? 0.18 : 0), 1, 10);
    }

    c.reps++;
    c.lastRating = grade;

    if (persist) {
      c.lastReview = ts;
      c.due = ts + intervalDays(c.stability) * DAY;
    }
    return c;
  }

  function humanInterval(days) {
    if (days < 1 / 24) return `${Math.max(1, Math.round(days * 1440))} 分`;
    if (days < 1) return `${Math.max(1, Math.round(days * 24))} 小时`;
    if (days < 30) return `${Math.max(1, Math.round(days))} 天`;
    if (days < 365) return `${Math.max(1, Math.round(days / 30))} 月`;
    return `${(days / 365).toFixed(1)} 年`;
  }

  function preview(cardId, grade) {
    const clone = { ...card(cardId) };
    schedule(clone, grade, false);
    return humanInterval(intervalDays(clone.stability));
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
    const r = retrievability(c);
    if (c.lapses >= 2 || r < 0.75) return "薄弱";
    if (c.stability >= 21 && r >= 0.9) return "已掌握";
    return "学习中";
  }

  function weakScore(w) {
    const c = state.cards[w.cardId];
    if (!c?.reps) return 0;
    return c.lapses * 2.4 + c.wrong * 1.2 + c.difficulty * 0.3 + (1 - retrievability(c)) * 5;
  }

  function logDaily(correct, wasNew) {
    const k = dateKey();
    const d = state.daily[k] || { reviews: 0, correct: 0, wrong: 0, newCards: 0 };
    d.reviews++;
    if (correct) d.correct++;
    else d.wrong++;
    if (wasNew) d.newCards++;
    state.daily[k] = d;
  }

  function streak() {
    let n = 0;
    const d = new Date();
    d.setHours(0, 0, 0, 0);
    for (let i = 0; i < 2000; i++) {
      const k = dateKey(d.getTime());
      if ((state.daily[k]?.reviews || 0) > 0) {
        n++;
      } else if (i > 0) {
        break;
      }
      d.setDate(d.getDate() - 1);
    }
    return n;
  }

  let session = {
    queue: [],
    total: 0,
    done: 0,
    active: false,
    answered: false
  };

  function buildSession(extraNew = null) {
    const due = dueWords().map((w) => ({ cardId: w.cardId, reason: "到期复习" }));
    const fresh = unseenWords(extraNew == null ? state.settings.dailyNew : extraNew)
      .map((w) => ({ cardId: w.cardId, reason: "今日新词" }));
    session = {
      queue: [...due, ...fresh],
      total: due.length + fresh.length,
      done: 0,
      active: true,
      answered: false
    };
    renderAll();
  }

  function requeue(item) {
    const gap = clamp(Number(state.settings.repeatGap) || 3, 1, 10);
    const position = Math.min(gap, session.queue.length);
    session.queue.splice(position, 0, { ...item, reason: "错词强化" });
    session.total++;
  }

  function optionSet(word) {
    const answers = word.examSynonyms?.length ? word.examSynonyms : word.synonyms;
    const correct = answers[Math.floor(Math.random() * answers.length)];
    const pool = allWords
      .filter((w) => w.cardId !== word.cardId)
      .flatMap((w) => w.examSynonyms?.length ? w.examSynonyms : w.synonyms)
      .filter((x) => !word.synonyms.some((s) => s.toLowerCase() === String(x).toLowerCase()));
    const distractors = shuffle([...new Set(pool)]).slice(0, 3);
    return { correct, options: shuffle([correct, ...distractors]) };
  }

  function renderDashboard() {
    $("dueCount").textContent = dueWords().length;
    $("newCount").textContent = unseenWords().length;
    $("learnedCount").textContent = allWords.filter((w) => state.cards[w.cardId]?.reps).length;
    $("weakCount").textContent = allWords.filter((w) => weakScore(w) >= 5.5).length;
    $("streakCount").textContent = streak();
    $("dataCountText").textContent = `${DATA.counts.primaryWords} 个主词 · ${DATA.counts.totalTargets} 个新版学习目标`;
  }

  function renderProgress() {
    const pct = session.total ? Math.min(100, session.done / session.total * 100) : 0;
    $("sessionProgressText").textContent = `${session.done} / ${session.total}`;
    $("sessionProgressBar").style.width = `${pct}%`;
    $("todaySummary").textContent = `到期 ${dueWords().length} · 新词 ${unseenWords().length} · 答错后间隔 ${state.settings.repeatGap} 张卡再次出现`;
  }

  function renderStudy() {
    renderProgress();
    const root = $("studyCard");

    if (!session.active) {
      root.innerHTML = `
        <div class="empty-state">
          <div class="empty-icon">◌</div>
          <h3>今日学习还没开始</h3>
          <p>先复习到期词，再学习今日新词；错词会在同一轮自动重现。</p>
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
          <p>下一次出现时间已根据每个词的记忆稳定度单独计算。</p>
          <button class="button button-ghost" id="extraTen">再学 10 个新词</button>
        </div>`;
      $("extraTen").onclick = () => {
        const extra = unseenWords(10).map((w) => ({ cardId: w.cardId, reason: "加练新词" }));
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
      renderStudy();
      return;
    }
    const c = card(item.cardId);
    const q = optionSet(word);
    session.answered = false;

    root.innerHTML = `
      <div class="word-card">
        <div class="word-card-head">
          <span class="deck-badge">新版538 · 第${word.groupId}类</span>
          <span class="memory-badge">${esc(item.reason)} · ${esc(memoryLabel(c))}</span>
        </div>
        <div class="word-main">
          <h3 class="word-title">${esc(word.word)}</h3>
          <div class="word-pos">${esc(word.pos)}</div>
          <div class="word-actions">
            <button class="icon-button" id="speakBtn" title="英式发音">🔊</button>
          </div>
          <div class="options" id="options">
            ${q.options.map((o) => `<button class="option" data-option="${attr(o)}">${esc(o)}</button>`).join("")}
          </div>
        </div>
        <div class="answer-zone" id="answerZone" hidden>
          <div class="answer-row"><span class="answer-label">命题同义替换</span><span class="answer-value">${(word.examSynonyms || []).map(esc).join(" · ")}</span></div>
          ${word.relatedSynonyms?.length ? `<div class="answer-row"><span class="answer-label">其它近义词</span><span class="answer-value">${word.relatedSynonyms.map(esc).join(" · ")}</span></div>` : ""}
          <div class="answer-row"><span class="answer-label">常考词义</span><span class="answer-value">${esc(word.chinese)}</span></div>
          ${word.ieltsMeaning ? `<div class="answer-row"><span class="answer-label">阅读提示</span><span class="answer-value">${esc(word.ieltsMeaning)}</span></div>` : ""}
          ${word.example ? `<div class="answer-row"><span class="answer-label">例句</span><span class="answer-value example">${esc(word.example)}</span></div>` : ""}
        </div>
        <div class="rating-box" id="ratingBox" hidden>
          <p class="rating-hint" id="ratingHint">这次回忆有多轻松？</p>
          <div class="rating-grid">
            ${ratingButton(item.cardId, 1, "忘了", "Again")}
            ${ratingButton(item.cardId, 2, "困难", "Hard")}
            ${ratingButton(item.cardId, 3, "记住", "Good")}
            ${ratingButton(item.cardId, 4, "太简单", "Easy")}
          </div>
        </div>
      </div>`;

    $("speakBtn").onclick = () => speak(word.word);
    document.querySelectorAll(".option").forEach((btn) => {
      btn.onclick = () => handleChoice(btn, q.correct, item, word);
    });
  }

  function ratingButton(cardId, grade, zh, en) {
    const cls = ["", "again", "hard", "good", "easy"][grade];
    return `<button class="rating ${cls}" data-grade="${grade}">${zh}<small>${en} · ${preview(cardId, grade)}</small></button>`;
  }

  function handleChoice(btn, correct, item, word) {
    if (session.answered) return;
    session.answered = true;
    const picked = btn.dataset.option;
    const ok = picked === correct;
    const c = card(item.cardId);

    document.querySelectorAll(".option").forEach((b) => {
      b.disabled = true;
      if (b.dataset.option === correct) b.classList.add("correct");
      if (b === btn && !ok) b.classList.add("wrong");
    });

    if (ok) c.correct++;
    else c.wrong++;

    $("answerZone").hidden = false;
    $("ratingBox").hidden = false;

    if (!ok) {
      $("ratingHint").textContent = "答错：自动按“忘了”记录，并在本轮再次出现。";
      document.querySelectorAll(".rating").forEach((r) => {
        if (Number(r.dataset.grade) !== 1) {
          r.disabled = true;
          r.style.opacity = "0.4";
        }
      });
    }

    document.querySelectorAll(".rating").forEach((r) => {
      r.onclick = () => finishCard(item, Number(ok ? r.dataset.grade : 1), ok);
    });
  }

  function finishCard(item, grade, ok) {
    const c = card(item.cardId);
    const wasNew = !c.reps;
    schedule(c, grade, true);
    logDaily(ok, wasNew);
    session.queue.shift();
    if (grade === 1) requeue(item);
    session.done++;
    save();
    renderAll();
  }

  function speak(text) {
    if (!("speechSynthesis" in window)) return toast("当前浏览器不支持朗读");
    speechSynthesis.cancel();
    const u = new SpeechSynthesisUtterance(text);
    u.lang = "en-GB";
    u.rate = 0.86;
    speechSynthesis.speak(u);
  }

  let filterGroup = "all";

  function renderFilters() {
    const items = [
      { id: "all", label: `全部 ${DATA.counts.primaryWords}` },
      ...DATA.groups.map((g) => ({ id: String(g.id), label: `第${g.id}类 ${g.words.length}` }))
    ];
    $("deckFilter").innerHTML = items.map((x) => `<button class="filter-button ${filterGroup === x.id ? "active" : ""}" data-group="${x.id}">${esc(x.label)}</button>`).join("");
    document.querySelectorAll(".filter-button").forEach((b) => {
      b.onclick = () => {
        filterGroup = b.dataset.group;
        renderFilters();
        renderLibrary();
      };
    });
  }

  function renderLibrary() {
    const q = ($("librarySearch").value || "").trim().toLowerCase();
    let words = allWords.filter((w) => filterGroup === "all" || String(w.groupId) === filterGroup);
    if (q) {
      words = words.filter((w) =>
        w.word.toLowerCase().includes(q) ||
        w.chinese.includes(q) ||
        w.synonyms.some((s) => s.toLowerCase().includes(q))
      );
    }

    const visible = words.slice(0, 180);
    $("libraryList").innerHTML = visible.length ? visible.map((w) => {
      const c = state.cards[w.cardId];
      return `<article class="library-item" data-card="${attr(w.cardId)}">
        <div class="library-item-top">
          <div><span class="library-word">${esc(w.word)}</span><span class="library-pos">${esc(w.pos)}</span></div>
          <span class="memory-badge">${esc(memoryLabel(c))}</span>
        </div>
        <div class="library-cn">${esc(w.chinese)}</div>
        <div class="library-syn">命题替换：${(w.examSynonyms || []).slice(0, 5).map(esc).join(" · ")}</div>
      </article>`;
    }).join("") : '<div class="empty-state" style="min-height:220px"><p>没有匹配的词。</p></div>';

    document.querySelectorAll(".library-item").forEach((el) => {
      el.onclick = () => {
        session = { queue: [{ cardId: el.dataset.card, reason: "单词查看" }], total: 1, done: 0, active: true, answered: false };
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
    $("statMastered").textContent = learned.filter((c) => c.stability >= 21 && retrievability(c) >= 0.9).length;
    const avgS = learned.length ? learned.reduce((a, c) => a + c.stability, 0) / learned.length : 0;
    $("statAvgStability").textContent = learned.length ? `${avgS.toFixed(1)} 天` : "—";

    const weak = allWords
      .filter((w) => state.cards[w.cardId]?.reps)
      .map((w) => ({ w, c: state.cards[w.cardId], score: weakScore(w) }))
      .sort((a, b) => b.score - a.score)
      .slice(0, 10);

    $("weakList").innerHTML = weak.length ? weak.map(({ w, c, score }) => `
      <div class="weak-row">
        <div><strong>${esc(w.word)} <small>${esc(w.chinese)}</small></strong><small>错误 ${c.wrong} · 遗忘 ${c.lapses} · 回忆率 ${Math.round(retrievability(c) * 100)}%</small></div>
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
    const blob = new Blob([JSON.stringify({ app: "IELT Memory", version: 3, exportedAt: new Date().toISOString(), state }, null, 2)], { type: "application/json" });
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
    session = { queue: [], total: 0, done: 0, active: false, answered: false };
    syncSettings();
    renderAll();
    toast("学习记录已清空");
  }

  function syncSettings() {
    $("dailyNewInput").value = state.settings.dailyNew;
    $("retentionInput").value = String(state.settings.targetRetention);
    $("repeatGapInput").value = state.settings.repeatGap;
  }

  function saveSettings() {
    state.settings.dailyNew = clamp(Number($("dailyNewInput").value) || 0, 0, 100);
    state.settings.targetRetention = clamp(Number($("retentionInput").value) || 0.9, 0.80, 0.97);
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
  syncSettings();
  bind();
  renderAll();
})();
