/* Run with the declared jsdom development dependency installed. No browser process is required. */
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {JSDOM,VirtualConsole}=require('jsdom');
const B=require('../gre-900-data.js');
const C=require('../gre-900-core.js');
const T=require('../gre-900-text.js');
const root=path.resolve(__dirname,'..');
const errors=[];
function setup(stored,legacy=false){
 const vc=new VirtualConsole();vc.on('jsdomError',e=>{if(!/navigation|HTMLCanvasElement/.test(e.message))errors.push(e.message)});
 const html=legacy?fs.readFileSync(path.join(root,'index.html'),'utf8'):'<!doctype html><html><body><nav class="tabs"><button class="tab" data-view="quant">Quant</button></nav><section id="view-quant" class="view"></section></body></html>';
 const dom=new JSDOM(html,{url:'http://gre900.test/',runScripts:'outside-only',pretendToBeVisual:true,virtualConsole:vc});
 const w=dom.window;w.structuredClone=structuredClone;w.Blob=Blob;const downloads=[];
 let clock=1000,hidden=false;
 Object.defineProperty(w.performance,'now',{value:()=>clock});
 Object.defineProperty(w.document,'hidden',{get:()=>hidden});
 w.URL.createObjectURL=blob=>{downloads.push(blob);return 'blob:http://gre900.test/export'};w.URL.revokeObjectURL=()=>{};
 w.fetch=()=>{throw Error('Question practice must not fetch external content')};
 w.HTMLElement.prototype.scrollIntoView=()=>{};
 w.HTMLDialogElement.prototype.showModal=function(){this.open=true};
 w.HTMLDialogElement.prototype.close=function(){this.open=false;this.dispatchEvent(new w.Event('close'))};
 if(stored)w.localStorage.setItem(C.KEY,stored);
 if(legacy){
  w.eval(fs.readFileSync(path.join(root,'gre-data.js'),'utf8'));
  w.__GRE_DATA__.verbal=w.__GRE_DATA__.verbal.filter(q=>q.type==='Sentence Equivalence').slice(0,1);
  assert.equal(w.__GRE_DATA__.verbal.length,1,'legacy multi-select fixture exists');
  w.eval(fs.readFileSync(path.join(root,'gre-app.js'),'utf8'));
 }
 for(const name of ['gre-900-data.js','gre-900-text.js','gre-900-core.js','gre-900.js'])w.eval(fs.readFileSync(path.join(root,name),'utf8'));
 return {dom,w,d:w.document,downloads,advance:ms=>clock+=ms,hide:value=>{hidden=value;w.document.dispatchEvent(new w.Event('visibilitychange'))}};
}
function inputAnswer(t,q,answer){
 const {d,w}=t;
 if(q.kind==='numeric'||q.kind==='expression'){
  const el=d.getElementById('g900-number');el.value=Array.isArray(answer)?answer[0]:answer;el.dispatchEvent(new w.Event('input',{bubbles:true}));
 }else for(const a of answer)d.querySelector(`input[name="g900-answer"][value="${a}"]`).click();
}
function state(t){return JSON.parse(t.w.localStorage.getItem(C.KEY))}
function englishOnly(el,label){
 assert.ok(el,label+' exists');
 assert.doesNotMatch(el.textContent,/\p{Script=Han}/u,label+' visible content');
 for(const node of [el,...el.querySelectorAll('[aria-label],[title],[placeholder]')]){
  for(const attr of ['aria-label','title','placeholder'])if(node.hasAttribute(attr))assert.doesNotMatch(node.getAttribute(attr),/\p{Script=Han}/u,label+' '+attr);
 }
}
function englishAttempt(t){
 const view=t.d.getElementById('view-gre900');assert.equal(view.lang,'en');englishOnly(view,'answering view');
 assert.equal(t.d.querySelectorAll('.g900-solution,.g900-explanation').length,0,'no Chinese explanations before submission');
}
function openQuestion(t,index){
 const q=B.questions[index-1];t.d.getElementById('g900-home').click();
 t.d.querySelector('[data-difficulty="all"]').click();
 t.d.querySelector(`[data-start="${q.sectionId}"]`).click();
 const s=state(t).sessions[state(t).activeId];
 t.d.querySelector(`[data-jump="${s.questionIds.indexOf(q.id)}"]`).click();
 return q;
}
async function main(){
 let t=setup();t.d.querySelector('[data-view="gre900"]').click();
 assert.equal(t.d.querySelectorAll('.g900-chapter').length,45);
 t.d.querySelector('[data-difficulty="easy"]').click();assert.equal(t.d.querySelectorAll('.g900-chapter').length,3);
 t.d.querySelector('[data-start="original-01"]').click();
 assert.equal(t.d.querySelectorAll('.g900-answer-map button').length,20);
 assert.equal(t.d.getElementById('g900-answer-fields').disabled,false);
 t.d.getElementById('g900-submit').click();assert.equal(t.d.querySelectorAll('.g900-result').length,0);
 assert.match(t.d.getElementById('g900-alert').textContent,/20 questions are incomplete/);englishAttempt(t);
 assert.equal(t.d.getElementById('g900-pdf'),null,'no PDF upload needed');
 assert.ok(t.d.querySelector('#g900-question-text math mfrac'),'question1 fraction is semantic MathML');
 assert.equal(t.d.querySelectorAll('#view-gre900 canvas,#view-gre900 img,#view-gre900 iframe').length,0,'no screenshot display');
 inputAnswer(t,B.questions[0],['B']);t.d.getElementById('g900-next').click();
 assert.equal(t.d.querySelectorAll('.g900-solution').length,0);
 assert.equal(t.d.querySelector('.g900-attempt-header p').textContent.includes('Question 2 of 20'),true);englishAttempt(t);
 const saved=t.w.localStorage.getItem(C.KEY);t.dom.window.close();
 t=setup(saved);t.d.querySelector('[data-view="gre900"]').click();t.d.querySelector('[data-start="original-01"]').click();
 assert.equal(t.d.querySelector('.g900-attempt-header p').textContent.includes('Question 2 of 20'),true);englishAttempt(t);
 for(let i=1;i<20;i++){
  const q=B.questions[i];inputAnswer(t,q,q.answer);
  if(i<19)t.d.getElementById('g900-next').click();
  assert.equal(t.d.querySelectorAll('.g900-solution').length,0,'no solutions before submit');
  englishAttempt(t);
 }
 t.d.getElementById('g900-submit').click();
 assert.equal(t.d.querySelectorAll('.g900-result').length,0,'confirmation is still pre-submit');
 assert.equal(t.d.querySelector('dialog').lang,'en');englishOnly(t.d.querySelector('dialog'),'submission dialog');
 t.d.querySelector('dialog [data-cancel]').click();
 // A full synchronization took place while opening the dialog. Subsequent edits
 // must still change the live saved attempt, including after Escape/close.
 t.d.querySelector('[data-jump="0"]').click();inputAnswer(t,B.questions[0],['A']);
 assert.deepEqual(state(t).sessions[state(t).activeId].answers[B.questions[0].id],['A']);
 t.d.getElementById('g900-submit').click();t.d.querySelector('dialog').close();
 inputAnswer(t,B.questions[0],['B']);
 assert.deepEqual(state(t).sessions[state(t).activeId].answers[B.questions[0].id],['B']);
 t.d.getElementById('g900-submit').click();
 t.d.querySelector('dialog [data-confirm]').click();
 let s=state(t),attempt=s.sessions[s.activeId];
 assert.equal(attempt.status,'submitted');assert.equal(attempt.result.summary.correct,19);assert.equal(attempt.result.summary.scored,20);
 assert.equal(t.d.querySelectorAll('.g900-solution').length,20);
 assert.equal(t.d.getElementById('view-gre900').lang,'zh-CN');
 assert.match(t.d.querySelector('.g900-explanation').textContent,/\p{Script=Han}/u,'Chinese explanations after submission');
 t.d.querySelector('[data-show-question]').click();assert.ok(t.d.querySelector('.g900-review-question math'),'report can display the text question');
 assert.match(t.d.querySelector('.g900-metrics').textContent,/95\.0%/);
 t.d.getElementById('g900-report-download').click();
 const report=await t.downloads.at(-1).text();assert.match(report,/<math/);assert.match(report,/原题 20/);assert.ok(!/<img|<canvas|<script/.test(report),'export keeps text and vectors');
 const reason=t.d.querySelector('[data-reason="gre900:original-01:1"]');reason.value='读题或翻译';reason.dispatchEvent(new t.w.Event('change',{bubbles:true}));
 const note=t.d.querySelector('[data-note="gre900:original-01:1"]');note.value='<script>test</script> Keep the exponent';note.dispatchEvent(new t.w.Event('input',{bubbles:true}));
 assert.equal(state(t).notes['gre900:original-01:1'].reason,'读题或翻译');
 t.d.querySelector('[data-review="original-01"]').click();assert.equal(t.d.querySelectorAll('.g900-answer-map button').length,1);englishAttempt(t);
 assert.equal(t.d.getElementById('g900-alert').hidden,true,'old Chinese report notice cleared when starting review');
 const reviewId=state(t).activeId;
 t.d.getElementById('g900-pause').click();
 assert.match(t.d.querySelector('[data-start="original-01"]').textContent,/继续错题复习/);
 t.d.querySelector('[data-start="original-01"]').click();
 assert.equal(state(t).activeId,reviewId,'resume exact review instead of creating full chapter');
 assert.equal(t.d.querySelectorAll('.g900-answer-map button').length,1);
 const beforeTime=Object.values(state(t).sessions[reviewId].elapsed).reduce((a,b)=>a+b,0);
 t.advance(2000);t.hide(true);t.advance(3600000);t.hide(false);
 const afterTime=Object.values(state(t).sessions[reviewId].elapsed).reduce((a,b)=>a+b,0);
 assert.equal(afterTime-beforeTime,2000,'hidden hour contributes no study time');
 inputAnswer(t,B.questions[0],B.questions[0].answer);t.d.getElementById('g900-submit').click();t.d.querySelector('dialog [data-confirm]').click();
 s=C.validate(state(t),B);assert.equal(C.wrongIds(s,'original-01').length,0);assert.equal(C.summarize(C.firstRows(s,'original-01')).correct,19);
 t.d.getElementById('g900-home').click();assert.match(t.d.querySelector('.g900-panel').textContent,/首次整章作答：95\.0%/);
 t.d.querySelector('[data-difficulty="all"]').click();
 t.d.querySelector('[data-start="new-13"]').click();
 t.d.querySelector('[data-jump="18"]').click();
 assert.equal(t.d.getElementById('g900-number').placeholder,'Enter an algebraic expression','expression input hint must not reveal the answer');englishAttempt(t);
 assert.equal(t.d.querySelectorAll('.g900-solution').length,0);
 assert.equal(errors.length,0,errors.join('\n'));
 t.dom.window.close();
 // Include every question kind, chart notes, duplicate source labels and all difficulty groups.
 t=setup();t.d.querySelector('[data-view="gre900"]').click();
 for(const index of [1,43,90,341,652,659,663,708,715,725,799,816,855,897]){
  const q=openQuestion(t,index);englishAttempt(t);
  if(q.kind==='qc')assert.deepEqual([...t.d.querySelectorAll('.g900-choice-text')].map(el=>el.textContent),[
   'Quantity A is greater.','Quantity B is greater.','The two quantities are equal.','The relationship cannot be determined from the information given.'
  ]);
  t.d.getElementById('g900-flag').click();englishAttempt(t);
  t.d.getElementById('g900-skip').click();englishAttempt(t);
  assert.match(t.d.querySelector('.g900-status-line').textContent,/Left blank/);
 }
 const numeric=B.questions.find(q=>q.kind==='numeric'),algebra=B.questions.find(q=>q.kind==='expression');
 for(const q of [numeric,algebra]){
  openQuestion(t,q.globalIndex);inputAnswer(t,q,'not-an-answer');englishAttempt(t);
  assert.match(t.d.getElementById('g900-input-message').textContent,/Format not recognized/);
  inputAnswer(t,q,q.answer);englishAttempt(t);
  assert.match(t.d.getElementById('g900-input-message').textContent,/Answer saved/);
  assert.match(t.d.querySelector('.g900-answer-map .current').getAttribute('aria-label'),/answered/);
 }
 const noted=openQuestion(t,43),transcript=T.questions[42];
 assert.equal(t.d.querySelector('.g900-transcript-note p').textContent,transcript.transcriptionNoteEn);
 assert.doesNotMatch(t.d.getElementById('g900-question-text').textContent,/\p{Script=Han}/u);
 let draft=state(t).sessions[state(t).activeId];
 for(let i=0;i<draft.questionIds.length;i++){t.d.querySelector(`[data-jump="${i}"]`).click();t.d.getElementById('g900-skip').click()}
 t.d.getElementById('g900-submit').click();englishOnly(t.d.querySelector('dialog'),'submission dialog');t.d.querySelector('dialog [data-confirm]').click();
 t.d.querySelector(`[data-show-question="${noted.id}"]`).click();
 assert.equal(t.d.querySelector(`#g900-review-question-${noted.globalIndex} .g900-transcript-note p`).textContent,transcript.transcriptionNote,'Chinese source note returns only in review');
 assert.match(t.d.querySelector('.g900-explanation').textContent,/\p{Script=Han}/u);
 assert.equal(errors.length,0,errors.join('\n'));t.dom.window.close();
 t=setup(null,true);
 t.d.getElementById('startVerbalBtn').click();
 const beforeLegacy=t.w.localStorage.getItem('gre-prep-v1');
 let event=new t.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
 t.d.querySelector('[data-view="gre900"]').dispatchEvent(event);
 assert.equal(event.defaultPrevented,false,'900 tab Enter does not submit hidden Verbal');
 t.d.querySelector('[data-view="gre900"]').click();
 event=new t.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true});
 t.d.getElementById('g900-home').dispatchEvent(event);
 assert.equal(event.defaultPrevented,false);
 const button=t.d.createElement('button');let ownHandlerCalls=0;button.onkeydown=()=>ownHandlerCalls++;t.d.getElementById('g900-content').append(button);
 button.dispatchEvent(new t.w.KeyboardEvent('keydown',{key:'Enter',bubbles:true,cancelable:true}));
 assert.equal(ownHandlerCalls,1,'target keyboard handler still runs');
 assert.equal(t.w.localStorage.getItem('gre-prep-v1'),beforeLegacy,'hidden Verbal record untouched');
 assert.equal(errors.length,0,errors.join('\n'));
 t.dom.window.close();
 console.log(JSON.stringify({dom:'passed',checks:['45 chapters','source difficulty filter','practice starts without a PDF','native MathML fractions','no screenshot media','English answering view and aria labels','English QC choices and submission dialog','English numeric and algebra input feedback','English source notes before submission','Chinese explanations and original notes after submission','clear stale Chinese notices when reviewing','deferred grading','restore active position','cancel/escape then edit before submission','20-item full submission','95% score','notes/reasons','resume exact review attempt','no background time','wrong-only retry','first attempt preserved','legacy Verbal keyboard isolation','no answer in expression input hint'],errors}));
}
main().catch(e=>{console.error(e);process.exit(1)});
