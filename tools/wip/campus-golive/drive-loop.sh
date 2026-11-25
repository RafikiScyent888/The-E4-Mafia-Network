#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
for n in 03 04 05 06 07 08 09 10 11 12 13 14; do cd $SP/cp$n && env CHROME=/opt/pw-browsers/chromium ONLY=CP-$n timeout 3000 node tools/drive.mjs > $SP/cp$n-drive.log 2>&1; echo "EXIT $?" >> $SP/cp$n-drive.log; done
cd $SP/cp14 && env CHROME=/opt/pw-browsers/chromium ONLY=campus-desk timeout 3000 node tools/drive.mjs > $SP/cp14-drive-desk.log 2>&1; echo "EXIT $?" >> $SP/cp14-drive-desk.log
