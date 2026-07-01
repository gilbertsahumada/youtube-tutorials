---
name: audit
description: Reviews the changes (the diff) as a senior engineer against the spec, looking at scope, correctness, simplicity and consistency. Use it before committing or merging, when a review of the code or the diff is requested.
---

# Audit: senior review of the diff

Review the changed files (or the given target) the way a senior engineer would, against the spec. Ideally it runs in a **fresh context / separate session**, so it isn't the same agent reviewing its own work.

Evaluate in this order:

### 1. Scope (first)
- Did it touch anything in the spec's **"Do not touch"** or **"Out of scope"**? If so, flag it: that's the most serious.
- Did it do more than asked (features, abstractions, dependencies nobody requested)?

### 2. Correctness
- Uncovered edge cases, obvious bugs, error handling.

### 3. Simplicity
- Is it over-engineered? Can it be shorter without losing clarity? Unnecessary abstractions?

### 4. Consistency
- Does it follow the patterns in `CLAUDE.md` / `AGENTS.md` and the rest of the repo? Is it idiomatic?

Output:
- If there are problems: a list with **file:line** + the concrete fix.
- If it's fine: say so briefly and move on.

Be constructive, don't nitpick. Focus on what matters: bugs, scope, clarity, maintainability. Don't suggest changes just for the sake of it.
