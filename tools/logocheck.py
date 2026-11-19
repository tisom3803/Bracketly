# v3.4.2: logos + player button at iPhone sizes (DPR 3). Local data; logo served cross-origin with CORS like Supabase storage.
import asyncio, sys, json
from playwright.async_api import async_playwright
URL, TAG = sys.argv[1], sys.argv[2]
SH = f'/workspace/shots/v342/{TAG}-'
LOGO = 'http://127.0.0.1:8769/lobapalooza-logo.jpg'
fails = []
def check(ok, msg):
    print(('PASS ' if ok else 'FAIL ') + msg)
    if not ok: fails.append(msg)
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch(); errs = []
        for W, H in [(390, 844), (430, 932)]:
            ctx = await b.new_context(viewport={'width':W,'height':H}, device_scale_factor=3, is_mobile=True, has_touch=True)
            await ctx.route('**/*supabase*', lambda r: r.abort())
            pg = await ctx.new_page(); pg.set_default_timeout(15000); pg.on('pageerror', lambda e: errs.append(str(e)))
            ev = pg.evaluate
            await pg.goto(URL, wait_until='networkidle'); await pg.wait_for_timeout(1000)
            await ev("ACT.sampletrip()"); await pg.wait_for_timeout(4500)
            await ev("""(logo => { const c = cfg(); c.logo = logo; c.cover = logo; c.style = {preset:'courtside', colors:{primary:'#4B2A7B', gold:'#B9A3E3'}};
              c.sponsors = [{name:'Lobapalooza', tier:'title', logo:logo}, {name:'Tiny Bakery', tier:'gold'}]; Store.set('config', c);
              view.me = players()[0].id; LS.set(TK('me'), view.me); view.screen = 'app'; view.tab = 'today'; render() })""", LOGO)
            await pg.wait_for_timeout(2500); await ev("render()"); await pg.wait_for_timeout(800)
            await pg.screenshot(path=SH + f'header-expanded-{W}.png', clip={'x':0, 'y':0, 'width':W, 'height':560})
            info = await ev("""(() => { const lg = document.querySelector('.v3-logo'), me = document.querySelector('.v6-hme'), bell = document.querySelector('.v3-top .hbtn'), av = me && me.querySelector('.v4-av');
              const r = e => e ? e.getBoundingClientRect() : null, a = r(me), bb = r(bell), v = r(av);
              return {logoCls: lg && lg.className, logoSrc: lg && lg.getAttribute('src').slice(0, 22), logoW: lg && lg.naturalWidth, pad: lg && getComputedStyle(lg).padding,
                me: a && [Math.round(a.width), Math.round(a.height)], bell: bb && [Math.round(bb.width), Math.round(bb.height)], avCenterOff: a && v ? [Math.round((v.left + v.width / 2) - (a.left + a.width / 2)), Math.round((v.top + v.height / 2) - (a.top + a.height / 2))] : null} })()""")
            print(W, 'expanded', json.dumps(info))
            if TAG != 'before':
                check('lg-badge' in (info['logoCls'] or ''), f'{W}: header logo recognised as a round badge')
                check(info['me'] == info['bell'] and info['me'][0] == info['me'][1], f'{W}: player button same size as bell and round {info["me"]} vs {info["bell"]}')
                check(info['avCenterOff'] and max(abs(x) for x in info['avCenterOff']) <= 1, f'{W}: avatar centred {info["avCenterOff"]}')
                check(info['logoW'] >= 92 * 3 or info['logoW'] >= 560, f'{W}: logo source sharp at DPR 3 ({info["logoW"]}px)')
            hero = await ev("(() => { const i = document.querySelector('.v3-tcard-ph > img'); return i ? [i.className, i.parentElement.className, Math.round(i.getBoundingClientRect().width), Math.round(i.getBoundingClientRect().height)] : null })()")
            print(W, 'hero', hero)
            await ev("document.querySelector('.v3-tcard').scrollIntoView({block:'start'})"); await pg.wait_for_timeout(300)
            await pg.screenshot(path=SH + f'hero-{W}.png', clip={'x':0, 'y':0, 'width':W, 'height':min(H, 640)})
            # sticky header: scroll the content
            await ev("document.getElementById('scroller').scrollTop = 900; document.getElementById('scroller').dispatchEvent(new Event('scroll'))"); await pg.wait_for_timeout(1200)
            await pg.screenshot(path=SH + f'header-sticky-{W}.png', clip={'x':0, 'y':0, 'width':W, 'height':200})
            st = await ev("""(() => { const lg = document.querySelector('.v3-logo'), r = lg.getBoundingClientRect(), cs = getComputedStyle(lg); return {slim: document.querySelector('.v3-top').classList.contains('slim'), w: Math.round(r.width), h: Math.round(r.height), pad: cs.padding, op: cs.opacity, cls: lg.className, loaded: lg.complete && lg.naturalWidth > 0} })()""")
            me2 = await ev("(() => { const a = document.querySelector('.v6-hme').getBoundingClientRect(), b = document.querySelector('.v3-top .hbtn').getBoundingClientRect(); return [[Math.round(a.width), Math.round(a.height)], [Math.round(b.width), Math.round(b.height)]] })()")
            print(W, 'sticky', json.dumps(st), me2)
            if TAG != 'before':
                check(st['slim'] and st['loaded'] and st['op'] == '1' and st['pad'] in ('0px', '') and st['w'] >= 30, f'{W}: sticky crest shows the logo ({st["w"]}px, padding {st["pad"]})')
                check(me2[0] == me2[1], f'{W}: sticky player button matches bell {me2}')
            if W == 390:
                await ev("document.getElementById('scroller').scrollTop = 0; view.tab = 'overview'; render()"); await pg.wait_for_timeout(900)
                await pg.screenshot(path=SH + 'overview-390.png', clip={'x':0, 'y':0, 'width':W, 'height':500})
                await ev("view.me = null; view.tab = 'today'; render()"); await pg.wait_for_timeout(900)
                await pg.screenshot(path=SH + 'picker-390.png', clip={'x':0, 'y':0, 'width':W, 'height':500})
                await ev("view.me = players()[0].id; render()")
                await pg.set_viewport_size({'width':1280, 'height':720}); await ev("view.tv = true; render()"); await pg.wait_for_timeout(1200)
                await pg.screenshot(path=SH + 'tv-1280.png', clip={'x':0, 'y':0, 'width':1280, 'height':200})
                await ev("""(() => { if (!Date._D) { Date._D = Date.now.bind(Date); Date.now = () => Date._D() + (Date._off || 0) } })()""")
                for _ in range(20):
                    if await pg.locator('.tvsp').count(): break
                    await ev("Date._off = (Date._off || 0) + 25000; render()"); await pg.wait_for_timeout(250)
                await pg.wait_for_timeout(900); await pg.screenshot(path=SH + 'tv-sponsors-1280.png')
                await ev("Date._off = 0; view.tv = false; render()")
                await pg.set_viewport_size({'width':1100, 'height':1400}); await ev("ACT.print({dataset:{v:''}}); render()"); await pg.wait_for_timeout(1500)
                await pg.screenshot(path=SH + 'print-head.png', clip={'x':0, 'y':0, 'width':1100, 'height':260})
            await ctx.close()
        check(not errs, f'no page errors {errs[:3]}')
        await b.close()
    print('RESULT', 'FAIL' if fails else 'PASS', len(fails), fails)
asyncio.run(main())
