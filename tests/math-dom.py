"""Offline DOM component smoke checks.
Requires Playwright and Chromium. This test uses an in-memory localStorage adapter
and a legacy-navigation fixture; it does not test real PDF.js / IndexedDB / CDN.
The mathematical rendering gate is bypassed ONLY inside the test to check form events.
"""
from playwright.sync_api import sync_playwright
from pathlib import Path
import re,json
ROOT=Path(__file__).resolve().parents[1]
html=ROOT.joinpath('index.html').read_text()
html=re.sub(r'<script[\s\S]*?</script>','',html)
html=re.sub(r'<link[^>]+>','',html)
legacy="""document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+b.dataset.view));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));});"""
style="""body{font:15px system-ui;background:#f5f6fb;color:#24314d;margin:0}.shell{max-width:1100px;margin:30px auto;padding:0 16px}.view{display:none}.view.active{display:block}.tabs{display:flex;gap:6px;flex-wrap:wrap}.tab{padding:10px;border:1px solid #ddd;border-radius:8px;background:white}.tab.active{background:#ebe8fa}.exam-strip{display:flex;gap:18px}.exam-strip article{display:flex;flex-direction:column}.hero,.section-head{display:flex;justify-content:space-between}.toast{display:none}.toast.show{display:block;position:fixed;bottom:20px;left:20px;right:20px;max-width:650px;background:#24314d;color:white;padding:15px;border-radius:10px;pointer-events:none}.panel{margin:15px 0}.kicker{color:#7163aa;font-size:12px;letter-spacing:1px}@media(max-width:600px){.hero,.section-head{display:block}.exam-strip{flex-wrap:wrap}}"""
with sync_playwright() as p:
 b=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
 page=b.new_page(viewport={'width':1280,'height':1000});errors=[]
 page.on('pageerror',lambda e:errors.append(str(e)));page.on('dialog',lambda d:d.accept())
 def init(page,stored=None):
  page.set_content(html)
  page.add_style_tag(content=style+'\n'+ROOT.joinpath('gre-math-book.css').read_text())
  page.evaluate('''data=>{window.__store=new Map(Object.entries(data||{}));Object.defineProperty(window,'localStorage',{configurable:true,value:{getItem:k=>window.__store.get(k)||null,setItem:(k,v)=>window.__store.set(k,String(v)),removeItem:k=>window.__store.delete(k)}});}''',stored or {'gre-prep-v1':json.dumps({'sentinel':'keep'})})
  page.add_script_tag(content=legacy)
  for f in ['gre-math-bank.js','gre-math-core.js','gre-math-book.js']:page.add_script_tag(content=ROOT.joinpath(f).read_text())
 init(page)
 page.locator('[data-view=quant]').click();assert page.locator('#mb-chapter option').count()==33
 page.locator('[data-qid="math:1.1:1"]').click();assert page.locator('#mb-answer-fields').get_attribute('disabled') is not None
 assert '尚未导入' in page.locator('#mb-question-pages').inner_text()
 # The PDF rendering gate is explicitly bypassed ONLY inside this DOM test.
 page.locator('#mb-answer-fields').evaluate('(el)=>el.disabled=false')
 page.locator('input[name=mb-letter][value=B]').check()
 page.locator('#mb-answer-form button').click()
 assert '回答正确' in page.locator('#mb-feedback').inner_text()
 assert page.evaluate("JSON.parse(localStorage.getItem('gre-math-book-v1')).records['math:1.1:1'].correct")==1
 page.locator('#mb-next').click()
 page.locator('[data-view=settings]').click();page.locator('#mb-direction').select_option('en-cn');page.locator('#mb-word-new').fill('1');page.locator('#mb-math-new').fill('0');page.locator('#mb-save-settings').click()
 page.locator('[data-view=mathwords]').click();page.locator('#mb-word-status').select_option('pending');assert page.locator('.mb-word-entry').count()==8
 page.locator('#mb-word-status').select_option('all');page.locator('#mb-words [data-mb=plan-word]').click()
 assert page.locator('.mb-choice').count()==4;assert page.locator('#mb-word-library').is_hidden()
 for q in page.locator('.mb-choice').all():
  if q.inner_text().split(maxsplit=1)[-1]!='整数':q.click();break
 assert '本次答错' in page.locator('#mb-feedback').inner_text()
 page.evaluate("window.legacyKeyCount=0;document.addEventListener('keydown',()=>window.legacyKeyCount++)")
 page.locator('#mb-note').fill('<img src=x onerror=alert(1)>');page.locator('#mb-note').press('ArrowLeft');assert page.evaluate('window.legacyKeyCount')==0
 page.locator('#mb-note').fill('<img src=x onerror=alert(1)>');page.locator('#mb-reason').select_option(label='不熟悉词义');page.locator('#mb-save-note').click();page.locator('#mb-next').click()
 for q in page.locator('.mb-choice').all():
  if q.inner_text().split(maxsplit=1)[-1]=='整数':q.click();break
 assert '回答正确' in page.locator('#mb-feedback').inner_text()
 page.locator('#mb-next').click();assert page.locator('#mb-word-library').is_visible()
 page.locator('[data-view=wrongbook]').click();assert page.locator('#mb-wrong-list .mb-error').count()==1;assert page.locator('#mb-wrong-list img').count()==0;assert '<img' in page.locator('#mb-wrong-list').inner_text()
 saved=page.evaluate('Object.fromEntries(window.__store)');assert json.loads(saved['gre-prep-v1'])['sentinel']=='keep'
 p2=b.new_page(viewport={'width':390,'height':844});p2.on('pageerror',lambda e:errors.append(str(e)));init(p2,saved)
 p2.locator('[data-view=wrongbook]').click();assert p2.locator('#mb-wrong-list .mb-error').count()==1
 p2.locator('[data-view=quant]').click();p2.locator('#mb-chapter').select_option('4.1');assert p2.locator('#mb-catalog [data-qid]').count()==51
 assert p2.locator('#mb-book').bounding_box()['width']<=390
 p2.screenshot(path=str(ROOT/'tests'/'mobile-dom.png'),full_page=True)
 page.locator('[data-view=mathwords]').click();page.locator('#mb-word-search').fill('prime');page.screenshot(path=str(ROOT/'tests'/'words-dom.png'),full_page=True)
 assert not errors,errors
 print(json.dumps({'DOM_component_checks':'passed','old_key_unchanged':True,'wrong_retry_and_notes':True,'state_reinitialization':True,'mobile_width':390,'js_errors':errors,'storage':'explicit in-memory test adapter','PDF_engine':'not tested; localhost navigation blocked by environment'},ensure_ascii=False))
 b.close()
