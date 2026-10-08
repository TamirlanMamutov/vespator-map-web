#!/usr/bin/env bash
set -euo pipefail

SCRIPT_DIR="$(cd -- "$(dirname -- "${BASH_SOURCE[0]}")" && pwd -P)"
cd -- "$SCRIPT_DIR"
[[ "$(basename -- "$SCRIPT_DIR")" == "MapWebPage" ]] || { echo "Run this script from its MapWebPage location." >&2; exit 1; }
for tool in git gh; do
  command -v "$tool" >/dev/null || { echo "Install $tool first." >&2; exit 1; }
done
gh auth status
[[ ! -L .git && ! -f .git ]] || { echo "Refusing an external Git directory/worktree." >&2; exit 1; }
if [[ ! -d .git ]]; then
  git init -b main .
fi
[[ "$(cd -- "$(git rev-parse --show-toplevel)" && pwd -P)" == "$SCRIPT_DIR" ]] || { echo "Repository must be rooted inside MapWebPage." >&2; exit 1; }
[[ "$(git branch --show-current)" == "main" ]] || { echo "Switch to main before setting up the remote." >&2; exit 1; }
git add -- .
if ! git diff --cached --quiet; then
  git -c core.quotePath=false commit -m "Build Vespator Front Imperial Cogitator" -m "Co-authored-by: Copilot <223556219+Copilot@users.noreply.github.com>"
fi
if git remote get-url origin >/dev/null 2>&1; then
  echo "Origin already exists; no remote was replaced. Push with: git push -u origin main"
else
  gh repo create vespator-map-web --private --source=. --remote=origin --push
fi
echo "Repository setup complete. Enable GitHub Pages > Source > GitHub Actions."
