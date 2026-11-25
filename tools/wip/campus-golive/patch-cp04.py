import sys
f = sys.argv[1]; s = open(f).read()
a = '''    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof4(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved the change/);
  }
});'''
b = '''    assert.equal(T.fixed, false, s + " unsaved"); for (const a of proof4(T)) E.act(T, a); assert.match(T.partial || "", /hasn't saved the change/);
    /* switch 2 lowered first (tempting), then switch 1 put right as well: switch 2 isn't as the records have it */
    T = open(); for (const a of onD(T, "dist2", ["interface vlan " + T.v.vid, "standby " + T.v.vid + " priority 90"]).concat(fix4(T))) E.act(T, a);
    assert.equal(T.fixed, false, s + " switch 2 lowered as well"); for (const a of proof4(T)) E.act(T, a); assert.match(T.partial || "", /switch 2's settings for the group have changed/);
    /* put right and saved, then switch 1's line changed back without saving: the running configuration is wrong again */
    T = open(); for (const a of fix4(T).concat(onD(T, "dist1", ["interface vlan " + T.v.vid, T.v.kind === "preempt" ? "no standby " + T.v.vid + " preempt" : "standby " + T.v.vid + " priority 100"], false))) E.act(T, a);
    assert.equal(T.fixed, false, s + " the running configuration changed back after the save");
  }
});'''
assert s.count(a) == 1, (f, s.count(a)); s = s.replace(a, b); open(f, "w").write(s); print("patched", f)
