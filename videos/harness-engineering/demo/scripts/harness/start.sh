#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if (( node_major < 20 )); then
  echo "Node.js 20 or newer is required. Found $(node --version)." >&2
  exit 1
fi

required_files=(
  "docs/harness/workflow.md"
  "docs/product/export-orders.md"
  "src/server.js"
  "test/export-orders.test.js"
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

echo "Harness ready"
echo "Node: $(node --version)"
echo "Product spec: docs/product/export-orders.md"
echo "Verification: npm run verify"
