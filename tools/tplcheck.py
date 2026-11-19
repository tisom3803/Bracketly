# v3.4.1: director "Download template" buttons next to each import. Local data only.
import asyncio, sys, os
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
SH = '/workspace/shots/v341/tpl-'
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2, accept_downloads=True)
        await ctx.route('**/*supabase*', lambda r: r.abort())
        pg = await ctx.new_page(); pg.set_default_timeout(15000); pg.on('pageerror', lambda e: errs.append(str(e)))
        ev = pg.evaluate
        await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1000)
        await ev("ACT.sampletrip()"); await pg.wait_for_timeout(4500)
        await ev("""(() => { const evs = evsCopy(); const e = newEvent({kind:'proam', format:'pro_am', name:'Saturday Pro-Am'}); evs.push(e); saveEvents(evs) })()""")
        async def dl(sel, name, shot):
            await ev(f"document.querySelector('{sel}').scrollIntoView({{block:'center'}})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=SH + shot + '.png')
            async with pg.expect_download() as d:
                await pg.click(sel)
            f = await d.value; path = f'/tmp/tpl-{f.suggested_filename}'; await f.save_as(path)
            ok = f.suggested_filename == name and open(path, 'rb').read(2) == b'PK'
            check(ok, f'{shot}: downloads {f.suggested_filename} ({os.path.getsize(path)} bytes)')
        await ev("view.screen = 'wizard'; view.wz = {step:'welcome'}; render()"); await pg.wait_for_timeout(600)
        await dl('a.tplbtn[data-tpl=sponsors]', 'sponsors-template.xlsx', 'sponsors')
        await ev("view.wz = {step:'players'}; render()"); await pg.wait_for_timeout(600)
        await ev("document.querySelectorAll('details').forEach(d => d.open = true)")
        await dl('a.tplbtn[data-tpl=players]', 'players-template.xlsx', 'players')
        pa = await ev("events().find(e => e.kind === 'proam').id")
        await ev(f"view.ev = '{pa}'; view.wz = {{step:'entries'}}; render()"); await pg.wait_for_timeout(700)
        await ev("document.querySelectorAll('details').forEach(d => d.open = true)"); await pg.wait_for_timeout(200)
        n = await pg.locator('a.tplbtn').count(); print('buttons on Pro-Am entries:', n, await ev("[...document.querySelectorAll('a.tplbtn')].map(a => a.dataset.tpl)"))
        if await pg.locator('a.tplbtn[data-tpl=teams]').count(): await dl('a.tplbtn[data-tpl=teams]', 'proam-teams-template.xlsx', 'proam-teams')
        else: check(False, 'Pro-Am teams template button present')
        await ev("view.pasub = 'pros'; render()"); await pg.wait_for_timeout(500); await ev("document.querySelectorAll('details').forEach(d => d.open = true)")
        if await pg.locator('a.tplbtn[data-tpl=pros]').count(): await dl('a.tplbtn[data-tpl=pros]', 'pros-template.xlsx', 'pros')
        else:
            # Pros panel may live on another step
            for st in ['pros', 'bracket', 'events', 'draws']:
                await ev(f"view.wz = {{step:'{st}'}}; render()"); await pg.wait_for_timeout(500); await ev("document.querySelectorAll('details').forEach(d => d.open = true)")
                if await pg.locator('a.tplbtn[data-tpl=pros]').count(): print('pros button on step', st); await dl('a.tplbtn[data-tpl=pros]', 'pros-template.xlsx', 'pros'); break
            else: check(False, 'Pros template button present')
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    print('RESULT', 'FAIL' if fails else 'PASS', len(fails), fails)
asyncio.run(main())
