#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg
until grep -q "^EXIT" $SP/cp02-drive-campus-desk.log 2>/dev/null; do sleep 10; done
bash $SP/drive-loop.sh &
bash $SP/npm-loop.sh &
wait
