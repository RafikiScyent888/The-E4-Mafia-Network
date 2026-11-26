import sys
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " restarted as it is"); assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "failed");
'''
b = '''    assert.equal(T.fixed, false, s + " restarted as it is"); assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "failed");
    /* restarted as it is (it fails), then the file put right but never restarted again: the server is still down */
    T = open(); for (const a of onSrv(T, ["sudo systemctl restart isc-dhcp-server", T.v.plan.srv.pw]).concat(edit12(T, goodConf(T), false), proof12(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " failed, then the file put right and not restarted"); assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "failed"); assert.ok(!online(T.sim, T.v.pc));
'''
i = s.find('test("CP-12: the tempting'); j = s.find('test("CP-12: the ladder', i); seg = s[i:j]
if b in seg: print("already", f); sys.exit(0)
assert seg.count(a) == 1, (f, seg.count(a)); s = s[:i] + seg.replace(a, b) + s[j:]; open(f, "w").write(s); print("patched", f)
