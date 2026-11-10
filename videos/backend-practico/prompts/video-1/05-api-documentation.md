# API documentation: can another developer complete the integration?

```text
Review this repository's public API documentation against its implementation. Choose an existing mutation and the client flow around it. Start with the README, OpenAPI description if present, example requests, route code, configuration examples, and tests. Follow instructions as a developer who has not seen a video or private notes.

Scenario: another developer must authenticate, create an order, and repeat the same attempt after losing the response. The guide should let them reproduce the intended result rather than guess how the API behaves.

Check whether the published material explains:
- Requirements and a local starting point, the request URL and HTTP method, authentication, required headers, body fields, and usable non-private test data.
- Who creates an idempotency key before the first request, how to reuse it with the same content, its scope and lifetime, and what happens if content changes. A schema saying the key is a string does not explain those rules.
- Expected status, response shape, and business result. Repeating the example should identify the original operation rather than create another one; show how a developer can verify that.
- Stable error identifiers, supported versions, and units/currency where they affect the chosen operation.
- Whether the OpenAPI description and generated reference, if used, match actual requests and responses, and whether behavioral rules and walkthroughs are documented alongside field types.

Attempt the documented flow only with an existing local test setup. Do not contact live services or use private credentials. If execution is unavailable, trace the relevant code and mark the walkthrough as unexecuted; do not claim the integration works.

Return the first point where a new developer would get stuck, file:line evidence for each mismatch, and a concise proposed walkthrough with commands, execution directory, placeholders, and expected results. Distinguish shell commands from interactive assistant input. Propose how to keep examples checked when the API changes. Do not edit files or fabricate requests, responses, or test outcomes as observed evidence.
```

Reference: [What OpenAPI describes and how tools use it](https://learn.openapis.org/introduction.html).
