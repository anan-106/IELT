// Show Chinese meanings for every option after a 538 synonym question is answered.
// Correct and distractor options are both annotated; meanings stay hidden before answering.
(() => {
  "use strict";

  const DATA = window.__IELT_DATA_V2__;
  if (!DATA) return;

  const norm = (v) => String(v ?? "")
    .toLowerCase()
    .replace(/[.…]/g, "...")
    .replace(/[’‘]/g, "'")
    .replace(/\s+/g, " ")
    .trim();

  const meaningMap = new Map();

  function addMeaning(term, chinese, priority = 0) {
    const key = norm(term);
    const gloss = String(chinese || "").trim();
    if (!key || !gloss) return;

    const old = meaningMap.get(key);
    if (!old || priority > old.priority) {
      meaningMap.set(key, { meanings: [gloss], priority });
      return;
    }
    if (priority === old.priority && !old.meanings.some((x) => x === gloss)) {
      old.meanings.push(gloss);
    }
  }

  // 1) Exact lexical meanings have the highest priority.
  for (const w of DATA.allWords || []) {
    addMeaning(w.word, w.chinese, 30);
    addMeaning(w.sourceWord, w.chinese, 30);
    for (const alias of w.aliases || []) addMeaning(alias, w.chinese, 28);
  }

  // 2) The Word/PDF total list may contain direct Chinese meanings for terms that
  // are not independent study cards.
  for (const src of [window.__IELT_DOCX_488_TOTAL__, window.__IELT_PRINTED_488_TOTAL__]) {
    for (const [term, chinese] of Object.entries(src?.meanings || {})) {
      addMeaning(term, chinese, 35);
    }
  }

  // 3) Every 538 replacement expression inherits the contextual Chinese sense of
  // its parent test word. This guarantees distractors generated from synonym groups
  // still get a useful IELTS-context gloss after the user answers.
  for (const w of DATA.allPrimaryWords || []) {
    const linked = [
      ...(w.sourceSynonyms || []),
      ...(w.quizSynonyms || []),
      ...(w.examSynonyms || []),
      ...(w.relatedSynonyms || [])
    ];
    for (const term of linked) addMeaning(term, w.chinese, 10);
  }

  function glossFor(term) {
    const hit = meaningMap.get(norm(term));
    if (!hit?.meanings?.length) return "暂无中文释义";
    return hit.meanings.slice(0, 2).join("；");
  }

  function isSynonymCard(cardEl) {
    const cardId = cardEl?.dataset?.card;
    if (!cardId) return false;
    const word = (DATA.allWords || []).find((w) => w.cardId === cardId);
    return word?.quizMode === "synonym" || word?.deckId === "reading538";
  }

  function decorateAnsweredOptions() {
    const cardEl = document.querySelector("#studyCard .word-card[data-card]");
    if (!cardEl || !isSynonymCard(cardEl)) return;

    const buttons = [...cardEl.querySelectorAll(".option[data-option]")];
    if (!buttons.length || !buttons.some((b) => b.disabled)) return;

    for (const btn of buttons) {
      if (btn.querySelector(".option-meaning")) continue;
      const term = btn.dataset.option || "";
      const gloss = document.createElement("span");
      gloss.className = "option-meaning";
      gloss.textContent = glossFor(term);
      btn.appendChild(gloss);
    }
  }

  function injectStyle() {
    if (document.getElementById("optionMeaningStyle")) return;
    const style = document.createElement("style");
    style.id = "optionMeaningStyle";
    style.textContent = `
      .option .option-meaning{
        display:block;
        margin-top:5px;
        font-size:.74rem;
        line-height:1.35;
        font-weight:500;
        opacity:.78;
      }
      .option.correct .option-meaning{opacity:.9}
      .option.wrong .option-meaning{opacity:.9}
    `;
    document.head.appendChild(style);
  }

  injectStyle();

  const root = document.getElementById("studyCard");
  if (root) {
    const observer = new MutationObserver(() => requestAnimationFrame(decorateAnsweredOptions));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "class"]
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("#studyCard .option")) return;
    setTimeout(decorateAnsweredOptions, 0);
  });

  document.addEventListener("keydown", (event) => {
    if (!["1", "2", "3", "4"].includes(event.key)) return;
    setTimeout(decorateAnsweredOptions, 0);
  });

  window.__IELT_OPTION_MEANINGS__ = { glossFor, decorateAnsweredOptions };
})();
