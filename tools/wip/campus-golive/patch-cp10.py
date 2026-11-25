import sys
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " an address by hand");
'''
b = '''    assert.equal(T.fixed, false, s + " an address by hand");
    /* both relays put right and saved, then the desk given an address by hand instead of asking again: it works, and isn't the fix */
    T = open(); for (const a of onR(T, "dist1", relayLines(T)).concat(onR(T, "dist2", relayLines(T)))) E.act(T, a);
    E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: a0, mask: T.v.plan.mask, gw: T.v.vnet + "1", dns: [T.v.plan.srv.fsrv.ip] } }); E.act(T, on(T.v.pc)("ping 8.8.8.8"));
    assert.equal(T.fixed, false, s + " the relays put right, then the desk given an address by hand");
'''
i = s.find('test("CP-10: the tempting'); j = s.find('test("CP-10: the ladder', i); seg = s[i:j]
if b in seg: print("already", f); sys.exit(0)
assert seg.count(a) == 1, (f, seg.count(a)); s = s[:i] + seg.replace(a, b) + s[j:]; open(f, "w").write(s); print("patched", f)
