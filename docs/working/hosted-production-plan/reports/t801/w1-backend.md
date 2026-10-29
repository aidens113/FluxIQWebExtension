# t801 W1 backend report

## Outcome
Done. Backend built to interface.md; 40 node:test tests pass; structure audit has no findings in my files (6 remain, all in other workers' `public/**` and `scripts/**`).

## What changed and why
All under `packages/website-stand-in/`:
- `package.json` (as specified, no dependencies).
- `server/signup/{config,validate,human-check,rate-limit,provisioning-client,handler,index}.mjs`, `server/serve.mjs`, `server/start.mjs`.
- Tests: `server/signup/tests/{validate,rate-limit,human-check,provisioning-client,handler}.test.mjs`, `server/tests/serve.test.mjs`; test support `server/signup/tests/support/stub-core.mjs` (stub Core listener + siteverify on port 0, records requests, scriptable answers incl. error codes, delay, destroyed socket).

Design notes:
- `handler.mjs` is transport-free: `createSignupHandler({config, log, fetchImpl, now, randomId, client, limiter})` returns `{signup(req), resend(req), config()}`; req is `{headers, remoteAddress, rawBody}`, result `{status, headers, body}`. `serve.mjs` only reads bodies (cap 32 KiB, else 413) and writes responses. Order: signup-on, same-origin, rate limit, parse, validate, human check, Core. Refused (origin) requests do not consume rate budget.
- Log line format: `signup requestId=<id> outcome=<word> status=<n> ms=<n>` (outcomes: created, exists, accepted, invalid, origin, rate, bad_body, human_failed/missing/unreachable, core_<code>, signup_off, internal_error). Created vs exists differ only in the log.
- The Core `requestId` is the same random UUID as the log requestId (one per HTTP request).

## Deviations / decisions
- Rate-limit defaults: 10 per IP per hour, 500 total per hour (env `SITE_RATE_PER_IP`, `SITE_RATE_TOTAL`, `SITE_RATE_WINDOW_MS`). Every attempt that passes the origin check counts (including invalid ones), so invalid-form spam is limited too. Resend shares the same limiter.
- X-Forwarded-For (only with `SITE_TRUST_FORWARDED_FOR=1`): I take the RIGHTMOST entry (what our own proxy appended), not the leftmost, because leftmost is client-claimed and spoofable. Interface said only "take the client IP from X-Forwarded-For".
- Extra optional env: `SITE_PROVISIONING_TIMEOUT_MS` (default 8000), `SITE_TURNSTILE_TIMEOUT_MS` (5000). Default `SITE_PORT` 4810.
- Same-origin rule: any `Sec-Fetch-Site` other than `same-origin` is refused; `Origin` present must equal `config.siteOrigin` exactly; no Origin requires `Sec-Fetch-Site: same-origin`. `start.mjs` sets `siteOrigin` to `http://localhost:<actual port>` after listen when `SITE_ORIGIN` is unset.
- `SITE_INVITE_CODES_FILE` is read once at config load; an unreadable file throws at startup (the structure audit forbids turning a read failure into an empty list). One code per line, `#` comments allowed. Not re-read per request.
- Resend applies the same human check, origin and rate rules; accepts `email`, optional `continue`, `humanToken` (or `cf-turnstile-response` in forms). Form resend success redirects to `/check-email/`, failure to `/signup/?error=...`.
- Non-string values reject for every field including `continue` (null/undefined count as absent); an invalid-but-string `continue` is silently dropped.
- Human-check failed or missing token: 400 `errors.humanToken` (form: `error=invalid&fields=humanToken`); siteverify unreachable, non-200 or secret file unreadable: 503 (fail closed).
- Static serving: dotfile segments, backslashes, NUL and traversal give 404; `/dir` redirects 301 to `/dir/`; HEAD supported; other methods 405; unknown `/api/*` 404.
- Did not run `pnpm install` (not needed for tests; the package has no dependencies). The new workspace package is not yet registered in `pnpm-lock.yaml`; lead may run `pnpm install` if the lockfile must list it.

## Commands run and observed results
- `cd packages/website-stand-in && node --test "server/**/tests/*.test.mjs"` -> `# tests 40 / # pass 40 / # fail 0` (about 1.3 s).
- `node scripts/structure-audit.mjs` (repo root, the tree) -> `6 violation(s) across 3 rule(s)`, none in `server/**` or `package.json`; all six are in `public/check-email/check-email.js`, `public/signup/signup.js`, `scripts/round-trip.mjs`, `scripts/up.mjs` (swallowed-failure / failure-as-empty / statement-packing), owned by the pages and W2 workers. My first pass had 5 findings in my files (failure-as-empty on try/catch returning null/empty, statement-packing); fixed with `URL.canParse`, naming `SyntaxError`, throwing on an unreadable invite file, and one statement per line.

## Not verified
- Not run against a real Core listener or real Cloudflare Turnstile; only the stubs. Whether Core accepts `workspace:"new"` in single tenancy is W2's round trip.
- `start.mjs` was not launched by me (no live listen test); `createSiteServer` is covered over real HTTP in `serve.test.mjs`.
- Behaviour with the pages worker's actual forms (field names, `cf-turnstile-response`) is untested together.

## Open questions
- Should the audit-flagged files in `public/` and `scripts/` be fixed by their owners before the merge gate? (Not mine.)
