// Lightweight GRE-style practice calculator for Quant sessions.
(() => {
  "use strict";
  const USAGE_KEY = "gre-calculator-usage-v1";

  function readUsage() {
    try { return JSON.parse(localStorage.getItem(USAGE_KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function writeUsage(x) { localStorage.setItem(USAGE_KEY, JSON.stringify(x)); }
  function bump(field) {
    const u = readUsage();
    u[field] = (u[field] || 0) + 1;
    u.lastUsedAt = Date.now();
    writeUsage(u);
  }

  function injectStyle() {
    if (document.getElementById("greCalcStyle")) return;
    const style = document.createElement("style");
    style.id = "greCalcStyle";
    style.textContent = `
      .gre-calc-toggle{margin-left:8px}
      .gre-calc-modal{position:fixed;inset:0;background:rgba(15,23,42,.38);display:none;place-items:center;z-index:9999;padding:20px}
      .gre-calc-modal.open{display:grid}
      .gre-calc{width:min(360px,94vw);background:var(--panel,#fff);border:1px solid var(--line,#d7dce5);border-radius:18px;box-shadow:0 24px 70px rgba(15,23,42,.22);padding:14px}
      .gre-calc-head{display:flex;justify-content:space-between;align-items:center;gap:10px;margin-bottom:10px}
      .gre-calc-display{width:100%;box-sizing:border-box;padding:14px 12px;border:1px solid var(--line,#d7dce5);border-radius:10px;text-align:right;font-size:1.45rem;background:#f8fafc;color:#111827;margin-bottom:10px}
      .gre-calc-grid{display:grid;grid-template-columns:repeat(5,1fr);gap:7px}
      .gre-calc-grid button{padding:11px 5px;border:1px solid var(--line,#d7dce5);border-radius:9px;background:var(--panel,#fff);font-weight:700;cursor:pointer}
      .gre-calc-grid button:hover{background:#f1f5f9}
      .gre-calc-grid .op{background:#f8fafc}.gre-calc-grid .eq{background:#111827;color:#fff}
      .gre-calc-note{font-size:.7rem;color:var(--muted);line-height:1.5;margin-top:9px}
    `;
    document.head.appendChild(style);
  }

  function boot() {
    injectStyle();
    const quantHead = document.querySelector("#view-quant .section-head > div:last-child") || document.querySelector("#view-quant .section-head");
    if (quantHead && !document.getElementById("greCalcToggle")) {
      const btn = document.createElement("button");
      btn.id = "greCalcToggle";
      btn.className = "ghost gre-calc-toggle";
      btn.textContent = "计算器";
      btn.type = "button";
      quantHead.appendChild(btn);
    }

    if (!document.getElementById("greCalcModal")) {
      const modal = document.createElement("div");
      modal.id = "greCalcModal";
      modal.className = "gre-calc-modal";
      modal.innerHTML = `
        <div class="gre-calc" role="dialog" aria-label="GRE Quant 练习计算器">
          <div class="gre-calc-head"><strong>GRE Quant 练习计算器</strong><button class="ghost" id="greCalcClose">关闭</button></div>
          <input id="greCalcDisplay" class="gre-calc-display" value="0" readonly />
          <div class="gre-calc-grid">
            <button data-mem="MC">MC</button><button data-mem="MR">MR</button><button data-mem="M+">M+</button><button data-mem="M-">M−</button><button data-act="clear">C</button>
            <button data-val="7">7</button><button data-val="8">8</button><button data-val="9">9</button><button class="op" data-val="/">÷</button><button data-act="sqrt">√</button>
            <button data-val="4">4</button><button data-val="5">5</button><button data-val="6">6</button><button class="op" data-val="*">×</button><button data-act="back">⌫</button>
            <button data-val="1">1</button><button data-val="2">2</button><button data-val="3">3</button><button class="op" data-val="-">−</button><button data-act="sign">+/−</button>
            <button data-val="0">0</button><button data-val=".">.</button><button data-val="(">(</button><button data-val=")">)</button><button class="op" data-val="+">+</button>
            <button class="eq" style="grid-column:1/-1" data-act="equals">=</button>
          </div>
          <div class="gre-calc-note">练习用近似界面。ETS 当前 Quant 提供屏幕计算器，但并非每题都值得使用；训练时也要练估算和心算。</div>
        </div>`;
      document.body.appendChild(modal);
    }

    const modal = document.getElementById("greCalcModal");
    const display = document.getElementById("greCalcDisplay");
    let expr = "0", memory = 0;

    function show() { display.value = expr || "0"; }
    function currentValue() {
      const safe = String(expr || "0");
      if (!/^[0-9+\-*/().\s]+$/.test(safe)) return NaN;
      try {
        const v = Function('"use strict";return (' + safe + ')')();
        return Number(v);
      } catch { return NaN; }
    }
    function setValue(v) {
      expr = Number.isFinite(Number(v)) ? String(Number(v)) : "Error";
      show();
    }

    document.getElementById("greCalcToggle")?.addEventListener("click", () => {
      modal.classList.add("open");
      bump("opens");
    });
    document.getElementById("greCalcClose")?.addEventListener("click", () => modal.classList.remove("open"));
    modal?.addEventListener("click", e => { if (e.target === modal) modal.classList.remove("open"); });

    modal?.querySelectorAll("[data-val]").forEach(btn => btn.onclick = () => {
      const v = btn.dataset.val;
      if (expr === "0" || expr === "Error") expr = "";
      expr += v;
      show();
      bump("keyPresses");
    });

    modal?.querySelectorAll("[data-act]").forEach(btn => btn.onclick = () => {
      const act = btn.dataset.act;
      if (act === "clear") expr = "0";
      else if (act === "back") expr = expr.length > 1 ? expr.slice(0,-1) : "0";
      else if (act === "equals") setValue(currentValue());
      else if (act === "sqrt") {
        const v = currentValue();
        setValue(v >= 0 ? Math.sqrt(v) : NaN);
      } else if (act === "sign") {
        const v = currentValue();
        setValue(Number.isFinite(v) ? -v : NaN);
      }
      show();
      bump("keyPresses");
    });

    modal?.querySelectorAll("[data-mem]").forEach(btn => btn.onclick = () => {
      const act = btn.dataset.mem;
      const v = currentValue();
      if (act === "MC") memory = 0;
      if (act === "MR") setValue(memory);
      if (act === "M+" && Number.isFinite(v)) memory += v;
      if (act === "M-" && Number.isFinite(v)) memory -= v;
      bump("memoryOps");
    });
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__GRE_CALCULATOR__ = { usage: readUsage };
})();