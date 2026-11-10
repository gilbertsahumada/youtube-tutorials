# API versioning: will an existing client still understand the response?

```text
Review how this repository evolves its API contracts. Inspect routes or version headers, request/response schemas, serialization, documentation, tests, and any consumers available in the repository. Identify external consumers that cannot be inspected instead of assuming they do not exist.

Illustrative change: a client currently receives total: 25, meaning USD 25. A new response would make total an object containing amount: 2500 and currency: USD, with amount expressed in cents. The business value is unchanged, but the type and unit expected by client code have changed. Use a real contract change from this repository if available; otherwise keep this as a clearly hypothetical example.

Determine:
- What existing consumers read and calculate, including types, required fields, units, currency, defaults, and error behavior.
- Exactly which client operation would fail or produce a wrong value after an incompatible change. Do not stop at saying that the contract is broken.
- How the existing versioning mechanism can preserve the old behavior while an updated consumer adopts the new one. Do not require URL versioning if this project uses another supported strategy.
- Whether the new client changes its parsing and unit conversion as well as selecting the new version. The example's division by 100 applies to USD cents, not universally to every currency.
- How migration instructions, compatibility checks, usage evidence, and retirement notices prevent removing an old contract while consumers still depend on it.

Propose checks for both an unchanged old consumer and an updated new consumer, asserting the same business amount. Review supposedly additive changes against actual consumer validation; do not assume every added field is harmless or every change requires a new version.

Return an old/new contract comparison, affected consumers with file:line evidence, a minimal migration proposal, and verification steps. Separate observed breakage from unknown external compatibility. Report commands and results only if actually run; label unexecuted checks as proposed. Do not edit files, call live services, or redesign the API without evidence that the current approach fails.
```

Reference: [GitHub's API versioning and migration documentation](https://docs.github.com/en/rest/about-the-rest-api/api-versions), an example of preserving contracts and communicating incompatible changes rather than a required versioning mechanism.
