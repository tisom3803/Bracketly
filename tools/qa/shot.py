import sys, asyncio, json
from playwright.async_api import async_playwright
# usage: shot.py prefix width height  (steps defined inline as JSON on argv[4])
async def main():
    prefix, w, h = sys.argv[1], int(sys.argv[2]), int(sys.argv[3])
    steps = json.loads(sys.argv[4])
    async with async_playwright() as p:
        b = await p.chromium.launch()
        ctx = await b.new_context(viewport={'width':w,'height':h}, device_scale_factor=1)
        await ctx.route('**/*supabase*', lambda r: r.abort())
        pg = await ctx.new_page()
        errs = []
        pg.on('pageerror', lambda e: errs.append(str(e)))
        pg.on('console', lambda m: errs.append('console:'+m.text) if m.type=='error' else None)
        await pg.goto('http://127.0.0.1:8765/', wait_until='networkidle')
        n = 0
        for s in steps:
            if s[0]=='click': await pg.click(s[1]); await pg.wait_for_timeout(500)
            elif s[0]=='eval': r = await pg.evaluate(s[1]); print('eval->', r); await pg.wait_for_timeout(400)
            elif s[0]=='fill': await pg.fill(s[1], s[2]); await pg.wait_for_timeout(200)
            elif s[0]=='wait': await pg.wait_for_timeout(s[1])
            elif s[0]=='shot':
                await pg.screenshot(path=f'/workspace/shots/{prefix}-{s[1]}.png', full_page=False)
            elif s[0]=='full':
                await pg.evaluate("document.querySelector('#scroller') && (document.documentElement.style.height='auto')")
                await pg.screenshot(path=f'/workspace/shots/{prefix}-{s[1]}.png', full_page=True)
        print('errors:', errs)
        await b.close()
asyncio.run(main())
