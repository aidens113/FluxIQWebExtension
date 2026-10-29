# t801 lane report: local website stand-in (W0, W1, W2)

## Outcome
Partial. W0 and W1 are done and verified. W2's scripts are written but the real-Core round trip could not be run: Core's server never starts the provisioning listener (blocking Core gap, below). Nothing was edited in Core.

## Workers (all `worker`, Sonnet; no escalation)
- W1 backend: `package.json`, `server/serve.mjs`, `server/start.mjs`, `server/signup/{config,validate,human-check,rate-limit,provisioning-client,handler,index}.mjs`, 5 test files plus `tests/support/stub-core.mjs`, `server/tests/serve.test.mjs`. 40 tests. Details in `t801/w1-backend.md`. Rate-limit defaults: 10 per IP and 500 total per hour; XFF (only with `SITE_TRUST_FORWARDED_FOR=1`) uses the rightmost entry.
- W1 pages: `public/{index.html,site.css}`, `signup/`, `check-email/`, `signin/` with small progressive-enhancement scripts. Details in `t801/w1-pages.md`.
- W2: `scripts/up.mjs` (modes default, `--round-trip`, `--build-only`), `scripts/round-trip.mjs`. Details in `t801/w2.md`. Not run.

## Integration changes I made
- Added `appOrigin` (SITE_APP_ORIGIN) to the `GET /api/signup/config` answer (the sign-in page links to `<appOrigin>/login`); updated the two tests that pin the answer.
- Added `site:up` and `site:round-trip` to the package's `package.json`. A root `pnpm site:up` needs the lead to add one line to the root `package.json` (outside my paths): `"site:up": "pnpm --filter @fluxiq-web-extension/website-stand-in site:up"`.
- Cleared the 6 structure-audit failures in the pages and scripts (best-effort comments, one statement per line, `readMail` now rethrows anything but ENOENT).

## Commands run and observed
- `cd packages/website-stand-in && node --test "server/**/tests/*.test.mjs"` -> tests 40, pass 40, fail 0.
- `node scripts/structure-audit.mjs` -> exit 0 (no violations).
- `node scripts/check/model-text.mjs` -> `model-text: ok (208 scenario tokens, 377 model-facing Core files, 11794 string literals)`.
- Smoke: `server/start.mjs` on port 47931 with the provisioning URL pointing nowhere: `/`, `/signup/`, `/check-email/`, `/signin/`, `/signup/signup.js`, `/api/signup/config` all 200; `/../package.json` 404; a valid sign-up POST (same-origin) -> 503 "Sign-up is unavailable, try again shortly."; log line held only requestId, outcome and ms (no email).
- `node --check` on the three page scripts and both scripts: ok.

## Contract note (W0) in short (full text: `t801/w0-contract-note.md`)
Listener: `POST /provisioning/<op>`, JSON, Bearer token, no Origin, 64 KiB; envelope `{ok,result|error}` with per-code HTTP status. `createAccount` is strict (no password; unknown fields refused); `exists` and `created` are the two results; `sendWelcome` always `accepted`. Gaps against the plan wording: (a) `continueUrl` must be a same-origin PATH to `/connect/authorize` (a bad one fails the whole request as `invalid_input`), so the site sends only path+query after checking the absolute URL against the app origin (implemented); (b) Core has no `FLUXIQ_EMAIL_SENDER=file:<dir>`, the outbox is `<fluxiq root>/platform/outbox`; (c) the mail JSON has `template,to,subject,text,sentAt`, no `welcomeUrl` field; (d) displayName max is 100 in Core, 80 on the site; (e) discovery `signUpUrl` is absolute, https or loopback http, optional.

## Gaps for the lead (Core, not edited)
1. BLOCKING for W2: `startProvisioningListenerFromEnv` has no caller outside tests; `apps/web/src/instrumentation.ts` `register()` only calls `initializeFluxIQWebRuntime()`. So `FLUXIQ_PROVISIONING_LISTEN`/`FLUXIQ_PROVISIONING_TOKEN_FILE` do nothing in a served panel. A call in `register()` (services from `getPlatformServices`) is needed; B1's lane validation said a round trip "on the listener" passed, which was apparently in-process tests only. `up.mjs` fails after 120 s with this explanation.
2. `FLUXIQ_PROFILE` is read by no code yet (harmless).
3. `workspace:"new"` under the web composition's single tenancy maps to the one existing `workspace-main` by source (not proven live): no personal workspace per account, so `workspace.created` would not fire.

## Not verified
Everything runtime in W2: the Core build (keyed `prepareWebBuild` into `test-runs/wb`; it could not get the heavy-check lock, held by other lanes for ~45 minutes), Core start, `/welcome`, the listener, the five round-trip steps, child cleanup, the real mail folder path. No real Turnstile. `pnpm install` not run, so `pnpm-lock.yaml` has no importer entry for the new package (no dependencies, so only the importer line is missing). The no-JS sign-up page cannot show the `?error=` banner (rendered by JS); `/terms/` and `/privacy/` links point to pages that do not exist yet.

## Open for the lead
- Stale process: W2's lock-waiter shell (pid 260134 with a `sleep` child) still polls the heavy-check lock and, if it wins, runs `up.mjs --build-only` into `test-runs/wb` then releases. My kill was denied by the permission classifier; kill it if unwanted.
- Decide: a Core one-line listener start (then `node packages/website-stand-in/scripts/up.mjs --build-only` under the lock, then `... up.mjs --round-trip`), or accept W2 as scripts-only until then.
