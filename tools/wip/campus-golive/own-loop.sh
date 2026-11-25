#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
cd $SP/cp14 && env CHROME=/opt/pw-browsers/chromium ONLY='campus tickets: CP-14 solved' timeout 3000 node tools/aaa.mjs tools/aaa-states.json > $SP/cp14-aaa3.log 2>&1; echo "EXIT $?" >> $SP/cp14-aaa3.log
for n in 08 09 10 11 12 13 14; do cd $SP/cp$n && SEEDS=4 timeout 3000 node --test --test-name-pattern="CP-$n" tests/campus-tickets.test.js > $SP/cp$n-own2.log 2>&1; echo "EXIT $?" >> $SP/cp$n-own2.log; done
