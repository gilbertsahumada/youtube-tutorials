#!/usr/bin/env bash
#
# Harness piece 3 of 4: TOOLS — the "prepare" step of the workflow.
#
# This is the first thing an agent runs, before touching any code. Its job is not to
# install or configure anything: it is to fail loudly when the environment is wrong,
# and to point at the two things the agent would otherwise have to guess — where the
# product decisions live, and how this project is verified.
#
# Two properties matter:
#   - Fast. It only checks; it never downloads or builds.
#   - Idempotent. Running it ten times leaves the project exactly as it was, so an
#     agent can call it at the start of every session without side effects.

set -euo pipefail

# Always operate from the project root, no matter where the caller invoked this from.
cd "$(dirname "$0")/../.."

# The test runner used by verify.sh (`node --test`) needs Node 20+. Checking here turns
# a confusing test failure later into a clear message now.
node_major="$(node --version | sed -E 's/^v([0-9]+).*/\1/')"
if (( node_major < 20 )); then
  echo "Node.js 20 or newer is required. Found $(node --version)." >&2
  exit 1
fi

# The pieces this workflow depends on. If any is missing, the agent would silently work
# without context — exactly the failure this harness exists to prevent.
required_files=(
  "docs/harness/workflow.md"      # how to work here
  "docs/product/export-orders.md" # what "done" means for this feature
  "src/server.js"                 # the code under change
  "test/export-orders.test.js"    # the executable feedback
)

for file in "${required_files[@]}"; do
  if [[ ! -f "$file" ]]; then
    echo "Missing required file: $file" >&2
    exit 1
  fi
done

# Orientation output. The agent reads this instead of inferring the project layout.
echo "Harness ready"
echo "Node: $(node --version)"
echo "Product spec: docs/product/export-orders.md"
echo "Verification: npm run verify"
