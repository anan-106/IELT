/* GRE word labs: dependency-free model and grading helpers; works offline. */
(function(root){
  'use strict';
  const INTERVALS=[1,3,7,14,30];
  const norm=v=>String(v??'').trim().toLowerCase().replace(/[’‘]/g,"'").replace(/\s+/g,' ');
  const orderedUnique=xs=>[...new Set(xs.filter(x=>String(x||'').trim()))];
  const shuffle=(xs,rnd=Math.random)=>{const a=[...xs];for(let i=a.length-1;i>0;i--){const j=Math.floor(rnd()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;};
  const startOfDay=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime();};
  const plusDays=(t,n)=>{const d=new Date(t);d.setHours(0,0,0,0);d.setDate(d.getDate()+n);return d.getTime();};
  const localDayKey=t=>{const d=new Date(t);return `${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;};
  const dayOrdinal=t=>{const d=new Date(t);return Math.round(Date.UTC(d.getFullYear(),d.getMonth(),d.getDate())/86400000);};
  const isSameLocalDay=(a,b)=>Boolean(a&&b)&&localDayKey(a)===localDayKey(b);
  const firstSeen=r=>Number(r?.firstSeenAt||r?.history?.[0]?.at||0);
  const validStudyDays=days=>Math.max(1,Math.min(3650,Number.isFinite(Number(days))?Math.round(Number(days)):5));
  // This targets new material ONLY. Due reviews and error-recovery keep their own scheduling.
  function goalPlan(unfinished,todayFinished,studyDays,studyStart,now=Date.now()){
    const days=validStudyDays(studyDays);
    const parsed=typeof studyStart==='string'?new Date(`${studyStart}T00:00:00`):new Date(studyStart);
    const start=Number.isFinite(parsed.getTime())?parsed:new Date(now);
    const elapsed=Math.max(0,dayOrdinal(now)-dayOrdinal(start));
    const remainingDays=Math.max(1,days-elapsed);
    const unlearned=Math.max(0,Math.floor(Number(unfinished)||0));
    const finishedToday=Math.max(0,Math.floor(Number(todayFinished)||0));
    const dailyNew=Math.max(0,Math.ceil((unlearned+finishedToday)/remainingDays)-finishedToday);
    const finish=new Date(start);finish.setDate(finish.getDate()+days-1);
    return {days,dayNo:Math.min(days,elapsed+1),remainingDays,unlearned,todayFinished:finishedToday,
      dailyNew,finishDate:localDayKey(finish.getTime()),isOverdue:elapsed>=days};
  }

  const emptyRecord=()=>({attempts:0,correct:0,wrong:0,stage:-1,due:0,correctStreak:0,pending:false,last:0,lastWrongAt:0,lastWrongChoices:[],confusions:{},history:[]});
  const getRecord=(state,id)=>state.records[id]||(state.records[id]=emptyRecord());
  const isWrong=r=>r&&((r.wrong||0)>0);
  const isPending=r=>r&&Boolean(r.pending||(r.wrong>0&&r.pending==null));
  const result=(question,chosen)=>{
    const wanted=orderedUnique(question.answers.map(norm)).sort();
    const actual=orderedUnique(chosen.map(norm)).sort();
    return wanted.length===actual.length&&wanted.every((w,i)=>w===actual[i]);
  };
  const normalizedChinese=t=>norm(t).replace(/[，,、；;。\s]/g,'').replace(/（[^）]*）/g,'');
  function similarChinese(a,b){
    let x=normalizedChinese(a),y=normalizedChinese(b);
    return x===y || (x.length>=2&&y.length>=2&&(x.includes(y)||y.includes(x)));
  }
  function makeEquivalenceQuestion(entry,entries,rng=Math.random){
    if(entry.review)throw new Error('待核对的源词组不参与自动判分');
    let answers=orderedUnique(entry.syn.map(x=>x.trim())).filter(Boolean);
    const excluded=new Set([norm(entry.head),...answers.map(norm)]);
    // Exclude linked synonyms and same-gloss source rows (including reverse links).
    const family=new Set(excluded);
    for(const x of entries){
      const terms=[x.head,...x.syn].map(norm);
      if(terms.some(t=>excluded.has(t))||normalizedChinese(x.cn)===normalizedChinese(entry.cn)){
        terms.forEach(t=>family.add(t));
      }
    }
    const candidates=orderedUnique(entries.filter(e=>!e.review && !similarChinese(e.cn,entry.cn))
       .map(e=>e.head)).filter(w=>!family.has(norm(w))&&/^[a-z][a-z '\-]+$/i.test(w));
    const count=Math.max(6,Math.min(8,answers.length+3));
    const distractors=shuffle(candidates,rng).slice(0,count-answers.length);
    if(distractors.length<count-answers.length)throw new Error('可用干扰选项不足');
    return {id:entry.id,kind:'equivalence',prompt:entry.head,gloss:entry.cn,
      answers,options:shuffle([...answers,...distractors],rng),sourcePage:entry.page};
  }
  function makeLookalikeQuestion(target,group,groups,mode='mixed',rng=Math.random){
    if(target.review)throw new Error('待核对的形近词不自动判分');
    let direction=mode==='mixed'?(rng()<0.5?'cn-en':'en-cn'):mode;
    const selected=group.entries.filter(x=>!x.review);
    const global=groups.flatMap(g=>g.entries).filter(x=>!x.review);
    if(direction==='cn-en'){
      const answers=orderedUnique(selected.filter(x=>similarChinese(x.cn,target.cn)).map(x=>x.word));
      const other=selected.filter(x=>!answers.map(norm).includes(norm(x.word))).map(x=>x.word);
      // Keep the look-alike group prominent; fill small groups with unrelated words.
      const filler=shuffle(global.filter(x=>x.id!==target.id && !similarChinese(x.cn,target.cn)).map(x=>x.word),rng)
        .filter(w=>!answers.map(norm).includes(norm(w))&&!other.map(norm).includes(norm(w)));
      const needed=Math.max(4,selected.length);
      const rest=orderedUnique([...other,...filler]).slice(0,Math.max(0,needed-answers.length));
      const options=shuffle([...answers,...rest],rng);
      return {id:target.id,groupId:group.id,kind:'lookalike',direction,prompt:target.cn,
        answers,options,groupWords:group.entries,sourcePage:group.page};
    }
    const candidate=[...selected.filter(x=>x.id!==target.id),...shuffle(global,rng)]
      .filter(x=>!similarChinese(x.cn,target.cn));
    const options=[target.cn];
    for(const c of candidate){
      if(options.length>=4)break;
      if(options.some(o=>similarChinese(o,c.cn)))continue;
      options.push(c.cn);
    }
    if(options.length<4)throw new Error('有效的中文释义干扰项不足');
    return {id:target.id,groupId:group.id,kind:'lookalike',direction,prompt:target.word,
      answers:[target.cn],options:shuffle(options,rng),groupWords:group.entries,sourcePage:group.page};
  }
  function recordAnswer(state,id,question,selected,now=Date.now()){
    const rec=getRecord(state,id),ok=result(question,selected);
    if(!rec.attempts)rec.firstSeenAt=now;
    rec.attempts++;rec.last=now;rec.history=Array.isArray(rec.history)?rec.history:[];
    rec.history.push({at:now,ok,selected:[...selected],answers:[...question.answers],direction:question.direction||'multi'});
    if(rec.history.length>50)rec.history=rec.history.slice(-50);
    if(ok){
      rec.correct++;
      if(isPending(rec)){
        rec.correctStreak=(rec.correctStreak||0)+1;
        if(rec.correctStreak>=2){rec.pending=false;rec.correctStreak=0;rec.stage=0;rec.due=plusDays(now,INTERVALS[0]);}
        else rec.due=now+10*60*1000;
      }else{
        rec.stage=Math.min(INTERVALS.length-1,(rec.stage??-1)+1);
        rec.due=plusDays(now,INTERVALS[rec.stage]);
      }
    }else{
      rec.wrong++;rec.pending=true;rec.correctStreak=0;rec.stage=0;
      rec.lastWrongAt=now;rec.lastWrongChoices=[...selected];rec.due=now+10*60*1000;
      rec.confusions=rec.confusions&&typeof rec.confusions==='object'?rec.confusions:{};
      const target=new Set(question.answers.map(norm));
      for(const choice of selected){if(!target.has(norm(choice)))rec.confusions[choice]=(rec.confusions[choice]||0)+1;}
      for(const choice of question.answers){if(!selected.map(norm).includes(norm(choice)))rec.confusions['遗漏: '+choice]=(rec.confusions['遗漏: '+choice]||0)+1;}
    }
    return {ok,rec};
  }
  const summary=(entries,state)=>entries.reduce((s,e)=>{
    const r=state.records[e.id];
    if(r?.attempts)s.learned++;
    if(r?.wrong)s.everWrong++;
    if(isPending(r))s.pending++;
    if(r?.attempts&&r.due<=Date.now())s.due++;
    s.totalWrong+=(r?.wrong||0);
    return s;
  },{learned:0,everWrong:0,pending:0,due:0,totalWrong:0});
  const api={norm,orderedUnique,shuffle,startOfDay,plusDays,emptyRecord,getRecord,isWrong,isPending,similarChinese,
    makeEquivalenceQuestion,makeLookalikeQuestion,result,recordAnswer,summary,INTERVALS,
    localDayKey,isSameLocalDay,firstSeen,validStudyDays,goalPlan};
  root.GREWordLabsCore=api;
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
})(typeof window!=='undefined'?window:globalThis);