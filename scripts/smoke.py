"""Headless browser smoke test: loads the built app, exercises every view, reports errors, saves screenshots.
Usage: PLAYWRIGHT_BROWSERS_PATH=/opt/pw-browsers python3 scripts/smoke.py [outdir]
"""
import os, sys, json
from playwright.sync_api import sync_playwright

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
OUT = sys.argv[1] if len(sys.argv) > 1 else os.path.join(ROOT, 'dist', 'shots')
os.makedirs(OUT, exist_ok=True)
URL = 'file://' + os.path.join(ROOT, 'dist', 'preview.html')
SCENARIOS = ['shipping', 'bees', 'internet', 'fossil', 'sealevel', 'clean', 'amazon', 'water']

problems = []

def watch(page, tag):
    page.on('console', lambda m: problems.append(f'[{tag}] console.{m.type}: {m.text}') if m.type in ('error', 'warning') and 'fonts.g' not in m.text else None)
    page.on('pageerror', lambda e: problems.append(f'[{tag}] pageerror: {e}'))

with sync_playwright() as p:
    b = p.chromium.launch()
    page = b.new_page(viewport={'width': 1600, 'height': 960}, device_scale_factor=1)
    watch(page, 'desktop')
    page.goto(URL)
    page.wait_for_timeout(2600)
    page.screenshot(path=f'{OUT}/01-launch.png')

    for sid in SCENARIOS:
        page.evaluate(f"__aftershock.selectScenario('{sid}')")
        page.wait_for_timeout(350)
        page.evaluate("(() => { const a = __aftershock; a.S.t = Math.min(a.S.run.T, 160); a.S.playing = false; })()")
        page.wait_for_timeout(250)
        n_events = page.evaluate("__aftershock.S.run.events.length")
        print(f'{sid}: events={n_events}')
    page.screenshot(path=f'{OUT}/02-water-t160.png')

    # inspector: node with expanded tree
    page.evaluate("__aftershock.selectScenario('fossil')")
    page.wait_for_timeout(300)
    page.evaluate("(() => { const a = __aftershock; a.S.t = 40; a.S.playing = false; a.select({type:'node', id:'food_supply'}); })()")
    page.wait_for_timeout(300)
    page.locator('#tabInspect .tw').first.click()
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/03-fossil-inspect-node.png')
    # edge inspector
    page.evaluate("__aftershock.select({type:'edge', id:'fossil>fertilizer'})")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/04-edge.png')
    # region inspector via globe click at its centre
    page.evaluate("(() => { const a = __aftershock; a.S.sel = null; a.selectRegion(4); })()")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/05-region.png')
    # click on network canvas to test hit-testing paths
    box = page.locator('#net').bounding_box()
    page.mouse.move(box['x'] + box['width'] * 0.5, box['y'] + box['height'] * 0.5)
    page.mouse.click(box['x'] + box['width'] * 0.5, box['y'] + 30)
    gbox = page.locator('#globeA').bounding_box()
    page.mouse.move(gbox['x'] + gbox['width'] * 0.5, gbox['y'] + gbox['height'] * 0.5)
    page.mouse.down(); page.mouse.move(gbox['x'] + gbox['width'] * 0.6, gbox['y'] + gbox['height'] * 0.5); page.mouse.up()
    page.mouse.click(gbox['x'] + gbox['width'] * 0.5, gbox['y'] + gbox['height'] * 0.5)
    # events tab
    page.evaluate("(() => { const a = __aftershock; a.S.tab = 'events'; document.querySelector('[data-tab=events]').click(); })()")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/06-events.png')
    # timeline scrub
    tb = page.locator('#timeline').bounding_box()
    page.mouse.move(tb['x'] + tb['width'] * 0.3, tb['y'] + tb['height'] * 0.7)
    page.mouse.down(); page.mouse.move(tb['x'] + tb['width'] * 0.5, tb['y'] + tb['height'] * 0.7); page.mouse.up()
    # compare
    page.evaluate("__aftershock.selectScenario('sealevel')")
    page.wait_for_timeout(300)
    page.evaluate("__aftershock.setView('compare')")
    page.wait_for_timeout(300)
    page.evaluate("(() => { const a = __aftershock; a.C.week = 60; })()")
    page.locator('#computeB').click()
    page.wait_for_timeout(500)
    page.evaluate("(() => { const a = __aftershock; a.S.t = 400; a.S.playing = false; })()")
    page.wait_for_timeout(400)
    page.screenshot(path=f'{OUT}/07-compare.png')
    # model view
    page.evaluate("__aftershock.setView('model')")
    page.wait_for_timeout(300)
    page.screenshot(path=f'{OUT}/08-model.png')
    page.fill('#mv-q', 'fertilizer')
    page.wait_for_timeout(150)
    page.keyboard.press('Escape')
    page.wait_for_timeout(200)
    # play and keyboard
    page.evaluate("__aftershock.setView('simulate')")
    page.keyboard.press('Space'); page.wait_for_timeout(600); page.keyboard.press('ArrowRight')
    # frame timing
    fps = page.evaluate("""() => new Promise(res => { const a = __aftershock; a.S.t = 0; a.S.playing = true; let n = 0; const t0 = performance.now();
        function f() { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / 2); } requestAnimationFrame(f); })""")
    print(f'fps while playing (headless, software rendering): {fps:.0f}')

    # mobile
    m = b.new_page(viewport={'width': 390, 'height': 844}, device_scale_factor=2, is_mobile=True, has_touch=True)
    watch(m, 'mobile')
    m.goto(URL)
    m.wait_for_timeout(2200)
    m.evaluate("(() => { const a = __aftershock; a.S.t = 120; a.S.playing = false; })()")
    m.wait_for_timeout(300)
    overflow = m.evaluate("document.documentElement.scrollWidth - document.documentElement.clientWidth")
    print('mobile horizontal overflow px:', overflow)
    m.screenshot(path=f'{OUT}/09-mobile.png', full_page=False)
    m.screenshot(path=f'{OUT}/10-mobile-full.png', full_page=True)
    b.close()

print('\nPROBLEMS:' if problems else '\nNo console errors or page errors.')
for x in problems[:40]:
    print(' ', x)
sys.exit(1 if any('pageerror' in x or 'console.error' in x for x in problems) else 0)
