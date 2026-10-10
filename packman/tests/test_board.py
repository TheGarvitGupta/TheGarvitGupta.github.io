# The leaderboard, with a stand-in board in place of the real one. (Begun: how the rows are shown.)
import json
from harness import player, tick, drag, saved

def people(n):
    return [{'name': 'Player %d' % (i + 1), 'n': 50 - i, 'm': 400 + 10 * i, 't': 1000.5 + 60 * i, 'a': 1000 + i} for i in range(n)]

async def board(t, rows, **more):
    data = {'top': rows, 'of': max(len(rows), 1), 'levels': 50}; data.update(more)
    page = await player(await t.page(board=data))
    await page.click('#b-board'); await tick(page, 800)
    sheet = await page.evaluate('T.state().sheet')
    assert sheet == 'm-board', 'the leaderboard button opened %s' % sheet
    return page

ROWS = '''[].map.call(document.querySelectorAll('#board-ranks li:not(.head):not(.gap)'), function (li) { var p = li.querySelector('.pos');
  return { cls: li.className, medal: !!p.querySelector('svg'), pos: p.textContent.trim(), said: (p.querySelector('svg') || { getAttribute: function () { return ''; } }).getAttribute('aria-label'),
           who: li.querySelector('.who').textContent, wide: p.querySelector('svg') ? p.querySelector('svg').getBoundingClientRect().width : 0, tall: li.getBoundingClientRect().height }; })'''

async def test_the_first_three_wear_medals_and_the_rest_their_numbers(t):
    page = await board(t, people(8))
    rows = await page.evaluate(ROWS)
    assert len(rows) == 8, '%d rows shown of 8' % len(rows)
    assert [r['medal'] for r in rows] == [True] * 3 + [False] * 5, [r['medal'] for r in rows]
    assert [r['pos'] for r in rows] == [str(i) for i in range(1, 9)], 'the places read %s' % [r['pos'] for r in rows]
    assert [r['said'] for r in rows[:3]] == ['1st', '2nd', '3rd'], [r['said'] for r in rows[:3]]
    assert all('t%d' % (i + 1) in rows[i]['cls'] for i in range(3)) and not any('top' in r['cls'] for r in rows[3:])
    assert all(20 < r['wide'] < 32 for r in rows[:3]), 'the medals are drawn %s wide' % [r['wide'] for r in rows[:3]]
    assert max(r['tall'] for r in rows) - min(r['tall'] for r in rows) < 2, 'a medal makes its row taller than the rest: %s' % [r['tall'] for r in rows]
    assert not page.errors, page.errors

async def test_a_board_of_two_has_two_medals_and_an_empty_one_none(t):
    page = await board(t, people(2))
    assert [r['medal'] for r in await page.evaluate(ROWS)] == [True, True]
    page = await board(t, [])
    assert await page.evaluate('document.querySelectorAll("#board-ranks svg").length') == 0
    assert 'Nobody yet' in await page.inner_text('#board-ranks')

async def test_the_player_is_still_picked_out_among_the_medals(t):
    """Whoever is looking has their own row marked. In the first three it is marked and has its medal too."""
    rows = people(6)
    page = await player(await t.page(board={'top': rows, 'of': 6, 'levels': 50}))
    rows[1]['a'] = await page.evaluate('Packman.me()')   # (a player's row is known by a number made from their id)
    page = await board(t, rows)
    got = await page.evaluate(ROWS)
    assert 'me' in got[1]['cls'] and 't2' in got[1]['cls'] and got[1]['medal'], got[1]

# ---- what is sent: the game served as a player has it, under a name that is not this machine's ----

def answer(request):
    """The stand-in board: it takes whatever is sent and says the player is second of nine."""
    return {'top': people(5), 'of': 9, 'rank': 2, 'levels': 50}

def sent(page): return [json.loads(body) for method, url, body in page.asked if method == 'POST']

async def win(t, name, level='Four Square', **more):
    """Open the level as this player on the real site, pack it by hand, and wait for the win sheet."""
    page = await player(await t.page(level=level, live=True, board=answer, save=saved(level, name=name, **more)))
    for i, s in enumerate(await page.evaluate('PackmanLevels.filter(function (l) { return l.name === %s; })[0].solution' % json.dumps(level))): await drag(page, i, s[0], s[1])
    await tick(page, 3000)
    assert await page.evaluate('T.state().sheet') == 'm-win', 'the level was packed and no win is shown'
    return page

async def test_a_win_is_sent_once_with_what_the_board_needs(t):
    page = await win(t, 'Ada')
    got = sent(page)
    assert len(got) == 1, '%d scores were sent for one win' % len(got)
    s = got[0]
    assert s['level'] == 'Four Square' and s['name'] == 'Ada' and s['pid'] == 'test-0000-0000-0000-0000' and s['m'] == 4 and 0 < s['t'] < 60, s
    assert len(s['p']) == 4 and all(len(q) == 3 for q in s['p']), 'where every shape ended up goes with it: %s' % s['p']
    assert 'You are 2nd of 9' in await page.inner_text('#win-lb-note')
    assert not page.errors, page.errors

async def test_swordfish_plays_off_the_record(t):
    """Under the name Swordfish, however its capitals fall, nothing is sent to the board: not a win, and not the wins saved before."""
    for name in ('Swordfish', 'swordfish', 'SWORDFISH', 'sWoRdFiSh'):
        page = await win(t, name, done={'Flip': {'t': 9, 'm': 4}})   # (Flip was won before and never sent: it would go up as the game opens)
        assert sent(page) == [], 'as %s, the board was sent %s' % (name, [s['level'] for s in sent(page)])
        assert any(m == 'GET' for m, _, _ in page.asked), 'the board is still read'
        assert await page.evaluate('!document.getElementById("win-lb").hidden'), 'the win sheet still shows the board'
        assert 'not sent' in await page.inner_text('#win-lb-note')
        assert 'Four Square' in (await page.evaluate('T.state().save'))['done'], 'the win is still saved on the player\'s own machine'
        assert not page.errors, page.errors
        await page.context.close()

async def test_a_name_that_only_has_swordfish_in_it_is_sent_as_usual(t):
    for name in ('Swordfish2', 'Mr Swordfish'):
        page = await win(t, name)
        assert [s['name'] for s in sent(page) if s['level'] == 'Four Square'] == [name], sent(page)
        await page.context.close()

async def test_wins_saved_before_go_up_when_the_game_opens(t):
    page = await player(await t.page(live=True, board=answer, save=saved('Home', name='Ada', done={'Four Square': {'t': 5, 'm': 4}, 'Flip': {'t': 9, 'm': 4}})))
    await tick(page, 3000)
    assert sorted(s['level'] for s in sent(page)) == ['Flip', 'Four Square'], [s['level'] for s in sent(page)]

async def test_nothing_is_sent_from_this_machine(t):
    page = await player(await t.page(board=answer, save=saved('Four Square', name='Ada', done={'Flip': {'t': 9, 'm': 4}})))
    for i, s in enumerate(await page.evaluate('Packman.level().solution')): await drag(page, i, s[0], s[1])
    await tick(page, 3000)
    assert sent(page) == [], 'on localhost the board was sent %s' % sent(page)

# ---- taking a place among the first three ----

def moved(was, now, holder='Sonam'):
    """A stand-in board on which the player stands at was before their win is sent and at now after it (None: not on the board)."""
    def rows(mine):
        top = [{'name': n, 'n': 40 - 5 * i, 'm': 500, 't': 3000, 'a': 500 + i} for i, n in enumerate(['Haojun', 'KKG', holder, 'Sam', 'abc', 'wes'])]
        if mine: top.insert(mine - 1, {'name': 'Ada', 'n': 99, 'm': 1, 't': 1, 'a': 0})
        return top
    def answer(request):
        if request.method == 'GET': return {'top': rows(None if was is None else was), 'of': 9, 'levels': 50, **({'rank': was} if was else {})}
        return {'top': rows(now), 'of': 9, 'rank': now, 'levels': 50}
    return answer

async def after_win(t, board, **more):
    page = await player(await t.page(level='Four Square', live=True, board=board, save=saved('Four Square', name='Ada', **more)))
    for i, s in enumerate(await page.evaluate('PackmanLevels[0].solution')): await drag(page, i, s[0], s[1])
    await tick(page, 3500)
    r = await page.evaluate('''({ coup: document.getElementById('win-coup').hidden ? null : document.getElementById('coup-say').textContent, cls: document.getElementById('win-coup').className,
      medal: (document.querySelector('#coup-medal svg') || { getAttribute: function () { return null; } }).getAttribute('aria-label'),
      prize: !document.getElementById('win-prize').hidden, save: JSON.parse(localStorage.getItem('packman.v1')), sheet: (document.querySelector('.sheet.open') || {}).id })''')
    assert r['sheet'] == 'm-win' and not page.errors, (r['sheet'], page.errors)
    return page, r

async def test_fourth_past_third_overthrows_and_wins_the_prize_once(t):
    page, r = await after_win(t, moved(4, 3))
    assert r['coup'] and 'overthrew Sonam' in r['coup'] and '3rd' in r['coup'], 'the win sheet says: %s' % r['coup']
    assert r['medal'] == '3rd' and 't3' in r['cls']
    assert r['prize'], 'in among the first three for the first time, and no prize is shown'
    assert r['save']['top3']['rank'] == 3 and r['save']['top3']['over'] == 'Sonam' and not r['save']['top3'].get('done')
    # and it is shown again when the game is next opened, until Done is pressed on it
    await page.reload(); await tick(page, 2500)
    assert await page.evaluate('document.querySelector(".sheet.open").id + "|" + !document.getElementById("win-prize").hidden + "|" + document.getElementById("win-title").textContent') == 'm-win|true|Top three!'
    await page.click('#prize-done'); await tick(page, 500)
    await page.reload(); await tick(page, 2500)
    assert await page.evaluate('!document.querySelector(".sheet.open")'), 'Done was pressed on the prize and it is shown again'

async def test_the_prize_is_not_won_twice(t):
    """Fallen out of the three and back in: an overthrow again, and no second prize."""
    page, r = await after_win(t, moved(4, 3), top3={'rank': 3, 'over': 'Sam', 'at': 1, 'done': True})
    assert r['coup'] and 'overthrew Sonam' in r['coup'] and not r['prize'], r

async def test_third_past_second_and_second_past_first_overthrow_without_a_prize(t):
    page, r = await after_win(t, moved(3, 2, holder='Bo'))
    assert r['coup'] and 'overthrew KKG' in r['coup'] and '2nd' in r['coup'] and r['medal'] == '2nd' and not r['prize'], r
    await page.context.close()
    page, r = await after_win(t, moved(2, 1))
    assert r['coup'] and 'overthrew Haojun' in r['coup'] and '1st' in r['coup'] and r['medal'] == '1st' and not r['prize'], r

async def test_from_far_down_straight_into_second(t):
    page, r = await after_win(t, moved(6, 2))
    assert r['coup'] and 'overthrew KKG' in r['coup'] and r['prize'], r

async def test_a_first_score_that_lands_in_the_three_counts(t):
    page, r = await after_win(t, moved(None, 3))
    assert r['coup'] and 'overthrew Sonam' in r['coup'] and r['prize'], r

async def test_no_overthrow_when_the_place_does_not_change_or_is_outside_the_three(t):
    for was, now in ((3, 3), (1, 1), (6, 4), (5, 5)):
        page, r = await after_win(t, moved(was, now))
        assert r['coup'] is None and not r['prize'] and 'top3' not in r['save'], 'from %s to %s: %s' % (was, now, r['coup'])
        await page.context.close()

async def test_no_overthrow_is_claimed_when_the_board_could_not_be_asked_first(t):
    """If where the player stood before is not known, nothing is said: they may have been there all along."""
    def answer(request):
        if request.method == 'GET': return {'error': 'busy'}
        return moved(4, 3)(request)
    page, r = await after_win(t, answer)
    assert r['coup'] is None and not r['prize'], r
