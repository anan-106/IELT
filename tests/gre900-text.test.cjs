const test=require('node:test');
const assert=require('node:assert/strict');
const fs=require('node:fs');
const {JSDOM}=require('jsdom');
const B=require('../gre-900-data.js');
const T=require('../gre-900-text.js');
const S=require('../data/gre900-transcripts.json');
const {compileMarkup,compileEntry}=require('../scripts/build-gre900-text.cjs');
const get=i=>T.questions.find(q=>q.globalIndex===i);
test('900 text questions preserve IDs, source fingerprint, complete options and both comparison quantities',()=>{
 assert.equal(T.questions.length,900);assert.equal(new Set(T.questions.map(q=>q.id)).size,900);
 assert.equal(T.sourceSha256,B.source.sha256);assert.equal(S.questions.length,900);
 for(const q of B.questions){
  const t=get(q.globalIndex);assert.equal(t.id,q.id);assert.ok(t.stem.trim());
  assert.deepEqual(Object.keys(t.choices).sort(),(q.kind==='qc'?[]:q.options).slice().sort(),q.id);
  if(q.kind==='qc'){assert.ok(t.quantityA.trim(),q.id);assert.ok(t.quantityB.trim(),q.id)}
 }
});
test('question markup contains selectable text, native mathematics and vectors, with no page screenshots or external media',()=>{
 for(const t of T.questions){
  const html=[t.stem,t.quantityA,t.quantityB,t.figure,...Object.values(t.choices)].filter(Boolean).join('');
  const f=JSDOM.fragment(html);
  assert.equal(f.querySelectorAll('img,canvas,image,iframe,object,embed,script,style').length,0,t.id);
  assert.ok(!/data:image|pdfjs-dist|blob:|微信公众号|最新机经交流/.test(html),t.id);
  const ids=[...f.querySelectorAll('[id]')].map(el=>el.id);assert.equal(ids.length,new Set(ids).size,t.id+' duplicate vector IDs');
  for(const e of f.querySelectorAll('*'))for(const a of e.attributes){assert.ok(!/^on/i.test(a.name),t.id);if(a.name==='href')assert.ok(a.value.startsWith('#'),t.id)}
 }
});
test('all 900 answering texts and source disclosures are English; original review notes remain separate',()=>{
 assert.equal(T.answeringLanguage,'en');assert.equal(T.version,S.version);
 let notes=0;
 for(const t of T.questions){
  const raw=S.questions.find(q=>q.id===t.id);
  for(const field of ['stem','quantityA','quantityB','figure','figureAlt','transcriptionNoteEn']){
   if(t[field])assert.doesNotMatch(t[field],/\p{Script=Han}/u,`${t.id}.${field}`);
  }
  for(const [letter,html] of Object.entries(t.choices))assert.doesNotMatch(html,/\p{Script=Han}/u,`${t.id}.choices.${letter}`);
  if(raw.transcriptionNote){
   notes++;assert.ok(t.transcriptionNoteEn.trim(),t.id+' English disclosure');
   assert.equal(t.transcriptionNote,raw.transcriptionNote,t.id+' original review note');
   assert.equal(t.transcriptionNoteEn,raw.transcriptionNoteEn,t.id+' English disclosure unchanged');
  }
 }
 assert.equal(notes,65);
 const raw=S.questions[0],q=B.questions[0];
 assert.throws(()=>compileEntry({...raw,stem:'<p>中文题目</p>'},q),/answering content must be in English/);
 assert.throws(()=>compileEntry({...raw,stem:'<p>&#20013;&#25991;</p>'},q),/answering content must be in English/);
 assert.throws(()=>compileEntry({...raw,transcriptionNote:'中文说明'},q),/English transcription note is required/);
});
test('fraction/exponent transcriptions and original unusual choice letters are retained',()=>{
 const f=JSDOM.fragment(get(1).stem);assert.ok(f.querySelector('mfrac'));assert.ok(f.querySelector('msup'));assert.match(f.textContent,/−2|\^-?\{?-2/);
 assert.deepEqual(Object.keys(get(710).choices),['F','G','H','I','J']);
 assert.deepEqual(Object.keys(get(799).choices),['A','B','C','D','F']);
 for(const i of [725,816])assert.deepEqual(Object.keys(get(i).choices),['A','B','C','D','E'],'restore missing distractor A for '+i);
 assert.deepEqual(B.questions[724].answer,['E']);assert.deepEqual(B.questions[815].answer,['D']);
 for(const i of [90,228,532,652,843,854,855,861,866,897]){
  assert.equal(Object.keys(get(i).choices).length,5,'all five displayed choices for '+i);
  for(const v of Object.values(get(i).choices))assert.ok(v.replace(/<[^>]+>/g,'').trim()||v.includes('<svg'),'blank choice '+i);
 }
});
test('build rejects uncompiled formula syntax, external pictures and executable markup',()=>{
 assert.throws(()=>compileMarkup('<img src="page.png">','fixture'));
 assert.throws(()=>compileMarkup('<svg viewBox="0 0 10 10"><image href="data:image/png;base64,AA=="/></svg>','fixture'));
 assert.throws(()=>compileMarkup('<p onclick="alert(1)">test</p>','fixture'));
 assert.throws(()=>compileMarkup('\\(\\notARealCommand{1}\\)','fixture'));
 assert.throws(()=>compileMarkup('\\(x+1','fixture'));
});
test('the UI no longer depends on a PDF reader, upload, canvas render or source cache',()=>{
 const ui=fs.readFileSync(require.resolve('../gre-900.js'),'utf8');
 for(const token of ['pdfjs-dist','pageCanvas(','showPages(','indexedDB.open','g900-pdf','getContext("2d")','loadPdf('])assert.ok(!ui.includes(token),token);
 assert.ok(ui.includes('questionHtml(q)'));
});
