# v3.4.1: tab bar (chat/bets) + colour themes. Local data only.
import asyncio, sys, json
from playwright.async_api import async_playwright
URL = sys.argv[1] if len(sys.argv) > 1 else 'http://127.0.0.1:8765/'
TAG = sys.argv[2] if len(sys.argv) > 2 else 'after'
SH = f'/workspace/shots/v341/{TAG}-'
THEMES = {'navy-red': {'primary':'#1B2A4A', 'gold':'#C8102E'}, 'purple-lavender': {'primary':'#4B2A7B', 'gold':'#B9A3E3'}, 'black-orange': {'primary':'#111111', 'gold':'#F26B1D'}}
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        ctx = await b.new_context(viewport={'width':390,'height':844}, device_scale_factor=2)
        await ctx.route('**/*supabase*', lambda r: r.abort())
        pg = await ctx.new_page(); pg.set_default_timeout(15000)
        pg.on('pageerror', lambda e: errs.append(str(e)))
        ev = pg.evaluate
        await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1200)
        await ev("ACT.sampletrip()"); await pg.wait_for_timeout(4500)
        await ev("ACT.wzclose && view.screen === 'wizard' && ACT.wzclose(); view.screen = 'app'; render()")
        # ---- tab bar
        async def bar(): return await ev("[...document.querySelectorAll('nav.bk-nav button')].map(b => b.dataset.v)")
        await ev("view.me = GUEST; view.tab = 'today'; render()"); await pg.wait_for_timeout(400)
        b0 = await bar(); print('spectator bar', b0); check('chat' not in b0 and 'bets' not in b0, 'spectator: no Chat/Bets tabs')
        await ev("view.me = players()[0].id; LS.set(TK('me'), view.me); render()"); await pg.wait_for_timeout(400)
        b1 = await bar(); print('player bar', b1); check(b1 == ['today', 'draws', 'schedule', 'chat', 'bets', 'more'], 'player: Home Draws Schedule Chat Bets More')
        w = await ev("Math.min(...[...document.querySelectorAll('nav.bk-nav button')].map(b => b.getBoundingClientRect().width))"); print('min tab width', w); check(w >= 56, 'tabs >= 56px wide at 390')
        clip = await ev("[...document.querySelectorAll('nav.bk-nav button span:not(.badge)')].filter(s => s.scrollWidth > s.clientWidth + 1).map(s => s.textContent)"); check(not clip, f'no clipped labels {clip}')
        # unread badge: add a chat message from someone else
        await ev("(() => { const id = 'zz' + Date.now(); Store.set('chat:' + id, {id, by: players()[1].id, text: 'Good luck!', ts: Date.now()}); render() })()"); await pg.wait_for_timeout(400)
        bd = await ev("(document.querySelector('nav.bk-nav button[data-v=chat] .badge') || {}).textContent || ''"); check(bd == '1', f'chat unread badge shows 1 ({bd!r})')
        await pg.screenshot(path=SH + 'tabbar-player-390.png')
        await ev("ACT.tab({dataset:{v:'more'}}); render()"); await pg.wait_for_timeout(400)
        check(await pg.locator('.bk-row[data-v=overview]').count() == 1, 'Overview moved to More when both are on')
        await pg.screenshot(path=SH + 'more-player-390.png')
        await ev("ACT.tab({dataset:{v:'chat'}}); render()"); await pg.wait_for_timeout(500)
        bd2 = await ev("(document.querySelector('nav.bk-nav button[data-v=chat] .badge') || {}).textContent || ''"); check(bd2 == '', 'badge clears after opening chat')
        await pg.screenshot(path=SH + 'chat-tab-390.png')
        await ev("(() => { const c = cfg(); c.bets = false; Store.set('config', c); view.tab = 'today'; render() })()"); await pg.wait_for_timeout(400)
        b2 = await bar(); print('bets off', b2); check(b2 == ['today', 'overview', 'draws', 'schedule', 'chat', 'more'], 'bets off: Overview back, Chat only')
        await pg.screenshot(path=SH + 'tabbar-betsoff-390.png')
        await ev("(() => { const c = cfg(); c.bets = true; c.chat = false; Store.set('config', c); render() })()"); await pg.wait_for_timeout(400)
        b3 = await bar(); print('chat off', b3); check(b3 == ['today', 'overview', 'draws', 'schedule', 'bets', 'more'], 'chat off: Bets only')
        await ev("(() => { const c = cfg(); c.bets = false; c.chat = false; Store.set('config', c); render() })()"); await pg.wait_for_timeout(400)
        b4 = await bar(); check(b4 == ['today', 'overview', 'draws', 'schedule', 'more'], 'both off: original five')
        await ev("(() => { const c = cfg(); c.bets = true; c.chat = true; Store.set('config', c); render() })()"); await pg.wait_for_timeout(300)
        await pg.set_viewport_size({'width':1440, 'height':900}); await pg.wait_for_timeout(400)
        await pg.screenshot(path=SH + 'tabbar-player-1440.png')
        # ---- themes
        await ev("(() => { const c = cfg(); c.sponsors = [{name:'Western Bank', tier:'title'}, {name:'Plains Capital Bank', tier:'gold'}]; Store.set('config', c) })()")
        for name, col in [('default', None)] + list(THEMES.items()):
            await ev("(col => { const c = cfg(); c.style = Object.assign({}, c.style || {}, {preset:'courtside'}); if (col) c.style.colors = col; else delete c.style.colors; Store.set('config', c); render() })", col); await pg.wait_for_timeout(500)
            g1 = await ev("getComputedStyle(document.documentElement).getPropertyValue('--g1').trim()"); meta = await ev("document.querySelector('meta[name=theme-color]').content")
            navbg = await ev("getComputedStyle(document.querySelector('nav.bk-nav')).backgroundImage.slice(0, 60)")
            print(name, 'g1', g1, 'meta', meta, 'nav', navbg)
            if col: check(g1.upper() != '#063D2B' and '6, 61, 43' not in navbg, f'{name}: nav/brand re-themed')
            else: check(g1.upper() == '#063D2B' and meta.upper() == '#063D2B', 'default stays green/gold')
            for (w, h, t) in [(390, 844, 'phone')]:
                await pg.set_viewport_size({'width':w, 'height':h})
                await ev("view.tab = 'today'; render(); document.getElementById('scroller').scrollTop = 0"); await pg.wait_for_timeout(600); await pg.screenshot(path=SH + f'theme-{name}-home-{t}.png')
                await ev("view.tab = 'overview'; render(); document.getElementById('scroller').scrollTop = 0"); await pg.wait_for_timeout(600); await pg.screenshot(path=SH + f'theme-{name}-overview-{t}.png')
                await ev("view.tab = 'draws'; view.ev = events()[0].id; render()"); await pg.wait_for_timeout(600); await pg.screenshot(path=SH + f'theme-{name}-draws-{t}.png')
            await pg.set_viewport_size({'width':1920, 'height':1080})
            await ev("Date._off = 0; view.tv = true; render()"); await pg.wait_for_timeout(900); await pg.screenshot(path=SH + f'theme-{name}-tv-1920.png')
            tvbg = await ev("getComputedStyle(document.querySelector('.tv')).backgroundImage.slice(0, 80)"); print('  tv', tvbg)
            await ev("view.tv = false; render()")
            await pg.set_viewport_size({'width':1100, 'height':1400})
            await ev("ACT.print({dataset:{v:''}}); render()"); await pg.wait_for_timeout(900); await pg.screenshot(path=SH + f'theme-{name}-print.png')
            await ev("view.print = false; render()")
            # contrast audit: trim text on the main colour
            if col:
                cr = await ev("typeof contrast !== 'function' ? 0 : contrast(getComputedStyle(document.documentElement).getPropertyValue('--au').trim(), getComputedStyle(document.documentElement).getPropertyValue('--g1').trim())")
                cr2 = await ev("typeof contrast !== 'function' ? 0 : contrast('#F7F5EC', getComputedStyle(document.documentElement).getPropertyValue('--g1').trim())")
                print(f'  contrast trim/main {cr:.2f}  ivory/main {cr2:.2f}'); check(cr >= 3 and cr2 >= 4.5, f'{name}: readable contrast')
        # ---- live preview in the Look step
        await pg.set_viewport_size({'width':390, 'height':844})
        await ev("(() => { const c = cfg(); delete c.style.colors; Store.set('config', c); view.admin = true; view.screen = 'wizard'; view.wz = {step:'style'}; render() })()"); await pg.wait_for_timeout(600)
        has = await pg.locator('#col-primary').count(); print('color inputs', has)
        if has:
            await pg.evaluate("(() => { const i = document.getElementById('col-primary'); i.value = '#4B2A7B'; i.dispatchEvent(new Event('input', {bubbles:true})); i.dispatchEvent(new Event('change', {bubbles:true})) })()"); await pg.wait_for_timeout(700)
            g1 = await ev("getComputedStyle(document.documentElement).getPropertyValue('--g1').trim()"); check(g1.upper() != '#063D2B', f'live preview re-themes while editing ({g1})')
            check(await ev("!(cfg().style || {}).colors"), 'preview does not save until Apply')
            await pg.screenshot(path=SH + 'live-preview-style-390.png')
        print('errors:', errs[:5]); check(not errs, 'no page errors')
        await b.close()
    print('RESULT', 'FAIL' if fails else 'PASS', len(fails), fails)
asyncio.run(main())
