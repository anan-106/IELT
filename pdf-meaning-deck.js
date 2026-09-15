// Separate meaning-only deck for the uploaded printed vocabulary list.
// This deck deliberately does NOT use synonym-replacement questions.
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

  // Only true spelling variants are mapped here. We intentionally do NOT infer
  // meanings from synonym relationships or from morphological neighbours.
  const spellingAlias = {
    harbour: "harbor",
    harbor: "harbour",
    encyclopaedia: "encyclopedia",
    encyclopedia: "encyclopaedia",
    odour: "odor",
    odor: "odour",
    paralyse: "paralyze",
    paralyze: "paralyse",
    plagiarise: "plagiarize",
    plagiarize: "plagiarise",
    "co-operation": "cooperation",
    cooperation: "co-operation",
    "co-ordinate": "coordinate",
    coordinate: "co-ordinate"
  };

  // Primary rows in the uploaded PDF already contain their own Chinese meaning.
  // Build a direct term/alias -> primary-row metadata map. This is safe because
  // aliases here are spelling variants of the same lexical item, not synonyms.
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

    // 1) User-uploaded Chinese meaning list (exact term).
    if (SRC.meanings?.[key]) {
      return { chinese: SRC.meanings[key], pos: "", source: "用户上传词义表" };
    }

    // 2) British/American spelling variant in that same uploaded list.
    const alt = spellingAlias[key];
    if (alt && SRC.meanings?.[alt]) {
      return { chinese: SRC.meanings[alt], pos: "", source: "用户上传词义表（拼写变体）" };
    }

    // 3) The term itself is one of the PDF primary words (or its spelling alias).
    if (primaryMeta.has(key)) return primaryMeta.get(key);
    if (alt && primaryMeta.has(alt)) return primaryMeta.get(alt);

    return null;
  }

  const learnable = [];
  const missing = [];

  (SRC.terms || []).forEach((term, index) => {
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
      deckName: "PDF词义记忆",
      quizMode: "meaning",
      groupId: "pdf-meaning",
      level: null,
      levelName: "PDF词义记忆",
      word: term,
      sourceWord: term,
      // Search tag lets the UI expose this deck without mixing synonym data.
      aliases: ["PDF词义记忆"],
      pos: hit.pos || "",
      sourcePos: hit.pos || "",
      chinese: hit.chinese,
      sourceSynonyms: [],
      quizSynonyms: [],
      examSynonyms: [],
      relatedSynonyms: [],
      synonyms: [],
      ieltsMeaning: "本卡只要求记住中文词义，不进行同义替换训练。",
      example: "",
      source: "uploaded-pdf-meaning-deck",
      sourceNote: `词义来源：${hit.source}。本卡不使用同义替换。`
    });
  });

  DATA.pdfMeaningDeck = {
    id: "pdf-meaning",
    name: "PDF词义记忆",
    description: "上传 PDF 中的词汇单独做词义记忆，不做同义替换。",
    sourcePrintedTitle: SRC.sourcePrintedTitle,
    totalTerms: (SRC.terms || []).length,
    learnableCount: learnable.length,
    missingMeaningCount: missing.length,
    missingMeaningTerms: missing,
    words: learnable
  };

  // Keep the synonym deck intact. The meaning deck is an additional, independent
  // set of cards. Do not keep the old one-off supplement cards in the default
  // learning stream; their content is now represented consistently here.
  const academicWords = DATA.academic?.words || [];
  DATA.allWords = [
    ...(DATA.allPrimaryWords || []),
    ...learnable,
    ...academicWords
  ];

  DATA.counts = {
    ...(DATA.counts || {}),
    pdfMeaningTotal: (SRC.terms || []).length,
    pdfMeaningLearnable: learnable.length,
    pdfMeaningMissing: missing.length,
    studyCards: DATA.allWords.length
  };

  console.info("[IELT PDF meaning deck]", {
    total: DATA.pdfMeaningDeck.totalTerms,
    learnable: learnable.length,
    missing: missing.length
  });
})();
