// Show two Chinese meaning layers for the prompt, plus meanings for every option,
// after a 538 synonym question is answered. Nothing is revealed before answering.
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

  const wordById = new Map((DATA.allWords || []).map((w) => [w.cardId, w]));

  // Direct/original lexical meanings and IELTS contextual replacement meanings
  // are deliberately stored separately so one can never silently replace the other.
  const directMeaningMap = new Map();
  const contextMeaningMap = new Map();

  function addToMap(map, term, chinese, priority = 0) {
    const key = norm(term);
    const gloss = String(chinese || "").trim();
    if (!key || !gloss) return;

    const old = map.get(key);
    if (!old || priority > old.priority) {
      map.set(key, { meanings: [gloss], priority });
      return;
    }
    if (priority === old.priority && !old.meanings.includes(gloss)) {
      old.meanings.push(gloss);
    }
  }

  // 1) Direct lexical meanings from independent learning cards.
  for (const w of DATA.allWords || []) {
    addToMap(directMeaningMap, w.word, w.chinese, 30);
    addToMap(directMeaningMap, w.sourceWord, w.chinese, 30);
    for (const alias of w.aliases || []) addToMap(directMeaningMap, alias, w.chinese, 28);
  }

  // 2) Uploaded Word/PDF meanings remain authoritative course-material meanings.
  for (const src of [window.__IELT_DOCX_488_TOTAL__, window.__IELT_PRINTED_488_TOTAL__]) {
    for (const [term, chinese] of Object.entries(src?.meanings || {})) {
      addToMap(directMeaningMap, term, chinese, 35);
    }
  }

  // 3) Web-researched / learner-dictionary original meanings fill gaps and, when
  // the course material also has a direct meaning, appear alongside it rather
  // than being confused with the current synonym-question sense.
  for (const [term, chinese] of Object.entries(window.__IELT_ORIGINAL_MEANINGS__?.meanings || {})) {
    addToMap(directMeaningMap, term, chinese, 35);
  }

  // 4) Keep the IELTS replacement sense in a separate map. A replacement phrase
  // inherits the contextual sense of its parent 538 test word only for this layer.
  for (const w of DATA.allPrimaryWords || []) {
    addToMap(contextMeaningMap, w.word, w.chinese, 20);
    addToMap(contextMeaningMap, w.sourceWord, w.chinese, 20);
    for (const alias of w.aliases || []) addToMap(contextMeaningMap, alias, w.chinese, 18);

    const linked = [
      ...(w.sourceSynonyms || []),
      ...(w.quizSynonyms || []),
      ...(w.examSynonyms || []),
      ...(w.relatedSynonyms || [])
    ];
    for (const term of linked) addToMap(contextMeaningMap, term, w.chinese, 10);
  }

  function meaningsFrom(map, term) {
    const hit = map.get(norm(term));
    return hit?.meanings?.length ? hit.meanings.slice(0, 2).join("；") : "";
  }

  function directGlossFor(term) {
    return meaningsFrom(directMeaningMap, term) || "原本词义待补充";
  }

  function genericContextGlossFor(term) {
    return meaningsFrom(contextMeaningMap, term) || "暂无单独标注的替换义";
  }

  // For the prompt, the current card is the strongest evidence for the exact
  // replacement sense being tested in this question.
  function promptContextGloss(cardEl, prompt) {
    const word = wordById.get(cardEl?.dataset?.card || "");
    if (word?.deckId === "reading538" && String(word.chinese || "").trim()) {
      const cluster = [
        word.word,
        word.sourceWord,
        ...(word.aliases || []),
        ...(word.sourceSynonyms || []),
        ...(word.quizSynonyms || []),
        ...(word.examSynonyms || []),
        ...(word.relatedSynonyms || [])
      ].filter(Boolean).map(norm);
      if (cluster.includes(norm(prompt))) return String(word.chinese).trim();
    }
    return genericContextGlossFor(prompt);
  }

  // Options show their own lexical meaning where available. Context meaning is
  // only a fallback, never mislabeled as the expression's original meaning.
  function optionGlossFor(term) {
    const direct = meaningsFrom(directMeaningMap, term);
    if (direct) return direct;
    const context = meaningsFrom(contextMeaningMap, term);
    return context ? `本题语境：${context}` : "暂无中文释义";
  }

  function isSynonymCard(cardEl) {
    const cardId = cardEl?.dataset?.card;
    if (!cardId) return false;
    const word = wordById.get(cardId);
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

    const original = directGlossFor(prompt);
    const replacement = promptContextGloss(cardEl, prompt);

    const box = document.createElement("div");
    box.className = "prompt-meaning";
    box.innerHTML = `
      <div class="prompt-meaning-row">
        <span class="prompt-meaning-label prompt-original-label">原本词义（雅思常用义）</span>
        <span class="prompt-meaning-value">${escapeHtml(original)}</span>
      </div>
      <div class="prompt-meaning-row">
        <span class="prompt-meaning-label prompt-context-label">本题同义替换义</span>
        <span class="prompt-meaning-value">${escapeHtml(replacement)}</span>
      </div>`;
    title.insertAdjacentElement("afterend", box);
  }

  function decorateOptionMeanings(cardEl) {
    const buttons = [...cardEl.querySelectorAll(".option[data-option]")];
    for (const btn of buttons) {
      if (btn.querySelector(".option-meaning")) continue;
      const term = btn.dataset.option || "";
      const gloss = document.createElement("span");
      gloss.className = "option-meaning";
      gloss.textContent = optionGlossFor(term);
      btn.appendChild(gloss);
    }
  }

  function decorateAnsweredQuestion() {
    const cardEl = document.querySelector("#studyCard .word-card[data-card]");
    if (!cardEl || !isSynonymCard(cardEl) || !hasBeenAnswered(cardEl)) return;

    decoratePromptMeaning(cardEl);
    decorateOptionMeanings(cardEl);
  }

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
        width:min(620px,100%);
        display:grid;
        gap:7px;
        margin-top:12px;
        padding:10px 12px;
        border:1px solid var(--line,#e6e2da);
        border-radius:12px;
        background:var(--surface-soft,#fbfaf7);
        color:var(--sub,var(--muted));
        font-size:.84rem;
        line-height:1.45;
      }
      .prompt-meaning-row{
        display:grid;
        grid-template-columns:152px 1fr;
        align-items:start;
        gap:8px;
      }
      .prompt-meaning-label{
        display:inline-flex;
        width:max-content;
        padding:3px 7px;
        border-radius:999px;
        font-size:.67rem;
        font-weight:800;
      }
      .prompt-original-label{background:#f0ece5;color:#77736c}
      .prompt-context-label{background:#edf2f7;color:#526b83}
      .prompt-meaning-value{font-weight:600;color:var(--ink,#20231f)}
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
      @media(max-width:560px){
        .prompt-meaning-row{grid-template-columns:1fr;gap:4px}
      }
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
    glossFor: optionGlossFor,
    directGlossFor,
    contextGlossFor: genericContextGlossFor,
    decorateAnsweredOptions,
    decorateAnsweredQuestion
  };
})();
