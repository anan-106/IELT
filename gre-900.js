/* Chapter practice with self-contained, selectable question text and vector diagrams. */
(() => {
  "use strict";
  const B = window.GRE900Bank, C = window.GRE900Core, T = window.GRE900Text;
  if (!B || !C || !document.getElementById("view-quant")) return;
  const $ = id => document.getElementById(id);
  const esc = value => String(value ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
  const byId = new Map(B.questions.map(q => [q.id, q]));
  const transcripts = new Map((T?.questions || []).map(q => [q.id, q]));
  const contentReady = T?.answeringLanguage === "en" && T.sourceSha256 === B.source.sha256 && transcripts.size === B.questions.length && B.questions.every(q => transcripts.has(q.id));
  const qcLabels = { A: "Quantity A is greater.", B: "Quantity B is greater.", C: "The two quantities are equal.", D: "The relationship cannot be determined from the information given." };
  const kindsEn = { qc: "Quantitative Comparison", single: "Multiple Choice — Select One", multi: "Multiple Choice — Select All That Apply", numeric: "Numeric Entry", expression: "Algebraic Expression" };
  const difficultiesEn = { easy: "Easy", medium: "Medium", hard: "Hard", data: "Data Interpretation" };
  const sections = new Map(B.sections.map(s => [s.id, s]));
  const pct = n => n == null ? "—" : `${(n * 100).toFixed(1)}%`;
  const time = ms => `${Math.floor(ms / 60000)}:${String(Math.floor(ms / 1000) % 60).padStart(2, "0")}`;
  const date = n => new Date(n).toLocaleString("zh-CN", { month: "2-digit", day: "2-digit", hour: "2-digit", minute: "2-digit" });
  const title = s => `${s.sourceSet === "new" ? "新增" : "原编"} Section ${s.sourceSection}`;
  const titleEn = s => `${s.sourceSet === "new" ? "Additional" : "Original"} Section ${s.sourceSection}`;
  const solutionAnswer = q => q.computedAnswer || C.answerText(q.answer) || "待核验";
  const qtitle = q => `${title(sections.get(q.sectionId))} · 原题 ${q.sourceNumber}${q.printedNumber !== q.sourceNumber ? `（原文误印 ${q.printedNumber}）` : ""}`;
  const qtitleEn = q => `${titleEn(sections.get(q.sectionId))} · Question ${q.sourceNumber}${q.printedNumber !== q.sourceNumber ? ` (printed as ${q.printedNumber} in the source)` : ""}`;
  let state = C.fresh(), blocked = false, clockStart = performance.now(), lastSave = 0;
  let timingVisible = !document.hidden;
  let difficulty = "all", group = "all", screen = "catalog", solutionFilter = "all";
  try { const raw = localStorage.getItem(C.KEY); if (raw) state = C.validate(JSON.parse(raw), B); }
  catch (_) { blocked = true; }

  const view = document.createElement("section"); view.id = "view-gre900"; view.className = "view g900";
  view.innerHTML = `<div class="g900-heading"><div><div class="kicker">GRE MATH · 900 QUESTIONS</div><h2 id="g900-stage-title"></h2><p id="g900-stage-description"></p></div><button type="button" id="g900-home" class="g900-secondary"></button></div>
    <div id="g900-alert" class="g900-alert" role="status" aria-live="polite" hidden></div>
    <details class="g900-source" id="g900-backup-panel"><summary><b id="g900-backup-title"></b> <span id="g900-backup-subtitle"></span></summary>
      <div class="g900-source-body"><p id="g900-source-description"></p>
      <div class="g900-actions"><button type="button" id="g900-export"></button><label class="g900-file g900-secondary"><span id="g900-import-label"></span><input id="g900-import" type="file" accept="application/json,.json"></label></div>
      <p class="g900-muted" id="g900-backup-description"></p>
      <p class="g900-muted" id="g900-scoring-description"></p></div></details>
    <div id="g900-content"></div>`;
  $("view-quant").after(view);
  const nav = document.createElement("button"); nav.type = "button"; nav.className = "tab"; nav.dataset.view = "gre900"; nav.textContent = "900题刷题";
  document.querySelector('.tab[data-view="quant"]').after(nav);
  function activate() {
    document.querySelectorAll(".view").forEach(v => v.classList.toggle("active", v === view));
    document.querySelectorAll(".tab").forEach(b => b.classList.toggle("active", b.dataset.view === "gre900"));
    clockStart = performance.now();
  }
  nav.onclick = () => { activate(); render(); };
  function notice(message, error = false) {
    const el = $("g900-alert"); el.textContent = message; el.hidden = !message; el.classList.toggle("g900-warning", error);
  }
  function stageLanguage(attempt) {
    view.lang = attempt ? "en" : "zh-CN";
    const labels = attempt ? {
      "g900-stage-title": "900 Questions · Chapter Practice",
      "g900-stage-description": "Complete the chapter to see your score and Chinese explanations.",
      "g900-home": "Chapter catalog",
      "g900-backup-title": "Study backups and question bank",
      "g900-backup-subtitle": "Individual text questions · No PDF required",
      "g900-source-description": "Each question includes English text, formulas and complete answer choices. Diagrams are redrawn and data tables are transcribed. Text is selectable, and formulas and diagrams scale with the page.",
      "g900-export": "Export study backup",
      "g900-import-label": "Merge study backup",
      "g900-backup-description": "Progress is saved in this browser. Backups include answers, review notes and error categories. Backups from earlier versions can still be imported.",
      "g900-scoring-description": "Difficulty follows the source book. Explanations are independently derived. Questions with unresolved source issues are marked and excluded from accuracy calculations."
    } : {
      "g900-stage-title": "900 题 · 章节刷题",
      "g900-stage-description": "按原书难度选章节，英文作答，整章交卷后统一看中文解析。",
      "g900-home": "章节目录",
      "g900-backup-title": "学习备份与题库说明",
      "g900-backup-subtitle": "逐题文字版 · 无需导入 PDF",
      "g900-source-description": "英文题干、公式和选项逐题排版；图形单独重绘，数据表完整重录。题面文字可以选中和复制，公式与图形随页面缩放。",
      "g900-export": "导出学习备份",
      "g900-import-label": "合并学习备份",
      "g900-backup-description": "学习记录保存在当前浏览器。备份包含答题记录、错因和笔记；之前版本的学习备份仍可导入。",
      "g900-scoring-description": "难度沿用原书；解析为独立推导。有原文歧义的题会明确标记，不计入正确率。"
    };
    for (const [id, text] of Object.entries(labels)) $(id).textContent = text;
  }
  function persist() {
    if (blocked) return false;
    try { localStorage.setItem(C.KEY, JSON.stringify(state)); lastSave = Date.now(); return true; }
    catch (_) { notice(screen === "attempt" ? "Your browser could not save this attempt. Your answers are still on this page. Export a study backup before refreshing." : "浏览器没有保存成功。本次作答仍在页面中，请导出学习备份，以免刷新后丢失。", true); return false; }
  }
  function synchronize(attempt = screen === "attempt") {
    if (blocked) return;
    try { const raw = localStorage.getItem(C.KEY); if (raw) state = C.merge(state, C.validate(JSON.parse(raw), B)); }
    catch (_) { notice(attempt ? "The other tab's records could not be read. Export a backup of your current progress first." : "另一标签页的记录无法读取。请先导出当前备份。", true); }
  }
  function current() { return state.activeId ? state.sessions[state.activeId] : null; }
  function accountTime() {
    const now = performance.now(), s = current();
    if (s?.status === "draft" && screen === "attempt" && view.classList.contains("active") && timingVisible) C.addTime(s, s.questionIds[s.index], now - clockStart);
    clockStart = now;
  }
  function jumpScreen(name) { accountTime(); screen = name; persist(); render(); }
  $("g900-home").onclick = () => jumpScreen("catalog");
  function sectionQuestions(id) { return B.questions.filter(q => q.sectionId === id); }
  function drafts(id) { return Object.values(state.sessions).filter(s => s.sectionId === id && s.status === "draft").sort((a, b) => b.updatedAt - a.updatedAt); }
  function overall(rows) { const s = C.summarize(rows); return `<div class="g900-metrics"><article><span>正确率</span><strong>${pct(s.accuracy)}</strong><small>${s.correct} / ${s.scored} 道可计分题</small></article><article><span>答对</span><strong>${s.correct}</strong><small>待核验题不计分</small></article><article><span>答错或留空</span><strong>${s.wrong}</strong><small>可按类型重做</small></article><article><span>待核验</span><strong>${s.excluded}</strong><small>与已计分题分开</small></article></div>`; }
  function render() { if (screen === "attempt" && current()?.status === "draft") renderAttempt(); else if (screen === "result" && current()?.status === "submitted") renderResult(); else renderCatalog(); }
  function renderCatalog() {
    screen = "catalog"; stageLanguage(false);
    const filtered = B.sections.filter(s => (difficulty === "all" || s.difficulty === difficulty) && (group === "all" || s.sourceSet === group));
    const latest = C.latestRows(state), first = C.firstRows(state), done = new Set(C.completed(state, { mode: "chapter" }).map(s => s.sectionId));
    const pending = B.questions.filter(q => q.status !== "verified").length;
    $("g900-content").innerHTML = `<div class="g900-intro"><div><b>45 个章节 · 900 道原题</b><p>Easy 60 题 · Medium 240 题 · Hard 540 题 · 图表专项 60 题</p></div><span class="g900-progress">已完成 ${done.size} / 45 章</span></div>
      <div class="g900-filter" role="group" aria-label="筛选难度">${[["all", "全部"], ...Object.entries(C.DIFFICULTIES)].map(([id, label]) => `<button type="button" data-difficulty="${id}" aria-pressed="${difficulty === id}">${esc(label)}</button>`).join("")}</div>
      <div class="g900-toolbar"><label>题源编排 <select id="g900-group"><option value="all">全部章节</option><option value="original">原编 Section 1–20</option><option value="new">新增 Section 1–25</option></select></label><span class="g900-muted">${filtered.length} 章；${pending} 题因原文疑点待核验。</span></div>
      <div class="g900-chapters">${filtered.map(s => {
        const ds = drafts(s.id), attempts = C.completed(state, { sectionId: s.id, mode: "chapter" }), last = attempts.at(-1), qs = sectionQuestions(s.id), unverified = qs.filter(q => q.status !== "verified").length;
        const resume = ds[0], remaining = resume ? C.unanswered(resume).length : 0;
        return `<article class="g900-chapter ${s.difficulty}"><div class="g900-chapter-top"><span class="g900-badge ${s.difficulty}">${esc(C.DIFFICULTIES[s.difficulty])}</span><span>${s.questionCount} 题</span></div><h3>${esc(title(s))}</h3><p>原书题号 ${s.questionNumbers[0]}–${s.questionNumbers.at(-1)} · PDF ${s.pdfPageStart}–${s.pdfPageEnd} 页</p><div class="g900-chapter-result">${resume ? `<b>有未交卷练习</b><span>剩余 ${remaining} 题 · 已保存</span>` : last ? `<b>${pct(last.result.summary.accuracy)}</b><span>最近一次整章 · ${last.result.summary.correct}/${last.result.summary.scored}</span>` : '<span>尚未开始</span>'}</div>${unverified ? `<small class="g900-muted">${unverified} 题待核验，不计正确率</small>` : '<small class="g900-muted">整章交卷后查看解析</small>'}<div class="g900-actions"><button type="button" class="g900-primary" ${blocked || !contentReady ? "disabled" : ""} data-start="${s.id}" data-mode="${resume?.mode || "chapter"}" data-attempt="${resume?.id || ""}">${resume ? resume.mode === "review" ? "继续错题复习" : "继续作答" : "开始本章"}</button>${last ? `<button type="button" data-result="${last.id}">查看报告</button>` : ""}</div></article>`;
      }).join("")}</div>
      <section class="g900-panel"><div class="g900-heading"><div><h3>复习概览</h3><p>按每道题最近一次提交统计，同一道题重复练习只占一条。</p></div><button type="button" id="g900-review-overview">查看错题类型</button></div>${overall(latest)}<p class="g900-muted">首次整章作答：${pct(C.summarize(first).accuracy)}（${C.summarize(first).correct}/${C.summarize(first).scored}）；首次表现与复习后表现分别计算。</p><div id="g900-overview-details" hidden></div></section>`;
    $("g900-group").value = group; $("g900-group").onchange = e => { group = e.target.value; renderCatalog(); };
    $("g900-content").querySelectorAll("[data-difficulty]").forEach(b => b.onclick = () => { difficulty = b.dataset.difficulty; renderCatalog(); });
    $("g900-content").querySelectorAll("[data-start]").forEach(b => b.onclick = () => startChapter(b.dataset.start, b.dataset.mode === "review", b.dataset.attempt));
    $("g900-content").querySelectorAll("[data-result]").forEach(b => b.onclick = () => showResult(b.dataset.result));
    $("g900-review-overview").onclick = () => {
      const el = $("g900-overview-details"); el.hidden = !el.hidden;
      if (!el.hidden) { el.innerHTML = reportGroups(latest) + wrongSections(); bindReview(el); }
    };
    if (blocked) { notice("已有 900 题记录读取失败，原数据尚未覆盖。请先点击“导出学习备份”保存原始记录，再合并有效备份恢复。", true); $("g900-backup-panel").open = true; }
  }
  function startChapter(id, review = false, attemptId = null) {
    if (blocked || !contentReady) return;
    notice(""); accountTime(); synchronize(true);
    const section = sections.get(id); if (!section) return;
    const matching = drafts(id).find(s => s.mode === (review ? "review" : "chapter") && (!attemptId || s.id === attemptId));
    if (matching) state.activeId = matching.id;
    else {
      const wrong = new Set(C.wrongIds(state, id));
      const questions = sectionQuestions(id).filter(q => !review || wrong.has(q.id));
      if (!questions.length) { notice("本章当前没有待重做的错题。"); return; }
      const s = C.start(section, questions, { mode: review ? "review" : "chapter" }); state.sessions[s.id] = s; state.activeId = s.id;
    }
    solutionFilter = "all"; screen = "attempt"; persist(); activate(); render();
    $("g900-content").scrollIntoView({ block: "start", behavior: "smooth" });
  }
  function showResult(id) { accountTime(); state.activeId = id; screen = "result"; solutionFilter = "all"; persist(); activate(); render(); }
  function choiceHtml(q, letter) {
    return q.kind === "qc" ? esc(qcLabels[letter] || letter) : transcripts.get(q.id)?.choices?.[letter] || esc(letter);
  }
  function questionHtml(q, includeChoices = false, review = false) {
    const t = transcripts.get(q.id);
    if (!t) return `<p class="g900-warning">${review ? "本题内容未加载，请刷新页面。" : "This question could not be loaded. Please refresh the page."}</p>`;
    const diagram = t.figure ? `<figure class="g900-diagram">${t.figure}${t.figureAlt ? `<figcaption>${esc(t.figureAlt)}</figcaption>` : ""}</figure>` : "";
    const quantities = q.kind === "qc" ? `<div class="g900-quantities"><section><h5>Quantity A</h5><div>${t.quantityA}</div></section><section><h5>Quantity B</h5><div>${t.quantityB}</div></section></div>` : "";
    const choices = includeChoices && q.options.length ? `<ol class="g900-static-choices">${q.options.map(letter => `<li><b>${letter}.</b><div>${choiceHtml(q, letter)}</div></li>`).join("")}</ol>` : "";
    const note = review ? t.transcriptionNote : t.transcriptionNoteEn;
    const source = review ? `题源：${qtitle(q)} · 原 PDF 第 ${q.sourcePages.join("、")} 页` : `Source: ${qtitleEn(q)} · PDF ${q.sourcePages.length === 1 ? "page" : "pages"} ${q.sourcePages.join(", ")}`;
    return `<div class="g900-question-text" lang="en">${t.stem}${diagram}${quantities}${choices}</div>${note ? `<details class="g900-transcript-note"><summary>${review ? "题面说明" : "Transcription note"}</summary><p>${esc(note)}</p></details>` : ""}<p class="g900-source-note">${esc(source)}</p>`;
  }
  function renderAttempt() {
    stageLanguage(true);
    const s = current(), section = sections.get(s.sectionId), q = byId.get(s.questionIds[s.index]), answered = Object.keys(s.answers).length, skipped = s.skipped.length, total = s.questionIds.length;
    const pick = s.answers[q.id];
    $("g900-content").innerHTML = `<section class="g900-attempt"><div class="g900-attempt-header"><div><span class="g900-badge ${section.difficulty}">${esc(difficultiesEn[section.difficulty])}</span><h3>${esc(titleEn(section))}${s.mode === "review" ? " · Review Practice" : ""}</h3><p>Question ${s.index + 1} of ${total} · Source question ${q.sourceNumber}</p></div><div class="g900-attempt-meta"><span id="g900-time">${time(Object.values(s.elapsed).reduce((a, b) => a + b, 0))}</span><small>Active practice time · Autosaved</small><button type="button" id="g900-pause">Save and return to catalog</button></div></div>
      <div class="g900-answer-map" aria-label="Question navigation">${s.questionIds.map((id, index) => `<button type="button" data-jump="${index}" class="${index === s.index ? "current" : ""} ${s.answers[id] ? "answered" : s.skipped.includes(id) ? "skipped" : ""} ${s.flagged.includes(id) ? "flagged" : ""}" aria-current="${index === s.index ? "step" : "false"}" aria-label="${answerMapLabel(s, id, index)}">${index + 1}${s.flagged.includes(id) ? "★" : ""}</button>`).join("")}</div>
      <div class="g900-status-line"><span>Answered ${answered} · Left blank ${skipped} · Remaining ${total - answered - skipped}</span><span>Answers and explanations appear after submission</span></div>
      <div class="g900-question-layout"><article class="g900-source-question"><h4>${esc(qtitleEn(q))}</h4>${q.printedNumber !== q.sourceNumber ? '<p class="g900-muted">The source repeats a question number. Questions are numbered here in their actual order.</p>' : ""}<div id="g900-question-text">${questionHtml(q)}</div></article>
      <aside class="g900-answer-panel"><div class="g900-answer-label"><b>${esc(kindsEn[q.kind])}</b><button type="button" id="g900-flag" aria-pressed="${s.flagged.includes(q.id)}">${s.flagged.includes(q.id) ? "★ Flagged" : "☆ Flag for review"}</button></div>
      ${q.status !== "verified" ? '<p class="g900-warning">This question has an unresolved source issue and will not count toward your accuracy. Details are shown after submission.</p>' : ""}
      <fieldset id="g900-answer-fields" ${blocked || !contentReady ? "disabled" : ""}><legend>${q.kind === "multi" ? "Select all that apply. Partial selections are scored as incorrect." : q.kind === "numeric" ? "Enter a number. Fractions and square roots are accepted." : q.kind === "expression" ? "Enter an algebraic expression. Parentheses are accepted." : "Select one answer choice."}</legend>
      ${["numeric", "expression"].includes(q.kind) ? `<label class="g900-number-label">Your answer<input id="g900-number" type="text" autocomplete="off" spellcheck="false" value="${esc(pick ?? "")}" placeholder="${q.kind === "expression" ? "Enter an algebraic expression" : "Enter a number, fraction or square root"}"></label><p class="g900-muted">${q.kind === "expression" ? `Use ${esc((q.variables || ["s"]).join(", "))} for the variable${(q.variables || ["s"]).length === 1 ? "" : "s"}. Use * for multiplication.` : `Use / for fractions, sqrt(...) for square roots, and pi for π. ${q.unit === "percent" ? "Enter the percentage value; the % sign is optional." : "Use the units and precision requested in the question."}`}</p><p id="g900-input-message" class="g900-muted" aria-live="polite"></p>` : `<div class="g900-choices">${q.options.map(letter => `<label><input type="${q.kind === "multi" ? "checkbox" : "radio"}" name="g900-answer" value="${letter}" ${Array.isArray(pick) && pick.includes(letter) ? "checked" : ""}><span class="g900-choice-card"><b class="g900-choice-letter">${letter}</b><span class="g900-choice-text">${choiceHtml(q, letter)}</span></span></label>`).join("")}</div>`}
      <div class="g900-actions"><button type="button" id="g900-clear">Clear answer</button><button type="button" id="g900-skip">${s.skipped.includes(q.id) ? "Marked blank" : "Leave blank"}</button></div></fieldset>
      <div class="g900-question-nav"><button type="button" id="g900-prev" ${s.index === 0 ? "disabled" : ""}>Previous</button><button type="button" id="g900-next" class="g900-primary">${s.index === total - 1 ? "Review and submit" : "Save and next"}</button></div><button type="button" id="g900-submit" class="g900-submit">${s.mode === "review" ? "Submit review" : "Submit chapter"}</button><p class="g900-muted">You can return to change your answers. Answer every question or mark it blank before submitting.</p></aside></div></section>`;
    $("g900-pause").onclick = () => jumpScreen("catalog");
    $("g900-content").querySelectorAll("[data-jump]").forEach(b => b.onclick = () => navigate(Number(b.dataset.jump)));
    $("g900-prev").onclick = () => navigate(s.index - 1);
    $("g900-next").onclick = () => s.index === total - 1 ? finish() : navigate(s.index + 1);
    $("g900-submit").onclick = finish;
    $("g900-flag").onclick = () => { accountTime(); C.toggleFlag(current(), q.id); persist(); renderAttempt(); };
    $("g900-clear").onclick = () => { accountTime(); C.putAnswer(current(), q, ""); persist(); renderAttempt(); };
    $("g900-skip").onclick = () => { accountTime(); C.markSkip(current(), q.id); persist(); renderAttempt(); };
    if ($("g900-number")) $("g900-number").oninput = e => {
      C.putAnswer(current(), q, e.target.value); persist();
      $("g900-input-message").textContent = !e.target.value.trim() ? "No answer entered." : current().answers[q.id] ? "Answer saved. It will be graded after submission." : q.kind === "expression" ? "Format not recognized; the answer has not been saved. Use the specified variable, numbers, parentheses and arithmetic operators. Do not include units." : "Format not recognized; the answer has not been saved. Use numbers, fractions or sqrt(...). Do not include unit names.";
      updateMap();
    };
    $("g900-content").querySelectorAll('input[name="g900-answer"]').forEach(input => input.onchange = () => {
      C.putAnswer(current(), q, [...$("g900-answer-fields").querySelectorAll('input[name="g900-answer"]:checked')].map(i => i.value)); persist(); updateMap();
    });
    clockStart = performance.now();
  }
  function answerMapLabel(s, id, index) { return `Question ${index + 1}, ${s.answers[id] ? "answered" : s.skipped.includes(id) ? "left blank" : "unanswered"}${s.flagged.includes(id) ? ", flagged" : ""}`; }
  function updateMap() {
    const s = current(); if (!s) return;
    $("g900-content").querySelectorAll("[data-jump]").forEach(b => { const index = Number(b.dataset.jump), id = s.questionIds[index]; b.classList.toggle("answered", !!s.answers[id]); b.classList.toggle("skipped", s.skipped.includes(id)); b.setAttribute("aria-label", answerMapLabel(s, id, index)); });
    const answered = Object.keys(s.answers).length, skipped = s.skipped.length;
    const line = $("g900-content").querySelector(".g900-status-line span"); if (line) line.textContent = `Answered ${answered} · Left blank ${skipped} · Remaining ${s.questionIds.length - answered - skipped}`;
  }
  function navigate(index) { accountTime(); const s = current(); if (!s || index < 0 || index >= s.questionIds.length) return; C.move(s, index); persist(); renderAttempt(); $("g900-content").scrollIntoView({ block: "start", behavior: "smooth" }); }
  function dialog(titleText, content, onConfirm) {
    let confirmed = false;
    const d = document.createElement("dialog"); d.className = "g900-dialog g900"; d.lang = "en";
    d.innerHTML = `<h3>${esc(titleText)}</h3><p>${esc(content)}</p><div class="g900-actions"><button type="button" data-cancel>Back to questions</button><button type="button" class="g900-primary" data-confirm>Confirm submission</button></div>`;
    d.querySelector("[data-cancel]").onclick = () => d.close();
    d.querySelector("[data-confirm]").onclick = () => { confirmed = true; d.close(); onConfirm(); };
    d.addEventListener("close", () => { d.remove(); if (!confirmed && screen === "attempt") renderAttempt(); }); document.body.append(d); d.showModal();
  }
  function finish() {
    accountTime(); synchronize(); const s = current(); if (!s || s.status !== "draft") { render(); return; }
    const missing = C.unanswered(s);
    if (missing.length) { notice(`${missing.length} question${missing.length === 1 ? " is" : "s are"} incomplete. Answer each question or select "Leave blank" before submitting. Answers remain hidden until submission.`, true); C.move(s, s.questionIds.indexOf(missing[0])); persist(); renderAttempt(); return; }
    dialog(s.mode === "review" ? "Submit this review?" : "Submit this chapter?", `This attempt contains ${s.questionIds.length} questions, with ${s.skipped.length} left blank. Blank answers to scored questions count as incorrect. Questions with unresolved source issues are excluded from the score. Submission locks this attempt and shows Chinese explanations. You can start another practice attempt afterward.`, () => {
      accountTime(); synchronize(); const latest = state.sessions[s.id];
      if (!latest || latest.status !== "draft") { screen = "result"; notice("本轮已经交卷，未重复计分。"); render(); return; }
      try { C.submit(latest, B.questions, { bankVersion: B.version }); screen = "result"; solutionFilter = "all"; persist(); notice("本章已交卷。答案、解析与错题类型已展开。"); renderResult(); $("g900-content").scrollIntoView({ block: "start", behavior: "smooth" }); }
      catch (e) {
        const message = {
          "本轮已交卷，不会重复计分。": "This attempt has already been submitted and will not be scored again.",
          "请完成全部题目，或将不会的题明确标记为留空，再交卷。": "Some questions are incomplete. Answer each question or select \"Leave blank\" before submitting.",
          "题库缺少题目，暂不能交卷。": "A question is missing from the question bank. This attempt cannot be submitted. Export a study backup before refreshing."
        }[e.message] || "This attempt could not be submitted. Export a study backup, then try again.";
        notice(message, true); if (screen === "attempt") renderAttempt();
      }
    });
  }
  function reportGroups(rows) {
    return `<div class="g900-report-grid">${[["topic", "知识点归纳"], ["kind", "题目形式"]].map(([key, label]) => `<section><h4>${label}</h4><div class="g900-table-wrap"><table><thead><tr><th scope="col">类型</th><th scope="col">正确 / 可计分</th><th scope="col">正确率</th><th scope="col">错题</th></tr></thead><tbody>${C.grouped(rows, key).map(g => `<tr><th scope="row">${esc(key === "kind" ? C.KINDS[g.label] || g.label : g.label)}</th><td>${g.correct} / ${g.scored}</td><td>${pct(g.accuracy)}</td><td class="${g.wrong ? "g900-wrong-number" : ""}">${g.wrong}</td></tr>`).join("") || '<tr><td colspan="4">完成一章后显示。</td></tr>'}</tbody></table></div></section>`).join("")}</div>`;
  }
  function wrongSections() {
    const list = B.sections.map(s => ({ s, n: C.wrongIds(state, s.id).length })).filter(x => x.n);
    return `<div class="g900-review-actions"><h4>按章节复习错题</h4>${list.length ? list.map(({ s, n }) => `<button type="button" data-review="${s.id}">${esc(title(s))} · ${n} 道错题</button>`).join("") : '<p class="g900-muted">暂无待重做错题。</p>'}</div>`;
  }
  function bindReview(root) { root.querySelectorAll("[data-review]").forEach(b => b.onclick = () => startChapter(b.dataset.review, true)); }
  function renderResult() {
    stageLanguage(false);
    const s = current(), section = sections.get(s.sectionId), { rows, summary } = s.result;
    const wrong = rows.filter(r => r.correct === false), recommendations = C.grouped(rows, "topic").filter(g => g.wrong).slice(0, 3);
    const filtered = rows.filter(r => solutionFilter === "all" || (solutionFilter === "wrong" ? r.correct === false : r.correct === null));
    const allAttempts = C.completed(state, { sectionId: s.sectionId });
    $("g900-content").innerHTML = `<section class="g900-panel g900-result"><div class="g900-heading"><div><span class="g900-badge ${section.difficulty}">${esc(C.DIFFICULTIES[section.difficulty])}</span><h3>${esc(title(section))} · ${s.mode === "review" ? "错题复习报告" : "整章报告"}</h3><p>${date(s.submittedAt)} · 用时 ${time(Object.values(s.elapsed).reduce((a, b) => a + b, 0))}</p></div><div class="g900-actions"><button type="button" class="g900-primary" data-review="${s.sectionId}" ${C.wrongIds(state, s.sectionId).length ? "" : "disabled"}>只重做本章错题</button><button type="button" id="g900-restart">整章再练一次</button><button type="button" id="g900-report-download">导出复习报告</button></div></div>
      ${overall(rows)}<p class="g900-muted">正确率 = 答对 ${summary.correct} ÷ 可计分 ${summary.scored}。${summary.excluded ? `${summary.excluded} 道待核验题不计入分母。` : ""}留空的可计分题按错误计算；多选必须选全且不多选。</p>
      ${reportGroups(rows)}<div class="g900-review-plan"><h4>这次优先复习什么</h4>${recommendations.length ? `<ol>${recommendations.map(g => `<li><b>${esc(g.label)}</b>：${g.wrong} 道错题，正确率 ${pct(g.accuracy)}。先阅读下方对应解析，再重做这些题。</li>`).join("")}</ol>` : '<p>本轮没有已计分错题。可以继续下一章，或稍后重做本章检查记忆。</p>'}<p class="g900-muted">知识点与题型按题目归类；计算失误、读题等个人错因请在下方自行标记。</p></div>
      <div class="g900-toolbar"><label>逐题报告 <select id="g900-result-filter"><option value="all">全部 ${rows.length} 题</option><option value="wrong">答错 / 留空 ${wrong.length} 题</option><option value="pending">待核验 ${summary.excluded} 题</option></select></label><label>历史练习 <select id="g900-history">${allAttempts.slice().reverse().map(a => `<option value="${a.id}">${date(a.submittedAt)} · ${a.mode === "review" ? "错题复习" : "整章"} · ${pct(a.result.summary.accuracy)}</option>`).join("")}</select></label></div>
      <div class="g900-solutions">${filtered.map(row => {
        const q = byId.get(row.id), note = state.notes[q.id] || { text: "", reason: "未标记" };
        const stateLabel = row.correct === null ? "待核验 · 不计分" : row.correct ? "答对" : row.skipped ? "留空" : "答错";
        return `<details class="g900-solution ${row.correct === null ? "pending" : row.correct ? "correct" : "incorrect"}" ${row.correct === false ? "open" : ""}><summary><span><b>原题 ${q.sourceNumber}</b> · ${esc(q.topic)}</span><span>${stateLabel}</span></summary><div class="g900-solution-body"><div class="g900-answer-comparison"><p><span>你的答案</span><strong>${row.skipped ? "留空" : esc(C.answerText(row.pick))}</strong></p><p><span>${row.correct === null ? "独立推导 / 待核验" : "正确答案"}</span><strong>${esc(solutionAnswer(q))}</strong></p></div>${q.kind === "qc" && q.answer ? `<p class="g900-muted">${esc({ A: "A：Quantity A 较大", B: "B：Quantity B 较大", C: "C：两者相等", D: "D：无法确定关系" }[C.answerText(q.answer)] || "")}</p>` : ""}<p class="g900-source-note">解析来源：独立推导 · PDF 第 ${q.sourcePages.join("、")} 页</p>${row.correct === null ? `<p class="g900-warning">${esc(q.reason || "原文条件或题型有歧义，暂不自动评分。")}</p>` : ""}<h4>解析</h4><div class="g900-explanation">${esc(q.explanation || "等待核验后补充。")}</div><div class="g900-tags">${(q.tags || []).map(tag => `<span>${esc(tag)}</span>`).join("")}</div><button type="button" data-show-question="${q.id}">查看完整题目</button><div id="g900-review-question-${q.globalIndex}" class="g900-review-question" hidden></div><div class="g900-note-fields"><label>这道题的主要错因<select data-reason="${q.id}">${C.REASONS.map(reason => `<option ${reason === note.reason ? "selected" : ""}>${esc(reason)}</option>`).join("")}</select></label><label>复习笔记<textarea maxlength="5000" rows="2" data-note="${q.id}" placeholder="例如：先确认百分比的分母；下次用反例检查 D。">${esc(note.text)}</textarea></label></div></div></details>`;
      }).join("") || '<p class="g900-empty">此筛选下没有题目。</p>'}</div></section>`;
    $("g900-result-filter").value = solutionFilter; $("g900-result-filter").onchange = e => { solutionFilter = e.target.value; renderResult(); };
    $("g900-history").value = s.id; $("g900-history").onchange = e => showResult(e.target.value);
    $("g900-restart").onclick = () => startChapter(s.sectionId);
    $("g900-report-download").onclick = () => downloadReport(s);
    bindReview($("g900-content"));
    $("g900-content").querySelectorAll("[data-show-question]").forEach(b => b.onclick = () => {
      const q = byId.get(b.dataset.showQuestion), el = $("g900-review-question-" + q.globalIndex); el.hidden = !el.hidden;
      b.textContent = el.hidden ? "查看完整题目" : "收起题目";
      if (!el.hidden) el.innerHTML = questionHtml(q, true, true);
    });
    $("g900-content").querySelectorAll("[data-note],[data-reason]").forEach(el => el.addEventListener(el.tagName === "SELECT" ? "change" : "input", () => {
      const id = el.dataset.note || el.dataset.reason, old = state.notes[id] || { text: "", reason: "未标记" };
      state.notes[id] = { ...old, [el.dataset.note ? "text" : "reason"]: el.value, updatedAt: Date.now() }; persist();
    }));

  }
  function download(value, name, type = "application/json") {
    const url = URL.createObjectURL(new Blob([typeof value === "string" ? value : JSON.stringify(value, null, 2)], { type }));
    const a = document.createElement("a"); a.href = url; a.download = name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 1000);
  }
  function downloadReport(s) {
    const section = sections.get(s.sectionId), sum = s.result.summary;
    const reportStyle = `body{max-width:900px;margin:36px auto;padding:0 22px;color:#172c36;font:16px/1.8 system-ui,sans-serif}h1,h2,h3{line-height:1.4}header{border-bottom:2px solid #146c72;padding-bottom:20px}.report-item{margin:28px 0;padding:24px 0;border-bottom:1px solid #dce6e9}.g900-question-text{font:18px/1.85 Georgia,serif}.g900-source-note,figcaption{font:13px/1.6 system-ui,sans-serif;color:#60727b}svg{max-width:580px;width:100%;height:auto;display:block;margin:15px auto}table{border-collapse:collapse;width:100%;font:14px/1.6 system-ui,sans-serif}th,td{padding:9px 12px;border:1px solid #dce6e9;text-align:left}.g900-data-table{overflow-x:auto;margin:18px 0}.g900-quantities{display:grid;grid-template-columns:1fr 1fr;border:1px solid #dce6e9;margin:20px 0}.g900-quantities section{padding:16px;text-align:center;overflow-x:auto}.g900-quantities section+section{border-left:1px solid #dce6e9}.g900-quantities h5{font:600 14px system-ui,sans-serif;color:#60727b;margin:0 0 12px}.g900-static-choices{list-style:none;padding:0}.g900-static-choices li{display:flex;gap:12px;padding:7px 0}.g900-static-choices li>b{min-width:22px}.g900-static-choices svg{max-width:340px}.answer{background:#edf7f6;padding:12px 16px}.explanation{white-space:pre-wrap}.g900-warning{padding:12px;background:#fff7e9}math{font-family:"Cambria Math",math}math[display=block]{overflow-x:auto;padding:10px 0}@media print{body{margin:0}.report-item{break-inside:avoid}svg{max-height:300px}}`;
    const rows = s.result.rows.map(row => {
      const q = byId.get(row.id), note = state.notes[q.id], t = transcripts.get(q.id);
      return `<section class="report-item"><h2>原题 ${q.sourceNumber} · ${esc(q.topic)}</h2><p>${row.correct === null ? "待核验，不计分" : row.correct ? "答对" : row.skipped ? "留空" : "答错"}</p>${questionHtml(q, true, true)}<div class="answer"><p>你的答案：${row.skipped ? "留空" : esc(C.answerText(row.pick))}</p><p>${row.correct === null ? "独立推导 / 待核验" : "正确答案"}：<b>${esc(solutionAnswer(q))}</b></p></div>${q.reason ? `<p class="g900-warning">${esc(q.reason)}</p>` : ""}<h3>解析</h3><div class="explanation">${esc(q.explanation)}</div>${note ? `<p>错因：${esc(note.reason)}</p><p class="explanation">复习笔记：${esc(note.text)}</p>` : ""}</section>`;
    }).join("");
    const html = `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>${esc(title(section))} · GRE 900 复习报告</title><style>${reportStyle}</style></head><body><header><h1>${esc(title(section))} · GRE 900 复习报告</h1><p>${esc(new Date(s.submittedAt).toLocaleString("zh-CN"))} · 正确率 ${pct(sum.accuracy)}（${sum.correct}/${sum.scored}）· 待核验 ${sum.excluded} 题</p><p>解析来源：独立推导。首次整章成绩与复习后的最近表现分别保留。</p></header>${reportGroups(s.result.rows)}${rows}</body></html>`;
    download(html, `GRE900_${s.sectionId}_${s.id}.html`, "text/html;charset=utf-8");
  }
  $("g900-export").onclick = () => {
    accountTime();
    if (blocked) download({ type: "gre900-recovery", raw: localStorage.getItem(C.KEY) }, "GRE900_原始记录恢复备份.json");
    else download({ type: "gre900-backup", sourceSha256: B.source.sha256, exportedAt: Date.now(), ...state }, `GRE900_学习备份_${new Date().toISOString().slice(0, 10)}.json`);
  };
  $("g900-import").onchange = async e => {
    const file = e.target.files?.[0]; if (!file) return;
    try {
      if (file.size > 25000000) throw Error("备份超过 25 MB。");
      const raw = JSON.parse(await file.text());
      if (raw.type !== "gre900-backup" || raw.sourceSha256 !== B.source.sha256) throw Error("请选择此 900 题版本的独立学习备份。");
      const incoming = C.validate(raw, B); accountTime(); synchronize(); state = C.merge(state, incoming); blocked = false; persist(); render(); notice(screen === "attempt" ? "Study backup merged. The newest answers and notes were kept. Submitted attempts remain submitted." : "学习备份已合并。较新的作答与笔记保留，已交卷记录不会变回未交卷。");
    } catch (err) { notice(screen === "attempt" ? "Import failed. Select a valid study backup for this 900-question bank, under 25 MB. Your existing records have been kept." : "导入失败：" + err.message, true); } finally { e.target.value = ""; }
  };
  document.body.addEventListener("keydown", e => { if (e.key === "Enter" && (view.classList.contains("active") || e.target.closest(".g900") || e.target === nav)) e.stopPropagation(); });
  document.addEventListener("keydown", e => { if (e.key === "Tab" && view.classList.contains("active")) e.stopImmediatePropagation(); }, true);
  document.addEventListener("visibilitychange", () => { accountTime(); timingVisible = !document.hidden; clockStart = performance.now(); persist(); });
  window.addEventListener("pagehide", () => { accountTime(); persist(); });
  window.addEventListener("storage", e => {
    if (e.key !== C.KEY || !e.newValue || blocked) return;
    try { const incoming = C.validate(JSON.parse(e.newValue), B); accountTime(); state = C.merge(state, incoming); if (current()?.status === "submitted" && screen === "attempt") screen = "result"; render(); notice(screen === "attempt" ? "Practice records saved in another tab have been merged." : "已合并另一标签页保存的练习记录。"); }
    catch (_) { notice(screen === "attempt" ? "The other tab's records are invalid. Your current progress has been kept." : "另一标签页的备份格式异常，当前记录未覆盖。", true); }
  });
  setInterval(() => {
    accountTime(); const s = current(); if (s?.status !== "draft" || screen !== "attempt") return;
    if ($("g900-time")) $("g900-time").textContent = time(Object.values(s.elapsed).reduce((a, b) => a + b, 0));
    if (Date.now() - lastSave > 5000) persist();
  }, 1000);
  render();
  if (!contentReady) notice("逐题内容未完整加载。请刷新页面，或重新解压完整项目后启动。学习记录仍保留。", true);
})();
