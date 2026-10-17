# install-core-lead report (t707): the five first-run Core defects, then the first automation again

Written as the work lands. Tree `fxwork/t707` (Core `!FluxIQ` on
`task/t707-install-core-fixes` at `76d66fe8`, extension beside it at `0291187b`).
Defects are those in `package-lead.md`, "Core defects".

## C1 `/get-started` says "The FluxIQ runtime did not answer" on a healthy runtime

- Confirmed: `apps/web/src/lib/fluxiq.ts:58` sends `clientGatewayError: null`
  when the gateway started cleanly; the onboarding reader's `validGateway`
  (`features/automation-studio/onboarding/useOnboardingReadings.ts:85`) accepted
  only a string or a missing field, so the whole healthy reading was rejected
  as malformed and step 1 showed the failure text, blocking steps 2-3.
- Fix: the reader accepts `null` (still rejects any other non-string); the
  shared snapshot type (`features/automation-studio/clients/client-model.ts`)
  now says `string | null`, which is what the route sends.
- Test (fail-first): `onboarding/tests/useOnboardingReadings.test.tsx`
  "accepts the healthy runtime summary the web route sends, whose gateway error is null".
  Before the fix: `Tests 1 failed | 32 passed (33)`. After:
  `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/onboarding/tests src/features/automation-studio/clients`
  -> `Test Files 5 passed (5)`, `Tests 55 passed (55)`.
- Not addressed: the report's side note that the page renders without the
  app's layout styling.

## C2 approving a pairing whose browser disconnected / C3 commands sent to that dead session

Worker report: `install-core-c23.md` (fail-before and pass-after output there).
- C2 confirmed at `packages/fluxiq/src/client-gateway/service/pairing-flow.ts` `complete()` (no status
  check). Now: `lifecycle.ts` `disconnect()` withdraws the session's unapproved challenges
  (`pairings.ts` keeps the code until it would have expired, so a late click is told why); `complete()`
  refuses a session that is disconnected or not `pairing_required` with `pairing.client_disconnected` /
  `pairing.not_waiting` before any trust is minted, and revokes the trust if the browser left while it
  was being saved. The approve route answers 409 with the message; `GlobalClientGatewayPairing.tsx` keeps
  the notice shown.
- C3 confirmed at `packages/fluxiq/src/runtime/client-gateway-transport.ts` `selectSession`. Now only
  `ready` sessions without `disconnectedAt`, newest first; `sessions.ts` `requireReady` and
  `findReadyByTrustedClient` refuse disconnected sessions, so a command to one fails at once.
- Lead review: read the full diff; matches the claim.

## C4 Get started creates domain-less projects

Worker report: `install-core-c4.md`.
- Confirmed: `/get-started` never resolved a domain, so the start buttons opened Studio without
  `domainId` and `packages/fluxiq/src/programs/automation-studio/api/handlers/projects.ts:72` stored
  `domainId: null`.
- Fix (`apps/web/src/app/get-started/page.tsx`, new `resolve-setup-domain.ts`, `SetupDomainChoice.tsx`):
  keep an installed requested domain; else redirect to the runtime's active domain or the only installed
  one; several installed and none active -> a chooser; none installed -> stays global. No domain id is
  hard-coded in Core.
- Open, not fixed (outside the defect as reported): Home's global Automation Studio entry can still
  create a domain-less project.

## C5 a key added during a sign-in stays locked until the next sign-in

Worker report: `install-core-c5.md`.
- Confirmed: `programs/secret-keys/runtime/service.ts` `createKey` zeroed the freshly derived key and
  never gave it to the creator's session; sign-in `unlockSession` unlocks only keys that exist then;
  `rotateKey`/`updateKey` revoked the person's own hold too.
- Fix: `api/handlers.ts` passes the caller's own verified live session (same id and user as the actor);
  the service holds the new key in that session's unlock, bounded by its expiry, or unlocks the session
  once with the password just verified when it held nothing.
- Lead follow-ups: removed the worker's `validateSession(...).catch(() => null)` (the audit's
  failure-as-empty rule; an unknown session already reads as null, a store failure now fails the request);
  named the best-effort reason on the post-write unlock catch (swallowed-failure rule). The chat's locked-key
  line said "unlock your keys in FluxIQ" with no way to do so; it now says to sign out and in again
  (`automation-studio/runtime/conversations/commands/progress.ts`, `instructions/interpret.ts`), with an
  assertion added to `commands/tests/extension-chat.test.ts` (failed before: `Tests 1 failed`).

## Lead validation (Core, t707 tree)

- `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/conversations src/programs/secret-keys src/client-gateway src/runtime/tests/client-gateway-transport.test.ts`
  -> `Test Files 56 passed (56)`, `Tests 451 passed (451)`.
- `node scripts/build-cache/cli.mjs contracts:build fluxiq:build client-gateway-websocket:build` -> fluxiq built (135 s).
- `pnpm --filter @fluxiq/web exec vitest run src/app/get-started src/app/api/client-gateway src/app/tests/GlobalClientGatewayPairing.test.ts src/features/automation-studio/onboarding src/features/automation-studio/clients`
  -> `Test Files 11 passed (11)`, `Tests 105 passed (105)` (the real config, Core build current).
- `node scripts/build-cache/cli.mjs --parallel contracts:check fluxiq:check web:check` -> all three steps
  completed (`fluxiq:check` 87 s, `web:check` 94 s), exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (397 warning(s), 1154 baselined).`
  (Before the lead's fixes: 3 violations - my packed C1 test line, and the two C5 catches.)

## First automation, repeated live (worker report `install-core-live.md`)

Headed Chrome 155, fresh profile, isolated ports 3707/4707 (runtime, gateway), 3717 (scenario
server), 9357 (CDP, observation only); t707 Core web build served with `next start`, fresh root,
host module and release ZIP built from this tree (`fluxiq-web-extension-chrome-0.1.0.zip`, 712440
bytes, 14 files). Installed by Load unpacked, as a person.
- C1 proved live: Get started step 1 "Done" on the healthy runtime.
- C4 proved live: "Describe an automation" opened Studio with `domainId=web-automation`; the panel
  chat accepted the project.
- C5 proved live: the key added in this sign-in, without signing out, served the build's model calls.
- C3 proved live: one `ready` session, no orphan; every browser command went to it.
- C2 guard not exercised live (no socket dropped during approval; approval at ~70 s succeeded).
- The one paid build (company-website, apprentices task): ran 11 min and ended honestly with a draft
  and no promoted Flow - the builders never scrolled the team grid far enough to reveal its hidden
  "Show more people" control (the guard refused the identical failing clicks). Cost about $0.10-0.11
  of the $0.25 ceiling, from the panel's allowance and spend figures; no balance or billing error.
  This is a build capability gap on a deliberately hard page, not an install defect.
- Not reached: the zero-call rerun (no Flow was promoted). Not retried: one paid build only.

## G1 (new, found live, fixed): Get started step 2 never passes while paired

- Cause: `onboarding/useOnboardingSources.ts` read only the client-gateway snapshot endpoint, which by
  design sends counts and empty `sessions`/`pairings` (`packages/fluxiq/src/programs/automation-studio/api/handlers/client-gateway.ts:17-20`);
  `onboarding-steps.ts` `pairingCheck` counted that empty list. It also counted any session, connected
  or not.
- Fix (worker report `install-core-g1.md`): new `onboarding/gateway-snapshot.ts` composes the snapshot
  with the paged session and pairing lists (a failed list read fails the reading, never reads as empty);
  `pairingCheck` counts only `ready` sessions without `disconnectedAt`. Lead fixes: an
  exactOptionalPropertyTypes error in the new file (`web:check` failed), and the `/get-started` page test
  stub, which did not serve the list endpoint (2 tests failed) - it now serves the fixture's lists there.
- `pnpm --filter @fluxiq/web exec vitest run src/features/automation-studio/onboarding src/features/automation-studio/clients src/app/get-started`
  -> `Test Files 10 passed (10)`, `Tests 103 passed (103)`; `node scripts/build-cache/cli.mjs web:check` -> stored, exit 0;
  `node scripts/structure-audit.mjs` (Core) -> `passed (397 warning(s), 1154 baselined)`.
- Not proved live (found after the live run).

## Downstream (extension repository, t707 tree)

- `docs/user/quickstart.md`: dropped the "log out and in after adding a key" step (C5) and pointed
  project creation at Get started's buttons, keeping the Web Automation > Automation Studio route (C4).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (204 warning(s), 638 baselined).`
  No extension source changed, so no extension tests apply.

## Open for the supervisor

- Home's plain Automation Studio entry still creates domain-less projects (outside C4 as reported).
- `/get-started` still renders without the app's layout styling.
- The pairing keepalive line for `docs/architecture/extension-client.md` (from t706) is still owed.
- A zero-call rerun needs a promoted Flow: a second paid build on an easier realistic task.
