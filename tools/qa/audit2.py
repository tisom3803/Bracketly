import asyncio, sys
from playwright.async_api import async_playwright
SMALL = """(() => [...document.querySelectorAll('header button, nav button, main button, main a, main input:not([type=checkbox]):not([disabled]), main summary, main select, .sheet button, .sheet a, .sheet select, .sheet summary, .sheet input:not([type=checkbox]):not([disabled]), .composer button, .composer label, .composer input')].filter(e=>{const r=e.getBoundingClientRect(); const cs=getComputedStyle(e); return r.width>0 && cs.visibility!=='hidden' && (r.height<43.5 || r.width<43.5)}).map(e=>(e.dataset.act||e.tagName)+':'+Math.round(e.getBoundingClientRect().width)+'x'+Math.round(e.getBoundingClientRect().height)+':'+(e.innerText||e.value||'').slice(0,18).replace(/\\n/g,' ')))()"""
OV = """(() => { const s=document.getElementById('scroller'); const sh=document.querySelector('.sheet'); return [document.documentElement.scrollWidth>innerWidth, s? s.scrollWidth>s.clientWidth : null, sh? sh.scrollWidth>sh.clientWidth+1 : null] })()"""
async def main():
    async with async_playwright() as p:
        b = await p.chromium.launch()
        for W in [320, 390, 430, 1280]:
            ctx = await b.new_context(viewport={'width':W,'height':800}); await ctx.route('**/*supabase*', lambda r: r.abort())
            pg = await ctx.new_page(); errs=[]
            pg.on('pageerror', lambda e: errs.append(str(e)))
            await pg.goto('http://127.0.0.1:8765/', wait_until='networkidle'); await pg.wait_for_timeout(300)
            print(W, 'landing', await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6])
            await pg.click('[data-act=sampleclassic]'); await pg.wait_for_timeout(1500)
            await pg.click('[data-act=pickme][data-id=__guest]'); await pg.wait_for_timeout(300)
            await pg.evaluate("view.me = players()[3].id; LS.set(TK('me'), view.me); render()"); await pg.wait_for_timeout(200)
            for tab in ['today','draws','schedule','courts','players','chat','more','info','bets']:
                await pg.evaluate(f"view.tab='{tab}'; view.modal=null; render()"); await pg.wait_for_timeout(250)
                print(W, tab, await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6])
            await pg.evaluate("view.tab='schedule'; view.sgrid=true; render()"); await pg.wait_for_timeout(200)
            print(W, 'sched-grid', await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6]); await pg.evaluate("view.sgrid=false")
            await pg.evaluate("view.tab='chat'; view.ctab='photos'; render()"); await pg.wait_for_timeout(200)
            print(W, 'photos', await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6]); await pg.evaluate("view.ctab='chat'")
            for mod, setup in [('alerts',''),('player',"view.pid=players()[0].id;"),('invite',''),('match',"syncEngine(); view.matchId=allMatches(true).find(m=>bothKnown(m)).id; view.sm=null;")]:
                await pg.evaluate(f"view.tab='today'; {setup} view.modal='{mod}'; render()"); await pg.wait_for_timeout(300)
                print(W, 'modal:'+mod, await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6])
            await pg.evaluate("view.modal=null; view.tab='admin'; render()"); await pg.wait_for_timeout(200)
            await pg.fill('#pin','1234'); await pg.click('[data-act=unlock]'); await pg.wait_for_timeout(600)
            for s in ['run','setup','perm','data']:
                await pg.evaluate(f"view.dws='{s}'; view.modal=null; render()"); await pg.wait_for_timeout(200)
                print(W, 'dws:'+s, await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6])
            await pg.evaluate("syncEngine(); view.matchId=allMatches(true).find(m=>bothKnown(m)&&typeof m.slotIdx==='number').id; view.modal='move'; render()"); await pg.wait_for_timeout(200)
            print(W, 'move', await pg.evaluate(OV), (await pg.evaluate(SMALL))[:6])
            await pg.evaluate("view.modal=null; view.screen='wizard'; view.wz={step:'style'}; render()"); await pg.wait_for_timeout(300)
            print(W, 'look', await pg.evaluate("document.querySelector('#scroller').scrollWidth > document.querySelector('#scroller').clientWidth"))
            await pg.evaluate("view.screen='app'; view.wz=null; view.tv=true; render()"); await pg.wait_for_timeout(300)
            print(W, 'tv', await pg.evaluate("document.documentElement.scrollWidth>innerWidth"))
            await pg.evaluate("view.tv=false; view.print=true; render()"); await pg.wait_for_timeout(300)
            print(W, 'print errors', errs)
            await ctx.close()
        await b.close()
asyncio.run(main())
