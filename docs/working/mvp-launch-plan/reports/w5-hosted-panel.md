# W5 Hosted Panel (lane t901): sub-supervisor report

Core worktree: `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ` (branch `task/t901-hosted-panel`). Nothing committed by W5.

## Checked point 1: P3 (Data and Security) plus P5 part 1 (container, deploy, CI)

**Outcome.** P3 is done and verified, ready to commit. P5 part 1 is written and statically checked. It cannot merge until a one-line fix outside W5 lands (open question 1).

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-data | worker (Sonnet) | Data screen from the existing dataset endpoints | Done | Read the loader and detail view; tests and typecheck below |
| w5-security | worker (Sonnet) | Security screen: keys, access, activity | Done (Activity unavailable, see below) | Read the loaders and the key shaper (it copies named fields only, so no key value can reach the screen); fixed the two type errors in its test |
| w5-deploy | worker-heavy (Opus) | Image, compose, Caddy, disabled deploy job, self-hosting doc | Partial (needs open question 1) | Read the `next.config.ts` diff; structure audit; nothing else (Docker is not installed) |

Worker reports: `reports/w5-hosted-panel/w5-data.md`, `w5-security.md`, `w5-deploy.md`.

**Data** (`apps/web/src/features/data/**`, `app/(panel)/data/page.tsx`):
- Lists every table across projects using `list-project-datasets`. It follows the cursor until the cursor ends or repeats.
- Each row is one table: its Flow, dataset name, row count and newest run.
- Filters by Flow and by search text.
- Opening a table shows its rows a page at a time, through the existing `RunDatasetTable`.
- Export CSV and JSON use the existing download route.
- Has loading, empty, error and incomplete states.

**Security** (`apps/web/src/features/security/**`, `app/(panel)/security/**`):
- **Keys** (secret-keys `snapshot`): name, provider, added, last revealed, and locked or unlocked. The key summary has no last-used time.
- **Access** (identity-access `snapshot`): people, their roles and sessions, with a confirmed Sign out (`revoke-session`).
- **Paired browsers:** confirmed Forget, through automation-studio `revoke-client-trust`. `/api/client-gateway/forget-pairing` accepts only the browser's own credential.
- A refused (403) read shows "You do not have access to this."
- **Activity** is shown as not available. No endpoint reads the IAM audit; only the store's `IamAuditQuery` does (open question 2).
- **P5 slot:** Access has a marked place (`data-slot="access-admin"`) for invites and role editing.

**Deploy:**
- `deploy/docker/Dockerfile`: Node 22, two stages, runs as non-root, and can write only to `/data`. Defaults to the `self-hosted` profile so a misconfigured container fails closed.
- `deploy/docker/healthcheck.mjs` and `deploy/docker/smoke.sh`: health, ready, discovery, non-root, read-only root, foreign-Origin refusal, and a provisioning round trip on `service`.
- `deploy/compose/{self-hosted,service}.compose.yml`: only Caddy publishes ports.
- `deploy/caddy/Caddyfile.example`, and `deploy/env/*.env.example` (placeholders only).
- `.dockerignore`.
- `.github/workflows/deploy.yml`: image build and smoke on manual dispatch only. Its deploy job runs only when the repository variable `FLUXIQ_DEPLOY_ENABLED` is `true`, which is unset, and it names no target.
- `docs/operations/self-hosting.md`, linked from `docs/README.md`.
- `apps/web/next.config.ts`: `output: "standalone"` only when `FLUXIQ_WEB_STANDALONE=1`.

### Integration changes I made
- Rebuilt Core's libraries in this worktree after your B1 merge. The web tests refused to run on a stale dist.
- Typed two test stubs in `features/security/page/tests/security-page.test.tsx` as `Promise<ChangeResult>`. The typecheck failed on them (TS2769).

### Commands run and observed results (Core worktree)
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` -> all three Done (ui-components rebuilt; the other two reused from the cache).
- `pnpm --filter @fluxiq/web exec vitest run src/features/data src/features/security "src/app/(panel)"` -> 8 files, 35 tests passed.
- `pnpm --filter @fluxiq/web check` -> first run 2 TS2769 errors in the security test; after my fix it passed.
- `pnpm structure:check` -> passed (529 warnings, 969 baselined).
- Run by w5-deploy, not repeated by me:
  - YAML strict parse of the 3 files -> OK.
  - `bash -n` on `smoke.sh` and `node --check` on `healthcheck.mjs` -> exit 0.
  - The docs-links audit rule -> passed.
  - `node --test scripts/build-cache/tests/registry.test.mjs` -> 2 failures. Test 6 is caused by this lane (open question 1). Test 5 was failing before this lane.

### Not verified
- Browser rendering of Data and Security (no server started); the P6 specs will cover them.
- The image build and run, the standalone output under turbopack, Caddy, `docker compose config`, the workflow run, and the image tags and digests (Docker is not installed).
- The full apps/web vitest run. `chat-widget-tokens.test.ts` is expected to fail until P1, as you noted.

### Open questions for the lead
1. **Outside W5, one line.** `scripts/build-cache/steps.mjs`, entry `"web:build"`: `env: ["NODE_ENV"]` must become `env: ["NODE_ENV", "FLUXIQ_WEB_STANDALONE"]`. Core's registry test requires every variable `next.config.ts` reads to be fingerprinted; without it, the cache could reuse a non-standalone `.next` for a standalone build. Until it lands, `registry.test.mjs` test 6 fails, and that test is part of `pnpm check`. Do you make this edit, or may I?
2. **Audit read endpoint.** Security's Activity section needs a read endpoint for the IAM audit, for example identity-access `list-audit`, over `IamAuditQuery`. It lives in `packages/fluxiq` outside W5. Who owns it?
3. **Retiring `/programs/*` (P4).** Today Settings links to the other program pages (background tasks, compute control, database manager, docs, deployment sync, production runner, runtime control). Retiring their UI removes those tools from the panel unless a screen replaces them. I am redirecting each to its nearest screen (keys and identity to Security, Studio to Flows, the rest to Settings) and listing what loses its UI in this report. Say if any must keep a screen.

You answered all three; checkpoint 1 was committed as 151cff2ae and 72a82a7ac.

## Checked point 2: P4, P1, P5 account screens, audit endpoint

**Outcome.** P4, P1 and the P5 account screens are built. The audit endpoint is in. Every function of every retired `/programs/<id>` page now has a home in the panel. The narrow tests pass, the structure audit passes, and the typecheck result is recorded below.

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-retire-programs | worker (Sonnet) | P4: retire `/programs/*` UI, redirects | Partial | Superseded by your rule 3. It deleted seven tools' views without giving them a home, so I re-briefed (next row). Its CSS pruning and e2e redirect updates stand. |
| w5-rehome-programs | worker-heavy (Opus) | Give every retired page's function a home first | Done (3 links I fixed) | Read its table; tests below |
| w5-accounts | worker-heavy (Opus) | P5 sign-up path, invites, people and roles | Partial (IAM table entry) | Finished by w5-iam-audit; fixed 3 type errors in its code |
| w5-iam-audit | worker-heavy (Opus) | One IAM table, audit read endpoint, resend throttle, invite-cancel race | Done | Replaced its `globalThis` lookup (see integration); tests below |
| w5-tokens | worker (Sonnet) | P1: one token system, dark default, bridge removed | Done | Read the layout script and guard test; fixed 2 old contract tests it did not run |

Worker reports are in `reports/w5-hosted-panel/`: `w5-retire-programs.md`, `w5-rehome-programs.md`, `w5-accounts.md`, `w5-iam-audit.md`, `w5-tokens.md`.

**Where each retired page now lives** (full function-by-function table in `w5-rehome-programs.md`):

| Retired page | New home | Notes |
| --- | --- | --- |
| `/programs/secret-keys` | `/security/keys` | The old key manager, unchanged: add, replace, remove, scopes, lock/unlock, and the 30-second reveal with the same confirmations |
| `/programs/identity-access` | `/security/sign-in` | "Your sign-in": password, PIN, two-factor, sessions, vault. The rest of the old page stays below it, since accounts has no profile edit or other-user credential reset. People and roles are under Access on `/security`. |
| `/programs/automation-studio/*` | `/flows` | Unchanged |
| background-tasks, compute-control, database-manager, deployment-sync, docs, production-runner, runtime | `/settings/<id>` | The restored view code, moved under `features/settings-page/tools/`. Settings > Advanced lists all nine tools. The program id is `runtime`, not `runtime-control`. |
| Any other `/programs/<id>`, and bare `/programs` | `/settings` | |

- No UI link to `/programs` remains in apps/web.
- One link to `/programs/secret-keys` comes from Core `packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts:5`, outside W5 (open question 1). The redirect covers it meanwhile.

**P1 tokens:**
- `@fluxiq/ui-components` `tokens.css` and `fonts.css` load once in `app/layout.tsx`, and the panel's palette is gone.
- About 55 stylesheets now use the package tokens. The panel keeps only layout values (type scale, spacing, radius, layers, motion).
- The chat widget's host bridge is removed.
- Dark is the default.
- Settings has an Appearance choice (Dark, Light, System). It is stored in localStorage behind try/catch, and an inline script first in the body applies it before content paints.
- The guard test `apps/web/src/tests/panel-tokens.test.ts` fails the build when a panel stylesheet:
  - redefines a package token;
  - has a colour literal or a gradient;
  - uses an undefined variable.
- `docs/architecture/ui-theme.md` is updated.

**P5 accounts:**
- **Welcome:** `/welcome` describes the link before it is used (email, role, workspace) through `POST /welcome/describe`. Every bad link gets the one `invalid_link` answer, and the token is never returned. Core adds no public sign-up form, since the plan does not give Core one.
- **Access on `/security`:**
  - Per person: change role, turn off or on, remove.
  - Invites: invite by email with a role, plus pending invites with Resend and Cancel.
  - Nothing is offered on your own row or the owner's.
  - Every change to access asks for the administrator's own password, plus PIN and code if set.
  - The invite link goes only by email and is never shown.
- **Routes:** `app/api/accounts/{members,invite,member}`. Each needs a cookie session, then the registry's audited IAM decision, then provisioning as an in-process caller. Whatever a policy allows, the server still refuses changes to your own access, any change to the owner, and granting the owner role.
- **Resend:** limited to 3 per 15 minutes per administrator and person, and 6 per hour per person (`lib/form-throttle`).
- **Invite-cancel race:** fixed inside W5. The account is turned off through the provisioning queue first, so a redemption fails, and is deleted only if never accepted. An acceptance in between is turned back on and answered with 409. Both orderings are tested with a real redemption.
- **Audit endpoint `GET /api/security/audit` (`iam:ListAuditEvents`):**
  - Needs `identity.manage`; the IAM decision is itself audited.
  - The workspace comes from the session on the server, and the tenant filter fails closed.
  - Each entry is limited to an allow-list: when, who, action, allowed or denied, resources.
  - Cursor-paged, newest first.
  - Activity on `/security` shows it with Load more.
  - Refusal paths tested: anonymous, non-admin on local and service, another tenant's entries, fields outside the allow-list.
- All nine account and audit routes are in the one table `lib/app-route-iam/contracts.ts`, with parity rows on local, self-hosted and service.

### Integration changes I made
- `scripts/build-cache/steps.mjs`: `web:build` env now fingerprints `FLUXIQ_WEB_STANDALONE`, with the comment updated (your answer 1).
- `apps/web/src/server/provisioning-listener/platform-services.ts`: new `readPlatformIamAudit(query)`, which flushes the buffered sink first. A failed flush is marked best-effort, as the audit rule requires. `app/api/security/server/platform-audit-reader.ts` is now a one-line reader over it, replacing the worker's `globalThis` lookup.
- `features/automation-studio/settings/FlowSettingsView.tsx`: three hard-coded `/programs/secret-keys` links now use `AI_PROVIDER_SECRET_KEYS_HREF` (`/security/keys`).
- `features/security/page/tests/security-page.test.tsx`: the Activity test expects "Loading activity", the real log, instead of the old placeholder.
- Type errors fixed:
  - `app/api/accounts/server/tests/accounts-harness.ts`: narrowing on the created result.
  - `features/accounts/tests/accounts-ui.test.tsx`: an `as const` on the outcome kind.
  - `features/security/access/PeopleList.tsx`: optional `actions` accepts `undefined`, for `exactOptionalPropertyTypes`.
  - `features/security/activity/ActivitySection.tsx`: no default props object, so `createElement` with props type-checks.
- `features/programs/tests/{geometry,surface}-contract.test.ts`: rewritten to the one token system. Colour, elevation and focus come from the package; the panel defines only layout values and no surface roles of its own.

### Commands run and observed results (Core worktree)
- `node --test scripts/build-cache/tests/registry.test.mjs` -> pass 10, fail 1. The failure is test 5 (`root build runs every package build...`), which was failing before this lane; test 6 now passes.
- `pnpm structure:check` -> passed (531 warnings, 917 baselined, down from 969).
- `pnpm --filter @fluxiq/web exec vitest run` over security, accounts, `app/api/{security,accounts,tests}`, `lib/app-route-iam`, `src/tests`, settings-page, chat-widget, `app/{welcome,tests,product,session-reauthentication}`, automation-studio `{settings,authorization,graph}`, and programs -> 154 files: 152 passed, 2 failed (3 tests). Both failures were old token contracts; after my rewrite they pass (2 files, 4 tests).
- `pnpm --filter @fluxiq/web check` through the heavy slot -> before P1 and my fixes: 4 errors (fixed above). The re-run result is recorded in "Typecheck" below.

### Not verified
- No browser look at anything: dark, light, system, contrast, the no-flash script, Studio canvases (now flat), port hues (now on status and accent tokens), and the restored Settings tools inside the shell. P6 covers the screens.
- e2e specs were edited but not run.
- The production audit reader and the account routes' per-request glue (cookie, session, workspace, platform services) are covered only through mocks.
- No real email delivery and no multi-tenant `service`.

### Open questions for the lead
1. **Core, one line, outside W5.** `packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts:5`: the onboarding card's key link should be `/security/keys`; `apps/web/src/app/product/tests/OnboardingCards.test.tsx:33` then follows. May I make the change, or does its owner?
2. **Confirm a deviation.** For people with an account, role changes and turning off or on go through provisioning on every profile, not Identity Access's `update-user`. That endpoint changes only the sign-in role and leaves workspace policies stale, which a later provisioning call silently undoes. People added before accounts still use `update-user`.
3. **Product call: local audit.** On local and self-hosted, panel route decisions are written to the persistent audit only under `multi` tenancy, so Activity there shows account and provisioning records but not route decisions. Persisting them means one audit row per panel call. Do you want that?
4. **Outside W5 (Core provisioning and Identity Access), for multi-tenant `service` and completeness:**
   - an atomic `revokeInvite` (check never-accepted and delete in one queue run; today's fix leaves a narrow window if another administrator turns the invitee back on at that moment);
   - remove someone from one workspace without deleting their account;
   - an Identity Access delete for people added before accounts;
   - `PlatformAccountLinks` describing a welcome link, so the describe route stops copying its digest format;
   - organisation invites using `addMember` for an existing email.

   Separately, `apps/web/src/server/provisioning-listener/platform-services.ts` composes the platform services for one workspace only. That is inside W5, but multi-tenant `service` is an enterprise phase. Say if it belongs in this lane.

## Checked point 3: P5 per-use-case configuration, P6 end-to-end specs, two product defects fixed

**Outcome.**
- The per-use-case configuration is built and wired into Settings.
- P6 specs exist for every screen. They found two real product defects, and I fixed both at the root.
- P2 still waits on W4's I3 conversation list.

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-panel-config | worker (Sonnet) | Branding plus feature presets | Done (1 wiring item, done by me) | Read the presets and guards; tests below |
| w5-e2e | worker (Sonnet) | A spec for every screen on the isolated fixture host | Partial (found 2 product defects) | Read its two defect reports and fixed both causes. It stopped every server by process id with the child tree, and no t901 process stayed alive. |

Reports: `reports/w5-hosted-panel/w5-panel-config.md`, `w5-e2e.md`.

**Per-use-case configuration:**
- `FLUXIQ_PANEL_PRESET` takes `full` (the default), `data-collection` or `task-automation`. An unknown name is a startup error, and the middleware answers `deployment_misconfigured`.
- A preset only hides, never grants. Home, Security and Settings are always reachable.
- Branding comes from the existing product manifest. The stock mark is the website's `fluxiq-mark.svg`, and an accent override maps onto the package's accent and focus tokens only.
- Documented in `docs/operations/self-hosting.md` ("Customise the panel") and `deploy/env/*.env.example`.

**P6 specs** (`apps/web/e2e/`):
- New: `panel-data`, `panel-security`, `panel-welcome`, `panel-presets`, `panel-accessibility`, `panel-flows-list`.
- Extended: `panel-settings` and `panel-runs`.
- Coverage:
  - Data: open a table, CSV download.
  - Security: no key value shown; keys manager, sign-in, Activity.
  - Settings: Appearance persists across reload; every tool renders inside the shell.
  - Dark is the default (`--canvas`).
  - Every `/programs/<id>` redirect.
  - Each preset.
  - Axe on the new screens.
- The runner `e2e/support/run-isolated.mjs` (`pnpm --filter @fluxiq/web test:e2e:isolated`) does all of this per round:
  - builds once;
  - seeds `.e2e-host`;
  - starts the production panel, then waits for `/api/ready`;
  - runs Playwright;
  - kills the server by its process id and child tree.
- The worker's full run, 815 s: read-only round 95 passed and 3 failed; assistant 3/3; flows 5/5; data-collection 6 passed and 1 skipped; task-automation 7/7.
- The 3 read-only failures:
  - 2 are the welcome defect below.
  - 1 is `panel-shell` "six places navigate", which passed alone (4/4); cause not shown, re-run below.

### Product defects found by P6 and fixed (root cause)
1. **The welcome pages refused their own request at 127.0.0.1.**
   - Cause: `apps/web/src/app/welcome/server/isCrossSiteRequest.ts` compared `Origin` with `new URL(request.url).origin`, and Next rewrites `request.url` to `localhost`. That affected `/welcome/describe`, `/welcome/submit` and `/setup/submit`.
   - Fix: it now applies the panel's one cross-site rule (`lib/request-guard`, as the middleware does) as if a session were present, since these posts mint one. On a public profile `Origin` must be the deployment's public origin; locally its host must equal the `Host` the browser addressed. `sec-fetch-site: same-site` is now refused too, which is stricter.
   - Tests: new `welcome/server/tests/isCrossSiteRequest.test.ts`. The two welcome test helpers now send the `Host` a browser always sends.
2. **A screen hidden by the preset answered HTTP 200 while showing not-found.**
   - Cause: the root `app/loading.tsx` wraps pages in a Suspense boundary, so a page's own `notFound()` comes after the 200 status was sent.
   - Fix: the middleware now refuses hidden paths before rendering, rewriting them to a path no route serves so Next answers a real 404 with its not-found page. The pages' own guards stay as a second line.
     - New `app/product/preset/is-hidden-panel-path.ts`.
     - So the middleware does not bundle the rail, the pure nav list moved to `features/panel-shell/nav/items/`; the `nav` barrel's exports are unchanged.
   - The preset spec asserts 404 again, instead of the worker's annotation.

### Integration changes I made
- Settings lists only the preset's tools:
  - `app/(panel)/settings/page.tsx` passes `settingsToolsForPreset(currentPanelPreset())` plus the Security tools;
  - `SettingsPage` and `EngineToolsSection` take that list, defaulting to all;
  - new `features/settings-page/ui/tests/EngineToolsSection.test.tsx`.
- The two defect fixes above, with `middleware.ts` and `tests/middleware.test.ts` (hidden screen and tool rewritten; unknown preset gives 500).

### Commands run and observed results (Core worktree)
- `vitest run src/features/settings-page src/app/product src/features/panel-shell "src/app/(panel)" src/tests` -> 56 files, 453 tests passed.
- `vitest run src/app/welcome src/app/setup` -> 8 files, 31 tests passed. Before the helpers sent `Host`: 1 failed, as expected.
- `vitest run src/tests/middleware.test.ts src/app/product src/features/panel-shell` -> 11 files, 54 tests passed.
- `pnpm structure:check` -> passed (532 warnings, 917 baselined).
- Typecheck and the targeted e2e run (welcome, presets, panel-shell, with a production build) through the heavy slot: results in "Final validation" below.

## Checked point 4: P2 conversation list, your checkpoint-2 answers, final validation

**Outcome.**
- P2 is in.
- Your three answers are applied: the onboarding link, `update-user`'s root fix, and route decisions persisted on every profile.
- The sign-in page no longer offers what `update-user` refuses.
- Final validation results are in "Final validation" below.

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-conversations | worker (Sonnet) | P2: the panel uses W4's one conversation list | Partial (panel-thread rename/delete need Core) | Fixed the one failure it found but did not own (the smoke test, below); tests below |
| w5-iam-root | worker-heavy (Opus) | `update-user` root fix; persist route decisions on every profile | Done | Read its choice and its wiring; tests below |
| w5-iam-followup | worker-heavy (Opus) | The UI must not offer what is refused; account-holder username; docs | Done | Read the delegation; checked its open question 1 (below) |

Reports: `reports/w5-hosted-panel/w5-conversations.md`, `w5-iam-root.md`, `w5-iam-followup.md`.

**P2:**
- The panel had no thread dropdown of its own; the shared ui-components chat now renders the conversation list.
- The panel transport (`features/chat-widget/transport/`) implements the port:
  - for a project: `newThread`, `renameThread` and `deleteThread`, through `open-conversation` (fresh), `rename-conversation` and `delete-conversation`;
  - for the docked Assistant: `newThread` only (`open-panel-thread`), because Core has no rename or delete for panel threads (open question 1).
- `e2e/chat-widget.spec.ts` is updated, and `route.test.ts` covers the new endpoints.

**`update-user` (your answer 2): refused for account holders, by name.**
- Identity's role is computed from all of a person's memberships' policies, so a single role cannot say which workspace or policy to change. Routing it through provisioning would mean guessing.
- So `update-user` refuses an account holder's role, sign-in on/off and username with `identity.authority_managed_by_provisioning`, which points to provisioning. If the account lookup fails, the change is refused with `identity.authority_unchecked`.
- People without an account keep working, and display-name changes stay allowed.
- How it works: a new `IdentityAuthorityDelegation` (`programs/identity-access/runtime/authority/`) is installed on every workspace instance at creation, in `lib/fluxiq.ts`, which you approved.
- The snapshot endpoint marks each person `authorityHeldElsewhere` through the same decision, so the two cannot drift. The sign-in page hides those controls and shows "Managed under Access", linking to `/security#security-access`.

**Route decisions (your answer 3):**
- A new Core `IamDecisionAuditFilter` keeps every refusal and every allowed state change, and drops allowed reads. A read is an action whose catalog level is Read or List; for app routes, an action only ever served by GET.
- The decisions go through the existing buffered platform sink on every profile; local and self-hosted decide exactly as before.
- Service no longer persists allowed reads, as your answer says. If service should keep them, it is one line in `workspaceIam`.

**Docs:** `docs/architecture/platform.md`, `docs/architecture/package-boundaries.md` (an unreleased migration note for `update-user`) and `docs/operations/data-and-state.md` (audit volume) are updated.

### Integration changes I made
- `packages/fluxiq/src/platform/panel/onboarding/panel-onboarding-cards.ts`: the key link is `/security/keys`, with its test and `apps/web/src/app/product/tests/OnboardingCards.test.tsx` (your answer 1).
- `apps/web/src/tests/provisioning-welcome-smoke.test.ts`: its welcome request now sends the `Host` a browser always sends. It failed (403) after checkpoint 3's cross-site fix because the test request had no `Host`.
- I stopped my queued targeted e2e run, which would have built against the libraries your W4 merge made stale. One full run now covers everything (below).

### Commands run and observed results (Core worktree)
- `pnpm --filter fluxiq exec vitest run src/platform/panel/onboarding` -> 1 file, 4 tests passed.
- `pnpm --filter @fluxiq/web check` (heavy slot, before P2) -> passed, 0 errors; not stamped because the tree changed under it.
- Workers' runs, re-run in the final validation below:
  - w5-conversations: chat-widget, program route and `src/tests` -> 219 passed, 1 failed (the smoke test, fixed above).
  - w5-iam-root: Core identity-access, `_shared/iam` and `platform/iam` -> 40 files, 355 tests passed; web acceptance -> 54 files, 482 tests passed.
  - w5-iam-followup: identity-access -> 106 passed; security and `lib/tests` -> 282 passed; docs-links passed.
  - `pnpm structure:check` -> passed (534 warnings, 917 baselined).

### Humanness slider in Flow settings (your 2026-11-11 direction)
- Worker w5-humanness (Sonnet). Report: `reports/w5-hosted-panel/w5-humanness.md`.
- Flow settings has a Humanness section, `HumannessSetting` in `features/automation-studio/settings/humanness/`:
  - a 0-100 slider, labelled "Fastest" and "Most human-like", with the number shown and keyboard steps;
  - "Uses the starting value" when the Flow has none of its own, and a control that clears back to it.
- It loads from `metadata.humanness` (`get-flow-metadata-detail`). It saves `metadata.humanness` as a number or `null` through `update-flow-settings`, on every save, like the other metadata the form owns.
- Built against your API names; untested against W2's real responses until t898 lands.
- The panel has no task-settings surface, so no task control was built.
- `ui-components` has no slider. The panel's own component is ready for W4 to move into ui-components for both clients.
- The bounds are local constants until W2's I1 contract exports them.

### More integration changes I made
- Typecheck fixes:
  - `features/security/sign-in/IdentityAccessLive.tsx`: `visibleIdentityUsers` is generic, so a listed user keeps `authorityHeldElsewhere`.
  - `lib/tests/fluxiq.test.ts`: narrowing on the created account.
- `features/automation-studio/runtime/tests/request-generation.test.ts`: it read the database-manager files at their pre-rehome paths (ENOENT). It now reads `features/settings-page/tools/database-manager/{DatabaseManagerLive.tsx,records/useDatabaseRecords.ts}`, and matches the two guarded statement sequences across line breaks, since the rehome put one statement per line.
- I stopped the queued typecheck and e2e before the slider work, so the final run validates one still tree.

### Final validation (Core worktree)
- `node .../heavy-slot.mjs run t901 -- pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/ui-components build` -> exit 0.
- `pnpm --filter @fluxiq/web test` (heavy slot) -> 408 of 409 files and 3,087 of 3,088 tests passed. The failure was `request-generation.test.ts` (fixed above; 1 passed alone).
- Narrow runs after the last changes:
  - `vitest run src/features/automation-studio/settings src/features/automation-studio/runtime/tests/request-generation.test.ts src/features/security/sign-in src/tests` -> 23 files, 159 tests passed.
  - `src/lib/tests/fluxiq.test.ts` -> 35 passed.
- `pnpm --filter @fluxiq/web check` (heavy slot) -> two failed runs, then a pass:
  - first: 5 errors (fixed above);
  - second: stopped before it ran, for the slider work;
  - final: passed, 0 errors.
- `pnpm structure:check` -> passed (535 warnings, 917 baselined).
- Full isolated e2e `node apps/web/e2e/support/run-isolated.mjs` (heavy slot): see "E2E result".

### E2E result
- **Full runner (production build, 572 s; 1,585 s in all):** exit 0, 0 rounds failed.
  - Read-only round: 98 passed, 0 failed. This includes the welcome specs (defect 1 fixed), panel-shell, Data, Security, Settings tools, redirects and axe.
  - Assistant: 3 passed. Flows: 5 passed.
  - Preset `data-collection`: 6 passed, 1 skipped (expected: this preset keeps every screen).
  - Preset `task-automation`: 7 passed. Hidden screens and tools now answer a real 404 (defect 2 fixed).
  - Every server was stopped by process id with its child tree, and no t901 process remains.
- **`chat-widget.spec.ts`:** it was outside the runner's `panel-*` set.
  - The runner now includes it as a mutating round of its own, seeded by `seed-chat-threads.mjs` (`e2e/support/run-isolated.mjs`, my edit; README updated).
  - Its first run failed on the retired "Programs" landing, so worker w5-chat-spec (Sonnet) rewrote it for the docked Assistant. Report: `reports/w5-hosted-panel/w5-chat-spec.md`.
  - Final run: 11 passed, 1 failed. The failure is U5, a product gap (open question 6).
  - Two old tests no longer apply to the Assistant:
    - the choice ask, now an Allow card whose consequence is delete;
    - A2, the open ask, which was dropped.
  - The worker's reason: the Assistant raises only Allow cards, and `answer-panel-ask` takes only grant or deny. Choice and open asks still exist in project threads (`present-ask.ts`), so they need a spec on a screen that shows project threads (open question 7).

### For Core's hosted-production-plan.md Current State (your decision 5)
**Audit and identity, 2026-11-11 (W5, t901).** The IAM decision audit keeps every refusal and every allowed state-changing decision on every profile (local, self-hosted, service). Allowed reads are not kept.
- A read is an action whose catalog level is Read or List, or an app route only ever served by GET.
- Everything goes through the one buffered platform sink, so no request waits on storage.

The Security screen's Activity log reads the audit through `GET /api/security/audit` (`iam:ListAuditEvents`, `identity.manage`).
- The workspace comes from the session on the server, so the log never mixes in another workspace's entries.
- Each entry carries only when, who, action, allowed or denied, and resources.

Provisioning is the only writer of an account holder's sign-in role, on/off and username.
- Identity Access `update-user` refuses those changes for account holders with `identity.authority_managed_by_provisioning`. Its snapshot marks such people `authorityHeldElsewhere`.
- People without an account and display-name changes are unaffected.
- Open: a filtered list on `service` will write one row per request with the count of hidden items (decision 3, in progress), and an unchanged field will not count as a change (decision 4, in progress).

### Your decisions of 2026-11-11, queued until you say the commit is done
- **Decision 1:** U5 stays failing honestly, never skipped, until W4's panel-assistant endpoint lands; then I route panel-thread attachments to it.
- **Decision 2:** choice-ask and open-ask e2e coverage on a project thread, through the shared conversation list. If no screen can raise them, I report exactly what is missing.
- **Decision 3:** on `service`, one audit row per filtered list request, carrying the number of hidden items, with a test.
- **Decision 4:** in `update-user`, a field equal to its current value is not a change, so an unchanged username is accepted, with a test.

### More open questions for the lead
6. **U5: Core has no attachment read for panel threads.** The dock reads every attachment through the project endpoint `get-conversation-attachment` with projectId `panel` (`apps/web/src/features/chat-widget/attachments/read-attachment.ts`). So a panel thread's reference to a proposed Flow change shows "could not be read here" instead of the "Structural changes" table. The root fix is a panel-thread attachment read in Core's panel-assistant endpoints (`packages/fluxiq/src/programs/automation-studio/api/panel-assistant/`), which is outside W5 and beside question 1's panel-thread rename and delete. Once it exists, the panel's attachment port routes panel threads to it.
7. **Choice and open asks in project threads lost their e2e.** Is there still a panel screen that shows project threads (build or run chats)? If yes, W5 adds a spec there; if not, those asks have no panel surface.
8. **Memory-rule breach:** one of w5-chat-spec's runs started at about 1.3 GB free, because its wait loop gave up. It completed.
- Memory-rule breaches, for the record: one narrow sign-in run of mine started at 1.36 GB free, and the slider worker's two narrow runs at 1.88 GB and 0.45 GB. All passed.

### Not verified
- Live browser use by a person (the e2e run is headless chromium only).
- Multi-tenant `service` beyond the primary workspace.
- An `update-user` during a primary reload.
- The snapshot's cost: one owner lookup per person.

### Open questions for the lead
1. **Panel-thread rename and delete need Core (W4's area).** The docked Assistant's threads have no rename or delete endpoints, so the panel offers New chat only there; project threads have all four. Does W4 add them?
2. **Hidden-item denials on `service`.** A filtered list writes one denial row per hidden item. Keep these, or record one row per filtered list?
3. **Presence-based authority check, for your awareness.** As with the existing credential recheck, `update-user` treats a field's presence as a change. An outside client that sends an unchanged `username` with a display-name edit is refused for an account holder. The panel sends only changed fields.
4. **`docs/working/hosted-production-plan.md` (Core) is yours.** It should note route decisions persisted on every profile and the `update-user` refusal.
5. **Registry test 5:** you expected your dev merge to clear it. It still fails in this tree (not yet merged).

### Files for the commit (Core worktree, uncommitted; `git status` lists them exactly)
- **P4 and the rehome:**
  - deleted `apps/web/src/app/programs/**`;
  - `apps/web/src/features/programs/**` (pruned, plus `format`, `selection` and `technical-details`);
  - `features/settings-page/{tools,model,ui}/**`;
  - `app/(panel)/settings/[tool]/**`;
  - `app/(panel)/security/{keys,sign-in}/**`;
  - `features/security/{keys,page,sign-in}/**`;
  - `app/AuthShell.tsx`, `app/tests/**`, `app/session-reauthentication/tests`, `lib/resolve-setup-domain.ts`;
  - the four automation-studio and chat-widget link files;
  - `next.config.ts` (redirects).
- **P1 tokens:**
  - `app/styles/**`, `app/globals.css`, `app/layout.tsx`;
  - every feature `*.css`;
  - `features/settings-page/appearance/**`;
  - the `FlowEdge.tsx`, `graph/ports.ts` and `graph/viewport-store.ts` colour literals;
  - `src/tests/panel-tokens.test.ts`, with `features/chat-widget/tests/chat-widget-tokens.test.ts` deleted;
  - `features/programs/tests/{geometry,surface}-contract.test.ts`;
  - `docs/architecture/ui-theme.md`.
- **P5 accounts and audit:**
  - `features/accounts/**`, `features/security/{access,activity}/**`;
  - `app/welcome/**`, `app/api/{accounts,security}/**`, `app/api/tests/**`;
  - `lib/app-route-iam/**`, `lib/workspaces/**`, `lib/fluxiq.ts`, `lib/tests/fluxiq.test.ts`;
  - `server/provisioning-listener/**`;
  - Core `programs/identity-access/**` and `platform/iam/audit/**`;
  - the three architecture and operations docs above;
  - `src/tests/provisioning-welcome-smoke.test.ts`.
- **P5 configuration:**
  - `app/product/**`, `public/fluxiq-mark.svg`;
  - `features/panel-shell/**` (including the `nav/items` split);
  - `app/(panel)/**` page guards and `settings/page.tsx`;
  - `src/middleware.ts`, `src/tests/middleware.test.ts`;
  - `deploy/env/*.env.example`, `docs/operations/self-hosting.md`;
  - Core `platform/panel/onboarding/**`.
- **P2:** `features/chat-widget/**`, `e2e/chat-widget.spec.ts`, `app/api/programs/[programId]/[endpoint]/tests/route.test.ts`.
- **P6:** `apps/web/e2e/**`, `apps/web/package.json` (`test:e2e:isolated`).
- **Build:** `scripts/build-cache/steps.mjs`.
- **Audit:** `.structure-baseline.json` (only shrank, 969 to 917).

## Checked point 5: your decisions 2-4, the dock grants, the dock's attachments and thread edits, the shared humanness control

**Outcome.** Partial.
- **Committed by you:** decisions 3 and 4 (fd5fa4e17).
- **Done since, uncommitted:**
  - the `FluxIQUserAccess` panel-assistant grant;
  - the dock reads panel-thread attachments and renames and deletes panel threads;
  - U5 passes honestly;
  - Flow settings uses W4's shared humanness control.
  - The typecheck result is under "Typecheck" below.
- **Decision 2 cannot be done:** no panel screen shows project threads (open question 1 below).

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-audit-lists | worker-heavy (Opus) | Decision 3: one audit row per list request with the hidden count | Done (you committed it) | You re-ran it; I fixed the two stale `platform.md` passages it flagged |
| w5-unchanged-fields | worker-heavy (Opus) | Decision 4: an unchanged field is not a change | Done (you committed it) | You re-ran it |
| w5-dock-grants | worker-heavy (Opus) | `FluxIQUserAccess` grants the panel-assistant endpoints for the person's own threads | Done (one W4 test edit, done by me) | Ran its acceptance set: 33 files, 299 tests passed |
| w5-shared-humanness | worker (Sonnet) | Flow settings on W4's shared humanness control | Done (2 gaps below) | The typecheck below covers its unverified type fix |
| w5-dock | worker (Sonnet) | Dock attachment projectId, panel-thread rename and delete, U5 fixture, decision 2 | Partial (decision 2 blocked) | I traced the blocker myself: only the dock mounts the chat, and it always uses the panel port |

Reports in `reports/w5-hosted-panel/`: `w5-audit-lists.md`, `w5-unchanged-fields.md`, `w5-dock-grants.md`, `w5-shared-humanness.md`, `w5-dock.md`.

**Grant (`packages/fluxiq/src/platform/iam/predefined/user-access.ts`, statement `OwnPanelAssistant`):**
- The panel-assistant actions are named one by one: ListPanelThreads, GetPanelThread, GetPanelThreadAttachment, OpenPanelThread, RenamePanelThread, DeletePanelThread, SendPanelMessage, AnswerPanelAsk, GetPanelAssistantAllowance.
- They apply only on the caller's own user FRN, and only with `fluxiq:RequestOrigin = panel`, so IAM itself refuses a paired browser.
- `set-panel-assistant-allowance` is not granted: it changes one workspace-wide value.
- `FluxIQReadOnlyAccess` is unchanged: a read-only person reads their own threads and the allowance.
- Tests:
  - every granted action is allowed for the person;
  - a second person's read, attachment, rename, delete, send and answer on another's thread each answer as a missing thread, and the thread is untouched;
  - a paired browser is refused every endpoint by IAM.
  - A mutation run (origin condition removed) makes the paired-browser tests fail, as it should.

**Dock (`apps/web/src/features/chat-widget/`):**
- A panel thread's attachment is now read through `get-panel-thread-attachment`; project threads keep `get-conversation-attachment`.
- The docked Assistant's port now implements `renameThread` and `deleteThread` through `rename-panel-thread` and `delete-panel-thread`.
- U5 now passes honestly: the seed already planted the proposal turn, and the spec selects the small project.

### Integration changes I made
- `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/thread-changes.test.ts` (W4's), which you authorised:
  - removed the case that pinned "FluxIQUserAccess alone grants no panel endpoint"; the new `user-access.test.ts` beside it pins the grant;
  - corrected the comment of its `ownPanelThreads` helper, which the service-profile isolation case still uses without a panel origin.
- `docs/architecture/platform.md`:
  - the Authorizer `filter` paragraph now says one row per list request;
  - the Known-gaps audit bullet no longer claims one row per hidden item, and names the untested two-process `hid` migration.
  - The docs-links rule passed.

### Commands run and observed results (Core worktree)
- `node --test scripts/build-cache/tests/registry.test.mjs` -> pass 11, fail 0: test 5 cleared after your dev merge.
- `pnpm --filter fluxiq exec vitest run src/platform/iam src/programs/automation-studio/api/panel-assistant src/programs/_shared/iam` -> 33 files, 299 tests passed (after my W4 test edit; 1 failed before it).
- The workers' acceptance runs, with results reported, not re-run by me:
  - w5-dock: `vitest run src/features/chat-widget src/tests` -> 19 files, 137 passed; the chat-widget e2e runner, with a fresh build -> 12 passed, 0 rounds failed, U5 included; no t901 process left.
  - w5-shared-humanness: `vitest run src/features/automation-studio/settings src/tests` -> 16 files, 99 passed; no panel-local range input left.
  - `pnpm structure:check` -> passed (537 warnings, 917 baselined).

### Typecheck
- `pnpm --filter @fluxiq/web check` (heavy slot) -> passed, 0 errors (it includes the humanness worker's unverified type fix).
- My own narrow runs after the last change:
  - `vitest run src/features/automation-studio/settings` -> 13 files, 87 tests passed.
  - `vitest run src/features/chat-widget src/tests --no-file-parallelism` -> 19 files, 137 tests passed.
  - Two earlier parallel attempts ended with "Worker exited unexpectedly" while free memory swung to 1.1 GB. The vitest worker crashed; no test failed. The serial run above, started at 2.8 GB free, passed.

### Open questions for the lead
1. **Decision 2: no panel screen shows project threads.**
   - The dock (`AssistantDock`, through `ProgramChatWidget`) is the only chat mount in the panel. It always passes `panel`, so `program-chat-transport.ts` uses the panel port, which lists only `list-panel-threads`, and `answer-panel-ask` takes only grant or deny.
   - The project port (`transport/conversation-port.ts`, with list, rename and delete) is used only when the chat mounts without `panel`. Nothing in the panel does that.
   - So the build and run chats' choice and open asks cannot be raised or answered in the panel.
   - What is missing: a screen or dock mode that lists the open project's threads (for example, the dock's conversation list showing them beside the person's panel threads, through the project port's `listAllThreads`) and answers them through the conversation `answer-ask` endpoint.
   - Recommendation: the dock lists both, grouped by project. That is a product choice, so it is yours.
2. **A panel turn's proposal reference carries no project.** The dock therefore reads a proposed Flow change in the project open in the top bar, which is "the proposal's real projectId" only when that project is open. Root fix in Core (W4): the panel assistant writes the project into the turn's reference, and the dock then sends it.
3. **W4's `set-panel-assistant-allowance` declares `selfUser()` but changes a workspace-wide value.** It should declare the workspace resource. Otherwise any custom policy granting it on a person's own user lets that person change everyone's allowance (W4's source).
4. **A hosted user's Settings still calls `secret-keys/get-assistant-model`,** which acts on the workspace and is refused to users. The allowance now loads; the model choice does not. Separately, whether a user who does not own the workspace's assistant key can get a model to send with is unchecked.
5. **Shared humanness control (W4's):**
   - The panel has no source for the person's starting humanness, so the control reads "Uses your starting value (0)". Where does the person's starting value live in Core (W2's I1)?
   - The control also says "Saved." on a draft change in a form that saves later. It needs an option to suppress or reword that.
6. **Case-only username changes.** `update-user` compares exactly, so an account holder resending their email in different case is still refused. Normalising usernames when stored is a broader change; say if you want it.
7. **Partly hidden lists.** A partly hidden list shows as "Denied" plus "N items hidden" in Activity. The row names no hidden item FRNs, which keeps it compact.

### Files for the commit (uncommitted since fd5fa4e17 and the t900 merge)
- **Grant:**
  - `packages/fluxiq/src/platform/iam/predefined/{user-access.ts,tests/user-access.test.ts}`;
  - `packages/fluxiq/src/programs/automation-studio/api/panel-assistant/tests/{user-access.test.ts (new),thread-changes.test.ts}`;
  - `docs/architecture/platform.md`.
- **Dock:**
  - `apps/web/src/features/chat-widget/{attachments/read-attachment.ts,attachments/tests/panel-attachment-port.test.ts,ProgramChatWidget.tsx,transport/panel-conversation-port.ts,transport/tests/thread-changes.test.ts}`;
  - `apps/web/e2e/chat-widget.spec.ts`.
- **Humanness:** `apps/web/src/features/automation-studio/settings/humanness/**`.

## Checked point 6: project threads in the dock, members and the assistant, username case, starting humanness, workspace key choices

**Outcome.** Partial.
- **Waiting on t898:** item 4, the mirrored route test, waits for t898 in this tree, as you agreed.
- **Done and uncommitted:** everything else from your last four messages. The validation results are under "Validation" below.

### Per-worker summary

| Worker | Tier | Brief | Outcome | What I verified |
| --- | --- | --- | --- | --- |
| w5-dock-projects | worker (Sonnet) | Decision 1: the dock lists the open project's threads with the person's own, and the choice and open-ask specs on them | Done | Read its routing; the e2e run below covers its specs |
| w5-member-assistant | worker-heavy (Opus) | Decision 2: members read the assistant model and send on the workspace key | Partial (1 test edit outside its paths) | Done by w5-iam-round3 (task 1) |
| w5-username-case | worker-heavy (Opus) | Decision 3: case-insensitive usernames in the unchanged-field and uniqueness checks | Done | Regenerated the catalog its summary change drifted; shrank the baseline |
| w5-iam-round3 | worker-heavy (Opus) | The escalation-test edit; members read the allowance on the workspace; workspace key choices are admin-only; provisioning names `username_taken` | Done (Settings flag wiring done by me) | Wired the flag; validation below |
| w5-starting-humanness | worker (Sonnet) | Starting humanness in the panel; the dock's project name; `draw.ts` wording | Done | Validation below |

Reports in `reports/w5-hosted-panel/`: `w5-dock-projects.md`, `w5-member-assistant.md`, `w5-username-case.md`, `w5-iam-round3.md`, `w5-starting-humanness.md`.

**Decision 1 (dock):**
- A composed port, `features/chat-widget/transport/composed-conversation-port.ts`, lists the person's own panel threads and the open project's threads. It sends every call (read, send, answer, rename, delete, attachment) to the panel or the project port by the thread's origin.
- A project thread's ask is answered through the conversation `answer-ask` path, with choices and words.
- The shared list has no groups, so project threads read "<project name> · <title>". The dock now passes the project's name, and the prefix is stripped on rename. The list sorts by waiting, then newest, so "own first" holds only in the read.
- Real groups need W4 (details in `w5-dock-projects.md`).
- New specs in `e2e/chat-widget.spec.ts`: a destructive choice ask settles on one press with no PIN, and an open ask takes words. Both are seeded in the small project.

**Decision 2 (members and the assistant):**
- **Read:**
  - `FluxIQUserAccess` gains `WorkspaceSettingReads`: `secrets:GetAssistantModel` on the workspace, listed in `IAM_USER_WORKSPACE_SETTING_READS`.
  - The answer adds `assistantProvider`, and never a key's name, value or seal.
  - Settings shows a member the provider and model as text, with no key controls.
- **Send:** the cause was the key release in `runtime/conversations/assistant/model/key-model-source.ts`, which released the owner's key as the member and so was refused. The fix:
  - Secret Keys records who chose the default and assistant key.
  - A key its owner chose for the workspace is released server-side, for that one call, under the owner's live panel unlock.
  - A locked key gives the typed `secrets.locked` answer, with no other key tried.
  - A key its owner did not choose is never used.
- Tested with a fake provider (no model call):
  - owner, member and read-only person get the same model answer;
  - an outsider is refused;
  - a member cannot reveal, change, rotate, delete, pick or list the key.

**Decision 3 (username case):**
- One comparison, `usernameKey`, is used by sign-in, update-user's unchanged-field check and a new uniqueness check in the service. It covers create-user, update-user and provisioning's `createAccount`; before, nothing stopped two people sharing a name.
- `identity.username_taken` is refused on a case-only collision with another person.
- Provisioning now answers `email_taken` (in-process) or `exists` plus the account-exists mail (over HTTP) when a person without an account already signs in with that email, before anything is written.
- **Re-casing your own name:** dropped for account holders, written as sent for people without an account.
- **Names already stored that differ only by case** are not rewritten. An update that writes no name works, and moving onto someone else's name is refused. Today only the first stored person can sign in by such a name; a test pins it.
- **Later, storage normalisation with a migration:**
  - store a `usernameKey` beside `username`;
  - a load-time migration fills it in and reports each group sharing a name, with no silent merging;
  - sign-in becomes a lookup by key that refuses more than one match;
  - first settle the key (trim, NFKC and full case folding, matching provisioning's `normalizeEmail`).
  - Details are in `w5-username-case.md`.

**Your allowance item and the workspace key choices (w5-iam-round3):**
- `FluxIQUserAccess` allows `studio:GetPanelAssistantAllowance` on the workspace. Setting the allowance is refused on the workspace and on any user.
- **When t900 merges:** remove the allowance read from `OWN_PANEL_ASSISTANT` in `user-access.ts`.
- A known problem, fixed: a member could make their own key the workspace default for everyone. `set-default-key` is now decided on the workspace, as `set-assistant-model` already was. Owners and admins can set both; members and outsiders are refused, and the settings stay unchanged. Managing your own key is unchanged.
- The escalation test skips only the listed workspace setting reads, and still refuses every other workspace action (29).

**Starting humanness (your W2 message):**
- Settings has a "Starting humanness" section (`features/settings-page/humanness/`), using W4's shared control: read through `get-my-preferences`, saved through `update-my-preferences`, with None clearing to `null`.
- Flow settings shows "Uses your starting value (N)" from the same read.
- Until t898 lands, the endpoints are missing, so the section shows as unavailable rather than looping on errors. Built and tested against your API names, with mocks.
- The panel has no client User type, so the value comes from `get-my-preferences` rather than a user prop.
- `draw.ts` no longer prints a raw proposal reference; it says in plain words that the proposed change could not be read here.

### Integration changes I made
- `apps/web/src/app/(panel)/settings/page.tsx`: async; passes `mayChooseForWorkspace={mayChooseWorkspaceKeys(auth?.role.permissions ?? [])}` to `SettingsPage`, which hands it to `useSettingsData`. So Settings no longer offers members "make default" or the assistant-key choice. The flag uses `secrets.manage`, the server's local rule.
- `packages/fluxiq/src/platform/iam/catalog/generated/assistant-tools.generated.json`: regenerated with `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1` (the `update-user` summary changed). `generated-module.test.ts` passes, 2/2.
- `.structure-baseline.json`: `pnpm structure:baseline` removed the `service.ts::classes` entry (917 to 916).

### Validation (Core worktree)
- The workers' reported runs:
  - Core identity-access: 139 passed.
  - IAM, secret-keys, `_shared`, provisioning and panel-assistant: 891 of 893 passed. The 2 failures were the catalog drift (fixed above) and a 15 s timeout under load in `unlock-cross-user` (passed alone, 63/63).
  - Web settings-page: 400 passed. Chat-widget and `src/tests`: 145 passed. The starting-humanness set: 267 passed.
- Mine, in the heavy slot in order: the library build, `pnpm --filter @fluxiq/web check`, the full `run-isolated.mjs` (now including the chat spec). Results under "Validation result".
- Memory-rule breach: my catalog regeneration (one small test file) started at 0.58 GB free.

### Validation result
- Library build (heavy slot) -> exit 0.
- `pnpm --filter @fluxiq/web check` -> first 1 error, then 0 errors.
  - The error, TS2379 in `ProgramChatWidget.tsx`: `openProject` passed a project name that may be `null` where `undefined` is expected.
  - Fix: `name: latest.current.projectName ?? undefined`.
- Full `node apps/web/e2e/support/run-isolated.mjs` (production build passed, 269 s; 1,099 s in all):
  - read-only 98 passed; assistant 3; flows 5;
  - `data-collection` 6 passed, 1 skipped (expected); `task-automation` 7;
  - chat-widget: 6 passed, then the new project-thread listing test failed, which stopped the serial file.
- **Worker w5-dock-projects-fix (Sonnet).** Report: `reports/w5-hosted-panel/w5-dock-projects-fix.md`.
  - Cause: the spec, not the product. Opening a project changes the chat's owner and closes the narrow dock's thread drawer, so the row existed but was hidden.
  - Fix: the spec reopens the list after opening the project. No assertion was weakened and no product code changed.
  - `run-isolated.mjs --only e2e/chat-widget.spec.ts --skip-build` -> exit 0, 15 passed. That includes the project-thread choice and open-ask tests and U5. The build was current: only the spec changed after it.
  - `vitest run src/features/chat-widget src/features/panel-shell` -> 21 files, 150 tests passed.
- `pnpm structure:check` -> passed (537 warnings, 916 baselined).
- No t901 server or node process remains.

### Open questions for the lead
1. **Real groups in the shared conversation list (W4).** Until then, project threads carry a "<project> · " label.
2. **The first key counts as shared.** In an organisation workspace, a member who adds the first key has it shared with everyone. The stricter option needs the owner's explicit choice, but then members cannot send until the owner chooses once. Confirm the current rule.
3. **The locked wording** says "your model key" even for a member. Changing it is a contracts change.
4. **Re-casing your own name** is written as sent for people without an account. Making it dropped for everyone is one line, but then nobody can correct a name's case.

### Files for the commit (uncommitted since 9f937062c)
- **Dock:** `apps/web/src/features/chat-widget/**` (the composed port, read-attachment, ProgramChatWidget, flow-graph-diff/draw.ts, tests), `apps/web/src/features/panel-shell/dock/**`, `apps/web/e2e/chat-widget.spec.ts`, `apps/web/e2e/support/seed-chat-threads.mjs`.
- **Members:**
  - Core `platform/iam/predefined/**`;
  - `programs/secret-keys/**`;
  - `runtime/conversations/assistant/model/key-model-source.ts`;
  - `programs/automation-studio/api/panel-assistant/tests/workspace-key.test.ts`;
  - `programs/_shared/tests/api-iam-escalation.test.ts`;
  - `platform/provisioning/{context,operations/create-account.ts,types.ts,tests/username-taken.test.ts}`;
  - `platform/iam/catalog/generated/assistant-tools.generated.json`;
  - `docs/architecture/platform.md`.
- **Usernames:** Core `programs/identity-access/**`, `docs/architecture/package-boundaries.md`.
- **Settings:** `apps/web/src/features/settings-page/**`, `apps/web/src/app/(panel)/settings/page.tsx`.
- **Humanness:** `apps/web/src/features/automation-studio/settings/{FlowSettingsView.tsx,settings-host.ts,humanness/**}`.
- **Audit:** `.structure-baseline.json`.
