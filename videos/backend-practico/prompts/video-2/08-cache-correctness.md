# Cache correctness: when can an old value still be returned?

```text
Review caching in this repository. Choose a real cached read and the write path that changes its underlying data. Inspect keys, TTLs, cache-aside or other loading behavior, invalidation, transaction boundaries, and tests. If the selected operation is not cached, assess whether caching fits its freshness requirements rather than assuming a missing cache is a defect.

Scenario: a product page returns USD 25 from a cached copy. The database price changes to USD 30, but subsequent reads still show USD 25. Identify the permitted staleness and the mechanism that eventually refreshes the response.

Trace:
- A cache miss, loading from the source, storing a value with its expiry, and a later hit.
- The update, commit, and invalidation/refresh order, including failures between steps.
- A concurrent race: a reader obtains the old value, a writer commits and invalidates, then the reader stores its old value again. Explain whether the implementation permits this and how its freshness policy handles it.
- Whether keys separate every context that changes the response, such as tenant, product, currency, user-specific pricing, or filters. Do not reuse one caller's private response for another.
- What happens when the cache is unavailable or many requests miss together. Relate any proposed mitigation to the actual workload and existing infrastructure.
- Whether critical operations, such as confirming price and reserving stock, enforce their authoritative business rules rather than trusting a display cache alone.

Propose local checks for miss/hit, expiry with a controlled clock where supported, an update followed by another read, the concurrent stale refill, context isolation, and a cache failure. Do not claim that TTL or deleting a key alone eliminates every stale-read race.

Return the read/write timeline, file:line evidence for confirmed gaps, and a minimal correction consistent with the required freshness. Separate expected temporary staleness from a policy violation. Report executed checks and their conditions, and label other checks as proposed. Do not edit files, call live services, or expose cached private data.
```

References: [Redis key expiration](https://redis.io/docs/latest/develop/using-commands/keyspace/), [Cache-aside behavior and consistency considerations](https://learn.microsoft.com/en-us/azure/architecture/patterns/cache-aside).
