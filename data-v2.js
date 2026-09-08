// IELTS 阅读 538 · 新版数据层 v2.1
// 核心原则：
// 1) 376 个主考点词严格按 1..376 连续序号组织；
// 2) 538 = 376 个主词 + 162 个额外同义替换学习目标；
// 3) 不再对没有明确证据的“高亮/其它近义词”做人工猜分，书表同义词列完整保存在 sourceSynonyms；
// 4) 对新版公开文本中的明显排版/词性问题，保留 source 字段，同时给出 learner-normalized 字段；
// 5) Academic 扩展使用 NAWL 1.2 Top 200，并与 538 自动去重。

(() => {
  "use strict";

  const RAW = window.__538_DATA__;
  const ACADEMIC_RAW = window.__IELT_ACADEMIC_DATA__ || null;
  if (!RAW) return;

  const edition = {
    title: "剑桥雅思阅读考点词真经538（机考笔试综合版）",
    totalTargets: 538,
    primaryWords: 376,
    extraTargets: 162,
    groups: [
      { id: 1, primary: 20, extraTargets: 34, total: 54, mastery: "滚瓜烂熟", hitRate: "90%" },
      { id: 2, primary: 100, extraTargets: 71, total: 171, mastery: "熟记10遍以上", hitRate: "60%" },
      { id: 3, primary: 256, extraTargets: 57, total: 313, mastery: "熟记5遍以上", hitRate: "真题考查词" }
    ]
  };

  // 新版公开文本/扫描表中可确认的差异或排版问题。
  // source* = 资料原貌；标准字段 = 面向学习的规范形式。
  const sourcePatches = {
    28: {
      sourcePos: "n.",
      pos: "v.",
      note: "新版表将 compensate 词性排为 n.；学习层按常用词性 v. 规范。"
    },
    60: {
      sourcePos: "v.",
      pos: "adj.",
      note: "新版表将 extinct 词性排为 v.；学习层按常用词性 adj. 规范。"
    },
    70: {
      sourceSynonyms: ["principle", "main"],
      quizSynonyms: ["principal", "main"],
      note: "新版表在 primary 的同义替换栏出现 principle；学习测验使用语义对应更准确的 principal / main，同时保留原表字段。"
    },
    98: {
      quizSynonyms: ["initial", "first"],
      note: "部分公开文本提取为 fist；扫描表和旧版数据均支持 first，学习层采用 first。"
    },
    109: {
      sourceSynonyms: ["quit", "give up", "forsake", "derelict"],
      quizSynonyms: ["quit", "give up", "forsake", "derelict"],
      note: "新版 538 同义替换栏含 derelict，补回旧仓库遗漏项。"
    },
    179: {
      sourcePos: "n.",
      pos: "v.",
      note: "新版表将 designate 词性排为 n.；学习层按该义项 appoint 对应的 v. 规范。"
    },
    228: {
      sourceWord: "harbor",
      word: "harbour",
      aliases: ["harbor"],
      note: "新版公开文本使用 harbor；用户上传扫描版使用 harbour。项目默认英式 harbour，并保留美式别名。"
    }
  };

  const spellingAliases = {
    recognize: ["recognise"],
    analyze: ["analyse"],
    emphasize: ["emphasise"],
    minimize: ["minimise"],
    harbor: ["harbour"],
    harbour: ["harbor"],
    skepticism: ["scepticism"],
    installment: ["instalment"],
    encyclopaedia: ["encyclopedia"],
    odour: ["odor"],
    paralyse: ["paralyze"],
    plagiarise: ["plagiarize"],
    fertiliser: ["fertilizer"],
    organise: ["organize"],
    organize: ["organise"],
    co-ordinate: ["coordinate"],
    fulfill: ["fulfil"],
    wellbeing: ["well-being"]
  };

  function cleanStarWord(word) {
    return String(word || "").replace(/\*+$/g, "").trim();
  }

  function normText(v) {
    return String(v ?? "")
      .toLowerCase()
      .replace(/[.…]/g, "...")
      .replace(/[’‘]/g, "'")
      .replace(/\s+/g, " ")
      .trim();
  }

  function mergeWithoutDupes(items) {
    const out = [];
    for (const item of items || []) {
      const text = String(item ?? "").trim();
      if (!text) continue;
      if (!out.some((x) => normText(x) === normText(text))) out.push(text);
    }
    return out;
  }

  function normalizeWord(rawWord, groupId) {
    const id = Number(rawWord.id);
    const patch = sourcePatches[id] || {};
    const rawCanonical = cleanStarWord(rawWord.word);
    const canonicalWord = patch.word || rawCanonical;

    const sourceSynonyms = mergeWithoutDupes(
      patch.sourceSynonyms || rawWord.synonyms || []
    );
    const quizSynonyms = mergeWithoutDupes(
      patch.quizSynonyms || sourceSynonyms
    );

    const aliases = mergeWithoutDupes([
      ...(spellingAliases[canonicalWord] || []),
      ...(spellingAliases[rawCanonical] || []),
      ...(patch.aliases || []),
      ...(canonicalWord !== rawCanonical ? [rawCanonical] : []),
      ...(canonicalWord !== rawWord.word ? [rawWord.word] : [])
    ]);

    return {
      id,
      cardId: `reading538-g${groupId}-${id}`,
      deckId: "reading538",
      deckName: "新版 538",
      quizMode: "synonym",
      word: canonicalWord,
      sourceWord: patch.sourceWord || rawCanonical,
      aliases,
      pos: patch.pos || rawWord.pos || "",
      sourcePos: patch.sourcePos || rawWord.pos || "",
      chinese: rawWord.chinese || "",
      sourceSynonyms,
      quizSynonyms,
      // 兼容现有 UI / 旧逻辑
      examSynonyms: quizSynonyms,
      relatedSynonyms: [],
      synonyms: sourceSynonyms,
      ieltsMeaning: rawWord.ieltsMeaning || "",
      example: rawWord.example || "",
      groupId,
      rank: id,
      source: "reading538-new-edition",
      verification: "row-order-and-synonym-column-checked",
      sourceNote: patch.note || ""
    };
  }

  const groups = RAW.groups.map((group, index) => {
    const groupId = index + 1;
    const meta = edition.groups[index];
    const primaryWords = (group.words || [])
      .slice(0, meta.primary)
      .map((w) => normalizeWord(w, groupId));

    return {
      id: groupId,
      deckId: "reading538",
      name: `第${groupId}类`,
      legacyName: group.name || `第${groupId}组`,
      description: group.description || "",
      ...meta,
      words: primaryWords
    };
  });

  const allPrimaryWords = groups.flatMap((g) => g.words);

  // 强制数据审计：主词必须严格为 1..376，分组必须 20/100/256。
  const audit = (() => {
    const ids = allPrimaryWords.map((w) => w.id);
    const expectedIds = Array.from({ length: 376 }, (_, i) => i + 1);
    const badIds = expectedIds.filter((id, i) => ids[i] !== id);
    const missingWord = allPrimaryWords.filter((w) => !w.word).map((w) => w.id);
    const missingChinese = allPrimaryWords.filter((w) => !w.chinese).map((w) => w.id);
    const missingSynonyms = allPrimaryWords.filter((w) => !w.sourceSynonyms.length).map((w) => w.id);
    const groupCounts = groups.map((g) => g.words.length);
    const expectedGroupCounts = [20, 100, 256];
    const groupCountOK = groupCounts.every((n, i) => n === expectedGroupCounts[i]);
    const ok = badIds.length === 0 && missingWord.length === 0 && missingChinese.length === 0 &&
      missingSynonyms.length === 0 && groupCountOK && allPrimaryWords.length === 376;

    const result = {
      ok,
      checkedPrimaryWords: allPrimaryWords.length,
      idsContinuous: badIds.length === 0,
      groupCounts,
      expectedGroupCounts,
      missingWord,
      missingChinese,
      missingSynonyms,
      patchedSourceRows: Object.keys(sourcePatches).map(Number)
    };
    if (!ok) console.error("[IELT data audit failed]", result);
    else console.info("[IELT data audit passed]", result);
    return result;
  })();

  // Academic 扩展：NAWL Top 200。按单词/别名与 538 自动去重，避免重复记忆卡。
  const coreNames = new Set();
  for (const w of allPrimaryWords) {
    coreNames.add(normText(w.word));
    for (const a of w.aliases || []) coreNames.add(normText(a));
  }

  const academicWords = (ACADEMIC_RAW?.words || [])
    .filter((item) => !coreNames.has(normText(item.word)))
    .map((item) => ({
      id: `nawl-${item.rank}`,
      cardId: `academic-nawl-${item.rank}`,
      deckId: "academic",
      deckName: "Academic · NAWL",
      quizMode: "meaning",
      word: item.word,
      sourceWord: item.word,
      aliases: [],
      pos: item.pos || "",
      sourcePos: item.pos || "",
      chinese: item.chinese || "",
      sourceSynonyms: [],
      quizSynonyms: [],
      examSynonyms: [],
      relatedSynonyms: [],
      synonyms: [],
      ieltsMeaning: "NAWL 学术高频词，用于雅思阅读学术语境扩展。",
      example: "",
      groupId: "academic",
      rank: Number(item.rank),
      source: "NAWL-1.2",
      sourceNote: "中文释义为本项目自行整理；rank / word / PoS 来自 NAWL 1.2。"
    }));

  const academic = {
    id: "academic",
    name: ACADEMIC_RAW?.name || "Academic · NAWL Top 200",
    description: ACADEMIC_RAW?.description || "NAWL 1.2 高频学术词扩展",
    source: ACADEMIC_RAW?.source || null,
    rawCount: ACADEMIC_RAW?.words?.length || 0,
    uniqueCount: academicWords.length,
    removedAsCoreOverlap: (ACADEMIC_RAW?.words?.length || 0) - academicWords.length,
    words: academicWords
  };

  const allWords = [...allPrimaryWords, ...academicWords];

  window.__IELT_DATA_V2__ = {
    version: "2.1",
    edition,
    groups,
    allPrimaryWords,
    academic,
    allWords,
    audit,
    counts: {
      primaryWords: allPrimaryWords.length,
      totalTargets: edition.totalTargets,
      extraTargets: edition.extraTargets,
      groupPrimary: groups.map((g) => g.words.length),
      groupTargets: groups.map((g) => g.total),
      academicRaw: academic.rawCount,
      academicUnique: academic.uniqueCount,
      academicOverlapRemoved: academic.removedAsCoreOverlap,
      studyCards: allWords.length
    }
  };
})();
