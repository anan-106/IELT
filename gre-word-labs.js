/* Two separate GRE study modules, based on the user's uploaded vocabulary PDFs. */
(()=>{
  'use strict';
  const data=window.GRE_WORD_LABS_DATA,core=window.GREWordLabsCore;
  if(!data||!core){console.error('[GRE Word Labs] Missing local data or core.');return;}
  const $=id=>document.getElementById(id);
  const escapeHTML=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const setText=(id,text)=>{const x=$(id);if(x)x.textContent=text;};
  const recentDate=t=>t?new Date(t).toLocaleDateString('zh-CN',{month:'2-digit',day:'2-digit'}):'未安排';
  const eItems=data.equivalence.filter(x=>!x.review&&x.syn?.length);
  const allLook=data.lookalike.flatMap(g=>g.entries.filter(x=>!x.review).map(entry=>({entry,group:g,id:entry.id})));
  const flatLook=allLook.map(x=>x.entry);
  const ids={equivalence:new Set(data.equivalence.map(e=>e.id)),lookalike:new Set(data.lookalike.flatMap(g=>g.entries.map(e=>e.id)))};
  const kinds={
    equivalence:{title:'等价词',key:'gre-equivalence-v1',items:eItems,view:'view-equivalence',tab:'equivalence',defaultDays:5},
    lookalike:{title:'形近词',key:'gre-lookalike-v1',items:flatLook,view:'view-lookalike',tab:'lookalike',defaultDays:15}
  };
  function fresh(name='equivalence'){return {version:2,settings:{direction:'mixed',chapter:1,studyDays:kinds[name].defaultDays,studyStart:core.localDayKey(Date.now())},records:{},startedAt:Date.now()};}
  const states={};
  for(const [name,conf] of Object.entries(kinds)){
    try{const raw=JSON.parse(localStorage.getItem(conf.key)||'null');
      const safe=raw&&typeof raw==='object'?raw:{};
      const base=fresh(name);
      states[name]={...base,...safe,settings:{...base.settings,...(safe.settings||{})},records:{}};
      states[name].settings.studyDays=core.validStudyDays(states[name].settings.studyDays);
      if(!/^\d{4}-\d{2}-\d{2}$/.test(states[name].settings.studyStart||''))states[name].settings.studyStart=core.localDayKey(Date.now());
      for(const [id,r] of Object.entries(safe.records||{}))if(ids[name].has(id)&&r&&typeof r==='object')states[name].records[id]=r;
    }catch{states[name]=fresh(name);}
  }
  function save(name){try{localStorage.setItem(kinds[name].key,JSON.stringify(states[name]));return true;}catch{flash(name,'保存失败：当前浏览器不允许本地存储，请导出备份。');return false;}}
  function flash(name,msg){const n=$(`lab-${name}-toast`);if(!n)return;n.textContent=msg;n.hidden=false;clearTimeout(n._timer);n._timer=setTimeout(()=>n.hidden=true,3000);}
  function speak(s){if(!window.speechSynthesis||!s)return;try{window.speechSynthesis.cancel();let u=new SpeechSynthesisUtterance(s);u.lang='en-US';u.rate=.92;window.speechSynthesis.speak(u);}catch{}}
  let session=null;
  const active=()=>document.querySelector('.view.active')?.id;
  function selectView(name){
    // Only one quiz may be active: prevents duplicate control IDs when users change modules.
    if(session&&session.kind!==name){
      const old=$(session.kind==='equivalence'?'lab-e-session':'lab-l-session');
      if(old)old.innerHTML='';
      session=null;
    }
    document.querySelectorAll('.view').forEach(x=>x.classList.toggle('active',x.id===kinds[name].view));
    document.querySelectorAll('.tab').forEach(x=>x.classList.toggle('active',x.dataset.view===kinds[name].tab));
    drawOverview(name);
  }
  function mount(){
    const tabs=document.querySelector('.tabs');if(!tabs)return;
    const after=document.querySelector('[data-view="foundation"]')||document.querySelector('[data-view="vocab"]');
    for(const [name,label] of [['equivalence','等价词'],['lookalike','形近词']]){
      const tab=document.createElement('button');tab.className='tab';tab.dataset.view=name;tab.textContent=label;tab.onclick=()=>selectView(name);
      const anchor=name==='lookalike'?tabs.querySelector('[data-view="equivalence"]'):after;
      anchor?.after(tab);
      const view=document.createElement('section');view.id=kinds[name].view;view.className='view lab-view';
      view.innerHTML=name==='equivalence'?equivalenceLayout():lookalikeLayout();
      document.querySelector('.view#view-vocab')?.after(view);
    }
    attachEquivalence();attachLookalike();
    bindPlan('equivalence');bindPlan('lookalike');
    drawOverview('equivalence');drawOverview('lookalike');
  }
  function metricsHTML(){return '<div class="lab-stats" data-lab-stats></div>';}
  function planHTML(name){return `<section class="lab-plan" aria-label="自定义学习天数">
    <div class="lab-plan-head"><div><h3>自定义学习周期</h3><p>可设置 1–3650 天，自动重算剩余内容的每日新学量；到期复习和历史错题保持不变。</p></div>
      <div class="lab-plan-controls"><label for="lab-${name}-goal">目标学习天数<input id="lab-${name}-goal" type="number" min="1" max="3650" step="1" inputmode="numeric"></label>
        <button class="primary" id="lab-${name}-apply">应用天数</button><button class="ghost" id="lab-${name}-restart">从今天重新规划</button></div></div>
    <div class="lab-plan-metrics" id="lab-${name}-plan" aria-live="polite"></div>
  </section>`;}
  function getTodayPlan(name){
    const state=states[name],now=Date.now(),settings=state.settings;
    if(name==='equivalence'){
      const unlearned=eItems.filter(e=>!state.records[e.id]?.attempts).length;
      const todayFinished=eItems.filter(e=>core.isSameLocalDay(core.firstSeen(state.records[e.id]),now)).length;
      const plan=core.goalPlan(unlearned,todayFinished,settings.studyDays,settings.studyStart,now);
      return {...plan,unit:'条',due:eItems.filter(e=>isDue(state.records[e.id])).length};
    }
    const groups=data.lookalike.filter(g=>g.entries.some(e=>!e.review));
    const finishGroup=g=>g.entries.filter(e=>!e.review).every(e=>state.records[e.id]?.attempts);
    const lastFirst=g=>Math.max(0,...g.entries.filter(e=>!e.review).map(e=>core.firstSeen(state.records[e.id])));
    const unlearned=groups.filter(g=>!finishGroup(g)).length;
    const todayFinished=groups.filter(g=>finishGroup(g)&&core.isSameLocalDay(lastFirst(g),now)).length;
    const plan=core.goalPlan(unlearned,todayFinished,settings.studyDays,settings.studyStart,now);
    return {...plan,unit:'组',due:allLook.filter(x=>isDue(state.records[x.id])).length};
  }
  function renderPlan(name){
    const plan=getTodayPlan(name),root=$(`lab-${name}-plan`);if(!root)return;
    const boxes=[
      ['学习进度',`第 ${plan.dayNo} / ${plan.days} 天`,plan.isOverdue?'已超过原目标日期，优先补学':'预计结束 '+plan.finishDate],
      ['今天新学',`${plan.dailyNew} ${plan.unit}`,`今日已新学 ${plan.todayFinished} ${plan.unit}`],
      ['尚未完成',`${plan.unlearned} ${plan.unit}`,`剩余 ${plan.remainingDays} 天分配新学`],
      ['到期复习',`${plan.due} 词`, '到期与错词单独安排']
    ];
    root.innerHTML=boxes.map(([a,b,c])=>`<article><span>${escapeHTML(a)}</span><strong>${escapeHTML(b)}</strong><small>${escapeHTML(c)}</small></article>`).join('');
  }
  function bindPlan(name){
    const state=states[name],goal=$(`lab-${name}-goal`);if(!goal)return;
    goal.value=state.settings.studyDays;
    const change=()=>{
      const raw=Number(goal.value);
      if(!Number.isInteger(raw)||raw<1||raw>3650){flash(name,'请输入 1–3650 之间的整数天数。');goal.value=state.settings.studyDays;return;}
      const current=state.settings.studyDays;
      state.settings.studyDays=raw;
      // A new duration always creates a new plan for the STILL UNLEARNED material.
      // It does NOT erase existing attempts, error counters or review due dates.
      if(raw!==current)state.settings.studyStart=core.localDayKey(Date.now());
      save(name);drawOverview(name);
      flash(name,`已按 ${raw} 天重新计算，每日任务已更新，旧学习记录保留。`);
    };
    $(`lab-${name}-apply`).onclick=change;
    goal.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();change();}});
    $(`lab-${name}-restart`).onclick=()=>{state.settings.studyStart=core.localDayKey(Date.now());save(name);drawOverview(name);flash(name,'已从今天重新规划，历史学习记录和错题未清空。');};
  }
  function equivalenceLayout(){return `
    <div class="lab-head"><div class="kicker">VOCABULARY LAB · EQUIVALENCE</div>
      <h2>等价词 · 不定项识别</h2><p>学习周期自由设置；保留原 PDF 五天分组供查阅，每题 6–8 个选项，正确答案数量不固定。</p></div>
    <div class="lab-source">来源：《GRE 真题六选二同义词汇总（5 天版）》。此处是词汇关联训练，不是 ETS 原题；正式 GRE Sentence Equivalence 为六选二，需结合句子语境。</div>
    ${metricsHTML()}
    ${planHTML('equivalence')}
    <div class="lab-toolrow"><label>原资料分组<select id="lab-e-day"><option value="all">全部原表</option><option value="1">原 Day 1</option><option value="2">原 Day 2</option><option value="3">原 Day 3</option><option value="4">原 Day 4</option><option value="5">原 Day 5</option></select></label>
      <button class="primary" id="lab-e-start">开始今日任务</button>
      <button class="ghost" id="lab-e-source-start">按原分组练习</button>
      <button class="ghost" id="lab-e-due">复习到期</button>
      <button class="ghost" id="lab-e-wrong">错词强化</button>
      <button class="ghost" id="lab-e-export">导出记录</button>
      <label class="lab-import">导入记录 <input type="file" id="lab-e-import" accept="application/json"></label>
    </div>
    <div id="lab-e-session" class="lab-session" aria-live="polite"></div>
    <div class="lab-section-title"><h3>原 PDF 五天内容</h3><span>仅用于按来源浏览，与自定义学习周期独立</span></div>
    <div class="lab-days" id="lab-e-days"></div>
    <div class="lab-section-title"><h3>词汇清单与来源核对</h3><span id="lab-e-result-count"></span></div>
    <div class="lab-toolrow"><input id="lab-e-search" type="search" placeholder="搜索英文主词、同义词、中文释义…" aria-label="搜索等价词"><label>显示<select id="lab-e-filter"><option value="all">全部</option><option value="wrong">曾错词</option><option value="pending">待巩固</option><option value="review">原表待核对</option></select></label></div>
    <div id="lab-e-list" class="lab-list"></div><div id="lab-equivalence-toast" class="lab-toast" hidden></div>`;}
  function lookalikeLayout(){return `
    <div class="lab-head"><div class="kicker">VOCABULARY LAB · LOOK-ALIKE WORDS</div>
      <h2>形近词 · 同组辨析</h2><p>保留原 PDF 的 150 组，先比较拼写与中文义，再练英文→中文或中文→英文。</p></div>
    <div class="lab-source">来源：《GRE 形近词 150 组》（五十度 GRE）。每 10 组一个单元，共 15 单元；原表少量拼写/释义疑义会保留出处并提示核对。</div>
    ${metricsHTML()}
    ${planHTML('lookalike')}
    <div class="lab-toolrow"><label>原资料章节<select id="lab-l-chapter"></select></label>
      <label>训练方向<select id="lab-l-mode"><option value="mixed">双向交替</option><option value="en-cn">英文 → 中文</option><option value="cn-en">中文 → 英文（同组可能多选）</option></select></label>
      <button class="primary" id="lab-l-today">开始今日任务</button>
      <button class="ghost" id="lab-l-start">练习当前章节</button>
      <button class="ghost" id="lab-l-due">复习到期</button>
      <button class="ghost" id="lab-l-wrong">错词强化</button>
      <button class="ghost" id="lab-l-export">导出记录</button>
      <label class="lab-import">导入记录 <input type="file" id="lab-l-import" accept="application/json"></label>
    </div>
    <div id="lab-l-session" class="lab-session" aria-live="polite"></div>
    <div class="lab-section-title"><h3>形近词对照分组</h3><span id="lab-l-progress"></span></div>
    <div class="lab-toolrow"><input id="lab-l-search" type="search" placeholder="搜索类似拼写、中文含义、组号…" aria-label="搜索形近词"></div>
    <div class="lab-group-grid" id="lab-l-groups"></div><div id="lab-lookalike-toast" class="lab-toast" hidden></div>`;}
  function attachEquivalence(){
    $('lab-e-day').onchange=()=>{renderEquivalenceList();renderDays();};
    $('lab-e-search').oninput=renderEquivalenceList;
    $('lab-e-filter').onchange=renderEquivalenceList;
    $('lab-e-start').onclick=()=>{
      const plan=getTodayPlan('equivalence');
      const due=eItems.filter(x=>isDue(states.equivalence.records[x.id]));
      const fresh=eItems.filter(x=>!states.equivalence.records[x.id]?.attempts);
      if(due.length)begin('equivalence',due.slice(0,25),'今日到期等价词');
      else begin('equivalence',fresh.slice(0,Math.min(25,plan.dailyNew)),'今日新学等价词');
    };
    $('lab-e-source-start').onclick=()=>{
      const day=$('lab-e-day').value;
      const base=day==='all'?eItems:eItems.filter(x=>x.day===Number(day));
      const due=base.filter(x=>isDue(states.equivalence.records[x.id]));
      const fresh=base.filter(x=>!states.equivalence.records[x.id]?.attempts);
      begin('equivalence',[...due,...fresh].slice(0,25),'原表等价词分组');
    };
    $('lab-e-due').onclick=()=>begin('equivalence',eItems.filter(x=>isDue(states.equivalence.records[x.id])),'等价词到期复习');
    $('lab-e-wrong').onclick=()=>begin('equivalence',sortWrong(eItems,states.equivalence),'等价词错词强化');
    $('lab-e-export').onclick=()=>exportState('equivalence');
    $('lab-e-import').onchange=e=>importState(e,'equivalence');
  }
  function attachLookalike(){
    for(let i=1;i<=15;i++){
      const o=document.createElement('option');o.value=String(i);o.textContent=`第 ${i} 单元 · 组 ${(i-1)*10+1}–${Math.min(i*10,150)}`;$('lab-l-chapter').append(o);
    }
    $('lab-l-chapter').onchange=()=>{states.lookalike.settings.chapter=Number($('lab-l-chapter').value);save('lookalike');renderLookGroups();};
    $('lab-l-chapter').value=states.lookalike.settings.chapter||1;
    $('lab-l-mode').value=states.lookalike.settings.direction||'mixed';
    $('lab-l-mode').onchange=()=>{states.lookalike.settings.direction=$('lab-l-mode').value;save('lookalike');};
    $('lab-l-search').oninput=renderLookGroups;
    $('lab-l-today').onclick=()=>{
      const plan=getTodayPlan('lookalike');
      const due=allLook.filter(x=>isDue(states.lookalike.records[x.id]));
      if(due.length){begin('lookalike',due.slice(0,30),'今日到期形近词');return;}
      const groups=data.lookalike.filter(g=>g.entries.some(e=>!e.review&&!states.lookalike.records[e.id]?.attempts));
      const selected=groups.slice(0,Math.min(3,plan.dailyNew));
      if(!selected.length){flash('lookalike','今日新学已完成，可以复习错词或原资料章节。');return;}
      studyGroups(selected,`今日新学 · ${selected.map(g=>'第'+g.id+'组').join('、')}`,true);
    };
    $('lab-l-start').onclick=()=>{
      const ch=Number($('lab-l-chapter').value),base=allLook.filter(x=>Math.ceil(x.group.id/10)===ch);
      const due=base.filter(x=>isDue(states.lookalike.records[x.id]));
      const unseen=base.filter(x=>!states.lookalike.records[x.id]?.attempts);
      begin('lookalike',[...due,...unseen].slice(0,30),`第 ${ch} 单元 · 形近词辨析`);
    };
    $('lab-l-due').onclick=()=>begin('lookalike',allLook.filter(x=>isDue(states.lookalike.records[x.id])),'形近词到期复习');
    $('lab-l-wrong').onclick=()=>begin('lookalike',sortWrong(allLook,states.lookalike),'形近词错词强化');
    $('lab-l-export').onclick=()=>exportState('lookalike');
    $('lab-l-import').onchange=e=>importState(e,'lookalike');
  }
  function isDue(r){return r?.attempts>0 && r.due<=Date.now();}
  function sortWrong(items,state){return items.filter(x=>state.records[x.id]?.wrong>0).sort((a,b)=>{
    const ar=state.records[a.id],br=state.records[b.id];
    return Number(core.isPending(br))-Number(core.isPending(ar)) || br.wrong-ar.wrong || (br.lastWrongAt||0)-(ar.lastWrongAt||0);
  });}
  function drawOverview(name){
    const root=$(kinds[name].view);if(!root)return;
    const state=states[name],items=kinds[name].items,s=core.summary(items,state);
    root.querySelector('[data-lab-stats]').innerHTML=[
      ['可练项目',items.length,'已排除待核对项'],
      ['已练',s.learned,`共 ${items.length} 项`],
      ['到期',s.due,'优先复习'],
      ['曾错',s.everWrong,`待巩固 ${s.pending}`],
      ['累计选错',s.totalWrong,'历史不清零']
    ].map(([label,num,caption])=>`<article><span>${escapeHTML(label)}</span><strong>${Number(num).toLocaleString()}</strong><small>${escapeHTML(caption)}</small></article>`).join('');
    renderPlan(name);
    if(name==='equivalence'){renderDays();renderEquivalenceList();}
    else renderLookGroups();
  }
  function renderDays(){
    const root=$('lab-e-days');if(!root)return;
    root.innerHTML=[1,2,3,4,5].map(d=>{
      const x=eItems.filter(z=>z.day===d),s=core.summary(x,states.equivalence),review=data.equivalence.filter(z=>z.day===d&&z.review).length;
      return `<button type="button" class="lab-day" data-lab-day="${d}"><b>Day ${d}</b><strong>${x.length} 组</strong><span>已练 ${s.learned} · 错词 ${s.everWrong}</span><small>另有 ${review} 条源表待核对</small></button>`;
    }).join('');
    root.querySelectorAll('[data-lab-day]').forEach(b=>b.onclick=()=>{$('lab-e-day').value=b.dataset.labDay;renderEquivalenceList();});
  }
  function renderEquivalenceList(){
    const root=$('lab-e-list');if(!root)return;
    const day=$('lab-e-day').value,q=core.norm($('lab-e-search').value),filter=$('lab-e-filter').value;
    let rows=data.equivalence.filter(x=>day==='all'||x.day===Number(day));
    if(filter==='review')rows=rows.filter(x=>x.review);
    if(filter==='wrong')rows=rows.filter(x=>states.equivalence.records[x.id]?.wrong>0);
    if(filter==='pending')rows=rows.filter(x=>core.isPending(states.equivalence.records[x.id]));
    if(q)rows=rows.filter(x=>core.norm([x.head,x.cn,...x.syn].join(' ')).includes(q));
    setText('lab-e-result-count',`${rows.length} 项（显示前 70 项）`);
    root.innerHTML=rows.slice(0,70).map(x=>{
      const r=states.equivalence.records[x.id],wrong=r?.wrong||0;
      return `<details class="lab-item"><summary><div><b>${escapeHTML(x.head)}</b><span>${escapeHTML(x.cn)}</span></div><small>${x.review?'待核对':`误选 ${wrong} 次`} · Day ${x.day} · 原 PDF 第 ${x.page} 页</small></summary>
      <div class="lab-explainer"><div><b>原表关联词：</b>${escapeHTML(x.syn.join(' · '))}</div>${x.review?`<p class="lab-alert">⚠ ${escapeHTML(x.reviewReason)} 此条仅供对照，不自动判分。</p>`:''}
      <button class="ghost" data-lab-e-single="${x.id}" ${x.review?'disabled':''}>单条强化</button><button class="ghost" data-lab-speak="${escapeHTML(x.head)}">朗读</button></div></details>`;
    }).join('')||'<div class="lab-empty">当前筛选无记录，尝试切换日期或筛选范围。</div>';
    root.querySelectorAll('[data-lab-e-single]').forEach(b=>b.onclick=()=>begin('equivalence',[data.equivalence.find(x=>x.id===b.dataset.labESingle)],'单条等价词强化'));
    root.querySelectorAll('[data-lab-speak]').forEach(b=>b.onclick=()=>speak(b.dataset.labSpeak));
  }
  function highlightGroup(group){
    const words=group.entries.map(x=>x.word.toLowerCase());let prefix=words[0]||'';
    for(const w of words)while(prefix&&!w.startsWith(prefix))prefix=prefix.slice(0,-1);
    if(prefix.length>6)prefix=prefix.slice(0,6);if(prefix.length<2)prefix='';
    return group.entries.map(e=>{
      const word=escapeHTML(e.word),marked=prefix?`<span>${escapeHTML(e.word.slice(0,prefix.length))}</span><em>${escapeHTML(e.word.slice(prefix.length))}</em>`:word;
      const annotated=e.note?`<small>${escapeHTML(e.note)}（原文：${escapeHTML(e.sourceWord)}）</small>`:'';
      const reviewNote=e.reviewReason?`<small>⚠ ${escapeHTML(e.reviewReason)}</small>`:'';
      const r=states.lookalike.records[e.id],wrongDetail=r?.wrong?`<small>累计选错 ${r.wrong} 次</small>`:'';
      return `<div class="lab-pair"><b>${marked}</b><span>${escapeHTML(e.cn)}</span>${e.review?'<i>待核对</i>':''}${annotated}${reviewNote}${wrongDetail}</div>`;
    }).join('');
  }
  function renderLookGroups(){
    const root=$('lab-l-groups');if(!root)return;
    let q=core.norm($('lab-l-search').value),c=Number($('lab-l-chapter').value)||1;
    let groups=data.lookalike.filter(g=>q?core.norm(''+g.id+' '+g.entries.map(e=>e.word+' '+e.cn).join(' ')).includes(q):Math.ceil(g.id/10)===c);
    setText('lab-l-progress',q?`搜索匹配 ${groups.length} 组`:`第 ${c} 单元 · 10 组`);
    root.innerHTML=groups.map(g=>{
      const stats=core.summary(g.entries.filter(e=>!e.review),states.lookalike);
      return `<article class="lab-group"><div class="lab-group-head"><strong>第 ${g.id} 组</strong><span>原 PDF p.${g.page} · ${g.entries.length} 词</span></div>
        <div class="lab-pairs">${highlightGroup(g)}</div><div class="lab-group-foot">已练 ${stats.learned} · 误选 ${stats.totalWrong} 次</div>
        <button class="primary" data-lab-l-group="${g.id}">辨析这一组</button></article>`;
    }).join('')||'<div class="lab-empty">没有匹配的形近词组。</div>';
    root.querySelectorAll('[data-lab-l-group]').forEach(b=>b.onclick=()=>studyGroup(Number(b.dataset.labLGroup)));
  }
  function studyGroup(id){
    const g=data.lookalike.find(x=>x.id===id);if(!g)return;
    session=null;
    studyGroups([g],`第 ${id} 组辨析`,false);
  }
  function studyGroups(groups,title,unseenOnly){
    session=null;
    const root=$('lab-l-session'),valid=groups.filter(g=>g.entries.some(e=>!e.review));
    const previews=valid.map(g=>`<div class="lab-study-preview"><h4>第 ${g.id} 组 · 原 PDF p.${g.page}</h4><div class="lab-pairs lab-study-pairs">${highlightGroup(g)}</div></div>`).join('');
    root.innerHTML=`<article class="lab-study"><div class="lab-section-title"><h3>${escapeHTML(title)} · 先看后测</h3><span>${valid.length} 组</span></div>
      <p>先比较同组单词的拼写与含义，再进入测验。学习天数变化不会重置任何历史错误次数。</p>
      ${previews}<div class="lab-cta"><button class="primary" id="lab-l-quiz-group">开始本组测验</button><button class="ghost" id="lab-l-close-study">返回目录</button></div></article>`;
    $('lab-l-quiz-group').onclick=()=>{
      const quiz=valid.flatMap(g=>g.entries.filter(e=>!e.review&&(!unseenOnly||!states.lookalike.records[e.id]?.attempts)).map(entry=>({id:entry.id,entry,group:g})));
      begin('lookalike',quiz,title);
    };
    $('lab-l-close-study').onclick=()=>{root.innerHTML='';};
    root.scrollIntoView({behavior:'smooth',block:'start'});
  }
  function begin(kind,items,title){
    if(!items?.length){flash(kind,'当前没有符合条件的练习项目。');return;}
    if(session && !session.answered && !confirm('当前仍有尚未提交的题目，要开始另一组练习吗？'))return;
    session={kind,title,queue:items.map(item=>({item,retries:0})),total:items.length,done:0,current:null,answered:false,chosen:new Set()};
    next();
    $(kind==='equivalence'?'lab-e-session':'lab-l-session')?.scrollIntoView({behavior:'smooth',block:'nearest'});
  }
  function next(){
    if(!session)return;
    const {kind}=session,root=$(kind==='equivalence'?'lab-e-session':'lab-l-session');if(!root)return;
    if(!session.queue.length){
      const title=session.title,done=session.done,total=session.total;
      session=null;
      root.innerHTML=`<div class="lab-empty"><strong>${escapeHTML(title)}完成</strong><p>已完成 ${done} 次练习（初始 ${total} 条，含错词重现）。记录已更新。</p><button class="ghost" id="lab-complete-close">返回学习目录</button></div>`;
      $('lab-complete-close').onclick=()=>root.innerHTML='';
      drawOverview(kind);return;
    }
    const pick=session.queue[0],src=pick.item;
    const state=states[kind];
    let question;
    try{
      question=kind==='equivalence'?core.makeEquivalenceQuestion(src,eItems):
        core.makeLookalikeQuestion(src.entry,src.group,data.lookalike,states.lookalike.settings.direction);
    }catch(e){session.queue.shift();flash(kind,'已跳过来源不完整条目：'+e.message);next();return;}
    session.current={pick,question};session.answered=false;session.chosen=new Set();
    const isEq=kind==='equivalence';
    const stat=state.records[question.id]||{};
    root.innerHTML=`<article class="lab-question">
      <div class="lab-question-head"><div class="lab-pill">${escapeHTML(session.title)}</div><span>本轮 ${session.done}/${session.total} · 累计误选 ${stat.wrong||0} 次</span><button class="ghost" id="lab-session-stop">结束练习</button></div>
      <div class="lab-question-title">${escapeHTML(question.prompt)}</div>
      <p>${isEq?`中文核心义：${escapeHTML(question.gloss)} · 选出全部与主词存在原表关联的词（不提示数量）`:
          question.direction==='cn-en'?'根据中文含义，选择同组所有符合的英文词（可能多选）':'在四个释义中选择最符合单词的中文意思'}</p>
      <div class="lab-choices">${question.options.map((s,i)=>`<button type="button" class="lab-choice" data-lab-option-index="${i}" aria-pressed="false"><span class="lab-choice-marker">${i+1}</span><span>${escapeHTML(s)}</span></button>`).join('')}</div>
      <div class="lab-cta"><button id="lab-submit-answer" class="primary" disabled>确认答案</button><small>1–8 选择 · Enter 确认/下一题${(!isEq&&question.direction==='cn-en')?' · 同一中文含义可能对应多个英语词':''}</small></div><div id="lab-feedback"></div>
    </article>`;
    $('lab-session-stop').onclick=()=>{session=null;root.innerHTML='';drawOverview(kind);};
    root.querySelectorAll('[data-lab-option-index]').forEach(b=>b.onclick=()=>toggle(Number(b.dataset.labOptionIndex)));
    $('lab-submit-answer').onclick=submit;
    if(isEq || question.direction==='en-cn')speak(question.prompt);
  }
  function toggle(idx){
    if(!session||session.answered)return;
    const q=session.current.question;if(idx<0||idx>=q.options.length)return;
    const singleChoice=q.kind==='lookalike'&&q.direction==='en-cn';
    if(singleChoice){session.chosen.clear();session.chosen.add(idx);}
    else if(session.chosen.has(idx))session.chosen.delete(idx);else session.chosen.add(idx);
    const root=$(session.kind==='equivalence'?'lab-e-session':'lab-l-session');
    root.querySelectorAll('[data-lab-option-index]').forEach(b=>{
      let selected=session.chosen.has(Number(b.dataset.labOptionIndex));
      b.classList.toggle('selected',selected);b.setAttribute('aria-pressed',String(selected));
    });
    $('lab-submit-answer').disabled=!session.chosen.size;
  }
  function submit(){
    if(!session||session.answered||!session.chosen.size)return;
    const {kind}=session,{question,pick}=session.current;
    const selected=[...session.chosen].sort((a,b)=>a-b).map(i=>question.options[i]);
    const {ok,rec}=core.recordAnswer(states[kind],question.id,question,selected);
    save(kind);session.answered=true;session.done++;
    const accepted=new Set(question.answers.map(core.norm));
    const root=$(kind==='equivalence'?'lab-e-session':'lab-l-session');
    root.querySelectorAll('[data-lab-option-index]').forEach(b=>{
      const idx=Number(b.dataset.labOptionIndex),v=question.options[idx];
      b.disabled=true;b.classList.toggle('correct',accepted.has(core.norm(v)));
      b.classList.toggle('wrong',session.chosen.has(idx)&&!accepted.has(core.norm(v)));
    });
    $('lab-submit-answer').disabled=true;
    const feedback=$('lab-feedback');
    let detail=kind==='equivalence'?`<p>原表关联词：<strong>${escapeHTML(question.answers.join('、'))}</strong></p><p>中文义：${escapeHTML(question.gloss)} · 来源第 ${question.sourcePage} 页</p>`:
      `<p>组内对照：</p><div class="lab-pairs lab-feedback-pairs">${highlightGroup(pick.item.group)}</div>`;
    feedback.innerHTML=`<div class="lab-result ${ok?'good':'bad'}"><h3>${ok?'回答正确':'回答错误'}</h3>
      ${detail}<p>累计答错 ${rec.wrong||0} 次 · ${rec.pending?'尚需再次答对 '+(2-rec.correctStreak)+' 次才能巩固':'下次复习 '+recentDate(rec.due)}</p>
      <button id="lab-next-question" class="primary">下一题</button></div>`;
    $('lab-next-question').onclick=()=>{
      if(!session)return;
      const head=session.queue.shift();
      if(rec.pending){head.retries++;
        session.queue.splice(Math.min(3,session.queue.length),0,head);
      }
      next();
    };
    drawOverview(kind);
  }
  function exportState(name){
    const body={app:kinds[name].key,version:1,exportedAt:new Date().toISOString(),state:states[name]};
    const blob=new Blob([JSON.stringify(body,null,2)],{type:'application/json'}),url=URL.createObjectURL(blob),a=document.createElement('a');
    a.href=url;a.download=`${name}-progress-${new Date().toISOString().slice(0,10)}.json`;a.click();setTimeout(()=>URL.revokeObjectURL(url),2000);
  }
  async function importState(e,name){
    const f=e.target.files?.[0];if(!f)return;
    try{
      const value=JSON.parse(await f.text());
      if(value.app!==kinds[name].key || !value.state || !value.state.records || typeof value.state.records!=='object')throw Error('备份类型不正确');
      const base=fresh(name);
      const safe={...base,...value.state,settings:{...base.settings,...(value.state.settings||{})},records:{}};
      safe.settings.studyDays=core.validStudyDays(safe.settings.studyDays);
      for(const [id,r] of Object.entries(value.state.records))if(ids[name].has(id)&&r&&typeof r==='object')safe.records[id]=r;
      states[name]=safe;save(name);const goal=$(`lab-${name}-goal`);if(goal)goal.value=safe.settings.studyDays;
      flash(name,'记录已导入，原有记录以此次备份为准。');drawOverview(name);
    }catch(err){flash(name,'导入失败：'+String(err.message||err));}
    e.target.value='';
  }
  document.addEventListener('keydown',e=>{
    if(!session)return;
    if(active()!==kinds[session.kind].view)return;
    if(['input','textarea','select'].includes((e.target.tagName||'').toLowerCase()))return;
    if(/^[1-8]$/.test(e.key)){let i=Number(e.key)-1;if(i<session.current?.question.options.length){e.preventDefault();toggle(i);}}
    else if(e.key==='Enter'){
      if(!session.answered && session.chosen.size){e.preventDefault();submit();}
      else if(session.answered){e.preventDefault();$('lab-next-question')?.click();}
    }
  });
  mount();
})();