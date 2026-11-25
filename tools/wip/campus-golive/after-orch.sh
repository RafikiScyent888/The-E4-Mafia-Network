#!/bin/bash
SP=/tmp/claude-0/-home-user/c41d5321-7fd8-5327-b7c4-485ab1f2a414/scratchpad/stg; L=$SP/orch.log
until grep -q "LIVE CP-15\|BLOCKED" $L 2>/dev/null; do sleep 30; done
grep -q "BLOCKED" $L && exit 0
for w in e4-jmb e4-anx e4-l4 e4-sbt; do cd /home/user/$w || continue; b=$(git branch --show-current); git fetch -q origin main
  git -c user.name=Claude -c user.email=noreply@anthropic.com merge -q --no-edit origin/main -m "Merge origin/main (Level 4 complete) into $b

Co-Authored-By: Claude Opus 5.5 <noreply@anthropic.com>
Claude-Session: https://claude.ai/code/session_01RJLBXRTXfG6AwMuw7eyynw" && git push -q origin HEAD:$b && echo "$(date +%H:%M) merged main into $b ($(git rev-parse --short HEAD))" >> $L || echo "$(date +%H:%M) merge into $b needs a look" >> $L
done
