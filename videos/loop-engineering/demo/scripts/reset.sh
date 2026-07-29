#!/usr/bin/env bash

set -euo pipefail

DEMO_PATH="videos/loop-engineering/demo"
REPO_ROOT="$(git rev-parse --show-toplevel)"
TARGET="$REPO_ROOT/$DEMO_PATH"

if [[ ! -f "$TARGET/package.json" ]] || ! grep -q '"name": "loop-engineering-demo"' "$TARGET/package.json"; then
  echo "Reset cancelado: $TARGET no parece ser la demo de Loop Engineering." >&2
  exit 1
fi

echo "Se descartarán cambios sin commit únicamente en:"
echo "  $DEMO_PATH/src"
echo "  $DEMO_PATH/.claude"
echo "  $DEMO_PATH/.codex"

git -C "$REPO_ROOT" restore -- "$DEMO_PATH/src"
git -C "$REPO_ROOT" clean -fd -- "$DEMO_PATH/.claude" "$DEMO_PATH/.codex"

if npm run verify; then
  echo "Reset incorrecto: la demo debería volver al estado inicial fallando." >&2
  exit 1
fi

echo "Reset confirmado: la demo volvió al estado inicial."
