import sys
# CP-12 (26 November 2026): with the server down no desk is online, whatever the file says, so the failed-then-right case can't show a
# stopped server counted as running. The case that does: everything fixed and the desk on its lease, then the server stopped
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " failed, then the file put right and not restarted"); assert.equal(T.sim.d.fsrv.lx.dhcpd.state, "failed"); assert.ok(!online(T.sim, T.v.pc));
'''
b = a + '''    /* fixed properly, the desk on its new lease, then the DHCP server stopped: the desk works until its lease runs out, and it isn't fixed */
    T = open(); for (const a of edit12(T, goodConf(T)).concat(proof12(T))) E.act(T, a); assert.equal(T.fixed, true, s + " the real fix");
    for (const a of onSrv(T, ["sudo systemctl stop isc-dhcp-server", T.v.plan.srv.pw])) E.act(T, a);
    assert.ok(online(T.sim, T.v.pc), s + " the desk still on its lease"); assert.ok(!T.fixed, s + " fixed, then the server stopped");
'''
if b in s: print("already", f); sys.exit(0)
assert s.count(a) == 1, (f, s.count(a)); open(f, "w").write(s.replace(a, b)); print("patched", f)
