// GRE vocabulary understanding layer: conservative roots/word-history hints + memory-friendly explanations.
// Goal: help understanding, not force every word into a fake root decomposition.
(() => {
  "use strict";
  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  const SETTINGS_KEY = "gre-word-insight-settings-v1";
  const $ = (id) => document.getElementById(id);
  const norm = (v) => String(v ?? "").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
  const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");

  const WORD_NOTES = {
    "aberrant": {parts:"ab-（离开） + err（游走、偏离）", logic:"从正常轨道“走开” → 偏离常规 → 异常的"},
    "ameliorate": {parts:"melior（更好）", logic:"让事情变得 better → 改善、缓和"},
    "benevolent": {parts:"bene（好） + vol（意愿、希望）", logic:"对别人怀有“好的愿望” → 仁慈的、善意的"},
    "circumspect": {parts:"circum（周围） + spect（看）", logic:"做决定前“四周都看一遍” → 谨慎周到的"},
    "concede": {parts:"con-（一起/加强） + ced/cess（走、让步）", logic:"向后让一步 → 让步；进一步可理解为承认对方一点"},
    "credulous": {parts:"cred（相信）", logic:"太容易 believe → 轻信的"},
    "cursory": {parts:"cur/curr（跑）", logic:"像“跑着看一遍” → 匆忙的、草率的"},
    "denigrate": {parts:"de-（向下） + nigr（黑）", logic:"把别人“抹黑” → 贬低、诋毁"},
    "diffident": {parts:"dif-/dis-（缺失、分离） + fid（信任）", logic:"缺少对自己的信任 → 缺乏自信的"},
    "disparate": {parts:"dis-（分开） + par（相等）", logic:"彼此“不相等/分开” → 截然不同的"},
    "didactic": {parts:"didact（教）", logic:"核心是 teach → 教学性的；语境里常带“说教味”"},
    "eclectic": {parts:"ec-/ek-（从中） + lect（选择）", logic:"从不同来源“挑选” → 兼收并蓄的"},
    "enervate": {parts:"e-/ex-（去掉） + nerv（筋、力量）", logic:"把“筋力”拿走 → 使虚弱"},
    "engender": {parts:"gen/gener（产生、出生）", logic:"使某事“产生出来” → 引起、产生"},
    "ephemeral": {parts:"epi- + hemer（日）", logic:"本义带有“一日之间”的时间感 → 短暂的"},
    "equanimity": {parts:"equ/aequ（平等、平） + anim（心、精神）", logic:"内心保持“平” → 镇定、平静"},
    "equivocate": {parts:"equi（相等） + voc（声音、说）", logic:"像同时给出两种声音、不把话说死 → 含糊其辞"},
    "erudite": {parts:"e-/ex-（脱离） + rud（粗糙、未训练）", logic:"从“未受训练”状态走出来 → 博学的"},
    "exacerbate": {parts:"ex-（加强） + acer/acerb（尖、苦、严酷）", logic:"让情况更尖锐、更严酷 → 加剧、恶化"},
    "exculpate": {parts:"ex-（脱离） + culp（过错、罪责）", logic:"把人从 blame 中带出来 → 开脱、证明无罪"},
    "fortuitous": {parts:"fortu-/fors（偶然、机会）", logic:"由 chance 发生 → 偶然的；现代语境有时也带幸运意味"},
    "garrulous": {parts:"garrul（喋喋说话）", logic:"不停 chatter → 话多的、喋喋不休的"},
    "hackneyed": {parts:"词史联想：hackney 曾指供出租、反复使用的马", logic:"被反复用到“磨旧了” → 陈腐的、老生常谈的"},
    "iconoclast": {parts:"icon/eikon（图像、偶像） + clast（打碎者）", logic:"字面“砸偶像的人” → 后来引申为反传统、挑战权威的人"},
    "impecunious": {parts:"im-/in-（没有） + pecun（钱财）", logic:"没有 money → 贫困的、身无分文的"},
    "inimical": {parts:"in-（不） + amic（朋友）", logic:"不是 friend → 敌对的；进一步可表示有害的"},
    "insipid": {parts:"in-（不） + sipid/sap（有味道）", logic:"没味道 → 淡而无味 → 乏味的"},
    "intransigent": {parts:"in-（不） + transig（妥协、达成协议）", logic:"不愿达成 compromise → 不妥协的"},
    "laconic": {parts:"词史联想：Laconia 是古斯巴达地区", logic:"斯巴达人以极简回答闻名 → laconic = 简洁寡言的"},
    "mitigate": {parts:"mitig 源义与“柔和、温和”相关", logic:"把严重程度“变柔和” → 缓和、减轻"},
    "obsequious": {parts:"obsequ（顺从、跟随）", logic:"过度 follow/comply → 谄媚的、卑躬屈膝的"},
    "opaque": {parts:"词史核心：暗、遮蔽", logic:"光穿不过去 → 不透明；信息穿不过去 → 难懂"},
    "ostentatious": {parts:"ostent/show（展示）", logic:"过度 show → 炫耀的、浮夸的"},
    "parsimonious": {parts:"parsimony（过度节省）", logic:"把资源省得过了头 → 吝啬的、过分节俭的"},
    "perfunctory": {parts:"perfunctory 词史核心是“把职责做完”", logic:"只求完成流程、不投入心力 → 敷衍的"},
    "placate": {parts:"plac（使愉快、平静）", logic:"让对方 calm/pleased → 安抚、平息"},
    "pragmatic": {parts:"pragm（行动、实际事务）", logic:"关注 action 和结果 → 务实的"},
    "prolific": {parts:"prol（后代、产出） + fic（制造）", logic:"不断 produce → 多产的、丰富的"},
    "recalcitrant": {parts:"词史联想：向后踢脚", logic:"像牲畜“踢回去”拒绝前进 → 抗拒、难管理的"},
    "recondite": {parts:"re-（回、藏） + cond（藏、储存）", logic:"知识“藏得很深” → 深奥难懂的"},
    "sanguine": {parts:"词史联想：sanguis = 血", logic:"古代气质学把“多血质”与乐观开朗联系 → sanguine = 乐观的"},
    "spurious": {parts:"词史核心：非正统、来历可疑", logic:"身份/来源不正 → 虚假的、伪造的"},
    "taciturn": {parts:"tacit（沉默、不言明）", logic:"不说话的倾向 → 沉默寡言的"},
    "trenchant": {parts:"trench/tranch（切）", logic:"像刀一样“切得进去” → 犀利的、深刻有力的"},
    "ubiquitous": {parts:"ubique（到处、 everywhere）", logic:"everywhere 都有 → 无处不在的"},
    "vacillate": {parts:"vacill（摇摆、晃动）", logic:"左右摇摆 → 犹豫不决、反复"},
    "altruism": {parts:"alter/altr（他者）", logic:"把注意力放在 others 而非自己 → 利他主义"},
    "antipathy": {parts:"anti（反对） + path（感受）", logic:"对某物产生“反向感受” → 强烈反感"},
    "anachronistic": {parts:"ana（反/错位） + chron（时间）", logic:"放错了 time → 时代错置的、过时的"},
    "anthropocentric": {parts:"anthrop（人） + centr（中心）", logic:"以 humans 为中心 → 人类中心的"},
    "magnanimous": {parts:"magn（大） + anim（心、精神）", logic:"“心胸很大” → 宽宏大量的"},
    "maladroit": {parts:"mal（坏） + adroit（灵巧）", logic:"不灵巧 → 笨拙的"},
    "malediction": {parts:"mal（坏） + dict（说）", logic:"说“坏话/恶言” → 诅咒"},
    "magnify": {parts:"magn（大） + -ify（使成为）", logic:"使变大 → 放大"},
    "audacious": {parts:"audere（敢）", logic:"敢做常人不敢做的事 → 大胆的、鲁莽无畏的"},
    "censure": {parts:"cens（评判、评估）", logic:"作出负面的正式 judgement → 谴责、严厉批评"},
    "cogent": {parts:"cog-/coag（驱使、聚拢）", logic:"把证据和逻辑“压在一起”形成推动力 → 有说服力的"},
    "deleterious": {parts:"deleter（伤害、破坏）", logic:"会造成 harm → 有害的"}
  };

  const ROOT_FAMILIES = [
    {re:/cred/i, root:"cred", meaning:"相信、信任", examples:"credible / incredulous"},
    {re:/culp/i, root:"culp", meaning:"过错、罪责", examples:"culprit / culpable"},
    {re:/dict/i, root:"dict", meaning:"说、宣告", examples:"dictate / contradict"},
    {re:/voc/i, root:"voc", meaning:"声音、呼唤、说", examples:"vocal / advocate"},
    {re:/loqu/i, root:"loqu", meaning:"说话", examples:"eloquent / loquacious"},
    {re:/spect|spec/i, root:"spect/spec", meaning:"看、观察", examples:"inspect / perspective"},
    {re:/aud/i, root:"aud", meaning:"听", examples:"audible / audience"},
    {re:/scrib|script/i, root:"scrib/script", meaning:"写", examples:"describe / manuscript"},
    {re:/tract/i, root:"tract", meaning:"拉、牵引", examples:"attract / retract"},
    {re:/duc|duct/i, root:"duc/duct", meaning:"引导、带领", examples:"conduct / induce"},
    {re:/gress|grad/i, root:"gress/grad", meaning:"走、步", examples:"progress / gradual"},
    {re:/port/i, root:"port", meaning:"携带", examples:"transport / portable"},
    {re:/fer/i, root:"fer", meaning:"带、携、承受", examples:"transfer / confer"},
    {re:/gen|gener/i, root:"gen/gener", meaning:"产生、出生", examples:"generate / progeny"},
    {re:/viv|vit/i, root:"viv/vit", meaning:"生命、活", examples:"vivid / revive"},
    {re:/mort/i, root:"mort", meaning:"死亡", examples:"mortal / mortality"},
    {re:/chron/i, root:"chron", meaning:"时间", examples:"chronology / synchronize"},
    {re:/anthrop/i, root:"anthrop", meaning:"人、人类", examples:"anthropology"},
    {re:/phil/i, root:"phil", meaning:"爱、喜爱", examples:"philanthropy / philosophy"},
    {re:/phob/i, root:"phob", meaning:"害怕、厌恶", examples:"phobia"},
    {re:/magn/i, root:"magn", meaning:"大", examples:"magnify / magnitude"},
    {re:/bene/i, root:"bene", meaning:"好、善", examples:"benefit / benevolent"},
    {re:/mal/i, root:"mal", meaning:"坏、不良", examples:"malice / malfunction"},
    {re:/equi|aequ/i, root:"equi/aequ", meaning:"相等、平", examples:"equivalent / equilibrium"}
  ];

  function settings() {
    try { return {...{enabled:true}, ...(JSON.parse(localStorage.getItem(SETTINGS_KEY)||"{}")||{})}; }
    catch { return {enabled:true}; }
  }
  function saveSettings(x) { localStorage.setItem(SETTINGS_KEY, JSON.stringify(x)); }

  function cleanEnglishDef(w) {
    const raw = String(w.definition || w.sourceDefinition || "").replace(/\s+/g," ").trim();
    if (!raw) return "";
    return raw.length > 180 ? raw.slice(0,177).replace(/[;,\s]+$/,"") + "…" : raw;
  }

  function insightFor(w) {
    const key = norm(w.word);
    const exact = WORD_NOTES[key] || WORD_NOTES[key.replace(/[^a-z-]/g,"")];
    const roots = ROOT_FAMILIES.filter(x => x.re.test(w.word)).slice(0,2);

    if (exact) {
      return {
        kind:"可靠词源/词形线索",
        parts:exact.parts,
        logic:exact.logic,
        roots
      };
    }
    if (roots.length) {
      return {
        kind:"词根关联提示",
        parts:roots.map(x => `${x.root} = ${x.meaning}`).join("；"),
        logic:`先把“${roots.map(x=>x.meaning).join(" + ")}”和本词中文核心义联系起来。这里只做词根关联，不强行声称完整词源拆解。`,
        roots
      };
    }
    return {
      kind:"理解记忆",
      parts:"这个词暂时不建议硬拆词根。",
      logic:`优先把 “${w.word} = ${w.cn}” 和近义/反义、语境一起记；错误的词根拆解比不拆更容易形成错误记忆。`,
      roots:[]
    };
  }

  function sourceLink(word, type) {
    const w = encodeURIComponent(word);
    if (type === "wiki") return `https://en.wiktionary.org/wiki/${w}`;
    return `https://www.etymonline.com/search?q=${w}`;
  }

  function currentWord() {
    const card = document.querySelector("#studyCard .qcard[data-mode='vocab']");
    if (!card) return null;
    const word = card.dataset.word || "";
    return DATA.words.find(x => norm(x.word) === norm(word)) || null;
  }

  function renderInsight() {
    const cfg = settings();
    if (!cfg.enabled) return;
    const feedback = document.querySelector("#studyCard #vFeedback .feedback");
    if (!feedback || feedback.querySelector(".gre-word-insight")) return;
    const w = currentWord();
    if (!w) return;

    const x = insightFor(w);
    const def = cleanEnglishDef(w);
    const syn = Array.isArray(w.syn) ? w.syn.filter(Boolean).slice(0,6) : [];
    const rootFamily = x.roots.length
      ? `<div class="insight-row"><span>同根联想</span><div>${x.roots.map(r=>`<b>${esc(r.root)}</b>：${esc(r.examples)}`).join("；")}</div></div>`
      : "";

    const box = document.createElement("div");
    box.className = "gre-word-insight";
    box.innerHTML = `
      <div class="insight-title"><strong>🧠 理解记忆</strong><span>${esc(x.kind)}</span></div>
      <div class="insight-row"><span>核心义</span><div><b>${esc(w.word)}</b> = ${esc(w.cn)}</div></div>
      <div class="insight-row"><span>词形线索</span><div>${esc(x.parts)}</div></div>
      <div class="insight-row"><span>怎么理解</span><div>${esc(x.logic)}</div></div>
      ${syn.length ? `<div class="insight-row"><span>近义串联</span><div>${syn.map(esc).join(" · ")}</div></div>` : ""}
      ${rootFamily}
      ${def ? `<div class="insight-row"><span>英文义</span><div>${esc(def)}</div></div>` : ""}
      <div class="insight-links"><a href="${sourceLink(w.word,"etym")}" target="_blank" rel="noopener noreferrer">查 Etymonline</a><a href="${sourceLink(w.word,"wiki")}" target="_blank" rel="noopener noreferrer">查 Wiktionary</a></div>
      <div class="insight-foot">原则：能可靠拆就拆；不能可靠拆就不硬凑。词根提示用于理解和记忆，不替代具体语境中的词义。</div>
    `;

    const nextWrap = feedback.querySelector("#vNext")?.parentElement;
    if (nextWrap) nextWrap.insertAdjacentElement("beforebegin", box);
    else feedback.appendChild(box);
  }

  function injectStyle() {
    if (document.getElementById("greWordInsightStyle")) return;
    const style = document.createElement("style");
    style.id = "greWordInsightStyle";
    style.textContent = `
      .gre-word-insight{margin-top:14px;padding:14px;border:1px solid var(--line);border-radius:14px;background:rgba(248,250,252,.72);display:grid;gap:9px}
      .insight-title{display:flex;justify-content:space-between;gap:10px;align-items:center}.insight-title span{font-size:.72rem;color:var(--muted)}
      .insight-row{display:grid;grid-template-columns:72px 1fr;gap:10px;align-items:start;font-size:.84rem;line-height:1.6}.insight-row>span{color:var(--muted);font-size:.74rem;padding-top:2px}
      .insight-links{display:flex;gap:12px;flex-wrap:wrap;font-size:.75rem}.insight-links a{color:inherit;text-underline-offset:3px}
      .insight-foot{font-size:.7rem;color:var(--muted);line-height:1.5;border-top:1px dashed var(--line);padding-top:8px}
      @media(max-width:650px){.insight-row{grid-template-columns:1fr;gap:2px}}
    `;
    document.head.appendChild(style);
  }

  function injectSetting() {
    const grid = document.querySelector("#view-settings .settings-grid");
    if (!grid || document.getElementById("wordInsightInput")) return;
    const label = document.createElement("label");
    label.className = "setting";
    label.innerHTML = `<span><strong>词根 / 理解记忆</strong><small>答题后显示保守的词根、词史和联想解释；不会在作答前泄题</small></span><input id="wordInsightInput" type="checkbox" />`;
    grid.appendChild(label);
    const input = label.querySelector("#wordInsightInput");
    input.checked = settings().enabled;
    input.onchange = () => {
      saveSettings({enabled:input.checked});
      if (!input.checked) document.querySelectorAll(".gre-word-insight").forEach(x=>x.remove());
      else renderInsight();
    };
  }

  function boot() {
    injectStyle();
    injectSetting();
    const card = document.getElementById("studyCard");
    if (card) {
      new MutationObserver(() => requestAnimationFrame(renderInsight)).observe(card, {childList:true,subtree:true});
    }
    document.querySelector("[data-view='settings']")?.addEventListener("click", () => setTimeout(injectSetting,0));
    renderInsight();
  }

  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", boot);
  else boot();

  window.__GRE_WORD_INSIGHT__ = { insightFor, wordNotes:WORD_NOTES, rootFamilies:ROOT_FAMILIES };
})();