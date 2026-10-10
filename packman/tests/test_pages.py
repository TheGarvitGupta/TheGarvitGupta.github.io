# The other pages: the one that introduces the shapes, the game playing itself, and the card on the site's front page.
from harness import tick, Skip

def chrome_only(t, why):
    if t.engine != 'chrome': raise Skip('not in WebKit yet: ' + why)

async def test_meet_the_shapes_draws_everyone(t):
    page = await t.page('/packman/personalities.html', save=False)
    r = await page.evaluate('''({ cast: document.querySelectorAll('#cast li').length, powers: document.querySelectorAll('#powers li').length,
      faces: PackmanFaces.length, all: PackmanPowers.length, blank: [].filter.call(document.querySelectorAll('.cast li'), function (li) {
        var s = li.querySelector('svg'), r = s && s.getBoundingClientRect(); return !s || r.width < 40 || !s.querySelector('.fill') || !li.querySelector('b').textContent.trim(); }).length,
      u: getComputedStyle(document.querySelector('.cast svg')).getPropertyValue('--u').trim(),
      line: parseFloat(getComputedStyle(document.querySelector('.cast svg .fill')).strokeWidth) })''')
    assert r['cast'] == r['faces'] and r['cast'] >= 10, '%d personalities drawn of %d' % (r['cast'], r['faces'])
    assert r['powers'] == r['all'] and r['powers'] >= 7, '%d powers drawn of %d' % (r['powers'], r['all'])
    assert r['blank'] == 0, '%d cards have no picture or no name' % r['blank']
    assert r['u'] and r['line'] > 0, 'the shapes have no outline: faces.css draws lines by --u, which the page must set (it is %r)' % r['u']
    assert not page.errors, page.errors

async def test_a_shape_reacts_when_it_is_tapped(t):
    page = await t.page('/packman/personalities.html', save=False)
    await page.click('#cast li:nth-child(3) button'); await tick(page, 100)
    assert await page.evaluate('!!document.querySelector("#cast li:nth-child(3) .on, #cast li:nth-child(3).on")'), 'the third shape does nothing when tapped'
    await page.click('#powers li:nth-child(1) button'); await tick(page, 3500)
    assert not page.errors, page.errors

async def test_the_reel_plays_through_to_its_card(t):
    """The game playing itself (reel/): three levels pack with no party, then the card with the name comes up."""
    chrome_only(t, 'the game in its frame is opened afresh while the clock is held, and the test loses it')
    page = await t.page('/packman/reel/?auto', save=False, calm=False)
    await tick(page, 12000)
    f = page.frames[1] if len(page.frames) > 1 else None
    assert f, 'the reel shows no game'
    r = await f.evaluate('''({ card: !!document.querySelector('.reel-end'), word: (document.querySelector('.reel-end .word') || {}).textContent || '',
      shown: (function () { var w = document.querySelector('.reel-end .word'); return !!w && getComputedStyle(w).display !== 'none' && w.getBoundingClientRect().width > 100; })(),
      shapes: document.querySelectorAll('.reel-end .reel-pop').length, real: JSON.parse(localStorage.getItem('packman.v1') || 'null') })''')
    assert r['card'], 'twelve seconds in and the card has not come up'
    assert r['word'] == 'Packman' and r['shown'], 'the card does not show the name (it says %r)' % r['word']
    assert r['shapes'] >= 8, 'only %d shapes round the name' % r['shapes']
    assert r['real'] is None, 'the reel wrote to a player\'s own saved game'
    assert not page.errors, page.errors

async def test_the_reel_is_not_loaded_for_a_player(t):
    page = await t.page()
    assert not await page.evaluate('!!document.querySelector("script[src*=reel]") || !!document.querySelector(".reel-go")')
    page = await t.page('/packman/?reel&auto', save=False)
    assert await page.evaluate('!!document.querySelector("script[src*=reel]")'), 'with ?reel on this machine the reel should load'

async def test_the_card_on_the_front_page_packs(t):
    """The site's main page has a card that packs a level by itself (js/packman-tile.js), with the game's own geometry and levels."""
    chrome_only(t, 'the front page does not finish loading with the clock held')
    page = await t.page('/', save=False, width=1280, height=900, calm=False)
    await tick(page, 4000)
    r = await page.evaluate('''(function () { var s = [].filter.call(document.scripts, function (s) { return /packman/.test(s.src); }).map(function (s) { return s.src.split('/').pop(); });
      var el = document.querySelector('[class*=packman], [id*=packman]'); return { scripts: s, there: !!el, drawn: el ? el.querySelectorAll('svg *').length : 0 }; })()''')
    assert r['there'] and r['drawn'] > 5, 'no Packman card is drawn on the front page: %s' % r
    mine = [e for e in page.errors if 'packman' in e.lower()]
    assert not mine, mine
