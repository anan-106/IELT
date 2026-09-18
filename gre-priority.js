// Cross-list GRE priority layer.
// Main lexicon: 再要你命3000 only. Magoosh / 霍V6 / 佛脚 are overlap signals, not extra cards.
(() => {
  "use strict";
  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  const CACHE_KEY = "gre-priority-cache-v1";
  const CACHE_VERSION = "2026-09-17-v2";
  const RELOAD_FLAG = "gre-priority-reloaded-v2";
  const STATE_KEY = "gre-prep-v1";
  const FOJIAO_URL = "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-%E4%BD%9B%E8%84%9A%E8%AF%8D%E6%B1%87/L-GRE-%E4%BD%9B%E8%84%9A%E8%AF%8D%E6%B1%87/L-GRE-%E4%BD%9B%E8%84%9A%E8%AF%8D%E8%A1%A8.csv";
  const HUO_URL = "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87-%E9%9C%8DV6/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87-%E9%9C%8DV6.CSV";

  const norm = (v) => String(v ?? "").replace(/^\uFEFF/, "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const esc = (v) => String(v ?? "").replaceAll("&", "&amp;").replaceAll("<", "&lt;").replaceAll(">", "&gt;").replaceAll('"', "&quot;").replaceAll("'", "&#039;");

  function parseCSV(text) {
    const rows = []; let row = [], field = "", quoted = false;
    const s = String(text || "").replace(/^\uFEFF/, "");
    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quoted) {
        if (ch === '"') { if (s[i + 1] === '"') { field += '"'; i++; } else quoted = false; }
        else field += ch;
      } else if (ch === '"') quoted = true;
      else if (ch === ',') { row.push(field); field = ""; }
      else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
      else field += ch;
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    return rows;
  }

  function readCache() {
    try {
      const x = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return x && x.version === CACHE_VERSION && Array.isArray(x.fojiao) && x.huoRefs ? x : null;
    } catch { return null; }
  }

  function readStudyState() {
    try { return JSON.parse(localStorage.getItem(STATE_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function getFojiaoSet(rows) {
    const set = new Set();
    for (const r of rows) {
      const word = String(r[0] || "").trim();
      if (!word || /^list\d+$/i.test(word) || /^(单词|word)$/i.test(word)) continue;
      set.add(norm(word));
    }
    return set;
  }

  function getHuoRefs(rows) {
    const map = new Map();
    for (let i = 1; i < rows.length; i++) {
      const r = rows[i];
      const word = String(r[3] || "").trim();
      if (!word) continue;
      const k = norm(word);
      const ref = `${String(r[1] || "").trim()}/${String(r[2] || "").trim()}`.replace(/^\/$/, "");
      if (!map.has(k)) map.set(k, new Set());
      if (ref) map.get(k).add(ref);
    }
    return new Map([...map].map(([k, set]) => [k, [...set]]));
  }

  function priorityTier(score) {
    if (score >= 8) return "S";
    if (score >= 5) return "A";
    if (score >= 3) return "B";
    return "C";
  }

  function applyPriority(fojiaoSet, huoRefsMap = new Map()) {
    const base = (DATA.words || []).filter(w => (w.sourceTags || []).includes("再要你命3000"));
    if (base.length < 500) return false;

    base.forEach((w, idx) => {
      const tags = new Set(w.sourceTags || []);
      const magoosh = tags.has("Magoosh");
      const refs = huoRefsMap.get(norm(w.word)) || (Array.isArray(w.examRefs) ? [...new Set(w.examRefs.filter(Boolean))] : []);
      const huo = tags.has("霍V6") || refs.length > 0;
      const fojiao = fojiaoSet.has(norm(w.word));
      const repeatBonus = huo ? Math.min(2, Math.max(0, refs.length - 1)) : 0;
      const score = 1 + (magoosh ? 2 : 0) + (huo ? 3 : 0) + (fojiao ? 2 : 0) + repeatBonus;
      const tier = priorityTier(score);
      if (huo) tags.add("霍V6");
      if (fojiao) tags.add("佛脚");

      w.sourceTags = [...tags].filter(x => x !== "starter");
      w.examRefs = refs;
      w.priorityScore = score;
      w.priorityTier = tier;
      w.crossHitCount = Number(magoosh) + Number(huo) + Number(fojiao);
      w.huoHitCount = refs.length || Number(huo);
      w.prioritySignals = { magoosh, huoV6: huo, fojiao, huoRepeatBonus: repeatBonus };
      w.priorityLabel = `${tier} · ${score}分`;
      w.level = tier === "S" || tier === "A" ? 1 : tier === "B" ? 2 : 3;
      w._priorityStableIndex = idx;
    });

    base.sort((a, b) =>
      (b.priorityScore || 0) - (a.priorityScore || 0) ||
      (b.crossHitCount || 0) - (a.crossHitCount || 0) ||
      (b.huoHitCount || 0) - (a.huoHitCount || 0) ||
      (a._priorityStableIndex || 0) - (b._priorityStableIndex || 0)
    );
    base.forEach(w => delete w._priorityStableIndex);
    DATA.words.splice(0, DATA.words.length, ...base);

    const tiers = Object.fromEntries(["S","A","B","C"].map(t => [t, base.filter(w => w.priorityTier === t).length]));
    const meta = {
      ...(DATA.greCnMeta || {}), count: base.length, mainDeck: "再要你命3000", tiers,
      magooshHits: base.filter(w => w.prioritySignals?.magoosh).length,
      huoV6Hits: base.filter(w => w.prioritySignals?.huoV6).length,
      fojiaoHits: base.filter(w => w.prioritySignals?.fojiao).length,
      tripleHits: base.filter(w => w.crossHitCount === 3).length,
      priorityModel: "D3K base=1; Magoosh +2; HuoV6 +3; Fojiao +2; Huo repeated refs +0..2",
      priorityIsOfficialFrequency: false
    };
    DATA.greCnMeta = meta;
    window.dispatchEvent(new CustomEvent("gre-priority-ready", { detail: meta }));
    renderMeta(meta); renderPriorityLibrary(); annotateStudyCard();
    return true;
  }

  function renderMeta(meta = DATA.greCnMeta || {}) {
    const chip = document.getElementById("greCnSourceChip");
    if (chip && meta.tiers) {
      chip.textContent = `大三千 ${Number(meta.count || 0).toLocaleString()} · S${meta.tiers.S}/A${meta.tiers.A}`;
      chip.title = "大三千为完整主词库；Magoosh +2、霍V6 +3、佛脚 +2；霍V6重复题位最多再+2。该分数是交叉命中优先级，不是ETS官方词频。";
    }
    const p = document.querySelector("#view-vocab .section-head p");
    if (p) p.textContent = "大三千完整主词库 · Magoosh / 霍V6 / 佛脚交叉命中排序 · 艾宾浩斯复习";
  }

  let tierFilter = "all";
  function renderPriorityLibrary() {
    const view = document.getElementById("view-vocab");
    if (!view?.classList.contains("active") || !DATA.words.some(w => w.priorityTier)) return;
    const search = document.getElementById("vocabSearch"), filters = document.getElementById("vocabFilters"), list = document.getElementById("vocabList");
    if (!filters || !list) return;
    const q = norm(search?.value || ""), state = readStudyState(), cards = state.vocab || {}, tiers = ["S","A","B","C"];
    const counts = Object.fromEntries(tiers.map(t => [t, DATA.words.filter(w => w.priorityTier === t).length]));
    const words = DATA.words.filter(w => (tierFilter === "all" || w.priorityTier === tierFilter) && (!q || norm(`${w.word} ${w.cn} ${(w.syn || []).join(" ")} ${(w.sourceTags || []).join(" ")}`).includes(q)));
    filters.innerHTML = ["all", ...tiers].map(t => `<button class="chip ${tierFilter === t ? "active" : ""}" data-priority-tier="${t}">${t === "all" ? `全部 ${DATA.words.length}` : `${t}级 ${counts[t]}`}</button>`).join("");
    filters.querySelectorAll("[data-priority-tier]").forEach(b => b.onclick = () => { tierFilter = b.dataset.priorityTier; renderPriorityLibrary(); });
    list.innerHTML = words.map(w => {
      const c = cards[w.id] || {}, sources = (w.sourceTags || []).filter(x => x !== "再要你命3000"), sourceText = sources.length ? `大三千 · ${sources.join(" · ")}` : "仅大三千", refs = (w.examRefs || []).filter(Boolean).slice(0, 3).join(" · ");
      return `<article class="word-row"><span class="level">${esc(w.priorityTier || "C")}</span><strong>${esc(w.word)}</strong><div class="cn">${esc(w.cn)}</div><div class="syn">${(w.syn || []).map(esc).join(" · ")}</div><div class="syn" style="margin-top:5px"><strong>优先级 ${Number(w.priorityScore || 1)} 分</strong> · ${esc(sourceText)}${refs ? ` · 霍V6 ${esc(refs)}` : ""}</div><div class="syn" style="margin-top:5px">${c.reps ? `已复习 ${c.reps} 次 · 错 ${c.wrong || 0}` : "未学习"}</div></article>`;
    }).join("");
  }

  function annotateStudyCard() {
    const card = document.querySelector("#studyCard .qcard[data-mode='vocab']"); if (!card) return;
    const wordText = card.dataset.word || card.querySelector(".word")?.textContent?.trim(); if (!wordText) return;
    const w = DATA.words.find(x => norm(x.word) === norm(wordText)); if (!w?.priorityTier) return;
    const badge = card.querySelector(".badge");
    if (badge && !badge.dataset.priorityDone) { badge.dataset.priorityDone = "1"; badge.textContent = badge.textContent.replace(/\s*·\s*Level\s*\d+\s*$/i, "") + ` · ${w.priorityTier}级 ${w.priorityScore}分`; }
    if (!card.querySelector(".priority-source-line")) {
      const line = document.createElement("div"); line.className = "pronounce priority-source-line";
      const extra = (w.sourceTags || []).filter(x => x !== "再要你命3000");
      line.textContent = `来源：大三千${extra.length ? " · " + extra.join(" · ") : ""}（交叉命中优先级，非官方词频）`;
      card.querySelector(".pronounce")?.insertAdjacentElement("afterend", line);
    }
  }

  function bindUI() {
    document.querySelector("[data-view='vocab']")?.addEventListener("click", () => setTimeout(renderPriorityLibrary, 0));
    document.getElementById("vocabSearch")?.addEventListener("input", () => setTimeout(renderPriorityLibrary, 0));
    new MutationObserver(() => requestAnimationFrame(annotateStudyCard)).observe(document.getElementById("studyCard") || document.body, { childList: true, subtree: true });
  }

  const cached = readCache();
  const cachedSet = cached ? new Set(cached.fojiao) : null;
  const cachedHuo = cached ? new Map(Object.entries(cached.huoRefs || {})) : new Map();
  if (cachedSet) applyPriority(cachedSet, cachedHuo);
  window.addEventListener("gre-cn-data-ready", () => { if (cachedSet) applyPriority(cachedSet, cachedHuo); });

  async function refreshSources() {
    try {
      const [fRes, hRes] = await Promise.all([fetch(FOJIAO_URL, { cache: "no-store" }), fetch(HUO_URL, { cache: "no-store" })]);
      if (!fRes.ok) throw new Error(`佛脚 ${fRes.status}`); if (!hRes.ok) throw new Error(`霍V6 ${hRes.status}`);
      const set = getFojiaoSet(parseCSV(await fRes.text()));
      const huoMap = getHuoRefs(parseCSV(await hRes.text()));
      const huoObj = Object.fromEntries(huoMap);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, fojiao: [...set], huoRefs: huoObj, updatedAt: Date.now() }));
      const applied = applyPriority(set, huoMap);
      if (applied && !cached && sessionStorage.getItem(RELOAD_FLAG) !== "1") { sessionStorage.setItem(RELOAD_FLAG, "1"); location.reload(); }
    } catch (e) { console.warn("[GRE priority] 交叉词表同步失败；继续使用已有优先级", e); }
  }

  bindUI(); refreshSources();
  window.__GRE_PRIORITY__ = { applyPriority, renderPriorityLibrary, model: "D3K + Magoosh/HuoV6/Fojiao overlap" };
})();