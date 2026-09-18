// Curated external GRE resource library from public GitHub repositories.
// We link to source materials rather than copying third-party PDFs into this repo.
(() => {
  "use strict";

  const KEY = "gre-all-in-one-resource-progress-v1";
  const BASE = "https://github.com/RuiWang6188/GRE-All-In-One/blob/master/";
  const DIR = "https://github.com/RuiWang6188/GRE-All-In-One/tree/master/";
  const GSY_BASE = "https://github.com/GSY2020/GRE/blob/main/";

  const resources = [
    {
      id: "vocab-17days", cat: "词汇", phase: "基础", title: "17天搞定GRE单词·杨鹏",
      note: "源仓库作者明确推荐的背词方法论；核心提醒是复习比只背新词更重要。",
      url: BASE + "Vocabulary/17天搞定GRE单词杨鹏.pdf"
    },
    {
      id: "vocab-review-xlsx", cat: "词汇", phase: "基础", title: "GRE-WORD-REVIEW.xlsx",
      note: "可作为人工复盘/错词记录的配套表；项目本身仍以本地错词本为主。",
      url: BASE + "Vocabulary/GRE-WORD-REVIEW.xlsx"
    },
    {
      id: "vocab-d3k-refine", cat: "词汇", phase: "基础", title: "再要你命3000·精练部分",
      note: "与本站大三千主词库对应，适合做大三千的精练补充阅读。",
      url: BASE + "Vocabulary/要你命系列/GRE词汇-再要你命3000精练部分.pdf"
    },
    {
      id: "vocab-rescue800", cat: "词汇", phase: "冲刺", title: "GRE救命800词",
      note: "源仓库 README 建议考前一周用于强化巩固；不替代大三千主词库。",
      url: BASE + "Vocabulary/微臣考前单词/GRE救命800词.pdf"
    },
    {
      id: "vocab-collocations", cat: "词汇", phase: "冲刺", title: "GRE高分必备短语搭配",
      note: "考前补充固定搭配/短语；仅作为外部资料入口。",
      url: BASE + "Vocabulary/微臣考前单词/GRE高分必备短语搭配.pdf"
    },
    {
      id: "verbal-long", cat: "Verbal", phase: "基础", title: "GRE长难句",
      note: "源仓库 README 推荐约100句、每天20句自行分析理解，用来提升填空与阅读的句法处理速度。",
      url: BASE + "Verbal/Reading/长难句.pdf"
    },
    {
      id: "verbal-reading-logic", cat: "Verbal", phase: "强化", title: "解密GRE阅读逻辑线",
      note: "阅读方法资料；作为策略补充，不复制其正文。",
      url: BASE + "Verbal/Reading/解密GRE阅读逻辑线.pdf"
    },
    {
      id: "verbal-rc240", cat: "Verbal", phase: "强化", title: "GRE阅读机经240篇",
      note: "阅读训练入口。本站继续使用原创练习题，不把原文题目嵌入公开题库。",
      url: DIR + "Verbal/Reading"
    },
    {
      id: "verbal-36", cat: "Verbal", phase: "强化", title: "GRE36套",
      note: "套题训练入口；用于源资料自学。",
      url: BASE + "Verbal/Reading/GRE36套.pdf"
    },
    {
      id: "verbal-tc1250", cat: "Verbal", phase: "强化", title: "GRE填空机经1250题 + 解析",
      note: "Text Completion 大量练习入口；本站不复制机经题干，只提供源资料导航。",
      url: DIR + "Verbal/Text-Completion"
    },
    {
      id: "quant-ets-review", cat: "Quant", phase: "基础", title: "ETS GRE Math Review",
      note: "数学知识点总复习入口；优先用于查漏补缺。",
      url: BASE + "Quantitative/ETS官方_gre_math_review.pdf"
    },
    {
      id: "quant-ets-conventions", cat: "Quant", phase: "基础", title: "ETS Math Conventions",
      note: "数学符号、图形和考试约定；容易被忽略，但适合考前快速过一遍。",
      url: BASE + "Quantitative/ETS官方_gre_math_conventions.pdf"
    },
    {
      id: "quant-200", cat: "Quant", phase: "强化", title: "巍哥GRE数学机经200题",
      note: "你指定加入的数学机经200题；建议按套限时做，并把知识点不会、读题错误、计算错误分别记入错题本。",
      url: GSY_BASE + "巍哥GRE数学机经200题.pdf"
    },
    {
      id: "quant-170", cat: "Quant", phase: "冲刺", title: "巍哥GRE数学170难题3.0",
      note: "保留作高难题补充；建议在200题基础上针对薄弱知识点使用。",
      url: BASE + "Quantitative/巍哥GRE数学170难题3.0.pdf"
    },
    {
      id: "quant-full", cat: "Quant", phase: "基础", title: "巍哥GRE数学满分宝典",
      note: "你指定加入的系统复习资料；适合按 Arithmetic / Algebra / Geometry / Data Analysis 查漏补缺。",
      url: GSY_BASE + "巍哥GRE数学满分宝典.pdf"
    },
    {
      id: "quant-vocab", cat: "Quant", phase: "基础", title: "巍哥GRE数学词汇汇总",
      note: "你指定加入的数学英文词汇资料；优先补齐题干中的数学术语和固定表达。",
      url: GSY_BASE + "巍哥GRE数学词汇汇总.pdf"
    },
    {
      id: "quant-vocab-weichen", cat: "Quant", phase: "补充", title: "微臣GRE数学词汇2.0",
      note: "另一套数学术语补充资料，可与巍哥数学词汇交叉查漏。",
      url: BASE + "Quantitative/微臣GRE数学词汇2.0.pdf"
    },
    {
      id: "writing-issue", cat: "写作", phase: "强化", title: "Issue 写作资料目录",
      note: "现行 GRE 只保留 Analyze an Issue；本站写作计时器继续按当前考试结构使用。",
      url: DIR + "Analitical-Writing/Issue"
    },
    {
      id: "writing-55", cat: "写作", phase: "强化", title: "新GRE写作5.5·李建林",
      note: "源仓库 README 推荐给时间较充裕、希望提高作文的考生参考。",
      url: BASE + "Analitical-Writing/新GRE写作5.5(最新修订版)%2B李建林.pdf"
    },
    {
      id: "writing-argument-old", cat: "写作", phase: "历史", title: "Argument 旧资料",
      note: "历史资料：当前短版 GRE 已取消 Analyze an Argument，不纳入本站每日计划。",
      url: DIR + "Analitical-Writing/Argument"
    },
    {
      id: "general-og", cat: "综合", phase: "基础", title: "GRE OG（源仓库入口）",
      note: "综合资料入口。涉及旧版结构的内容需以当前 ETS 页面为准。",
      url: BASE + "OG.pdf"
    }
  ];

  function readProgress() {
    try { return JSON.parse(localStorage.getItem(KEY) || "{}") || {}; }
    catch { return {}; }
  }
  function writeProgress(x) { localStorage.setItem(KEY, JSON.stringify(x)); }
  function esc(v) { return String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;"); }

  let filter = "全部";

  function routeText() {
    let planDays = 30;
    try {
      const s = JSON.parse(localStorage.getItem("gre-prep-v1") || "{}") || {};
      planDays = Number(s.settings?.planDays || 30);
    } catch {}
    if (planDays <= 21) return "冲刺型：大三千高优先级 + 每日复习 → 长难句/填空练习 → 巍哥数学机经200题（薄弱处补170难题）→ 考前救命800。";
    if (planDays <= 45) return "均衡型：大三千主线 + 长难句 → TC/RC 强化 → ETS Math Review + 巍哥数学满分宝典/机经200题 → Issue 写作。";
    return "长期型：大三千完整推进 + 长难句和阅读逻辑 → 数学满分宝典 + 数学词汇系统查漏 → 200题/170难题冲刺。";
  }

  function injectStyle() {
    if (document.getElementById("greResourceStyle")) return;
    const style = document.createElement("style");
    style.id = "greResourceStyle";
    style.textContent = `
      .resource-summary{display:grid;grid-template-columns:repeat(4,minmax(0,1fr));gap:12px;margin:0 0 16px}
      .resource-card{border:1px solid var(--line);border-radius:16px;padding:16px;background:var(--panel);display:grid;gap:10px}
      .resource-top{display:flex;justify-content:space-between;gap:10px;align-items:flex-start}
      .resource-card h3{margin:0;font-size:1rem}.resource-card p{margin:0;color:var(--muted);font-size:.82rem;line-height:1.6}
      .resource-badges{display:flex;gap:6px;flex-wrap:wrap}.resource-badge{font-size:.68rem;border:1px solid var(--line);padding:3px 7px;border-radius:999px;color:var(--muted)}
      .resource-actions{display:flex;gap:8px;align-items:center;flex-wrap:wrap}.resource-link{text-decoration:none}.resource-done{opacity:.62}
      .resource-note{margin:12px 0 16px;padding:12px 14px;border:1px solid var(--line);border-radius:14px;color:var(--muted);font-size:.8rem;line-height:1.6}
      @media(max-width:800px){.resource-summary{grid-template-columns:repeat(2,minmax(0,1fr))}}
    `;
    document.head.appendChild(style);
  }

  function render() {
    const root = document.getElementById("resourceLibrary");
    if (!root) return;
    const progress = readProgress();
    const done = resources.filter(r => progress[r.id]).length;
    const cats = ["全部", "词汇", "Verbal", "Quant", "写作", "综合"];
    const rows = resources.filter(r => filter === "全部" || r.cat === filter);

    root.innerHTML = `
      <div class="resource-summary">
        <article class="metric"><span>资料入口</span><strong>${resources.length}</strong><small>来自多个公开 GRE GitHub</small></article>
        <article class="metric"><span>已完成</span><strong>${done}</strong><small>本地记录</small></article>
        <article class="metric"><span>主线</span><strong>大三千</strong><small>不改变当前主词库</small></article>
        <article class="metric"><span>版权处理</span><strong>仅链接</strong><small>不复制第三方PDF</small></article>
      </div>
      <div class="resource-note"><strong>建议路线：</strong>${esc(routeText())}<br>源仓库作者的核心建议是先把词汇打牢、重视复习；阅读重点练长难句；数学基础不错时可在考前集中刷170难题。当前 GRE 考试结构仍以 ETS 最新说明为准。</div>
      <div class="chips" id="resourceFilters">${cats.map(c => `<button class="chip ${filter===c?"active":""}" data-resource-filter="${c}">${c}</button>`).join("")}</div>
      <div class="list-grid" style="margin-top:14px">${rows.map(r => {
        const isDone = !!progress[r.id];
        return `<article class="resource-card ${isDone?"resource-done":""}">
          <div class="resource-top"><div><div class="resource-badges"><span class="resource-badge">${esc(r.cat)}</span><span class="resource-badge">${esc(r.phase)}</span></div><h3 style="margin-top:8px">${esc(r.title)}</h3></div><input type="checkbox" data-resource-done="${esc(r.id)}" ${isDone?"checked":""} title="标记完成" /></div>
          <p>${esc(r.note)}</p>
          <div class="resource-actions"><a class="primary resource-link" href="${r.url}" target="_blank" rel="noopener noreferrer">打开源资料</a><span class="muted">${isDone?"已完成":"未完成"}</span></div>
        </article>`;
      }).join("")}</div>`;

    root.querySelectorAll("[data-resource-filter]").forEach(b => b.onclick = () => { filter = b.dataset.resourceFilter; render(); });
    root.querySelectorAll("[data-resource-done]").forEach(cb => cb.onchange = () => {
      const p = readProgress();
      if (cb.checked) p[cb.dataset.resourceDone] = { doneAt: Date.now() };
      else delete p[cb.dataset.resourceDone];
      writeProgress(p); render();
    });
  }

  injectStyle();
  document.querySelector("[data-view='resources']")?.addEventListener("click", () => setTimeout(render, 0));
  window.addEventListener("storage", render);
  render();

  window.__GRE_RESOURCES__ = { resources, render };
})();
