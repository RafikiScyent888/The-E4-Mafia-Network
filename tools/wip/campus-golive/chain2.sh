#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
cd $SP/cp15 && timeout 6000 npm test > $SP/cp15-npm.log 2>&1; echo "EXIT $?" >> $SP/cp15-npm.log
cd $SP/cp15 && env CHROME=/opt/pw-browsers/chromium E4_PIN="${E4_PIN:?set E4_PIN first}" timeout 7000 node tools/drive.mjs > $SP/cp15-full.log 2>&1; echo "EXIT $?" >> $SP/cp15-full.log
echo "$(date +%H:%M) chain2 done" >> $SP/chain.log
