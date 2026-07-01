---
name: exec
description: Implements ONE single task from an existing spec, without touching anything else. Use it when a spec file exists in the specs folder and the user asks to run or implement a concrete task (for example T1 or T2).
---

# Exec: run a single task

Implement ONE task from the spec the user points at (e.g. `specs/<slug>.md` task `T1`). Not one line more.

1. Read the full spec.
2. Read Context, Goal, Constraints and Out of scope to get the framing.
3. Implement **exactly** what that task describes.

Hard rules:
- **Only that task** — ignore the others in the spec.
- **Only the files** listed in the task.
- **No drive-by refactors** or improvements that weren't asked for.
- Follow the constraints to the letter. **Do not add dependencies** unless the spec says so explicitly.
- Write tests if the task asks for them.

When you're done, report:
- Files created or modified.
- What you did and why.
- The result of the **Verify** step (or suggest running the `prove` skill for the real evidence).
- Risks or doubts before continuing.

**Do not move on to the next task.** For the next one, start in a fresh session (clean context).
