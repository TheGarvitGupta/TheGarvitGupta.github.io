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
    assert r.returncode == 0 and 'FAIL' not in r.stdout and r.stdout.count('ok  ') >= 39, r.stdout + r.stderr[-1500:]

async def test_a_new_player_cannot_start_without_an_email(t):
    page = await player(await t.page(save=False))
    if await sheet(page) == 'm-help': await page.click('#m-help .btn.go'); await tick(page, 600)
    assert await sheet(page) == 'm-name'
    await page.fill('#name', 'Ada'); await page.click('#name-go'); await tick(page, 400)
    assert await sheet(page) == 'm-name', 'started with no email'
    await page.fill('#email', 'ada at home'); await page.click('#name-go'); await tick(page, 400)
    assert await sheet(page) == 'm-name', 'started with an email that is not one'
    await page.fill('#email', ' Ada@Example.com '); await page.click('#name-go'); await tick(page, 600)
    assert await sheet(page) != 'm-name'
    s = await page.evaluate('T.state().save')
    assert s['name'] == 'Ada' and s['email'] == 'ada@example.com', s
    assert not page.errors, page.errors

async def test_a_player_from_before_emails_is_asked_for_one_and_keeps_their_game(t):
    page = await player(await t.page(save=saved('Home', email=None, done={'Four Square': {'t': 5, 'm': 4}})))
    assert await sheet(page) == 'm-name'
    assert await page.input_value('#name') == 'Packer' and await page.input_value('#email') == ''
    await page.evaluate('document.getElementById("m-name").click()'); await tick(page, 400)   # (a tap on the dark round the sheet)
    assert await sheet(page) == 'm-name', 'the sheet could be closed with no email'
    await page.fill('#email', 'packer@example.com'); await page.click('#name-go'); await tick(page, 600)
    s = await page.evaluate('T.state().save')
    assert await sheet(page) != 'm-name' and s['email'] == 'packer@example.com' and 'Four Square' in s['done']
    assert not page.errors, page.errors

def board(taken=False, back=None):
    def answer(request):
        path = request.url.split('?')[0]
        if path.endswith('/player'): return {'error': 'taken'} if taken and 'claimed' not in request.url else {'ok': True, 'fresh': True}
        if path.endswith('/recover'): return {'ok': True}
        if path.endswith('/signin'): return back or {'error': 'link'}
        return {'top': [], 'of': 0, 'levels': 50}
    return answer

async def test_the_email_and_the_whole_game_go_to_the_server(t):
    page = await player(await t.page(live=True, board=board(), save=saved('Home', email=None, done={'Flip': {'t': 9, 'm': 4}})))
    await page.fill('#email', 'packer@example.com'); await page.click('#name-go'); await tick(page, 800)
    sent = posts(page, '/player')
    assert sent and sent[0]['email'] == 'packer@example.com' and sent[0]['pid'] == 'test-0000-0000-0000-0000' and 'Flip' in sent[0]['save']['done'], sent
    n = len(sent)
    await page.click('#b-sound'); await tick(page, 4000)   # (anything saved goes up a moment later)
    later = posts(page, '/player')
    assert len(later) > n and later[-1]['save']['mute'] is True, 'the save was not sent when it changed'
    assert not page.errors, page.errors

async def test_an_email_with_a_game_already_offers_a_link_to_it(t):
    page = await player(await t.page(live=True, board=board(taken=True), save=saved('Home', email=None)))
    await page.fill('#email', 'ada@example.com'); await page.click('#name-go'); await tick(page, 800)
    assert await sheet(page) == 'm-name' and await shown(page, 'name-taken'), 'no word that the email has a game'
    await page.click('#name-claim'); await tick(page, 800)
    assert posts(page, '/recover') == [{'email': 'ada@example.com'}]
    assert 'on its way' in await page.inner_text('#recover-sent')
    assert not page.errors, page.errors

async def test_get_your_game_back_sends_a_link(t):
    page = await player(await t.page(live=True, board=board(), save=saved('Home', email=None)))
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
    assert not page.errors, page.errors

async def test_a_used_link_says_so_and_offers_a_new_one(t):
    page = await t.page('/packman/?signin=' + TOKEN, live=True, board=board(), save=saved('Home'))
    await tick(page, 3000); page = await player(page)
    assert await sheet(page) == 'm-recover' and 'run out' in await page.inner_text('#recover-h')
    assert await page.input_value('#recover-email') == 'packer@example.com'
    await page.click('#recover-back'); await tick(page, 600)
    assert await sheet(page) is None and (await page.evaluate('T.state().save'))['pid'] == 'test-0000-0000-0000-0000'
    assert not page.errors, page.errors

async def test_on_this_machine_nothing_is_sent(t):
    page = await player(await t.page(board=board(), save=saved('Home', email=None)))
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
        if m['kind'] in ('passed', 'level'): assert 'No more emails like this' in m['html'] and 'No more emails like this' in m['text'], '%s: no way to turn it off' % what
        else: assert 'No more emails' not in m['html'], '%s: a way to turn off an email that is not a notification' % what
        assert '<script' not in m['html'].lower() and 'undefined' not in m['html'] and 'undefined' not in m['text'], what
    levels = [m for m in made if m['kind'] == 'level' and m['title'].startswith('Rival')]
    assert len(levels) == 7 and all('Play now' in m['html'] and '?play=Rival%20' in m['html'] for m in levels)

async def test_play_now_opens_that_level(t):
    page = await player(await t.page('/packman/?play=Rival%203'))
    assert (await page.evaluate('T.state()'))['level'] == 'Rival 3'
    page = await player(await t.page('/packman/?play=Rival+5'))
    assert (await page.evaluate('T.state()'))['level'] == 'Rival 5'
    page = await player(await t.page('/packman/?play=Nothing%20Like%20It', save=saved('Flip')))
    assert (await page.evaluate('T.state()'))['level'] == 'Flip', 'a name that is no level does not open the one they were on'
    assert not page.errors, page.errors
