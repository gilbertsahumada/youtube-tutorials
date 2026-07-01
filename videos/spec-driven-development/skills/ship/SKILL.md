---
name: ship
description: Writes the commit message for the staged changes, in conventional commits format and explaining the why. Use it when you want to commit or generate the commit message.
---

# Ship: commit message

Write the commit message for the staged changes. Explain the **why**, not just the what.

1. Run `git diff --staged` to see the changes.
2. Write a message in conventional commits format:

```
<type>(<scope>): <subject>

<body: why this change was needed, not just what changed>

Refs: T<n> / #<issue>
```

Types: `feat`, `fix`, `refactor`, `test`, `docs`, `chore`.

Rules:
- Subject in the imperative, max ~50 characters.
- The body explains **why** (future-you digging through `git blame` at 2am will thank you).
- Reference the spec task (`T1`) or the issue.
- If you can't sum it up in one line, the change is probably too big.
