# v3.4 sponsors e2e: list import preview (xlsx + paste), bulk logo matching, per-sponsor logo, displays (Home, Overview, TV, print)
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'local'
LG = '/workspace/si-build/splogos/'
SH = f'/workspace/shots/v340/{TAG}-'
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
async def shot(pg, name, sel=None, block='start'):
    if sel: await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || document.body).scrollIntoView({{block:'{block}'}})")
    await pg.wait_for_timeout(350); await pg.screenshot(path=SH + name + '.png')
async def overflow(pg):
    return await pg.evaluate("document.documentElement.scrollWidth - innerWidth")
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        if TAG == 'local': await ctx.route('**/*supabase*', lambda r: r.abort())
        pg = await ctx.new_page(); pg.set_default_timeout(15000)
        pg.on('pageerror', lambda e: errs.append(str(e))); pg.on('console', lambda m: errs.append('console: ' + m.text) if m.type == 'error' and 'supabase' not in m.text and 'Failed to load resource' not in m.text else None)
        await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1500)
        print('version/mode:', await pg.evaluate("[APP_VERSION, Dir.mode]"))
        await pg.evaluate("ACT.sampletrip()"); await pg.wait_for_timeout(5000)
        await pg.evaluate("(() => { const c = cfg(); c.sponsors = [{name:'Western Bank', tier:'gold', logo:null}, {name:'Old Friend Cafe', tier:'friend', logo:null}]; Store.set('config', c) })()")
        await pg.evaluate("view.screen = 'wizard'; view.wz = {step:'welcome'}; render()"); await pg.wait_for_timeout(600)
        check(await pg.locator('.spedit').count() == 1, 'sponsor editor shown on Welcome step')
        # 1) xlsx import
        await pg.set_input_files('input[data-chg=spfile]', '/workspace/out/lobapalooza-sponsors.xlsx'); await pg.wait_for_timeout(2500)
        n = await pg.locator('table.spi tbody tr').count(); check(n == 15, f'import preview rows {n} == 15')
        txt = await pg.inner_text('.spimp'); check('Updates' in txt or 'Update' in txt, 'preview marks Western Bank as an update')
        await shot(pg, '1-import-preview-phone', '.spimp')
        print('phone overflow px:', await overflow(pg)); check(await overflow(pg) <= 1, 'no horizontal overflow on phone (import preview)')
        await pg.click('button[data-act=spigo]'); await pg.wait_for_timeout(1500)
        sp = await pg.evaluate("cfg().sponsors.map(s => [s.name, s.tier, s.logoFile || ''])")
        check(len(sp) == 16, f'merged: 16 sponsors (15 + Old Friend Cafe), got {len(sp)}')
        check(dict((a, b) for a, b, c in sp).get('Western Bank') == 'title', 'Western Bank updated gold -> Presenting')
        check(sum(1 for s in sp if s[2]) == 15, 'logo filenames remembered for bulk upload')
        # 2) paste import with headings + unknown tier
        await pg.evaluate("document.querySelector('details.spaste').open = true")
        await pg.fill('#sp-paste', 'Presented by: Western Bank\nGold Sponsors\nNew Gold Co\nEmerald: Mystery Corp\nFriends: Pat & Sam, Tiny Bakery')
        await pg.click('button[data-act=sppaste]'); await pg.wait_for_timeout(900)
        t2 = await pg.inner_text('.spimp'); check('Emerald' in t2, 'unknown tier warned (Emerald)')
        print('paste preview:', await pg.evaluate("view.spi && view.spi.rows.map(r => [r.name, r.tier, r.inc]).slice(0,8)") if await pg.evaluate("!!(view.spi && view.spi.rows)") else t2[:300])
        await shot(pg, '2-paste-preview-phone', '.spimp')
        await pg.click('button[data-act=spigo]'); await pg.wait_for_timeout(1200)
        print('after paste:', await pg.evaluate("cfg().sponsors.length"))
        # 3) bulk logos
        import os
        files = sorted(LG + f for f in os.listdir(LG))
        await pg.set_input_files('input[data-chg=splogos]', files); await pg.wait_for_timeout(2500)
        items = await pg.evaluate("view.spb ? view.spb.items.map(x => [x.f.name, x.to, x.why || '']) : null")
        print('bulk match:'); [print('  ', i) for i in (items or [])]
        if items:
            nm = {f: to for f, to, w in items}
            names = await pg.evaluate("cfg().sponsors.map(s => s.name)")
            def who(f): t = nm.get(f); return names[int(t)] if isinstance(t, (int, str)) and str(t).lstrip('-').isdigit() and int(t) >= 0 else t
            check(who('MerrillLynch_logo@2x.svg') == 'Merrill Lynch', 'SVG matched Merrill Lynch')
            check(who('FTNB-logo-final.jpg') == 'FTNB', 'JPG matched FTNB')
            check(who('IMG_2041.png') in (None, '', 'skip', -1, '-1'), f'IMG_2041.png left unmatched ({nm.get("IMG_2041.png")})')
            check(sum(1 for f, to, w in items if who(f) not in (None, '', 'skip', -1, '-1')) == 15, '15 files matched')
        await shot(pg, '3-bulk-match-phone', '.spbulk')
        check(await overflow(pg) <= 1, 'no horizontal overflow on phone (bulk match)')
        await pg.set_viewport_size({'width':1440, 'height':900}); await pg.wait_for_timeout(400)
        await shot(pg, '3b-bulk-match-desktop', '.spbulk')
        await pg.click('button[data-act=spbgo]'); await pg.wait_for_timeout(5000)
        lg = await pg.evaluate("cfg().sponsors.map(s => [s.name, s.tier, s.logo ? s.logo.slice(0, 22) : null])")
        print('logos:', sum(1 for x in lg if x[2]), '/', len(lg))
        check(sum(1 for x in lg if x[2]) == 15, '15 logos stored')
        check(all((x[2] or 'data:image/').startswith('data:image/') for x in lg), 'local mode logos are data URLs')
        svgfmt = await pg.evaluate("(cfg().sponsors.find(s => s.name === 'Merrill Lynch') || {}).logo || ''")
        check(svgfmt.startswith('data:image/png'), 'SVG stored as PNG')
        # per-sponsor replace + remove
        i = await pg.evaluate("cfg().sponsors.findIndex(s => s.name === 'New Gold Co')")
        await pg.set_input_files(f'input[data-chg=sponsorlogo][data-i="{i}"]', LG + 'IMG_2041.png'); await pg.wait_for_timeout(2000)
        check(await pg.evaluate(f"!!cfg().sponsors[{i}].logo"), 'per-sponsor logo upload')
        await pg.evaluate("document.querySelector('.splist').scrollIntoView({block:'start'})")
        await shot(pg, '4-editor-list-desktop')
        await pg.click(f'button[data-act=spnologo][data-i="{i}"]'); await pg.wait_for_timeout(800)
        check(await pg.evaluate(f"!cfg().sponsors[{i}].logo"), 'remove logo')
        await pg.set_viewport_size({'width':390, 'height':844}); await pg.wait_for_timeout(300)
        await shot(pg, '4b-editor-list-phone', '.splist')
        check(await overflow(pg) <= 1, 'no overflow (editor list phone)')
        # displays
        await pg.evaluate("ACT.wzclose(); view.tab = 'today'; render()"); await pg.wait_for_timeout(800)
        await shot(pg, '5-home-sponsors-phone', '.sponsors', 'center')
        check(await pg.locator('.sponsors .splogo img').count() >= 10, 'Home sponsors show logo images')
        ovtab = await pg.evaluate("typeof ACT.overview === 'function' ? 'act' : 'tab'")
        await pg.evaluate("view.tab = 'overview'; render()"); await pg.wait_for_timeout(800)
        has = await pg.locator('.ov-sp').count(); check(has > 0, 'Overview sponsors section present')
        await shot(pg, '6-overview-sponsors-phone', '.ov-sp')
        check(await overflow(pg) <= 1, 'no overflow (overview phone)')
        await pg.set_viewport_size({'width':1440, 'height':900}); await pg.wait_for_timeout(400)
        await shot(pg, '6b-overview-sponsors-desktop', '.ov-sp')
        # TV sponsor slide
        for (w, h) in [(1920, 1080), (1280, 720)]:
            await pg.set_viewport_size({'width':w, 'height':h})
            await pg.evaluate("(() => { if (!Date._D) { Date._D = Date.now.bind(Date); Date.now = () => Date._D() + (Date._off || 0) } view.tv = true; render() })()")
            for _ in range(30):
                await pg.wait_for_timeout(200)
                if await pg.locator('.tvsp').count(): break
                await pg.evaluate("Date._off = (Date._off || 0) + 25000; render()")
            await pg.wait_for_timeout(900)
            ok = await pg.locator('.tvsp').count(); check(ok == 1, f'TV sponsor slide at {w}x{h}')
            fit = await pg.evaluate("(() => { const g = document.querySelector('.tvsp'); if (!g) return null; const r = g.getBoundingClientRect(); return [Math.round(r.bottom), innerHeight, Math.round(r.right), innerWidth, getComputedStyle(g).zoom] })()")
            print('tv fit', w, h, fit); check(fit and fit[0] <= fit[1] + 1 and fit[2] <= fit[3] + 1, f'TV sponsor slide fits {w}x{h}')
            await pg.screenshot(path=SH + f'7-tv-sponsors-{w}.png')
        # TV courts strip
        for _ in range(30):
            await pg.evaluate("Date._off = (Date._off || 0) + 25000; render()"); await pg.wait_for_timeout(250)
            if await pg.evaluate("!document.querySelector('.tvsp') && !document.querySelector('.tvphotos') && !!document.querySelector('.tv .sponsors')"): break
        await pg.wait_for_timeout(600)
        await pg.screenshot(path=SH + '8-tv-strip-1280.png'); print('tv strip present:', await pg.locator('.tv .sponsors').count())
        await pg.evaluate("Date._off = 0; view.tv = false; render()")
        # print
        await pg.set_viewport_size({'width':1100, 'height':1400})
        await pg.evaluate("ACT.print({dataset:{v:''}}); render()"); await pg.wait_for_timeout(1200)
        check(await pg.locator('.psp').count() == 1, 'print sponsor page present')
        check(await pg.locator('.ph-sp').count() >= 1, 'print header presented-by line')
        await pg.emulate_media(media='print')
        await shot(pg, '9-print-sponsor-page', '.psp')
        await pg.evaluate("document.querySelector('.ph-sp') && document.querySelector('.ph-sp').scrollIntoView({block:'center'})"); await pg.wait_for_timeout(300)
        await pg.screenshot(path=SH + '9b-print-header.png')
        pdf = await pg.pdf(path=SH + 'print.pdf', format='Letter'); print('pdf bytes', len(pdf))
        print('errors:', errs[:8]); check(not errs, 'no page errors')
        await b.close()
    print('RESULT', 'FAIL' if fails else 'PASS', len(fails), fails)
asyncio.run(main())
