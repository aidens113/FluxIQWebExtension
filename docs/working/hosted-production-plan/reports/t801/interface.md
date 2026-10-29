# t801 stand-in interface (fixed by the supervisor; all three workers build to it)

Package: `packages/website-stand-in/` (`@fluxiq-web-extension/website-stand-in`, private, ES modules, NO dependencies: Node 22 built-ins and global fetch only).

## Files and owners
- Backend worker: `package.json`, `server/serve.mjs`, `server/start.mjs`, `server/signup/{config,validate,human-check,rate-limit,provisioning-client,handler,index}.mjs`, `server/signup/tests/*`, any `server/**` barrel the structure audit requires.
- Pages worker: `public/**` only.
- W2 worker: `scripts/**` only (plus `scripts/tests/`).

## Configuration (environment; secrets as files). `server/signup/config.mjs` exports `readSignupConfig(env)`
FLUXIQ_PROVISIONING_URL (e.g. http://127.0.0.1:4801), FLUXIQ_PROVISIONING_TOKEN_FILE, SITE_APP_ORIGIN (Core's public origin), SITE_ORIGIN (this site's own origin, used for the same-origin rule; start.mjs derives it from host/port when unset), SITE_TERMS_VERSION, SITE_HUMAN_CHECK (`off`|`turnstile`; default `turnstile`; start.mjs does not override), TURNSTILE_SECRET_FILE, TURNSTILE_SITE_KEY, SITE_TURNSTILE_VERIFY_URL (default Cloudflare siteverify; settable so tests stub it), SITE_INVITE_CODES_FILE (unset = no invite required), SITE_SIGNUP (`on`|`off`), SITE_TRUST_FORWARDED_FOR (`1` = take the client IP from X-Forwarded-For), SITE_PORT, SITE_HOST (default 127.0.0.1; the site is reached as http://localhost:<port>).

## HTTP surface of `server/serve.mjs`
`export function createSiteServer({config, publicDir, log, fetchImpl, now}) -> http.Server` (not listening); `server/start.mjs` reads env, listens, prints `site: http://localhost:<port>`. Static files from `public/` (directory URL -> its `index.html`; no path traversal; sensible content types; `Cache-Control: no-store`).
- `GET /api/signup/config` -> `{humanCheck:"off"|"turnstile", siteKey:string|null, termsVersion, inviteRequired:boolean, signupOn:boolean}`.
- `POST /api/signup`: accepts JSON or `application/x-www-form-urlencoded`. Fields: `email`, `displayName`, `termsAccepted` (true / "on" / "true"), `termsVersion`, `inviteCode`, `continue`, `humanToken` (form: the widget's `cf-turnstile-response` is also accepted).
  - JSON clients (Content-Type JSON or Accept JSON): 202 `{ok:true}`; 400 `{ok:false,errors:{<field>:<message>}}`; 403 `{ok:false}` (not same-origin); 429 `{ok:false}` + `Retry-After`; 503 `{ok:false,message:"Sign-up is unavailable, try again shortly."}`.
  - Form posts (urlencoded, no JSON Accept): success 303 -> `/check-email/`; failure 303 -> `/signup/?error=<invalid|rate|unavailable|origin>&fields=<csv of field names>`.
- `POST /api/signup/resend` `{email}` (same rules): calls Core `sendWelcome`; answers the same 202 whatever the account state.
- Refusal rule: any non-ok answer, timeout or connection failure from Core is a 503 to the visitor; the log line holds only requestId, outcome code, ms. `exists` and `created` both give the identical 202 `{ok:true}` (same body, same headers apart from Date).

## Core contract (see reports/t801/w0-contract-note.md for the full note)
createAccount body: `{requestId, email, displayName, policies:["FluxIQUserAccess"], workspace:"new", termsVersion, continueUrl?, sendWelcome:true}`; requestId = fresh random id per call. `continueUrl` sent to Core is ONLY path+query of an absolute `<SITE_APP_ORIGIN>/connect/authorize?...` (or a `/connect/authorize...` path), else omitted. Bearer token = first line of the token file, re-read per call. No `Origin` header on the listener call.
`provisioning-client.mjs` exports `createProvisioningClient({url, tokenFile, fetchImpl, timeoutMs}) -> {createAccount(input), sendWelcome(input), getAccount(input)}` each returning the parsed `{ok,result|error}` envelope or `{ok:false,error:{code:"unreachable"}}` on transport failure; it never throws and never logs.

## Validation table (validate.mjs `validateSignup(body, config) -> {ok:true,value}|{ok:false,errors}`)
email trimmed+lowercased, valid, <= 254; displayName trimmed, 1..80; termsAccepted true and termsVersion === config.termsVersion; inviteCode required and must be in the invite list when SITE_INVITE_CODES_FILE is set; continue kept only when it resolves under SITE_APP_ORIGIN /connect/authorize (else silently dropped); unknown fields ignored; non-string values rejected.

## Logging rule
Handlers log via an injected `log(line)`: only `requestId`, outcome word, status and ms. Never the body, email, name, invite code, token, mail contents.
