const assert=require('node:assert/strict');
const fs=require('node:fs');const vm=require('node:vm');
const core=require('../gre-word-labs-core.js');
const scope={window:{}};
vm.runInNewContext(fs.readFileSync(__dirname+'/../gre-word-labs-data.js','utf8'),scope);
const data=scope.window.GRE_WORD_LABS_DATA;
const entries=data.equivalence.filter(e=>!e.review);
const groups=data.lookalike;
let checkedEq=0,checkedLook=0;
const eqSummary={};
for(const e of entries){
 const q=core.makeEquivalenceQuestion(e,entries,()=>0.234);
 assert(q.answers.length>=1);assert(q.options.length>=6&&q.options.length<=8);
 assert(q.options.length===new Set(q.options.map(core.norm)).size);
 assert(q.answers.every(a=>q.options.includes(a)));
 assert(core.result(q,q.answers));
 assert(!core.result(q,[]));
 checkedEq++;
 eqSummary[q.answers.length]=(eqSummary[q.answers.length]||0)+1;
}
for(const g of groups){
 for(const e of g.entries.filter(e=>!e.review)){
  for(const mode of ['en-cn','cn-en']){
   const q=core.makeLookalikeQuestion(e,g,groups,mode,()=>0.237);
   assert(q.options.length>=2);
   assert(q.options.length===new Set(q.options.map(core.norm)).size);
   assert(q.answers.every(a=>q.options.includes(a)));
   assert(core.result(q,q.answers));checkedLook++;
  }
 }
}
const state={records:{}};
const q=core.makeEquivalenceQuestion(entries[0],entries,()=>0.32);
const incorrect=q.options.filter(v=>!q.answers.includes(v)).slice(0,1);
const start=Date.UTC(2026,10,9,4,0,0);
const first=core.recordAnswer(state,q.id,q,incorrect,start);
assert(!first.ok);assert.equal(first.rec.wrong,1);assert(first.rec.pending);
const second=core.recordAnswer(state,q.id,q,q.answers,start+60000);
assert(second.ok);assert(second.rec.pending);assert.equal(second.rec.correctStreak,1);
const third=core.recordAnswer(state,q.id,q,q.answers,start+120000);
assert(third.ok);assert(!third.rec.pending);assert.equal(third.rec.wrong,1);
assert(third.rec.due>start+120000);
const date=new Date(2026,10,9,12).getTime();
const dateKey=core.localDayKey(date);
assert.equal(core.goalPlan(797,0,5,dateKey,date).dailyNew,160);
assert.equal(core.goalPlan(797,0,10,dateKey,date).dailyNew,80);
assert.equal(core.goalPlan(150,0,15,dateKey,date).dailyNew,10);
assert.equal(core.goalPlan(150,0,30,dateKey,date).dailyNew,5);
assert.equal(core.goalPlan(772,25,5,dateKey,date).dailyNew,135);
const day2=new Date(2026,10,10,12).getTime();
assert.equal(core.goalPlan(637,0,5,dateKey,day2).dailyNew,160);
assert.equal(core.goalPlan(797,0,1,dateKey,date).dailyNew,797);
assert.equal(core.goalPlan(0,50,10,dateKey,date).dailyNew,0);
assert.equal(core.goalPlan(120,0,10,dateKey,new Date(2026,10,20,12).getTime()).dailyNew,120);
assert.equal(core.validStudyDays(3650),3650);
assert.equal(core.validStudyDays(0),1);
assert.equal(core.firstSeen(first.rec),start);
assert(core.isSameLocalDay(core.firstSeen(first.rec),start));
assert.equal(first.rec.wrong,1,'changing plan days must not reset wrong statistics');
console.log(JSON.stringify({allTests:'passed',equivalenceEntries:checkedEq,lookalikeQuestions:checkedLook,sourceGroups:groups.length,answerDistribution:eqSummary,studyPlan:'configurable for both modules (1–3650 days)'}));