// Rebuild the 488 meaning deck from the currently verified Word total-list source.
// Loaded after pdf-meaning-deck.js and before app.js.
(() => {
  "use strict";
  const DATA = window.__IELT_DATA_V2__;
  const SRC = window.__IELT_DOCX_488_TOTAL__ || window.__IELT_PRINTED_488_TOTAL__;
  if (!DATA || !SRC) return;

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const uniq = (items = []) => {
    const seen = new Set();
    const out = [];
    for (const item of items) {
      const text = String(item ?? "").trim();
      const k = norm(text);
      if (text && !seen.has(k)) { seen.add(k); out.push(text); }
    }
    return out;
  };

  // Terms already used as synonym-replacement expressions stay only in the 538 deck.
  const replacementTerms = new Set();
  for (const w of DATA.allPrimaryWords || []) {
    [
      ...(w.sourceSynonyms || []),
      ...(w.quizSynonyms || []),
      ...(w.examSynonyms || []),
      ...(w.relatedSynonyms || [])
    ].forEach((x) => { const k = norm(x); if (k) replacementTerms.add(k); });
  }

  // Reuse all meanings already curated by pdf-meaning-deck.js, plus direct source meanings
  // and the PDF main-word meanings. This keeps Chinese glosses while switching the term source.
  const meaningMap = new Map();
  for (const w of DATA.pdfMeaningDeck?.words || []) {
    if (w.word && w.chinese) meaningMap.set(norm(w.word), { chinese: w.chinese, pos: w.pos || "", source: w.sourceNote || "已有词义卡" });
  }
  for (const [k, v] of Object.entries(SRC.meanings || {})) {
    if (v && !meaningMap.has(norm(k))) meaningMap.set(norm(k), { chinese: v, pos: "", source: "上传词义表" });
  }
  for (const w of DATA.allPrimaryWords || []) {
    if (w.word && w.chinese && !meaningMap.has(norm(w.word))) meaningMap.set(norm(w.word), { chinese: w.chinese, pos: w.pos || "", source: "主词表" });
    for (const a of w.aliases || []) {
      if (a && w.chinese && !meaningMap.has(norm(a))) meaningMap.set(norm(a), { chinese: w.chinese, pos: w.pos || "", source: "主词拼写变体" });
    }
  }

  const sourceTerms = uniq(SRC.terms || []);
  const excluded = sourceTerms.filter((t) => replacementTerms.has(norm(t)));
  const retained = sourceTerms.filter((t) => !replacementTerms.has(norm(t)));

  const words = [];
  const missingMeaningTerms = [];
  retained.forEach((term, index) => {
    const hit = meaningMap.get(norm(term));
    if (!hit?.chinese) {
      missingMeaningTerms.push(term);
      return;
    }
    words.push({
      id: `docx488-meaning-${index + 1}`,
      rank: index + 1,
      cardId: `docx488-meaning-${index + 1}`,
      deckId: "pdf-meaning",
      deckName: "488总表 · 词义记忆",
      quizMode: "meaning",
      groupId: "pdf-meaning",
      level: null,
      levelName: "488总表 · 词义记忆",
      word: term,
      sourceWord: term,
      aliases: ["488总表词义", "PDF词义记忆"],
      pos: hit.pos || "",
      sourcePos: hit.pos || "",
      chinese: hit.chinese,
      sourceSynonyms: [], quizSynonyms: [], examSynonyms: [], relatedSynonyms: [], synonyms: [],
      ieltsMeaning: "只记英文词形对应的中文意思，不做同义替换。",
      example: "",
      source: "539考点词(1).docx-pages12-14",
      sourceNote: `词形来源：用户上传 Word 页12–14；词义来源：${hit.source || "已核对词义"}`
    });
  });

  DATA.pdfMeaningDeck = {
    id: "pdf-meaning",
    name: "488总表 · 词义记忆",
    description: "从用户上传 Word 第12–14页总表提取；排除已作为538同义替换出现的词；只练英文→中文。",
    sourcePrintedTitle: SRC.sourcePrintedTitle,
    sourceFile: SRC.sourceFile,
    printedUniqueTerms: sourceTerms.length,
    excludedAsReplacementCount: excluded.length,
    excludedAsReplacementTerms: excluded,
    sourceTermCount: retained.length,
    learnableCount: words.length,
    missingMeaningCount: missingMeaningTerms.length,
    missingMeaningTerms,
    words
  };

  const academicWords = DATA.academic?.words || [];
  DATA.allWords = [
    ...(DATA.allPrimaryWords || []),
    ...words,
    ...academicWords
  ];

  DATA.counts = {
    ...(DATA.counts || {}),
    pdfMeaningPrintedUnique: sourceTerms.length,
    pdfMeaningExcludedReplacement: excluded.length,
    pdfMeaningSourceTerms: retained.length,
    pdfMeaningLearnable: words.length,
    pdfMeaningMissing: missingMeaningTerms.length,
    studyCards: DATA.allWords.length
  };

  console.info("[IELT 488 Word-source rebuild]", {
    sourceFile: SRC.sourceFile,
    totalExtracted: sourceTerms.length,
    excludedAsSynonymReplacement: excluded.length,
    retainedForMeaning: retained.length,
    learnable: words.length,
    missingMeaning: missingMeaningTerms.length
  });
})();
