# Idempotency: can a retry create a second operation?

```text
Review this repository for duplicate side effects caused by retries. Inspect the actual stack, routes, client calls, persistence code, migrations, and tests. If I name an operation, use it; otherwise choose a relevant mutation such as creating an order. Explain how your chosen operation maps to the example below.

Scenario: the server commits an order, but the client never receives the response. The client retries the same purchase. The expected business outcome is one order, not two.

Trace these points in the implementation:
- Who creates the idempotency key, when it exists, how it is sent, and whether the client reuses it for the same intent. A key returned only in the lost response cannot identify that retry.
- How the server scopes the key to the authenticated caller and operation, associates it with the request content and result, and defines expiration.
- What prevents two simultaneous requests from both passing an existence check. Inspect database uniqueness and transaction boundaries, including rollback and an in-progress attempt.
- What happens when the same key arrives with different content, another user uses that key, or an expired key is reused. Compare the behavior with the documented contract.
- Whether an external payment or message can be repeated outside the local database transaction. Do not assume a local idempotency record protects a remote side effect.

Propose checks for a lost response after commit, concurrent identical requests, changed payload, caller isolation, and expiration. Distinguish a retry from a second intentional purchase with a new key. Show the business records and results each check should inspect.

Return the request-to-storage flow, confirmed gaps with file:line evidence and a failure sequence, and the smallest proposed correction using the existing stack. Separate verified behavior, possible risks, and unknowns. Use existing local tests or fixtures when available; report exact commands and results, or label the checks as proposed. Do not edit files, call live services, print secrets, or claim a check passed without evidence.
```

Reference: [Stripe's documented idempotency behavior](https://docs.stripe.com/api/idempotent_requests). Its retention and replay policies are examples to compare with the application's own contract.
