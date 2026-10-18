# Hosted Production Plan

Status: Active
Status detail: Revised 2026-10-18 with the user's decisions (Chrome release with sign-in to getfluxiq.com, provisioned accounts, bring-your-own-key); plan only, no code changed; D0 can start now.
Created: 2026-10-17
Last updated: 2026-10-18
Owner: Lane lead hosted-production-planner (plan); the senior supervisor agent owns execution
Scope: Extension, domain and product side of three deployments (getfluxiq.com, local, self-hosted): server profiles and sign-in in the extension, transport and data minimisation, consent-bound execution, manifests and the Chrome Web Store, domain changes, the getfluxiq.com product site and sign-up backend, hosted infrastructure, user docs, privacy, cookies and legal prerequisites, Lab and e2e coverage. Core contracts live in the paired document.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/hosted-production-plan.md
Related: [extension client](../architecture/extension-client.md), [release packaging](../architecture/release-packaging.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md), [privacy policy](../user/privacy-policy.md), [MVP final month](./mvp-final-month-plan.md), [working index](./README.md)

---

## Current State

**What is true now.** This is a plan, revised 2026-10-18 after the user's answers. No code has changed. The baseline comes from a read-only audit of both repositories on 2026-10-17, and its load-bearing claims were re-checked in the code.

Core's hosted production plan (`docs/working/hosted-production-plan.md` in the Core checkout; see `Paired document`) owns the architecture and every domain-neutral contract:
- the three profiles and workspace-per-root tenancy;
- the provisioning API (`platform.provisioning`) and the per-user authorization model;
- discovery and the connect protocol;
- the connected-browser credential and client gateway 0.2 (including `runContext`);
- the panel extension points;
- the billing ports.

This document links to them and does not restate them.

**User decisions** (2026-10-17 and 2026-10-18):
- **Self-hosting stays first-class (binding).** The extension connects to getfluxiq.com, to a local panel, or to a self-hosted panel, and keeps its sign-in per browser.
- **Hosted ships with the Chrome Web Store release.** Users sign in to the web panel and see their Flows as soon as the MVP works well enough.
- **getfluxiq.com runs on Core as its control panel.** Users sign up on the website, and its backend provisions them into Core with access to their own account's data only.
- **Each user brings their own provider key.** It is stored securely and never visible to other users or to the operator in logs. There is no platform key, and billing stays a port. Responsibility sits in the user agreement.
- **No company exists yet.** Note only what needs one.
- **FluxIQ declines optional cookies by default.** This is being implemented separately.

**Recommended downstream design.**
- **Server profiles in the extension.**
  - A list of servers in `chrome.storage.local`. Each keeps its own origin, gateway URL from discovery, credential, client ID, user and workspace names, and offline queue.
  - The store build presets "FluxIQ" (`https://getfluxiq.com`) and "This computer" (`http://127.0.0.1:3000`). "Add a server" takes a URL.
  - One server is active at a time.
- **Sign-in through the website.**
  - The extension opens getfluxiq.com's `/connect/authorize` in a normal tab. The user signs in, or follows the link to sign up, then approves. The extension reads the code from the server's own `/connect/done` page and exchanges it.
  - Fallback: a typed code.
  - Existing loopback pairings migrate.
  - No new manifest permission.
- **Transport.**
  - Jittered backoff, plus `going_away` and `revoked` handling.
  - A 20-second open timeout for remote servers.
  - Remote servers receive only FluxIQ-relevant tabs, and only when they change.
- **Consent-bound execution.** The extension executes actions only for its own signed-in user (it checks `runContext`). A run started outside this browser runs only after the user allows it.
- **Domain.**
  - Session selection filters by the run's user.
  - The host module is made safe to apply per workspace instance.
- **Product site.** A new package, `apps/site` (`@fluxiq-web-extension/site`), is a Core layer-3 plugin. It provides:
  - getfluxiq.com's public pages (landing, terms, privacy);
  - the sign-up page and its backend, which calls Core's `platform.provisioning.createAccount` in-process;
  - the product manifest and branding;
  - a default project seeded for each new workspace.
- **Infrastructure.** `deploy/` in this repository (no secrets): one VM running Compose (Caddy, the product image, restic), staging and production on getfluxiq.com, a GitHub Actions deploy with a manual gate, monitoring and a runbook.
- **Docs and the store.**
  - The privacy policy and the Chrome Web Store listing are written for getfluxiq.com from the first submission.
  - The cookie section states the decline-by-default rule.
  - Store reviewers get a test account.
- **Lab.**
  - A `service-local` target: Core under the `service` profile with the site plugin.
  - Accounts are created through the real sign-up route, with a file mail sink.
  - Playwright drives the sign-in tab.
  - A two-tenant isolation scenario.
  - ui:e2e sign-in journeys.
  - A provider-free staging smoke.
  - One supervised live run per release candidate.
  - The ten realistic scenarios only.

**Schedule.** Today is 2026-10-18; the freeze is 2026-10-29 and the deadline 2026-11-10. This matches Core's release cut.
- **Before the freeze:**
  - D0, the sign-in spike;
  - the site and deploy skeletons, in the H1 worktree;
  - drafts of the terms, privacy policy and listing;
  - the VM and the getfluxiq.com DNS, which need the user's accounts (U9);
  - nothing that touches the extension's connection or panel files on `dev`, because the MVP live lanes own them.
- **Freeze to 11-10:** H1 continues in the worktree. The MVP ships as planned.
- **After 11-10:** H1 merges, the gate runs around 11-28, and the Chrome Web Store submission goes in around 12-01 with sign-in.
- **Plainly:** a store release with working hosted sign-in does not fit by 11-10.

**Next.**
1. The supervisor dispatches D0 with Core's H0, and opens the paired H1 task (one ID, nested worktrees).
2. The user answers Core's N1 to N4, and U1, U8 and U9 here.

**Blocked.** Nothing blocks D0 or building H1. H1 merges wait for the MVP release-candidate tag.

**Not verified.**
- Tab-URL observation of the completion page in Edge and the Firefox popup (D0).
- Service-worker wake on `tabs.onUpdated` during sign-in.
- Firefox `data_collection_permissions` category names.
- What Chrome Web Store reviewers expect for server-driven automation.
- The store extension IDs, which are assigned at first publication.
- Whether the EU trader declaration applies before the service charges money.

## Ownership Split

| Area | Owner |
| --- | --- |
| Profiles, tenancy, provisioning API, authorization, identity, discovery, connect protocol, browser credential, gateway 0.2, Origin and limits, panel extension points, billing ports, generic image, self-hosting guide | Core plan (`Paired document`) |
| Extension server profiles, sign-in client, reconnect, data minimisation, consent-bound execution, manifests, store listing and review | This document |
| Domain session selection, per-workspace host safety | This document |
| Product site (`apps/site`): public pages, sign-up backend, product manifest, default project | This document; it uses Core's layers and provisioning |
| getfluxiq.com infrastructure, deploy pipeline, runbook | This document (`deploy/`) |
| User docs, privacy policy, cookie notice, terms, legal prerequisites | This document |
| Lab, ui:e2e, extension Playwright, staging smoke, load test | This document; Core Playwright stays in the Core plan |

A change that crosses the boundary gets a full ledger entry in the owning document and a one-line entry in the other.

## Extension Baseline

Paths are relative to this repository. Everything was read on 2026-10-17.

- **Addresses.**
  - Hard-coded in `apps/extension/src/shared/constants.ts`: `DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client"` and `DEFAULT_CORE_API_URL = "http://127.0.0.1:3000"`.
  - Settings has two independent fields (`panel/settings/form-fields.ts`, `save-plan.ts`) that accept `ws`/`wss` and `http`/`https`, with no loopback restriction. There is no discovery.
- **Pairing.**
  - `client.hello`, then `server.pairing_required`. The code is shown in `panel/getting-started/start-view.ts`, an operator approves it in the panel, and `server.session_ready` delivers the token.
  - The token is stored in plain text in `chrome.storage.local` under `fluxiq.session`.
  - "Forget this pairing" calls `clearSession()`.
- **Socket.**
  - The Core client (`packages/client-gateway-websocket/src/transport.ts`) opens with a 10-second timeout, commented "the gateway is local or near".
  - `GatewaySession` (`background/connection/gateway-session.ts`) wraps it. Backoff is `min(30 s, 1 s × 2^n)` without jitter (`background/connection.ts`), with a 30-second alarm watchdog (`background/reconnect-watchdog.ts`).
  - Every 20 seconds the heartbeat sends a full `client.state_update` with every tab's URL and title (`ActivePage.sendBrowserState()`).
  - The token travels only in the hello.
- **HTTP.** `background/connection/core-api.ts` sends `Authorization: Bearer <token>` with `credentials: "omit"`. Screenshots go by PUT (`connection/state-assets.ts`).
- **Storage.**
  - `chrome.storage.local`: `fluxiq.settings`, `fluxiq.session`, `fluxiq.clientId`, `fluxiq.queuedEvents` (up to 1,000 events, which can carry page data), `fluxiq.problemLog`, `fluxiq.ui.connectionDraft`.
  - `chrome.storage.session`: Disconnect, in-flight records, the lease.
- **Manifests.**
  - `manifest.chrome.json` (Chrome and Edge), `manifest.firefox.json` and `manifest.e2e.json`, copied verbatim by `scripts/build-extension.mjs`.
  - Permissions: alarms, activeTab, downloads, scripting, storage, tabs, webNavigation, plus sidePanel on Chrome. `<all_urls>` hosts, loopback only in e2e.
  - No `identity`, `externally_connectable` or `key`.
  - The Firefox `gecko.id` is a placeholder.
  - The description says "Connects only to the FluxIQ runtime you run and pair".
  - `scripts/release/permission-review.mjs` gates every permission.
- **Domain.**
  - `selectWebAutomationSession` (`domain/src/runtime/adapter.ts:165`) and `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts:129-139`) take the requested session or the only extension session, and refuse when there are several.
  - There is no user scoping.
- **Docs that assume local only.**
  - `docs/user/privacy-policy.md`: "The extension's developers operate no server that it reports to. They receive none of your data."
  - `docs/user/store-listing.md`: "Requires the FluxIQ runtime".
  - `docs/user/install.md` and `quickstart.md` point at `127.0.0.1:3000`.
  - `docs/architecture/extension-client.md` has a stale wire shape.
  - `docs/architecture/sensitive-values.md` contradicts the code twice: on extraction sessions, and on where the connection draft is kept.
- **Lab.**
  - Ports are on loopback (`packages/test-runner/src/allocation.ts`), with the gateway host hard-coded in `environment.ts`.
  - `bootstrapIdentity` writes credentials into `.fluxiq`.
  - Pairing goes through `fluxiq.connect` and `approve-pairing` (`run-scenario/pair-run-extension.ts`, `run-lifecycle/pair-extension.ts`).
  - `auth-session.ts` requires the cookie name `fluxiq_session=`.
  - Demo and ui:e2e refuse non-loopback hosts.

## Server Profiles And Sign-In

**Stored model** (`chrome.storage.local`).
- `fluxiq.servers` is an array of entries, each holding:
  - `profileId`, `label`, `kind` (builtin or custom);
  - `origin`, `gatewayUrl`, `gatewayOverride?`;
  - `instance {name, profile}`;
  - `clientId`: `extension-<uuid>`, one per server, so servers cannot correlate a browser;
  - `credential?`, `credentialExpiresAt?`, `connectedBrowserId?`;
  - `user? {displayName}`, `workspace? {name}`;
  - `legacy?`, `lastConnectedAt`.
- `fluxiq.activeServer` names the active entry.
- Credentials survive browser restarts. Pages and other extensions cannot read extension storage.

**Built-in presets.** Injected by `scripts/build-extension.mjs` from `apps/extension/config/servers.<channel>.json` (new):
- `store`: "FluxIQ" (`https://getfluxiq.com`) and "This computer";
- `staging`: "FluxIQ staging" and "This computer";
- `dev` and `e2e`: "This computer".

**Adding a server.**
1. Normalise the URL to an origin. Require `https` unless the host is loopback.
2. Fetch `/.well-known/fluxiq` and validate it with Core's schema from `@fluxiq/contracts`.
3. Show the instance name and origin with the warning "This server can run automations in this browser while you use it. Add only servers you trust."
4. If `minimumClient` is above this version, show "Update the extension".

The old two-address form moves to "Advanced: connection override".

**Flow A** (Core's protocol), in `apps/extension/src/background/sign-in/` (new).
- `pkce.ts`: the verifier and the challenge.
- `tab-flow.ts`:
  - `chrome.tabs.create` opens the authorize URL.
  - The pending `{state, verifier, tabId, profileId, startedAt}` sits in `chrome.storage.session` for 10 minutes.
  - A top-level `tabs.onUpdated` listener accepts only that tab, on that exact origin, at `/connect/done`, with a matching `state`, then closes the tab.
- `token-exchange.ts`.
- `revoke.ts`: sign-out calls the revoke URL.
- New users follow the sign-up link inside the same tab: discovery's `signUpUrl` points at the site plugin's page. After provisioning and verification, they return to consent.
- The Firefox popup closing is harmless, because the background owns the flow.

**Flow B.** "Use a code instead" connects without a credential, shows the code, and opens `<origin>/connect`.

**Gateway use.**
- `connection/gateway-session.ts` sends the active credential.
- `server-command-channel.ts` handles `session_ready` (new credential, user, workspace), `revoked` (clear the credential, show "signed out" and the reason) and `going_away`.
- `connection/core-api.ts` takes its base URL from the profile.

**Migration** (`background/servers/migration.ts`, new). `fluxiq.settings` plus `fluxiq.session` becomes "This computer" if the addresses are loopback, otherwise "My server", with the old token marked `legacy`. If the server answers `pairing_required`, the user is asked to sign in.

**UI** (`apps/extension/src/panel/servers/`, new).
- The server picker, the add-server dialog, and a signed-in card ("Signed in as … to FluxIQ").
- `panel/getting-started/` becomes "Choose where FluxIQ runs", then "Sign in".
- The active origin is always visible.
- "Open FluxIQ" (`panel/open-fluxiq/`) opens the profile's origin, where the cookie from the sign-in tab already shows the user's Flows.

**Messages.** `fluxiq.servers.add`, `remove`, `select`, `signIn`, `signOut`, routed in `background/index.ts` with the control-page check. The Lab uses the same messages.

## Transport, Reconnect And Data Minimisation

- **Backoff with full jitter** in `scheduleReconnect`: `random(0, min(30 s, 1 s × 2^n))`. After `going_away`, wait at least `retryAfterMs` plus jitter. The watchdog is unchanged.
- **Open timeout.** 20 seconds for non-loopback servers, through a Core client option (Core lane D).
- **Tab minimisation for remote servers** (`connection/active-page.ts`, `connection/browser-state.ts`).
  - Send only FluxIQ-relevant tabs: the tab the chat or run targets, tabs the run opened, and a FluxIQ tab group.
  - Send them only on change; the heartbeat becomes a ping.
  - An opt-in setting, "Share all open tabs with this server".
  - Loopback stays as today (U3).
  - Domain readers must accept partial tab lists: `createWebAutomationStateUpdate` (`domain/src/client/gateway-mapping.ts`) and `domain/src/io/gateway-input-hub.ts`.
- **Offline queue per profile.** `fluxiq.queuedEvents` is keyed by profile, flushed only to the server it was recorded for, and cleared on sign-out or removal.
- **Kept as is.** No token in any URL. The redaction rules. Screenshots by PUT, within Core's 20 MiB limit.

## Consent-Bound Execution

**The rule, in every profile.** The extension executes action commands only in these cases:
- (a) during a build or run started from this browser's chat;
- (b) for a run started elsewhere (panel, schedule, API), after the user allows it in the extension, once or always for that Flow in this browser;
- (c) for Flows the user marked as allowed to run unattended in this browser.

**Further checks.**
- Read-only commands are honoured only for FluxIQ-relevant tabs while a session is ready.
- A command whose `runContext.actorUserId` or workspace is not the signed-in identity is dropped and logged.

**Defaults** (U2): on loopback, case (b) is allowed automatically; remote servers ask.

**Files.** `apps/extension/src/background/consent/` (new), plus checks in `background/automation-relay/`, `connection/server-command-channel.ts` and `connection/in-flight/`. The prompt goes in the side panel, or the popup on Firefox.

**Lab.** Builds start from the chat, which is case (a). API-started playback on `service-local` is case (b): the person simulation clicks Allow.

## Manifests, Permissions And The Chrome Web Store

**Permissions are unchanged.** Flow A uses `tabs` and `<all_urls>`, which the extension already has. If D0 fails, the fallback is `identity.launchWebAuthFlow`. That needs a reviewed entry in `permission-review.mjs` and means signing in twice.

**Manifest edits.**
- Description (Chrome and Firefox): "Record, run and repair browser automations with FluxIQ. Sign in to FluxIQ at getfluxiq.com, or connect to a FluxIQ runtime you host."
- The e2e manifest gets a fixed development `key`, a public key and not a secret.
- The Firefox `gecko.id` becomes permanent.

**Chrome Web Store.** The first submission, at the H1 gate (Core N1), already includes sign-in.
- A single-purpose statement covering getfluxiq.com and self-hosting.
- Privacy practices: authentication information, website content, web history and user activity are sent to getfluxiq.com when the user signs in there. Limited-use certification.
- The privacy policy at `https://getfluxiq.com/privacy`.
- A reviewer test account on production in the submission notes, with an allowed run on a public test page.
- The publisher name and the trader declaration (see Legal Prerequisites).
- The `<all_urls>` justification.

**Edge and AMO.** The same, later (Edge has its own ID). AMO's `data_collection_permissions` must reflect transmission to getfluxiq.com, and it needs a source submission.

**No remote code.** Discovery and product data are data only.

## Domain Package Changes

- **Session selection by user.** `selectWebAutomationSession` (`domain/src/runtime/adapter.ts`) and `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts`) first keep only sessions whose operator is the run's actor, and prefer the session the build started from. This mirrors Core's browser-owner invariant.
- **Per-workspace host safety.** Core applies `registerFluxIQHost` per workspace instance. Audit module-level state for anything shared, and make it per instance:
  - `domain/src/io/gateway-input-hub.ts`;
  - `domain/src/runtime/service.ts`;
  - the host-lease key `web.automation:<clientId>` (`domain/src/runtime/host-resources/`);
  - the LLM evidence binding.
- **Sensitive values audit.** Core does not redact recorded timeline values. Before the hosted gate, confirm that typed values in recording events are screened in the browser (`domain/src/sensitivity/signature.ts`, `apps/extension/src/content/actions/value-redaction.ts`, `webAutomationSecretSafeValidation`), and fix any gap.
- **Unchanged.** `domain/src/setup.ts` and `setup-cli.ts` stay local-only. The domain never imports `apps/extension` or `apps/site`.

## Product Site And Panel Content

**`apps/site`** (new package `@fluxiq-web-extension/site`). A Core layer-3 plugin, built into the product image with `FLUXIQ_PANEL_PLUGINS=@fluxiq-web-extension/site`.

**`src/panel/`: React, using `fluxiq/ui` and the theme tokens.**
- Public pages: the landing page (the `public.home` slot at `/`), `/x/site/terms`, `/x/site/privacy` (rendered from `docs/user/`), and the sign-up page `/signup`. The last needs a rewrite to `/x/site/signup`, also used by discovery's `signUpUrl`.
- Sign-up form fields: email, display name, password, a terms checkbox with its version, an invite code (Core N3), and Turnstile.
- Signed-in slot content: a "Get the extension" card and an "Add your DeepSeek key" card.

**`src/server/`.** It exports `registerPanelPlugin(platform)`.
- **Product manifest:** name (U1), assets in `apps/site/assets/`, brand accent, links, store links, and `extensionClients` (the Chrome store ID, after first publication).
- **`POST /api/x/site/signup`** (`access: "public"`, rate-limited, human check):
  1. Validate the input; check the invite code and the terms version.
  2. Call `platform.provisioning.createAccount({email, displayName, password, role: "user", workspace: "new", termsVersion})`.
  3. Call `sendVerificationEmail`.
  4. Answer "check your email".

  It never logs the password and never returns it.
- **The `workspace.created` hook** seeds a project named "My automations" through that workspace's Automation Studio service. The extension's chat then has a project at first connect.
- **Email copy:** verify, reset, new browser connected.

**Settings later.** Layer 2 (H2) adds the web-automation settings sections: tab sharing, outside-run consent default, unattended runs. Until then they live in the extension's own settings.

**Not in the domain package.** The domain keeps web-automation registration only. The site is product web code, so it gets its own package. The structure audit's domain-imports rule is unchanged.

## Infrastructure For getfluxiq.com

`deploy/` in this repository holds no secrets (U5).

**Image.** `deploy/product/Dockerfile` builds on Core's image stages at a pinned Core ref.
- It adds `domain/dist/host/web-panel-host.mjs` and the `apps/site` plugin.
- It sets `FLUXIQ_HOST_MODULE`, `FLUXIQ_PANEL_PLUGINS` and `FLUXIQ_PROFILE=service`.
- Tag: `ghcr.io/<owner>/fluxiq-product:<ext-sha>-<core-sha>`.

**Hosts** (Core Q7).
- A production VM, plus staging on a smaller VM or a separate Compose project.
- `deploy/compose/{production,staging}.compose.yml` runs caddy, fluxiq and backup.
- `deploy/caddy/Caddyfile` serves `getfluxiq.com` (with `/client` going to the gateway), redirects `www`, and serves `staging.getfluxiq.com` behind basic auth or Tailscale until the gate.
- Only ports 80 and 443 are open. SSH by key only. Unattended upgrades.

**DNS and email.**
- getfluxiq.com and www (A/AAAA records), staging, and `status.getfluxiq.com`.
- SPF, DKIM and DMARC for `noreply@getfluxiq.com`, for the transactional sender that verify and reset require (U6).

**Secrets.** Mounted read-only from `/etc/fluxiq/secrets/`:
- the SMTP or API credential;
- the setup code;
- the Turnstile secret;
- the restic password;
- the Sentry DSN;
- the provisioning token, only if the HTTP transport is ever used.

There is no model key on the server; users bring their own. CI holds only the deploy SSH key and the GHCR token.

**CI/CD.** `.github/workflows/deploy.yml` runs on a `release-*` tag from `main`; `main` and tags need the user's approval every time.
1. Run the static checks.
2. Build the image, scan it with Trivy, and push it.
3. Deploy to staging and run the staging smoke.
4. Pass the manual approval gate.
5. Back up, run `migrate`, deploy to production, and smoke-test it.

Rollback: redeploy the previous tag, plus the pre-deploy backup if needed.

**Observability.**
- Logs and metrics go to Grafana Cloud or Better Stack. Errors go to Sentry with scrubbing: no bodies, page data, keys or passwords.
- Alerts:
  - uptime;
  - the 5xx rate;
  - gateway socket drops;
  - sign-up spikes;
  - disk above 80%;
  - a backup older than 26 hours;
  - certificate expiry.
- A status page.

**Backups.** A volume snapshot every 4 hours, plus nightly encrypted restic to B2 or R2. Retention is 7 daily and 4 weekly, so data is gone within 30 days. A monthly restore drill into staging.

**Runbook.** `docs/architecture/hosted-service.md` (new) covers:
- deploy, roll back, restore;
- revoke every browser (the kill switch);
- close sign-up;
- maintenance mode;
- disable an account (`fluxiq accounts disable`);
- answer a deletion request;
- breach response: notify within 72 hours where GDPR applies;
- contacts.

**Release coordination.** The server accepts gateway 0.1 and 0.2. `minimumClient` rises only once the new extension is live in the store.

## User Docs, Privacy, Cookies And Legal Prerequisites

**User docs.**
- `docs/user/README.md` and `install.md`: three ways to use FluxIQ: sign up at getfluxiq.com, this computer, or your own server (Core's `docs/operations/self-hosting.md`).
- `quickstart.md`: sign in from the extension; add your own DeepSeek key in the panel; build from the chat.
- `permissions.md`: "the servers you added, your sign-in for each, and panel preferences".

**Privacy policy** (`docs/user/privacy-policy.md`, published at `getfluxiq.com/privacy`). It covers two cases.
- **Your own runtime:** today's statements stay true.
- **getfluxiq.com:**
  - What is collected: account data, page content, recordings, screenshots, tab information as set in the settings, Flows, runs and datasets.
  - Purposes; storage location and region.
  - Processors: hosting, email, Sentry.
  - Model calls go from the server to the provider the user chose, with the user's own key. For DeepSeek that is processing in China (Core Q8).
  - Keys: sealed under the user's password, never shown to others, and not readable by the operator at rest.
  - Retention, and deletion within 30 days, including backups. Export (H2). Rights. Contact (`privacy@getfluxiq.com`).
- **Cookies.**
  - The site sets only strictly necessary cookies: `__Host-fluxiq_session` (sign-in, 12 hours, or 30 days with "keep me signed in"), plus Turnstile's own cookie, if any, on sign-up.
  - FluxIQ declines optional cookies by default (the separate cookie work). No analytics or advertising cookie is set without opt-in.
  - The policy lists each cookie with its name, purpose and duration.

**Terms of service** (`docs/user/terms.md`, new; at `getfluxiq.com/terms`):
- acceptable use;
- the user's responsibility for their own provider key and its charges, and for theft or misuse of it;
- automation on third-party sites at the user's own risk;
- no warranty;
- suspension;
- the termination and deletion procedure;
- a version number accepted at sign-up (`termsVersion`).

**Legal prerequisites.** None of these blocks building; each has to be settled before launch.
- **Terms of service.** Someone must be the contracting party. Until a company exists it is the individual operator, and it is transferred later.
- **Privacy policy.** It must name the controller and give a contact. That can be the individual, with `privacy@getfluxiq.com`. Serving EU users from outside the EU may require an EU representative (GDPR Article 27); check this before opening to the EU.
- **Store publisher.** The Chrome Web Store, Edge and AMO need a publisher account, which can be the individual's. The EU trader declaration may publish an address and phone number, so use a business address service if declaring as a trader (U8).
- **Payments, later.** Stripe needs a business or a sole proprietor.
- **Licence.** `LICENSE.md` names a licensor contact (`license@getfluxiq.com`); the licensor identity is still open in Core.

**Store listing** (`docs/user/store-listing.md`): single purpose, description, reviewer notes, test account, and screenshots of sign-in.

**Architecture docs.**
- `docs/architecture/extension-client.md`: profiles, sign-in, minimisation, consent; fix the wire shape.
- `release-packaging.md`: channels and presets.
- `sensitive-values.md`: fix the two contradictions.
- `testing-facility.md`: the hosted targets.

## Lab And E2E Coverage

The standing rules apply: the ten realistic scenarios only, headed browsers, builds started from the extension chat, live runs supervised and charged to a lab slot, and the waste guards.

- **`service-local` target** (`packages/test-runner/src/target-config.ts`, `coordinator.ts`, `environment.ts`). Core runs under `FLUXIQ_PROFILE=service` with the `apps/site` plugin, `FLUXIQ_PUBLIC_ORIGIN=http://127.0.0.1:<web>` (loopback only) and `FLUXIQ_EMAIL_SENDER=file:<run>/mail`. Provider-free by default. TLS is covered by Core's Caddy Playwright run and by the staging smoke.
- **Accounts through the real sign-up path.** `http-control/` gains a sign-up call to `/api/x/site/signup`, which reads the verification link from the mail sink. This replaces `bootstrapIdentity` for this target. There is no test backdoor. Live runs enter the user's key through the panel, as a user would.
- **Sign-in.** `run-scenario/pair-run-extension.ts` becomes sign-in: `fluxiq.servers.add` and `fluxiq.signIn`, then Playwright drives the opened tab. One spec covers Flow B. `auth-session.ts` accepts `__Host-fluxiq_session`.
- **Two-tenant isolation.**
  - Two accounts and two persistent contexts on one server, running two realistic scenarios at once (for example everything-store and job-board), provider-free.
  - Assert from each workspace's gateway audit that commands reached only their own browser.
  - Also assert that account A's panel session sees none of account B's Flows.
- **ui:e2e journeys:**
  - server picker;
  - sign in to "This computer";
  - sign up and sign in on `service-local`;
  - add a custom server;
  - revoke from the website;
  - disabled account (through provisioning);
  - switch server with queued events.
- **Extension Playwright** (`apps/extension/e2e/`): the tab flow against a stub, jitter and `going_away`, `revoked`, consent.
- **Staging smoke** (`deploy.yml`):
  - headed Chromium under xvfb;
  - a staging test account held as a secret;
  - sign in through the tab, connect, and run one provider-free playback on everything-store from a local scenario lab;
  - check that the panel lists the Flow;
  - no model calls.
- **Live.** One supervised live Lab run per release candidate against staging, with the operator's own test key entered as a user would.
- **Load.** k6 (`deploy/load/gateway.js`): 1,000 simulated sockets against staging, provider-free.

## Phases

Downstream steps, keyed to Core's H0, H1 and H2, with rough agent-days. They are part of the one paired H1 unit of work. The user is alerted before the first Core edit.

| Step | Stage | Owns (may edit) | Validation | Effort |
| --- | --- | --- | --- | --- |
| D0 sign-in spike | H0, now | throwaway `fxwork/` worktree | Tab flow completes in Chrome, Edge and the Firefox popup; the service worker wakes; a written result | 1-2 |
| D1 self-host check | H1 | `docs/user/install.md` | The current extension pairs over `wss` with a lane-A server behind Caddy | 1 |
| D2 profiles and sign-in | H1 | `background/servers/`, `background/sign-in/`, `panel/servers/`, `panel/getting-started/`, `panel/settings/`, `background/{index,connection,storage,saved-state}.ts`, `connection/{gateway-session,core-api,server-command-channel}.ts`, `shared/{constants,protocol}.ts`, `config/servers.*.json`, `scripts/build-extension.mjs`, manifests | Unit tests beside each module; tab-flow spec; sign-in against local `self-hosted` and `service-local` | 8-10 |
| D3 owner and consent | H1 | `domain/src/runtime/adapter.ts`, `domain/src/io/gateway-output-dispatcher.ts`, the domain singleton audit, `background/consent/`, `background/automation-relay/`, `connection/in-flight/` | Domain selection tests; consent tests; two-tenant scenario | 5-7 |
| D4 minimisation | H1, after D2 | `connection/{active-page,browser-state}.ts`, the offline queue, `domain/src/client/gateway-mapping.ts`, `domain/src/io/gateway-input-hub.ts` | Partial-tab and per-profile queue tests; provider-free runs on two scenarios | 3-4 |
| D5 product site | H1 | `apps/site/` (new), `pnpm-workspace.yaml` entry | Site unit tests (sign-up validation, provisioning call, hook); Core's fixture plugin test against this plugin | 5-6 |
| D6 infrastructure | H1 | `deploy/`, `.github/workflows/deploy.yml`, `docs/architecture/hosted-service.md` | Closed staging up; smoke green; one restore drill | 6-8 |
| D7 docs, legal, store | H1 | `docs/user/*`, `docs/user/terms.md`, `docs/architecture/{extension-client,release-packaging,sensitive-values}.md` | Review by the user; legal review where possible | 3-4 |
| D8 test coverage | H1 gate | `packages/test-runner/src/{target-config,coordinator,environment,auth-session}.ts`, `http-control/`, `run-scenario/`, `run-lifecycle/`, `ui-e2e/journeys/`, `apps/extension/e2e/`, `deploy/load/`, `docs/architecture/testing-facility.md` | The tests above; one supervised live run | 6-8 |

About 36 downstream agent-days. D2 and D3 touch disjoint files, as do D5, D6 and D7. D4 follows D2.

**Before the freeze:** D0; D5, D6 and D7 skeletons and drafts in the worktree; the VM and DNS (U9). **Freeze to 11-10:** D2 to D7 in the worktree. **After 11-10:** merge, D8 and the gate (around 11-28), then submission (around 12-01).

**H2:** settings move into layer 2; export, retention and the Google sign-in button on the site; Edge and AMO listings.

## Risks

- **Tab observation fails in a browser.** Fall back to `launchWebAuthFlow`, which adds the `identity` permission and a second sign-in. D0 decides early.
- **MVP contention.** D2 and D4 touch the files the MVP live lanes use, so they stay in the worktree until 11-10. Merge `dev` in daily.
- **Store review.** Server-driven automation with `<all_urls>` may be reviewed slowly. Mitigations: clear disclosure, unchanged permissions, a working reviewer account. Submit early in the gate window.
- **Consent friction.** Per-profile defaults (U2).
- **Minimisation and model context.** Measure with provider-free runs and one live run before changing the loopback default.
- **Unknown store IDs.** Update `extensionClients` after first publication; `moz-extension://*` covers Firefox.
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

## Open Questions

Owner: the user, for all of them. A recommendation follows each. Core's N1 to N4 come first.

- **U1. Product name on the website and in the store?** Recommendation: "FluxIQ" on getfluxiq.com, and "FluxIQ - Web Automation" as the store listing title.
- **U2. Runs started outside the browser: ask or allow?** Recommendation: allow automatically on "This computer"; ask on remote servers, with an "Always for this Flow in this browser" option.
- **U3. Tab sharing with remote servers?** Recommendation: only FluxIQ-relevant tabs by default, with an opt-in to share all. Loopback stays as today until measured.
- **U5. Where does the infrastructure live?** Recommendation: `deploy/` here, without secrets. A private infrastructure repository only if it grows.
- **U6. Email, logs and error vendors?** Recommendation: Postmark or Resend for verify and reset mail (required at launch); Grafana Cloud's free tier; Sentry with scrubbing.
- **U7. Staging extension channel?** Recommendation: a staging-preset build loaded unpacked by testers, with no store listing.
- **U8. Publisher identity for the stores?** Recommendation: the individual developer account now, with a business address service if the EU trader declaration applies. Transfer to the company once it exists.
- **U9. Who sets up the VM and getfluxiq.com DNS, and when?** Recommendation: the user creates the VM account and adds the DNS records this week, so closed staging can run from the H1 worktree during the freeze. The agents then do the rest from `deploy/`.
