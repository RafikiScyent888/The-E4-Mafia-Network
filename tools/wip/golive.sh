#!/bin/bash
# golive.sh STAGED_DIR "commit message"   — make the live worktree's tree exactly the staged tree, commit (not push)
set -euo pipefail
ST="$1"; MSG="$2"; LIVE=/home/user/e4-sb01
cd "$LIVE"
git fetch -q origin main
[ "$(git rev-parse HEAD)" = "$(git rev-parse origin/main)" ] || { echo "live worktree is not at origin/main"; exit 1; }
[ -z "$(git status --porcelain)" ] || { echo "live worktree not clean"; exit 1; }
git rm -rq --cached . && find . -mindepth 1 -maxdepth 1 ! -name .git -exec rm -rf {} +
(cd "$ST" && tar -c --exclude=./.git --exclude=./node_modules .) | tar -x -C "$LIVE"
git add -A
git -c user.name=Claude -c user.email=noreply@anthropic.com commit -qm "$MSG"
git show --stat --format="%h %s" HEAD | tail -30
