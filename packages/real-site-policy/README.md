# FluxIQ real-site probe policy

This private package is a fail-closed authorization gate for a possible future
real-site probe. Validation never contacts the configured origin, resolves a
secret reference, starts a browser, or grants standing permission. A successful
decision is only one prerequisite for an explicitly authorized runner.

## Command

From the repository root, build once and validate one JSON policy directly:

```bash
pnpm --dir packages/real-site-policy build
node packages/real-site-policy/dist/cli.js ./probe-policy.json
```

Direct invocation preserves exit code `2`. Package-manager script wrappers can
translate any nonzero child status to their generic lifecycle-failure code.

The CLI writes a JSON `PolicyDecision` to stdout. Exit codes are:

- `0`: every policy gate is satisfied and `allowed` is `true`.
- `2`: policy JSON was parsed but authorization was refused; `allowed` is
  `false`, `recommendation` is `defer`, and `issues` explains every failure.
- `1`: usage, file reading, or JSON parsing failed.

Input must be ordinary UTF-8 JSON without a byte-order mark. No command in this
package executes the policy.

## Synthetic example input

The following uses the reserved `.test` domain and fake external references.
Replace timestamps with a non-future approval and an unexpired expiry no more
than 30 days later. Never place a username, password, token, or cookie value in
this document.

```json
{
  "schemaVersion": "0.1",
  "policyId": "synthetic-read-only-review",
  "mode": "synthetic-account",
  "network": {
    "allowlist": [{ "origin": "https://probe.fixture.test", "pathPrefixes": ["/public/"] }],
    "methods": ["GET", "HEAD"],
    "blockUnlisted": true
  },
  "account": {
    "synthetic": true,
    "secretRefs": ["vault://fixtures/account-id", "vault://fixtures/password"]
  },
  "actions": {
    "readOnly": true,
    "allowed": ["navigate", "read", "scroll", "screenshot", "checkpoint"],
    "denied": ["write", "submit", "upload", "download", "purchase", "send-message", "change-auth", "create", "update", "delete", "follow", "like", "vote", "comment"]
  },
  "rateLimits": {
    "requestsPerMinute": 30,
    "actionsPerMinute": 10,
    "concurrentRequests": 1,
    "maxRunMinutes": 5
  },
  "artifacts": {
    "private": true,
    "redactBeforeWrite": true,
    "retentionDays": 7
  },
  "operationalReview": {
    "robotsReviewed": true,
    "termsReviewed": true,
    "authorizationReference": "fake-review-record-123",
    "reviewer": "fake-reviewer-id",
    "approvedAt": "2026-09-01T00:00:00.000Z",
    "expiresAt": "2026-09-15T00:00:00.000Z"
  }
}
```

Successful output is:

```json
{ "allowed": true, "recommendation": "authorized", "issues": [] }
```

A refusal remains machine-readable:

```json
{
  "allowed": false,
  "recommendation": "defer",
  "issues": [{ "path": "$.actions.allowed", "code": "unsafe-action", "message": "contains an action outside the read-only safe set" }]
}
```

## Authorization rule

Every gate must pass:

- `schemaVersion` is `0.1`, `policyId` is nonempty kebab-case, and every object
  rejects unknown properties.
- Each target is an exact HTTPS origin with no credentials, path, query,
  fragment, or wildcard. Each path prefix is nonempty, absolute, and contains
  no wildcard, traversal, query, or fragment. At least one target is required.
- `blockUnlisted` is `true`; the nonempty method list contains only `GET`,
  `HEAD`, or `OPTIONS`.
- Anonymous mode has `synthetic: false` and no secret references. Synthetic
  account mode has `synthetic: true` and at least one external `vault://`,
  `secret://`, or `env://` reference—never a credential value.
- `readOnly` is `true`; allowed actions are drawn only from `navigate`, `read`,
  `scroll`, `screenshot`, and `checkpoint`; all destructive, write, upload,
  download, purchase, messaging, auth-changing, and social actions shown in the
  example denylist are explicitly denied.
- Integer limits are 1–60 requests/minute, 1–20 actions/minute, 1–2 concurrent
  requests, and 1–15 run minutes.
- Artifacts are private, redacted before write, and retained for 1–7 days.
- Robots and terms reviews are acknowledged; reviewer and authorization record
  are nonempty; approval is not future-dated; expiry is still current; and the
  approval window is at most 30 days.

The repository contains no approved target policy. Real-site execution remains
deferred until a human supplies and reviews one for a specific authorized target.
