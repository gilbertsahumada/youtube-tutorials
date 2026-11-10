# Data consistency: can two purchases reserve the same last unit?

```text
Review concurrent writes and any asynchronous projections in this repository. Choose a real operation involving a limited resource, inspect its database and isolation behavior, transaction boundaries, jobs/events, consumers, and tests. Use the actual stack; do not add a broker or outbox merely because it appears in the example.

Scenario: two customers make different purchases for the last unit of a product. These are separate intents, not retries with one idempotency key. Exactly one purchase should reserve that unit; neither customer has a predetermined priority.

Trace both requests and determine:
- Whether each can read the same available stock and then write independently. A transaction around separate reads/writes is not by itself proof that this race is prevented.
- How a conditional update, lock, constraint, or other supported mechanism enforces availability under concurrency. Check affected-row/conflict handling and rollback.
- Whether the successful reservation and order creation commit atomically. The losing request must not leave a confirmed order or other unintended side effect.

If an asynchronous sales report or similar projection exists, trace its update separately:
- What durable work survives a crash after order commit. For an outbox, the event and order must be recorded in the same transaction; inspect publisher retries and failures around publication.
- How repeated delivery is handled. Deduplication and the projection update must remain correct if processing repeats or stops partway through; an unsafe check-then-record sequence may still double-count.
- How the projection converges after recovery. Do not confuse acceptable reporting delay with permission to oversell, or claim that an outbox guarantees exactly-once delivery.

Propose a local database concurrency check for one final unit, plus crash/replay and duplicate-event checks for any existing projection. Inspect final stock, confirmed orders, and report totals. Distinguish real concurrent database evidence from mocks or a proposed test.

Return the competing request timeline, transaction/event boundaries, file:line findings, and a minimal correction. State which assumptions and checks remain unverified. Do not edit files, call live services, print private data, or invent successful test results.
```

References: [PostgreSQL transaction isolation and concurrent updates](https://www.postgresql.org/docs/current/transaction-iso.html), [Transactional outbox and duplicate delivery](https://docs.aws.amazon.com/prescriptive-guidance/latest/cloud-design-patterns/transactional-outbox.html).
