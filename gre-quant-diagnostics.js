// ETS-style Quant diagnostics: content area, difficulty, timing, and error-reason tracking.
(() => {
  "use strict";
  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  const KEY = "gre-quant-diagnostics-v1";
  const MAIN_KEY = "gre-prep-v1";
  const REASONS = ["知识点不会","英文读题","公式/方法","计算错误","粗心","时间不足"];
  const $ = (id) => document.getElementById(id);
  const norm = (v) => String(v ?? "").replace(/\s+/g," ").trim();

  function loadDiag() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function saveDiag(x) { localStorage.setItem(KEY, JSON.stringify(x)); }
  function loadMain() {
    try { return JSON.parse(localStorage.getItem(MAIN_KEY) || "{}") || {}; }
    catch { return {}; }
  }

  function currentQuantQuestion() {
    const root = $("quantCard");
    if (!root || !root.closest(".view")?.classList.contains("active")) return null;
    const title = root.querySelector(".qcard h3");
    if (!title) return null;
    const p = norm(title.textContent);
    return DATA.quant.find(q => norm(q.prompt) === p) || null;
  }

  function annotateCard() {
    const root = $("quantCard");
    const q = currentQuantQuestion();
    if (!root || !q) return;
    const qhead = root.querySelector(".qhead");
    if (qhead && !qhead.querySelector(".quant-meta")) {
      const meta = document.createElement("span");
      meta.className = "muted quant-meta";
      meta.textContent = `${q.area || "未分类"} · ${q.topic || ""} · 难度 ${q.difficulty || "—"} · ${q.setting || ""}`;
      qhead.appendChild(meta);
    }
  }

  function recordReason(qid, reason) {
    const d = loadDiag();
    d[qid] = d[qid] || { reasons:{}, lastReason:"", updatedAt:0 };
    d[qid].reasons[reason] = (d[qid].reasons[reason] || 0) + 1;
    d[qid].lastReason = reason;
    d[qid].updatedAt = Date.now();
    saveDiag(d);
    renderStats();
  }

  function injectReasonPicker() {
    const q = currentQuantQuestion();
    const root = $("quantCard");
    if (!q || !root) return;
    const feedback = root.querySelector(".feedback.bad");
    if (!feedback || feedback.querySelector(".quant-reason-picker")) return;

    const box = document.createElement("div");
    box.className = "quant-reason-picker";
    box.style.cssText = "margin-top:12px;padding-top:10px;border-top:1px solid var(--line)";
    box.innerHTML = `
      <div class="muted" style="margin-bottom:7px">这题主要为什么错？</div>
      <div class="chips">${REASONS.map(r => `<button class="chip" data-quant-reason="${r}">${r}</button>`).join("")}</div>`;
    const next = feedback.querySelector("#practiceNext")?.parentElement;
    if (next) next.insertAdjacentElement("beforebegin", box);
    else feedback.appendChild(box);

    box.querySelectorAll("[data-quant-reason]").forEach(btn => {
      btn.onclick = () => {
        const reason = btn.dataset.quantReason;
        recordReason(q.id, reason);
        box.innerHTML = `<div class="muted">已记录主要原因：<strong>${reason}</strong></div>`;
      };
    });
  }

  function statForQuestion(qid) {
    const s = loadMain().questions?.[qid] || {};
    return {
      attempts:Number(s.attempts||0),
      correct:Number(s.correct||0),
      wrong:Number(s.wrong||0),
      totalMs:Number(s.totalMs||0)
    };
  }

  function aggregateByArea() {
    const areas = ["Arithmetic","Algebra","Geometry","Data Analysis"];
    return areas.map(area => {
      let attempts=0,correct=0,totalMs=0,questions=0;
      DATA.quant.filter(q => q.area === area).forEach(q => {
        const s = statForQuestion(q.id);
        attempts += s.attempts; correct += s.correct; totalMs += s.totalMs; questions++;
      });
      return {
        area, attempts, correct, questions,
        accuracy: attempts ? Math.round(correct/attempts*100) : 0,
        avgSec: attempts ? Math.round(totalMs/attempts/1000) : 0
      };
    });
  }

  function aggregateReasons() {
    const d = loadDiag();
    const out = Object.fromEntries(REASONS.map(r => [r,0]));
    Object.values(d).forEach(x => {
      Object.entries(x?.reasons || {}).forEach(([k,v]) => out[k] = (out[k]||0) + Number(v||0));
    });
    return out;
  }

  function renderStats() {
    const areaRoot = $("quantAreaStats");
    const reasonRoot = $("quantErrorStats");
    if (areaRoot) {
      areaRoot.innerHTML = aggregateByArea().map(r => `
        <div class="barrow">
          <span>${r.area}<small class="muted" style="display:block">${r.attempts ? `平均 ${r.avgSec}s · ${r.attempts} 次作答` : `${r.questions} 道题，未练习`}</small></span>
          <div class="bar"><i style="width:${r.accuracy}%"></i></div>
          <b>${r.attempts ? r.accuracy+"%" : "—"}</b>
        </div>`).join("");
    }
    if (reasonRoot) {
      const reasons = aggregateReasons();
      const max = Math.max(1, ...Object.values(reasons));
      reasonRoot.innerHTML = REASONS.map(r => `
        <div class="barrow">
          <span>${r}</span>
          <div class="bar"><i style="width:${Math.round((reasons[r]||0)/max*100)}%"></i></div>
          <b>${reasons[r]||0}</b>
        </div>`).join("");
    }
  }

  function boot() {
    const quant = $("quantCard");
    if (quant) {
      new MutationObserver(() => requestAnimationFrame(() => {
        annotateCard();
        injectReasonPicker();
      })).observe(quant, {childList:true, subtree:true, attributes:true, attributeFilter:["class"]});
    }
    document.querySelector("[data-view='stats']")?.addEventListener("click", () => setTimeout(renderStats, 0));
    document.querySelector("[data-view='quant']")?.addEventListener("click", () => setTimeout(annotateCard, 0));
    renderStats();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__GRE_QUANT_DIAGNOSTICS__ = { renderStats, aggregateByArea, aggregateReasons };
})();