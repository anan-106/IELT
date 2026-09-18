(() => {
  "use strict";
  const DATA = window.__GRE_DATA__;
  if (!DATA) return;

  const KEY = "gre-prep-v1";
  const INTERVALS = [1,2,6,31,60,120];
  const $ = (id) => document.getElementById(id);
  const now = () => Date.now();
  const norm = (v) => String(v ?? "").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
  const esc = (v) => String(v ?? "").replaceAll("&","&amp;").replaceAll("<","&lt;").replaceAll(">","&gt;").replaceAll('"',"&quot;").replaceAll("'","&#039;");
  const shuffle = (arr) => { const a=[...arr]; for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];} return a; };
  const uniq = (arr) => [...new Set(arr.filter(Boolean))];

  function dateKey(ts=Date.now()){const d=new Date(ts);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,"0")}-${String(d.getDate()).padStart(2,"0")}`;}
  function dayNum(key){const d=typeof key==="string"?new Date(`${key}T00:00:00`):new Date(key);d.setHours(0,0,0,0);return Math.floor(d.getTime()/86400000);}
  function startPlus(days){const d=new Date();d.setHours(0,0,0,0);d.setDate(d.getDate()+days);return d.getTime();}
  function fresh(){return {version:2,settings:{planDays:60,vocabScope:"all",vocabQuizMode:"mixed",dailyVerbal:5,dailyQuant:5,autoSpeak:true,speechRate:1},plan:{startDate:dateKey()},vocab:{},questions:{},daily:{},wrong:{},essay:{},streakSeed:0};}
  function load(){try{const raw=JSON.parse(localStorage.getItem(KEY)||"{}")||{};return {...fresh(),...raw,settings:{...fresh().settings,...(raw.settings||{})}};}catch{return fresh();}}
  let state=load();
  function save(){localStorage.setItem(KEY,JSON.stringify(state));}
  function toast(msg){const t=$("toast");t.textContent=msg;t.classList.add("show");clearTimeout(t._tm);t._tm=setTimeout(()=>t.classList.remove("show"),1800);}

  function card(id){state.vocab[id]=state.vocab[id]||{reps:0,stage:-1,due:0,last:0,correct:0,wrong:0,lapses:0};return state.vocab[id];}
  function qstat(id){state.questions[id]=state.questions[id]||{attempts:0,correct:0,wrong:0,totalMs:0,last:0};return state.questions[id];}
  function daily(){const k=dateKey();state.daily[k]=state.daily[k]||{vocab:0,verbal:0,quant:0,correct:0,wrong:0};return state.daily[k];}
  function scheduleVocab(c,hadError,wasNew){let stage=(wasNew||hadError||c.stage<0)?0:Math.min(c.stage+1,INTERVALS.length-1);c.stage=stage;c.reps=(c.reps||0)+1;c.last=now();c.due=startPlus(INTERVALS[stage]);return INTERVALS[stage];}
  function vocabScopeWords(){
    const scope=String(state.settings.vocabScope||"all").toUpperCase();
    if(scope==="ALL"||!DATA.words.some(w=>w.priorityTier))return DATA.words;
    const allow=scope==="S"?new Set(["S"]):scope==="SA"?new Set(["S","A"]):new Set(["S","A","B"]);
    return DATA.words.filter(w=>allow.has(String(w.priorityTier||"").toUpperCase()));
  }
  function vocabScopeLabel(){
    const scope=String(state.settings.vocabScope||"all").toUpperCase();
    return scope==="S"?"仅 S 冲刺":scope==="SA"?"S+A 核心":scope==="SAB"?"S+A+B 高频":"全部大三千";
  }
  function dueVocab(){const t=now();return DATA.words.filter(w=>card(w.id).reps>0&&card(w.id).due<=t).sort((a,b)=>card(a.id).due-card(b.id).due);}
  function overdueVocab(){const s=new Date();s.setHours(0,0,0,0);return DATA.words.filter(w=>card(w.id).reps>0&&card(w.id).due<s.getTime());}
  function unseen(){return vocabScopeWords().filter(w=>!card(w.id).reps);}

  function planSnapshot(){
    const days=Math.max(7,Math.min(180,Number(state.settings.planDays)||60));
    const start=state.plan.startDate||dateKey();
    const elapsed=Math.max(0,dayNum(dateKey())-dayNum(start));
    const remainingDays=Math.max(1,days-elapsed);
    const remaining=unseen().length;
    const overdue=overdueVocab().length;
    const due=dueVocab().length;
    let newVocab=remaining?Math.ceil(remaining/remainingDays):0;
    if(overdue) newVocab=Math.max(0,newVocab-Math.min(Math.ceil(newVocab*.5),Math.ceil(overdue/4)));
    const scopeTotal=vocabScopeWords().length;
    const done=scopeTotal-remaining;
    const completion=scopeTotal?Math.round(done/scopeTotal*100):0;
    return {days,start,elapsed,remainingDays,remaining,newVocab,overdue,due,done,completion,scopeTotal,scopeLabel:vocabScopeLabel(),verbal:Number(state.settings.dailyVerbal)||0,quant:Number(state.settings.dailyQuant)||0};
  }

  function streak(){let n=0;const d=new Date();d.setHours(0,0,0,0);for(let i=0;i<999;i++){const x=state.daily[dateKey(d.getTime())];if(x&&(x.vocab+x.verbal+x.quant)>0)n++;else if(i>0)break;d.setDate(d.getDate()-1);}return n;}

  function renderPlan(){const p=planSnapshot();$("streakCount").textContent=streak();$("planPanel").innerHTML=`
    <div class="section-head" style="margin:0 0 12px"><div><div class="kicker">${p.days}-DAY PLAN</div><h2 style="margin:3px 0">动态学习计划</h2></div><small class="muted">Day ${Math.min(p.elapsed+1,p.days)} / ${p.days} · ${p.scopeLabel} ${p.done}/${p.scopeTotal} · 完成 ${p.completion}%</small></div>
    <div class="metric-grid">
      <article class="metric"><span>历史欠复习</span><strong>${p.overdue}</strong><small>优先完成</small></article>
      <article class="metric"><span>到期词汇复习</span><strong>${p.due}</strong><small>含逾期</small></article>
      <article class="metric"><span>今日新词</span><strong>${p.newVocab}</strong><small>剩 ${p.remaining} 个未学</small></article>
      <article class="metric"><span>今日专项</span><strong>${p.verbal+p.quant}</strong><small>V ${p.verbal} · Q ${p.quant}</small></article>
    </div>`;
    renderTodayCards(p);
  }
  function renderTodayCards(p=planSnapshot()){$("todayCards").innerHTML=`
    <article class="metric"><span>必做复习</span><strong>${p.due}</strong><small>先清旧账</small></article>
    <article class="metric"><span>新词</span><strong>${p.newVocab}</strong><small>${p.scopeLabel} · 按剩余天数动态调整</small></article>
    <article class="metric"><span>Verbal</span><strong>${p.verbal}</strong><small>TC / SE / RC</small></article>
    <article class="metric"><span>Quant</span><strong>${p.quant}</strong><small>QC / MCQ / Numeric</small></article>`;}

  function switchView(name){document.querySelectorAll(".view").forEach(v=>v.classList.toggle("active",v.id===`view-${name}`));document.querySelectorAll(".tab").forEach(b=>b.classList.toggle("active",b.dataset.view===name));if(name==="vocab")renderVocabLibrary();if(name==="wrongbook")renderWrongbook();if(name==="stats")renderStats();if(name==="settings")renderSettings();}
  document.querySelectorAll(".tab").forEach(b=>b.onclick=()=>switchView(b.dataset.view));

  // ---------- Speech ----------
  const synth="speechSynthesis" in window?window.speechSynthesis:null;let voice=null;let speechCount=0;
  function pickVoice(){if(!synth)return;const vs=synth.getVoices();voice=vs.filter(v=>/^en[-_]US$/i.test(v.lang)&&v.localService)[0]||vs.filter(v=>/^en[-_]US$/i.test(v.lang))[0]||vs.filter(v=>/^en/i.test(v.lang)&&v.localService)[0]||null;}
  if(synth){pickVoice();synth.addEventListener?.("voiceschanged",pickVoice);}
  function speak(text,force=false){if(!synth||(!state.settings.autoSpeak&&!force)||!text)return;pickVoice();if(synth.speaking||synth.pending)synth.cancel();if(++speechCount%30===0){synth.cancel();pickVoice();}const u=new SpeechSynthesisUtterance(text);u.lang="en-US";u.rate=Math.max(.8,Math.min(1.4,Number(state.settings.speechRate)||1));if(voice)u.voice=voice;synth.speak(u);}

  // ---------- Vocabulary session ----------
  let vsession=null;
  function makeVItem(w,reason){return{id:w.id,reason,wasNew:!card(w.id).reps,hadError:false,need:0};}
  function startVocabSession(){const p=planSnapshot();const due=dueVocab().map(w=>makeVItem(w,"到期复习"));const fresh=unseen().slice(0,p.newVocab).map(w=>makeVItem(w,"今日新词"));vsession={queue:[...due,...fresh],total:due.length+fresh.length,done:0,current:null,answered:false};switchView("today");renderVocabQuestion();}
  function vocabQuizDirection(){
    const mode=String(state.settings.vocabQuizMode||"mixed");
    return mode==="mixed"?(Math.random()<0.5?"en-cn":"cn-en"):mode;
  }
  function buildVocabQ(w){
    const direction=vocabQuizDirection();
    const sameTier=DATA.words.filter(x=>x.id!==w.id&&(!w.priorityTier||x.priorityTier===w.priorityTier));
    const fallback=DATA.words.filter(x=>x.id!==w.id);
    const source=shuffle([...sameTier,...fallback]);
    if(direction==="cn-en"){
      const targetSyn=new Set((w.syn||[]).map(norm));
      const wrong=uniq(source
        .filter(x=>norm(x.cn)!==norm(w.cn))
        .filter(x=>!targetSyn.has(norm(x.word)))
        .filter(x=>!((x.syn||[]).some(s=>norm(s)===norm(w.word))))
        .map(x=>x.word))
        .filter(x=>norm(x)!==norm(w.word))
        .slice(0,3);
      return{direction,prompt:w.cn,correct:w.word,options:shuffle([w.word,...wrong])};
    }
    const wrong=uniq(source.map(x=>x.cn)).filter(x=>norm(x)!==norm(w.cn)).slice(0,3);
    return{direction,prompt:w.word,correct:w.cn,options:shuffle([w.cn,...wrong])};
  }
  function requeueV(item){const gap=3;const pos=Math.min(gap,vsession.queue.length);vsession.queue.splice(pos,0,item);}
  function renderVocabQuestion(){
    const root=$("studyCard");
    if(!vsession){
      root.innerHTML='<div class="empty"><div><h3>准备开始</h3><p>先复习到期词，再学习当天新词。</p></div></div>';
      return;
    }
    if(!vsession.queue.length){
      root.innerHTML=`<div class="empty"><div><h3>今日词汇完成 ✓</h3><p>完成 ${vsession.done}/${vsession.total} 个目标。接下来做 Verbal 和 Quant。</p><button class="primary" onclick="document.querySelector('[data-view=verbal]').click()">去做 Verbal</button></div></div>`;
      vsession=null;renderPlan();return;
    }
    const item=vsession.queue[0],w=DATA.words.find(x=>x.id===item.id),q=buildVocabQ(w);
    vsession.current={item,w,q,shown:performance.now()};
    const reverse=q.direction==="cn-en";
    const directionLabel=reverse?"中文 → 英文":"英文 → 中文";
    const helper=reverse?"根据中文含义选择正确英文；作答后自动朗读正确单词":(w.syn?.length?`近义：${w.syn.map(esc).join(" · ")}`:"选择正确中文释义");
    root.innerHTML=`<div class="qcard" data-mode="vocab" data-vocab-direction="${q.direction}" data-word="${esc(w.word)}">
      <div class="qhead"><span class="badge">${item.reason} · ${directionLabel} · Level ${w.level}</span><span class="muted">通过 ${vsession.done}/${vsession.total}${item.need?` · 还需答对${item.need}次`:""}</span></div>
      <div class="word">${esc(q.prompt)}</div>
      <div class="pronounce">${helper}</div>
      <div class="options">${q.options.map((o,i)=>`<button class="option" data-v="${esc(o)}" data-key="${i+1}">${esc(o)}</button>`).join("")}</div>
      <div class="kbdhint">1–4 选择 · ${reverse?"答题后 Tab 重读英文":"Tab 重读"} · Enter 下一题</div>
      <div id="vFeedback"></div>
    </div>`;
    document.querySelectorAll("#studyCard .option").forEach(b=>b.onclick=()=>answerVocab(b));
    if(!reverse)speak(w.word);
  }
    function answerVocab(btn){if(!vsession||vsession.answered)return;vsession.answered=true;const {item,w,q}=vsession.current;const picked=btn.dataset.v,ok=norm(picked)===norm(q.correct),c=card(w.id),wasNew=item.wasNew;c[ok?"correct":"wrong"]++;c.byDirection=c.byDirection||{"en-cn":{correct:0,wrong:0},"cn-en":{correct:0,wrong:0}};c.byDirection[q.direction]=c.byDirection[q.direction]||{correct:0,wrong:0};c.byDirection[q.direction][ok?"correct":"wrong"]++;if(!ok)c.lapses++;daily()[ok?"correct":"wrong"]++;document.querySelectorAll("#studyCard .option").forEach(b=>{b.disabled=true;if(norm(b.dataset.v)===norm(q.correct))b.classList.add("correct");if(b===btn&&!ok)b.classList.add("wrong");});let retry=false,passed=false;if(!ok){item.hadError=true;item.need=2;retry=true;state.wrong[`vocab:${w.id}`]={kind:"vocab",id:w.id,label:w.word,last:now(),count:(state.wrong[`vocab:${w.id}`]?.count||0)+1};}else if(item.need>0){item.need--;retry=item.need>0;passed=!retry;}else passed=true;if(passed){scheduleVocab(c,item.hadError,wasNew);if(wasNew)daily().vocab++;vsession.done++;}save();const rt=Math.round(performance.now()-vsession.current.shown);$("vFeedback").innerHTML=`<div class="feedback ${ok?"good":"bad"}"><strong>${ok?"正确":"错误"}</strong> · ${esc(w.word)} = ${esc(w.cn)}<br><span class="muted">近义：${w.syn.map(esc).join(" / ")} · ${rt} ms${retry?` · 后面还需答对 ${item.need} 次`:""}</span><div style="margin-top:10px"><button class="primary" id="vNext">下一题</button></div></div>`;speak(w.word,true);$("vNext").onclick=()=>{vsession.queue.shift();if(retry)requeueV(item);vsession.answered=false;renderVocabQuestion();};}

  // ---------- Generic practice ----------
  let practice=null;
  function startPractice(kind){const bank=kind==="verbal"?DATA.verbal:DATA.quant;const count=kind==="verbal"?state.settings.dailyVerbal:state.settings.dailyQuant;practice={kind,queue:shuffle(bank).slice(0,Math.min(count,bank.length)),index:0,correct:0,current:null,answered:false};switchView(kind);renderPractice();}
  function renderPractice(){if(!practice)return;const root=$(practice.kind==="verbal"?"verbalCard":"quantCard");if(practice.index>=practice.queue.length){root.innerHTML=`<div class="empty"><div><h3>专项完成 ✓</h3><p>正确 ${practice.correct}/${practice.queue.length}</p></div></div>`;practice=null;renderPlan();renderStats();return;}const q=practice.queue[practice.index];practice.current={q,shown:performance.now(),selected:new Set()};practice.answered=false;let body="";if(q.passage)body+=`<div class="feedback" style="margin-bottom:14px">${esc(q.passage)}</div>`;body+=`<h3 style="line-height:1.55">${esc(q.prompt).replaceAll("\n","<br>")}</h3>`;if(q.numeric!==undefined){body+=`<div style="margin:18px 0"><input id="numericAnswer" inputmode="decimal" style="font-size:1.2rem;padding:12px;border:1px solid var(--line);border-radius:12px;width:220px" placeholder="Numeric entry" /></div>`;}else{body+=`<div class="options">${q.options.map((o,i)=>`<button class="option" data-i="${i}" data-key="${i+1}">${esc(o)}</button>`).join("")}</div>`;}body+=`<div class="kbdhint">数字键选择 · 多选题可选多个后按 Enter 提交 · Enter 下一题</div><div id="practiceFeedback"></div>`;root.innerHTML=`<div class="qcard"><div class="qhead"><span class="badge">${esc(q.type)}</span><span class="muted">${practice.index+1}/${practice.queue.length}</span></div>${body}</div>`;if(q.numeric!==undefined){$("numericAnswer").focus();$("numericAnswer").onkeydown=e=>{if(e.key==="Enter"){e.preventDefault();submitPracticeNumeric();}};}else document.querySelectorAll(`#${root.id} .option`).forEach(b=>b.onclick=()=>selectPracticeOption(b));}
  function isMulti(q){return q.type==="Sentence Equivalence"||q.type==="Multiple Select"||q.answer.length>1;}
  function selectPracticeOption(btn){if(!practice||practice.answered)return;const q=practice.current.q,i=Number(btn.dataset.i);if(isMulti(q)){if(practice.current.selected.has(i)){practice.current.selected.delete(i);btn.style.outline="";}else{practice.current.selected.add(i);btn.style.outline="3px solid #9eb1e8";}}else{practice.current.selected=new Set([i]);submitPractice();}}
  function submitPracticeNumeric(){if(!practice||practice.answered)return;const q=practice.current.q,val=Number($("numericAnswer").value);const ok=Math.abs(val-q.numeric)<1e-9;finishPractice(ok,String(val));}
  function submitPractice(){if(!practice||practice.answered)return;const q=practice.current.q;const got=[...practice.current.selected].sort((a,b)=>a-b),ans=[...q.answer].sort((a,b)=>a-b);const ok=got.length===ans.length&&got.every((x,i)=>x===ans[i]);finishPractice(ok,got.map(i=>q.options[i]).join("; "));}
  function finishPractice(ok,picked){practice.answered=true;const q=practice.current.q,stat=qstat(q.id),rt=Math.round(performance.now()-practice.current.shown);stat.attempts++;stat.totalMs+=rt;stat.last=now();stat[ok?"correct":"wrong"]++;daily()[practice.kind]++;daily()[ok?"correct":"wrong"]++;if(ok)practice.correct++;else state.wrong[`${practice.kind}:${q.id}`]={kind:practice.kind,id:q.id,label:`${q.type}: ${q.prompt.slice(0,55)}`,last:now(),count:(state.wrong[`${practice.kind}:${q.id}`]?.count||0)+1};save();if(q.numeric===undefined)document.querySelectorAll(`#${practice.kind==="verbal"?"verbalCard":"quantCard"} .option`).forEach((b)=>{b.disabled=true;const i=Number(b.dataset.i);if(q.answer.includes(i))b.classList.add("correct");if(!ok&&practice.current.selected.has(i)&&!q.answer.includes(i))b.classList.add("wrong");});$("practiceFeedback").innerHTML=`<div class="feedback ${ok?"good":"bad"}"><strong>${ok?"正确":"错误"}</strong><br>${esc(q.explain)}<div class="muted" style="margin-top:5px">用时 ${(rt/1000).toFixed(1)}s${picked?` · 你的答案：${esc(picked)}`:""}</div><div style="margin-top:10px"><button class="primary" id="practiceNext">下一题</button></div></div>`;$("practiceNext").onclick=()=>{practice.index++;renderPractice();};}

  // ---------- Writing ----------
  let issueIndex=0,timerId=null,timerLeft=1800;
  function renderIssue(){const issue=DATA.issues[issueIndex%DATA.issues.length];$("issuePrompt").textContent=issue.prompt;$("issueInstruction").textContent=issue.instruction;const key=`issue:${issueIndex%DATA.issues.length}`;$("essayDraft").value=state.essay[key]||"";updateWordCount();timerLeft=1800;renderTimer();}
  function renderTimer(){$("essayTimer").textContent=`${String(Math.floor(timerLeft/60)).padStart(2,"0")}:${String(timerLeft%60).padStart(2,"0")}`;}
  function updateWordCount(){const n=($("essayDraft").value.trim().match(/\S+/g)||[]).length;$("wordCount").textContent=`${n} words`;}
  $("newIssueBtn").onclick=()=>{issueIndex=(issueIndex+1)%DATA.issues.length;renderIssue();};
  $("essayDraft").oninput=()=>{const key=`issue:${issueIndex%DATA.issues.length}`;state.essay[key]=$("essayDraft").value;save();updateWordCount();};
  $("startEssayTimerBtn").onclick=()=>{clearInterval(timerId);timerLeft=1800;renderTimer();timerId=setInterval(()=>{timerLeft--;renderTimer();if(timerLeft<=0){clearInterval(timerId);toast("30分钟到时");}},1000);};
  $("clearEssayBtn").onclick=()=>{if(confirm("清空当前写作草稿？")){$("essayDraft").value="";$("essayDraft").dispatchEvent(new Event("input"));}};

  // ---------- Library / wrongbook / stats ----------
  let vocabFilter="all";
  function renderVocabLibrary(){const q=norm($("vocabSearch").value);const words=DATA.words.filter(w=>(vocabFilter==="all"||String(w.level)===vocabFilter)&&(!q||norm(`${w.word} ${w.cn} ${w.syn.join(" ")}`).includes(q)));$("vocabFilters").innerHTML=["all",1,2,3].map(x=>`<button class="chip ${String(vocabFilter)===String(x)?"active":""}" data-f="${x}">${x==="all"?`全部 ${DATA.words.length}`:`Level ${x}`}</button>`).join("");document.querySelectorAll("#vocabFilters .chip").forEach(b=>b.onclick=()=>{vocabFilter=b.dataset.f;renderVocabLibrary();});$("vocabList").innerHTML=words.map(w=>{const c=card(w.id);return `<article class="word-row"><span class="level">L${w.level}</span><strong>${esc(w.word)}</strong><div class="cn">${esc(w.cn)}</div><div class="syn">${w.syn.map(esc).join(" · ")}</div><div class="syn" style="margin-top:5px">${c.reps?`已复习 ${c.reps} 次 · 错 ${c.wrong}`:"未学习"}</div></article>`;}).join("");}
  $("vocabSearch").oninput=renderVocabLibrary;

  function renderWrongbook(){const rows=Object.values(state.wrong).sort((a,b)=>(b.count||0)-(a.count||0));$("wrongStats").innerHTML=`<article class="metric"><span>错题数</span><strong>${rows.length}</strong></article><article class="metric"><span>累计错误</span><strong>${rows.reduce((s,x)=>s+(x.count||0),0)}</strong></article><article class="metric"><span>词汇错词</span><strong>${rows.filter(x=>x.kind==="vocab").length}</strong></article><article class="metric"><span>专项错题</span><strong>${rows.filter(x=>x.kind!=="vocab").length}</strong></article>`;$("wrongList").innerHTML=rows.length?rows.map(x=>`<div class="wrong-item"><div><strong>${esc(x.label)}</strong><small>${x.kind} · 最近 ${new Date(x.last).toLocaleDateString()}</small></div><b>${x.count}×</b></div>`).join(""):'<div class="empty"><p>还没有错题。</p></div>';}
  $("reviewWrongBtn").onclick=()=>{const vocabIds=Object.values(state.wrong).filter(x=>x.kind==="vocab").map(x=>x.id);if(!vocabIds.length){toast("错词本里暂无词汇错题");return;}vsession={queue:shuffle(vocabIds.map(id=>makeVItem(DATA.words.find(w=>w.id===id),"错词本"))),total:vocabIds.length,done:0,current:null,answered:false};switchView("today");renderVocabQuestion();};

  function accuracy(obj){const a=Object.values(obj||{}).reduce((s,x)=>s+(x.correct||0),0),w=Object.values(obj||{}).reduce((s,x)=>s+(x.wrong||0),0);return a+w?Math.round(a/(a+w)*100):0;}
  function byType(bank){return [...new Set(bank.map(q=>q.type))].map(type=>{const qs=bank.filter(q=>q.type===type);let c=0,a=0;qs.forEach(q=>{const s=state.questions[q.id];if(s){c+=s.correct||0;a+=s.attempts||0;}});return{type,c,a,p:a?Math.round(c/a*100):0};});}
  function renderTypeStats(id,rows){$(id).innerHTML=rows.map(r=>`<div class="barrow"><span>${esc(r.type)}</span><div class="bar"><i style="width:${r.p}%"></i></div><b>${r.a?r.p+"%":"—"}</b></div>`).join("");}
  function renderStats(){const learned=DATA.words.filter(w=>card(w.id).reps).length;const vc=DATA.words.reduce((s,w)=>s+card(w.id).correct,0),vw=DATA.words.reduce((s,w)=>s+card(w.id).wrong,0);const verbalIds=Object.fromEntries(DATA.verbal.map(q=>[q.id,state.questions[q.id]||{}]));const quantIds=Object.fromEntries(DATA.quant.map(q=>[q.id,state.questions[q.id]||{}]));$("statsGrid").innerHTML=`<article class="metric"><span>词汇已学</span><strong>${learned}/${DATA.words.length}</strong></article><article class="metric"><span>词汇正确率</span><strong>${vc+vw?Math.round(vc/(vc+vw)*100):0}%</strong></article><article class="metric"><span>Verbal 正确率</span><strong>${accuracy(verbalIds)}%</strong></article><article class="metric"><span>Quant 正确率</span><strong>${accuracy(quantIds)}%</strong></article>`;renderTypeStats("verbalStats",byType(DATA.verbal));renderTypeStats("quantStats",byType(DATA.quant));}

  function renderModules(){const vc=byType(DATA.verbal),qc=byType(DATA.quant);$("verbalModules").innerHTML=vc.map(x=>`<article class="module-card"><span>${esc(x.type)}</span><strong>${x.a?x.p+"%":"未练习"}</strong><small>${DATA.verbal.filter(q=>q.type===x.type).length} 道原创题</small></article>`).join("");$("quantModules").innerHTML=qc.map(x=>`<article class="module-card"><span>${esc(x.type)}</span><strong>${x.a?x.p+"%":"未练习"}</strong><small>${DATA.quant.filter(q=>q.type===x.type).length} 道原创题</small></article>`).join("");}

  // ---------- Settings / backup ----------
  function renderSettings(){$("planDaysInput").value=state.settings.planDays;if($("vocabScopeInput"))$("vocabScopeInput").value=state.settings.vocabScope||"all";if($("vocabScopeQuick"))$("vocabScopeQuick").value=state.settings.vocabScope||"all";if($("vocabQuizModeInput"))$("vocabQuizModeInput").value=state.settings.vocabQuizMode||"mixed";if($("vocabQuizModeQuick"))$("vocabQuizModeQuick").value=state.settings.vocabQuizMode||"mixed";$("dailyVerbalInput").value=state.settings.dailyVerbal;$("dailyQuantInput").value=state.settings.dailyQuant;$("autoSpeakInput").checked=state.settings.autoSpeak;$("speechRateInput").value=state.settings.speechRate;$("speechRateText").textContent=`${Number(state.settings.speechRate).toFixed(2)}×`;}
  $("speechRateInput").oninput=()=>$("speechRateText").textContent=`${Number($("speechRateInput").value).toFixed(2)}×`;
  if($("vocabScopeQuick")){$("vocabScopeQuick").value=state.settings.vocabScope||"all";$("vocabScopeQuick").onchange=()=>{state.settings.vocabScope=$("vocabScopeQuick").value;save();if($("vocabScopeInput"))$("vocabScopeInput").value=state.settings.vocabScope;renderPlan();toast(`词汇范围：${vocabScopeLabel()}`);};}
  if($("vocabQuizModeQuick")){$("vocabQuizModeQuick").value=state.settings.vocabQuizMode||"mixed";$("vocabQuizModeQuick").onchange=()=>{state.settings.vocabQuizMode=$("vocabQuizModeQuick").value;save();if($("vocabQuizModeInput"))$("vocabQuizModeInput").value=state.settings.vocabQuizMode;toast(`词汇题型：${state.settings.vocabQuizMode==="cn-en"?"中文 → 英文":state.settings.vocabQuizMode==="en-cn"?"英文 → 中文":"双向混合"}`);};}
  $("saveSettingsBtn").onclick=()=>{state.settings.planDays=Math.max(7,Math.min(180,Number($("planDaysInput").value)||60));state.settings.vocabScope=$("vocabScopeInput")?.value||state.settings.vocabScope||"all";state.settings.vocabQuizMode=$("vocabQuizModeInput")?.value||state.settings.vocabQuizMode||"mixed";state.settings.dailyVerbal=Math.max(0,Math.min(50,Number($("dailyVerbalInput").value)||0));state.settings.dailyQuant=Math.max(0,Math.min(50,Number($("dailyQuantInput").value)||0));state.settings.autoSpeak=$("autoSpeakInput").checked;state.settings.speechRate=Number($("speechRateInput").value)||1;save();if($("vocabScopeQuick"))$("vocabScopeQuick").value=state.settings.vocabScope;if($("vocabQuizModeQuick"))$("vocabQuizModeQuick").value=state.settings.vocabQuizMode;renderPlan();toast("设置已保存");};
  $("restartPlanBtn").onclick=()=>{state.plan.startDate=dateKey();save();renderPlan();toast("计划已从今天重新开始");};
  $("exportBtn").onclick=()=>{const blob=new Blob([JSON.stringify(state,null,2)],{type:"application/json"});const a=document.createElement("a");a.href=URL.createObjectURL(blob);a.download=`gre-prep-backup-${dateKey()}.json`;a.click();URL.revokeObjectURL(a.href);};
  $("importInput").onchange=async e=>{const f=e.target.files?.[0];if(!f)return;try{state={...fresh(),...JSON.parse(await f.text())};save();location.reload();}catch{toast("备份文件无效");}};
  $("resetBtn").onclick=()=>{if(confirm("确定清空全部 GRE 学习记录？")){localStorage.removeItem(KEY);location.reload();}};
  $("healthBtn").onclick=()=>alert(`GRE 本地数据自检\n词汇：${DATA.words.length}\nVerbal 原创题：${DATA.verbal.length}\nQuant 原创题：${DATA.quant.length}\n写作题：${DATA.issues.length}\n存储：localStorage`);

  // ---------- Keyboard ----------
  document.addEventListener("keydown",e=>{const tag=(e.target.tagName||"").toLowerCase();if(["input","textarea","select"].includes(tag))return;if(e.key==="Tab"&&!e.shiftKey){const cardEl=document.querySelector("#studyCard .qcard[data-mode='vocab']");if(cardEl){const direction=cardEl.dataset.vocabDirection||"en-cn";const answered=!!document.querySelector("#studyCard #vNext");if(direction==="cn-en"&&!answered){e.preventDefault();toast("中文→英文题需先作答，避免发音泄露答案");return;}const text=cardEl.dataset.word||document.querySelector("#studyCard .word")?.textContent?.trim();if(text){e.preventDefault();speak(text,true);}return;}const text=document.querySelector("#studyCard .word")?.textContent?.trim();if(text){e.preventDefault();speak(text,true);}return;}if(/^[1-6]$/.test(e.key)){const active=document.querySelector(".view.active .study-card");const opts=[...(active?.querySelectorAll(".option:not(:disabled)")||[])];const b=opts[Number(e.key)-1];if(b){e.preventDefault();b.click();}}if(e.key==="Enter"){const next=document.querySelector(".view.active #vNext,.view.active #practiceNext");if(next){e.preventDefault();next.click();return;}if(practice&&!practice.answered&&practice.current&&isMulti(practice.current.q)){e.preventDefault();submitPractice();}}});

  $("startTodayBtn").onclick=startVocabSession;$("startVerbalBtn").onclick=()=>startPractice("verbal");$("startQuantBtn").onclick=()=>startPractice("quant");

  // Correct one seed item if old cached data ever injects it externally.
  const q10=DATA.quant.find(q=>q.id==="q10");if(q10)q10.answer=[2];

  renderPlan();renderVocabQuestion();renderModules();renderIssue();renderSettings();
})();