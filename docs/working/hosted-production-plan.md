# Hosted Production Plan

Status: Active
Status detail: Plan only, written 2026-10-17 with the Core document; no code changed; execution waits on the user's answers and starts after the 2026-11-10 MVP release.
Created: 2026-10-17
Last updated: 2026-10-17
Owner: Lane lead hosted-production-planner (plan); the senior supervisor agent owns execution
Scope: Extension, domain and product side of three deployments (hosted service, local, self-hosted): server profiles and sign-in in the extension, transport and data minimisation, consent-bound execution, manifests and store review, domain changes, product panel content, hosted-service infrastructure, user docs and privacy, Lab and e2e coverage. Core contracts live in the paired document.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/hosted-production-plan.md
Related: [extension client](../architecture/extension-client.md), [release packaging](../architecture/release-packaging.md), [testing facility](../architecture/testing-facility.md), [sensitive values](../architecture/sensitive-values.md), [privacy policy](../user/privacy-policy.md), [MVP final month](./mvp-final-month-plan.md), [working index](./README.md)

---

## Current State

**What is true now.** This is a plan. Nothing has been implemented, and no file other than the two paired plan documents was edited. The findings below come from a read-only audit of both repositories on 2026-10-17. The load-bearing claims were re-checked in the code.

The architecture, and every domain-neutral contract, is owned by Core's hosted production plan (`docs/working/hosted-production-plan.md` in the Core checkout; see `Paired document`):
- the three profiles `local`, `self-hosted` and `service`;
- workspace-per-root tenancy;
- the discovery document at `/.well-known/fluxiq`;
- the connect protocol;
- the connected-browser credential;
- client gateway 0.2;
- the panel extension points;
- the usage and billing ports.

This document must not restate those contracts. It links to them.

**The user's binding requirement** (2026-10-17): users can host their own panel, locally or on their own website, as well as use the owner's hosted service. The extension connects to any of the three: pick a server or enter a URL, sign in, and keep that per browser.

**Recommended downstream design.**
- **Server profiles in the extension.**
  - A list of servers in `chrome.storage.local`. Each entry keeps its origin, discovered gateway URL, credential, per-server client ID, signed-in user and workspace names, and its own offline queue.
  - Built-in presets come per build channel. The store build ships "FluxIQ" (`https://app.<domain>`) and "This computer" (`http://127.0.0.1:3000`).
  - "Add a server" accepts a URL, fetches discovery, and shows a warning before saving.
  - One server is active at a time.
- **Sign-in through the website.**
  - Primary: the tab-based authorization code with PKCE. The extension opens the server's `/connect/authorize` in a normal tab; the user signs in or signs up and approves; the extension reads the code from the server's own `/connect/done` page in that tab and exchanges it.
  - Fallback: a typed code entered on the website.
  - Existing loopback pairings migrate into a "This computer" profile.
  - No new manifest permission.
- **Transport.**
  - Backoff with full jitter.
  - The server's `going_away` and `revoked` messages are honoured.
  - A 20-second open timeout for remote servers.
  - Data minimisation for remote servers. Today the 20-second heartbeat sends every tab's URL and title; instead, send only FluxIQ-relevant tabs, and only when they change.
- **Consent-bound execution.** The extension executes actions only for runs started from its own chat, or runs the user allowed in the extension, and only for its own signed-in user. This limits what a compromised or buggy server can make a browser do.
- **Domain.**
  - Session selection filters by the run's user.
  - The host module is made safe to apply per workspace instance.
  - A new `registerFluxIQPlatform` export registers the product's panel content: branding, onboarding, settings sections, extension client IDs.
- **Hosted service.**
  - `deploy/` in this repository, with no secrets.
  - One VM running Docker Compose: Caddy, the product image (Core plus this domain), and restic backups.
  - Staging and production. A GitHub Actions deploy with a manual gate.
  - Monitoring, alerts and a runbook.
- **Docs and stores.**
  - The privacy policy, store listing, install and quickstart guides are rewritten to cover "FluxIQ in the cloud" and "your own runtime".
  - The Chrome privacy-practices form and AMO data-collection declarations are updated.
  - Store reviewers get a test account.
- **Lab.**
  - A `service-local` Lab target: Core under the `service` profile on loopback.
  - Accounts are created through the public sign-up API, with a file mail sink.
  - Playwright drives the sign-in tab.
  - A two-tenant isolation scenario.
  - New ui:e2e journeys.
  - A provider-free staging smoke after each deploy.
  - One supervised live run per release candidate.
  - Runs use the ten realistic scenarios only.

**Schedule.** The MVP is local-only (freeze 2026-10-29, deadline 2026-11-10). Nothing hosted merges before the MVP release.
- D0, the sign-in spike, runs now in a throwaway worktree.
- D1 and D2 follow Core's P1 and P2 from 2026-11-11. Self-hosting on the web, with sign-in, is ready around 2026-11-28.
- D3 to D8 run alongside Core's P3 to P8, toward a hosted closed beta in early January 2027.
- All efforts are rough.

**Next.**
1. The user answers Core's Q1 to Q10 and this document's U1 to U7.
2. The supervisor dispatches D0 (spike S1 below) and adds this document's index row.

**Blocked.** Implementation is blocked on those answers and on the MVP freeze.

**Not verified.**
- Whether tab URL observation of the completion page works in Edge and in the Firefox popup build (D0 decides).
- Whether the MV3 service worker reliably wakes on `tabs.onUpdated` during sign-in.
- Firefox `data_collection_permissions` category names for account data.
- Chrome Web Store reviewer expectations for server-driven automation.
- The Chrome and Edge store extension IDs, which are not assigned until first publication.

## Ownership Split

| Area | Owner |
| --- | --- |
| Profiles, tenancy, identity, discovery, connect protocol, credential model, gateway 0.2 messages, Origin and limits, panel extension points, usage and billing ports, the generic image and self-hosting guide | Core plan (`Paired document`) |
| Extension server profiles, sign-in client, reconnect, data minimisation, consent-bound execution, manifests, store review | This document |
| The domain's session selection, per-workspace host safety, product registration | This document |
| Product panel content (manifest, onboarding, settings, emails) | This document; it uses Core's layers |
| Hosted-service infrastructure on the owner's domain, deploy pipeline, runbook | This document (`deploy/`) |
| User docs, privacy policy, store listings | This document |
| Lab, ui:e2e, extension Playwright, staging smoke, load test | This document; Core Playwright stays in the Core plan |

A boundary-crossing change gets a full ledger entry in the owning document and a one-line entry here.

## Extension Baseline

Paths are relative to this repository. Everything was read on 2026-10-17.

- **Addresses.**
  - The defaults are hard-coded in `apps/extension/src/shared/constants.ts`: `DEFAULT_GATEWAY_URL = "ws://127.0.0.1:4777/client"` and `DEFAULT_CORE_API_URL = "http://127.0.0.1:3000"`.
  - Settings let the user change them: two independent fields, defined in `panel/settings/form-fields.ts` and checked by `panel/settings/save-plan.ts`. The gateway accepts `ws:` and `wss:`, the web address `http:` and `https:`, and there is no loopback restriction.
  - There is no discovery: nothing derives one address from the other.
- **Pairing.**
  - The extension sends `client.hello`, receives `server.pairing_required`, and shows the code (`panel/getting-started/start-view.ts`). An operator approves it in the panel, and `server.session_ready` delivers the token.
  - The token is stored in plain text in `chrome.storage.local` under `fluxiq.session` (`{clientId, token, sessionId, projectId, serverUrl, connectedAt}`), and also by the Core client's `tokenStorage`.
  - `client.pairing_submit` exists in the contract, but the extension never sends it.
  - "Forget this pairing" calls `clearSession()`.
- **Socket.**
  - `FluxIQClientGatewayWebSocketClient` (Core `packages/client-gateway-websocket/src/transport.ts`) opens with a 10-second timeout. Its comment says "the gateway is local or near".
  - `GatewaySession` (`background/connection/gateway-session.ts`) wraps it. Reconnection backs off `min(30 s, 1 s × 2^n)`, without jitter (`background/connection.ts`).
  - `ReconnectWatchdog` (`background/reconnect-watchdog.ts`) holds a 30-second alarm.
  - Every 20 seconds the heartbeat calls `ActivePage.sendBrowserState()`, a full `client.state_update` with every tab's URL and title.
  - The token travels only inside the hello payload.
- **HTTP.** `background/connection/core-api.ts` sends `Authorization: Bearer <token>` with `credentials: "omit"`. A 401 or 403 becomes `refused`. Screenshots are uploaded with PUT to `coreApiUrl` (`connection/state-assets.ts`).
- **Storage.**
  - `chrome.storage.local`:
    - `fluxiq.settings`, `fluxiq.session` and `fluxiq.clientId`;
    - `fluxiq.queuedEvents`: up to 1,000 events, which can carry page data;
    - `fluxiq.problemLog` (redacted);
    - `fluxiq.ui.connectionDraft`.
  - `chrome.storage.session`: the user's Disconnect choice, in-flight records and the host lease.
  - The redaction rules are in `background/diagnostics/diagnostic-redaction.ts`.
- **Manifests.** `manifest.chrome.json` (Chrome and Edge), `manifest.firefox.json` and `manifest.e2e.json` are copied verbatim by `scripts/build-extension.mjs`.
  - `permissions`: alarms, activeTab, downloads, scripting, storage, tabs, webNavigation, plus sidePanel on Chrome.
  - `host_permissions` is `<all_urls>`, except the e2e build, which allows loopback only.
  - Not present: `identity`, `externally_connectable` and `key`.
  - The Firefox `gecko.id` is the placeholder `fluxiq-web-automation@example.local`, which release packaging refuses.
  - The description says "Connects only to the FluxIQ runtime you run and pair".
  - `scripts/release/permission-review.mjs` gates every permission.
- **Domain.**
  - `domain/src/web-panel-host.ts` registers the native node runtime, the domain, its IO, the recording domain and the web-automation runtime.
  - `selectWebAutomationSession` (`domain/src/runtime/adapter.ts:165`) and `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts:129-139`) pick the requested session or the only connected extension session. With more than one, they refuse.
  - There is no user scoping.
- **Docs that assume local only.**
  - `docs/user/privacy-policy.md`: "The extension's developers operate no server that it reports to. They receive none of your data."
  - `docs/user/store-listing.md`: "Requires the FluxIQ runtime".
  - `docs/user/install.md` and `quickstart.md`: `http://127.0.0.1:3000` and a local account.
  - `docs/architecture/extension-client.md` "Default Endpoint". Its wire-shape example is stale: it shows `protocolVersion: 1` where the code uses `"0.1"`.
  - `docs/architecture/sensitive-values.md` contradicts the code twice: extraction sessions are memory-only, and the connection draft is in `chrome.storage.local`, not `localStorage`.
- **Lab.**
  - Ports are on loopback (`packages/test-runner/src/allocation.ts`). `environment.ts` hard-codes the gateway host and URL.
  - `bootstrapIdentity` writes credentials into the run's `.fluxiq`.
  - Pairing goes through `fluxiq.connect` plus the `approve-pairing` API (`run-scenario/pair-run-extension.ts`, `run-lifecycle/pair-extension.ts`).
  - `auth-session.ts` requires the cookie name `fluxiq_session=`.
  - Demo and ui:e2e refuse non-loopback hosts (`demo-workspace/configuration.ts`).
  - The `existing` target accepts `https`, and `wss` off loopback, but cannot create a workspace.

## Server Profiles And Sign-In

**Stored model**, in `chrome.storage.local`:
- `fluxiq.servers`: an array of entries, each with:
  - `profileId`, `label`, `kind` (builtin or custom);
  - `origin`, `gatewayUrl`, `gatewayOverride?`;
  - `instance {name, profile}`, `discoveredAt`;
  - `clientId`: `extension-<uuid>`, one per server, so servers cannot correlate a browser;
  - `credential?`, `credentialExpiresAt?`, `connectedBrowserId?`;
  - `user? {displayName}`, `workspace? {name}`;
  - `legacy?: true`;
  - `lastConnectedAt`.
- `fluxiq.activeServer`.

The credential stays in `chrome.storage.local`, like today's token, so it survives browser restarts. Other extensions and web pages cannot read extension storage.

**Built-in presets.**
- `scripts/build-extension.mjs` injects them per channel from `apps/extension/config/servers.<channel>.json` (new):
  - `store`: "FluxIQ" `https://app.<domain>`, and "This computer" `http://127.0.0.1:3000`;
  - `staging`: "FluxIQ staging", and "This computer";
  - `dev` and `e2e`: "This computer".
- `shared/constants.ts` keeps the loopback defaults only as the "This computer" preset.

**Adding a server.**
1. Normalise the URL to an origin. Require `https`, unless the host is loopback.
2. Fetch `<origin>/.well-known/fluxiq` and validate it against Core's discovery schema, imported from `@fluxiq/contracts`.
3. Show the instance name and origin, with this warning: "This server can run automations in this browser while you use it. Add only servers you trust."
4. Save the server.

If discovery reports a `minimumClient` above this version, the extension shows "Update the extension". The old two-address form moves to "Advanced: connection override".

**Sign-in, Flow A (Core plan, "Extension Client Sign-In Protocol").** Implemented in `apps/extension/src/background/sign-in/` (new).
- `pkce.ts`: verifier and S256 challenge.
- `tab-flow.ts`: `chrome.tabs.create` opens the authorize URL. The pending `{state, verifier, tabId, profileId, startedAt}` is kept in `chrome.storage.session` for 10 minutes. A top-level `tabs.onUpdated` listener (which wakes the service worker) accepts only that tab, on that exact origin, at path `/connect/done`, with a matching `state`. It then closes the tab.
- `token-exchange.ts`: POSTs the token URL.
- `revoke.ts`: signing out calls the revoke URL, then clears the credential.
- The Firefox popup closes when the tab opens, which is harmless: the background owns the flow.

**Sign-in, Flow B (fallback).** "Use a code instead" connects without a credential. The extension shows the `referenceCode` and a button that opens `<origin>/connect`, and the user types the code there.

**Gateway use.** `connection/gateway-session.ts` sends the active profile's credential in `client.hello`. `server-command-channel.ts` handles:
- `session_ready`, which carries the new credential, user and workspace;
- `revoked`: clear the credential, set the state to "signed out", and show the reason;
- `going_away`.

`connection/core-api.ts` derives its base URL from the profile origin.

**Migration of existing settings** (`background/servers/migration.ts`, new). On update, `fluxiq.settings` and `fluxiq.session` become one profile:
- "This computer", if the addresses are loopback;
- otherwise "My server".

The old token is kept with `legacy: true`. If the server answers `pairing_required`, the extension asks the user to sign in.

**UI.** `apps/extension/src/panel/servers/` (new) holds the server picker, the add-server dialog and the signed-in card. `panel/getting-started/` replaces "match this code" with "Choose where FluxIQ runs" then "Sign in". The panel always shows the active server's origin.

**Messages.** New runtime messages: `fluxiq.servers.add`, `remove`, `select`, `signIn`, `signOut`.
- They are routed in `background/index.ts`, with the control-page check (`background/control-page.ts`).
- The Lab uses the same messages.

## Transport, Reconnect And Data Minimisation

- **Backoff.** Full jitter in `scheduleReconnect` (`background/connection.ts`): `random(0, min(30 s, 1 s × 2^n))`. After `going_away`, wait at least `retryAfterMs` plus jitter. The alarm watchdog is unchanged.
- **Open timeout.** For non-loopback servers it is 20 seconds. This needs an option on Core's client (`packages/client-gateway-websocket/src/transport.ts`), which is a Core step in P2.
- **Tab data minimisation for remote servers.** Today the heartbeat sends every tab every 20 seconds (`connection/active-page.ts`, `connection/browser-state.ts`). For non-loopback profiles:
  - Send only FluxIQ-relevant tabs: the tab the chat or run targets, tabs the run opened, and tabs in a FluxIQ tab group.
  - Send them only when they change. The heartbeat becomes a small ping.
  - The user can turn on "Share all open tabs with this server".
  - The loopback default is unchanged (U3).
  - Domain readers must accept a partial tab list: `createWebAutomationStateUpdate` in `domain/src/client/gateway-mapping.ts`, and `domain/src/io/gateway-input-hub.ts`.
- **Offline queue per profile.** `fluxiq.queuedEvents` is keyed by profile. Events are flushed only to the server they were recorded for, and cleared on sign-out or removal. Events recorded for server A must never reach server B.
- **Kept as is.** No token in any URL. Redaction rules unchanged. Screenshots stay on HTTP PUT, subject to Core's 20 MiB limit.

## Consent-Bound Execution

**The rule, for every profile.** The extension executes action commands only in these cases:
- (a) during a build or run started from this browser's chat;
- (b) for a run started elsewhere (panel, schedule or API), after the user allows it in the extension: "Allow once", or "Always for this Flow in this browser";
- (c) for Flows the user marked "may run unattended in this browser".

**Further limits.**
- Read-only commands (snapshot, state) are honoured only while a session is ready, and only for FluxIQ-relevant tabs.
- A command whose `runContext.actorUserId` or workspace differs from the signed-in identity is dropped and logged. `runContext` is a Core 0.2 field, and the identity comes from `session_ready`.

**Defaults** (U2): on loopback, "This computer" auto-allows (b); remote servers ask.

**Files.**
- `apps/extension/src/background/consent/` (new).
- Checks in `background/automation-relay/`, `connection/server-command-channel.ts` and `connection/in-flight/`.
- The Allow prompt goes in the side panel, or the popup on Firefox.

**Lab impact.**
- Lab builds start from the chat, which is case (a).
- API-started playback on the `service-local` target uses the loopback auto-allow, or the person simulation clicks Allow.

## Manifests, Permissions And Store Review

**Permissions do not change.** Flow A uses the existing `tabs` permission and `<all_urls>`. `identity` is not added. If D0 shows that tab observation cannot work, the fallback is `identity.launchWebAuthFlow`, which requires a reviewed entry in `permission-review.mjs` and a store re-review.

**Manifest edits.**
- Description, in Chrome and Firefox: "Record, run and repair browser automations with FluxIQ. Connects to FluxIQ in the cloud or to a FluxIQ runtime you host."
- `manifest.e2e.json` gains a fixed development `key` (a public key, not a secret), so the unpacked e2e ID is stable for Origin rules and the Lab.
- The Firefox `gecko.id` becomes permanent. The MVP store submission needs this anyway.

**Store review.**
- **Chrome Web Store:**
  - Rewrite the single-purpose statement.
  - The privacy-practices form: when the user connects to FluxIQ in the cloud, authentication information, website content, web history and user activity are collected. Certify limited use.
  - A privacy policy URL on `<domain>`.
  - A reviewer test account in the submission notes.
  - The `<all_urls>` justification is unchanged.
- **Edge Add-ons:** the same, under its own listing and ID.
- **AMO:**
  - `data_collection_permissions` must reflect transmission to the developer's server; verify the category for account data.
  - Bundled-code source submission, as for the MVP.
- **No remote code.** Discovery and product data are data only; a logo is an image URL.
- **Shipping.** Hosted support ships as a normal update, 0.2.0. Because permissions are unchanged, users see no re-approval prompt.

## Domain Package Changes

- **Session selection by user.** `selectWebAutomationSession` (`domain/src/runtime/adapter.ts`) and `targetSessionId` (`domain/src/io/gateway-output-dispatcher.ts`) first keep only sessions whose operator is the run's actor. They prefer the session the build started from. The existing refusal stays for the remaining ambiguous cases. This mirrors Core's browser-owner invariant in `selectSession`.
- **Per-workspace host safety.** Core applies `registerFluxIQHost` once per workspace instance. Audit module-level state for anything shared across instances, and convert it to per-instance:
  - `domain/src/io/gateway-input-hub.ts`;
  - `domain/src/runtime/service.ts`;
  - the host-lease key `web.automation:<clientId>` under `domain/src/runtime/host-resources/`;
  - the LLM evidence binding.
- **Platform registration.** A new `registerFluxIQPlatform(platform)` export in `domain/src/web-panel-host.ts` delegates to `domain/src/web-panel/product/` (new: data only, no React). See the next section.
- **Settings.** The web-automation settings (tab sharing, outside-run consent default, unattended runs) are read through Core's `fluxiq.panel.settings()`. The extension receives them in `session_ready` metadata.
- **Sensitive values audit.** Core does not redact recorded timeline values, so before any value leaves the browser for a remote server, confirm that typed values in recording events are screened. The pieces involved: `domain/src/sensitivity/signature.ts`, `apps/extension/src/content/actions/value-redaction.ts` and `webAutomationSecretSafeValidation`. Fix any gap before the hosted beta.
- **Unchanged.** `domain/src/setup.ts` and `setup-cli.ts` stay local-only. The domain still never imports `apps/extension`. A React panel plugin, if one is ever needed, goes in a new `apps/panel-plugin` package rather than in the domain.

## Product Panel Customisation

At launch this uses Core's layers 1 and 2 (data only). Layer 3, code plugins, is used only when a real need appears.

- **Product manifest** (`domain/src/web-panel/product/manifest.ts`):
  - the name (U1);
  - logo, favicon and sign-in illustration in `domain/assets/product/`, copied into `dist` by the host build;
  - the brand accent;
  - links to terms, privacy, support and status on the apex domain;
  - login copy: "Sign in to connect your browser";
  - store links per browser;
  - `extensionClients`: the Chrome and Edge store IDs, filled in after first publication. Firefox is covered by Core's `moz-extension://*` rule.
- **Onboarding** (`onboarding.ts`). Each step lists its done-check:
  1. Install the extension, linked for the detected browser.
  2. Sign in from the extension. Done when the user has at least one connected browser.
  3. Add your model key. Shown only under bring-your-own-key profiles; done when a key is present.
  4. Build your first Flow from the extension chat. Done when at least one Flow exists.
- **Settings sections** (`settings.ts`):
  - "This browser": share all open tabs; runs started outside the browser (ask or always); unattended runs.
  - A fixed note: money, send and delete always ask.
- **Email copy** (`emails.ts`): verify email, reset password, new browser connected, spend cap reached.

## Product Deployment And Operations

This is the hosted service on the owner's domain. It lives in `deploy/` in this repository (new) and holds no secrets (U5).

- **Image.** `deploy/product/Dockerfile`:
  - Builds on Core's image stages at a pinned Core ref.
  - Adds `domain/dist/host/web-panel-host.mjs` and the product assets, and sets `FLUXIQ_HOST_MODULE` and `FLUXIQ_PROFILE=service`.
  - Is tagged `ghcr.io/<owner>/fluxiq-product:<ext-sha>-<core-sha>`.
- **Hosts.**
  - A production VM (Core Q7), plus staging: a smaller VM, or a separate Compose project with its own volume and secrets.
  - `deploy/compose/{production,staging}.compose.yml` runs caddy, fluxiq and backup (restic on cron).
  - `deploy/caddy/Caddyfile` routes `app.<domain>`, with `/client` going to the gateway.
  - Only ports 80 and 443 are open. SSH by key only, or Tailscale. Unattended upgrades.
- **DNS and email.** `app.<domain>`, the apex marketing site on a static host, `status.<domain>`, and SPF, DKIM and DMARC for the transactional sender (U6).
- **Secrets.** Files in `/etc/fluxiq/secrets/`, mounted read-only:
  - the platform DeepSeek key and the master key;
  - the OIDC secrets and the SMTP credential;
  - the setup code, the restic password and the Sentry DSN.

  CI holds only the deploy SSH key and the GHCR token.
- **CI/CD.** `.github/workflows/deploy.yml` runs on a `release-*` tag from `main`. Pushing `main` or a tag needs the user's approval every time.
  1. Run the static checks from `testing-facility.yml`.
  2. Build the image and scan it with Trivy, then push it.
  3. Deploy to staging and run the staging smoke (see Lab).
  4. Pass the manual approval gate.
  5. Back up, migrate, deploy to production, and smoke-test it.

  Rollback: redeploy the previous tag, and restore the pre-deploy backup if a migration is incompatible.
- **Observability.**
  - Logs and metrics go to Grafana Cloud or Better Stack (U6). Errors go to Sentry, scrubbed of request bodies and page data.
  - Alerts: uptime; 5xx rate; drops in gateway sockets; spend per hour above a threshold; the platform ceiling being hit; disk above 80%; backup older than 26 hours; certificate expiry.
  - A status page.
- **Backups.**
  - A provider volume snapshot every 4 hours, plus a nightly encrypted restic copy to off-site S3-compatible storage (B2 or R2).
  - Retention: 7 daily and 4 weekly, which means deleted data is gone within 30 days.
  - A restore drill into staging every month.
- **Runbook.** `docs/architecture/hosted-service.md` (new):
  - deploy, roll back, restore;
  - rotate the platform key;
  - revoke every browser (kill switch);
  - close sign-up; maintenance mode;
  - suspend an account;
  - runaway spend (`FLUXIQ_MODEL_PROVIDERS_ENABLED=false`);
  - breach response: assess, contain, and notify within 72 hours where GDPR applies;
  - contacts.
- **Release coordination.** Store review delays extension updates by days, so the server keeps accepting gateway 0.1 and 0.2 throughout a release window. Discovery's `minimumClient` is raised only once the new extension is live in every store.

## User Docs, Privacy Policy And Store Listing

- `docs/user/README.md`: three ways to use FluxIQ.
- `docs/user/install.md`: FluxIQ in the cloud (sign up), this computer (the current guide, trimmed), or your own server (link to Core's `docs/operations/self-hosting.md`).
- `docs/user/quickstart.md`: sign-in replaces pairing; no addresses to type.
- `docs/user/permissions.md`: the storage line becomes "the servers you added, your sign-in for each, and panel preferences".
- `docs/user/privacy-policy.md`: two cases.
  - Your own runtime: today's statements stay true.
  - FluxIQ in the cloud: what is sent (page content, recordings, screenshots, tab information per the settings, account data), where it is stored, the processors (hosting provider, DeepSeek in China, email provider, Sentry, later Stripe), retention and deletion, export, user rights and contact.
  - The website also needs its own terms and hosted-service privacy policy, with legal review (Core Q9).
- `docs/user/store-listing.md`: single purpose, description, reviewer notes.
- `docs/architecture/extension-client.md`: server profiles, sign-in, data minimisation, consent. Fix the stale wire shape.
- `docs/architecture/release-packaging.md`: channels and server presets; a pointer to the deploy pipeline.
- `docs/architecture/sensitive-values.md`: fix the two contradictions listed in the baseline.
- `docs/architecture/testing-facility.md`: the `service-local` target, the two-tenant scenario, the staging smoke.

## Lab And E2E Coverage

Standing rules still apply: only the ten realistic scenarios, headed browsers, builds started from the extension chat, live runs supervised and charged against a lab slot, and the waste guards.

- **The `service-local` target** (`packages/test-runner/src/target-config.ts`, `coordinator.ts`, `environment.ts`):
  - Core runs with `FLUXIQ_PROFILE=service`, `FLUXIQ_PUBLIC_ORIGIN=http://127.0.0.1:<web>` (allowed on loopback for tests) and `FLUXIQ_EMAIL_SENDER=file:<run>/mail`.
  - Provider-free by default.
  - TLS itself is covered by Core's Caddy `tls internal` Playwright run and by the staging smoke, not by the Lab.
- **Accounts without a backdoor.** `http-control/` gains `signup` and `verify` calls. The verification link is read from the mail sink. This replaces `bootstrapIdentity` writing into `.fluxiq` for this target. The persistent target keeps its credentials file.
- **Sign-in.**
  - `run-scenario/pair-run-extension.ts` becomes sign-in: send `fluxiq.servers.add` and `fluxiq.signIn`, then use the context's `page` event to drive the opened tab (sign in, approve).
  - One spec covers Flow B through Core's claim endpoint.
  - `auth-session.ts` accepts `__Host-fluxiq_session`.
- **Two-tenant isolation scenario.**
  - Two accounts and two persistent browser contexts on one server, running two realistic scenarios at once (for example everything-store and job-board), provider-free.
  - Assert from each workspace's gateway audit that every command reached only its own browser.
  - One run occupies one lab slot.
- **ui:e2e journeys** (`packages/test-runner/src/ui-e2e/journeys/`):
  - server picker;
  - sign in to "This computer";
  - sign in to `service-local`;
  - add a custom server (the `self-hosted` profile on loopback);
  - revoke from the website;
  - switch server with queued events.

  The demo and ui:e2e local paths keep their loopback guard.
- **Extension Playwright** (`apps/extension/e2e/`): the tab flow against a stub server; jitter and `going_away`; `revoked`; consent prompts.
- **Staging smoke** (in `deploy.yml`):
  - Headed Chromium under xvfb.
  - A staging test account held as a secret.
  - Sign in through the tab flow, connect, and run one provider-free playback on everything-store, served by a scenario lab on the CI runner.
  - No model calls.
- **Live.** One supervised live Lab run per release candidate against staging, using the platform key. This confirms the meter and the caps.
- **Load.** `deploy/load/gateway.js` (k6): 1,000 simulated extension sockets (hello with test credentials, ping, state updates) against staging. It records CPU, memory and latency, and is provider-free.

## Phases

These are the downstream steps, keyed to Core's P0 to P8. Effort is in rough agent-days. Every step merges as a task branch on narrow checks. A step that crosses into Core uses one task ID in both repositories, and the user is alerted before the first Core edit.

| Step | With Core | Owns (may edit) | Validation | Effort |
| --- | --- | --- | --- | --- |
| D0 spike S1 | P0 | throwaway `fxwork/` worktree only | Tab flow completes in Chrome, Edge and the Firefox popup; the service worker wakes; a written result | 1-2 |
| D1 self-host check | P1 | `docs/user/install.md` (pointer) | The current extension pairs with a P1 server behind Caddy over the internet (`wss`) | 1-2 |
| D2 profiles and sign-in | P2 | `background/servers/`, `background/sign-in/`, `panel/servers/`, `panel/getting-started/`, `panel/settings/`, `background/{index,connection,storage,saved-state}.ts`, `connection/{gateway-session,core-api,server-command-channel}.ts`, `shared/{constants,protocol}.ts`, `config/servers.*.json`, `scripts/build-extension.mjs`, manifests (description, e2e key) | Unit tests beside each module; extension Playwright tab-flow spec; sign-in against local `self-hosted` and `service` profiles | 8-10 |
| D3 owner and consent | P3 | `domain/src/runtime/adapter.ts`, `domain/src/io/gateway-output-dispatcher.ts`, the domain singleton audit, `background/consent/`, `background/automation-relay/`, `connection/in-flight/` | Domain tests for selection by user; consent unit tests; the two-tenant Lab scenario | 5-7 |
| D4 minimisation | P3 | `connection/{active-page,browser-state}.ts`, the offline queue, `domain/src/client/gateway-mapping.ts`, `domain/src/io/gateway-input-hub.ts` | Tests for partial tab lists and per-profile queues; one provider-free Lab run on each of two scenarios | 3-4 |
| D5 product content | P5 | `domain/src/web-panel/product/`, `domain/src/web-panel-host.ts`, `domain/assets/product/` | The host build; Core's fixture product test, run against this product | 3-4 |
| D6 hosted infrastructure | P7 | `deploy/`, `.github/workflows/deploy.yml`, `docs/architecture/hosted-service.md` | Staging up; smoke green; restore drill once | 6-8 |
| D7 docs and stores | P8 | `docs/user/*`, `docs/architecture/{extension-client,release-packaging,sensitive-values}.md` | Review by the user; legal review of the privacy policy and terms | 3-4 |
| D8 test coverage | P8 | `packages/test-runner/src/{target-config,coordinator,environment,auth-session}.ts`, `http-control/`, `run-scenario/`, `run-lifecycle/`, `ui-e2e/journeys/`, `apps/extension/e2e/`, `deploy/load/`, `docs/architecture/testing-facility.md` | The tests named in the previous section; one supervised live run | 6-8 |

D2 and D3 touch disjoint files and can run in parallel lanes. So can D5, D6 and D7. D4 waits for D2, because both touch `connection/`.

**Timeline.**
- D0 by 2026-10-28.
- D1 and D2 from 2026-11-11, with self-hosting plus sign-in ready around 11-28.
- D3 to D7 through December.
- D8 and the closed beta in early January 2027.

## Risks

- **Tab observation fails in a browser.** Fall back to `launchWebAuthFlow`, which adds the `identity` permission, a store re-review, and a second sign-in for users. D0 decides early.
- **Consent friction.** Scheduled runs and the Lab could be slowed. Per-profile defaults handle this (U2).
- **Store review.** A server-driven automation extension may be reviewed slowly or rejected. Mitigations: clear disclosure, unchanged permissions, a reviewer account.
- **Data minimisation and context.** Sending fewer tabs could weaken the model's view of browser state. Measure it with provider-free Lab runs and one live run before changing the loopback default.
- **Unknown store IDs.** They are assigned only at first publication, so the Origin allowlist and product manifest are updated afterwards.
- **Queue leaks across servers.** Per-profile keys and tests (D4).

## Work Ledger

### 2026-10-17 — Hosted production plan written
- Agent: lane lead hosted-production-planner
- Changed: created this document, paired with Core's `docs/working/hosted-production-plan.md`; no code, config or index edited
- Why: the user asked for a production plan for hosting, sign-in through the website and panel customisation, with self-hosting kept first-class
- Validation: `node scripts/structure-audit.mjs` -> "1 violation(s) across 1 rule(s)": `[working-docs] docs/working/README.md is out of date`. The index row is left to the supervisor. The first run also flagged two links out of the repository to Core's plan; they were replaced with plain-text references and the second run was clean of them. Baseline re-read in code: `apps/extension/src/shared/constants.ts:1-2` (loopback defaults) and `apps/extension/manifest.chrome.json` (no identity, key or externally_connectable)
- Outcome: Partial
- Follow-up: the user's answers; D0 dispatch; the supervisor adds the index rows in both repositories

## Open Questions

Owner: the user, for all of them. A recommendation follows each. Core's Q1 to Q10 come first.

- **U1. Product name in the panel and the store?** Recommendation: "FluxIQ" for the service and panel; store listing "FluxIQ - Web Automation".
- **U2. Runs started outside the browser: ask or allow?** Recommendation: auto-allow on "This computer" (loopback); ask on remote servers, with "Always for this Flow in this browser" available.
- **U3. Tab sharing with remote servers?** Recommendation: only FluxIQ-relevant tabs by default, with an opt-in to share all. The loopback default stays as today until measured.
- **U4. Built-in servers in the store build?** Recommendation: "FluxIQ" (`app.<domain>`), "This computer", and "Add a server".
- **U5. Where does hosted infrastructure live?** Recommendation: `deploy/` in this repository, with no secrets. Move to a private infrastructure repository only if it grows into infrastructure-as-code.
- **U6. Vendors for email, logs, metrics and errors?** Recommendation: Postmark or Resend; Grafana Cloud free tier; Sentry with scrubbing.
- **U7. Staging extension channel?** Recommendation: no store listing; a staging-preset build loaded unpacked by testers. Revisit for the beta.
