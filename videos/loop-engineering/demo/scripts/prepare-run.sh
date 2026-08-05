#!/usr/bin/env bash

set -euo pipefail

DEMO_PATH="videos/loop-engineering/demo"
REPO_ROOT="$(git rev-parse --show-toplevel)"
BRANCH="$(git -C "$REPO_ROOT" branch --show-current)"
TARGET="$REPO_ROOT/$DEMO_PATH"

if [[ ! -f "$TARGET/package.json" ]] || ! grep -q '"name": "loop-engineering-pr-demo"' "$TARGET/package.json"; then
  echo "Preparación cancelada: $TARGET no parece ser la demo de Loop Engineering." >&2
  exit 1
fi

if [[ "$BRANCH" != demo/loop-engineering-* ]]; then
  echo "Usa una rama con este prefijo antes de preparar la corrida:" >&2
  echo "  demo/loop-engineering-" >&2
  exit 1
fi

if [[ -n "$(git -C "$REPO_ROOT" status --short)" ]]; then
  echo "La preparación requiere un árbol limpio. Revisa git status antes de continuar." >&2
  exit 1
fi

cat > "$TARGET/RUN.md" <<'EOF'
# Loop Engineering run

This file activates the reproducible PR lifecycle used by the tutorial.

Initial state: webhook delivery policy is failing locally and in CI.
EOF

echo "Corrida preparada en $BRANCH."
echo
echo "Siguiente paso, desde $DEMO_PATH:"
echo "  git add RUN.md"
echo "  git commit -m \"demo: start loop engineering run\""
echo "  git push -u origin $BRANCH"
