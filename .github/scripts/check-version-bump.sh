#!/usr/bin/env bash
# Fails when shipped code changed between BASE and HEAD but frontend/package.json "version" did not.
# Docs, tests, workflows and lockfiles are exempt (docs/CONTRIBUTING.md, "Versioning").
# Usage: check-version-bump.sh <base-sha> [head-sha]
set -euo pipefail
base="${1:-}"; head="${2:-HEAD}"
if [ -z "$base" ] || [ "$base" = "0000000000000000000000000000000000000000" ]; then
  echo "No base commit (new branch or first push): nothing to compare."; exit 0
fi
changed=$(git diff --name-only "$base" "$head" -- frontend/src frontend/index.html backend/app \
  ':(exclude,glob)**/*.test.ts' ':(exclude,glob)**/*.test.tsx' ':(exclude,glob)frontend/src/test/**')
if [ -z "$changed" ]; then echo "No shipped code changed: no bump needed."; exit 0; fi
ver() { git show "$1:frontend/package.json" | node -p 'JSON.parse(require("fs").readFileSync(0,"utf8")).version'; }
old=$(ver "$base"); new=$(ver "$head")
if [ "$old" = "$new" ]; then
  echo "::error file=frontend/package.json::Shipped code changed but the version is still $new. Bump it (docs/CONTRIBUTING.md, Versioning)."
  echo "$changed"; exit 1
fi
echo "Version bumped: $old -> $new"
