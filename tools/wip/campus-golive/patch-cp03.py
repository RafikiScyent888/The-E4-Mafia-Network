import sys
f = sys.argv[1]; s = open(f).read()
a = '''    T = open(); E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: T.sim.addr(T.v.pc).ip, mask: T.v.plan.mask, gw: T.v.typo, dns: [] } });
    assert.equal(T.fixed, false, s + " the desk pointed at the wrong address by hand");
  }
});'''
b = '''    T = open(); E.act(T, { t: "client", dev: T.v.pc, values: { mode: "static", ip: T.sim.addr(T.v.pc).ip, mask: T.v.plan.mask, gw: T.v.typo, dns: [] } });
    assert.equal(T.fixed, false, s + " the desk pointed at the wrong address by hand");
    /* the desk pointed at the wrong address by hand first (it worked), then the switch put right: that desk is left pointing at an address nobody answers */
    for (const a of onDist(T, "dist1", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " ip " + T.v.gw])) E.act(T, a);
    assert.equal(T.fixed, false, s + " the switch put right, but one desk still on the wrong gateway by hand"); assert.ok(T.v.pcs.some((d) => d !== T.v.pc && online(T.sim, d)), s + " the floor's other desks are back");
    /* the address put right on distribution switch 1, then its VLAN interface shut: switch 2 answers alone */
    T = open(); for (const a of onDist(T, "dist1", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " ip " + T.v.gw, "shutdown"])) E.act(T, a);
    assert.equal(T.fixed, false, s + " switch 1's VLAN interface shut"); for (const a of proof3(T)) E.act(T, a); assert.equal(T.proven, false); assert.match(T.partial || "", /isn't the floor's active gateway/);
  }
});'''
assert s.count(a) == 1, (f, s.count(a)); s = s.replace(a, b); open(f, "w").write(s); print("patched", f)
