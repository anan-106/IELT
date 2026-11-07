/* GRE Foundation Words — independent vocabulary module.
 * Data source: user-provided 地基词词表简版(全）.xlsx.
 * 1,150 unique headwords, 23 chapters × 50 words. Repeated headwords are merged;
 * original Section references and alternate notes are retained.
 */
(() => {
  "use strict";
  const KEY="gre-foundation-words-v1";
  const PARTS=["foundation-words-data-1.b64","foundation-words-data-2.b64","foundation-words-data-3.b64","foundation-words-data-4.b64"];
  const INTERVALS=[1,3,7,14,30];
  const $=id=>document.getElementById(id);
  const esc=v=>String(v??"").replace(/[&<>"']/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
  const norm=v=>String(v??"").toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g," ").trim();
  const shuffle=items=>{const a=[...items];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const unique=items=>[...new Set(items.filter(Boolean))];
  const fresh=()=>({version:1,settings:{direction:"mixed",autoSpeak:true,speechRate:1},records:{},daily:{}});
  let state=(()=>{try{const x=JSON.parse(localStorage.getItem(KEY)||"null");return x?{...fresh(),...x,settings:{...fresh().settings,...(x.settings||{})},records:x.records||{}}:fresh();}catch{return fresh();}})();
  let words=[],chapters=[],session=null;

  function save(){try{localStorage.setItem(KEY,JSON.stringify(state));return true;}catch{notify("本地存储空间不足，请导出学习记录。");return false;}}
  function rec(id){state.records[id]||={attempts:0,correct:0,wrong:0,stage:-1,due:0,last:0,lapses:0,wrongOptions:[]};return state.records[id];}
  function isPending(r){return r.wrongPending===true||(r.wrongPending==null&&Number(r.wrong||0)>0);}
  function topWrongOption(r){return (Array.isArray(r.wrongOptions)?[...r.wrongOptions]:[]).sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0))[0]||null;}
  function today(){const d=new Date();d.setHours(0,0,0,0);return d.getTime();}
  function addDays(n){const d=new Date(today());d.setDate(d.getDate()+n);return d.getTime();}
  function dateLabel(ts){return ts?new Date(ts).toLocaleDateString("zh-CN",{month:"2-digit",day:"2-digit"}):"未安排";}
  function notify(msg){const t=$("gf-toast");if(!t)return;t.textContent=msg;t.classList.add("show");clearTimeout(t._timer);t._timer=setTimeout(()=>t.classList.remove("show"),2200);}

  async function loadData(){
    const parts=await Promise.all(PARTS.map(async p=>{const r=await fetch("./"+p,{cache:"no-store"});if(!r.ok)throw new Error("词库文件加载失败："+p+" ("+r.status+")");return r.text();}));
    const binary=atob(parts.join("").replace(/\s/g,"")),bytes=new Uint8Array(binary.length);
    for(let i=0;i<binary.length;i++)bytes[i]=binary.charCodeAt(i);
    if(!("DecompressionStream" in window))throw new Error("浏览器不支持 gzip 解压，请使用最新版 Chrome 或 Edge。");
    const stream=new Blob([bytes]).stream().pipeThrough(new DecompressionStream("gzip"));
    const payload=JSON.parse(new TextDecoder("utf-8").decode(await new Response(stream).arrayBuffer()));
    if(!Array.isArray(payload.words)||payload.words.length!==payload.n)throw new Error("地基词数据校验失败。");
    words=payload.words.map((a,i)=>({id:"foundation-"+String(i+1).padStart(4,"0"),word:a[0],sourceSections:a[1]||[],definition:a[2]||"",example:a[3]||"",memory:a[4]||"",derivatives:a[5]||"",synonyms:a[6]||"",antonyms:a[7]||"",rawNote:a[8]||"",alternateNotes:a[9]||[]}));
    for(let i=0;i<words.length;i+=50)chapters.push({id:chapters.length+1,words:words.slice(i,i+50)});
  }

  function meaning(w){
    if(w.definition.trim())return w.definition.trim();
    const raw=w.rawNote||"",i=raw.search(/【(?:例|记|衍|同|反|形|上义|义|词根)】/);
    const lead=(i>=0?raw.slice(0,i):raw.split(/\n/)[0]).trim();
    return lead||raw.trim()||"原词表未提供独立释义，请查看完整笔记。";
  }
  function sourceLabel(w){return (w.sourceSections||[]).map(n=>"原始 Section "+n).join(" / ");}
  function noteRows(w){
    const a=[];
    if(w.definition)a.push(["词义 / 形近辨析",w.definition]);
    if(w.example)a.push(["例句",w.example]);
    if(w.memory)a.push(["记忆",w.memory]);
    if(w.derivatives)a.push(["衍生词",w.derivatives]);
    if(w.synonyms)a.push(["同义词",w.synonyms]);
    if(w.antonyms)a.push(["反义词",w.antonyms]);
    if(w.rawNote)a.push(["原始笔记",w.rawNote]);
    (w.alternateNotes||[]).forEach(x=>{if(x[1])a.push(["补充笔记 · Section "+x[0],x[1]]);});
    if(!a.length)a.push(["笔记","原词表未提供额外笔记。"]);
    return a;
  }
  function notesHTML(w){return noteRows(w).map(x=>'<div class="gf-note-row"><span>'+esc(x[0])+'</span><div>'+esc(x[1]).replace(/\n/g,"<br>")+'</div></div>').join("");}

  function mount(){
    const nav=document.querySelector(".tabs"),vocabTab=nav?.querySelector('[data-view="vocab"]');
    if(!nav||!vocabTab||$("view-foundation"))return;
    const tab=document.createElement("button");tab.className="tab";tab.dataset.view="foundation";tab.textContent="地基词";vocabTab.after(tab);tab.onclick=switchTo;
    const view=document.createElement("section");view.className="view";view.id="view-foundation";
    view.innerHTML=`
      <div class="gf-head"><div><div class="kicker">GRE FOUNDATION WORDS</div><h2>地基词 · 独立背词计划</h2><p>每 50 个单词编为一章，保留原始 Section、释义、例句、记忆、衍生词、同义词和反义词。</p></div><div class="gf-actions"><button class="primary" id="gf-review-wrong">错词专项复习（0）</button><button class="ghost" id="gf-review-due">复习到期词</button><button class="ghost" id="gf-start-new">学习未学词</button></div></div>
      <div class="gf-metrics" id="gf-metrics"></div>
      <section class="gf-wrong-panel" id="gf-wrong-panel">
        <div class="gf-wrong-top"><div><h3>错词追踪</h3><p>按累计选错次数排序。完成连续两次正确后，单词会退出待巩固池，但历史错误不会清零。</p></div>
          <label>错词范围<select id="gf-wrong-filter"><option value="pending">待巩固错词</option><option value="all">全部曾错词</option><option value="repeat">反复错词（≥2 次）</option></select></label>
        </div>
        <div class="gf-wrong-stats" id="gf-wrong-stats"></div>
        <div class="gf-wrong-list" id="gf-wrong-list"></div>
      </section>
      <div class="gf-toolbar"><label>答题方向<select id="gf-direction"><option value="mixed">双向混合</option><option value="en-cn">英文 → 中文</option><option value="cn-en">中文 → 英文</option></select></label><label class="gf-search">搜索单词 / 释义 / 笔记<input id="gf-search" type="search" placeholder="例如 capricious / 反复无常 / 词根"></label><button class="ghost" id="gf-export">导出学习记录</button></div>
      <div class="gf-session" id="gf-session"><div class="gf-empty"><strong>正在加载地基词…</strong><span>读取独立词库文件。</span></div></div>
      <div class="gf-library"><div class="gf-section-title"><div><h3>章节目录</h3><p id="gf-chapter-count">每章 50 词</p></div><span id="gf-library-summary"></span></div><div class="gf-chapters" id="gf-chapters"></div></div>
      <div class="gf-search-results" id="gf-search-results" hidden></div><div class="gf-toast" id="gf-toast"></div>`;
    $("view-vocab")?.after(view);
    $("gf-direction").value=state.settings.direction;
    $("gf-direction").onchange=()=>{state.settings.direction=$("gf-direction").value;save();};
    $("gf-review-wrong").onclick=startWrongReview;$("gf-wrong-filter").onchange=renderWrongPanel;
    $("gf-review-due").onclick=startDue;$("gf-start-new").onclick=startNew;$("gf-export").onclick=exportBackup;$("gf-search").oninput=renderSearch;
  }
  function switchTo(){document.querySelectorAll(".view").forEach(x=>x.classList.toggle("active",x.id==="view-foundation"));document.querySelectorAll(".tab").forEach(x=>x.classList.toggle("active",x.dataset.view==="foundation"));renderOverview();renderChapters();}
  function due(list=words){const now=Date.now();return list.filter(w=>rec(w.id).attempts&&rec(w.id).due&&rec(w.id).due<=now).sort((a,b)=>rec(a.id).due-rec(b.id).due);}
  function unseen(list=words){return list.filter(w=>!rec(w.id).attempts);}
  function renderOverview(){
    if(!words.length||!$("gf-metrics"))return;
    const learned=words.filter(w=>rec(w.id).attempts>0).length,dueCount=due().length,mastered=words.filter(w=>rec(w.id).stage>=3).length;
    const correct=words.reduce((s,w)=>s+rec(w.id).correct,0),attempts=words.reduce((s,w)=>s+rec(w.id).attempts,0);
    const wrongWords=words.filter(w=>Number(rec(w.id).wrong||0)>0).length;
    const wrongSelections=words.reduce((s,w)=>s+Number(rec(w.id).wrong||0),0);
    $("gf-metrics").innerHTML=`
      <article><span>总词数</span><strong>${words.length.toLocaleString()}</strong><small>${chapters.length} 章 · 每章 50 词</small></article>
      <article><span>已学词汇</span><strong>${learned.toLocaleString()}</strong><small>完成 ${Math.round(learned/words.length*100)}%</small></article>
      <article><span>到期复习</span><strong>${dueCount.toLocaleString()}</strong><small>独立复习计划</small></article>
      <article><span>已巩固</span><strong>${mastered.toLocaleString()}</strong><small>完成多轮间隔复习</small></article>
      <article><span>累计选错</span><strong>${wrongSelections.toLocaleString()}</strong><small>${wrongWords.toLocaleString()} 个曾错单词</small></article>
      <article><span>累计正确率</span><strong>${attempts?Math.round(correct/attempts*100):0}%</strong><small>${attempts.toLocaleString()} 次作答</small></article>`;
    $("gf-library-summary").textContent=learned+"/"+words.length+" 已学 · "+dueCount+" 个到期 · "+wrongWords+" 个错词";
    $("gf-chapter-count").textContent=chapters.length+" 章 · 每章 50 词（最后一章 "+chapters.at(-1).words.length+" 词）";
    renderWrongPanel();
  }
  function wrongItems(filter="pending"){
    return words.filter(w=>{
      const r=rec(w.id),n=Number(r.wrong||0);
      if(!n)return false;
      if(filter==="pending")return isPending(r);
      if(filter==="repeat")return n>=2;
      return true;
    }).sort((a,b)=>Number(rec(b.id).wrong||0)-Number(rec(a.id).wrong||0)||(Number(rec(b.id).lastWrongAt||0)-Number(rec(a.id).lastWrongAt||0)));
  }
  function renderWrongPanel(){
    const listRoot=$("gf-wrong-list");if(!listRoot||!words.length)return;
    const all=words.filter(w=>Number(rec(w.id).wrong||0)>0);
    const pending=all.filter(w=>isPending(rec(w.id)));
    const repeated=all.filter(w=>Number(rec(w.id).wrong||0)>=2);
    const total=all.reduce((s,w)=>s+Number(rec(w.id).wrong||0),0);
    $("gf-wrong-stats").innerHTML=`
      <article><span>曾错单词</span><strong>${all.length}</strong></article>
      <article><span>待巩固</span><strong>${pending.length}</strong></article>
      <article><span>累计选错</span><strong>${total}</strong><small>${repeated.length} 个单词至少错过 2 次</small></article>`;
    const filter=$("gf-wrong-filter")?.value||"pending",items=wrongItems(filter),button=$("gf-review-wrong");
    if(button)button.textContent=`错词专项复习（${items.length}）`;
    if(!items.length){listRoot.innerHTML='<div class="gf-empty">当前筛选下没有错词。答题选错后，单词会自动进入这里。</div>';return;}
    const visible=items.slice(0,20);
    listRoot.innerHTML=`<div class="gf-wrong-caption">按累计选错次数从高到低显示前 ${visible.length} 个；点击上方按钮可复习当前筛选下的全部 ${items.length} 个单词。</div><div class="gf-wrong-rows">${visible.map(w=>{
      const r=rec(w.id),top=topWrongOption(r),last=r.lastWrongOption||"旧记录未保存具体误选项";
      const lastDirection=r.lastWrongDirection==="cn-en"?"中文→英文":r.lastWrongDirection==="en-cn"?"英文→中文":"方向未记录";
      const topDirection=top?.direction==="cn-en"?"中文→英文":top?.direction==="en-cn"?"英文→中文":"";
      return `<article class="gf-wrong-row"><div class="gf-wrong-word"><strong>${esc(w.word)}</strong><span>${esc(meaning(w))}</span><small>选错 ${Number(r.wrong||0)} 次 · ${isPending(r)?"待巩固":"已重新巩固"} · 最近误选（${lastDirection}）：${esc(last)}${top?" · 最常误选（"+topDirection+"）："+esc(top.option)+"（"+Number(top.count||0)+"次）":""}</small></div><button class="ghost" data-gf-review-word="${esc(w.id)}">单独复习</button></article>`;
    }).join("")}</div>`;
    listRoot.querySelectorAll("[data-gf-review-word]").forEach(b=>b.onclick=()=>startWrongWord(b.dataset.gfReviewWord));
  }
  function renderChapters(){
    if(!$("gf-chapters"))return;
    $("gf-chapters").innerHTML=chapters.map(c=>{
      const learned=c.words.filter(w=>rec(w.id).attempts>0).length,dueCount=due(c.words).length;
      const wrongCount=c.words.filter(w=>Number(rec(w.id).wrong||0)>0).length;
      const pendingCount=c.words.filter(w=>isPending(rec(w.id))).length;
      const first=(c.id-1)*50+1,last=first+c.words.length-1,pct=Math.round(learned/c.words.length*100);
      return `<article class="gf-chapter"><div class="gf-chapter-top"><strong>第 ${String(c.id).padStart(2,"0")} 章</strong><span>${c.words.length} 词</span></div><div class="gf-chapter-range">词条 ${first}–${last}</div><div class="gf-progress"><i style="width:${pct}%"></i></div><div class="gf-chapter-meta"><span>${learned}/${c.words.length} 已学</span><span>错词 ${wrongCount} · 待巩固 ${pendingCount}</span></div><button class="primary" data-gf-chapter="${c.id}">${unseen(c.words).length?"开始本章":dueCount?"复习本章":"再次练习"}</button></article>`;
    }).join("");
    $("gf-chapters").querySelectorAll("[data-gf-chapter]").forEach(b=>b.onclick=()=>startChapter(Number(b.dataset.gfChapter)));
    renderOverview();
  }
  function begin(title,items,mode="normal"){
    if(!items.length){notify("目前没有符合条件的词汇。");return;}
    session={title,queue:[...items],done:0,total:items.length,currentItem:null,current:null,answered:false,mode};
    nextQuestion();
  }
  function startChapter(id){const c=chapters.find(x=>x.id===id);if(!c)return;const items=[...due(c.words),...unseen(c.words)];begin("第 "+id+" 章",items.length?items:shuffle(c.words));}
  function startDue(){begin("全词库到期复习",due());}
  function startNew(){begin("未学词汇",unseen());}
  function startWrongReview(){
    const filter=$("gf-wrong-filter")?.value||"pending",items=wrongItems(filter);
    const labels={pending:"待巩固",all:"全部曾错",repeat:"反复错"};
    begin(labels[filter]+"错词专项复习",items,"wrong");
  }
  function startWrongWord(id){const w=words.find(x=>x.id===id);if(w)begin(w.word+" · 单词专项复习",[w],"wrong");}
  function direction(){const m=state.settings.direction;return m==="mixed"?(Math.random()<.5?"en-cn":"cn-en"):m;}
  function question(w,reinforceConfusions=false){
    const d=direction(),m=meaning(w),r=rec(w.id);
    const remembered=reinforceConfusions?(Array.isArray(r.wrongOptions)?[...r.wrongOptions]:[]).filter(x=>x.direction===d).sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0)).map(x=>x.option):[];
    if(d==="cn-en"){
      const candidates=shuffle(words.filter(x=>x.id!==w.id&&norm(meaning(x))!==norm(m))).map(x=>x.word);
      const wrong=unique([...remembered,...candidates]).filter(x=>norm(x)!==norm(w.word)).slice(0,3);
      return {direction:d,prompt:m,correct:w.word,options:shuffle([w.word,...wrong])};
    }
    const candidates=shuffle(words.filter(x=>x.id!==w.id&&norm(meaning(x))!==norm(m))).map(meaning);
    const wrong=unique([...remembered,...candidates]).filter(x=>norm(x)!==norm(m)).slice(0,3);
    return {direction:d,prompt:w.word,correct:m,options:shuffle([m,...wrong])};
  }
  function speak(word,force=false){if(!("speechSynthesis" in window)||(!state.settings.autoSpeak&&!force))return;window.speechSynthesis.cancel();const u=new SpeechSynthesisUtterance(word);u.lang="en-US";u.rate=Math.max(.8,Math.min(1.4,Number(state.settings.speechRate)||1));window.speechSynthesis.speak(u);}
  function nextQuestion(){
    const root=$("gf-session");if(!session)return;
    if(!session.queue.length){
      root.innerHTML=`<div class="gf-empty"><strong>${esc(session.title)}完成 ✓</strong><span>本轮完成 ${session.done}/${session.total} 个词条，学习记录已保存。</span><button class="primary" id="gf-back">返回章节目录</button></div>`;
      $("gf-back").onclick=()=>{session=null;renderOverview();renderChapters();};session=null;renderOverview();renderChapters();return;
    }
    const w=session.queue[0],existing=rec(w.id),pending=isPending(existing),q=question(w,session.mode==="wrong"),item=session.currentItem||{hadError:pending,need:pending?2:0,wasNew:existing.attempts===0};
    session.currentItem=item;session.current={word:w,q,shown:performance.now()};session.answered=false;
    const reverse=q.direction==="cn-en";
    root.innerHTML=`
      <div class="gf-session-head"><div><span class="gf-pill">${esc(session.title)}</span><span class="gf-muted">本轮 ${session.done}/${session.total} · ${reverse?"中文 → 英文":"英文 → 中文"}</span></div><button class="ghost" id="gf-end">结束本轮</button></div>
      <div class="gf-question"><div class="gf-source">${esc(sourceLabel(w))} · 累计选错 ${Number(existing.wrong||0)} 次${pending?" · 待巩固":""}</div><div class="gf-prompt">${esc(q.prompt)}</div><div class="gf-helper">${reverse?"根据中文核心义回忆英文单词":"选择最符合原笔记的中文释义"}</div>
      <div class="gf-options">${q.options.map((x,i)=>`<button class="gf-option" data-gf-option="${esc(x)}"><span>${i+1}</span>${esc(x)}</button>`).join("")}</div><div class="gf-shortcuts">按 1–4 选择 · Enter 下一题 · Tab 重读单词</div><div id="gf-feedback"></div></div>`;
    $("gf-end").onclick=()=>{session=null;renderOverview();renderChapters();};
    root.querySelectorAll("[data-gf-option]").forEach(b=>b.onclick=()=>answer(b));
    if(!reverse)speak(w.word);
  }
  function answer(button){
    if(!session?.current||session.answered)return;session.answered=true;
    const {word:w,q,shown}=session.current,item=session.currentItem,picked=button.dataset.gfOption,ok=norm(picked)===norm(q.correct),r=rec(w.id);
    r.attempts++;r.last=Date.now();if(ok)r.correct++;else{
      r.wrong++;r.lapses++;item.hadError=true;item.need=2;r.due=Date.now()+600000;
      r.wrongPending=true;r.lastWrongAt=Date.now();r.lastWrongOption=picked;r.lastWrongDirection=q.direction;
      r.wrongOptions=Array.isArray(r.wrongOptions)?r.wrongOptions:[];
      const prior=r.wrongOptions.find(x=>x.direction===q.direction&&norm(x.option)===norm(picked));
      if(prior)prior.count=(Number(prior.count)||0)+1;else r.wrongOptions.push({option:picked,count:1,direction:q.direction});
      r.wrongOptions.sort((a,b)=>(Number(b.count)||0)-(Number(a.count)||0));
      if(r.wrongOptions.length>20)r.wrongOptions.length=20;
    }
    $("gf-session").querySelectorAll(".gf-option").forEach(b=>{b.disabled=true;if(norm(b.dataset.gfOption)===norm(q.correct))b.classList.add("correct");if(b===button&&!ok)b.classList.add("incorrect");});
    let retry=!ok,passed=false;
    if(ok&&item.need>0){item.need--;retry=item.need>0;passed=!retry;}else if(ok)passed=true;
    if(passed){const stage=(item.wasNew||item.hadError||r.stage<0)?0:Math.min(r.stage+1,INTERVALS.length-1);r.stage=stage;r.due=addDays(INTERVALS[stage]);r.last=Date.now();if(item.hadError){r.wrongPending=false;r.clearedWrongAt=Date.now();}session.done++;}
    save();
    const elapsed=Math.round(performance.now()-shown);
    const reviewState=Number(r.wrong||0)===0?"首次学习":isPending(r)?"待巩固":"已重新巩固";
    $("gf-feedback").innerHTML=`<div class="gf-result ${ok?"good":"bad"}"><div class="gf-result-title">${ok?"回答正确":"回答错误"} · ${esc(w.word)}</div><div class="gf-result-meaning">${esc(meaning(w))}</div><div class="gf-note-list">${notesHTML(w)}</div><div class="gf-result-foot">累计选错 ${Number(r.wrong||0)} 次 · ${reviewState} · ${retry?"这道词还需要再答对 "+(item.need||2)+" 次；稍后会重新出现。":"下次复习："+dateLabel(r.due)+" · 用时 "+elapsed+" ms"}</div><button class="primary" id="gf-next">下一题</button></div>`;
    $("gf-next").onclick=()=>{session.queue.shift();if(retry){session.queue.splice(Math.min(3,session.queue.length),0,w);session.currentItem=item;}else session.currentItem=null;session.answered=false;speak(w.word,true);nextQuestion();};
    renderChapters();
  }
  function renderSearch(){
    const q=norm($("gf-search").value),root=$("gf-search-results");if(!q){root.hidden=true;root.innerHTML="";return;}
    const hits=words.filter(w=>norm([w.word,meaning(w),w.example,w.memory,w.derivatives,w.synonyms,w.antonyms,w.rawNote].join(" ")).includes(q)).slice(0,80);
    root.hidden=false;root.innerHTML=`<div class="gf-section-title"><div><h3>搜索结果</h3><p>匹配 ${hits.length}${hits.length===80?"（最多显示 80 条）":""} 条</p></div></div><div class="gf-word-list">${hits.map(w=>`<details class="gf-word-row"><summary><strong>${esc(w.word)}</strong><span>${esc(meaning(w))}</span><small>${esc(sourceLabel(w))} · 已练 ${Number(rec(w.id).attempts||0)} 次 · 选错 ${Number(rec(w.id).wrong||0)} 次${isPending(rec(w.id))?" · 待巩固":""}</small></summary><div class="gf-note-list">${notesHTML(w)}</div><button class="ghost" data-gf-speak="${esc(w.word)}">朗读单词</button></details>`).join("")||'<div class="gf-empty">没有找到匹配词条。</div>'}</div>`;
    root.querySelectorAll("[data-gf-speak]").forEach(b=>b.onclick=()=>speak(b.dataset.gfSpeak,true));
  }
  function exportBackup(){const blob=new Blob([JSON.stringify({app:"gre-foundation-words",version:1,exportedAt:new Date().toISOString(),state},null,2)],{type:"application/json"});const url=URL.createObjectURL(blob),a=document.createElement("a");a.href=url;a.download="gre-foundation-words-backup.json";a.click();URL.revokeObjectURL(url);}
  document.addEventListener("keydown",e=>{
    if(!$("view-foundation")?.classList.contains("active"))return;
    if(["input","textarea","select"].includes((e.target?.tagName||"").toLowerCase()))return;
    if(/^[1-4]$/.test(e.key)){const b=$("gf-session")?.querySelectorAll(".gf-option:not(:disabled)")?.[Number(e.key)-1];if(b){e.preventDefault();b.click();}}
    else if(e.key==="Enter")$("gf-next")?.click();
    else if(e.key==="Tab"&&session?.current){e.preventDefault();speak(session.current.word.word,true);}
  });
  async function init(){
    mount();if(!$("view-foundation"))return;
    try{await loadData();renderOverview();renderChapters();$("gf-session").innerHTML='<div class="gf-empty"><strong>地基词已就绪</strong><span>选择章节开始学习，或复习所有到期词。</span></div>';}
    catch(err){$("gf-session").innerHTML='<div class="gf-empty gf-error"><strong>地基词加载失败</strong><span>'+esc(err.message||err)+'</span><span>请确认 4 个 foundation-words-data-*.b64 文件与网页处于同一目录，并通过本地服务器或 HTTPS 打开。</span></div>';}
  }
  init();
})();