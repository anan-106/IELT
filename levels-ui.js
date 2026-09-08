// PDF-based level labels and per-level progress UI.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const STORAGE_KEY = "ielt-memory-v3";
  const DAY = 86400000;
  const LEVEL_META = {
    1: {
      label: "第1类考点词·超高频",
      shortLabel: "第1类·超高频",
      range: "1–20",
      hitRate: "约90%会被命题考查",
      mastery: "滚瓜烂熟",
      order: "严格按重要性排名学习",
      className: "level-1"
    },
    2: {
      label: "第2类考点词·重要考点",
      shortLabel: "第2类·重要考点",
      range: "21–120",
      hitRate: "约60%会被命题考查",
      mastery: "熟记10遍以上",
      order: "按重要性顺序学习",
      className: "level-2"
    },
    3: {
      label: "第3类考点词·真题考点",
      shortLabel: "第3类·真题考点",
      range: "121–376",
      hitRate: "真题中实际被考查过",
      mastery: "熟记5遍以上",
      order: "组内重要性一致，不再人为排高低",
      className: "level-3"
    }
  };

  const coreByCard = new Map((DATA.allPrimaryWords || []).map((w) => [w.cardId, w]));

  function readState() {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      return raw ? JSON.parse(raw) : { cards: {} };
    } catch {
      return { cards: {} };
    }
  }

  function retrievability(c, ts = Date.now()) {
    if (!c?.reps || !c.stability || !c.lastReview) return 0;
    const elapsed = Math.max(0, (ts - c.lastReview) / DAY);
    return Math.pow(0.9, elapsed / Math.max(0.05, c.stability));
  }

  function groupProgress(group, state) {
    const words = group.words || [];
    let learned = 0;
    let mastered = 0;
    for (const w of words) {
      const c = state.cards?.[w.cardId];
      if (c?.reps) learned++;
      if (c?.reps && c.stability >= 21 && retrievability(c) >= 0.9) mastered++;
    }
    const total = words.length || 1;
    return {
      total: words.length,
      learned,
      mastered,
      learnedPct: Math.round(learned / total * 100),
      masteredPct: Math.round(mastered / total * 100)
    };
  }

  function ensureProgressHost() {
    let host = document.getElementById("levelProgressHost");
    if (host) return host;
    const dashboard = document.querySelector(".dashboard");
    if (!dashboard) return null;
    host = document.createElement("section");
    host.id = "levelProgressHost";
    host.className = "level-progress-panel";
    host.setAttribute("aria-label", "538等级学习进度");
    dashboard.insertAdjacentElement("afterend", host);
    return host;
  }

  function renderLevelProgress() {
    const host = ensureProgressHost();
    if (!host) return;
    const state = readState();
    const progress = DATA.groups.map((group) => ({ group, p: groupProgress(group, state) }));
    const signature = progress.map(({ group, p }) => `${group.id}:${p.learned}:${p.mastered}:${p.total}`).join("|");
    if (host.dataset.signature === signature) return;
    host.dataset.signature = signature;

    const rows = progress.map(({ group, p }) => {
      const meta = LEVEL_META[group.id];
      return `
        <article class="level-progress-card ${meta.className}">
          <div class="level-progress-head">
            <div>
              <span class="level-chip ${meta.className}">${meta.label}</span>
              <small>${meta.range} · ${meta.hitRate} · ${meta.mastery}</small>
            </div>
            <strong>${p.learned}<span> / ${p.total}</span></strong>
          </div>
          <div class="level-track" title="已学习 ${p.learned} / ${p.total}">
            <div class="level-fill" style="width:${p.learnedPct}%"></div>
          </div>
          <div class="level-progress-foot">
            <span>已学习 ${p.learnedPct}%</span>
            <span>稳定掌握 ${p.mastered} · ${p.masteredPct}%</span>
          </div>
          <div class="level-progress-rule">${meta.order}</div>
        </article>`;
    }).join("");

    host.innerHTML = `
      <div class="level-progress-title">
        <div><span class="section-kicker">PDF LEVEL PROGRESS</span><h2>538 三类考点词进度</h2></div>
        <small>第1类优先 → 第2类 → 第3类；第3类组内不再区分重要性</small>
      </div>
      <div class="level-progress-grid">${rows}</div>`;
  }

  function setTextIfChanged(el, text) {
    if (el && el.textContent !== text) el.textContent = text;
  }

  function decorateTodaySummary() {
    const el = document.getElementById("todaySummary");
    if (!el) return;
    const state = readState();
    const next = (DATA.allPrimaryWords || []).find((w) => !state.cards?.[w.cardId]?.reps);
    const base = el.textContent.split(" · 当前新词优先：")[0];
    if (!next) {
      setTextIfChanged(el, `${base} · 538主词已全部进入记忆系统`);
      return;
    }
    const meta = LEVEL_META[next.groupId];
    setTextIfChanged(el, `${base} · 当前新词优先：${meta.shortLabel}（${meta.order}）`);
  }

  function decorateStudyCard() {
    const root = document.getElementById("studyCard");
    const title = root?.querySelector(".word-title");
    const badge = root?.querySelector(".deck-badge");
    if (!title || !badge) return;

    const wordText = title.textContent.trim();
    const word = (DATA.allPrimaryWords || []).find((w) => w.word === wordText || (w.aliases || []).includes(wordText));
    if (!word) return;

    const meta = LEVEL_META[word.groupId];
    badge.classList.add("pdf-level-badge", meta.className);
    setTextIfChanged(badge, `${meta.label} · #${word.id}`);

    const head = root.querySelector(".word-card-head");
    if (!head) return;
    let info = root.querySelector(".pdf-level-info");
    if (!info) {
      info = document.createElement("div");
      info.className = "pdf-level-info";
      head.insertAdjacentElement("afterend", info);
    }
    setTextIfChanged(info, `${meta.hitRate} · ${meta.mastery} · ${meta.order}`);
  }

  function decorateLibrary() {
    document.querySelectorAll("#libraryList .library-item").forEach((item) => {
      const word = coreByCard.get(item.dataset.card);
      if (!word) return;
      const meta = LEVEL_META[word.groupId];
      const top = item.querySelector(".library-item-top > div");
      if (!top) return;
      let chip = top.querySelector(".level-chip");
      if (!chip) {
        chip = document.createElement("span");
        top.appendChild(chip);
      }
      chip.className = `level-chip ${meta.className}`;
      setTextIfChanged(chip, meta.shortLabel);

      let rule = item.querySelector(".pdf-level-library-rule");
      if (!rule) {
        rule = document.createElement("div");
        rule.className = "pdf-level-library-rule";
        item.appendChild(rule);
      }
      setTextIfChanged(rule, `${meta.range} · ${meta.hitRate} · ${meta.mastery}`);
    });

    document.querySelectorAll("#deckFilter .filter-button").forEach((btn) => {
      const id = btn.dataset.deck;
      if (!/^g[123]$/.test(id || "")) return;
      const level = Number(id.slice(1));
      const group = DATA.groups.find((g) => g.id === level);
      const meta = LEVEL_META[level];
      if (group && meta) setTextIfChanged(btn, `${meta.shortLabel} · ${group.words.length}`);
    });
  }

  let scheduled = false;
  function refresh() {
    scheduled = false;
    renderLevelProgress();
    decorateTodaySummary();
    decorateStudyCard();
    decorateLibrary();
  }

  function scheduleRefresh() {
    if (scheduled) return;
    scheduled = true;
    requestAnimationFrame(refresh);
  }

  const observer = new MutationObserver(scheduleRefresh);
  observer.observe(document.body, { childList: true, subtree: true });
  window.addEventListener("storage", scheduleRefresh);
  document.addEventListener("click", () => setTimeout(scheduleRefresh, 0));

  refresh();
})();
