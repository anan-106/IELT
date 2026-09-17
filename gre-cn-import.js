// GRE-CN vocabulary integration for the GRE prep branch.
// Source repo: https://github.com/LER0ever/GRE-CN
// CSV/text/code in that repository are published under BSD-3-Clause per its README/LICENSE.
// This loader uses only CSV vocabulary sources; it does not embed or adapt the PDF/Office materials.
(() => {
  "use strict";

  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  const CACHE_KEY = "gre-cn-vocab-cache-v1";
  const CACHE_VERSION = "2026-09-17-v1";
  const RELOAD_FLAG = "gre-cn-import-reloaded-v1";

  const SOURCES = {
    zy3000: "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-%E5%86%8D%E8%A6%81%E4%BD%A0%E5%91%BD3000/L-GRE-%E5%86%8D%E8%A6%81%E4%BD%A0%E5%91%BD3000%E9%A1%BA%E5%BA%8F%E7%89%88/L-GRE-%E5%86%8D%E8%A6%81%E4%BD%A0%E5%91%BD3000.csv",
    magoosh: "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-Magoosh/L-GRE-MagooshFlashcard.csv",
    huoV6: "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87-%E9%9C%8DV6/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87-%E9%9C%8DV6.CSV",
    huoSynV6: "https://raw.githubusercontent.com/LER0ever/GRE-CN/master/L-GRE-%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87/L-GRE-%E6%9C%BA%E7%BB%8F%E8%AF%8D%E6%B1%87-%E9%9C%8DV6/L-GRE-%E5%90%8C%E4%B9%89%E8%AF%8D%E4%B9%B1%E5%BA%8F-%E9%9C%8DV6.csv"
  };

  const norm = (v) => String(v ?? "")
    .replace(/^\uFEFF/, "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  function parseCSV(text) {
    const rows = [];
    let row = [];
    let field = "";
    let quoted = false;
    const s = String(text || "").replace(/^\uFEFF/, "");

    for (let i = 0; i < s.length; i++) {
      const ch = s[i];
      if (quoted) {
        if (ch === '"') {
          if (s[i + 1] === '"') { field += '"'; i++; }
          else quoted = false;
        } else field += ch;
      } else {
        if (ch === '"') quoted = true;
        else if (ch === ',') { row.push(field); field = ""; }
        else if (ch === '\n') { row.push(field.replace(/\r$/, "")); rows.push(row); row = []; field = ""; }
        else field += ch;
      }
    }
    if (field.length || row.length) { row.push(field.replace(/\r$/, "")); rows.push(row); }
    return rows.filter(r => r.some(x => String(x || "").trim()));
  }

  function compactChinese(value) {
    let s = String(value || "").replace(/^\uFEFF/, "").trim();
    if (!s) return "";
    s = s.replace(/\r/g, "").split("\n").map(x => x.trim()).filter(Boolean).slice(0, 3).join("；");
    s = s.replace(/\s{2,}[A-Za-z][\s\S]*$/, "").trim();
    if (s.length > 90) s = s.slice(0, 90).replace(/[，,;；:\s]+$/, "");
    return s;
  }

  function compactSyn(value) {
    const raw = String(value || "")
      .replace(/^\d+\./gm, "")
      .split(/[\n;,/]+/)
      .map(x => x.trim())
      .filter(Boolean)
      .filter(x => /^[A-Za-z][A-Za-z '\-().]{0,55}$/.test(x));
    const out = [];
    for (const x of raw) {
      if (!out.some(y => norm(y) === norm(x))) out.push(x);
      if (out.length >= 5) break;
    }
    return out;
  }

  function readCache() {
    try {
      const x = JSON.parse(localStorage.getItem(CACHE_KEY) || "null");
      return x && x.version === CACHE_VERSION && Array.isArray(x.words) ? x : null;
    } catch { return null; }
  }

  function applyWords(words, meta = {}) {
    if (!Array.isArray(words) || !words.length) return;
    DATA.words.splice(0, DATA.words.length, ...words);
    DATA.greCnMeta = meta;
    window.dispatchEvent(new CustomEvent("gre-cn-data-ready", { detail: meta }));
  }

  function showStatus(meta, loading = false) {
    const render = () => {
      const hero = document.querySelector(".hero-side");
      if (!hero) return;
      let chip = document.getElementById("greCnSourceChip");
      if (!chip) {
        chip = document.createElement("div");
        chip.id = "greCnSourceChip";
        chip.className = "streak";
        hero.appendChild(chip);
      }
      chip.textContent = loading
        ? "GRE-CN 词库同步中…"
        : `GRE-CN 词库 ${Number(meta?.count || DATA.words.length).toLocaleString()} 词`;
      chip.title = "数据源：LER0ever/GRE-CN 的 CSV 词汇资料；已缓存到当前浏览器";
    };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", render, { once: true });
    else render();
  }

  const cached = readCache();
  if (cached) {
    applyWords(cached.words, cached.meta || { count: cached.words.length, cached: true });
    showStatus(cached.meta || { count: cached.words.length });
  } else {
    showStatus({ count: DATA.words.length }, true);
  }

  async function fetchText(url) {
    const r = await fetch(url, { cache: "no-store" });
    if (!r.ok) throw new Error(`${r.status} ${r.statusText}`);
    return await r.text();
  }

  function buildMerged(zyText, magText, huoText, huoSynText) {
    const starter = new Map((DATA.words || []).map(w => [norm(w.word), { ...w, sourceTags: ["starter"] }]));
    const base = new Map();

    for (const r of parseCSV(zyText)) {
      const word = String(r[0] || "").replace(/^\uFEFF/, "").trim();
      if (!word || /^(单词|word)$/i.test(word)) continue;
      const k = norm(word);
      const cn = compactChinese(r[1]);
      const syn = compactSyn(r[2]);
      if (!k || !cn) continue;
      base.set(k, {
        id: `grecn-${k.replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || base.size + 1}`,
        word,
        cn,
        syn,
        level: 3,
        pos: "",
        deck: "vocab",
        sourceTags: ["再要你命3000"],
        sourceDefinition: String(r[2] || "").trim()
      });
    }

    const mag = new Map();
    for (const r of parseCSV(magText)) {
      const word = String(r[0] || "").replace(/^\uFEFF/, "").trim();
      if (!word) continue;
      const k = norm(word);
      mag.set(k, {
        definition: String(r[1] || "").trim(),
        example: String(r[2] || "").trim()
      });
      if (!base.has(k)) {
        const def = String(r[1] || "").trim();
        base.set(k, {
          id: `grecn-${k.replace(/[^a-z0-9]+/g, "-") || base.size + 1}`,
          word,
          cn: def ? `英文释义：${def}` : "待补中文义",
          syn: [], level: 2, pos: "", deck: "vocab",
          sourceTags: ["Magoosh"], sourceDefinition: def, example: String(r[2] || "").trim()
        });
      }
    }

    const examMap = new Map();
    const huoRows = parseCSV(huoText);
    for (let i = 1; i < huoRows.length; i++) {
      const r = huoRows[i];
      const word = String(r[3] || "").trim();
      if (!word) continue;
      const k = norm(word);
      examMap.set(k, { ipa: String(r[4] || "").trim(), cn: compactChinese(r[5]), section: r[1] || "", question: r[2] || "" });
      if (!base.has(k)) {
        const cn = compactChinese(r[5]);
        if (cn) base.set(k, {
          id: `grecn-${k.replace(/[^a-z0-9]+/g, "-") || base.size + 1}`,
          word, cn, syn: [], level: 1, pos: "", deck: "vocab",
          sourceTags: ["霍V6"], ipa: String(r[4] || "").trim(), examRefs: [`${r[1] || ""}/${r[2] || ""}`]
        });
      }
    }

    const synRows = parseCSV(huoSynText);
    for (let i = 1; i < synRows.length; i++) {
      const r = synRows[i];
      const word = String(r[1] || "").trim();
      if (!word) continue;
      const k = norm(word);
      if (!base.has(k)) {
        const cn = compactChinese(r[3]);
        if (cn) base.set(k, {
          id: `grecn-${k.replace(/[^a-z0-9]+/g, "-") || base.size + 1}`,
          word, cn, syn: [], level: 1, pos: "", deck: "vocab",
          sourceTags: ["霍V6同义词"], ipa: String(r[2] || "").trim()
        });
      }
    }

    for (const [k, w] of base) {
      const m = mag.get(k);
      if (m) {
        w.level = Math.min(w.level || 3, 2);
        w.sourceTags = [...new Set([...(w.sourceTags || []), "Magoosh"])];
        w.definition = m.definition;
        w.example = m.example;
      }
      const e = examMap.get(k);
      if (e) {
        w.level = 1;
        w.sourceTags = [...new Set([...(w.sourceTags || []), "霍V6"])];
        w.ipa = e.ipa || w.ipa || "";
        if (e.cn && (!w.cn || /^英文释义：/.test(w.cn))) w.cn = e.cn;
        w.examRefs = [...new Set([...(w.examRefs || []), `${e.section}/${e.question}`])];
      }
      const s = starter.get(k);
      if (s) {
        w.level = Math.min(w.level || 3, Number(s.level) || 3);
        if (s.cn && !/^英文释义：/.test(s.cn)) w.cn = s.cn;
        if (Array.isArray(s.syn) && s.syn.length) w.syn = [...new Set([...(s.syn || []), ...(w.syn || [])])].slice(0, 6);
        w.sourceTags = [...new Set([...(w.sourceTags || []), "starter"])];
      }
    }

    for (const [k, s] of starter) {
      if (!base.has(k)) base.set(k, s);
    }

    const words = [...base.values()]
      .filter(w => w.word && w.cn)
      .sort((a, b) => (a.level || 3) - (b.level || 3) || a.word.localeCompare(b.word));

    const idSeen = new Map();
    for (const w of words) {
      const baseId = w.id || `grecn-${norm(w.word).replace(/[^a-z0-9]+/g, "-")}`;
      const n = (idSeen.get(baseId) || 0) + 1;
      idSeen.set(baseId, n);
      w.id = n === 1 ? baseId : `${baseId}-${n}`;
    }

    const meta = {
      count: words.length,
      level1: words.filter(w => w.level === 1).length,
      level2: words.filter(w => w.level === 2).length,
      level3: words.filter(w => w.level === 3).length,
      sources: ["再要你命3000", "Magoosh", "霍V6", "霍V6同义词"],
      updatedAt: Date.now(),
      sourceRepo: "LER0ever/GRE-CN"
    };
    return { words, meta };
  }

  async function refresh() {
    try {
      const [zy, mag, huo, huoSyn] = await Promise.all([
        fetchText(SOURCES.zy3000),
        fetchText(SOURCES.magoosh),
        fetchText(SOURCES.huoV6),
        fetchText(SOURCES.huoSynV6)
      ]);
      const merged = buildMerged(zy, mag, huo, huoSyn);
      localStorage.setItem(CACHE_KEY, JSON.stringify({ version: CACHE_VERSION, ...merged }));
      applyWords(merged.words, merged.meta);
      showStatus(merged.meta);

      if (!cached && sessionStorage.getItem(RELOAD_FLAG) !== "1") {
        sessionStorage.setItem(RELOAD_FLAG, "1");
        location.reload();
      }
    } catch (err) {
      console.warn("[GRE-CN import] Using existing cached/starter deck", err);
      showStatus(cached?.meta || { count: DATA.words.length });
    }
  }

  refresh();

  window.__GRE_CN_IMPORT__ = {
    sources: SOURCES,
    cacheKey: CACHE_KEY,
    refresh,
    meta: () => DATA.greCnMeta || null
  };
})();
