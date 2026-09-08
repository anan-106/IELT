// IELT Memory data layer v2.1: audited 538 core + NAWL academic expansion.
(() => {
  "use strict";
  const RAW = window.__538_DATA__;
  const ACADEMIC_RAW = window.__IELT_ACADEMIC_DATA__ || { words: [] };
  if (!RAW) return;

  const edition = {
    title: "剑桥雅思阅读考点词真经538（机考笔试综合版）",
    primaryWords: 376,
    extraTargets: 162,
    totalTargets: 538,
    groups: [
      { id: 1, primary: 20, extraTargets: 34, total: 54, mastery: "滚瓜烂熟", hitRate: "90%" },
      { id: 2, primary: 100, extraTargets: 71, total: 171, mastery: "熟记10遍以上", hitRate: "60%" },
      { id: 3, primary: 256, extraTargets: 57, total: 313, mastery: "熟记5遍以上", hitRate: "真题考查词" }
    ]
  };

  // source* keeps what the source table shows; standard fields are learner-normalized.
  const PATCH = {
    28: { sourcePos: "n.", pos: "v.", note: "来源表将 compensate 排为 n.；学习层按 v. 规范。" },
    60: { sourcePos: "v.", pos: "adj.", note: "来源表将 extinct 排为 v.；学习层按 adj. 规范。" },
    70: { sourceSynonyms: ["principle", "main"], quizSynonyms: ["principal", "main"], note: "来源表为 principle / main；学习测验用 principal / main，并保留来源原貌。" },
    98: { quizSynonyms: ["initial", "first"], note: "部分文本提取为 fist；扫描表支持 first。" },
    109: { sourceSynonyms: ["quit", "give up", "forsake", "derelict"], quizSynonyms: ["quit", "give up", "forsake", "derelict"], note: "补回新版表中的 derelict。" },
    179: { sourcePos: "n.", pos: "v.", note: "来源表将 designate 排为 n.；学习层按 appoint 对应的 v. 规范。" },
    228: { sourceWord: "harbor", word: "harbour", aliases: ["harbor"], note: "新版公开文本用 harbor；扫描版用 harbour，项目默认英式拼写。" }
  };

  const SPELLING = {
    recognize: ["recognise"], analyze: ["analyse"], emphasize: ["emphasise"],
    minimize: ["minimise"], harbor: ["harbour"], harbour: ["harbor"],
    skepticism: ["scepticism"], installment: ["instalment"],
    encyclopaedia: ["encyclopedia"], odour: ["odor"], paralyse: ["paralyze"],
    plagiarise: ["plagiarize"], fertiliser: ["fertilizer"],
    organise: ["organize"], organize: ["organise"], "co-ordinate": ["coordinate"],
    fulfill: ["fulfil"]
  };

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[.…]/g, "...").replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const cleanWord = (v) => String(v || "").replace(/\*+$/g, "").trim();
  const uniq = (items = []) => {
    const out = [];
    for (const value of items) {
      const text = String(value ?? "").trim();
      if (text && !out.some((x) => norm(x) === norm(text))) out.push(text);
    }
    return out;
  };

  function normalizeCore(raw, groupId) {
    const id = Number(raw.id);
    const p = PATCH[id] || {};
    const originalWord = cleanWord(raw.word);
    const word = p.word || originalWord;
    const sourceSynonyms = uniq(p.sourceSynonyms || raw.synonyms || []);
    const quizSynonyms = uniq(p.quizSynonyms || sourceSynonyms);
    const aliases = uniq([
      ...(SPELLING[word] || []), ...(SPELLING[originalWord] || []), ...(p.aliases || []),
      ...(word !== originalWord ? [originalWord] : []), ...(word !== raw.word ? [raw.word] : [])
    ]);
    return {
      id, rank: id, cardId: `reading538-g${groupId}-${id}`,
      deckId: "reading538", deckName: "新版 538", quizMode: "synonym", groupId,
      word, sourceWord: p.sourceWord || originalWord, aliases,
      pos: p.pos || raw.pos || "", sourcePos: p.sourcePos || raw.pos || "",
      chinese: raw.chinese || "", sourceSynonyms, quizSynonyms,
      examSynonyms: quizSynonyms, relatedSynonyms: [], synonyms: sourceSynonyms,
      ieltsMeaning: raw.ieltsMeaning || "", example: raw.example || "",
      source: "reading538-new-edition", verification: "row-order-and-synonym-column-checked",
      sourceNote: p.note || ""
    };
  }

  const groups = RAW.groups.map((g, i) => {
    const meta = edition.groups[i];
    const groupId = i + 1;
    return {
      ...meta, deckId: "reading538", name: `第${groupId}类`, legacyName: g.name || "",
      description: g.description || "",
      words: (g.words || []).slice(0, meta.primary).map((w) => normalizeCore(w, groupId))
    };
  });
  const allPrimaryWords = groups.flatMap((g) => g.words);

  const expected = Array.from({ length: 376 }, (_, i) => i + 1);
  const ids = allPrimaryWords.map((w) => w.id);
  const audit = {
    checkedPrimaryWords: allPrimaryWords.length,
    idsContinuous: expected.every((id, i) => ids[i] === id),
    groupCounts: groups.map((g) => g.words.length),
    expectedGroupCounts: [20, 100, 256],
    missingWord: allPrimaryWords.filter((w) => !w.word).map((w) => w.id),
    missingChinese: allPrimaryWords.filter((w) => !w.chinese).map((w) => w.id),
    missingSynonyms: allPrimaryWords.filter((w) => !w.sourceSynonyms.length).map((w) => w.id),
    patchedSourceRows: Object.keys(PATCH).map(Number)
  };
  audit.ok = audit.checkedPrimaryWords === 376 && audit.idsContinuous &&
    audit.groupCounts.join(",") === "20,100,256" && !audit.missingWord.length &&
    !audit.missingChinese.length && !audit.missingSynonyms.length;
  console[audit.ok ? "info" : "error"](audit.ok ? "[IELT data audit passed]" : "[IELT data audit failed]", audit);

  // Academic: NAWL Top 200, automatically remove exact overlaps with 538 words/aliases.
  const coreNames = new Set();
  allPrimaryWords.forEach((w) => {
    coreNames.add(norm(w.word));
    (w.aliases || []).forEach((a) => coreNames.add(norm(a)));
  });
  const academicWords = (ACADEMIC_RAW.words || [])
    .filter((x) => !coreNames.has(norm(x.word)))
    .map((x) => ({
      id: `nawl-${x.rank}`, rank: Number(x.rank), cardId: `academic-nawl-${x.rank}`,
      deckId: "academic", deckName: "Academic · NAWL", quizMode: "meaning", groupId: "academic",
      word: x.word, sourceWord: x.word, aliases: [], pos: x.pos || "", sourcePos: x.pos || "",
      chinese: x.chinese || "", sourceSynonyms: [], quizSynonyms: [], examSynonyms: [],
      relatedSynonyms: [], synonyms: [], ieltsMeaning: "NAWL 学术高频词，用于雅思阅读学术语境扩展。",
      example: "", source: "NAWL-1.2",
      sourceNote: "中文释义为本项目自行整理；rank / word / PoS 来自 NAWL 1.2。"
    }));
  const academic = {
    id: "academic", name: ACADEMIC_RAW.name || "Academic · NAWL Top 200",
    description: ACADEMIC_RAW.description || "NAWL 1.2 高频学术词扩展",
    source: ACADEMIC_RAW.source || null, rawCount: (ACADEMIC_RAW.words || []).length,
    uniqueCount: academicWords.length,
    removedAsCoreOverlap: (ACADEMIC_RAW.words || []).length - academicWords.length,
    words: academicWords
  };
  const allWords = [...allPrimaryWords, ...academicWords];

  window.__IELT_DATA_V2__ = {
    version: "2.1", edition, groups, allPrimaryWords, academic, allWords, audit,
    counts: {
      primaryWords: allPrimaryWords.length, extraTargets: edition.extraTargets,
      totalTargets: edition.totalTargets, groupPrimary: groups.map((g) => g.words.length),
      groupTargets: groups.map((g) => g.total), academicRaw: academic.rawCount,
      academicUnique: academic.uniqueCount, academicOverlapRemoved: academic.removedAsCoreOverlap,
      studyCards: allWords.length
    }
  };
})();
