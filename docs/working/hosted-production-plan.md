# Hosted Production Plan

Status: Active
Status detail: Revised 2026-10-28 around the user's 2026-10-18 directions, then the H0 spike results folded in the same day (D0 passed); plan only, no code changed; the contract freeze and H1 are next.
Created: 2026-10-17
Last updated: 2026-10-28
Owner: Lane lead hosted-production-planner (plan); the senior supervisor agent owns execution
Scope: Extension, domain and product side of three deployments (getfluxiq.com, local, self-hosted): server profiles and sign-in in the extension, transport and data minimisation, consent-bound execution, manifests and the Chrome Web Store, domain changes, the FluxIQWebsite additions and their local stand-in, the product host module, hosted infrastructure, user docs, privacy, cookies and legal prerequisites, Lab and e2e coverage. Core contracts live in the paired document.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/hosted-production-plan.md
Related: [extension client](../architecture/extension-client.md), [release packaging](../architecture/release-packaging.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md), [privacy policy](../user/privacy-policy.md), [MVP final month](./mvp-final-month-plan.md), [working index](./README.md)

---

## Current State

**What is true now.** This is a plan; no hosted code exists in either repository (checked
2026-10-28). The baseline comes from a read-only audit on 2026-10-17, re-checked 2026-10-28, and
a read of FluxIQWebsite at its `dev` tip `08e51d49` (2026-10-10), downloaded read-only to
`C:/Users/osrs_/FluxStuff/FluxIQWebsite` (an archive, not a git checkout).

**The user's directions of 2026-10-18 are folded in** (each is the user's own instruction):
1. **FluxIQWebsite is the public site.** It is a Next.js 16 static export, live on Hostinger at
   getfluxiq.com, with four pages and no server, accounts or forms. It gains a sign-up page, a
   sign-in link and a small sign-up backend; Core keeps sign-in, connect and the panel on
   `app.getfluxiq.com`. The "new `apps/site` package" is dropped: nothing in the website's code
   argues against it being the public site. What remains of `apps/site` is a small product host
   module, `apps/product` (manifest, default project, email copy). See The Public Website.
2. **A local stand-in comes first.** `packages/website-stand-in/` in this repository plays
   FluxIQWebsite: sign-up page, backend provisioning call, Core under the `service` profile, and
   the extension signing in. Its backend is written to port verbatim into FluxIQWebsite later
   (phase W4, on the user's go). See Local Website Stand-In.
3. **Permissions follow AWS IAM,** owned by Core's plan ("Permissions (IAM Model)"). Here it
   means: accounts are created with the predefined policy `FluxIQUserAccess`; the extension's
   credential acts under the session policy `FluxIQBrowserSession`; the Lab proves isolation and
   escalation refusals; tenancy for a company's workers is an enterprise feature.
4. **The schedule is re-cut into parallel lanes,** with the constraint behind each date named.
   Store submission moves from about 12-01 to about 11-13.

Core's plan owns the architecture and every domain-neutral contract (profiles and tenancy, the
provisioning API and its private listener, IAM, discovery and connect, the browser credential and
gateway 0.2 with `runContext`, the panel extension points, the billing and entitlement ports).
This document links to them and does not restate them.

**User decisions** (2026-10-17, 10-18, 10-27):
- **Self-hosting stays first-class (binding).** The extension connects to getfluxiq.com, a local
  panel or a self-hosted panel, and keeps its sign-in per server.
- **Hosted ships with the Chrome Web Store release.**
- **getfluxiq.com runs on Core as its control panel;** the website's backend provisions users.
- **Each user brings their own provider key;** no platform key; billing stays a port.
- **No company exists yet;** note only what needs one. **Optional cookies are declined by
  default** (separate work). **No feature freeze** (user, 2026-10-27).

**Recommended downstream design.**
- **Hostnames:** `getfluxiq.com` is FluxIQWebsite; `app.getfluxiq.com` is Core (panel, API,
  `/connect`, discovery, `/client`). Both run on one VM under Compose behind Caddy.
- **Extension:** a list of servers; the store build presets "FluxIQ"
  (`https://app.getfluxiq.com`) and "This computer". Sign-in by Flow A in a normal tab; "Create
  an account" goes to `https://getfluxiq.com/signup/` and returns to consent through Core's
  welcome link. No new manifest permission.
- **Transport:** jittered backoff, `going_away` and `revoked`, a 20-second remote open timeout,
  only FluxIQ-relevant tabs sent to remote servers.
- **Consent-bound execution:** the extension executes only for its own signed-in user.
- **Domain:** session selection by the run's actor; per-workspace host safety.
- **Website:** `/signup/`, `/check-email/`, `/signin/` (forwards to Core), and `POST
  /api/signup`, which calls Core's private provisioning listener. The website never sees a
  password. Rewritten privacy notice and terms.
- **Infrastructure:** `deploy/` here: Caddy, the website image, the product image, restic.
- **Lab:** `service-local` runs Core under `service` plus the stand-in; accounts come through the
  stand-in's real sign-up path; a two-tenant isolation scenario and an escalation check.

**H0 results that change this document** (Core's `hosted-production-plan/reports/h0.md` and
`h0-s1.md` to `h0-s6.md` hold the evidence; Core's plan owns the contract changes).
- **D0 (Core S1) passes.** Flow A completed with the extension observing `/connect/done` in Chrome
  156, Edge 156 and Playwright's Firefox 1475, with only the `tabs` permission and `<all_urls>`
  the manifests already have. The worker woke after a forced stop (Chrome and Edge showed 0
  service-worker targets, then a new boot id; Firefox's event page reloaded with a new boot id),
  the pending record survived in `storage.session`, the welcome-tab case was accepted, and a wrong
  state, a wrong origin (`localhost` for `127.0.0.1`) and an expired record were rejected. Listener
  rules: act on `changeInfo.url` only, claim the pending record once, treat `tabs.remove` on a
  closed tab as closed (Server Profiles And Sign-In).
- **Branded Chrome and Edge 156 ignore `--load-extension`.** They load through
  `--enable-unsafe-extension-debugging` and CDP `Extensions.loadUnpacked`; Firefox through its remote
  debugging protocol (Lab And E2E Coverage, D8).
- **Lab loopback:** every check accepts `localhost` and `127.0.0.1` except
  `demo-workspace/scenario-lab.ts:92`, which requires `127.0.0.1`.
- **From Core:** the credential's `approvingSessionId` and `runContext.startedFromSessionId` are
  digests (audit only); a locked key surfaces as `secrets.locked`; Firefox Origins match by prefix
  (`moz-extension://*`); a connection with no Origin is refused on `service` (Core N7); Caddy has
  not run, so D1 and the staging smoke are its first real run.
- **Estimates:** downstream about 39 agent-days (was 38; D8 +1 for the browser loader).

**Schedule** (today 10-28; MVP deadline 11-10; details in Phases).
- 10-28: D0 passed (Core S1). 10-29 to 10-30: the contract freeze, with the H0 changes.
- 10-30 to 11-08: D2 to D8, W1 and W2 in parallel. D2, D3 and D4 merge on 11-10, when the MVP live
  lanes release the extension's connection files; everything else merges when green.
- 11-11 to 11-12: the hosted gate on staging. About 11-13: Chrome Web Store submission.
- Public on store approval ("within a few days, but it can take up to a few weeks", Google).

**Next.**
1. The supervisor dispatches the contract-freeze worker (Core carries the H0 changes) and opens the
   paired H1 task (one ID, nested worktrees); D2 starts with the D0 listener rules.
2. The user answers U9 (VM, DNS, store developer account) this week, and U10 and U11 before 11-10.

**Blocked.** Nothing blocks W1 or H1. W4 (editing FluxIQWebsite) waits for the user's go (U11).

**Not verified** (D0 settled the old first three items).
- Not exercised by D0: a natural Chrome idle stop over 30 s (forced with CDP `Target.closeTarget`);
  stock Firefox and Web Store builds (the spike used unpacked and temporary add-ons in temporary
  profiles); cookie and consent UI; the token exchange.
- When the Chrome Web Store assigns the item ID: the docs do not say (believed: at first draft
  upload; the dashboard's public key can pin it as the manifest `key`).
- Caddy (Core S2; not installed) and Next.js `app/.well-known/` routing (Core; the rewrite stays).
- Firefox `data_collection_permissions` category names; reviewer expectations for server-driven
  automation; whether the EU trader declaration applies before the service charges money.
- Whether Turnstile sets a cookie on the sign-up page.
- Where getfluxiq.com's mail (MX) is hosted today; moving the apex A records must not touch it.

## Ownership Split

| Area | Owner |
| --- | --- |
| Profiles, tenancy, provisioning API and listener, IAM, identity, welcome link, discovery, connect protocol, browser credential, gateway 0.2, Origin and limits, panel extension points, billing and entitlement ports, generic image, self-hosting guide | Core plan (`Paired document`) |
| Extension server profiles, sign-in client, reconnect, data minimisation, consent-bound execution, manifests, store listing and review | This document |
| Domain session selection, per-workspace host safety | This document |
| Product host module (`apps/product`): manifest, assets, default project, email copy | This document; it uses Core's platform hooks |
| Website additions (sign-up, sign-in link, sign-up backend, legal pages) and the local stand-in | This document plans them; FluxIQWebsite owns the real code once W4 is approved |
| getfluxiq.com infrastructure, deploy pipeline, runbook | This document (`deploy/`) |
| User docs, privacy notice, cookie notice, terms, legal prerequisites | This document drafts them; the published copies live in FluxIQWebsite |
| Lab, ui:e2e, extension Playwright, staging smoke, load test | This document; Core Playwright stays in the Core plan |

A change that crosses the boundary gets a full ledger entry in the owning document and a
one-line entry in the other.

## Extension Baseline

Paths are relative to this repository. Everything was read on 2026-10-17.

- **Addresses.** Hard-coded in `apps/extension/src/shared/constants.ts`: `DEFAULT_GATEWAY_URL =
  "ws://127.0.0.1:4777/client"`, `DEFAULT_CORE_API_URL = "http://127.0.0.1:3000"`. Settings has
  two independent fields (`panel/settings/form-fields.ts`, `save-plan.ts`) accepting `ws`/`wss`
  and `http`/`https`, with no loopback restriction. No discovery.
- **Pairing.** `client.hello`, then `server.pairing_required`; the code is shown in
  `panel/getting-started/start-view.ts`, an operator approves it, `server.session_ready` delivers
  the token, stored in plain text in `chrome.storage.local` under `fluxiq.session`. "Forget this
  pairing" calls `clearSession()`.
- **Socket.** The Core client (`packages/client-gateway-websocket/src/transport.ts`) opens with a
  10-second timeout. `GatewaySession` (`background/connection/gateway-session.ts`) wraps it.
  Backoff `min(30 s, 1 s × 2^n)` without jitter (`background/connection.ts`), a 30-second alarm
  watchdog (`background/reconnect-watchdog.ts`). Every 20 seconds the heartbeat sends a full
  `client.state_update` with every tab's URL and title (`ActivePage.sendBrowserState()`). The
  token travels only in the hello.
- **HTTP.** `background/connection/core-api.ts` sends `Authorization: Bearer <token>` with
  `credentials: "omit"`. Screenshots go by PUT (`connection/state-assets.ts`).
- **Storage.** `chrome.storage.local`: `fluxiq.settings`, `fluxiq.session`, `fluxiq.clientId`,
  `fluxiq.queuedEvents` (up to 1,000 events, which can carry page data), `fluxiq.problemLog`,
  `fluxiq.ui.connectionDraft`. `chrome.storage.session`: Disconnect, in-flight records, the lease.
- **Manifests.** `manifest.chrome.json`, `manifest.firefox.json`, `manifest.e2e.json`, copied by
  `scripts/build-extension.mjs`. Permissions: alarms, activeTab, downloads, scripting, storage,
  tabs, webNavigation, plus sidePanel on Chrome; `<all_urls>` hosts. No `identity`,
  `externally_connectable` or `key`. The Firefox `gecko.id` is a placeholder. The description
  says "Connects only to the FluxIQ runtime you run and pair". `scripts/release/permission-review.mjs`
  gates every permission.
- **Domain.** `selectWebAutomationSession` (`domain/src/runtime/adapter.ts:165`) and
  `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts:129-139`) take the requested
  session or the only extension session, and refuse when there are several. No user scoping.
- **Docs that assume local only.** `docs/user/privacy-policy.md` ("operate no server"),
  `store-listing.md` ("Requires the FluxIQ runtime"), `install.md` and `quickstart.md`
  (`127.0.0.1:3000`), `docs/architecture/extension-client.md` (stale wire shape),
  `sensitive-values.md` (two contradictions with the code).
- **Lab.** Loopback ports (`packages/test-runner/src/allocation.ts`), gateway host hard-coded in
  `environment.ts`; `bootstrapIdentity` writes credentials into `.fluxiq`; pairing through
  `fluxiq.connect` and `approve-pairing`; `auth-session.ts` requires `fluxiq_session=`; demo and
  ui:e2e refuse non-loopback hosts.

## Website Baseline (FluxIQWebsite)

Read 2026-10-28 from the `dev` tip `08e51d49`; `main` is at the same commit, and the generated
`deploy` branch holds its build (`528baa64`, 2026-10-10).

- **Stack.** Next.js 16.3.8, React 19.2, App Router, React Compiler, Tailwind CSS 4, Biome 2,
  pnpm 10, Node 22. `next.config.mjs` sets `output: "export"`: the build is static files in
  `out/`; route handlers and server features are unavailable by design.
- **Pages.** `/`, `/extension/`, `/privacy/`, `/terms/`. Copy lives in `src/content/` (one typed
  file per section, each naming the FluxIQ source it was checked against); sections in
  `src/components/<section>/`; links only from `src/content/links.ts`, enforced by
  `scripts/site-check.mjs`.
- **Hosting.** `.github/workflows/deploy.yml` builds `main` and commits `out/` to the `deploy`
  branch, which Hostinger's website Git feature serves. getfluxiq.com resolves to Hostinger
  addresses (145.223.124.228, 88.223.87.187) and returns the repository's headers.
- **Server option already present.** A dependency-free Node server
  (`scripts/static-hosting/serve.mjs`, entry `start.mjs`) serves `out/` with the same header
  policy, and a two-stage `Dockerfile` (non-root, health check, clean SIGTERM) runs it.
- **One header policy.** `scripts/static-hosting/policy.mjs` generates `.htaccess`, `_headers`,
  `vercel.json` and the Node server's headers. CSP: `form-action 'self'`, `connect-src 'self'`
  plus Google Analytics hosts, `frame-ancestors 'none'`.
- **Analytics.** Google Analytics 4 loads on every visit and sets `_ga` cookies (the owner's
  decision of 2026-10-09, in `src/components/analytics/`). This conflicts with the 2026-10-18
  decline-by-default decision, which the separate cookie work owns (U10).
- **Legal pages** say "The site has no accounts, forms, or sign-ups"; both must be rewritten
  before sign-up opens. The contact is `license@getfluxiq.com`.
- **Checks.** `pnpm check` (structure audit, working-docs audit, Biome, TypeScript), `pnpm test`
  (`node --test "scripts/**/tests/*.test.mjs"`), `pnpm build`, `pnpm test:site` (headings,
  links allowlist, metadata, retired phrases, a 200 KB script budget).

## Server Profiles And Sign-In

**Stored model** (`chrome.storage.local`).
- `fluxiq.servers`: entries of `profileId`, `label`, `kind` (builtin or custom); `origin`,
  `gatewayUrl`, `gatewayOverride?`; `instance {name, profile}`; `clientId` (`extension-<uuid>`,
  one per server, so servers cannot correlate a browser); `credential?`,
  `credentialExpiresAt?`, `connectedBrowserId?`; `user? {displayName}`, `workspace? {name}`;
  `legacy?`, `lastConnectedAt`.
- `fluxiq.activeServer` names the active entry. Pages and other extensions cannot read it.

**Built-in presets,** injected by `scripts/build-extension.mjs` from
`apps/extension/config/servers.<channel>.json` (new):
- `store`: "FluxIQ" (`https://app.getfluxiq.com`) and "This computer";
- `staging`: "FluxIQ staging" (`https://app.staging.getfluxiq.com`) and "This computer";
- `dev` and `e2e`: "This computer".

**Adding a server.**
1. Normalise the URL to an origin; require `https` unless the host is loopback.
2. Fetch `/.well-known/fluxiq` and validate it with Core's schema from `@fluxiq/contracts`.
3. Show the instance name and origin, with "This server can run automations in this browser
   while you use it. Add only servers you trust."
4. If `minimumClient` is above this version, show "Update the extension".
The old two-address form moves to "Advanced: connection override".

**Flow A** (Core's protocol), in `apps/extension/src/background/sign-in/` (new).
- `pkce.ts`: verifier and challenge.
- `tab-flow.ts`: `chrome.tabs.create` opens the authorize URL; the pending `{state, verifier,
  tabId, profileId, startedAt}` sits in `chrome.storage.session` for 30 minutes (long enough to
  sign up and follow the welcome email); a top-level `tabs.onUpdated` listener accepts only that
  tab, on that exact origin, at `/connect/done`, with a matching `state`, then closes the tab. The
  listener acts on `changeInfo.url` only (the `status: "complete"` event fires again and made the
  spike record twice), claims the pending record once and clears it before the token exchange, and
  treats `tabs.remove` on an already closed tab as closed. `storage.session` is the right home for
  pending: it survived a worker stop on all three browsers.
- `token-exchange.ts`; `revoke.ts` (sign-out calls the revoke URL).
- New users: the sign-in page's "Create an account" opens `signUpUrl` (the website) with
  `continue=<authorize URL>`. The welcome email's link opens in a new tab and lands on that
  authorize URL; consent there completes Flow A. `tab-flow.ts` therefore also accepts a
  `/connect/done` with the pending `state` in a tab it did not open, provided the origin and
  `state` match and the pending record is unexpired (D0 confirmed the listener sees it on all
  three browsers).
- The Firefox popup closing is harmless, because the background owns the flow.

**Flow B.** "Use a code instead" connects without a credential, shows the code, and opens
`<origin>/connect`.

**Gateway use.** `connection/gateway-session.ts` sends the active credential;
`server-command-channel.ts` handles `session_ready` (credential, user, workspace), `revoked`
(clear the credential, show "signed out" and the reason) and `going_away`;
`connection/core-api.ts` takes its base URL from the profile. A build or run that Core stops with
`secrets.locked` shows that message with an "Open FluxIQ" button (the panel re-unlocks the key
without a sign-out); the extension never holds or relays a key.

**Migration** (`background/servers/migration.ts`, new). `fluxiq.settings` plus `fluxiq.session`
becomes "This computer" if the addresses are loopback, otherwise "My server", with the old token
marked `legacy`. If the server answers `pairing_required`, the user is asked to sign in.

**UI** (`apps/extension/src/panel/servers/`, new). Server picker, add-server dialog, a signed-in
card ("Signed in as … to FluxIQ"). `panel/getting-started/` becomes "Choose where FluxIQ runs",
then "Sign in". The active origin is always visible. "Open FluxIQ" (`panel/open-fluxiq/`) opens
the profile's origin, where the sign-in tab's cookie already shows the user's Flows.

**Messages.** `fluxiq.servers.add`, `remove`, `select`, `signIn`, `signOut`, routed in
`background/index.ts` with the control-page check. The Lab uses the same messages.

## Transport, Reconnect And Data Minimisation

- **Backoff with full jitter** in `scheduleReconnect`: `random(0, min(30 s, 1 s × 2^n))`. After
  `going_away`, wait at least `retryAfterMs` plus jitter. The watchdog is unchanged.
- **Open timeout.** 20 seconds for non-loopback servers, through a Core client option.
- **Tab minimisation for remote servers** (`connection/active-page.ts`, `connection/browser-state.ts`):
  send only FluxIQ-relevant tabs (the tab the chat or run targets, tabs the run opened, a FluxIQ
  tab group), only on change; the heartbeat becomes a ping; an opt-in "Share all open tabs with
  this server"; loopback unchanged (U3). Domain readers accept partial tab lists:
  `createWebAutomationStateUpdate` (`domain/src/client/gateway-mapping.ts`) and
  `domain/src/io/gateway-input-hub.ts`.
- **Offline queue per profile.** `fluxiq.queuedEvents` keyed by profile, flushed only to its own
  server, cleared on sign-out or removal.
- **Kept as is.** No token in any URL; the redaction rules; screenshots by PUT within Core's limit.

## Consent-Bound Execution

**The rule, in every profile.** The extension executes action commands only (a) during a build or
run started from this browser's chat; (b) for a run started elsewhere (panel, schedule, API) after
the user allows it in the extension, once or always for that Flow in this browser; (c) for Flows
the user marked as allowed to run unattended in this browser.

**Further checks.** Read-only commands are honoured only for FluxIQ-relevant tabs while a session
is ready. A command whose `runContext.actorUserId` or workspace is not the signed-in identity is
dropped and logged. `runContext.startedFromSessionId` is a digest for correlation, never a handle
(Core S5). This is the browser-side half of Core's browser-owner invariant; server-side,
IAM (`FluxIQBrowserSession` and the own-data conditions) decides what the credential may reach.

**Defaults** (U2): on loopback, case (b) is allowed automatically; remote servers ask.

**Files.** `apps/extension/src/background/consent/` (new), plus checks in
`background/automation-relay/`, `connection/server-command-channel.ts` and `connection/in-flight/`.
The prompt is in the side panel, or the popup on Firefox.

**Lab.** Builds start from the chat (case a). API-started playback on `service-local` is case (b):
the person simulation clicks Allow.

## Manifests, Permissions And The Chrome Web Store

**Permissions are unchanged.** Flow A uses `tabs` and `<all_urls>`; D0 passed without `identity`.
The retained fallback, if a store build behaves differently, is `identity.launchWebAuthFlow`: a
reviewed `permission-review.mjs` entry and signing in twice.

**Manifest edits.** Description (Chrome and Firefox): "Record, run and repair browser automations
with FluxIQ. Sign in to FluxIQ at getfluxiq.com, or connect to a FluxIQ runtime you host." The e2e
manifest gets a fixed development `key` (public, not a secret). The Firefox `gecko.id` becomes
permanent; its `moz-extension://<uuid>` Origin is per install, which Core matches by prefix.

**Chrome Web Store.** The first submission, at the H1 gate, already includes sign-in.
- Upload the draft early (D7) so the item ID is known before the gate, and put it in
  `apps/product`'s `extensionClients` (believed assigned at first upload; Google's docs do not say, so verify; the dashboard's public key
  can pin it as the manifest `key`).
- A single-purpose statement covering getfluxiq.com and self-hosting.
- Privacy practices: authentication information, website content, web history and user activity
  are sent to the server the user signs in to; limited-use certification.
- Privacy notice URL `https://getfluxiq.com/privacy/`, live before submission (needs W4's legal
  part).
- A reviewer test account on production, created through provisioning, with an allowed run on a
  public test page, in the submission notes.
- The publisher name and trader declaration (U8); the `<all_urls>` justification.

**Edge and AMO** follow (Edge has its own ID). AMO's `data_collection_permissions` must reflect
transmission to the server, and it needs a source submission. **No remote code:** discovery and
product data are data only.

## Domain Package Changes

- **Session selection by user.** `selectWebAutomationSession` (`domain/src/runtime/adapter.ts`)
  and `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts`) first keep only sessions
  whose operator is the run's actor, and prefer the session the build started from (Core's
  browser-owner invariant).
- **Per-workspace host safety.** Core applies `registerFluxIQHost` per workspace instance. Audit
  module-level state and make it per instance: `domain/src/io/gateway-input-hub.ts`,
  `domain/src/runtime/service.ts`, the host-lease key `web.automation:<clientId>`
  (`domain/src/runtime/host-resources/`), the LLM evidence binding.
- **Domain endpoints get IAM declarations.** Any program endpoint or extension the domain
  registers declares an action, resource and access level like Core's (Core lane B3 defines the
  shape); the route matrix covers them.
- **Sensitive values audit.** Before the gate, confirm typed values in recording events are
  screened in the browser (`domain/src/sensitivity/signature.ts`,
  `apps/extension/src/content/actions/value-redaction.ts`, `webAutomationSecretSafeValidation`);
  fix any gap.
- **Unchanged.** `domain/src/setup.ts` and `setup-cli.ts` stay local-only. The domain never
  imports `apps/extension`, `apps/product` or the stand-in.

## The Public Website

**Decision: FluxIQWebsite is the public site; `apps/site` is not built.** The website already
owns the brand, the copy, the legal pages and a tested deploy, and nothing in its code argues
against it. Its one gap, no server, is closed by a small sign-up backend on its existing Node
server. Public pages as a Core plugin would duplicate it.

**Added to FluxIQWebsite** (by W4, from the stand-in):
- `src/app/signup/page.tsx`: email, display name, a terms checkbox naming the terms version, an
  invite code while N3 holds, and the human check. No password field. It posts to `/api/signup`
  (JavaScript) or submits the form (without JavaScript; the backend answers with a 303 to
  `/check-email/`). It keeps a `continue` parameter from Core's sign-in page.
- `src/app/check-email/page.tsx`: "Check your email", with a resend button.
- `src/app/signin/page.tsx`: a stable URL that forwards to `https://app.getfluxiq.com/login`.
- Header and closing CTAs: "Sign in" and "Get started" in `src/content/navigation.ts`,
  `links.ts` (app links, the store listing) and the site check's allowlist. `/extension/`'s setup
  section: install from the store, sign in.
- `server/signup/` (new, dependency-free ES modules, ported verbatim from the stand-in):
  `validate.mjs`, `human-check.mjs`, `rate-limit.mjs`, `provisioning-client.mjs`, `handler.mjs`,
  with `tests/`; mounted on `/api/signup` and `/api/signup/resend` by the Node server
  (`scripts/static-hosting/serve.mjs` gains a route hook). `pnpm test` widens its glob to
  `server/**/tests/*.test.mjs`.
- `policy.mjs`: Turnstile's script and frame hosts in the CSP; `form-action 'self'` stays.
- `src/content/privacy.ts` and `terms.ts`: the hosted texts (from D7's drafts).
- `.github/workflows/`: a job that publishes the site image to GHCR on `main`. The `deploy`
  branch stays, building with `SITE_SIGNUP=off` for Hostinger as the marketing-only fallback.

**The sign-up backend** (`POST /api/signup`):
1. Accept only same-origin requests (`Origin` is the site's own; `Sec-Fetch-Site: same-origin` or
   a top-level form post).
2. Rate-limit per IP (taken from `X-Forwarded-For` only behind Caddy) and in total.
3. Validate: email (trimmed, lowercased, at most 254 characters), display name (1 to 80),
   `termsAccepted` with the current `termsVersion`, the invite code if enabled, and `continue`,
   which is kept only if it starts with `<app origin>/connect/authorize?`.
4. Verify the human check (Turnstile `siteverify`), unless `SITE_HUMAN_CHECK=off` (stand-in only).
5. Call Core's `createAccount` on the private listener: `{requestId, email, displayName,
   policies: ["FluxIQUserAccess"], workspace: "new", termsVersion, continueUrl, sendWelcome:
   true}`, with the bearer token from `FLUXIQ_PROVISIONING_TOKEN_FILE`.
6. Answer 202 "check your email" for both `created` and `exists` (no account enumeration); 400
   with field errors; 429; 503 "Sign-up is unavailable, try again shortly" if Core is down.
7. Log only `requestId`, outcome and timing; never the body.
`/api/signup/resend {email}` calls `sendWelcome` and answers the same way regardless.

Configuration (environment, secrets as files): `FLUXIQ_PROVISIONING_URL`,
`FLUXIQ_PROVISIONING_TOKEN_FILE`, `SITE_APP_ORIGIN`, `SITE_TERMS_VERSION`,
`SITE_HUMAN_CHECK`, `TURNSTILE_SECRET_FILE`, `SITE_INVITE_CODES_FILE`, `SITE_SIGNUP`.

**In Core, not the website:** sign-in, the welcome link (verify, set password, sign in), reset,
connect and consent, account and browsers, the panel, IAM and provisioning. The website sets no
cookie of its own in this flow and never holds a session.

**`apps/product`** (new package `@fluxiq-web-extension/product`): the product host module,
`src/host/platform.ts` exporting `registerFluxIQPlatform(platform)`, built to
`apps/product/dist/host/platform.mjs` and listed in `FLUXIQ_HOST_MODULE` after the domain's host
module.
- **Product manifest:** name (U1); assets copied from FluxIQWebsite's generated icons and
  `design/brand/fluxiq-mark.svg` into `apps/product/assets/`; brand accent amber `#f5b83d` (subject
  to Core's contrast check); links to the website, `/terms/`, `/privacy/`, support and status;
  `auth.signUpUrl: https://getfluxiq.com/signup/`; `extensionStores`; `extensionClients`.
- **`workspace.created` hook:** seeds a project "My automations", owned by the new user, through
  that workspace's Automation Studio service, so the chat has a project at first connect.
- **Email copy:** welcome, already registered, reset, new browser connected.

## Local Website Stand-In

**Why and where.** The user asked for the website side to be built and exercised locally first.
The stand-in is `packages/website-stand-in/` (`@fluxiq-web-extension/website-stand-in`, private):
a workspace package, so the Lab can start it and its tests run in this repository's gates. Its
`server/signup/` uses the same file names, contract and configuration as the FluxIQWebsite target,
so W4 copies it; its pages are plain HTML that W4 re-skins as Next pages. This plan stays in place
for when the real side is built.

**Layout.**
- `server/serve.mjs`: static files from `public/` plus the `/api/signup` and
  `/api/signup/resend` routes; `server/start.mjs` reads the configuration above.
- `server/signup/`: the backend modules and `tests/`.
- `public/index.html`, `public/signup/index.html`, `public/check-email/index.html`,
  `public/signin/index.html` (forwarding to Core's `/login`).
- `scripts/up.mjs` (`pnpm site:up`): writes a provisioning token into a run directory, starts Core
  under `FLUXIQ_PROFILE=service` with `FLUXIQ_PUBLIC_ORIGIN=http://127.0.0.1:<app>`,
  `FLUXIQ_PROVISIONING_LISTEN=127.0.0.1:<prov>`, the token file,
  `FLUXIQ_EMAIL_SENDER=file:<run>/mail` and both host modules; starts the stand-in on
  `http://localhost:<site>`; prints the two URLs and the mail folder. Two hostnames, both
  loopback, mimic `getfluxiq.com` and `app.getfluxiq.com`.

**Phases** (each a brief for one worker; owned paths are disjoint).

| Phase | Work | Owns | Needs | Validation |
| --- | --- | --- | --- | --- |
| W0 | Contract check: the provisioning listener's request and response schemas, `continueUrl` rule, discovery `signUpUrl` | nothing (reads Core's frozen contracts) | Core contract freeze (10-30) | A written note in this document's reports |
| W1 | Backend modules and pages, against a stub provisioning server | `packages/website-stand-in/`, `pnpm-workspace.yaml` entry | W0 | `node --test` beside each module: validation table, same-origin refusal, rate limit, human check off and on (stubbed), `exists` and `created` give the same answer, 503 on refusal, body never logged |
| W2 | `pnpm site:up` against real Core | `packages/website-stand-in/scripts/` | Core B1 (listener, welcome link, file mail) | A scripted round trip: sign up, read the welcome link from the mail folder, set the password on Core, `getAccount` shows `active`; a second sign-up with the same email gives the same answer and an "already registered" mail |
| W3 | The Lab's `service-local` target uses it (part of D8) | see D8 | W2, D2 | Sign-up, welcome, extension Flow A, a provider-free run on a realistic scenario |
| W4 | Port to FluxIQWebsite: the additions listed in The Public Website, under that repository's own `AGENTS.md` and checks | FluxIQWebsite only | W2 green, the user's go (U11), D7's legal drafts | `pnpm check`, `pnpm test`, `pnpm build`, `pnpm test:site` in FluxIQWebsite; the staging smoke against the real site image |

## Infrastructure For getfluxiq.com

`deploy/` in this repository holds no secrets (U5).

**Images.**
- Product: `deploy/product/Dockerfile` on Core's image stages at a pinned Core ref; adds
  `domain/dist/host/web-panel-host.mjs` and `apps/product`; sets `FLUXIQ_HOST_MODULE` (both
  modules), `FLUXIQ_PROFILE=service`. Tag `ghcr.io/<owner>/fluxiq-product:<ext-sha>-<core-sha>`.
- Website: FluxIQWebsite's own image (`ghcr.io/aidens113/fluxiq-website:<sha>`) after W4; until
  then, closed staging runs the stand-in's image (`packages/website-stand-in/Dockerfile`).

**Hosts** (Core Q7). One production VM; staging as a separate Compose project or a smaller VM.
- `deploy/compose/{production,staging}.compose.yml`: `caddy`, `website`, `fluxiq`, `backup`.
  Two networks: `edge` (Caddy with `website:3000`, `fluxiq:3000` and `fluxiq:4777`) and
  `backend` (`website` with `fluxiq:4780`, the provisioning listener). Caddy is not on `backend`,
  so it cannot reach the listener at all.
- `deploy/caddy/Caddyfile`: `getfluxiq.com` to the website; `www` redirects; `app.getfluxiq.com`
  with `/client*` to the gateway and the rest to Core; staging hosts behind basic auth until the
  gate. Start from Core's S2 draft (replace the client's `X-Forwarded-For` with `header_up
  X-Forwarded-For {remote_host}`, a long `stream_timeout`, no route to the provisioning listener).
  It is unvalidated because Caddy was not installed, so `caddy validate` in CI is its first check.
- Ports 80 and 443 only; SSH by key; unattended upgrades.

**DNS and email.** New records for `app`, `staging`, `app.staging` and `status`. At launch the
apex and `www` move from Hostinger to the VM: lower their TTL a day ahead, keep the MX and mail
records untouched, and keep Hostinger's static deploy as the rollback. SPF, DKIM and DMARC for
`noreply@getfluxiq.com`, which Core uses for welcome and reset mail (U6).

**Secrets,** mounted read-only from `/etc/fluxiq/secrets/`: the provisioning token (shared by
`website` and `fluxiq`), the SMTP or API credential, the setup code, the Turnstile secret, the
restic password, the Sentry DSN. No model key on the server. CI holds only the deploy SSH key and
the GHCR token.

**CI/CD.** `.github/workflows/deploy.yml` runs on a `release-*` tag from `main` (`main` and tags
need the user's approval every time): static checks; build, scan with Trivy and push the product
image; deploy both images to staging and run the staging smoke; the manual approval gate; back up,
`migrate`, deploy to production, smoke-test. Rollback: the previous tags, plus the pre-deploy
backup if needed.

**Observability.** Logs and metrics to Grafana Cloud or Better Stack; errors to Sentry with
scrubbing (no bodies, page data, keys or passwords). Alerts: uptime of both hosts; the 5xx rate;
gateway socket drops; sign-up spikes and provisioning errors; IAM deny spikes; disk above 80%; a
backup older than 26 hours; certificate expiry. A status page.

**Backups.** A volume snapshot every 4 hours plus nightly encrypted restic to B2 or R2; 7 daily and
4 weekly, so deleted data is gone within 30 days; a monthly restore drill into staging.

**Runbook** (`docs/architecture/hosted-service.md`, new): deploy, roll back, restore; revoke every
browser; close sign-up (`SITE_SIGNUP=off` and rotate the provisioning token); maintenance mode;
disable an account (`fluxiq accounts disable`); answer a deletion request; breach response
(notify within 72 hours where GDPR applies); the DNS cutover and its rollback; contacts.

**Release coordination.** The server accepts gateway 0.1 and 0.2; `minimumClient` rises only once
the new extension is live in the store.

## User Docs, Privacy, Cookies And Legal Prerequisites

**User docs.** `docs/user/README.md` and `install.md`: three ways to use FluxIQ (sign up at
getfluxiq.com, this computer, your own server via Core's `docs/operations/self-hosting.md`).
`quickstart.md`: install, sign in from the extension, add your own DeepSeek key in the panel,
build from the chat. `permissions.md`: "the servers you added, your sign-in for each, and panel
preferences".

**Privacy notice.** Drafted here in `docs/user/privacy-policy.md` (D7), published by W4 as
FluxIQWebsite's `src/content/privacy.ts` at `https://getfluxiq.com/privacy/` (the site calls it a
"privacy notice"). It covers:
- **Your own runtime:** today's statements stay true.
- **The website:** what the site itself collects (the analytics position U10 settles), sign-up
  data passed to the service.
- **The service at app.getfluxiq.com:** account data, page content, recordings, screenshots, tab
  information as set in the settings, Flows, runs and datasets; purposes; storage location and
  region; processors (hosting, email, Sentry, Cloudflare Turnstile); model calls from the server
  to the provider the user chose with the user's own key (DeepSeek processes in China, Core Q8);
  keys sealed under the user's password, never shown to others, not readable by the operator at
  rest; the IAM decision log and its retention; retention and deletion within 30 days including
  backups; export (H2); rights; contact `privacy@getfluxiq.com`.
- **Cookies.** `app.getfluxiq.com` sets only `__Host-fluxiq_session` (sign-in; 12 hours, or 30
  days with "keep me signed in"), strictly necessary, and loads no analytics. The sign-up page
  may carry Turnstile's own cookie, if any. FluxIQ declines optional cookies by default (the
  separate cookie work); each cookie is listed with name, purpose and duration.

**Terms** (drafted in `docs/user/terms.md`; published as FluxIQWebsite's `src/content/terms.ts`
at `/terms/`): acceptable use; the user's responsibility for their own provider key and its
charges, theft or misuse; automation on third-party sites at the user's own risk; for organisation
workspaces, the organisation's responsibility for its workers' permissions; no warranty;
suspension; termination and deletion; a version number accepted at sign-up (`termsVersion`).

**Legal prerequisites.** None blocks building; each must be settled before launch.
- **Terms:** a contracting party; until a company exists, the individual operator.
- **Privacy notice:** names the controller and a contact; an EU representative (GDPR Article 27)
  may be needed before opening to the EU.
- **Store publisher:** an individual developer account is possible; the EU trader declaration may
  publish an address and phone number (U8).
- **Selling enterprise or credits:** needs a business or sole proprietor (Stripe, contracts).
- **Licence:** `LICENSE.md` names `license@getfluxiq.com`; the licensor identity is open in Core.

**Store listing** (`docs/user/store-listing.md`): single purpose, description, reviewer notes, test
account, screenshots of sign-in. **Architecture docs:** `extension-client.md` (profiles, sign-in,
minimisation, consent; fix the wire shape), `release-packaging.md` (channels and presets),
`sensitive-values.md` (fix the two contradictions), `testing-facility.md` (hosted targets).

## Lab And E2E Coverage

The standing rules apply: the ten realistic scenarios only, headed browsers, builds started from
the extension chat, live runs supervised in a lab slot, and the waste guards.

- **`service-local` target** (`packages/test-runner/src/target-config.ts`, `coordinator.ts`,
  `environment.ts`): Core under `FLUXIQ_PROFILE=service` with both host modules, on
  `http://127.0.0.1:<app>`, its provisioning listener on loopback with a run-scoped token file,
  `FLUXIQ_EMAIL_SENDER=file:<run>/mail`; the website stand-in on `http://localhost:<site>`.
  Provider-free by default. TLS is covered by Core's Caddy Playwright run and the staging smoke.
- **Loading the extension in branded browsers** (H0-S1). Branded Chrome and Edge 156 ignore
  `--load-extension`. Launch the browser with `--remote-debugging-port` and
  `--enable-unsafe-extension-debugging`, attach with `chromium.connectOverCDP`, and call
  browser-level CDP `Extensions.loadUnpacked {path}` (`launchPersistentContext` exposes no
  browser-level session, so it cannot). Firefox: Playwright's Firefox build (1475) started with
  `-start-debugger-server`, then `installTemporaryAddon` over the remote debugging protocol. D8
  checks which launcher each Lab, ui:e2e and extension Playwright path uses.
- **Loopback hosts.** Every Lab loopback check accepts `localhost` and `127.0.0.1` except
  `demo-workspace/scenario-lab.ts:92`, which requires `127.0.0.1` for the persistent demo scenario
  URL (binds and probes are literal `127.0.0.1`). A scenario URL on `localhost` would be refused
  there, so D8 widens that check or keeps scenario origins on `127.0.0.1`.
- **Accounts through the real sign-up path.** Playwright fills the stand-in's `/signup/`; the Lab
  reads the welcome link from the mail folder, sets the password on Core, and signs in. This
  replaces `bootstrapIdentity` for this target; no test backdoor. Live runs enter the user's key
  through the panel, as a user would.
- **Sign-in.** `run-scenario/pair-run-extension.ts` becomes sign-in: `fluxiq.servers.add` and
  `fluxiq.signIn`, then Playwright drives the opened tab. One spec covers sign-up started from the
  extension (the `continue` path); one covers Flow B. `auth-session.ts` accepts both cookie names.
- **Two-tenant isolation and IAM.** Two accounts, two persistent contexts, two realistic scenarios
  at once (for example everything-store and job-board), provider-free. Assert from each
  workspace's gateway audit that commands reached only their own browser, that account A's panel
  sees none of B's Flows, and that the IAM decision log shows B's identifiers refused for A. One
  escalation check: A's session tries to attach a policy and to reach an `ops:` program, and both
  are denied and logged.
- **ui:e2e journeys:** server picker; sign in to "This computer"; sign up on the stand-in and sign
  in on `service-local`; add a custom server; revoke from the panel; disabled account (through
  provisioning); switch server with queued events.
- **Extension Playwright** (`apps/extension/e2e/`): the tab flow against a stub (including the
  welcome tab it did not open), jitter and `going_away`, `revoked`, consent.
- **Staging smoke** (`deploy.yml`): headed Chromium under xvfb; a staging test account held as a
  secret; sign in through the tab, connect, run one provider-free playback on everything-store,
  check the panel lists the Flow; one sign-up through the staging website with a mail sink; no
  model calls. It waits on `/api/ready`: a cold Core spends 3.5 to 7 s loading modules (Core S3).
- **Live.** One supervised live Lab run per release candidate against staging, with the operator's
  own test key entered as a user would.
- **Load.** k6 (`deploy/load/gateway.js`): 1,000 simulated sockets against staging, provider-free, with the panel's decision rates from Core
  S6 (12 to 156 decisions a minute per visible tab, 826 in a Studio live run) so the audit buffer
  is exercised.

## Phases

Downstream steps, part of the one paired H1 unit; the user is alerted before the first Core edit.
Dates assume the contract freeze on 10-30. Merges happen on narrow checks as soon as a step is
green, except where the table names a constraint.

| Step | Owns (may edit) | Dates and the constraint behind them | Validation | Agent-days |
| --- | --- | --- | --- | --- |
| D0 sign-in spike (Core S1), done | throwaway `fxwork/` worktree | Done 2026-10-28 | Passed: the tab flow completes in Chrome 156, Edge 156 and Playwright's Firefox 1475; the worker wakes; the welcome tab is accepted (Core `reports/h0-s1.md`) | 1 (spent) |
| D1 self-host check | `docs/user/install.md` | 10-30 to 10-31; needs Core's Caddyfile draft (S2; Caddy not yet run) | The current extension pairs over `wss` behind real Caddy, the first run of that draft | 1 |
| D2 profiles and sign-in | `background/servers/`, `background/sign-in/`, `panel/servers/`, `panel/getting-started/`, `panel/settings/`, `background/{index,connection,storage,saved-state}.ts`, `connection/{gateway-session,core-api,server-command-channel}.ts`, `shared/{constants,protocol}.ts`, `config/servers.*.json`, `scripts/build-extension.mjs`, manifests | Built 10-30 to 11-06 in the worktree; merges 11-10, because the MVP live lanes edit these files until then | Unit tests beside each module; tab-flow spec (one accept per navigation, pending claimed once, the welcome tab); sign-in against local `self-hosted` and `service-local` | 7 |
| D3 owner and consent | `domain/src/runtime/adapter.ts`, `domain/src/io/gateway-output-dispatcher.ts`, the domain singleton audit, `background/consent/`, `background/automation-relay/`, `connection/in-flight/` | Built 10-30 to 11-04; merges 11-10 (the same MVP files) | Domain selection tests; consent tests; the two-tenant scenario | 5 |
| D4 minimisation | `connection/{active-page,browser-state}.ts`, the offline queue, `domain/src/client/gateway-mapping.ts`, `domain/src/io/gateway-input-hub.ts` | 11-05 to 11-08, after D2's storage model; merges 11-10 | Partial-tab and per-profile queue tests; provider-free runs on two scenarios | 3 |
| D5 product host module | `apps/product/` (new), `pnpm-workspace.yaml` entry | 10-31 to 11-01, after Core E's `PanelProduct`; merges when green (inert) | Manifest validates against Core's schema; the seeding hook test; contrast test | 1 |
| W1, W2 website stand-in | `packages/website-stand-in/` | W1 10-30 to 11-02; W2 11-04 to 11-05, after Core B1's listener and welcome link | See Local Website Stand-In | 3 |
| D6 infrastructure | `deploy/`, `.github/workflows/deploy.yml`, `docs/architecture/hosted-service.md` | 10-30 to 11-06; closed staging needs the VM and DNS (U9) by about 11-03 | Closed staging up with both images; smoke green; one restore drill | 6 |
| D7 docs, legal, store | `docs/user/*`, `docs/user/terms.md`, `docs/architecture/{extension-client,release-packaging,sensitive-values}.md` | Drafts 10-30 to 11-04; the user's review by about 11-08; the store draft upload once the developer account exists | The user's review; legal review where possible | 3 |
| D8 test coverage | `packages/test-runner/src/{target-config,coordinator,environment,auth-session}.ts`, `demo-workspace/scenario-lab.ts` (loopback check), the browser launcher (branded Chrome and Edge load through CDP), `http-control/`, `run-scenario/`, `run-lifecycle/`, `ui-e2e/journeys/`, `apps/extension/e2e/`, `deploy/load/`, `docs/architecture/testing-facility.md` | 11-05 to 11-11, after W2 and D2 | The tests above; one supervised live run | 7 |
| W4 port to FluxIQWebsite | FluxIQWebsite only | On the user's go (U11), 11-06 at the earliest; its legal pages must be live before the store submission (about 11-13) | See Local Website Stand-In | 2 |

About 39 downstream agent-days across eleven steps (D0's 1 spent; D8 grew by 1 for the browser loader), most in parallel. The calendar is set by the
contract freeze, Core B1 (for W2), the MVP's hold on the connection files until 11-10, the user's
VM, DNS and legal review, and then Google's review.

**Gate and launch.** H1 gate 11-11 to 11-12 on staging (Core's checklist plus this document's Lab
gate). Store submission about 11-13 with the user's approval. getfluxiq.com sign-up opens when the
store approves; until then production holds only the reviewer account.

**After launch.** Edge and AMO listings; layer-2 settings sections (tab sharing, outside-run
consent default, unattended runs) moving from the extension's settings into the panel; export,
retention and the Google sign-in button; the enterprise IAM console in Core (E1), with the website
gaining an enterprise contact page.

## Risks

- **Tab observation** passed D0 in Chrome 156, Edge 156 and Playwright's Firefox 1475, including
  the welcome tab. Stock Firefox, Web Store builds and a natural idle stop were not exercised; if
  one fails, fall back to `launchWebAuthFlow` (the `identity` permission, a second sign-in), or to
  Flow B for the sign-up-from-extension path.
- **Test browsers.** Branded Chrome and Edge ignore `--load-extension`; D8 builds the CDP loader.
- **Locked keys.** After a Core restart, deploy or eviction, builds stop with `secrets.locked`
  until the user signs in at the panel; the chat must say so plainly (Core S5).
- **MVP contention.** D2, D3 and D4 touch files the MVP live lanes use; they stay in the worktree
  until 11-10 and merge `dev` in daily.
- **Website port timing.** The store needs the live privacy notice at `getfluxiq.com/privacy/`
  before submission, and that lives in the user's repository: U11 is on the critical path.
- **DNS cutover.** Moving the apex off Hostinger could break mail if MX lives there; the runbook
  keeps mail records and a Hostinger rollback.
- **Store review.** Server-driven automation with `<all_urls>` may be reviewed slowly. Clear
  disclosure, unchanged permissions, a working reviewer account; submit as soon as the gate passes.
- **Analytics on the website.** GA on every visit conflicts with decline-by-default (U10); it must
  never run on `app.getfluxiq.com`, which the two-hostname design guarantees.
- **Consent friction.** Per-profile defaults (U2).
- **Minimisation and model context.** Measure with provider-free runs and one live run before
  changing the loopback default.
- **Queue leaks across servers.** Per-profile keys and tests (D4).

## Work Ledger

### 2026-10-17 — Hosted production plan written
- Agent: lane lead hosted-production-planner
- Changed: created this document, paired with Core's `docs/working/hosted-production-plan.md`; no code, config or index edited
- Why: the user asked for a production plan for hosting, sign-in through the website and panel customisation, with self-hosting kept first-class
- Validation: `node scripts/structure-audit.mjs` -> "1 violation(s) across 1 rule(s)": `[working-docs] docs/working/README.md is out of date` (the index row is left to the supervisor). The first run also flagged two links out of the repository to Core's plan, replaced with plain-text references. Baseline re-read in `apps/extension/src/shared/constants.ts:1-2` and `apps/extension/manifest.chrome.json`
- Outcome: Partial
- Follow-up: the user's answers; D0 dispatch; the supervisor adds the index rows in both repositories

### 2026-10-18 — Revised with the user's decisions
- Agent: lane lead hosted-production-planner
- Changed: this document (Current State, presets, product site, infrastructure, privacy, cookies and legal prerequisites, Lab, phases, questions), in step with Core's revision
- Why: hosted sign-in ships with the Chrome Web Store release on getfluxiq.com; the website's backend provisions accounts into Core; bring-your-own-key only; no company yet; optional cookies declined by default
- Validation: `node scripts/structure-audit.mjs` -> "1 violation(s) across 1 rule(s)": only `docs/working/README.md is out of date` (the index row, left to the supervisor). The document is 497 lines, with an 85-line Current State
- Outcome: Partial
- Follow-up: dispatch D0; the user answers U1, U8 and U9

### 2026-10-28 — Revised around the user's 2026-10-18 directions
- Agent: supervisor; plan revision by a worker-heavy (brief H1), notes `!FluxIQWebExtension/docs/working/hosted-production-plan/reports/revision-2026-10-28-notes.md`
- Changed: FluxIQWebsite (Next.js 16 static export on Hostinger) is the public site at getfluxiq.com and gains sign-up and its backend; Core moves to app.getfluxiq.com behind a private provisioning listener; `apps/site` shrinks to `apps/product`; a local website stand-in (`packages/website-stand-in/`, W0-W4) comes first; permissions follow AWS IAM (FRNs, generated actions, policies with explicit deny, predefined `FluxIQUserAccess`/`FluxIQOwnerFullAccess`, an inert-for-local parity test); the schedule is re-cut into parallel lanes (hosted gate 11-11/12, store submission about 11-13, each date's constraint named). The "Next revision owed" block is removed.
- Validation: the worker checked the cited Core facts in code (no `platform/` or provisioning yet; one permission check in `_shared/api.ts`; 289 permission declarations); `node scripts/structure-audit.mjs` after the swap (below).
- Outcome: plan revised; D0 and Core H0 can start. Open for the user: N2 (two hostnames), N5, N6, U9 (VM, DNS, store developer account), U10 (Google Analytics vs decline-by-default), U11 (go-ahead to edit FluxIQWebsite).

### 2026-10-28 — H0 spikes folded in
- Agent: supervisor; spike S1 (= D0) by a worker under sub-supervisor t782; this fold drafted by a worker (brief H0-fold). Core's ledger holds the full entry (same date and title)
- Changed: this document: Current State (H0 results, next, not verified), Server Profiles And Sign-In (listener rules), Gateway use (`secrets.locked`), Consent-Bound Execution, Manifests (D0 passed, Firefox Origin), Chrome Web Store (item ID), Infrastructure (Caddyfile draft), Lab And E2E Coverage (branded-browser loading, loopback hosts, staging smoke, load), Phases (D0 done, D1, D2, D8 +1 day, total 39), Risks; the 10-28 revision entry moved above Open Questions
- Validation: from Core's `reports/h0.md` and `h0-s1.md`: the sub-supervisor read `out-chrome.txt`, `out-edge.txt` and `out-firefox.txt` (each 3 accepted and 3 rejected results; boot ids change across the forced stop); it did not re-run the browsers. Lab loopback checks read from `h0-s2.md` (`scenario-lab.ts:92` is the one `127.0.0.1`-only check). This fold: not validated by command (plan text only); the supervisor runs `node scripts/structure-audit.mjs` after the swap
- Outcome: Accepted (D0 passed); the Not verified items above remain open
- Follow-up: contract freeze; D2 starts with the D0 listener rules; D8 owns the CDP loader and the `scenario-lab.ts:92` decision

### 2026-10-28 — H1 contracts frozen (t784)
- Agent: supervisor; contract-freeze worker (worker-heavy, brief t784-K), report `hosted-production-plan/reports/t784-contracts.md` (17 decisions, gaps the lanes will meet)
- Changed (Core `packages/contracts`, 0.2.0 -> 0.3.0): `/platform` (discovery, connect, provisioning operations and errors, the connected-client credential with `approvingSessionId` as a digest, `secrets.locked`, the Origin grammar) and `/iam` (policy grammar, FRN, action catalog entry, `PanelProduct`), re-exported from the root; gateway 0.2 additions (`server.revoked`, `server.going_away`, `runContext`), all optional so 0.1 messages still type-check.
- Decisions (worker, accepted by the supervisor): Core field names say "client", not "browser" (`connectedClientId`, `runtime`), because Core's structure audit refuses browser identifiers; the plan's IAM strings are unchanged. The stamped gateway version stays "0.1" (offline trials refuse traces of another version) and discovery publishes `["0.1","0.2"]`; lane D raises the stamp with a decision on old traces. Every provisioning action name contains `Account` so `platform:*Account*` covers it. The credential record gains `clientInstallId` so a reconnect replaces its record.
- Validation (supervisor): `pnpm --filter @fluxiq/contracts test` -> "Test Files 35 passed (35)", "Tests 487 passed (487)"; `pnpm --filter @fluxiq/contracts build` -> `dist/iam.js`, `dist/platform.js` emitted; Core `pnpm check` -> exit 0; `pnpm structure:check` -> passed (448 warnings, 1152 baselined); `pnpm docs:check` -> current; downstream `tsc --noEmit` in domain and apps/extension against the t784 Core -> clean.
- Outcome: Accepted. Next: lanes A, B1, B2 and C, each as its own task.

## Open Questions

Owner: the user, for all of them. A recommendation follows each; the plan proceeds on it. Core's
N1 to N7 come first.

- **U1. Product name on the website and in the store?** Recommendation: "FluxIQ" on the site and
  panel; "FluxIQ - Web Automation" as the store listing title.
- **U2. Runs started outside the browser: ask or allow?** Recommendation: allow automatically on
  "This computer"; ask on remote servers, with "Always for this Flow in this browser".
- **U3. Tab sharing with remote servers?** Recommendation: only FluxIQ-relevant tabs by default,
  with an opt-in to share all; loopback unchanged until measured.
- **U5. Where does the infrastructure live?** Recommendation: `deploy/` here, without secrets.
- **U6. Email, logs and error vendors?** Recommendation: Postmark or Resend for welcome and reset
  mail (required at launch); Grafana Cloud's free tier; Sentry with scrubbing.
- **U7. Staging extension channel?** Recommendation: a staging-preset build loaded unpacked.
- **U8. Publisher identity for the stores?** Recommendation: the individual developer account now,
  with a business address service if the EU trader declaration applies.
- **U9. VM, DNS and store account: who and when?** Recommendation: the user, this week: the VM,
  DNS records for `app`, `staging`, `app.staging` and `status`, the email sender's DNS records, and
  the Chrome Web Store developer registration. Closed staging needs them by about 11-03.
- **U10. Google Analytics on getfluxiq.com?** It loads on every visit today (your 2026-10-09
  decision), while optional cookies are to be declined by default (2026-10-18). Recommendation:
  the separate cookie work makes GA opt-in on the website before sign-up opens; GA never runs on
  `app.getfluxiq.com` either way.
- **U11. Go-ahead to edit FluxIQWebsite and move getfluxiq.com to the VM?** Recommendation: approve
  W4 once the stand-in round trip is green (about 11-06), so the hosted privacy notice and terms
  are live before the store submission; Hostinger stays as the marketing-only rollback.
