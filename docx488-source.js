// Authoritative source marker for the printed "488" total-list vocabulary.
// The current user-provided Word file (539考点词(1).docx), pages 12–14,
// contains the same printed total-list table that was previously digitized into
// legacy488-data.js. We keep one digitized term list, but explicitly bind the
// active source to this Word version so downstream code uses the Word-verified table.
(() => {
  "use strict";
  const previous = window.__IELT_PRINTED_488_TOTAL__;
  if (!previous) return;

  window.__IELT_DOCX_488_TOTAL__ = {
    ...previous,
    sourcePrintedTitle: "488个雅思阅读考点词库总表",
    sourceFile: "用户上传《539考点词(1).docx》页12-14",
    sourceType: "docx-page-table",
    verifiedFromCurrentWord: true,
    // Copy arrays/maps so later code cannot accidentally mutate the legacy source.
    terms: [...(previous.terms || [])],
    meanings: { ...(previous.meanings || {}) }
  };
})();
