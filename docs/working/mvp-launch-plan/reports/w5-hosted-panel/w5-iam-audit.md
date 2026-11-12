# W5 IAM table, activity log, resend limit, cancel-invite race (lane t901, W5): worker report

Worker: w5-iam-audit (Opus). Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t901/!FluxIQ`, branch `task/t901-hosted-panel`. Nothing committed, no branch switched, no server started.

## Outcome

Partial. All four tasks are built and tested inside the owned paths. The acceptance vitest command has one failing test, and that test is in a file I do not own:

- `apps/web/src/features/security/page/tests/security-page.test.tsx`, test "activity > is unavailable in plain words".
- It asserts the old placeholder text "not available yet". The brief asked me to replace that placeholder with the real log, so this assertion can no longer pass.
- The edit it needs is in "Needed outside W5", item 1.

`pnpm structure:check` passes.

## What changed and why

### 1. One IAM table (`lib/app-route-iam/**`, `app/api/accounts/server/iam-contracts.ts`, `app/api/tests/**`)

- **`lib/app-route-iam/contracts.ts`** gained ten entries in total, nine of them new routes or variants:
  - the `person` resource (`{kind:"user", userId: body.userId}`);
  - a `memberChange()` helper;
  - the eight account contracts, unchanged from W5 accounts: `iam:ListMembers`, `iam:InviteMember`, and the six `/api/accounts/member` variants `iam:SetMemberRole`, `iam:DisableMember`, `iam:EnableMember`, `iam:RemoveMember`, `iam:ResendInvite`, `iam:RevokeInvite`;
  - the new `GET /api/security/audit` as `iam:ListAuditEvents`.
  - Every one of these is `callers: { panel: "identity.manage" }`.
  - The header comment explains why.
- **`accounts/server/iam-contracts.ts`** now reads the shared table: `APP_ROUTE_IAM_CONTRACTS.filter(path starts with "/api/accounts/")`. `accountRouteContract` and its tests are unchanged and pass.
- **`contracts.test.ts`**:
  - its resource test now covers the accounts and audit routes;
  - a new test asserts that all nine people/activity entries require `identity.manage` of a panel caller under `iam:` actions.
- **`app-route-calls.ts`** has one call per new key. Member changes target a fixture invitee with a dummy proof.
- **`app-route-fixture.ts`**:
  - `identityAccess.authorizeSessionCredentials` (every re-proof passes) and an invitee in `snapshot`;
  - `getFluxIQWorkspaces` in the `lib/fluxiq` mock (single tenancy, `workspace-main`, `primary().fluxiq`). The real `sessionWorkspaceId` then runs over the fixture's `validateSession` and is not mocked away.
  - `provisioningListenerMock()` (`getPlatformServices`: a store with one pending invitee; provisioning that always succeeds);
  - `platformAuditReaderMock()` (an empty audit).
- **Parity test** (`app-route-iam-parity.test.ts`):
  - `TODAY` rows for all nine keys are `needs("identity.manage")`: admin allowed; viewer `forbidden: Permission required: identity.manage`; both paired tokens `unauthenticated`. These run on `local` and again on `self-hosted`.
  - A new test checks that every people/activity route answers **200** for the admin. `outcome()` reads any status other than 401/403 as "allowed", so without this test a 500 would have passed as allowed.
- **Service test** (`app-route-iam-service.test.ts`), for each of the nine keys:
  - the admin's `FluxIQAdministratorAccess` is allowed;
  - alice's and bob's `FluxIQUserAccess` get `forbidden: Not authorized: <action>`;
  - the admin's paired token gets `unauthenticated`.

### 2. Activity log: `GET /api/security/audit` (`app/api/security/**`, `features/security/activity/**`)

**Route.** `app/api/security/audit/route.ts` is thin. The work is in `app/api/security/server/`:
- `read-activity.ts` (the handler);
- `authorize-audit-route.ts`;
- `belongs-to-workspace.ts` and `frn-scope.ts` (tenancy);
- `shape-activity-entry.ts` (the allow-list);
- `parse-cursor.ts` and `format-cursor.ts`;
- `deps-for-request.ts`, `platform-audit-reader.ts`, `types.ts`, and a barrel.

**Order of checks:**
1. Panel cookie session (401 without one; a paired token is never a caller).
2. IAM: `authorizeAppRoute` with `iam:ListAuditEvents` on the workspace, decided and audited by the registry like the sibling routes. A refusal is 403 `forbidden` with the registry's sentence.
3. Cursor validation (400 for anything this route did not write).
4. Only then are the workspace, the audit and the name lookup resolved. A refused caller never opens the audit; tests assert zero reads.

**Tenancy scoping (`belongsToWorkspace`, fail-closed).**
- The workspace comes from `sessionWorkspaceId` on the server, never from the request.
- A record is shown only when all of the following hold:
  - no resource names another workspace, and no resource FRN is unreadable;
  - **and** either:
    - the principal is a person or role of this workspace (`frn:fluxiq:iam:<ws>:...`); or
    - the principal is the platform itself (`platform-admin`, `in-process`, a service identity) and some resource names this workspace. Under single tenancy that platform record is shown even when it names no workspace, because there everything is the one workspace's.
- Names are resolved only for people with a membership in this workspace. Under single tenancy only, the fallback is the Identity Access display name. Anyone else shows as "Someone no longer in this workspace", or as "account <id>" when a resource.

**Field allow-list.** Each entry is built field by field: `{ at (ms), who (name), action, outcome: "allowed" | "denied", resources (labels) }`.
- Never returned: `requestId`, `matched` (policy and sid), `origin`, `ipPrefix`, `via`, `consent`, `category`, and raw FRNs.
- The client also rebuilds each entry from the same five fields (`shapeActivityPage`).

**Paging.**
- 50 entries per page, newest first, in batches of 200.
- The cursor `"<second>.<count>"` names a position only. The tenancy filter applies whatever it says.
- Resuming inside a second reads only that second (`since` = t and `until` = t + 1 bound the read). So a forged huge count can never make one read larger than one second's records; there is a test for this.
- One request looks through at most 2,000 records, then answers what it found with a `next` cursor. That cursor resumes the walk; it does not cut it short.
- Records written later inside an already-read second can repeat an entry on the next page. No entry is lost.

**UI (`features/security/activity/**`).**
- `ActivitySection` takes optional `load` and `now` props. `SecurityPage` still renders it with none.
- Each entry shows who, the action in words (`actionLabel`), Allowed or Denied, the resources, and when (`agoText`).
- "Load more" appends the next page. The other states:
  - no access: "You do not have access to this.";
  - read failure: "Could not read the activity…";
  - nothing recorded: "Nothing has been recorded yet.";
  - all loaded: "That is everything recorded.";
  - a failed Load more keeps the entries already shown.
- It asks once per page load, so a refused person is not re-denied and re-audited on a timer.
- `activity.css` uses `--surface --text --muted --line --accent --danger` only. Everything renders as text; a test checks that HTML in a value is escaped.

### 3. Resend rate limit (`accounts/server/throttle-resend.ts`)

- Uses `lib/form-throttle` `throttleForm` (scope `accounts-resend-invite`) with two keys:
  - administrator and person: at most 3 per 15 minutes;
  - person, whoever resends: at most 6 per hour.
- The keys are user ids, never emails.
- It runs only after the IAM decision and the still-pending check. A refused resend therefore spends nothing; there is a test for this.
- An over-limit resend gets 429 `rate_limited`, a sentence, and `retry-after`. `AccountsResponse` gained optional `headers`, and `toAccountsHttp` passes them through with `cache-control: no-store` kept.
- The panel's existing `outcomeOfAnswer` shows the sentence. I added an assertion for that to `features/accounts/data/tests/data.test.ts`.

### 4. The cancel-invite race (`accounts/server/revoke-invite.ts`, `never-accepted.ts`)

- **Root cause.** "Still pending" was read outside the provisioning queue, and redemption runs inside it.
- **Fix, using only the existing API:**
  1. `disableAccount` through the queue. Once it has run, `redeemAccountLink` refuses with `disabled` (it checks inside the queue), so nothing can accept the invite any more.
  2. Re-read the account and the identity user (`neverAccepted`: email not verified, never signed in, no password configured).
  3. If still never accepted, `deleteAccount` immediate, which ends the link with the account.
  4. If it was accepted in between, `enableAccount` and answer 409 `not_invited`. The person's sessions were revoked by the disable, so they sign in once more.
  5. If the delete is refused, re-enable and pass the refusal on.
- `isPendingInvite` now reads as `status === "active" && neverAccepted(...)`.
- **Tests stage both orders** by running a real `links.redeemWelcome` with the emailed token from inside the provisioning call:
  - acceptance just before the disable: the account is kept and active, and the answer is 409;
  - redemption just after the disable: it is refused `disabled`, the account is deleted, and the link is `invalid_link`.
  - A third test covers a refused delete (re-enabled, refusal passed on).
- **What remains.** Another administrator's concurrent `turn-on` landing between steps 1 and 3, combined with an acceptance in that same window, could still race. A fully atomic fix needs one Core operation; see "Needed outside W5", item 3.

## Self-review (security)

- **AuthZ is server-side and first.** Every refusal path is tested:
  - anonymous: 401, from the parity token rows, which carry no cookie;
  - non-admin on local: 403, the decision is recorded as a deny, and the audit is never opened;
  - service: FluxIQUserAccess and FluxIQReadOnlyAccess get 403; the owner and administrator policies get 200;
  - another tenant's entries: filtered out, including a resource naming another workspace and look-alike workspace ids;
  - fields outside the allow-list are absent, asserted on keys and on the serialized text.
- **Escalation.** The cursor only names a position; scoping and IAM do not depend on it. There is no request field for the workspace.
- **Secrets.** No route returns a token, link, cookie, password, request id, address prefix or policy name. Request bodies are not logged.
- **Residual risks:**
  1. `platform-audit-reader.ts` takes the store from `globalThis.__fluxiqPlatformAudits`, the shared owner map in `server/provisioning-listener/platform-services.ts`. That module exports only the writing sink, and I may not edit it.
     - The reader checks that the store it found sits behind the very sink `getPlatformIamAuditSink()` returned, and throws otherwise.
     - It is still a reach into another module's internals. Item 2 below replaces it.
  2. On `local` and `self-hosted`, registry decisions are not written to the persistent audit. `createWebRuntimeState` in `lib/fluxiq.ts` sets `iamAudit` to null unless tenancy is `multi`.
     - The log there therefore shows the platform's provisioning records only: invites, role changes, turn off/on, removals, link redemptions.
     - It does not show panel route decisions, including its own read. Sibling routes are in the same position.
  3. The per-person resend key lets one administrator use up another administrator's allowance for that same invitee for up to an hour. That is low impact.

## Commands run and observed results

All commands ran from the Core worktree root.

- **Baseline, before any edit:** `pnpm --filter @fluxiq/web exec vitest run src/lib/app-route-iam src/app/api src/features/security src/features/accounts` gave `Test Files 1 failed | 32 passed (33)`, `Tests 1 failed | 263 passed (264)`. The failure was `contracts.test.ts`, as W5 accounts reported.
- **Narrow runs during the work:**
  - `vitest run src/app/api/accounts src/lib/app-route-iam`: only the expected contracts failure while the audit route did not exist yet.
  - `vitest run src/app/api/security`: 2 files, 13 tests passed. After the paging rewrite, 12 tests in `read-activity.test.ts` passed.
  - `vitest run src/app/api/tests src/lib/app-route-iam`: `Test Files 4 passed (4)`, `Tests 68 passed (68)`.
  - `vitest run src/features/security/activity`: 2 files, 11 tests passed.
  - `vitest run src/app/api/security src/app/api/accounts`: `Test Files 8 passed (8)`, `Tests 44 passed (44)`.
- **Final acceptance, same command as the baseline:** `Test Files 1 failed | 50 passed (51)`, `Tests 1 failed | 460 passed (461)`, exit 1. The only failure:

  ```
  FAIL src/features/security/page/tests/security-page.test.tsx > activity > is unavailable in plain words
  Received: "<section …><h2 …>Activity</h2><p class="security-note" role="status">Loading activity…</p></section>"
  ```

- **`pnpm structure:check`:**
  - The first run failed: `[swallowed-failure] features/security/activity/ActivitySection.tsx` line 43, a `.then(…, rejection)` handler. I rewrote it as async/try/catch.
  - Final run: `structure-audit: passed (531 warning(s), 917 baselined).`
  - Two advisory warnings are on my paths: `app/api/accounts/server/` has 20 source files (advisory 15, limit 25), and `app-route-fixture.ts` has 11 exported values (advisory 8, limit 15).
- **Noise:** the app-route tests print `A stored unlock could not be opened (TypeError).` on stderr for every route, including the framework ones I did not touch. I did not investigate it.
- **Memory rule:**
  - One narrow run (`src/app/api/accounts src/lib/app-route-iam`) started with **1903 MB** free. That is below the 2000 MB rule; my check and the run were in the same command. This breaks the rule.
  - Every later run waited for at least 2500 MB first (observed 4607, 2925, 3594, 3707). No heavy-slot jobs were needed.

## Not verified

- No apps/web typecheck, per the brief. Types were reviewed by hand. Test doubles cast with `as unknown as PlatformProvisioning`.
- No live server, browser or real SQLite audit:
  - `platform-audit-reader.ts` and both `deps-for-request.ts` files are not exercised by any test (the parity tests mock the reader and the platform services);
  - the real `IamAuditStore` paging is only mirrored by a memory reader that follows its documented order (newest first, `since` inclusive, `until` exclusive, a later write first within one second).
- The look of `activity.css` in both themes.
- The real `server/provisioning-listener` composition under `multi` tenancy. W5 accounts already noted it is composed `single` on every profile.

## Needed outside W5 (precisely)

1. **`apps/web/src/features/security/page/tests/security-page.test.tsx`** (owned by the parallel worker). Replace the `describe("activity", …)` block with:

   ```ts
   describe("activity", () => {
     it("starts by loading, in plain words", () => {
       expect(renderToStaticMarkup(createElement(ActivitySection))).toContain("Loading activity");
     });
   });
   ```

   Behaviour is covered in `features/security/activity/tests/activity-section.test.tsx`.

2. **`apps/web/src/server/provisioning-listener/platform-services.ts`.** Export a read accessor beside `getPlatformIamAuditSink`, for example:

   ```ts
   /** The platform IAM audit, read only: flushes the sink, then reads. */
   export async function readPlatformIamAudit(query: IamAuditQuery): Promise<IamAuditRecord[]>
   ```

   It would be built on `platformAudit(...)`: `await audit.sink.flush()` (best-effort), then `audit.store.read(query)`. Then `app/api/security/server/platform-audit-reader.ts` becomes `return { read: readPlatformIamAudit }` and the `globalThis` lookup goes.

3. **Optional Core change, `packages/fluxiq/src/platform/provisioning` (not edited).** For a fully atomic cancel, add an operation that inside one queue run:
   - reads the account;
   - refuses `not_invited` unless `status === "active" && emailVerifiedAtMs === null && lastSignInAtMs === null` and identity has no password;
   - otherwise runs `completeAccountDeletion`.

   Two shapes would do: a `revokeInvite { requestId, userId }` operation (action `platform:RevokeInvite`), or a `deleteAccount` precondition `onlyIfNeverAccepted: true`. `revoke-invite.ts` would then be one call. Today's disable-first sequence closes the reported race; this would also close the concurrent turn-on corner.

4. **To persist decisions on local and self-hosted too,** `lib/fluxiq.ts` `createWebRuntimeState` would have to give single-tenancy registries the platform sink. That is a product decision, because it writes an audit row per panel call on local. It is outside my paths.

## Open questions or contradictions found

- The brief requires `src/features/security` to pass, and also requires wiring Activity. The existing page test pins the old placeholder in a file I must not touch. I reported it (item 1) and did not edit it.
- Whether the local/self-hosted activity log should include panel route decisions (item 4). Today it shows only account and provisioning activity there.
