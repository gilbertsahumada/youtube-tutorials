# N+1 queries: how many database calls build one response?

```text
Review this repository for N+1 database queries. Choose a real list endpoint that includes related data, and trace the route, service, ORM/repository calls, lazy loading, serializers, and response construction. Identify the actual framework and version before recommending its APIs.

Scenario: a page contains 20 orders from distinct customers. One query retrieves orders, then a loop fetches each customer separately: 21 queries. A batched customer lookup can make that 2; an appropriate join may use a different count. These numbers are an illustration, not measurements of this repository.

Determine:
- Which code triggers each query, including implicit relation access while serializing, and how the query count grows as the page grows.
- Whether pagination merely limits how large the N+1 problem becomes instead of removing the per-item lookup.
- Whether the existing stack supports collecting distinct related IDs and loading them together, eager loading, or a suitable join, then mapping the results without individual fallback reads.
- Whether the proposed loading strategy preserves authorization, null/missing relations, ordering, and the response contract.
- Whether joins across collections multiply rows or duplicate large payloads. Evaluate row volume and application work as well as query count; do not optimize for the lowest count alone.

Use existing query logging or local integration fixtures if available. Propose comparing different page sizes and recording the queries needed to build the complete response. State whether counters use real database calls or controlled substitutes. Compare timings only under stated, comparable data/index/cache conditions.

Return a query trace with file:line evidence, any demonstrated per-item query pattern, and the smallest proposed fix with its tradeoffs. Include checks for unchanged response data and query-count growth. Report exact commands and results for checks actually run, and label the rest as proposed. Do not edit files, contact live services, or fabricate benchmark results.
```

Reference: [EF Core's explanation of N+1 and efficient loading](https://learn.microsoft.com/en-us/ef/core/performance/efficient-querying). Use the equivalent features of the project's actual data layer.
