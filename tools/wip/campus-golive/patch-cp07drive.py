import sys
f = sys.argv[1]; s = open(f).read()
a = '''      v.ends = v.kind === "passive" ? ["dist1", "dist2"] : ["dist1", "dist2"].filter((d) => /channel-group 1 mode on/.test(o[d]));   /* the ends to put back, as read from their configurations */'''
b = a + '''
      /* the members' flags: both passive, every link stands alone (I) at both ends; one end forced on, the other end hears no LACP and its links stand alone */
      const alone = (d) => /Gi0\\/21\\(I\\)/.test(o[d]) && /Gi0\\/22\\(I\\)/.test(o[d]);
      check(v.kind === "passive" ? ["dist1", "dist2"].every(alone) : ["dist1", "dist2"].filter((d) => v.ends.indexOf(d) < 0).every(alone), "CP-07 " + v.kind + ": show etherchannel summary has the links standing alone (I) where LACP gets no answer");'''
if "the members' flags: both passive" in s: print("already", f); sys.exit(0)
assert s.count(a) == 1, (f, s.count(a)); s = s.replace(a, b); open(f, "w").write(s); print("patched", f)
