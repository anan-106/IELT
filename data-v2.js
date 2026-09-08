// IELTS 阅读 538 · 新版数据适配层
// 依据《剑桥雅思阅读考点词真经538（机考笔试综合版）》的新版计数逻辑：
// 第1类 20 + 34 = 54；第2类 100 + 71 = 171；第3类 256 + 57 = 313；合计 538。
// 注意：538 并不等于 538 个独立主词。主考点词为 20 + 100 + 256 = 376 个，
// 其余为需要一并掌握的同义替换考点。

(() => {
  const RAW = window.__538_DATA__;
  if (!RAW) return;

  const edition = {
    title: "剑桥雅思阅读考点词真经538（机考笔试综合版）",
    totalTargets: 538,
    primaryWords: 376,
    groups: [
      { id: 1, primary: 20, extraTargets: 34, total: 54, mastery: "滚瓜烂熟", hitRate: "90%" },
      { id: 2, primary: 100, extraTargets: 71, total: 171, mastery: "熟记10遍以上", hitRate: "60%" },
      { id: 3, primary: 256, extraTargets: 57, total: 313, mastery: "熟记5遍以上", hitRate: "真题考查词" }
    ]
  };

  // 新版表格明确区分“同义替换”和“其它近义词”。
  // 下面先对公开版本中可明确核对的高频部分做严格拆分；未单独列出的词，
  // 默认把原数据中的 synonyms 作为命题替换集合，不丢失任何原始学习信息。
  const examOverrides = {
    1: ["be similar to"],
    2: ["perceive", "acknowledge", "realise", "appreciate", "admit", "identify", "comprehend"],
    3: ["change", "modify", "shift", "alter"],
    4: ["method"],
    5: ["rudimentary", "preliminary"],
    6: ["depend on"],
    7: ["home", "local", "national"],
    8: ["calculate", "assess", "evaluate"],
    9: ["characteristic", "feature", "property"],
    10: ["invent"],
    11: ["synthetic"],
    12: ["initiate", "immediately"],
    13: ["apply A to B"],
    14: ["based on"],
    15: ["neglect", "overlook", "underestimate"],
    16: ["toxic"],
    17: ["this", "it", "they", "those", "these", "such"],
    18: ["or", "as well as", "both...and", "not only...but also", "other than", "in addition", "besides", "on the one hand...on the other hand", "neither...nor"],
    19: ["but", "yet", "however", "whereas", "nonetheless", "nevertheless", "notwithstanding", "although", "though", "instead", "in spite of", "despite"],
    20: ["stem from", "derive"],

    21: ["variety"],
    22: ["seek"],
    23: ["inaccessible"],
    24: ["escape", "evitable"],
    25: ["fund", "financial"],
    26: ["fit", "suit"],
    27: ["substitute"],
    28: ["make up", "offset"],
    29: ["proportion"],
    30: ["weapon", "army"],
    31: ["standard"],
    32: ["syllabus"],
    33: ["realistic", "viable"],
    34: ["stop", "control"],
    35: ["defect"],
    36: ["provision"],
    37: ["differentiate"],
    38: ["diagnose"],
    39: ["focus on", "stress"],
    40: ["massive"],
    41: ["mimic"],
    42: ["diminish"],
    43: ["impede", "prevent"],
    44: ["legal"],
    45: ["restriction"],
    46: ["method", "tradition"],
    47: ["troublesome"],
    48: ["decide"],
    49: ["speed up"],
    50: ["aged", "old"],
    51: ["wholesome"],
    52: ["lasting"],
    53: ["aware"],
    54: ["reduce", "lessen"],
    55: ["resistance"],
    56: ["necessary"],
    57: ["discharge", "exude"],
    58: ["overstate"],
    59: ["pass", "send", "transfer"],
    60: ["die out", "lost"]
  };

  const relatedOverrides = {
    1: ["like", "look like"],
    2: ["understand", "know"],
    4: ["way"],
    5: ["basic"],
    10: ["first used"],
    11: ["man-made"],
    13: ["share"],
    14: ["ground", "root"],
    16: ["chemical", "unnatural"],
    20: ["owing to", "due to", "according to", "because of", "on account of", "as a result of", "leading to", "because", "since", "for", "in that", "as", "therefore", "hence"],
    21: ["difference"],
    22: ["find", "look for", "search"],
    32: ["course of study"],
    35: ["shortage", "weakness"],
    37: ["separate"],
    38: ["examine"],
    40: ["large"],
    41: ["copy"],
    42: ["damage", "decrease"],
    43: ["deter", "obstacle"],
    51: ["helpful", "advantageous"],
    53: ["knowing"],
    56: ["compelling", "urgent"]
  };

  const spellingAliases = {
    recognize: ["recognise"],
    analyze: ["analyse"],
    emphasize: ["emphasise"],
    minimize: ["minimise"],
    skeptical: ["sceptical"],
    skepticism: ["scepticism"],
    installment: ["instalment"]
  };

  function cleanStarWord(word) {
    return String(word || "").replace(/\*+$/g, "");
  }

  function sameSynonym(a, b) {
    return String(a).toLowerCase().replace(/[.…]/g, "...").replace(/\s+/g, " ").trim() ===
      String(b).toLowerCase().replace(/[.…]/g, "...").replace(/\s+/g, " ").trim();
  }

  function mergeWithoutDupes(items) {
    const result = [];
    for (const item of items || []) {
      if (!result.some((x) => sameSynonym(x, item))) result.push(item);
    }
    return result;
  }

  function normalizeWord(word, groupId) {
    const id = Number(word.id);
    const allOriginal = mergeWithoutDupes(word.synonyms || []);
    const examSynonyms = mergeWithoutDupes(examOverrides[id] || allOriginal);
    const relatedFromOriginal = allOriginal.filter(
      (s) => !examSynonyms.some((x) => sameSynonym(x, s))
    );
    const relatedSynonyms = mergeWithoutDupes([
      ...(relatedOverrides[id] || []),
      ...relatedFromOriginal
    ]);

    const canonicalWord = cleanStarWord(word.word);
    const aliases = mergeWithoutDupes([
      ...(spellingAliases[canonicalWord] || []),
      ...(canonicalWord !== word.word ? [word.word] : [])
    ]);

    return {
      id,
      cardId: `reading538-g${groupId}-${id}`,
      word: canonicalWord,
      aliases,
      pos: word.pos || "",
      chinese: word.chinese || "",
      examSynonyms,
      relatedSynonyms,
      synonyms: mergeWithoutDupes([...examSynonyms, ...relatedSynonyms]),
      ieltsMeaning: word.ieltsMeaning || "",
      example: word.example || "",
      groupId,
      source: "reading538-new-edition",
      mapping: examOverrides[id] ? "verified-column-split" : "full-command-set"
    };
  }

  const groups = RAW.groups.map((group, index) => {
    const groupId = index + 1;
    const limit = edition.groups[index].primary;
    // 原仓库第3组尾部的 377/378 是后补的同义词卡，不属于新版 256 个主词，移除。
    const primaryWords = (group.words || []).slice(0, limit).map((w) => normalizeWord(w, groupId));

    return {
      id: groupId,
      name: `第${groupId}类`,
      legacyName: group.name || `第${groupId}组`,
      description: group.description || "",
      ...edition.groups[index],
      words: primaryWords
    };
  });

  const allPrimaryWords = groups.flatMap((g) => g.words);

  window.__IELT_DATA_V2__ = {
    version: "2.0",
    edition,
    groups,
    allPrimaryWords,
    counts: {
      primaryWords: allPrimaryWords.length,
      totalTargets: edition.totalTargets,
      groupPrimary: groups.map((g) => g.words.length),
      groupTargets: groups.map((g) => g.total)
    }
  };
})();
