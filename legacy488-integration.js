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

  // "在里面"按学习系统能实际识别到来判断：主词、别名、同义替换任一命中即算覆盖。
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

  const learnableSupplement = supplementWords.filter((w) => !w.sourceOnly);
  const sourceOnlySupplement = supplementWords.filter((w) => w.sourceOnly);
  const academicWords = DATA.academic?.words || [];

  DATA.supplement488 = {
    id: "reading538-supplement",
    name: "后附总表补充",
    words: supplementWords,
    learnableWords: learnableSupplement,
    sourceOnlyWords: sourceOnlySupplement
  };
  DATA.totalListAudit = {
    printedTitle: SRC.sourcePrintedTitle,
    filledCells: SRC.filledCells,
    uniqueTerms: SRC.uniqueTermCount,
    duplicates: SRC.duplicates || [],
    coveredBeforeSupplement: SRC.uniqueTermCount - missingBeforeSupplement.length,
    missingBeforeSupplement: missingBeforeSupplement.length,
    supplementAdded: supplementWords.length,
    learnableSupplementAdded: learnableSupplement.length,
    sourceOnlyAdded: sourceOnlySupplement.length,
    missingTerms: missingBeforeSupplement,
    sourceOnlyTerms: sourceOnlySupplement.map((w) => w.word)
  };

  // 学习顺序：376 主词 -> 有可靠中文释义的后附总表补充 -> Academic。
  // 释义尚未被上传资料覆盖的词也已写进数据层，但不自动出题，避免教错。
  DATA.allWords = [...(DATA.allPrimaryWords || []), ...learnableSupplement, ...academicWords];
  DATA.counts = {
    ...(DATA.counts || {}),
    printedTotalUnique: SRC.uniqueTermCount,
    printedTotalCoveredBeforeSupplement: DATA.totalListAudit.coveredBeforeSupplement,
    printedTotalSupplementAdded: supplementWords.length,
    printedTotalSupplementLearnable: learnableSupplement.length,
    printedTotalSourceOnlyAdded: sourceOnlySupplement.length,
    studyCards: DATA.allWords.length
  };

  console.info("[IELT printed total-list audit]", DATA.totalListAudit);
})();
