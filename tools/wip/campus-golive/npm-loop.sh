#!/bin/bash
# each stage: its own ticket's tests, the levels' tests and the campus desk's; the full suite on the last tree (the first ran it already)
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
for n in 03 04 05 06 07 08 09 10 11 12 13; do cd $SP/cp$n && { SEEDS=4 timeout 3000 node --test --test-name-pattern="CP-$n" tests/campus-tickets.test.js; timeout 1200 node --test tests/levels.test.js; } > $SP/cp$n-npm.log 2>&1; echo "EXIT $?" >> $SP/cp$n-npm.log; done
cd $SP/cp14 && timeout 3600 npm test > $SP/cp14-npm.log 2>&1; echo "EXIT $?" >> $SP/cp14-npm.log
