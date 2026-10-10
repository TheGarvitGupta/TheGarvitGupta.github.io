# The files hang together: nothing is asked for that is not there, the cache numbers are right, the worker that
# is deployed from is the one the game's files would build now, and the scripts keep to the style they are written in.
import importlib.util, os, re, subprocess
from harness import ROOT, GAME, read

PAGES = ['index.html', 'personalities.html', 'reel/index.html', 'tools/check.html']
SCRIPTS = ['geom.js', 'levels.js', 'faces.js', 'sounds.js', 'game.js', 'reel/reel.js']
ASKED = re.compile(r'''(?:src|href)=["']([^"'#]+)["']''')

def asked(page):
    """The files of this site a page asks for: (file, relative to the game's folder; its cache number or None)."""
    out = []
    for ref in ASKED.findall(read('packman', page)):
        if re.match(r'^(https?:)?//|^data:|^mailto:', ref): continue
        path, _, q = ref.partition('?')
        there = os.path.normpath(os.path.join(ROOT, path.lstrip('/')) if path.startswith('/') else os.path.join(GAME, os.path.dirname(page), path))
        v = re.search(r'(?:^|&)v=([\d.]+)', q)
        out.append((there, v.group(1) if v else None))
    return out

def test_every_file_asked_for_is_there(t):
    missing = []
    for page in PAGES:
        for there, _ in asked(page):
            if os.path.isdir(there): there = os.path.join(there, 'index.html')
            if not os.path.exists(there): missing.append('%s asks for %s' % (page, os.path.relpath(there, ROOT)))
    for css in ('packman.css', 'faces.css'):
        for ref in re.findall(r'url\(["\']?([^)"\']+)', read('packman', css)):
            if not ref.startswith('data:') and not os.path.exists(os.path.join(GAME, ref)): missing.append('%s asks for %s' % (css, ref))
    for m in re.findall(r"\.src = '([^']+)'", read('packman', 'game.js')):
        if not os.path.exists(os.path.join(GAME, m)): missing.append('game.js loads %s' % m)
    assert not missing, '\n'.join(missing)

def numbers():
    """file -> {page: cache number} for every script and stylesheet of the game."""
    out = {}
    for page in PAGES:
        for there, v in asked(page):
            if there.startswith(GAME) and there.endswith(('.js', '.css')): out.setdefault(os.path.relpath(there, GAME), {})[page] = v
    return out

def test_scripts_and_styles_have_cache_numbers(t):
    bare = ['%s in %s' % (f, p) for f, pages in numbers().items() for p, v in pages.items() if v is None and not p.startswith('tools/')]
    assert not bare, 'asked for without ?v=, so a returning player may keep an old copy: ' + ', '.join(bare)

def test_cache_numbers_agree_between_pages(t):
    odd = ['%s: %s' % (f, ', '.join('%s in %s' % (v, p) for p, v in pages.items()))
           for f, pages in numbers().items() if len(set(v for p, v in pages.items() if not p.startswith('tools/'))) > 1]
    assert not odd, '\n'.join(odd)

def git(*args):
    r = subprocess.run(['git', '-C', ROOT] + list(args), capture_output=True, text=True)
    return r.stdout if r.returncode == 0 else None

def test_a_changed_file_has_a_new_cache_number(t):
    """Against what was last pushed: a script or stylesheet that differs from it must be asked for by another number."""
    if git('rev-parse', '--verify', 'origin/master') is None: return   # nothing to compare with
    stale = []
    for f, pages in numbers().items():
        was = git('show', 'origin/master:packman/' + f)
        if was is None or was == read('packman', f): continue   # new, or not changed
        for page, v in pages.items():
            if page.startswith('tools/'): continue
            old = git('show', 'origin/master:packman/' + page) or ''
            m = re.search(re.escape(os.path.basename(f)) + r'\?v=([\d.]+)', old)
            if m and m.group(1) == v: stale.append('%s has changed since the last push and %s still asks for ?v=%s' % (f, page, v))
    assert not stale, '\n'.join(stale)

def test_the_worker_is_built_from_the_files_as_they_are(t):
    spec = importlib.util.spec_from_file_location('build_worker', os.path.join(GAME, 'tools', 'build-worker.py'))
    mod = importlib.util.module_from_spec(spec); spec.loader.exec_module(mod)
    assert mod.build() == read('extras', 'cloudflare-worker', 'packman-scores.js'), \
        'extras/cloudflare-worker/packman-scores.js is out of date: run python3 packman/tools/build-worker.py, then deploy it'

def code(js):
    """A script with its comments, strings and regular expressions blanked out, so only the code is left to look at."""
    out, i, n, last = [], 0, len(js), ''
    while i < n:
        c, d = js[i], js[i:i + 2]
        if d == '//':
            j = js.find('\n', i); j = n if j < 0 else j; i = j; continue
        if d == '/*':
            j = js.find('*/', i + 2); j = n if j < 0 else j + 2; out.append('\n' * js.count('\n', i, j)); i = j; continue
        if c in '\'"`':
            j = i + 1
            while j < n and js[j] != c: j += 2 if js[j] == '\\' else 1
            out.append(c + '\n' * js.count('\n', i, j) + c); i = j + 1; last = c; continue
        if c == '/' and (last in '(,=:[!&|?{};+-*%<>~^' or last == '' or re.search(r'(return|typeof|case|in|of)\s*$', ''.join(out[-12:]))):
            j, cls = i + 1, False
            while j < n and (js[j] != '/' or cls):
                if js[j] == '\\': j += 1
                elif js[j] == '[': cls = True
                elif js[j] == ']': cls = False
                j += 1
            out.append('/x/'); i = j + 1; last = '/'; continue
        out.append(c)
        if not c.isspace(): last = c
        i += 1
    return ''.join(out)

def test_the_scripts_keep_to_es5(t):
    """They are written without arrow functions, let, const, classes or template strings; one that crept in would
    work in a new browser and break an old one."""
    found = []
    for f in SCRIPTS:
        if f == 'reel/reel.js': continue   # never run for a player: only on this machine, to be filmed, and it waits its way through with async
        js = code(read('packman', f))
        for what, pat in [('an arrow function', r'=>'), ('let', r'\blet\s+[\w$\[{]'), ('const', r'\bconst\s+[\w$\[{]'), ('a class', r'\bclass\s+\w'),
                          ('a template string', r'`\n*`'), ('async', r'\basync\s+function|\bawait\s'), ('a spread', r'\.\.\.')]:
            m = re.search(pat, js)
            if m: found.append('%s: %s, at line %d' % (f, what, js[:m.start()].count('\n') + 1))
    assert not found, '\n'.join(found)

def test_nothing_left_over_from_debugging(t):
    found = ['%s: %s' % (f, w) for f in SCRIPTS for w in ('console.log', 'debugger', 'alert(') if w in code(read('packman', f))]
    assert not found, ', '.join(found)
