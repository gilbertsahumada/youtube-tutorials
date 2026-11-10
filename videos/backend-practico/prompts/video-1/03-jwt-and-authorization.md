# JWT and authorization: whose data can this caller access?

```text
Review authentication and resource authorization in this repository. Locate token issuance, verification configuration, protected routes, resource queries, and tests. If the application does not use JWTs, state that and review its actual authentication mechanism; do not propose replacing it just to fit this prompt.

Scenario: user A has a valid token and requests an order owned by user B. Proving the token is valid must not automatically grant access to that order.

Trace and explain:
- Who issues the token after authenticating the user, which claims identify the caller, and how requests carry it.
- How signature verification works with the configured algorithm. With HS256, a shared secret can both generate and verify the authentication code. With RS256, the issuer signs with a private key and the API verifies with the corresponding trusted public key. Do not describe verification as decrypting the token.
- Whether accepted algorithms and keys come from trusted configuration, and how issuer, audience, expiration, and caller identity are validated. Merely decoding claims does not establish trust.
- Whether signing secrets/private keys stay out of client bundles, token contents, logs, and version control. Public verification keys are not signing secrets. Inspect configuration names and code, not private credential values. These cryptographic keys are unrelated to client-generated idempotency keys.
- Where the server checks ownership, tenant scope, or explicit permission for the requested resource. Follow every relevant access path, including lookups that could return data before authorization. Do not trust a user ID supplied in the request body as the authenticated identity.

Propose local checks for an allowed resource, another user's resource, a modified token, an expired token, and incorrect issuer/audience. Preserve the API's documented distinction between authentication failure and access denial, including any deliberate resource-concealment policy.

Return the complete login-to-resource flow, confirmed findings with file:line evidence, and the smallest proposed fixes. Separate missing evidence from confirmed vulnerabilities. Report only tests actually run; label other checks as proposed. Do not edit files, call live services, or print real tokens or keys.
```

References: [JWT best current practices, RFC 8725](https://www.rfc-editor.org/rfc/rfc8725.html), [HS256 and RS256 key usage, RFC 7518](https://www.rfc-editor.org/rfc/rfc7518.html).
