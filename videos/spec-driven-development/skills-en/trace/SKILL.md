---
name: trace
description: Draws, in ASCII, the sequence diagram and the flow diagram of a piece of existing code, to understand how it works before modifying it. Use it when the user wants to understand an existing flow, function or feature, or before scoping over legacy code.
---

# Trace: existing code → diagrams

You read the code the user points at (a function, an endpoint, a feature) and reconstruct its real behavior in two ASCII diagrams. **Don't make things up:** what you draw has to be in the code. If something isn't visible in the code (a branch that never runs, a case that isn't handled), say so instead of guessing.

Steps:

1. **Find the entry point.** Where the flow starts (the handler, the route, the public function). If the user didn't give it, ask or look for it.
2. **Follow the real calls.** What calls what, in what order, what data is passed. Note the actual files and functions (not generic ones).
3. **Draw two diagrams:**

SEQUENCE. By default the **compact** version (an ordered list); the **full** one with lifelines only if the user asks for it.

Compact (default):
```
SEQUENCE (chronological order ↓)
1. Entry → ComponentA: call()
2. ComponentA → ComponentB: other()
3. ComponentB → ComponentA: data
4. ComponentA → Entry: response
```
Full (only if asked) — one vertical lifeline (`│`) per real participant, time going DOWN; calls solid arrow (`──▶`), returns dashed (`◀ ─ ─`):
```
Entry       ComponentA     ComponentB
  │              │              │
  │  call()      │              │
  │─────────────▶│              │
  │              │  other()     │
  │              │─────────────▶│
  │              │◀ ─ data ─ ─  │
  │◀─ response ─ │              │
  ▼              ▼              ▼
```
FLOW (the real decisions and branches in the code):
```
 input
    │
    ▼
 real condition? ──no──▶ branch it takes
    │ yes
    ▼
 action ──▶ result
```

4. **Flag what's missing or smells off.** Cases the code does NOT handle, dead branches, implicit decisions. This is the most valuable part: what the diagram reveals the code forgot.

Close by asking whether the flow you drew is the one the user expected. If it doesn't match, you already have the input for a `scope` of the fix.
