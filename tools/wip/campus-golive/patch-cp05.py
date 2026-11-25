import sys
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof5(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
  }
});'''
b = '''    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof5(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved it/);
    /* the real fix, with a default typed on the edge router on top of it: it works, and Mason names the typed route */
    T = open(); for (const a of fix5(T).concat(onEdge(T, ["ip route 0.0.0.0 0.0.0.0 " + T.sim.net.isp.gw]))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the fix with a typed default on top"); for (const a of proof5(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /typed into the edge router/);
  }
});'''
c = s.count(a)
if c != 1:
    i = s.find('test("CP-05: the tempting'); j = s.find('test("CP-05: the ladder', i)
    seg = s[i:j]; assert seg.count(a) == 1, (f, c, seg.count(a)); s = s[:i] + seg.replace(a, b) + s[j:]
else: s = s.replace(a, b)
open(f, "w").write(s); print("patched", f)
