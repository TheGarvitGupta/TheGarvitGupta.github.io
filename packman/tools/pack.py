# Looks for the smallest box a set of shapes will pack into, to make a tight level from: shapes are thrown in at
# random and squeezed until nothing overlaps, the box is shrunk until that fails, and the angles are then rounded
# to whole degrees (which the game turns in) and the box let out just enough to hold them.
#
#   python3 pack.py JOB [TRIES=30] [SEED=0]     a job from JOBS below; writes JOB.json (the box's size and where
#                                               each shape sits, as a level's solution) and JOB.png, here
#
# What it finds is the best of its tries, not proved the smallest. Needs numpy, scipy and matplotlib.
import numpy as np, sys, json, math
from scipy.optimize import minimize
H = math.sqrt(3)/2
SH = {'square': [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]],
      'triangle': [[0,-2*H/3],[.5,H/3],[-.5,H/3]],
      'domino': [[-1,-.5],[1,-.5],[1,.5],[-1,.5]],
      'hexagon': [[1,0],[.5,H],[-.5,H],[-1,0],[-.5,-H],[.5,-H]]}
SH = {k: np.array(v) for k, v in SH.items()}
def normals(P):
    d = np.roll(P, -1, axis=0) - P
    n = np.stack([d[:,1], -d[:,0]], 1)
    return n / np.linalg.norm(n, axis=1)[:,None]
BN = {k: normals(v) for k, v in SH.items()}
def rot(a):
    c, s = math.cos(a), math.sin(a); return np.array([[c, s], [-s, c]])   # row-vector: v @ R
def verts(t, x, y, a):
    return SH[t] @ rot(a) + [x, y]
def depth(A, nA, B, nB):
    ax = np.vstack([nA, nB])
    pa = A @ ax.T; pb = B @ ax.T
    o = np.minimum(pa.max(0) - pb.min(0), pb.max(0) - pa.min(0))
    m = o.min()
    return m if m > 0 else 0.0
def walls(poly):
    poly = np.array(poly, float); c = poly.mean(0); n = normals(poly); d = (poly * n).sum(1)
    flip = (c @ n.T) > d
    n[flip] *= -1; d[flip] *= -1
    return n, d
def cost(v, types, Wn, Wd, s, deg=False):
    n = len(types); tot = 0.0; V = []; N = []
    for i, t in enumerate(types):
        a = v[3*i+2] * (math.pi/180 if deg else 1)
        R = rot(a); V.append(SH[t] @ R + v[3*i:3*i+2]); N.append(BN[t] @ R)
        e = (V[i] @ Wn.T).max(0) - Wd * s
        tot += (np.maximum(e, 0)**2).sum()
    for i in range(n):
        for j in range(i+1, n):
            if np.hypot(*(v[3*i:3*i+2] - v[3*j:3*j+2])) > 2.3: continue
            tot += depth(V[i], N[i], V[j], N[j])**2
    return tot
def worst(v, types, Wn, Wd, s, deg=False):
    n = len(types); w = 0.0; V = []; N = []
    for i, t in enumerate(types):
        a = v[3*i+2] * (math.pi/180 if deg else 1)
        R = rot(a); V.append(SH[t] @ R + v[3*i:3*i+2]); N.append(BN[t] @ R)
        w = max(w, ((V[i] @ Wn.T).max(0) - Wd * s).max())
    for i in range(n):
        for j in range(i+1, n):
            w = max(w, depth(V[i], N[i], V[j], N[j]))
    return w
def relax(v, types, Wn, Wd, s, tol=1e-9):
    r = minimize(cost, v, args=(types, Wn, Wd, s), method='L-BFGS-B', options={'maxiter': 400, 'ftol': 1e-14, 'gtol': 1e-10})
    return r.x, r.fun
def search(types, poly, s0, tries=40, seed=0, shrink=0.985, floor=None):
    rng = np.random.default_rng(seed); Wn, Wd = walls(poly); n = len(types); best = None
    ext = np.abs(np.array(poly)).max()
    for t in range(tries):
        v = np.zeros(3*n)
        v[0::3] = rng.uniform(-1, 1, n) * ext * s0 * .6; v[1::3] = rng.uniform(-1, 1, n) * ext * s0 * .6; v[2::3] = rng.uniform(0, 2*math.pi, n)
        s = s0; good = None
        while True:
            ok = False
            for k in range(4):
                x, f = relax(v + (rng.normal(0, .03 * k, 3*n) if k else 0), types, Wn, Wd, s)
                if f < 1e-9: ok = True; break
            if not ok: break
            good = (s, x.copy()); v = x; s *= shrink
            if floor and s < floor: break
        if good:
            # refine by bisection
            lo, hi, x = good[0]*shrink, good[0], good[1]
            for _ in range(12):
                mid = (lo+hi)/2; y, f = relax(x, types, Wn, Wd, mid)
                if f < 1e-10: hi, x = mid, y
                else: lo = mid
            if best is None or hi < best[0] - 1e-6:
                best = (hi, x); print('try', t, 's=%.4f' % hi, flush=True)
    return best
def integerise(types, poly, s, x, seed=0):
    """angles to whole degrees; smallest s that still relaxes, positions only"""
    Wn, Wd = walls(poly); n = len(types); rng = np.random.default_rng(seed)
    def posfit(ang, s, p0):
        def c(p):
            v = np.zeros(3*n); v[0::3] = p[0::2]; v[1::3] = p[1::2]; v[2::3] = ang
            return cost(v, types, Wn, Wd, s, deg=True)
        r = minimize(c, p0, method='L-BFGS-B', options={'maxiter': 500, 'ftol': 1e-15, 'gtol': 1e-11})
        return r.x, r.fun
    base = np.degrees(x[2::3]); p0 = np.stack([x[0::3], x[1::3]], 1).ravel()
    best = None
    cands = [np.round(base)] + [np.round(base + rng.uniform(-.8, .8, n)) for _ in range(12)]
    # snap near multiples of 15
    sn = np.round(base); m = np.round(base/15)*15; near = np.abs(base - m) < 1.2; sn[near] = m[near]; cands.insert(0, sn)
    for ang in cands:
        lo, hi = s, s * 1.04; p = p0; got = None
        y, f = posfit(ang, hi, p0)
        if f > 1e-10: continue
        got = y
        for _ in range(14):
            mid = (lo+hi)/2; y, f = posfit(ang, mid, got)
            if f < 1e-10: hi, got = mid, y
            else: lo = mid
        if best is None or hi < best[0] - 1e-7: best = (hi, ang.copy(), got.copy())
    return best
def draw(types, poly, s, sol, name):
    import matplotlib; matplotlib.use('Agg'); import matplotlib.pyplot as plt
    fig, ax = plt.subplots(figsize=(4, 4)); P = np.array(poly) * s
    ax.fill(P[:,0], P[:,1], fc='none', ec='k', lw=2)
    for t, (x, y, a) in zip(types, sol):
        V = verts(t, x, y, math.radians(a)); ax.fill(V[:,0], V[:,1], alpha=.6, ec='k'); ax.text(x, y, '%d' % a, ha='center', va='center', fontsize=7)
    ax.set_aspect('equal'); ax.invert_yaxis(); ax.axis('off'); ax.set_title('%s  s=%.4f' % (name, s), fontsize=8); fig.savefig(name + '.png', dpi=70); plt.close(fig)
def run(name, types, poly, s0, tries=40, seed=0):
    b = search(types, poly, s0, tries, seed)
    r = integerise(types, poly, b[0], b[1])
    s, ang, p = r
    sol = [[round(float(p[2*i]), 4), round(float(p[2*i+1]), 4), int(ang[i]) % 360] for i in range(len(types))]
    Wn, Wd = walls(poly); v = np.array(sol, float).ravel()
    out = {'name': name, 'types': types, 'real': round(b[0], 4), 's': round(s, 4), 'worst': worst(v, types, Wn, Wd, s, deg=True), 'sol': sol}
    print(json.dumps(out)); json.dump(out, open(name + '.json', 'w')); draw(types, poly, s, sol, name)
    return out
def box(): return [[-.5,-.5],[.5,-.5],[.5,.5],[-.5,.5]]
def ngon(n, st): return [[math.cos(math.radians(st + i*360/n)), math.sin(math.radians(st + i*360/n))] for i in range(n)]
def chamfer(c): return [[-.5,-.5],[.5-c,-.5],[.5,-.5+c],[.5,.5],[-.5,.5]]
P = lambda sq, tr=0, do=0, hx=0: ['square']*sq + ['triangle']*tr + ['domino']*do + ['hexagon']*hx
JOBS = {
 'hex5sq': (P(5), ngon(6, 0), 2.6),
 'hex4sq': (P(4), ngon(6, 0), 2.4),
 'tri5sq': (P(5), ngon(3, -90), 4.5),
 'box4br': (P(0,0,4), box(), 3.6),
 'box3br1sq': (P(1,0,3), box(), 3.4),
 'box3br2sq': (P(2,0,3), box(), 3.6),
 'boxhx3sq': (P(3,0,0,1), box(), 3.4),
 'boxhx4sq': (P(4,0,0,1), box(), 3.6),
 'bluff': (P(1,2,1,1), box(), 3.6),
 'bluffb': (P(2,1,1,1), box(), 3.8),
 'cham6sq': (P(6), chamfer(.3), 3.6),
 'cham5sq2tr': (P(5,2), chamfer(.3), 3.8),
 'cham7sq': (P(7), chamfer(.3), 3.8),
 'box2br3tr': (P(0,3,2), box(), 3.2),
 'boxhx2br': (P(0,0,2,1), box(), 3.6),
 'box5br': (P(0,0,5), box(), 4.4),
 'cham8sq': (P(8), chamfer(.2), 4.0),
 'cham5sq': (P(5), chamfer(.25), 3.4),
 'box2hx2tr': (P(0,2,0,2), box(), 4.2),
 'boxhx2sq2tr': (P(2,2,0,1), box(), 3.6),
 'hex6sq': (P(6), ngon(6,0), 2.8),
 'box3br2tr': (P(0,2,3), box(), 3.6),
 'hex7sq': (P(7), ngon(6,0), 3.0),
 'hex8sq': (P(8), ngon(6,0), 3.2),
 'tri7sq': (P(7), ngon(3,-90), 5.2),
 'tri8sq': (P(8), ngon(3,-90), 5.6),
 'cham9sq': (P(9), chamfer(.2), 4.4),
 'cham10sq': (P(10), chamfer(.2), 4.6),
 'boxhx5sq': (P(5,0,0,1), box(), 4.0),
 'boxhx6sq': (P(6,0,0,1), box(), 4.2),
 'box2hx3sq': (P(3,0,0,2), box(), 4.4),
 'box2hx4tr2sq': (P(2,4,0,2), box(), 4.6),
 'boxhx3sq3tr': (P(3,3,0,1), box(), 4.0),
 'hex4sq4tr': (P(4,4), ngon(6,0), 2.6),
}
if __name__ == '__main__':
    k = sys.argv[1]; t, poly, s0 = JOBS[k]
    run(k, t, poly, s0, int(sys.argv[2]) if len(sys.argv) > 2 else 30, int(sys.argv[3]) if len(sys.argv) > 3 else 0)
