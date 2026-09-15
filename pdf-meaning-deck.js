// Meaning-only deck built from the printed total list.
// RULE: words already used as 538 synonym-replacement expressions are excluded
// from this deck so the same lexical item is not trained twice for two purposes.
(() => {
  "use strict";

  const SRC = window.__IELT_PRINTED_488_TOTAL__;
  const DATA = window.__IELT_DATA_V2__;
  if (!SRC || !DATA) return;

  const norm = (v) => String(v ?? "")
    .toLowerCase()
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const spellingAlias = {
    harbour: "harbor", harbor: "harbour",
    encyclopaedia: "encyclopedia", encyclopedia: "encyclopaedia",
    odour: "odor", odor: "odour",
    paralyse: "paralyze", paralyze: "paralyse",
    plagiarise: "plagiarize", plagiarize: "plagiarise",
    "co-operation": "cooperation", cooperation: "co-operation",
    "co-ordinate": "coordinate", coordinate: "co-ordinate",
    scepticism: "skepticism", skepticism: "scepticism",
    instalment: "installment", installment: "instalment"
  };

  // Concise learner glosses for printed-total terms not covered by the uploaded
  // Chinese list / primary-table meaning. These are original short study glosses,
  // cross-checked against learner-dictionary senses rather than copied definitions.
  const supplementalMeanings = {
    "allocate": "分配；拨给",
    "and": "和；以及",
    "assumption": "假设；设想",
    "assure": "确保；使确信",
    "aware": "意识到的；知道的",
    "barrier": "障碍；屏障",
    "bungle": "搞砸；笨拙地处理",
    "change": "改变；变化",
    "clue": "线索；提示",
    "collapse": "倒塌；崩溃",
    "commitment": "承诺；投入",
    "compatible": "兼容的；相容的",
    "condemn": "谴责；判处",
    "conflict": "冲突；抵触",
    "conform": "遵守；符合",
    "contrast": "对比；差异",
    "contribute": "贡献；促成",
    "conviction": "确信；定罪",
    "criminal": "罪犯；犯罪的",
    "curb": "抑制；限制",
    "defeat": "击败；挫败",
    "defect": "缺陷；毛病",
    "delicate": "脆弱的；精细的",
    "detailed": "详细的",
    "deter": "阻止；威慑",
    "diagnose": "诊断",
    "differentiate": "区分；使不同",
    "discharge": "排出；释放；履行",
    "divert": "转移；使改道",
    "dominant": "占主导的；支配的",
    "eco-friendly": "环保的",
    "engagement": "参与；约定；订婚",
    "entertainment": "娱乐；娱乐活动",
    "entrepreneur": "企业家；创业者",
    "environment": "环境",
    "erratically": "不规律地；不稳定地",
    "evaluate": "评估；评价",
    "even": "甚至；平坦的；均匀的",
    "evitable": "可避免的",
    "excel": "胜过；擅长",
    "exclude": "排除；不包括",
    "execute": "执行；实施",
    "expect": "预期；期待",
    "expose": "暴露；揭露",
    "exude": "散发；渗出",
    "fair": "公平的；相当好的",
    "fatigue": "疲劳；疲惫",
    "fertilizer": "肥料",
    "fit": "合适的；适合",
    "formation": "形成；构成",
    "frustration": "挫折；沮丧",
    "germ": "细菌；病菌",
    "hint": "暗示；提示",
    "hostile": "敌对的；不利的",
    "illustrate": "说明；阐明；给…配图",
    "immediately": "立即；马上",
    "impair": "损害；削弱",
    "impede": "阻碍；妨碍",
    "inaccessible": "难以到达的；无法获得的",
    "influence": "影响；影响力",
    "introverted": "内向的",
    "invent": "发明；创造",
    "jeopardize": "危及；损害",
    "main": "主要的；主要部分",
    "make up": "组成；构成；编造；弥补",
    "method": "方法",
    "microbe": "微生物",
    "mortality": "死亡率；死亡",
    "motivate": "激励；促使",
    "motive": "动机；目的",
    "municipal": "市政的；城市的",
    "necessary": "必要的；必需的",
    "neglect": "忽视；疏忽",
    "obscure": "模糊的；鲜为人知的；使模糊",
    "obstacle": "障碍；阻碍",
    "offset": "抵消；补偿",
    "only": "仅仅；唯一的",
    "organize": "组织；安排",
    "overlook": "忽视；俯瞰",
    "postpone": "推迟；延期",
    "practice": "实践；练习；惯例",
    "preference": "偏好；优先选择",
    "preliminary": "初步的；预备的",
    "prevent": "阻止；预防",
    "proof": "证据；证明",
    "puzzle": "使困惑；谜题",
    "quotation": "引语；引用；报价",
    "rather": "相当；宁愿",
    "realistic": "现实的；切实可行的",
    "record": "记录；纪录",
    "regulation": "规定；规章；调控",
    "relative": "相对的；亲属",
    "replace": "替代；取代",
    "respond": "回应；反应",
    "restriction": "限制；约束",
    "risk": "风险；危险",
    "scope": "范围；余地",
    "seek": "寻找；寻求",
    "shelter": "庇护；遮蔽处",
    "solely": "仅仅；单独地",
    "solicitor": "事务律师；律师",
    "spoil": "破坏；宠坏；变质",
    "spouse": "配偶",
    "stimulate": "刺激；促进；激励",
    "stimulus": "刺激；刺激因素",
    "stress": "压力；强调",
    "succumb": "屈服；不敌；死于",
    "suit": "适合；套装；诉讼",
    "surpass": "超过；胜过",
    "sustainable": "可持续的",
    "syllabus": "教学大纲；课程纲要",
    "talented": "有才能的",
    "that": "那个；那；用于引导从句",
    "theme": "主题；主旨",
    "threaten": "威胁；预示危险",
    "tolerate": "忍受；容忍",
    "underestimate": "低估",
    "utilization": "利用；使用",
    "vary": "变化；不同",
    "vast": "巨大的；广阔的",
    "viable": "可行的；能存活的",
    "view": "看待；观点；景色",
    "virus": "病毒",
    "volume": "体积；容量；数量；音量",
    "wholesome": "有益健康的；健康的",
    "wreck": "破坏；残骸",
    "yield": "产生；屈服；产量"
  };

  // A term that already functions as a synonym-replacement expression in the
  // 538 deck must NOT reappear in this meaning deck.
  const replacementTerms = new Set();
  for (const w of DATA.allPrimaryWords || []) {
    [
      ...(w.sourceSynonyms || []),
      ...(w.quizSynonyms || []),
      ...(w.examSynonyms || []),
      ...(w.relatedSynonyms || [])
    ].forEach((x) => {
      const k = norm(x);
      if (k) replacementTerms.add(k);
    });
  }

  // Primary rows already carry a direct Chinese gloss in the PDF table. We only
  // map the primary word itself / spelling aliases here, never a synonym.
  const primaryMeta = new Map();
  for (const w of DATA.allPrimaryWords || []) {
    const keys = [w.word, w.sourceWord, ...(w.aliases || [])];
    for (const key of keys) {
      const k = norm(key);
      if (k && !primaryMeta.has(k)) {
        primaryMeta.set(k, { chinese: w.chinese || "", pos: w.pos || "", source: "PDF主词表" });
      }
    }
  }

  function lookupMeaning(term) {
    const key = norm(term);
    if (!key) return null;

    if (SRC.meanings?.[key]) {
      return { chinese: SRC.meanings[key], pos: "", source: "用户上传词义表" };
    }

    const alt = spellingAlias[key];
    if (alt && SRC.meanings?.[alt]) {
      return { chinese: SRC.meanings[alt], pos: "", source: "用户上传词义表（拼写变体）" };
    }

    if (primaryMeta.has(key)) return primaryMeta.get(key);
    if (alt && primaryMeta.has(alt)) return primaryMeta.get(alt);

    if (supplementalMeanings[key]) {
      return { chinese: supplementalMeanings[key], pos: "", source: "补全词义（学习词典交叉核对）" };
    }
    if (alt && supplementalMeanings[alt]) {
      return { chinese: supplementalMeanings[alt], pos: "", source: "补全词义（拼写变体）" };
    }

    return null;
  }

  const sourceTerms = (SRC.terms || []).filter((term) => !replacementTerms.has(norm(term)));
  const excludedReplacementTerms = (SRC.terms || []).filter((term) => replacementTerms.has(norm(term)));
  const learnable = [];
  const missing = [];

  sourceTerms.forEach((term, index) => {
    const hit = lookupMeaning(term);
    if (!hit?.chinese) {
      missing.push(term);
      return;
    }

    learnable.push({
      id: `pdf-meaning-${index + 1}`,
      rank: index + 1,
      cardId: `pdf-meaning-${index + 1}`,
      deckId: "pdf-meaning",
      deckName: "488总表·词义记忆",
      quizMode: "meaning",
      groupId: "pdf-meaning",
      level: null,
      levelName: "488总表·词义记忆",
      word: term,
      sourceWord: term,
      aliases: ["PDF词义记忆", "488总表词义"],
      pos: hit.pos || "",
      sourcePos: hit.pos || "",
      chinese: hit.chinese,
      sourceSynonyms: [],
      quizSynonyms: [],
      examSynonyms: [],
      relatedSynonyms: [],
      synonyms: [],
      ieltsMeaning: "只要求记住中文词义，不进行同义替换训练。",
      example: "",
      source: "uploaded-488-total-meaning-deck",
      sourceNote: `词义来源：${hit.source}。本卡不使用同义替换。`
    });
  });

  DATA.pdfMeaningDeck = {
    id: "pdf-meaning",
    name: "488总表·词义记忆",
    description: "从后附总表取词；排除已经作为同义替换出现的词，只练英文→中文。",
    sourcePrintedTitle: SRC.sourcePrintedTitle,
    printedUniqueTerms: (SRC.terms || []).length,
    excludedAsReplacementCount: excludedReplacementTerms.length,
    excludedAsReplacementTerms: excludedReplacementTerms,
    sourceTermCount: sourceTerms.length,
    learnableCount: learnable.length,
    missingMeaningCount: missing.length,
    missingMeaningTerms: missing,
    words: learnable
  };

  const academicWords = DATA.academic?.words || [];
  DATA.allWords = [
    ...(DATA.allPrimaryWords || []),
    ...learnable,
    ...academicWords
  ];

  DATA.counts = {
    ...(DATA.counts || {}),
    pdfMeaningPrintedUnique: (SRC.terms || []).length,
    pdfMeaningExcludedReplacement: excludedReplacementTerms.length,
    pdfMeaningSourceTerms: sourceTerms.length,
    pdfMeaningLearnable: learnable.length,
    pdfMeaningMissing: missing.length,
    studyCards: DATA.allWords.length
  };

  console.info("[IELT 488 total-list meaning deck]", {
    printedUnique: DATA.pdfMeaningDeck.printedUniqueTerms,
    excludedAsSynonymReplacement: excludedReplacementTerms.length,
    sourceTerms: sourceTerms.length,
    learnable: learnable.length,
    missingMeaning: missing.length,
    missingMeaningTerms: missing
  });
})();
