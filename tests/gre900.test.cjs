const test = require('node:test');
const assert = require('node:assert/strict');
const C = require('../gre-900-core.js');
const B = require('../gre-900-data.js');
const bank = {
  version:'test', sections:[{id:'s', questionCount:4}],
  questions:[
    {id:'q1',sectionId:'s',kind:'qc',options:['A','B','C','D'],answer:['A'],status:'verified',topic:'代数式与方程',difficulty:'easy'},
    {id:'q2',sectionId:'s',kind:'multi',options:['A','B','C','D','E','F','G'],answer:['A','C','G'],status:'verified',topic:'整数与数论',difficulty:'easy'},
    {id:'q3',sectionId:'s',kind:'numeric',answer:'1/4',status:'verified',topic:'比例与百分比',difficulty:'easy'},
    {id:'q4',sectionId:'s',kind:'single',options:['A','B','C','D','E'],answer:['C'],status:'ambiguous',reason:'source ambiguity',topic:'平面几何',difficulty:'easy'}
  ]
};
function draft(id='one', now=1000, mode='chapter', qs=bank.questions){return C.start(bank.sections[0],qs,{id,now,mode});}
function fill(s){for(const q of bank.questions)if(s.questionIds.includes(q.id))C.putAnswer(s,q,q.answer,1100);return s;}
function stateWith(s){const state=C.fresh();state.sessions[s.id]=s;state.activeId=s.id;return state;}
function copy(value){return JSON.parse(JSON.stringify(value));}

test('numeric entry compares fractions exactly, accepts prescribed percents and rejects invalid values',()=>{
  assert.equal(C.numericEqual('2/8','0.25'),true);
  assert.equal(C.numericEqual('0.3333333333','1/3'),false);
  assert.equal(C.numericEqual('25%','25',{unit:'percent'}),true);
  assert.equal(C.numericEqual('25%','0.25'),false);
  assert.equal(C.numericEqual('1,250','1250'),true);
  for(const x of ['1/0','Infinity','NaN','1,2','2abc','<img>','1//2'])assert.equal(C.normalize(bank.questions[2],x),null,x);
  assert.equal(C.numericEqual('0.25001','0.25'),false);
});
test('bounded numeric expression parser handles radicals without executing code',()=>{
  assert.equal(C.numericEqual('sqrt(108)','6*sqrt(3)'),true);
  assert.equal(C.numericEqual('6√3','6*sqrt(3)'),true);
  assert.equal(C.numericEqual('2π','2*pi'),true);
  assert.equal(C.numericEqual('10.3923','6*sqrt(3)'),false);
  assert.equal(C.numericValue('-2^2'),-4);
  for(const v of ['sqrt(-1)','1/(2-2)','globalThis.process.exit()','Math.sqrt(3)','2^999999','constructor(1)'])assert.equal(C.numericValue(v),null,v);
});
test('equivalent algebraic expressions use polynomial equality rather than sample evaluation',()=>{
  const q={variables:['s']};
  assert.equal(C.expressionEqual('3500+0.05(s-50000)','0.05*s+1000',q),true);
  assert.equal(C.expressionEqual('s/20+1000','0.05*s+1000',q),true);
  assert.equal(C.expressionEqual('(s+1)^2','s^2+2s+1',q),true);
  assert.equal(C.expressionEqual('0.05s+1001','0.05*s+1000',q),false);
  assert.equal(C.polynomial('1/(s-50000)','s'),null);
  assert.equal(C.polynomial('s.constructor()','s'),null);
});
test('single/QC reject extra letters; multi requires exactly the full set, order independent',()=>{
  assert.equal(C.grade(bank.questions[0],['A','B']),false);
  assert.equal(C.grade(bank.questions[1],['G','C','A']),true);
  assert.equal(C.grade(bank.questions[1],['A','C']),false);
  assert.equal(C.grade(bank.questions[1],['A','C','G','F']),false);
  assert.equal(C.grade(bank.questions[1],['A','C','Z']),false);
  assert.equal(C.grade({kind:'single',options:['F','G','H','I','J'],answer:['I'],status:'verified'},['I']),true);
});
test('drafts contain no grading results and incomplete chapters cannot be submitted',()=>{
  const s=draft();C.putAnswer(s,bank.questions[0],['B'],1100);
  assert.equal(s.result,null);assert.equal(s.status,'draft');
  assert.deepEqual(C.unanswered(s),['q2','q3','q4']);
  assert.throws(()=>C.submit(s,bank.questions,{now:2000}),/全部题目/);
  assert.equal(s.result,null);assert.equal(s.status,'draft');
});
test('whole-chapter submission counts blank answers as wrong and ambiguous items outside denominator',()=>{
  const s=fill(draft());C.markSkip(s,'q3',1200);
  const r=C.submit(s,bank.questions,{now:2000,bankVersion:'test'});
  assert.deepEqual(r.summary,{total:4,scored:3,correct:2,wrong:1,excluded:1,skipped:1,accuracy:2/3});
  assert.equal(r.rows[3].correct,null);
  assert.throws(()=>C.submit(s,bank.questions,{now:2100}),/重复/);
  assert.throws(()=>C.putAnswer(s,bank.questions[0],['B']),/不能修改/);
});
test('review updates latest per-question performance while preserving first chapter performance',()=>{
  const state=C.fresh(),s=fill(draft());C.putAnswer(s,bank.questions[0],['B'],1200);C.submit(s,bank.questions,{now:2000});state.sessions[s.id]=s;
  assert.deepEqual(C.wrongIds(state,'s'),['q1']);
  const retry=draft('retry',3000,'review',[bank.questions[0]]);C.putAnswer(retry,bank.questions[0],['A'],3100);C.submit(retry,bank.questions,{now:4000});state.sessions[retry.id]=retry;
  assert.deepEqual(C.wrongIds(state,'s'),[]);
  assert.equal(C.summarize(C.latestRows(state)).correct,3);
  assert.equal(C.summarize(C.firstRows(state)).correct,2);
  assert.equal(C.latestRows(state).length,4);
  assert.equal(C.completed(state,{mode:'chapter'}).length,1);
});
test('backup validation recomputes scores, preserves drafts and rejects malformed attempts',()=>{
  const raw=C.fresh(),s=fill(draft());C.submit(s,bank.questions,{now:2000});raw.sessions[s.id]=s;raw.activeId=s.id;
  s.result.summary.correct=999;s.result.rows[0].correct=false;
  const clean=C.validate(raw,bank);assert.equal(clean.sessions.one.result.summary.correct,3);
  raw.sessions.two=draft('two',3000);C.putAnswer(raw.sessions.two,bank.questions[0],['B'],3100);
  assert.deepEqual(C.validate(raw,bank).sessions.two.answers,{q1:['B']});
  const bad=JSON.parse(JSON.stringify(raw));bad.sessions.two.questionIds.pop();assert.throws(()=>C.validate(bad,bank),/完整/);
  const extra=JSON.parse(JSON.stringify(raw));extra.sessions.two.answers.q9=['A'];assert.throws(()=>C.validate(extra,bank),/不属于/);
  const invalid=JSON.parse(JSON.stringify(raw));invalid.sessions.two.answers.q1=['Z'];assert.throws(()=>C.validate(invalid,bank),/格式/);
});
test('merge is monotonic for submitted attempts and keeps newer notes',()=>{
  const a=C.fresh(),b=C.fresh();a.sessions.one=fill(draft());b.sessions.one=fill(draft());
  C.submit(a.sessions.one,bank.questions,{now:2000});C.putAnswer(b.sessions.one,bank.questions[0],['B'],3000);
  a.notes.q1={text:'a',reason:'计算失误',updatedAt:2000};b.notes.q1={text:'b',reason:'读题或翻译',updatedAt:3000};
  const result=C.merge(a,b);assert.equal(result.sessions.one.status,'submitted');assert.equal(result.notes.q1.text,'b');
  assert.deepEqual(result.sessions.one.answers.q1,['A']);
  assert.deepEqual(C.merge(b,a).sessions.one,result.sessions.one);
});
test('draft merge retains edits to different questions and does not mutate either tab',()=>{
  const a=stateWith(draft()),b=copy(a);
  C.putAnswer(a.sessions.one,bank.questions[0],['B'],2000);
  C.putAnswer(b.sessions.one,bank.questions[1],['A','C','G'],2100);
  C.markSkip(b.sessions.one,'q3',2200);
  const beforeA=copy(a),beforeB=copy(b),merged=C.merge(a,b);
  assert.deepEqual(merged.sessions.one.answers,{q1:['B'],q2:['A','C','G']});
  assert.deepEqual(merged.sessions.one.skipped,['q3']);
  assert.deepEqual(C.merge(b,a).sessions.one,merged.sessions.one);
  assert.deepEqual(a,beforeA);assert.deepEqual(b,beforeB);
  assert.deepEqual(C.validate(merged,bank).sessions.one,merged.sessions.one);
});
test('a timer tick after a storage event cannot overwrite a newer remote answer',()=>{
  const a=stateWith(fill(draft())),b=copy(a);
  C.putAnswer(b.sessions.one,bank.questions[0],['B'],2000);
  C.addTime(a.sessions.one,'q1',1000,2001);
  C.addTime(b.sessions.one,'q1',500,2000);
  const merged=C.merge(a,b).sessions.one;
  assert.deepEqual(merged.answers.q1,['B']);
  assert.equal(merged.answerUpdatedAt.q1,2000);
  assert.equal(merged.elapsed.q1,1000);
  assert.equal(merged.updatedAt,2001);
  assert.deepEqual(C.merge(b,a).sessions.one,merged);
  assert.equal(C.merge(stateWith(merged),a).sessions.one.elapsed.q1,1000);
});
test('clearing an answer keeps a tombstone through merge, validation and stale backup import',()=>{
  const stale=stateWith(fill(draft())),cleared=copy(stale);
  C.putAnswer(cleared.sessions.one,bank.questions[0],'',2000);
  C.addTime(stale.sessions.one,'q1',1000,3000);
  const merged=C.merge(stale,cleared);
  assert.equal(Object.hasOwn(merged.sessions.one.answers,'q1'),false);
  assert.equal(merged.sessions.one.answerUpdatedAt.q1,2000);
  assert.deepEqual(C.unanswered(merged.sessions.one),['q1']);
  const restored=C.validate(copy(merged),bank);
  assert.equal(Object.hasOwn(C.merge(restored,stale).sessions.one.answers,'q1'),false);
  assert.deepEqual(C.merge(cleared,stale).sessions.one,merged.sessions.one);
});
test('answer and explicit skip form one versioned state and cannot coexist after merge',()=>{
  const answered=stateWith(fill(draft())),skipped=copy(answered);
  C.markSkip(skipped.sessions.one,'q1',2000);
  C.addTime(answered.sessions.one,'q1',100,3000);
  const first=C.merge(answered,skipped);
  assert.equal(Object.hasOwn(first.sessions.one.answers,'q1'),false);
  assert.ok(first.sessions.one.skipped.includes('q1'));
  const replaced=copy(first);C.putAnswer(replaced.sessions.one,bank.questions[0],['B'],4000);
  const second=C.merge(first,replaced);
  assert.deepEqual(second.sessions.one.answers.q1,['B']);
  assert.equal(second.sessions.one.skipped.includes('q1'),false);
  C.submit(second.sessions.one,bank.questions,{now:5000});
  assert.equal(second.sessions.one.result.rows[0].correct,false);
});
test('flags and navigation merge independently from answers and elapsed time',()=>{
  const a=stateWith(draft()),b=copy(a);
  assert.equal(C.toggleFlag(a.sessions.one,'q1',2000),true);
  assert.equal(C.toggleFlag(b.sessions.one,'q2',2200),true);
  C.move(a.sessions.one,1,2100);C.move(b.sessions.one,3,2300);
  C.putAnswer(a.sessions.one,bank.questions[0],['B'],2400);
  C.addTime(a.sessions.one,'q1',8000,10000);
  const merged=C.merge(a,b);
  assert.deepEqual(merged.sessions.one.flagged,['q1','q2']);
  assert.equal(merged.sessions.one.index,3);
  assert.equal(merged.sessions.one.positionUpdatedAt,2300);
  assert.deepEqual(merged.sessions.one.answers.q1,['B']);
  assert.deepEqual(C.merge(b,a).sessions.one,merged.sessions.one);
  const unflagged=copy(merged);assert.equal(C.toggleFlag(unflagged.sessions.one,'q1',11000),false);
  C.addTime(merged.sessions.one,'q1',100,12000);
  assert.deepEqual(C.merge(merged,unflagged).sessions.one.flagged,['q2']);
});
test('same-millisecond edits remain ordered and concurrent conflicts converge',()=>{
  const s=draft();C.putAnswer(s,bank.questions[0],['A'],2000);C.putAnswer(s,bank.questions[0],'',2000);
  assert.equal(s.answerUpdatedAt.q1,2001);assert.equal(s.updatedAt,2001);
  const a=stateWith(draft()),b=copy(a);
  C.putAnswer(a.sessions.one,bank.questions[0],['B'],2000);
  C.putAnswer(b.sessions.one,bank.questions[0],'',2000);
  C.toggleFlag(a.sessions.one,'q2',2000);C.toggleFlag(b.sessions.one,'q2',1999);C.toggleFlag(b.sessions.one,'q2',2000);
  C.move(a.sessions.one,1,2000);C.move(b.sessions.one,2,2000);
  assert.deepEqual(C.merge(a,b).sessions.one,C.merge(b,a).sessions.one);
  assert.equal(Object.hasOwn(C.merge(a,b).sessions.one.answers,'q1'),false);
  assert.deepEqual(C.merge(a,b).sessions.one.flagged,[]);
});
test('legacy backups migrate edit clocks once, before later timer activity',()=>{
  const legacy=stateWith(fill(draft()));legacy.sessions.one.index=2;
  for(const key of ['answerUpdatedAt','flagUpdatedAt','positionUpdatedAt'])delete legacy.sessions.one[key];
  const migrated=C.validate(legacy,bank);
  assert.equal(migrated.sessions.one.answerUpdatedAt.q1,1100);
  assert.equal(migrated.sessions.one.flagUpdatedAt.q1,1100);
  assert.equal(migrated.sessions.one.positionUpdatedAt,1100);
  assert.equal(migrated.sessions.one.index,2);
  const remote=copy(migrated);C.putAnswer(remote.sessions.one,bank.questions[0],['B'],2000);
  C.addTime(migrated.sessions.one,'q1',1000,3000);
  assert.deepEqual(C.merge(migrated,remote).sessions.one.answers.q1,['B']);
  C.addTime(legacy.sessions.one,'q1',1000,4000);
  assert.equal(legacy.sessions.one.answerUpdatedAt.q1,1100);
  assert.deepEqual(C.merge(legacy,remote).sessions.one.answers.q1,['B']);
});
test('validation rejects invalid edit clocks and mutations keep submitted attempts locked',()=>{
  const state=stateWith(fill(draft()));
  for(const mutate of [
    s=>s.answerUpdatedAt.q9=1100,
    s=>s.answerUpdatedAt.q1=900,
    s=>s.answerUpdatedAt.q1=1200,
    s=>s.flagUpdatedAt=null,
    s=>s.positionUpdatedAt=1200
  ]){const bad=copy(state);mutate(bad.sessions.one);assert.throws(()=>C.validate(bad,bank),/时间/);}
  assert.throws(()=>C.move(state.sessions.one,-1,1200),/切换/);
  assert.throws(()=>C.toggleFlag(state.sessions.one,'missing',1200),/标记/);
  C.submit(state.sessions.one,bank.questions,{now:2000});
  const submitted=copy(state.sessions.one);
  assert.throws(()=>C.move(state.sessions.one,1,3000),/切换/);
  assert.throws(()=>C.toggleFlag(state.sessions.one,'q1',3000),/标记/);
  C.addTime(state.sessions.one,'q1',1000,3000);
  assert.deepEqual(state.sessions.one,submitted);
});
test('time accounting caps suspended-tab gaps instead of charging overnight time',()=>{
  const s=draft();C.addTime(s,'q1',2000,3000);C.addTime(s,'q1',36000000,4000);assert.equal(s.elapsed.q1,62000);
  C.addTime(s,'missing',50,5000);assert.equal(s.elapsed.missing,undefined);
});
test('bank has exactly900 distinct questions in45 source chapters and source difficulty partition',()=>{
  assert.equal(B.questions.length,900);assert.equal(B.sections.length,45);assert.equal(new Set(B.questions.map(q=>q.id)).size,900);
  assert.equal(B.questions.filter(q=>q.status==='verified').length,892);
  assert.equal(B.questions.filter(q=>q.status==='ambiguous').length,8);
  assert.equal(B.questions.filter(q=>q.status==='pending').length,0,'all900 explanations assembled');
  assert.deepEqual(Object.fromEntries(['easy','medium','hard','data'].map(k=>[k,B.questions.filter(q=>q.difficulty===k).length])),{easy:60,medium:240,hard:540,data:60});
  assert.equal(B.sections.find(s=>s.id==='original-19').questionCount,21);
  assert.equal(B.sections.find(s=>s.id==='original-20').questionCount,19);
  for(const section of B.sections)assert.equal(B.questions.filter(q=>q.sectionId===section.id).length,section.questionCount);
});
test('source references preserve shared diagrams and corrected duplicate numbering',()=>{
  const get=i=>B.questions.find(q=>q.globalIndex===i);
  assert.ok(get(400).sourcePages.includes(108));
  for(const i of [411,412,413])assert.ok(get(i).sourcePages.includes(111));
  for(const [i,p]of [[540,142],[575,151],[576,151],[596,156]])assert.ok(get(i).sourcePages.includes(p));
  for(const i of [90,228,532,843,854,855,861,866,897])assert.ok(get(i).optionHint);
  assert.match(get(299).explanation,/108/);assert.match(get(299).explanation,/150/);
  assert.equal(get(799).computedAnswer,'280');
  const q=B.questions.find(q=>q.sectionId==='new-16'&&q.sourceNumber===15);assert.equal(q.printedNumber,14);
  for(const item of B.questions)assert.ok(item.sourcePages.length&&item.sourcePages.every(p=>p>=5&&p<=229));
});
test('every completed independent solution can grade its own answer and includes an explanation',()=>{
  for(const q of B.questions.filter(q=>q.status==='verified')){
    assert.ok(q.explanation.trim().length>8,`${q.id} explanation`);
    assert.equal(C.grade(q,q.answer),true,`${q.id}: ${JSON.stringify(q.answer)} (${q.kind})`);
  }
  for(const q of B.questions.filter(q=>q.status==='ambiguous'))assert.equal(C.grade(q,q.answer),null,q.id);
});
