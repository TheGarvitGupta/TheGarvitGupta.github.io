# Accounts: every player gives an email, which is their way back to the game from another device. Nothing is checked
# about it. The game keeps its whole save on the board's server, and a link emailed to them opens it anywhere.
import json, os, subprocess
from harness import player, tick, saved, ROOT

def posts(page, path): return [json.loads(b) for m, u, b in page.asked if m == 'POST' and u.split('?')[0].endswith(path)]
async def sheet(page): return (await page.evaluate('T.state()'))['sheet']
async def shown(page, id): return await page.evaluate('!document.getElementById(%s).hidden' % json.dumps(id))

async def test_the_worker_keeps_players_and_sends_their_emails(t):
    """The worker, in Node with SQLite for its database: accounts, links, and every kind of email, when each is sent and when not."""
    r = subprocess.run(['node', os.path.join(ROOT, 'packman', 'tests', 'worker_accounts.mjs'), os.path.join(ROOT, 'extras', 'cloudflare-worker', 'packman-scores.js')],
                       capture_output=True, text=True)
    assert r.returncode == 0 and 'FAIL' not in r.stdout and r.stdout.count('ok  ') >= 47, r.stdout + r.stderr[-1500:]

NINE = ['Four Square', 'Flip', 'Honeycomb', 'Home', 'Lantern', 'Tilt', 'Squeeze', 'Five Alive', 'Dozen']   # the first nine levels
NINED = {k: {'t': 9, 'm': 4} for k in NINE}   # (packed: so the email is needed, and asked for)

async def test_a_new_player_can_start_without_an_email(t):
    page = await player(await t.page(save=False))
    if await sheet(page) == 'm-help': await page.click('#m-help .btn.go'); await tick(page, 600)
    assert await sheet(page) == 'm-name' and 'optional' in await page.get_attribute('#email', 'placeholder')
    await page.click('#name-go'); await tick(page, 400)
    assert await sheet(page) == 'm-name', 'started with no name'
    await page.fill('#name', 'Ada'); await page.fill('#email', 'ada at home'); await page.click('#name-go'); await tick(page, 400)
    assert await sheet(page) == 'm-name', 'started with an email that is not one'
    await page.fill('#email', ''); await page.click('#name-go'); await tick(page, 600)
    assert await sheet(page) != 'm-name', 'an email was needed at the start'
    s = await page.evaluate('T.state().save')
    assert s['name'] == 'Ada' and not s.get('email'), s
    assert not page.errors, page.errors

async def test_a_player_without_an_email_is_not_asked_for_one_before_the_tenth_level(t):
    page = await player(await t.page(save=saved('Home', email=None, done={k: {'t': 5, 'm': 4} for k in NINE[:8]})))
    assert await sheet(page) is None
    assert not page.errors, page.errors

async def test_from_the_tenth_level_an_email_is_needed_to_play_on(t):
    page = await player(await t.page(save=saved('Diamond', email=None, done={k: {'t': 5, 'm': 4} for k in NINE})))
    assert await sheet(page) == 'm-name' and 'safe' in await page.inner_text('#name-h')
    assert await page.input_value('#name') == 'Packer' and await page.get_attribute('#email', 'placeholder') == 'Your email'
    await page.evaluate('document.getElementById("m-name").click()'); await tick(page, 400)   # (a tap on the dark round the sheet)
    assert await sheet(page) == 'm-name', 'the sheet could be closed with no email'
    await page.click('#name-go'); await tick(page, 400)
    assert await sheet(page) == 'm-name', 'played on with no email'
    await page.fill('#email', 'packer@example.com'); await page.click('#name-go'); await tick(page, 600)
    s = await page.evaluate('T.state().save')
    assert await sheet(page) != 'm-name' and s['email'] == 'packer@example.com' and len(s['done']) == 9
    assert not page.errors, page.errors

async def test_the_ninth_win_asks_for_the_email_before_the_tenth_level(t):
    page = await player(await t.page(save=saved('Dozen', email=None, done={k: {'t': 5, 'm': 4} for k in NINE[:8]})))
    assert await sheet(page) is None
    await page.click('.dev button:has-text("Solver")'); await tick(page, 9000)
    assert await sheet(page) == 'm-win'
    await page.click('#win-next'); await tick(page, 1200)
    assert await sheet(page) == 'm-name' and 'safe' in await page.inner_text('#name-h')
    assert not page.errors, page.errors

def board(taken=False, back=None):
    def answer(request):
        path = request.url.split('?')[0]
        if path.endswith('/player'): return {'error': 'taken'} if taken and 'claimed' not in request.url else {'ok': True, 'fresh': True}
        if path.endswith('/recover'): return {'ok': True}
        if path.endswith('/signin'): return back or {'error': 'link'}
        if request.method == 'DELETE': return {'gone': 3}
        return {'top': [], 'of': 0, 'levels': 50}
    return answer

async def test_the_email_and_the_whole_game_go_to_the_server(t):
    page = await player(await t.page(live=True, board=board(), save=saved('Home', email=None, done=NINED)))
    await page.fill('#email', 'packer@example.com'); await page.click('#name-go'); await tick(page, 800)
    sent = posts(page, '/player')
    assert sent and sent[0]['email'] == 'packer@example.com' and sent[0]['pid'] == 'test-0000-0000-0000-0000' and 'Flip' in sent[0]['save']['done'], sent
    n = len(sent)
    await page.click('#b-sound'); await tick(page, 4000)   # (anything saved goes up a moment later)
    later = posts(page, '/player')
    assert len(later) > n and later[-1]['save']['mute'] is True, 'the save was not sent when it changed'
    assert not page.errors, page.errors

async def test_an_email_with_a_game_already_offers_a_link_to_it(t):
    page = await player(await t.page(live=True, board=board(taken=True), save=saved('Home', email=None, done=NINED)))
    await page.fill('#email', 'ada@example.com'); await page.click('#name-go'); await tick(page, 800)
    assert await sheet(page) == 'm-name' and await shown(page, 'name-taken'), 'no word that the email has a game'
    await page.click('#name-claim'); await tick(page, 800)
    assert posts(page, '/recover') == [{'email': 'ada@example.com'}]
    assert 'on its way' in await page.inner_text('#recover-sent')
    assert not page.errors, page.errors

async def test_get_your_game_back_sends_a_link(t):
    page = await player(await t.page(live=True, board=board(), save=saved('Home', email=None, done=NINED)))
    await page.click('#name-back'); await tick(page, 600)
    await page.fill('#recover-email', 'nope'); await page.click('#recover-go'); await tick(page, 400)
    assert not posts(page, '/recover'), 'a link was asked for with no email'
    await page.fill('#recover-email', 'Ada@example.com'); await page.click('#recover-go'); await tick(page, 800)
    assert posts(page, '/recover') == [{'email': 'ada@example.com'}]
    assert await shown(page, 'recover-sent') and await page.evaluate('getComputedStyle(document.getElementById("recover-form")).display') == 'none'
    await page.click('#recover-back'); await tick(page, 600)
    assert await sheet(page) == 'm-name', 'back did not go back to the name sheet'
    assert not page.errors, page.errors

TOKEN = 'ab' * 24

async def test_a_link_opens_the_game_from_the_email(t):
    got = {'pid': 'game-1111-2222-3333-4444', 'name': 'Ada', 'email': 'ada@example.com',
           'save': {'v': 3, 'done': {'Flip': {'t': 9, 'm': 4}}, 'sent': {'Flip': 1}, 'last': 'Flip', 'seen': True, 'eyeTip': 1, 'name': 'Ada', 'email': 'ada@example.com', 'pid': 'old'}}
    here = saved('Home', email=None, name='Bo', done={'Four Square': {'t': 5, 'm': 4}, 'Flip': {'t': 3, 'm': 3}})
    page = await t.page('/packman/?signin=' + TOKEN, live=True, board=board(back=got), save=here)
    await tick(page, 3000); page = await player(page)
    s = await page.evaluate('T.state().save')
    assert s['pid'] == 'game-1111-2222-3333-4444' and s['name'] == 'Ada' and s['email'] == 'ada@example.com', s
    assert s['done']['Four Square'] == {'t': 5, 'm': 4}, 'what was packed here was lost'
    assert s['done']['Flip'] == {'t': 3, 'm': 3}, 'the better packing here was not kept'
    wins = posts(page, '/api/packman')
    assert any(b['level'] == 'Flip' and b['pid'] == s['pid'] and b['t'] == 3 for b in wins), 'and not sent to the board under the game\'s id'
    assert 'signin' not in page.url and await sheet(page) != 'm-name'
    gone = [u for m, u, b in page.asked if m == 'DELETE']
    assert len(gone) == 1 and gone[0].endswith('?pid=test-0000-0000-0000-0000'), 'this device\'s own line was not taken off the board: %s' % gone
    assert await page.evaluate('localStorage.getItem("packman.gone")') == '[]', 'and it is still waiting to go'
    assert not page.errors, page.errors

async def test_a_game_got_back_opens_on_its_next_level(t):
    """Not level 1 of this device: the game's own chapter, at its first level not packed yet."""
    got = {'pid': 'game-1111-2222-3333-4444', 'name': 'Ada', 'email': 'ada@example.com',
           'save': {'v': 3, 'done': {'Rival 1': {'t': 90, 'm': 6}}, 'sent': {'Rival 1': 1}, 'last': 'Rival 1', 'seen': True, 'name': 'Ada', 'email': 'ada@example.com'}}
    page = await t.page('/packman/?signin=' + TOKEN, live=True, board=board(back=got), save=saved('Home', email=None, name='Bo'))
    await tick(page, 3000); await page.wait_for_load_state(); await tick(page, 1000); await page.wait_for_function('document.getElementById("lv-name").textContent'); page = await player(page)
    assert (await page.evaluate('T.state()'))['level'] == 'Square Off'
    got['save']['done'] = {}; got['save']['last'] = 'Flip'
    page = await t.page('/packman/?signin=' + TOKEN, live=True, board=board(back=got), save=saved('Home', email=None, name='Bo', done={'Home': {'t': 5, 'm': 4}}))
    await tick(page, 3000); await page.wait_for_load_state(); await tick(page, 1000); await page.wait_for_function('document.getElementById("lv-name").textContent'); page = await player(page)
    s = await page.evaluate('T.state()')
    assert s['level'] != 'Home' and s['level'] not in s['save']['done'], s['level']   # (the first of the seventeen not packed here)
    assert not page.errors, page.errors

async def test_delete_everything_deletes_it_on_the_server_too(t):
    page = await player(await t.page(live=True, board=board(), save=saved('Home', done={'Flip': {'t': 9, 'm': 4}})))
    await page.click('#reset-ask'); await tick(page, 500)
    assert await sheet(page) == 'm-reset' and 'every device' in await page.inner_text('#m-reset')
    assert not await page.query_selector('#reset-board'), 'there is still a choice to keep some of it'
    await page.click('#reset-go'); await page.wait_for_url('**reset=**'); await page.wait_for_load_state(); await tick(page, 3000); page = await player(page)
    s = await page.evaluate('T.state().save')
    assert not s.get('done') and s.get('pid') != 'test-0000-0000-0000-0000', s
    gone = [u for m, u, b in page.asked if m == 'DELETE']
    assert any(u.endswith('?pid=test-0000-0000-0000-0000&all=1') for u in gone), gone
    assert await page.evaluate('localStorage.getItem("packman.erase")') == '[]', 'and it is still waiting to go'
    assert not await shown(page, 'name-gone')
    assert not page.errors, page.errors

async def test_a_game_deleted_on_another_device_starts_afresh_here(t):
    def answer(request):
        if request.url.split('?')[0].endswith('/player'): return {'error': 'deleted'}
        return board()(request)
    page = await t.page(live=True, board=answer, save=saved('Home', done={'Flip': {'t': 9, 'm': 4}}))   # (it asks the server a moment after it opens)
    await page.wait_for_url('**reset=**'); await page.wait_for_load_state(); await tick(page, 3000); page = await player(page)
    s = await page.evaluate('T.state().save')
    assert not s.get('done') and not s.get('email'), s
    assert await sheet(page) == 'm-name' and await shown(page, 'name-gone'), 'it does not say why'
    assert not [u for m, u, b in page.asked if m == 'DELETE' and 'all=1' in u], 'it was deleted again'
    assert not page.errors, page.errors

async def test_a_used_link_says_so_and_offers_a_new_one(t):
    page = await t.page('/packman/?signin=' + TOKEN, live=True, board=board(), save=saved('Home'))
    await tick(page, 3000); page = await player(page)
    assert await sheet(page) == 'm-recover' and 'expired' in await page.inner_text('#recover-h')
    assert await page.input_value('#recover-email') == 'packer@example.com'
    await page.click('#recover-back'); await tick(page, 600)
    assert await sheet(page) is None and (await page.evaluate('T.state().save'))['pid'] == 'test-0000-0000-0000-0000'
    assert not page.errors, page.errors

async def test_on_this_machine_nothing_is_sent(t):
    page = await player(await t.page(board=board(), save=saved('Home', email=None, done=NINED)))
    await page.fill('#email', 'packer@example.com'); await page.click('#name-go'); await tick(page, 4000)
    assert not posts(page, '/player')
    await page.evaluate('Packman.play("Flip")'); await tick(page, 4000)
    assert not posts(page, '/player')

# ---- the emails themselves ----

MAKE_ALL = r"""
const M = require(process.argv[1]), vm = require('vm'), fs = require('fs'), path = require('path'), c = {}; c.window = c; vm.createContext(c);
for (const f of ['geom.js', 'levels.js']) vm.runInContext(fs.readFileSync(path.join(process.argv[2], f), 'utf8'), c);
const out = M.kinds.map((k) => Object.assign({ kind: k.kind, title: k.title }, M.make(k.kind, k.sample)));
// and the new-level email as the worker makes it for each level with a day of its own
c.PackmanLevels.filter((l) => l.rival).forEach((l, i) => out.push(Object.assign({ kind: 'level', title: l.name },
  M.make('level', { name: 'Ada', level: l.name, intro: l.intro, picture: 'rival-' + (i + 1) + '.gif', link: 'https://www.garvitgupta.com/packman/?play=' + encodeURIComponent(l.name), quiet: 'q' }))));
console.log(JSON.stringify(out));
"""

def emails():
    r = subprocess.run(['node', '-e', MAKE_ALL, os.path.join(ROOT, 'extras', 'cloudflare-worker', 'packman-mail.js'), os.path.join(ROOT, 'packman')], capture_output=True, text=True, check=True)
    return json.loads(r.stdout)

async def test_every_email_has_its_pictures_a_way_in_and_plain_text(t):
    import re
    made = emails()
    assert {m['kind'] for m in made} == {'welcome', 'signin', 'passed', 'level'}, [m['kind'] for m in made]
    for m in made:
        what = '%s (%s)' % (m['title'], m['kind'])
        for src in re.findall(r'<img src="([^"]+)"', m['html']):
            assert src.startswith('https://www.garvitgupta.com/packman/mail/'), '%s: a picture from elsewhere, %s' % (what, src)
            f = os.path.join(ROOT, 'packman', 'mail', src.rsplit('/', 1)[1])
            assert os.path.isfile(f) and os.path.getsize(f) < 600 * 1024, '%s: no picture %s, or it is too big for an email (run tools/mail-art.py)' % (what, src)
        assert 'logo.png' in m['html'], what
        assert m['subject'] and len(m['subject']) < 80 and m['text'].strip(), what
        assert re.search(r'<a href="https://www\.garvitgupta\.com/packman/[^"]*"[^>]*>(Open my game|Get my game back|Play now)</a>', m['html']), '%s: no button into the game' % what
        if m['kind'] in ('passed', 'level'): assert 'Unsubscribe' in m['html'] and 'Unsubscribe: ' in m['text'], '%s: no way to turn it off' % what
        else: assert 'Unsubscribe' not in m['html'], '%s: a way to turn off an email that is not a notification' % what
        assert '<script' not in m['html'].lower() and 'undefined' not in m['html'] and 'undefined' not in m['text'], what
    levels = [m for m in made if m['kind'] == 'level' and m['title'] != 'A new level is open']
    assert len(levels) == 7 and all('Play now' in m['html'] and '?play=' in m['html'] and 'rival-' in m['html'] for m in levels)

async def test_play_now_opens_that_level(t):
    page = await player(await t.page('/packman/?play=Rock%20Bottom'))
    assert (await page.evaluate('T.state()'))['level'] == 'Rock Bottom'
    page = await player(await t.page('/packman/?play=Double+Cross'))
    assert (await page.evaluate('T.state()'))['level'] == 'Double Cross'
    page = await player(await t.page('/packman/?play=Rival%201'))   # (the link in the first email, sent before the levels had names)
    assert (await page.evaluate('T.state()'))['level'] == 'Opening Hand'
    page = await player(await t.page('/packman/?play=Nothing%20Like%20It', save=saved('Flip')))
    assert (await page.evaluate('T.state()'))['level'] == 'Flip', 'a name that is no level does not open the one they were on'
    assert not page.errors, page.errors

# ---- one player on two devices ----

async def test_what_another_device_did_is_folded_in(t):
    """The server answers a save with the game as all the player's devices have it: a level packed on the other one opens
    here, a hint used there is used here, and this device keeps its own sound and the level it is on."""
    other = {'v': 3, 'name': 'Packer', 'email': 'packer@example.com', 'named': 1, 'pid': 'test-0000-0000-0000-0000', 'last': 'Rock Bottom', 'mute': True,
             'done': {'Four Square': {'t': 5, 'm': 4}, 'Flip': {'t': 7, 'm': 4}}, 'sent': {'Four Square': 1, 'Flip': 1}, 'hints': {'chapter 0': {'n': 1, 'day': '2025-10-09'}}, 'seen': True}
    def answer(request):
        path = request.url.split('?')[0]
        if path.endswith('/player'):
            here = json.loads(request.post_data)['save']
            day = (here.get('hints') or {}).get('chapter 0', {}).get('day', '2025-10-09')   # (the same day as here: one hint used there)
            return {'ok': True, 'fresh': False, 'save': dict(other, mute=here.get('mute', False), last=here.get('last'), hints={'chapter 0': {'n': 1, 'day': day}})}
        return {'top': [], 'of': 0, 'levels': 50}
    page = await player(await t.page(live=True, board=answer, save=saved('Four Square', done={'Four Square': {'t': 6, 'm': 4}})))
    await tick(page, 2500)   # (asked a moment after the game opens)
    s = await page.evaluate('T.state().save')
    assert s['done'].get('Flip') == {'t': 7, 'm': 4} and s['done']['Four Square'] == {'t': 5, 'm': 4}, s['done']
    assert s['hints']['chapter 0']['n'] == 1 and not s.get('mute') and s['last'] == 'Four Square', s
    stored = json.loads(await page.evaluate('localStorage.getItem("packman.v1")'))
    assert 'Flip' in stored['done'], 'folded in, and not kept'
    await page.click('#chip'); await tick(page, 800)
    assert await page.evaluate('!document.querySelector("#grid .lv[data-name=\\"Home\\"]").classList.contains("shut")'), 'the level after the one packed elsewhere is still shut'
    assert not page.errors, page.errors

MERGE = r"""
const S = require(process.argv[1]), out = [];
const a = { pid: 'p', name: 'A', named: 2, done: { X: { t: 9, m: 4 }, Y: { t: 5, m: 3 } }, sent: { X: 1, Y: 1 }, hints: { c: { n: 2, day: '2026-01-02' }, d: { n: 0, day: '2026-01-01' } }, mute: true, seen: true };
const b = { pid: 'p', name: 'B', named: 1, done: { X: { t: 8, m: 4 }, Z: { t: 1, m: 1 } }, sent: { X: 1 }, hints: { c: { n: 1, day: '2026-01-02' }, d: { n: 3, day: '2026-01-02' } }, mute: false, finished: true };
const m = S.merge(a, b), n = S.merge(b, a);
out.push(m.done.X.t === 8 && m.done.Y && m.done.Z, m.sent.X === 1 && m.sent.Y === 1 && !m.sent.Z, m.hints.c.n === 1 && m.hints.d.n === 3 && m.hints.d.day === '2026-01-02',
  m.name === 'A' && n.name === 'A', m.mute === true && n.mute === false, m.seen && m.finished && n.seen && n.finished,
  JSON.stringify(m.done) === JSON.stringify(Object.assign({}, n.done)) || Object.keys(m.done).sort().join() === Object.keys(n.done).sort().join(),
  S.same(m, S.merge(m, b)), !S.same(a, m));
console.log(JSON.stringify(out));
"""

async def test_the_merge_keeps_the_best_of_both(t):
    r = subprocess.run(['node', '-e', MERGE, os.path.join(ROOT, 'packman', 'sync.js')], capture_output=True, text=True, check=True)
    got = json.loads(r.stdout)
    names = ['the better packing of each level, and every level of both', 'on the board if the packing kept was sent', 'a day\'s hints: the fewer left, or the later day\'s',
             'the name given last', 'the sound is the device\'s own', 'flags once on either are on', 'either way round, the same levels', 'made one, again, it is the same', 'and it is not what it was']
    bad = [n for n, ok in zip(names, got) if not ok]
    assert not bad, bad
