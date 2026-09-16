// Show Chinese meanings for the prompt and every option after a 538 synonym question is answered.
// Meanings stay hidden before answering so they never leak the answer.
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

  // 2) Direct meanings from the uploaded Word/PDF vocabulary sources.
  for (const src of [window.__IELT_DOCX_488_TOTAL__, window.__IELT_PRINTED_488_TOTAL__]) {
    for (const [term, chinese] of Object.entries(src?.meanings || {})) {
      addMeaning(term, chinese, 35);
    }
  }

  // 3) A 538 replacement expression inherits the IELTS-context Chinese sense
  // of its parent test word when no stronger direct lexical meaning exists.
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

  function hasBeenAnswered(cardEl) {
    const buttons = [...cardEl.querySelectorAll(".option[data-option]")];
    return buttons.length > 0 && buttons.some((b) => b.disabled);
  }

  function decoratePromptMeaning(cardEl) {
    if (cardEl.querySelector(".prompt-meaning")) return;
    const title = cardEl.querySelector(".word-title");
    if (!title) return;

    const prompt = title.textContent?.trim() || "";
    if (!prompt) return;

    const line = document.createElement("div");
    line.className = "prompt-meaning";
    line.innerHTML = `<span class="prompt-meaning-label">题干中文</span><span>${escapeHtml(glossFor(prompt))}</span>`;
    title.insertAdjacentElement("afterend", line);
  }

  function decorateOptionMeanings(cardEl) {
    const buttons = [...cardEl.querySelectorAll(".option[data-option]")];
    for (const btn of buttons) {
      if (btn.querySelector(".option-meaning")) continue;
      const term = btn.dataset.option || "";
      const gloss = document.createElement("span");
      gloss.className = "option-meaning";
      gloss.textContent = glossFor(term);
      btn.appendChild(gloss);
    }
  }

  function decorateAnsweredQuestion() {
    const cardEl = document.querySelector("#studyCard .word-card[data-card]");
    if (!cardEl || !isSynonymCard(cardEl) || !hasBeenAnswered(cardEl)) return;

    decoratePromptMeaning(cardEl);
    decorateOptionMeanings(cardEl);
  }

  // Backward-compatible function name used by older layers.
  function decorateAnsweredOptions() {
    decorateAnsweredQuestion();
  }

  function escapeHtml(v) {
    return String(v ?? "")
      .replaceAll("&", "&amp;")
      .replaceAll("<", "&lt;")
      .replaceAll(">", "&gt;")
      .replaceAll('"', "&quot;")
      .replaceAll("'", "&#039;");
  }

  function injectStyle() {
    if (document.getElementById("optionMeaningStyle")) return;
    const style = document.createElement("style");
    style.id = "optionMeaningStyle";
    style.textContent = `
      .prompt-meaning{
        display:flex;
        align-items:center;
        justify-content:center;
        gap:8px;
        flex-wrap:wrap;
        margin-top:10px;
        color:var(--sub, var(--muted));
        font-size:.86rem;
        line-height:1.45;
        text-align:center;
      }
      .prompt-meaning-label{
        padding:3px 7px;
        border-radius:999px;
        background:#f0ece5;
        color:#77736c;
        font-size:.68rem;
        font-weight:800;
      }
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
    const observer = new MutationObserver(() => requestAnimationFrame(decorateAnsweredQuestion));
    observer.observe(root, {
      childList: true,
      subtree: true,
      attributes: true,
      attributeFilter: ["disabled", "class"]
    });
  }

  document.addEventListener("click", (event) => {
    if (!event.target.closest?.("#studyCard .option")) return;
    setTimeout(decorateAnsweredQuestion, 0);
  });

  document.addEventListener("keydown", (event) => {
    if (!["1", "2", "3", "4"].includes(event.key)) return;
    setTimeout(decorateAnsweredQuestion, 0);
  });

  window.__IELT_OPTION_MEANINGS__ = {
    glossFor,
    decorateAnsweredOptions,
    decorateAnsweredQuestion
  };
})();
