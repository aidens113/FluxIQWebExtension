# W0 contract note: Core's provisioning listener as the stand-in sees it

Source: Core `packages/contracts/src/platform/{provisioning,discovery,connect}/`, `apps/web/src/server/provisioning-listener/`, `docs/architecture/platform.md`.

## Transport
- `POST <FLUXIQ_PROVISIONING_URL>/provisioning/<operation>` (operations the site uses: `createAccount`, `sendWelcome`, `getAccount`).
- Headers: `Content-Type: application/json` (required), `Authorization: Bearer <token>`. NO `Origin` header (a request carrying one is refused 403 `forbidden`: no browser callers). Body at most 64 KiB.
- Peer must be in the allowlist (default loopback and private ranges) and under the listener's per-source rate limit (429 `rate_limited`).
- Token file: one or two lines, each at least 32 UTF-8 bytes; the site reads the first line (`FLUXIQ_PROVISIONING_TOKEN_FILE`). Core re-reads the file when mtime/size change.
- Listener env on Core: `FLUXIQ_PROVISIONING_TOKEN_FILE`, `FLUXIQ_PROVISIONING_LISTEN=host:port` (must not equal `PORT` or `FLUXIQ_CLIENT_GATEWAY_PORT`), optional `FLUXIQ_PROVISIONING_ALLOWED_CIDRS`.

## Answer envelope
`{ ok: true, result }` with HTTP 200, or `{ ok: false, error: { code, message, issues? } }` with the status below.
Codes: email_taken 409 (in-process only), weak_password 422, not_found 404, disabled 409, forbidden_policy 403, invalid_input 400, unauthorized 401, forbidden 403, operation_unavailable 404, request_conflict 409, entitlement_required 403, rate_limited 429, last_administrator 409, two_factor 409, internal_error 500.

## createAccount (HTTP input, `.strict()`: unknown fields and any `password` are refused with invalid_input)
```
requestId    string, /^[A-Za-z0-9._:-]{1,128}$/        idempotency key; same id + same input = first result; same id + different input = request_conflict
email        trimmed, lower-cased, <= 254, valid email
displayName  trimmed, 1..100                             (the website limits to 80, stricter, fine)
policies     1..10 predefined names; the site sends ["FluxIQUserAccess"]
workspace    "new" | existing workspace id
termsVersion optional string 1..64
continueUrl  optional; see below
sendWelcome  optional boolean (the site sends true)
externalId   optional, 1..128 (unused by the site)
```
Result: `{status:"created", userId, workspaceId}` or `{status:"exists"}` (no ids; Core mails the address "account already exists", so the site answers the same either way).

## sendWelcome (resend)
Input is one of `{requestId, userId, continueUrl?}` or `{requestId, email, continueUrl?}` (strict). Result is always `{status:"accepted"}` (unknown, disabled, deleted accounts get nothing; an unverified account gets a fresh link superseding the old; a verified one gets the account-exists mail).

## getAccount
`{email}` (or userId / externalId), no requestId. Result `{userId, email, status: "active"|"disabled"|"deleted", workspaceIds, createdAt, lastSignInAt|null}`; unknown is `not_found` 404.

## continueUrl rule (a gap against the plan's wording)
Core accepts ONLY a same-origin PATH to `/connect/authorize`, with or without a query, no `#`, at most 2048 chars, starting with exactly one `/`, no backslash/whitespace/control characters. Anything else fails the schema, so the WHOLE request is `invalid_input` (it is not silently dropped).
The plan says the website keeps `continue` "only if it starts with `<app origin>/connect/authorize?`" (an absolute URL). Resolution for the stand-in and W4: validate the absolute URL against `SITE_APP_ORIGIN` on the site, then send Core only `pathname + search` (e.g. `/connect/authorize?...`); drop the parameter (send none) when it is absent or fails either test. Also accept the path form on input.

## Welcome and mail
- Welcome mail template `welcome` with `welcomeUrl = <FLUXIQ_PUBLIC_ORIGIN>/welcome#token=<43 chars base64url>`; link single use, 24 h. `account-exists` template carries `signInUrl`, `resetUrl` (no token).
- Mail sender: `FileEmailSender` writes `<message>.json` (mode 0600; template, recipient, rendered text) into `<fluxiq paths.fluxiq>/platform/outbox`. GAP against the plan: Core has no `FLUXIQ_EMAIL_SENDER=file:<dir>`; it only honours `none` and otherwise uses that fixed outbox. The mail folder is therefore under the instance's data root (FLUXIQ_ROOT); `up.mjs` sets FLUXIQ_ROOT to the run directory and prints the resolved outbox path.
- The person sets the password on Core's `/welcome` page: it reads `#token=`, posts JSON to `/welcome/submit` (cross-site refused 403; JSON <= 8 KiB), which redeems the link, creates a session and returns a `continueUrl` or `/`. `setPassword` is in-process only (not on the listener).

## Discovery
`FluxIQDiscoveryDocument.connect.signUpUrl` is optional, absolute, `https:` or `http:` on loopback, from the product manifest `auth.signUpUrl` (not served by the stand-in; the product host module is D5).

## Tenancy note
The web composition (`platform-services.ts`) builds `tenancy: { mode: "single", workspaceId }`. Whether `workspace: "new"` is accepted in single tenancy is not stated in the contracts; W2's round trip decides it. If Core refuses it, that is a gap to report, not to edit around.
