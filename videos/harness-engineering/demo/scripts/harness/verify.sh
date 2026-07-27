#!/usr/bin/env bash
#
# Harness piece 4 of 4: FEEDBACK — the verification contract of this project.
#
# The value here is not the command inside: it is the stable name in front of it. The
# agent never has to infer how this project is checked; it runs `npm run verify` and
# gets an answer. If the test command changes tomorrow, it changes here, and every
# agent, person and CI pipeline keeps working unchanged.
#
# The exit code is the real product of this script. A non-zero exit is what stops an
# agent from declaring success, so this must never swallow a failure: no `|| true`,
# no piping into anything that discards the status.

set -euo pipefail

# Run from the project root so the test path below resolves the same way every time.
cd "$(dirname "$0")/../.."

echo "Running export-orders verification..."

# These tests turn the decisions written in docs/product/export-orders.md into checks a
# machine can run. The spec explains the intent; this measures the part that can be
# measured mechanically.
node --test test/export-orders.test.js
