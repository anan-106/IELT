/* Build portable MathML question content. No renderer or network is needed at run time. */
const fs = require('node:fs');
const path = require('node:path');
const assert = require('node:assert/strict');
const katex = require('katex');
const { JSDOM } = require('jsdom');
const root = path.resolve(__dirname, '..');
const bank = require(path.join(root, 'gre-900-data.js'));
const sourcePath = path.join(root, 'data/gre900-transcripts.json');
const outputPath = path.join(root, 'gre-900-text.js');
const allowed = new Set(('p div span br b strong i em u sup sub ul ol li table thead tbody tfoot tr th td caption colgroup col h3 h4 h5 figure figcaption blockquote hr small svg g defs marker pattern clipPath mask line rect circle ellipse polygon polyline path text tspan title desc use math semantics annotation mrow mi mn mo mtext mfrac msqrt mroot msup msub msubsup mspace mtable mtr mtd mstyle menclose mover munder munderover mpadded mphantom').toLowerCase().split(' '));
function compileMarkup(raw, location) {
  assert.equal(typeof raw, 'string', `${location}: expected markup string`);
  assert.ok(!/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/.test(raw), `${location}: illegal control character`);
  let formulas = 0;
  let markup = raw.replace(/\\\[([\s\S]*?)\\\]|\\\(([\s\S]*?)\\\)/g, (_, display, inline) => {
    formulas++;
    const tex=(display ?? inline).replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&').replace(/&quot;/g,'"').replace(/&#39;/g,"'");
    return katex.renderToString(tex, { output:'mathml', displayMode:display!==undefined, throwOnError:true, trust:false, strict:'error', maxExpand:200 });
  });
  assert.ok(!/\\[()[\]]/.test(markup.replace(/<annotation[\s\S]*?<\/annotation>/g,'')), `${location}: unmatched math delimiter`);
  const fragment = JSDOM.fragment(markup);
  for (const el of fragment.querySelectorAll('*')) {
    assert.ok(allowed.has(el.localName.toLowerCase()), `${location}: forbidden or malformed element <${el.localName}>`);
    for (const a of el.attributes) {
      assert.ok(!/^on/i.test(a.name), `${location}: event attribute`);
      assert.ok(!/^(src|srcset)$/i.test(a.name), `${location}: raster/external media`);
      if (/^(?:xlink:)?href$/i.test(a.name)) assert.ok(/^#[\w:.-]+$/.test(a.value), `${location}: external reference`);
      assert.ok(!/javascript:|data:image|expression\s*\(|@import|url\(\s*['"]?(?:https?:|data:|\/\/)/i.test(a.value), `${location}: executable or remote content`);
    }
    assert.ok(!(el.localName==='math'&&el.closest('svg')), `${location}: MathML must be outside the SVG diagram`);
    if(el.localName==='svg') {
      assert.ok(el.hasAttribute('viewBox'), `${location}: SVG needs a scalable viewBox`);
      el.setAttribute('role','img');
    }
  }
  for(const table of fragment.querySelectorAll('table')) { const wrap=fragment.ownerDocument.createElement('div');wrap.className='g900-data-table';table.replaceWith(wrap);wrap.append(table); }
  const box = fragment.ownerDocument.createElement('div'); box.append(fragment);
  return {html:box.innerHTML,formulas};
}
function compileEntry(raw, q) {
  assert.equal(raw.id,q.id,`${q.globalIndex}: id mismatch`);
  assert.equal(raw.globalIndex,q.globalIndex,`${q.id}: index mismatch`);
  assert.ok(typeof raw.stem==='string'&&(raw.stem.trim()||q.kind==='qc'),`${q.id}: missing stem`);
  assert.ok(raw.choices&&typeof raw.choices==='object'&&!Array.isArray(raw.choices),`${q.id}: missing choices`);
  const want = q.kind==='qc'?[]:q.options;
  assert.deepEqual(Object.keys(raw.choices).sort(),want.slice().sort(),`${q.id}: choice labels differ from grading bank`);
  if(q.kind==='qc') for(const key of ['quantityA','quantityB']) assert.ok(raw[key]?.trim(),`${q.id}: missing ${key}`);
  const out={id:q.id,globalIndex:q.globalIndex,choices:{}};
  if(!raw.stem.trim())out.stem='<p>Compare Quantity A and Quantity B.</p>';
  let formulas=0;
  for(const key of ['stem','quantityA','quantityB','figure']) if(raw[key]) {
    const c=compileMarkup(raw[key],`${q.id}.${key}`);out[key]=c.html;formulas+=c.formulas;
  }
  for(const [letter,html] of Object.entries(raw.choices)) {
    assert.ok(html.trim(),`${q.id}: blank option ${letter}`);
    const c=compileMarkup(html,`${q.id}.choices.${letter}`);out.choices[letter]=c.html;formulas+=c.formulas;
  }
  for(const key of ['figureAlt','transcriptionNote'])if(raw[key])out[key]=raw[key];
  // All IDs belong to one question, so opening many report rows cannot cross-reference another diagram.
  for(const [key,value] of Object.entries(out))if(typeof value==='string'&&key!=='id')out[key]=value.replace(/\bid="([^\"]+)"/g,`id="g900q${q.globalIndex}-$1"`).replace(/\b(?:href|xlink:href)="#([^\"]+)"/g,`href="#g900q${q.globalIndex}-$1"`).replace(/url\(#([^\)]+)\)/g,`url(#g900q${q.globalIndex}-$1)`);
  for(const letter of Object.keys(out.choices)) out.choices[letter]=out.choices[letter].replace(/\bid="([^\"]+)"/g,`id="g900q${q.globalIndex}${letter}-$1"`).replace(/\b(?:href|xlink:href)="#([^\"]+)"/g,`href="#g900q${q.globalIndex}${letter}-$1"`).replace(/url\(#([^\)]+)\)/g,`url(#g900q${q.globalIndex}${letter}-$1)`);
  return {entry:out,formulas};
}
function build({check=false}={}) {
  const raw=JSON.parse(fs.readFileSync(sourcePath,'utf8'));
  assert.equal(raw.sourceSha256,bank.source.sha256,'source fingerprint changed');
  assert.equal(raw.questions.length,900,'all 900 transcripts are required');
  const byId=new Map(raw.questions.map(q=>[q.id,q]));assert.equal(byId.size,900,'duplicate transcript');
  let formulas=0;
  const questions=bank.questions.map(q=>{const r=byId.get(q.id);assert.ok(r,`missing ${q.id}`);const c=compileEntry(r,q);formulas+=c.formulas;return c.entry;});
  const data={version:'2026-11-18.text.1',sourceSha256:bank.source.sha256,format:'html-mathml-svg',questions};
  const text='/* Reflowable source questions: HTML text, native MathML, and independently redrawn SVG. */\n(function(root){const data='+JSON.stringify(data)+';if(typeof module!=="undefined"&&module.exports)module.exports=data;else root.GRE900Text=data;})(typeof window!=="undefined"?window:globalThis);\n';
  if(check)assert.equal(fs.readFileSync(outputPath,'utf8'),text,'generated content is stale');else fs.writeFileSync(outputPath,text);
  const stats={questions:questions.length,formulas,questionsWithSvg:questions.filter(q=>JSON.stringify(q).includes('<svg')).length,questionsWithTables:questions.filter(q=>JSON.stringify(q).includes('<table')).length,outputBytes:Buffer.byteLength(text),mode:check?'verified':'built'};
  console.log(JSON.stringify(stats));return stats;
}
module.exports={compileMarkup,compileEntry,build};
if(require.main===module)build({check:process.argv.includes('--check')});
