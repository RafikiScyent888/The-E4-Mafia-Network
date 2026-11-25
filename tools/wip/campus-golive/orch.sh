#!/bin/bash
# takes CP-09 to CP-14 live in order, each once its own tests and its Node plants pass (its drive, contrast states and page plants
# passed already), then CP-15 with Level 4 complete once its full checks pass. Stops at the first failure and says why.
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg; L=$SP/orch.log
say() { echo "$(date +%H:%M) $*" >> $L; }
declare -A C=([09]=1b3ecf6 [10]=535f210 [11]=9a36227 [12]=5fbeca5 [13]=c3d4fb5 [14]=0843816)
declare -A K=([09]=4 [10]=4 [11]=2 [12]=4 [13]=3 [14]=2)
for n in 09 10 11 12 13 14; do
  until grep -q "^EXIT" $SP/cp$n-own2.log 2>/dev/null && { [ "$(grep -c "· CP-$n:" $SP/pl-node-c.log)" -ge ${K[$n]} ] || grep -q "^EXIT" $SP/pl-node-c.log; }; do sleep 20; done
  if ! grep -q "^# fail 0" $SP/cp$n-own2.log || ! grep -q "^EXIT 0" $SP/cp$n-own2.log; then say "BLOCKED CP-$n: its own tests failed"; exit 1; fi
  if grep -q "MISSED · node · CP-$n:" $SP/pl-node-c.log; then say "BLOCKED CP-$n: a Node plant missed: $(grep "MISSED · node · CP-$n:" $SP/pl-node-c.log | head -1 | cut -c1-120)"; exit 1; fi
  if [ "$(grep -c "CAUGHT · node · CP-$n:" $SP/pl-node-c.log)" -lt ${K[$n]} ]; then say "BLOCKED CP-$n: only $(grep -c "CAUGHT · node · CP-$n:" $SP/pl-node-c.log) of ${K[$n]} Node plants ran"; exit 1; fi
  out=$(bash $SP/golive-cp.sh $n ${C[$n]} 2>&1 | tail -2 | tr '\n' ' ')
  echo "$out" | grep -q "pushed: main at" || { say "BLOCKED CP-$n: the push didn't check out: $out"; exit 1; }
  say "LIVE CP-$n: $out"
done
# CP-15: the full unit tests, the full drive, then the models and contrast states alone, then its page plants; its Node plants
until grep -q "^EXIT" $SP/cp15-npm.log; do sleep 30; done
grep -q "^# fail 0" $SP/cp15-npm.log && grep -q "^EXIT 0" $SP/cp15-npm.log || { say "BLOCKED CP-15: npm test: $(grep -E '^# (pass|fail)' $SP/cp15-npm.log | tr '\n' ' ')"; exit 1; }
NPM=$(grep -E "^# pass" $SP/cp15-npm.log | awk '{print $3}')
until grep -q "^EXIT" $SP/cp15-full.log; do sleep 30; done
grep -q "^PASS" $SP/cp15-full.log || { say "BLOCKED CP-15: the full drive: $(grep -v '^  ok' $SP/cp15-full.log | head -5 | tr '\n' ' ' | cut -c1-400)"; exit 1; }
FULL=$(grep "^PASS" $SP/cp15-full.log | sed 's/PASS: \([0-9,]*\) checks.*/\1/')
say "CP-15: npm $NPM, full drive $FULL; models and contrast next"
cd $SP/cp15 && env CHROME=/opt/pw-browsers/chromium timeout 5400 node tools/models.mjs > $SP/cp15-models.log 2>&1; echo "EXIT $?" >> $SP/cp15-models.log
grep -q " 0 failed" $SP/cp15-models.log || { say "BLOCKED CP-15: models: $(grep -i 'fail' $SP/cp15-models.log | head -3 | tr '\n' ' ' | cut -c1-300)"; exit 1; }
MOD=$(grep -o "^[0-9]* checks, 0 failed" $SP/cp15-models.log | awk '{print $1}')
cd $SP/cp15 && env CHROME=/opt/pw-browsers/chromium ONLY="campus tickets: CP-15,levels" timeout 7000 node tools/aaa.mjs tools/aaa-states.json > $SP/cp15-aaa.log 2>&1; echo "EXIT $?" >> $SP/cp15-aaa.log
grep -q "^PASS overall" $SP/cp15-aaa.log || { say "BLOCKED CP-15: contrast: $(grep '^FAIL' $SP/cp15-aaa.log | head -3 | tr '\n' ' ' | cut -c1-300)"; exit 1; }
AAA=$(grep "^PASS overall" $SP/cp15-aaa.log | sed 's/PASS overall: \([0-9,]*\) text runs across \([0-9]*\) states.*/\2 states, \1 text runs/')
cd $SP/pl15 && env CHROME=/opt/pw-browsers/chromium KINDS=page timeout 7000 python3 tools/plants-campus-tickets.py "CP-15" "Level 4" > $SP/pl15-page.log 2>&1; echo "EXIT $?" >> $SP/pl15-page.log
grep -q "MISSED" $SP/pl15-page.log && { say "BLOCKED CP-15: a page plant missed: $(grep MISSED $SP/pl15-page.log | head -1 | cut -c1-150)"; exit 1; }
PG=$(grep -c "CAUGHT" $SP/pl15-page.log)
until grep -q "^EXIT" $SP/pl15-node.log; do sleep 30; done
grep -q "MISSED" $SP/pl15-node.log && { say "BLOCKED CP-15: a Node plant missed: $(grep MISSED $SP/pl15-node.log | head -1 | cut -c1-150)"; exit 1; }
ND=$(grep -c "CAUGHT" $SP/pl15-node.log)
RES="\`npm test\` $NPM of $NPM; the CP-15 drive 99 checks; the full drive $FULL checks; the models $MOD (with a CP-15 case: the desk switch's plugs and lights, the customer's switch's and the 2F access switch's); $AAA (the CP-15 and levels states); plants: Node $ND, page $PG, all caught."
out=$(bash $SP/golive-cp15.sh "$RES" 2>&1 | tail -2 | tr '\n' ' ')
echo "$out" | grep -q "pushed: main at" || { say "BLOCKED CP-15: the push didn't check out: $out"; exit 1; }
say "LIVE CP-15 and Level 4 complete: $out"
say "RESULTS $RES"
