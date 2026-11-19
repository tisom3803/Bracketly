# image-fit before/after: square logo used as cover + logo, player photos, sponsor logos. Local data only.
import asyncio, sys, json, base64
from playwright.async_api import async_playwright
URL, TAG = sys.argv[1], sys.argv[2]
SH = f'/workspace/shots/v340/fit-{TAG}-'
def du(p, mt): return f'data:{mt};base64,' + base64.b64encode(open(p, 'rb').read()).decode()
LOGO = du('/workspace/lobapalooza/photos/lobapalooza-logo.jpg', 'image/jpeg')
PH = [du(f'/workspace/lobapalooza/photos/{n}.jpg', 'image/jpeg') for n in ['alex-ghilea', 'ben-gendron', 'carson-dyess', 'hector-flores', 'matt-watson', 'mel-mcree']]
WIDE = du('/workspace/out/lobapalooza-sponsor-logos/western-bank.png', 'image/png')
SETUP = """(([logo, ph, wide]) => { const c = cfg(); c.logo = logo; c.cover = logo; c.sponsors = [{name:'Western Bank', tier:'title', logo:wide}, {name:'Lobapalooza', tier:'gold', logo:logo}, {name:'Tiny Bakery', tier:'silver'}]; Store.set('config', c);
  view.cards = view.cards || {}; players().slice(0, 40).forEach((p, i) => { view.cards[p.id] = Object.assign({}, view.cards[p.id], {photo: ph[i % ph.length]}) }); render() })"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await ctx.route('**/*supabase*', lambda r: r.abort())
        pg = await ctx.new_page(); pg.set_default_timeout(15000)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1200)
        await pg.evaluate("ACT.sampletrip()"); await pg.wait_for_timeout(4500)
        await pg.evaluate(SETUP, [LOGO, PH, WIDE]); await pg.wait_for_timeout(800)
        async def go(js, name, sel=None, wait=900):
            await pg.evaluate(js); await pg.wait_for_timeout(wait)
            if sel: await pg.evaluate(f"(document.querySelector({json.dumps(sel)}) || document.body).scrollIntoView({{block:'start'}})"); await pg.wait_for_timeout(300)
            else: await pg.evaluate("scrollTo(0,0)")
            await pg.screenshot(path=SH + name + '.png')
        for w, h, tag in [(390, 844, 'phone'), (1440, 900, 'desktop')]:
            await pg.set_viewport_size({'width':w, 'height':h})
            await go("view.screen = 'app'; view.tab = 'today'; view.me = GUEST; render()", f'1-home-{tag}')
            await go("view.tab = 'overview'; render()", f'2-overview-{tag}')
            await go("view.tab = 'draws'; view.ev = events()[0].id; render()", f'3-event-{tag}')
            await go("view.me = null; view.tab = 'today'; render()", f'4-picker-{tag}')
            await pg.evaluate("view.me = GUEST; render()")
        await pg.set_viewport_size({'width':1920, 'height':1080})
        await go("view.tv = true; render()", '5-tv-1920', wait=1200)
        await pg.evaluate("view.tv = false; render()")
        await pg.set_viewport_size({'width':1100, 'height':1400})
        await go("ACT.print({dataset:{v:''}}); render()", '6-print')
        print(TAG, 'errors:', errs[:5])
        await b.close()
asyncio.run(main())
