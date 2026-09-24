"""Component smoke test. Uses legacy navigation fixture and a PDF.js test double.
Run a local server in the repository, then: python tests/browser_smoke.py
This does NOT assert live CDN/PDF.js compatibility or production deployment.
"""
from pathlib import Path
from playwright.sync_api import sync_playwright
import json, os
ROOT=Path(__file__).resolve().parents[1]
URL=os.environ.get('MATH_TEST_URL','http://127.0.0.1:8765')
SOURCE=Path(os.environ.get('MATH_TEST_PDF','/mnt/data/张巍GRE数学满分宝典.pdf'))
LEGACY='''document.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{document.querySelectorAll('.view').forEach(v=>v.classList.toggle('active',v.id==='view-'+b.dataset.view));document.querySelectorAll('.tab').forEach(t=>t.classList.toggle('active',t===b));});'''
STYLE='''body{font:15px system-ui;background:#f5f6fb;color:#24314d;margin:0}.shell{max-width:1100px;margin:30px auto;padding:0 16px}.view{display:none}.view.active{display:block}.tabs{display:flex;gap:6px;flex-wrap:wrap}.tab{padding:10px;border:1px solid #ddd;border-radius:8px;background:white}.tab.active{background:#ebe8fa}.exam-strip{display:flex;gap:18px}.exam-strip article{display:flex;flex-direction:column}.hero,.section-head{display:flex;justify-content:space-between}.toast{display:none}.toast.show{display:block;position:fixed;bottom:20px;left:20px;right:20px;max-width:650px;background:#24314d;color:white;padding:15px;border-radius:10px;pointer-events:none}.panel{margin:15px 0}.kicker{color:#7163aa;font-size:12px;letter-spacing:1px}@media(max-width:600px){.hero,.section-head{display:block}.exam-strip{flex-wrap:wrap}}'''
SDK='''export const GlobalWorkerOptions={};export function getDocument({data}){window.__pdfByteLength=data.byteLength;return {promise:Promise.resolve({numPages:357,destroy:async()=>{},getPage:async p=>({getViewport:({scale})=>({width:600*scale,height:800*scale}),render:({canvasContext,viewport})=>({promise:new Promise(resolve=>{canvasContext.fillStyle='white';canvasContext.fillRect(0,0,viewport.width,viewport.height);canvasContext.fillStyle='#333';canvasContext.font='28px serif';canvasContext.fillText('TEST DOUBLE / PAGE '+p,50,100);resolve();})})})})};}'''
with sync_playwright() as p:
    browser=p.chromium.launch(executable_path='/usr/bin/chromium',headless=True,args=['--no-sandbox'])
    context=browser.new_context(viewport={'width':1280,'height':1000},accept_downloads=True)
    page=context.new_page();errors=[];requests=[]
    page.on('pageerror',lambda e:errors.append(str(e)))
    page.on('request',lambda r:requests.append((r.method,r.url)))
    page.on('dialog',lambda d:d.accept())
    def route(r):
        name=r.request.url.split('/')[-1]
        if '/vendor/pdfjs/build/pdf.mjs' in r.request.url:r.fulfill(status=200,content_type='text/javascript',body=SDK)
        elif name=='gre-styles.css':r.fulfill(status=200,content_type='text/css',body=STYLE)
        elif name.endswith('.js') and not name.startswith('gre-math-'):r.fulfill(status=200,content_type='text/javascript',body=LEGACY if name=='gre-app.js' else '')
        elif r.request.url.startswith('https:'):r.abort()
        else:r.continue_()
    page.route('**/*',route)
    page.goto(URL+'/index.html');page.wait_for_selector('#mb-daily')
    page.evaluate("localStorage.setItem('gre-prep-v1',JSON.stringify({sentinel:'keep-old-progress'}))")
    page.locator('[data-view=quant]').click()
    assert page.locator('#mb-chapter option').count()==33
    page.locator('[data-qid="math:1.1:1"]').click()
    assert page.locator('#mb-answer-fields').get_attribute('disabled') is not None
    if SOURCE.exists():
        page.locator('#mb-pdf').set_input_files(str(SOURCE))
        page.wait_for_function("document.querySelector('#mb-source-status').textContent.includes('已加载')",timeout=40000)
        page.wait_for_function("!document.querySelector('#mb-answer-fields').disabled")
        assert page.evaluate('window.__pdfByteLength')==110215852
        page.locator('input[name=mb-letter][value=B]').check()
        page.locator('#mb-answer-form button').click()
        page.wait_for_selector('#mb-solutions canvas')
        assert '回答正确' in page.locator('#mb-feedback').inner_text()
        assert page.evaluate("JSON.parse(localStorage.getItem('gre-math-book-v1')).records['math:1.1:1'].correct")==1
        page.locator('#mb-next').click()
    else:
        page.locator('[data-mb=end-session]').click()
    page.locator('[data-view=settings]').click()
    page.locator('#mb-direction').select_option('en-cn')
    page.locator('#mb-word-new').fill('1');page.locator('#mb-math-new').fill('0')
    page.locator('#mb-save-settings').click()
    page.locator('[data-view=mathwords]').click()
    page.locator('#mb-word-status').select_option('pending')
    assert page.locator('.mb-word-entry').count()==8
    page.locator('#mb-word-status').select_option('all')
    page.locator('#mb-words [data-mb=plan-word]').click()
    assert page.locator('.mb-choice').count()==4
    assert page.locator('#mb-word-library').is_hidden()
    wrong=page.locator('.mb-choice').filter(has_not_text='整数').first
    wrong.click();assert '本次答错' in page.locator('#mb-feedback').inner_text()
    assert page.locator('#mb-feedback').count()==1
    page.locator('#mb-note').fill('<img src=x onerror=alert(1)>')
    page.locator('#mb-reason').select_option(label='不熟悉词义')
    page.locator('#mb-save-note').click()
    page.locator('#mb-next').click()
    correct=page.locator('.mb-choice').filter(has_text='整数')
    # Match exact meaning after the letter label, not '连续的整数'.
    for b in page.locator('.mb-choice').all():
        if b.inner_text().split(maxsplit=1)[-1]=='整数':b.click();break
    assert '回答正确' in page.locator('#mb-feedback').inner_text()
    page.locator('#mb-next').click()
    page.locator('[data-view=wrongbook]').click()
    assert page.locator('#mb-wrong-list .mb-error').count()==1
    assert page.locator('#mb-wrong-list img').count()==0
    assert '<img' in page.locator('#mb-wrong-list').inner_text()
    page.reload();page.wait_for_selector('#mb-daily')
    page.locator('[data-view=wrongbook]').click()
    assert page.locator('#mb-wrong-list .mb-error').count()==1
    assert page.evaluate("JSON.parse(localStorage.getItem('gre-prep-v1')).sentinel")=='keep-old-progress'
    page.locator('[data-view=settings]').click()
    with page.expect_download() as d:page.locator('#mb-export').click()
    path=ROOT/'tests'/'smoke-backup.json';d.value.save_as(path)
    data=json.loads(path.read_text());assert data['type']=='gre-math-book-backup'
    assert data['records']['word:p345:1']['wrong']==1
    page.locator('#mb-backup').set_input_files(str(path));page.wait_for_load_state()
    page.set_viewport_size({'width':390,'height':844});page.locator('[data-view=quant]').click()
    page.locator('#mb-chapter').select_option('4.1')
    box=page.locator('#mb-book').bounding_box();assert box['width']<=390
    assert page.locator('#mb-catalog [data-qid]').count()==51
    page.screenshot(path=str(ROOT/'tests'/'mobile-smoke.png'),full_page=True)
    assert not errors,errors
    assert all(method=='GET' for method,url in requests),requests
    print(json.dumps({'component_smoke':'passed','math_source_import':SOURCE.exists(),'page_errors':errors,'legacy_key_preserved':True,'pdf_engine':'test-double, NOT real CDN','network_writes':0},ensure_ascii=False))
    browser.close()
