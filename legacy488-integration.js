// Integrate the printed "488" total list with the current 538 data model.
// The uploaded table has 541 filled cells and 538 unique terms; three terms repeat.
(() => {
  "use strict";
  const SRC = window.__IELT_PRINTED_488_TOTAL__;
  const DATA = window.__IELT_DATA_V2__;
  if (!SRC || !DATA) return;

  const norm = (v) => String(v ?? "").toLowerCase().replace(/[’‘]/g, "'").replace(/\s+/g, " ").trim();
  const meaningAliases = {
    harbour: "harbor", encyclopaedia: "encyclopedia", odour: "odor",
    paralyse: "paralyze", plagiarise: "plagiarize", "co-operation": "cooperation",
    "co-ordinate": "coordinate", fertilizer: "fertilize", immediately: "immediate",
    impair: "impaired"
  };
  const meaningOf = (term) => {
    const key = norm(term);
    return SRC.meanings?.[key] || SRC.meanings?.[meaningAliases[key]] || "";
  };

  const covered = new Set();
  const addCovered = (value) => {
    const k = norm(value);
    if (k) covered.add(k);
  };

  (DATA.allPrimaryWords || []).forEach((w) => {
    [w.word, w.sourceWord, ...(w.aliases || []), ...(w.sourceSynonyms || []),
      ...(w.quizSynonyms || []), ...(w.examSynonyms || []), ...(w.relatedSynonyms || [])]
      .forEach(addCovered);
  });

  const missingBeforeSupplement = (SRC.terms || []).filter((term) => !covered.has(norm(term)));
  const supplementWords = missingBeforeSupplement.map((term, index) => {
    const chinese = meaningOf(term);
    return {
      id: `printed-total-${index + 1}`,
      rank: index + 1,
      cardId: `reading538-total-supplement-${index + 1}`,
      deckId: "reading538-supplement",
      deckName: "后附总表补充",
      quizMode: chinese ? "meaning" : "source-only",
      sourceOnly: !chinese,
      groupId: "supplement",
      level: null,
      levelName: "后附总表补充",
      word: term,
      sourceWord: term,
      aliases: [],
      pos: "",
      sourcePos: "",
      chinese,
      sourceSynonyms: [],
      quizSynonyms: [],
      examSynonyms: [],
      relatedSynonyms: [],
      synonyms: [],
      ieltsMeaning: "来自原书后附总表；此前 376 主词及同义替换数据未覆盖，因此补充纳入。",
      example: "",
      source: "printed-488-total-table",
      sourceNote: chinese ? "中文释义来自用户上传的444词汇表。" : "已纳入总表索引；当前上传释义表未覆盖此词，暂不进入自动测验。"
    };
  });

  const academicWords = DATA.academic?.words || [];
  DATA.supplement488 = {
    id: "reading538-supplement",
    name: "后附总表补充",
    words: supplementWords
  };
  DATA.totalListAudit = {
    printedTitle: SRC.sourcePrintedTitle,
    filledCells: SRC.filledCells,
    uniqueTerms: SRC.uniqueTermCount,
    duplicates: SRC.duplicates || [],
    coveredBeforeSupplement: SRC.uniqueTermCount - missingBeforeSupplement.length,
    missingBeforeSupplement: missingBeforeSupplement.length,
    supplementAdded: supplementWords.length,
    sourceOnlyAdded: supplementWords.filter((w) => w.sourceOnly).length,
    missingTerms: missingBeforeSupplement
  };

  // Learning order: 376 primary words -> newly supplemented total-list words -> Academic.
  DATA.allWords = [...(DATA.allPrimaryWords || []), ...supplementWords, ...academicWords];
  DATA.counts = {
    ...(DATA.counts || {}),
    printedTotalUnique: SRC.uniqueTermCount,
    printedTotalCoveredBeforeSupplement: DATA.totalListAudit.coveredBeforeSupplement,
    printedTotalSupplementAdded: supplementWords.length,
    printedTotalSourceOnlyAdded: DATA.totalListAudit.sourceOnlyAdded,
    studyCards: DATA.allWords.length
  };

  console.info("[IELT printed total-list audit]", DATA.totalListAudit);
})();
