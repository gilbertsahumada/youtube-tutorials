---
name: prove
description: Verifies that a task is actually done by running its Verify step and showing the real output, no self-reporting. Use it after implementing a task, when you want to confirm it truly works and not just that the agent claims so.
---

# Prove: verify for real (no self-reporting)

Prove the task is done by running its `Verify` and showing the **real evidence**. This is the piece that keeps the agent from fooling itself. Ideally it runs in a different context/session than the one that implemented it.

Take the **Verify** step of the given task and run it:

- **If it's a command:** run it and **paste the COMPLETE, real output** (not a summary, not "all passed"). If it fails, show the error as-is.
- **If it's a manual check:** do the exact steps and report what you observed ("I did X, I saw Y"), including the failing path when it matters.

Hard rules:
- **Do NOT declare success without pasted evidence.**
- **Do NOT invent** command output or results. If you couldn't run it, say so and explain why.
- One task, one piece of evidence: if there's no evidence, the task is **not done**.

Final verdict: **PASS / FAIL**, with the evidence that backs it.
