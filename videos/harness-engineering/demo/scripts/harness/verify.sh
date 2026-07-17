#!/usr/bin/env bash
set -euo pipefail

cd "$(dirname "$0")/../.."

echo "Running export-orders verification..."
node --test test/export-orders.test.js
