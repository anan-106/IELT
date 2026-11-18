/* GRE 900: chapter attempts, deferred grading and independent review history. */
(function (root) {
  "use strict";
  const KEY = "gre-900-practice-v1";
  const VERSION = 1;
  const REASONS = ["未标记", "知识点不熟", "读题或翻译", "计算失误", "漏看条件", "图表或单位", "时间不足", "猜测作答"];
  const KINDS = { qc: "数量比较", single: "单选", multi: "多选", numeric: "数值填空", expression: "代数式填空" };
  const DIFFICULTIES = { easy: "Easy · 基础", medium: "Medium · 进阶", hard: "Hard · 提高", data: "图表专项 · 原书未分难度" };
  const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
  const clone = x => JSON.parse(JSON.stringify(x));
  const clean = x => String(x ?? "").trim().replace(/[−–﹣－]/g, "-").replace(/[０-９]/g, c => String(c.charCodeAt(0) - 0xff10)).replace(/％/g, "%");
  const stamp = n => Number.isFinite(n) && n >= 0 && n <= 8640000000000000;
  function gcd(a, b) { a = a < 0n ? -a : a; b = b < 0n ? -b : b; while (b) [a, b] = [b, a % b]; return a || 1n; }
  function decimal(s) {
    if (!/^[+-]?(?:\d+(?:\.\d*)?|\.\d+)$/.test(s) || s.length > 80) return null;
    const negative = s.startsWith("-"); s = s.replace(/^[+-]/, "");
    const [whole, fraction = ""] = s.split(".");
    const n = BigInt((whole || "0") + fraction) * (negative ? -1n : 1n), d = 10n ** BigInt(fraction.length);
    return { n, d };
  }
  function number(value, unit) {
    let s = clean(value).replace(/\s+/g, "");
    if (!s || s.length > 160) return null;
    if (s.endsWith("%")) { if (unit !== "percent") return null; s = s.slice(0, -1); }
    if (s.includes(",")) {
      if (!/^[+-]?\d{1,3}(?:,\d{3})+(?:\.\d+)?$/.test(s)) return null;
      s = s.replace(/,/g, "");
    }
    const parts = s.split("/"); if (parts.length > 2) return null;
    const a = decimal(parts[0]), b = parts.length === 2 ? decimal(parts[1]) : { n: 1n, d: 1n };
    if (!a || !b || !b.n) return null;
    let n = a.n * b.d, d = a.d * b.n; if (d < 0n) { n = -n; d = -d; }
    const g = gcd(n, d); return { n: n / g, d: d / g };
  }
  function numericValue(value, unit) {
    const exact = number(value, unit); if (exact) return Number(exact.n) / Number(exact.d);
    let s = clean(value).replace(/\s+/g, "").replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/π/g, "pi").replace(/√(?=\d)/g, "sqrt");
    if (s.endsWith("%")) { if (unit !== "percent") return null; s = s.slice(0, -1); }
    s = s.replace(/√/g, "sqrt"); if (!s || s.length > 180) return null;
    const tokens = s.match(/sqrt|pi|(?:\d+(?:\.\d*)?|\.\d+)|[()+*/^\-]/g);
    if (!tokens || tokens.join("") !== s || tokens.length > 100) return null;
    const raw = [], end = t => t === ")" || t === "pi" || /^\d|^\./.test(t), start = t => t === "(" || t === "pi" || t === "sqrt" || /^\d|^\./.test(t);
    for (const token of tokens) { if (raw.length && end(raw[raw.length - 1]) && start(token)) raw.push("*"); raw.push(token); }
    let at = 0, depth = 0;
    function atom() {
      if (++depth > 25) throw Error("depth");
      const token = raw[at++]; let v;
      if (token === "sqrt") { const n = atom(); if (n < 0) throw Error("negative root"); v = Math.sqrt(n); }
      else if (token === "pi") v = Math.PI;
      else if (token === "(") { v = sum(); if (raw[at++] !== ")") throw Error("parenthesis"); }
      else { if (!decimal(token || "")) throw Error("token"); v = Number(token); }
      depth--; return v;
    }
    function power() { let v = atom(); if (raw[at] === "^") { at++; const n = unary(); if (!Number.isInteger(n) || Math.abs(n) > 20) throw Error("exponent"); v = v ** n; } return v; }
    function unary() { if (raw[at] === "+") { at++; return unary(); } if (raw[at] === "-") { at++; return -unary(); } return power(); }
    function product() { let v = unary(); while (raw[at] === "*" || raw[at] === "/") { const op = raw[at++], b = unary(); if (op === "/" && b === 0) throw Error("zero denominator"); v = op === "*" ? v * b : v / b; } return v; }
    function sum() { let v = product(); while (raw[at] === "+" || raw[at] === "-") { const op = raw[at++], b = product(); v = op === "+" ? v + b : v - b; } return v; }
    try { const v = sum(); return at === raw.length && Number.isFinite(v) && Math.abs(v) <= 1e100 ? v : null; } catch (_) { return null; }
  }
  function numericEqual(actual, expected, q = {}) {
    const a = number(actual, q.unit), b = number(expected, q.unit);
    if (a && b) {
      if (a.n * b.d === b.n * a.d) return true;
      if (!(Number.isFinite(q.tolerance) && q.tolerance > 0)) return false;
    }
    const av = numericValue(actual, q.unit), bv = numericValue(expected, q.unit); if (av == null || bv == null) return false;
    const tolerance = Number.isFinite(q.tolerance) && q.tolerance > 0 ? q.tolerance : Math.max(1, Math.abs(bv)) * 1e-10;
    return Math.abs(av - bv) <= tolerance;
  }
  // Small, bounded polynomial parser. It never executes user text or uses eval.
  function polynomial(value, variable = "s") {
    if (!/^[a-zA-Z]$/.test(variable)) return null;
    const s = clean(value).replace(/[×·]/g, "*").replace(/÷/g, "/").replace(/\s+/g, "");
    if (!s || s.length > 240) return null;
    const tokens = s.match(/(?:\d+(?:\.\d*)?|\.\d+)|[a-zA-Z]|[()+*/^\-]/g);
    if (!tokens || tokens.join("") !== s || tokens.length > 120) return null;
    const raw = [];
    const atomEnd = t => t === ")" || t === variable || /^\d|^\./.test(t);
    const atomStart = t => t === "(" || t === variable || /^\d|^\./.test(t);
    for (const t of tokens) { if (raw.length && atomEnd(raw[raw.length - 1]) && atomStart(t)) raw.push("*"); raw.push(t); }
    const zero = { n: 0n, d: 1n }, one = { n: 1n, d: 1n };
    const rational = (n, d) => { if (!d) throw Error("zero denominator"); if (d < 0n) { n = -n; d = -d; } const g = gcd(n, d); return { n: n / g, d: d / g }; };
    const add = (a, b) => rational(a.n * b.d + b.n * a.d, a.d * b.d);
    const mul = (a, b) => rational(a.n * b.n, a.d * b.d);
    const trim = p => { while (p.length > 1 && !p[p.length - 1].n) p.pop(); return p; };
    const plus = (a, b) => trim(Array.from({ length: Math.max(a.length, b.length) }, (_, i) => add(a[i] || zero, b[i] || zero)));
    const times = (a, b) => { if (a.length + b.length > 14) throw Error("degree"); const p = Array.from({ length: a.length + b.length - 1 }, () => zero); a.forEach((x, i) => b.forEach((y, j) => p[i + j] = add(p[i + j], mul(x, y)))); return trim(p); };
    let at = 0, depth = 0;
    function atom() {
      if (++depth > 30) throw Error("depth");
      const t = raw[at++]; let p;
      if (t === "(") { p = sum(); if (raw[at++] !== ")") throw Error("parenthesis"); }
      else if (t === variable) p = [zero, one];
      else { const n = decimal(t || ""); if (!n) throw Error("token"); p = [n]; }
      depth--; return p;
    }
    function power() { let p = atom(); if (raw[at] === "^") { at++; const t = raw[at++]; if (!/^\d$/.test(t || "")) throw Error("exponent"); let out = [one]; for (let i = 0; i < Number(t); i++) out = times(out, p); p = out; } return p; }
    function unary() { if (raw[at] === "+") { at++; return unary(); } if (raw[at] === "-") { at++; return unary().map(x => ({ n: -x.n, d: x.d })); } return power(); }
    function product() { let p = unary(); while (["*", "/"].includes(raw[at])) { const op = raw[at++], b = unary(); if (op === "*") p = times(p, b); else { if (b.length !== 1 || !b[0].n) throw Error("nonconstant denominator"); p = p.map(x => rational(x.n * b[0].d, x.d * b[0].n)); } } return p; }
    function sum() { let p = product(); while (["+", "-"].includes(raw[at])) { const op = raw[at++], b = product(); p = plus(p, op === "+" ? b : b.map(x => ({ n: -x.n, d: x.d }))); } return p; }
    try { const p = trim(sum()); return at === raw.length ? p : null; } catch (_) { return null; }
  }
  function expressionEqual(actual, expected, q) {
    const variable = q.variables?.[0] || "s", a = polynomial(actual, variable), b = polynomial(expected, variable);
    return !!a && !!b && a.length === b.length && a.every((x, i) => x.n * b[i].d === b[i].n * x.d);
  }
  function letters(v) {
    const values = Array.isArray(v) ? v.map(clean) : clean(v).toUpperCase().split(/[\s,、;]*/).filter(Boolean);
    if (!values.every(x => /^[A-Z]$/.test(x))) return null;
    return [...new Set(values)].sort();
  }
  function normalize(q, value) {
    if (q.kind === "numeric") { const s = clean(value); return s && numericValue(s, q.unit) != null ? s : null; }
    if (q.kind === "expression") { const s = clean(value); return polynomial(s, q.variables?.[0] || "s") ? s : null; }
    const ls = letters(value), choices = q.options || (q.kind === "qc" ? ["A", "B", "C", "D"] : ["A", "B", "C", "D", "E"]);
    if (!ls?.length || ls.some(x => !choices.includes(x))) return null;
    if (q.kind !== "multi" && ls.length !== 1) return null;
    return ls;
  }
  function answerText(value) { return Array.isArray(value) ? value.join("、") : clean(value); }
  function grade(q, value) {
    if (q.status !== "verified" || q.answer == null) return null;
    const pick = normalize(q, value); if (pick == null) return false;
    if (q.kind === "expression") return (Array.isArray(q.answer) ? q.answer : [q.answer]).some(x => expressionEqual(pick, x, q));
    if (q.kind === "numeric") {
      const answers = Array.isArray(q.answer) ? q.answer : [q.answer];
      return answers.some(x => numericEqual(pick, x, q));
    }
    const correct = letters(q.answer); return !!correct && pick.join("") === correct.join("");
  }
  function fresh() { return { version: VERSION, sessions: {}, activeId: null, notes: {} }; }
  function uid(now) { return `g900-${now}-${Math.random().toString(36).slice(2, 12)}`; }
  function start(section, questions, { now = Date.now(), mode = "chapter", id = uid(now) } = {}) {
    if (!questions.length || questions.some(q => q.sectionId !== section.id)) throw new Error("本轮题目必须属于同一章节。");
    if (!["chapter", "review"].includes(mode)) throw new Error("练习模式无效。");
    const questionIds = questions.map(q => q.id), clocks = () => Object.fromEntries(questionIds.map(id => [id, now]));
    return { id, sectionId: section.id, mode, status: "draft", questionIds, answers: {}, skipped: [], flagged: [], index: 0, elapsed: {}, answerUpdatedAt: clocks(), flagUpdatedAt: clocks(), positionUpdatedAt: now, startedAt: now, updatedAt: now, submittedAt: null, result: null };
  }
  // Older backups only have a session timestamp. Freeze that snapshot timestamp
  // before the next timer tick so it cannot become a newer answer edit.
  function ensureClocks(session) {
    for (const field of ["answerUpdatedAt", "flagUpdatedAt"]) {
      if (session[field] == null) session[field] = Object.fromEntries(session.questionIds.map(id => [id, session.updatedAt]));
      else for (const id of session.questionIds) if (!own(session[field], id)) session[field][id] = session.startedAt;
    }
    if (session.positionUpdatedAt == null) session.positionUpdatedAt = session.updatedAt;
  }
  function editClock(session, field, id, now) {
    ensureClocks(session);
    const previous = id == null ? session[field] : session[field][id];
    // Also order consecutive edits within one millisecond or after a clock rollback.
    const editedAt = Math.max(now, previous + 1);
    if (id == null) session[field] = editedAt; else session[field][id] = editedAt;
    session.updatedAt = Math.max(session.updatedAt, editedAt);
  }
  function putAnswer(session, q, value, now = Date.now()) {
    if (session.status !== "draft" || !session.questionIds.includes(q.id)) throw new Error("已交卷的答案不能修改。");
    editClock(session, "answerUpdatedAt", q.id, now);
    const normalized = normalize(q, value);
    if (normalized == null) delete session.answers[q.id]; else session.answers[q.id] = normalized;
    session.skipped = session.skipped.filter(id => id !== q.id);
    return normalized != null;
  }
  function markSkip(session, id, now = Date.now()) {
    if (session.status !== "draft" || !session.questionIds.includes(id)) throw new Error("无法标记本题。");
    editClock(session, "answerUpdatedAt", id, now);
    delete session.answers[id]; if (!session.skipped.includes(id)) session.skipped.push(id);
  }
  function toggleFlag(session, id, now = Date.now()) {
    if (session.status !== "draft" || !session.questionIds.includes(id)) throw new Error("无法标记本题。");
    editClock(session, "flagUpdatedAt", id, now);
    const flagged = !session.flagged.includes(id);
    session.flagged = flagged ? [...session.flagged, id] : session.flagged.filter(value => value !== id);
    return flagged;
  }
  function move(session, index, now = Date.now()) {
    if (session.status !== "draft" || !Number.isInteger(index) || index < 0 || index >= session.questionIds.length) throw new Error("无法切换题目。");
    if (session.index === index) return false;
    editClock(session, "positionUpdatedAt", null, now); session.index = index;
    return true;
  }
  function unanswered(session) { return session.questionIds.filter(id => !own(session.answers, id) && !session.skipped.includes(id)); }
  function summarize(rows) {
    const total = rows.length, scored = rows.filter(r => r.correct !== null), correct = scored.filter(r => r.correct).length;
    return { total, scored: scored.length, correct, wrong: scored.length - correct, excluded: total - scored.length, skipped: rows.filter(r => r.skipped).length, accuracy: scored.length ? correct / scored.length : null };
  }
  function submit(session, questions, { now = Date.now(), bankVersion = "1" } = {}) {
    if (session.status !== "draft") throw new Error("本轮已交卷，不会重复计分。");
    if (unanswered(session).length) throw new Error("请完成全部题目，或将不会的题明确标记为留空，再交卷。");
    const byId = new Map(questions.map(q => [q.id, q]));
    const rows = session.questionIds.map(id => {
      const q = byId.get(id); if (!q) throw new Error("题库缺少题目，暂不能交卷。");
      const skipped = session.skipped.includes(id), pick = skipped ? null : clone(session.answers[id]);
      const correct = grade(q, pick);
      return { id, pick, skipped, correct, kind: q.kind, topic: q.topic || "待分类", tags: [...(q.tags || [])], difficulty: q.difficulty, answer: q.answer == null ? null : clone(q.answer), explanation: q.explanation || "", reason: q.reason || "", solutionStatus: q.status, elapsedMs: session.elapsed[id] || 0 };
    });
    session.result = { bankVersion, rows, summary: summarize(rows) }; session.status = "submitted"; session.submittedAt = now; session.updatedAt = Math.max(session.updatedAt, now);
    return session.result;
  }
  function grouped(rows, key) {
    const groups = new Map();
    for (const row of rows) { const value = row[key] || "待分类"; if (!groups.has(value)) groups.set(value, []); groups.get(value).push(row); }
    return [...groups].map(([label, values]) => ({ label, ...summarize(values) })).sort((a, b) => b.wrong - a.wrong || a.label.localeCompare(b.label, "zh-CN"));
  }
  function completed(state, { sectionId, mode } = {}) {
    return Object.values(state.sessions).filter(s => s.status === "submitted" && (!sectionId || s.sectionId === sectionId) && (!mode || s.mode === mode)).sort((a, b) => a.submittedAt - b.submittedAt || a.id.localeCompare(b.id));
  }
  function latestRows(state, { sectionId } = {}) {
    const map = new Map();
    for (const s of completed(state, { sectionId })) for (const row of s.result.rows) map.set(row.id, { ...row, sessionId: s.id, submittedAt: s.submittedAt, sectionId: s.sectionId });
    return [...map.values()];
  }
  function wrongIds(state, sectionId) { return latestRows(state, { sectionId }).filter(r => r.correct === false).map(r => r.id); }
  function firstRows(state, sectionId) {
    const rows = new Map();
    for (const s of completed(state, { sectionId, mode: "chapter" })) for (const row of s.result.rows) if (!rows.has(row.id)) rows.set(row.id, row);
    return [...rows.values()];
  }
  function addTime(session, id, milliseconds, now = Date.now()) {
    if (session.status !== "draft" || !session.questionIds.includes(id) || !Number.isFinite(milliseconds) || milliseconds <= 0) return;
    ensureClocks(session);
    session.elapsed[id] = (session.elapsed[id] || 0) + Math.min(milliseconds, 60000); session.updatedAt = Math.max(session.updatedAt, now);
  }
  function validationError(message) { throw new Error("900 题备份无效：" + message); }
  function validate(raw, bank) {
    if (!raw || raw.version !== VERSION || !raw.sessions || typeof raw.sessions !== "object" || Array.isArray(raw.sessions)) validationError("版本或结构不匹配");
    const qs = new Map(bank.questions.map(q => [q.id, q])), sections = new Map(bank.sections.map(s => [s.id, s]));
    const out = fresh(), values = Object.values(raw.sessions); if (values.length > 10000) validationError("练习记录过多");
    for (const s of values) {
      if (!s || typeof s.id !== "string" || !/^[\w:-]{1,120}$/.test(s.id) || ["__proto__", "constructor", "prototype"].includes(s.id) || own(out.sessions, s.id)) validationError("记录编号重复或不合法");
      if (!sections.has(s.sectionId) || !["chapter", "review"].includes(s.mode) || !["draft", "submitted"].includes(s.status)) validationError("章节或状态不合法");
      if (!Array.isArray(s.questionIds) || !s.questionIds.length || s.questionIds.length > 30 || new Set(s.questionIds).size !== s.questionIds.length || s.questionIds.some(id => !qs.has(id) || qs.get(id).sectionId !== s.sectionId)) validationError("题目清单不合法");
      if (s.mode === "chapter") {
        const expected = bank.questions.filter(q => q.sectionId === s.sectionId).map(q => q.id);
        if (expected.join("|") !== s.questionIds.join("|")) validationError("整章练习的题目不完整或顺序改变");
      }
      if (!stamp(s.startedAt) || !stamp(s.updatedAt) || s.updatedAt < s.startedAt || !Number.isInteger(s.index) || s.index < 0 || s.index >= s.questionIds.length) validationError("时间或题目位置不合法");
      const n = start(sections.get(s.sectionId), s.questionIds.map(id => qs.get(id)), { id: s.id, mode: s.mode, now: s.startedAt });
      n.index = s.index; n.updatedAt = s.updatedAt;
      if (!s.answers || typeof s.answers !== "object" || Array.isArray(s.answers)) validationError("答案结构不合法");
      for (const [id, answer] of Object.entries(s.answers)) {
        if (!s.questionIds.includes(id)) validationError("包含不属于本轮的答案");
        const value = normalize(qs.get(id), answer); if (value == null) validationError("答案格式不合法"); n.answers[id] = value;
      }
      for (const field of ["skipped", "flagged"]) {
        if (!Array.isArray(s[field]) || s[field].some(id => !s.questionIds.includes(id))) validationError("标记结构不合法");
        n[field] = [...new Set(s[field])];
      }
      if (n.skipped.some(id => own(n.answers, id))) validationError("同一题不能同时作答和留空");
      for (const field of ["answerUpdatedAt", "flagUpdatedAt"]) {
        if (s[field] === undefined) n[field] = Object.fromEntries(s.questionIds.map(id => [id, s.updatedAt]));
        else {
          if (!s[field] || typeof s[field] !== "object" || Array.isArray(s[field])) validationError("修改时间结构不合法");
          for (const [id, at] of Object.entries(s[field])) {
            if (!s.questionIds.includes(id) || !stamp(at) || at < s.startedAt || at > s.updatedAt) validationError("修改时间不合法");
            n[field][id] = at;
          }
        }
      }
      n.positionUpdatedAt = s.positionUpdatedAt === undefined ? s.updatedAt : s.positionUpdatedAt;
      if (!stamp(n.positionUpdatedAt) || n.positionUpdatedAt < s.startedAt || n.positionUpdatedAt > s.updatedAt) validationError("题目位置时间不合法");
      for (const [id, time] of Object.entries(s.elapsed || {})) {
        if (!s.questionIds.includes(id) || !Number.isFinite(time) || time < 0 || time > 31536000000) validationError("计时不合法"); n.elapsed[id] = time;
      }
      if (s.status === "submitted") {
        if (!stamp(s.submittedAt) || s.submittedAt < s.startedAt || s.submittedAt > s.updatedAt || unanswered(n).length) validationError("交卷记录不完整");
        // Regrade against this version of the bank rather than trusting imported score totals.
        submit(n, bank.questions, { now: s.submittedAt, bankVersion: bank.version }); n.updatedAt = s.updatedAt;
      }
      out.sessions[n.id] = n;
    }
    for (const [id, note] of Object.entries(raw.notes || {})) {
      if (!qs.has(id) || !note || typeof note.text !== "string" || note.text.length > 5000 || !REASONS.includes(note.reason) || !stamp(note.updatedAt)) validationError("复习笔记不合法");
      out.notes[id] = { text: note.text, reason: note.reason, updatedAt: note.updatedAt };
    }
    out.activeId = typeof raw.activeId === "string" && own(out.sessions, raw.activeId) ? raw.activeId : null;
    return out;
  }
  const answerState = (session, id) => own(session.answers, id) ? `0:${JSON.stringify(session.answers[id])}` : session.skipped.includes(id) ? "1:skipped" : "2:cleared";
  function mergeDraft(current, incoming) {
    if (current.sectionId !== incoming.sectionId || current.mode !== incoming.mode || current.startedAt !== incoming.startedAt || current.questionIds.join("|") !== incoming.questionIds.join("|")) throw new Error("同编号练习的章节、题目或开始时间不一致，无法合并。");
    const out = clone(current), next = clone(incoming); ensureClocks(out); ensureClocks(next);
    for (const id of out.questionIds) {
      const a = out.answerUpdatedAt[id], b = next.answerUpdatedAt[id];
      // Equal-millisecond conflicts use a stable order; clearing wins a tie.
      if (b > a || (b === a && answerState(next, id) > answerState(out, id))) {
        if (own(next.answers, id)) out.answers[id] = clone(next.answers[id]); else delete out.answers[id];
        out.skipped = out.skipped.filter(value => value !== id);
        if (next.skipped.includes(id)) out.skipped.push(id);
        out.answerUpdatedAt[id] = b;
      }
      const fa = out.flagUpdatedAt[id], fb = next.flagUpdatedAt[id];
      if (fb > fa || (fb === fa && !next.flagged.includes(id))) {
        out.flagged = out.flagged.filter(value => value !== id);
        if (next.flagged.includes(id)) out.flagged.push(id);
        out.flagUpdatedAt[id] = fb;
      }
      if (own(out.elapsed, id) || own(next.elapsed, id)) out.elapsed[id] = Math.max(out.elapsed[id] || 0, next.elapsed[id] || 0);
    }
    if (next.positionUpdatedAt > out.positionUpdatedAt || (next.positionUpdatedAt === out.positionUpdatedAt && next.index > out.index)) {
      out.index = next.index; out.positionUpdatedAt = next.positionUpdatedAt;
    }
    out.skipped = out.questionIds.filter(id => out.skipped.includes(id));
    out.flagged = out.questionIds.filter(id => out.flagged.includes(id));
    out.updatedAt = Math.max(out.updatedAt, next.updatedAt);
    return out;
  }
  function merge(current, incoming) {
    const out = clone(current);
    for (const [id, s] of Object.entries(incoming.sessions)) {
      const old = out.sessions[id];
      if (!old || (old.status !== "submitted" && s.status === "submitted")) out.sessions[id] = clone(s);
      else if (old.status === "draft" && s.status === "draft") out.sessions[id] = mergeDraft(old, s);
      else if (old.status === "submitted" && s.status === "submitted" && (s.updatedAt > old.updatedAt || (s.updatedAt === old.updatedAt && JSON.stringify(s.questionIds.map(id => answerState(s, id))) > JSON.stringify(old.questionIds.map(id => answerState(old, id)))))) out.sessions[id] = clone(s);
      ensureClocks(out.sessions[id]);
    }
    for (const [id, n] of Object.entries(incoming.notes)) if (!out.notes[id] || n.updatedAt > out.notes[id].updatedAt) out.notes[id] = clone(n);
    return out;
  }
  const api = { KEY, VERSION, REASONS, KINDS, DIFFICULTIES, clean, number, numericValue, numericEqual, polynomial, expressionEqual, letters, normalize, answerText, grade, fresh, start, putAnswer, markSkip, toggleFlag, move, unanswered, summarize, submit, grouped, completed, latestRows, wrongIds, firstRows, addTime, validate, merge };
  if (typeof module !== "undefined" && module.exports) module.exports = api; else root.GRE900Core = api;
})(typeof window !== "undefined" ? window : globalThis);
