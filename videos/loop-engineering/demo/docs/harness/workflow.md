# Development workflow

This repository keeps product decisions, executable checks, and agent instructions together.

For each task:

1. Run `npm run harness:start` to check the local environment.
2. Read the relevant document under `docs/product/` before editing code.
3. Run `npm run verify` before writing anything. The failures it reports are the task.
4. Make the smallest change that satisfies that document.
5. Run `npm run verify` again and keep going until it passes.
6. Treat a failed check as feedback about the implementation. Do not change the expected behavior or weaken the check.

The task is complete only when `npm run verify` exits successfully.
