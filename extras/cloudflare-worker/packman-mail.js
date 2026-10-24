// Every email Packman sends, as the worker sends it and as the admin panel shows it (packman/tools/admin.py
// serves this file to its page, and build-worker.py pastes it into the worker). Each kind takes what it says about the
// player (their name, a link) and gives back the subject, the HTML and the plain text. The pictures are the game's own,
// made by packman/tools/mail-art.py into packman/mail/ (mail apps show no SVG and run no animation, so they are GIFs).
var PackmanMail = (function () {
  var INK = '#2B2140', SUN = '#FFC93C', MUT = '#6E6585', BG = '#FFF6E5', FONT = 'Nunito,Avenir Next,Avenir,Segoe UI,Arial,sans-serif';
  var ART = 'https://www.garvitgupta.com/packman/mail/', SITE = 'https://www.garvitgupta.com/packman/';
  function esc(s) { return String(s).replace(/[&<>"']/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]; }); }
  function nth(n) { var s = ['th', 'st', 'nd', 'rd'], v = n % 100; return n + (s[(v - 20) % 10] || s[v] || s[0]); }
  // One card in the colours of the game: the name at the top, a picture, a few lines, one big button, and the link
  // written out under it for mail apps that drop buttons. A notification says how to have no more of them.
  function page(d, o) {
    var art = d.art || ART, row = function (html, pad) { return '<tr><td style="padding:' + (pad || '8px 28px') + '">' + html + '</td></tr>'; };
    var p = function (t) { return row('<p style="margin:0;font:16px/1.55 ' + FONT + ';color:' + INK + '">' + t + '</p>'); };
    return '<!doctype html><html><head><meta name="color-scheme" content="light"><meta name="viewport" content="width=device-width"></head>' +
      '<body style="margin:0;padding:0;background:' + BG + '">' +
      '<div style="display:none;max-height:0;overflow:hidden">' + esc(o.preview) + '</div>' +
      '<table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:' + BG + '"><tr><td align="center" style="padding:28px 12px">' +
      '<table role="presentation" cellpadding="0" cellspacing="0" style="max-width:480px;width:100%;background:#ffffff;border:3px solid ' + INK + ';border-radius:24px;border-collapse:separate">' +
      row('<a href="' + esc(SITE) + '" style="text-decoration:none"><img src="' + art + 'logo.png" width="156" alt="Packman" style="display:block;border:0;height:auto"></a>', '24px 28px 6px') +
      (o.picture ? '<tr><td align="center" style="padding:10px 28px 6px"><img src="' + art + o.picture + '" width="' + (o.wide || 420) + '" alt="' + esc(o.alt || '') +
        '" style="display:block;width:100%;max-width:' + (o.wide || 420) + 'px;height:auto;border:0;border-radius:16px"></td></tr>' : '') +
      row('<h1 style="margin:0;font:800 25px/1.25 ' + FONT + ';color:' + INK + '">' + o.title + '</h1>', '14px 28px 4px') +
      o.lines.map(p).join('') +
      row('<a href="' + esc(o.link) + '" style="display:inline-block;padding:14px 30px;background:' + SUN + ';color:' + INK + ';border:3px solid ' + INK +
        ';border-radius:18px;font:800 18px ' + FONT + ';text-decoration:none;box-shadow:0 4px 0 ' + INK + '">' + esc(o.button) + '</a>', '18px 28px 12px') +
      row('<p style="margin:0;font:13px/1.55 ' + FONT + ';color:' + MUT + '">' + (o.foot ? o.foot + '<br>' : '') + 'Or paste this into your browser:<br>' +
        '<a href="' + esc(o.link) + '" style="color:' + MUT + ';word-break:break-all">' + esc(o.link) + '</a></p>', '6px 28px 24px') +
      '</table>' +
      (d.quiet ? '<p style="margin:16px 0 0;font:12px/1.5 ' + FONT + ';color:' + MUT + '">You get these because you play Packman. <a href="' + esc(d.quiet) +
        '" style="color:' + MUT + '">No more emails like this</a></p>' : '') +
      '</td></tr></table></body></html>';
  }
  function text(lines, link, foot, quiet) {
    return lines.join('\n\n') + '\n\n' + link + (foot ? '\n\n' + foot : '') + (quiet ? '\n\n--\nNo more emails like this: ' + quiet : '');
  }
  var plain = function (s) { return s.replace(/<[^>]+>/g, '').replace(/&nbsp;/g, ' '); };
  var KINDS = {
    welcome: {
      title: 'Welcome',
      when: 'Sent once, when a player first gives their email (or changes it). Its link opens their game on any device.',
      sample: { name: 'Ada', link: SITE + '?signin=0123456789abcdef0123456789abcdef0123456789abcdef' },
      make: function (d) {
        var lines = ['Hi ' + esc(d.name) + ',', 'Your game is saved under this email address. If you ever play on another phone or computer, open the link below there and everything you’ve packed comes with you.',
          'There’s no password. Whenever you need a new link, tap <b>Get your game back</b> in Packman.'];
        return {
          subject: 'Your Packman game is saved',
          html: page(d, { preview: 'Open it on any device with this link.', title: 'Your game is saved', lines: lines, button: 'Open my game', link: d.link,
            foot: 'Keep this email: anyone with the link can open your game.' }),
          text: text(lines.map(plain), d.link, 'Keep this email: anyone with the link can open your game.')
        };
      }
    },
    signin: {
      title: 'Get your game back',
      when: 'Sent when someone asks for their game on the Get your game back sheet. Its link works once, for an hour.',
      sample: { name: 'Ada', link: SITE + '?signin=0123456789abcdef0123456789abcdef0123456789abcdef' },
      make: function (d) {
        var lines = ['Hi ' + esc(d.name) + ',', 'Here’s the link you asked for. Open it on the device you want to play on, and your game will be there.'];
        var foot = 'It works once, for the next hour. If you didn’t ask for it, you can ignore this email.';
        return {
          subject: 'Your link to Packman',
          html: page(d, { preview: 'Open it on the device you want to play on.', title: 'Here’s your game', lines: lines, button: 'Get my game back', link: d.link, foot: foot }),
          text: text(lines.map(plain), d.link, foot)
        };
      }
    },
    passed: {
      title: 'Passed on the leaderboard',
      when: 'Sent when another player’s win puts them above you on the leaderboard (at most one every twelve hours).',
      sample: { name: 'Ada', by: 'Haojun', rank: 4, of: 41, link: SITE, quiet: 'https://www.garvitgupta.com/api/packman/quiet?k=0123456789abcdef' },
      make: function (d) {
        var lines = ['Hi ' + esc(d.name) + ',', '<b>' + esc(d.by) + '</b> just packed their way past you on the Packman leaderboard. You’re ' + nth(d.rank) + ' of ' + d.of + ' now.',
          'A level or two should put that right.'];
        return {
          subject: d.by + ' just passed you in Packman',
          html: page(d, { preview: 'You’re ' + nth(d.rank) + ' now. Time to take it back?', picture: 'passed.gif', alt: 'One block hops over another', title: esc(d.by) + ' passed you!',
            lines: lines, button: 'Play now', link: d.link }),
          text: text(lines.map(plain), d.link, '', d.quiet)
        };
      }
    },
    level: {
      title: 'A new level is open',
      when: 'Sent the morning a level opens (a Game Night duel on its Sunday), to each player who can play it: the level before it packed.',
      sample: { name: 'Ada', level: 'Square Off', intro: 'Now you play a square first. Your bricks lie down, Packman\u2019s stand up. Whoever cannot fit theirs loses.', picture: 'rival-2.gif', link: SITE + '?play=Square%20Off',
        quiet: 'https://www.garvitgupta.com/api/packman/quiet?k=0123456789abcdef' },
      make: function (d) {
        var lines = ['Hi ' + esc(d.name) + ',', '<b>' + esc(d.level) + '</b> is open, and it’s ready for you.' + (d.intro ? ' ' + esc(d.intro) : '')];
        return {
          subject: d.level + ' is open in Packman',
          html: page(d, { preview: 'A new level, ready when you are.', picture: d.picture || '', alt: d.level + ', as it is dealt', title: esc(d.level) + ' is open',
            lines: lines, button: 'Play now', link: d.link }),
          text: text(lines.map(plain), d.link, '', d.quiet)
        };
      }
    }
  };
  return {
    kinds: Object.keys(KINDS).map(function (k) { return { kind: k, title: KINDS[k].title, when: KINDS[k].when, sample: KINDS[k].sample }; }),
    make: function (kind, data) { return KINDS[kind].make(data); }
  };
})();
if (typeof module !== 'undefined') module.exports = PackmanMail;
