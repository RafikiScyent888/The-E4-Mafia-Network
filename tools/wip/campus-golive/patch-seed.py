import sys
f = sys.argv[1]; s = open(f).read()
block = '''
/* every campus ticket shows its fault on the campus it was asked for, in every variant: a ticket moves to another campus when its fault
   doesn't show, so a rule that stopped one variant showing would otherwise go unnoticed (the tests would just meet the other variants) */
for (const def of CAMPUS_TICKETS) test(def.id + ": the fault shows on every campus asked for, every variant (no campus skipped)", () => {
  const kinds = new Set();
  for (const s of seedsOf(def)) { const T = E.open(def, s); assert.equal(T.seed, s, def.id + " campus " + s + " was skipped: its fault didn't show"); if (T.v.kind) kinds.add(T.v.kind); }
  if (def.kinds) assert.deepEqual([...kinds].sort(), def.kinds.slice().sort(), def.id + ": every variant met");
});
'''
if "the fault shows on every campus asked for" in s: print("already", f); sys.exit(0)
s = s.rstrip("\n") + "\n" + block; open(f, "w").write(s); print("patched", f)
