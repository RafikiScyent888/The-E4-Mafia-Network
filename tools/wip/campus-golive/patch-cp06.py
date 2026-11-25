import sys
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " another VLAN's"); assert.ok(CP06.exhibits(T.sim, T.v));
  }
});'''
b = '''    assert.equal(T.fixed, false, s + " another VLAN's"); assert.ok(CP06.exhibits(T.sim, T.v));
    /* the real fix, with distribution switch 1 lowered further on top: it works, and Mason names the distribution switches' priorities */
    T = open(); for (const a of fix6(T).concat(onSw6(T, T.v.plan.sw.dist1.ip, ["spanning-tree vlan " + T.v.vid + " priority 0"]))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the fix with switch 1 lowered as well"); for (const a of proof6(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /changing the distribution switches' priorities/);
  }
});'''
i = s.find('test("CP-06: the tempting'); j = s.find('test("CP-06: the ladder', i); seg = s[i:j]
assert seg.count(a) == 1, (f, seg.count(a)); s = s[:i] + seg.replace(a, b) + s[j:]; open(f, "w").write(s); print("patched", f)
