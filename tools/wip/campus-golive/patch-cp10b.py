import sys
# CP-10 (26 November 2026): the relays-put-right case gave the desk the file server as its DNS server, which isn't one, so the desk
# wasn't online and the case failed for that, not for the missing lease: the right DNS servers now, and the desk shown online first
f = sys.argv[1]; s = open(f).read()
a = '''    E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: a0, mask: T.v.plan.mask, gw: T.v.vnet + "1", dns: [T.v.plan.srv.fsrv.ip] } }); E.act(T, on(T.v.pc)("ping 8.8.8.8"));
    assert.equal(T.fixed, false, s + " the relays put right, then the desk given an address by hand");'''
b = '''    E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: a0, mask: T.v.plan.mask, gw: T.v.vnet + "1", dns: T.sim.d.mgr.ifaces[0].lease.dns.slice() } }); E.act(T, on(T.v.pc)("ping 8.8.8.8"));
    assert.ok(online(T.sim, T.v.pc), s + " the address by hand works"); assert.ok(!T.fixed, s + " the relays put right, then the desk given an address by hand");'''
if b in s: print("already", f); sys.exit(0)
assert s.count(a) == 1, (f, s.count(a)); open(f, "w").write(s.replace(a, b)); print("patched", f)
