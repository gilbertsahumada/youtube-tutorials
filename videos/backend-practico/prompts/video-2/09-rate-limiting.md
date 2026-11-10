# Rate limiting: does the limit hold across clients and instances?

```text
Review request limiting in this repository. Find the selected endpoint, caller identification, limiter algorithm, shared or local state, rejection response, client retry handling, deployment configuration, and tests. If no endpoint is specified, choose a costly or frequently called operation and explain the selection.

Illustration: a fixed window allows 3 requests per user and operation every 10 seconds. A fourth request arriving 5 seconds into that window gets HTTP 429 and Retry-After: 5. A request after the window resets can be accepted. These are demonstration values; infer this application's actual policy rather than copying them.

Inspect:
- What is counted, the time/window algorithm, and how caller and operation are identified. Do not assume an untrusted forwarded header or arbitrary user ID provides a reliable identity.
- Whether check-and-increment is atomic under simultaneous requests, and whether multiple server instances coordinate the count when the policy promises a global limit.
- Whether 429 and Retry-After match the policy and remaining delay. The header may express seconds or an HTTP date; it must not always be a hardcoded five seconds.
- Whether the client respects the wait instead of immediately retrying, and how a reset window or another caller is handled.
- Whether bursts near a fixed-window boundary are acceptable for the stated policy. Do not classify that algorithm's documented behavior as an implementation bug by itself.
- Whether expensive work also needs a separate concurrency bound, and what the current limiter does if its backing store fails.

Propose checks with a controlled clock and local state for the allowed requests, rejection, next window, caller isolation, concurrent arrivals, and multiple instances where supported. Do not flood a live endpoint.

Return the actual policy, file:line findings with concrete failure sequences, and the smallest proposed correction. Report exact commands and results for checks actually run; label other checks and deployment assumptions as unverified. Do not edit files, call live services, or expose private data.
```

References: [HTTP 429, RFC 6585](https://www.rfc-editor.org/rfc/rfc6585.html#section-4), [Retry-After, RFC 9110](https://www.rfc-editor.org/rfc/rfc9110.html#section-10.2.3).
