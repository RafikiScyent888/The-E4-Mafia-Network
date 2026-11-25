# The campus tickets' go-live scripts (saved 25 November 2026)

Copied from the session's scratchpad (`$SP/stg`, where the staged trees `cp02` to `cp15` live) so a rebuilt container keeps them.
Set `E4_PIN` before running any of them (the PIN is in the owner's private notes, never in this repo); they refuse to run without it,
and each staged tree is scanned for it before it goes live.

- `stage.sh COMMIT DEST`: a ticket's own commit as a staged tree, with the drive's Level 4 lines, the latest CLAUDE.md and plants script.
- `golive-cp.sh NN COMMIT`: CP-NN's staged tree, its save-point line, the PIN scan, the live worktree (`/home/user/e4-sb01`) made exactly
  that tree, pushed to `main` and `save/level3-sb01`, and checked against `origin/main`.
- `golive-cp15.sh "results"`: the same for CP-15, with Level 4 complete.
- `orch2.sh`: takes CP-10 to CP-14 live in order once each one's own tests (`cpNN-own2.log`, or `cpNN-own3.log` from a patched tree) and
  Node plants (`pl-node-c.log`; a plant missed there counts once `pl-fix.log` has it caught on the patched tree) pass, then CP-15 after its
  full checks. Stops at the first failure with BLOCKED in `orch.log`.
- `patch-cpNN.py FILE`: a test added after a plant was missed, applied to every staged tree from that ticket on (and committed on
  `save/level4-tickets`), so a later ticket's go-live never takes it back out.
- `own-loop.sh`, `drive-loop.sh`, `npm-loop.sh`, `after-*.sh`: the loops that ran each ticket's checks, and the merges after.
