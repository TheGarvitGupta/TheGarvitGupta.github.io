# Every sound plays: sounds.js by itself, with a stand-in for what makes the notes.
SOUNDS = '''(function () {
  var notes = [], sfx = PackmanSounds(function (f, d, o) { notes.push([f, d, o || {}]); }), out = {};
  function play(name, fn) { notes = []; try { fn(); out[name] = notes; } catch (e) { out[name] = 'threw: ' + e.message; } }
  Object.keys(sfx).forEach(function (k) {
    if (k === 'voice') return;
    var args = k === 'fit' ? [[0], [0.5], [1]] : k === 'deal' ? [[4], [17], []] : k === 'fuse' ? [[3], [2], [1]] : [[]];
    args.forEach(function (a) { play(k + (a.length ? '(' + a[0] + ')' : ''), function () { sfx[k].apply(sfx, a); }); });
  });
  %s.forEach(function (v) { play('voice ' + v, function () { sfx.voice(v); }); });
  play('voice of no one', function () { sfx.voice('nobody-has-this-voice'); });
  return out;
})()'''
VOICES = '''PackmanFaces.map(function (f) { return f.voice; }).concat(PackmanPowers.map(function (p) { return p.voice; })).filter(function (v, i, a) { return v && a.indexOf(v) === i; })'''

async def sounds(t):
    page = await t.bare('faces.js', 'sounds.js')
    out = await page.evaluate(SOUNDS % VOICES)
    assert not page.errors, page.errors
    return page, out

async def test_every_sound_is_made_of_notes_that_can_be_played(t):
    """A note is a pitch, a length and a loudness; the browser throws on one that is nought or less, or not a number."""
    _, out = await sounds(t)
    bad = []
    for name, notes in out.items():
        if isinstance(notes, str): bad.append('%s %s' % (name, notes)); continue
        if not notes: bad.append('%s plays nothing' % name)
        for f, d, o in notes:
            nums = [f, d, o.get('to', 1), o.get('vol', 0.12)]
            if not all(isinstance(n, (int, float)) and n > 0 for n in nums) or o.get('at', 0) < 0 or o.get('type', 'sine') not in ('sine', 'triangle', 'square', 'sawtooth'):
                bad.append('%s has a note that cannot be played: %s' % (name, [f, d, o]))
            elif f > 5000 or d > 2 or o.get('vol', 0.12) > 0.25: bad.append('%s has a note out of all reason: %s' % (name, [f, d, o]))
    assert not bad, '\n'.join(bad)
    assert len(out) > 40, 'only %d sounds were found' % len(out)

async def test_every_personality_and_power_has_a_voice_of_its_own(t):
    """A voice that sounds.js does not know is given the plain one: a face named with a voice that is not there would go unnoticed."""
    _, out = await sounds(t)
    plain = out['voice of no one']
    assert plain == out['voice plain'], 'a voice nobody has should be the plain one'
    same = [n for n, notes in out.items() if n.startswith('voice ') and n not in ('voice plain', 'voice of no one') and notes == plain]
    assert not same, 'these have no voice of their own in sounds.js: %s' % same

async def test_the_browser_will_play_them(t):
    """The same notes put through the browser's own audio, made as game.js makes them, off the air."""
    page, out = await sounds(t)
    r = await page.evaluate('''(function (all) {
      var A = window.OfflineAudioContext || window.webkitOfflineAudioContext, bad = [];
      Object.keys(all).forEach(function (name) {
        var actx = new A(1, 44100 * 3, 44100);
        try { all[name].forEach(function (n) { var freq = n[0], dur = n[1], opts = n[2];
          var t = actx.currentTime + (opts.at || 0), o = actx.createOscillator(), g = actx.createGain();
          o.type = opts.type || 'sine'; o.frequency.setValueAtTime(freq, t);
          if (opts.to) o.frequency.exponentialRampToValueAtTime(opts.to, t + dur);
          g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(opts.vol || 0.12, t + 0.012); g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
          o.connect(g); g.connect(actx.destination); o.start(t); o.stop(t + dur + 0.02); }); } catch (e) { bad.push(name + ': ' + e.message); }
      });
      return bad;
    })''', {k: v for k, v in out.items() if not isinstance(v, str)})
    assert not r, '\n'.join(r)
