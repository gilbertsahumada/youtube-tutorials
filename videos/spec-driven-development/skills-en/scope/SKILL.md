---
name: scope
description: Turns a vague idea or feature into an executable spec using the 5 questions (context, goal, constraints, tasks and verification) before writing any code. Use it when the user describes something they want to build and asks for a spec, or to plan the work before implementing.
---

# Scope: idea → spec

Turn the user's idea into a spec and save it to `specs/<slug>.md`. Read `CLAUDE.md` / `AGENTS.md` first if they exist (that's where the global conventions and constraints come from). Ask only if you're blocked. **Don't write code yet.**

You work in **two beats**:

1. **Draw the flow and confirm.** Before splitting anything into tasks, generate the `## Flow` section with TWO ASCII diagrams (sequence + flow) and **stop**: show them to the user and ask them to confirm that's the behavior they want. This is where you get sign-off on the decisions the agent would otherwise invent (time windows, edge cases, what happens when there's no data). Don't move on until you get the "yes".
2. **Only then, split it into tasks.** With the flow approved, complete the rest of the spec (Constraints, Out of scope, Tasks with their Verify, Done).

The spec must have exactly these sections:

```md
# <Feature name>

## Context
- What exists today (stack, folders) that you must respect.
- Patterns to follow (name a file in the repo that already does it well).
- Decisions already made (so they aren't re-litigated).

## Goal
The concrete, bounded outcome. One sentence, not "improve X".

## Flow
SEQUENCE diagram. By default deliver the **compact** version (an ordered list of steps); only if the user asks for the detail, give the **full** one with lifelines.

Compact (default):
```
SEQUENCE (chronological order ↓)
1. Actor → Component: action
2. Component → OtherComp: call()
3. OtherComp → Component: return
4. Component → Actor: response
```
Full (only if asked) — each participant with its vertical lifeline (`│`), time going DOWN; calls solid arrow (`──▶`), returns dashed (`◀ ─ ─`):
```
Actor      Component       OtherComp
  │             │              │
  │  action     │              │
  │────────────▶│              │
  │             │  call()      │
  │             │─────────────▶│
  │             │◀ ─ return ─ ─│
  │◀─ response ─│              │
  ▼             ▼              ▼
```
FLOW diagram (the decisions and branches — this is where the edge cases live):
```
 input
    │
    ▼
 condition? ──no──▶ branch A
    │ yes
    ▼
 action ──▶ result
```

## Constraints
- What NOT to touch (auth, data model, API contracts).
- No new dependencies unless necessary and justified.

## Out of scope
- What does NOT go in this feature.

## Tasks
### T1: <short title>
- **Do:** <specific change>
- **Files:** <paths it will touch>
- **Verify:** <specific command or manual check>

### T2: ...

## Done (final validation)
- [ ] <build/test command passes>
- [ ] Manual: <what to check end-to-end>
```

Rules when writing it:
- **Flow first, confirmation required:** the two diagrams are generated BEFORE the tasks and the user approves them. The flow diagram must show every decision and edge case (what happens when there's no data, time limits, double execution). If the user corrects the flow, adjust the diagrams and confirm again before continuing.
- **Small tasks:** each one fits in a single session, < ~3 files, safe to commit on its own. If a task might hit the context limit, split it.
- **Real Verify:** prefer a command over a manual review; the manual one must be specific ("click X, you see Y"), not "verify it works".

When you're done, run the completeness test on yourself: *could a fresh agent, with no context beyond this spec, implement T1?* If not, detail is missing.
