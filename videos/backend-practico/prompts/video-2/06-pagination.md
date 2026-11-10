# Pagination: can the client continue through a growing list?

```text
Review pagination in this repository. Find an actual list endpoint, its client, filters, authorization scope, database query, indexes, and tests. Use the existing stack and query semantics.

Scenario: an order history contains thousands of records, but the first response should return only a bounded page. The client must be able to continue in a defined order. Twenty records per page is the video's example, not a mandatory production setting.

Inspect:
- Whether the server enforces a default and maximum page size rather than trusting any requested limit, and whether the database query is bounded before loading all results.
- Whether ordering is deterministic. For example, created_at DESC plus a unique ID can break timestamp ties; the cursor and continuation predicate must follow that same order.
- What position the cursor represents, how the client obtains and sends it, and how invalid or incompatible cursors are handled. Encoding a cursor does not replace authorization or bind it to the correct filters by itself.
- Whether every page preserves caller/tenant access restrictions and the intended filters.
- Whether the query and indexes support continuation efficiently. Explain the tradeoffs of an existing offset implementation rather than declaring all offsets wrong.
- What concurrent inserts, deletes, or changes to ordering fields do to the traversal. A cursor alone does not provide a frozen snapshot.

Propose checks for equal timestamps, page-size limits, the last/empty page, invalid cursors, changed filters, and caller isolation. For a fixed dataset, verify that successive pages do not skip or repeat eligible rows. Document separate expectations when the dataset changes.

Return the request-to-query flow, confirmed gaps with file:line evidence, the smallest proposed correction, and verification steps. Use existing local fixtures or query-plan tools only when available and appropriate. Distinguish static reasoning from measured database behavior; do not invent timings or plans. Do not edit files, contact live services, or expose private data.
```

References: [PostgreSQL ordering and LIMIT/OFFSET](https://www.postgresql.org/docs/current/queries-limit.html), [EF Core pagination and keyset examples](https://learn.microsoft.com/en-us/ef/core/querying/pagination).
