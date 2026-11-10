# API errors: can the client decide what to do next?

```text
Review error handling in this repository. Start from an actual endpoint and follow its domain errors, HTTP mapping, logs, tests, and client-side handling. Use the current framework and response conventions rather than introducing a new error format by default.

Scenario: an order cannot be created because stock is exhausted. The client must distinguish this expected rejection from an unexpected server failure, show a useful message, and avoid a pointless immediate retry.

Inspect the following:
- Whether expected domain rejections, invalid input, authentication failures, authorization failures, and unexpected errors remain distinguishable. Explain the chosen HTTP statuses; 409 is the stock-conflict example, not a mandatory status for every domain error.
- Whether the response has a stable machine-readable code or problem type. Check that the frontend branches on that identifier rather than matching a message that may be translated or rewritten.
- Whether a request/correlation ID connects the response to internal logs, and how incoming IDs are validated or generated.
- Whether the response and logs expose stack traces, SQL details, tokens, credentials, or unnecessary personal data. Cite the code without reproducing private values.
- How the client decides between correcting input, choosing another product, authenticating, or retrying a transient failure. A retry of a mutation also needs the operation's idempotency rules.

Propose checks for the stock rejection, malformed input, an unauthorized request, and an unexpected exception. Follow at least one error all the way to the UI or consuming client. Include expected response fields and the corresponding internal evidence, without inventing logs.

Return confirmed gaps with file:line references, their user-visible consequences, and the smallest proposed correction. Report any existing local test commands actually run and their results; otherwise mark checks as proposed. Separate unverified paths from demonstrated failures. Do not edit files, call live services, or print secrets.
```

Reference: [Problem Details for HTTP APIs, RFC 9457](https://www.rfc-editor.org/rfc/rfc9457.html). Compare it with the existing contract; adopting it is not a prerequisite for a useful review.
