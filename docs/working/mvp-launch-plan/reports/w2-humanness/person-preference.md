# W2 Humanness: a person's stored starting humanness (t898)

## Outcome

Partial. Everything in the brief is built and tested in Core
(`C:/Users/osrs_/FluxStuff/fxwork/t898/!FluxIQ`), but one wiring line is not in place. The
running host does not hand the automation service its reader of the person's value yet. That
line belongs in `packages/fluxiq/src/programs/_shared/runtime.ts`, which I do not own (see
"Open questions"). Until it is added, a run with no request humanness behaves exactly as it
does today: no person level is used.

## What changed and why

### Contracts: `packages/contracts/src/humanness/`
- `resolve.ts`: `HumannessSources` gains a last source, `person?: number | null | undefined`.
  `resolveHumanness` now applies the order run option, task, Flow, request starting value,
  person, then none. A request value of 0 beats the person's value.
- `tests/resolve.test.ts`: one test per step, plus the 0 cases and normalisation.

### Identity-access: `packages/fluxiq/src/programs/identity-access/`
- `types.ts`: `User.startingHumanness?: number` (integer 0-100; absent means none).
- `runtime/preferences/` (new directory with a barrel):
  - `personal-preferences.ts`: class `IdentityPersonalPreferences`, with
    `startingHumanness(userId): Promise<number | null>` (returns null when none is set or the user
    is unknown) and `setStartingHumanness(userId, value: number | null): Promise<number | null>`.
    The setter validates with `humannessSchema`, refuses an unknown or disabled user, and
    persists with the user record. It does not change `updatedAtMs`; see the adversarial note.
  - `stored-starting-humanness.ts`: `storedStartingHumanness(user)` drops a stored value that is
    not a valid level when the record is read back.
  - `without-personal-preferences.ts`: `withoutPersonalPreferences(user)`, which builds the view
    of a user that other people see.
- `runtime/service.ts`: new field `readonly preferences = new IdentityPersonalPreferences({ users,
  ready: load, persist })`. `upsertUser` keeps an existing value. These now return users
  without the value: `snapshot`, `upsertUser`, `updateUser`, `confirmTotp` and `disableTotp`.
  `validateSession` and `authenticate` (the person's own session) carry the value through the
  existing spread. The file is now exactly 800 lines, the audit limit, so the logic lives in
  `preferences/`.
- `runtime/stored-state.ts`: stored users are read through `storedStartingHumanness`. The value
  is persisted by the existing `user:<id>` record write (`persist`, which writes the whole User).
- `api/contracts.ts`: adds the endpoints `getMyPreferences: "get-my-preferences"` and
  `updateMyPreferences: "update-my-preferences"`, the types `GetMyPreferencesRequest = Record<string, never>`,
  `UpdateMyPreferencesRequest = { startingHumanness: number | null }` and
  `MyPreferencesResponse = { startingHumanness: number | null }`, and the error codes
  `IDENTITY_PREFERENCES_ERRORS = { selfOnly: "preferences.self_only", startingHumannessInvalid:
  "preferences.starting_humanness_invalid" }`, sent as the response's `errorCode`.
- `api/handlers.ts`: two registrations.
  - `get-my-preferences`: permission `programs.read`, classification `read`, action
    `iam:GetMyPreferences`, access level Read, `resource: endpointResource.selfUser()`, hidden
    from the assistant.
  - `update-my-preferences`: permission `programs.read`, classification `authoring`, action
    `iam:UpdateMyPreferences`, access level Write, `selfUser()`, hidden from the assistant.
  - Both read and write only `request.actor.userId`. The payload may contain only
    `startingHumanness` (update) or nothing (get). The panel route adds `authSessionId` to every
    identity-access payload (`server/program-route/program-route.ts` `withProgramAuthSession`),
    so that key is accepted only when it equals the caller's session; any other key refuses the
    request with `preferences.self_only`. Update refuses a missing value, a non-integer or a
    value outside 0-100 with `preferences.starting_humanness_invalid`. Null clears the value.
- Permission choice: `programs.read`. The `viewer` role holds only that permission, and every
  role holds it. This follows the precedent of `iam:MintPressGrant`.

### IAM catalog generator output (regenerated with the drift tests' own switches, not by hand)
- `packages/contracts/src/iam/actions.generated.ts`: adds `iam:GetMyPreferences` (Read) and
  `iam:UpdateMyPreferences` (Write, not destructive).
- `platform/iam/catalog/generated/read-only-actions.generated.ts`: adds both actions, because
  both require `programs.read`. `FluxIQReadOnlyAccess` therefore allows them, and the live
  role-parity test reports 0 mismatches.
- `platform/iam/catalog/generated/assistant-tools.generated.json`: two entries for the hidden
  endpoints.

### Run side: `packages/fluxiq/src/framework/automation-service/`
- New `service/person-humanness/` (`person-humanness.ts` and a barrel): class
  `AutomationStudioPersonHumanness`, the narrowest port I could find.
  - `bind(owner, read)` stores a reader `(userId) => number | null | undefined` (or a promise of
    one) in a WeakMap keyed by the service object.
  - `startingFor(owner, requested, actorUserId)` returns
    `resolveHumanness({ startingValue: requested, person })`. It reads the person's value only
    when `requested` is undefined.
  - The framework never imports identity-access, so no new cross-program import or cycle is
    added.
- `service.ts` keeps the same line count, method count and statement packing. It is at its
  baselined 4304 lines and 221 methods, so I changed two existing expressions and added no
  member. Both reach the port with the inline dynamic import the answer-first line already
  uses:
  - Answer-first attempt (~line 1570): `humanness: await (...).startingFor(this, humanness,
    caller.actorUserId)`. The request value wins; otherwise the person's value is used. It is
    the caller from the generate request, never a payload id. Downstream, `run-attempt.ts`
    stores this starting value on a new task with no level, as it already did for a request
    value.
  - Run-session (~line 2489): `automationStudioFlowHumanness(...) ?? await (...).startingFor(this,
    input.humanness, runCaller?.actorUserId)`. The order is Flow, request, person.
    `runCaller` comes from `input.llmExecution`, so the person is known only when the run
    carries `llmExecution`. I did not edit `run-session.ts`.
- Tests:
  - `service/person-humanness/tests/person-humanness.test.ts`
  - `tests/person-humanness/tests/answer-first.test.ts`: the real service, engine and scripted
    model through `laterAttempts`, with no provider calls.
  - `tests/person-humanness/tests/run-session.test.ts`
  - These went in a feature subfolder because `tests/` was at its 25-file limit.

## Commands run and observed results
All commands were run through `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-pref -- ...`.
- `pnpm --filter @fluxiq/contracts exec vitest run src/humanness src/iam`: 12 files, 106 tests
  passed.
- `FLUXIQ_REGENERATE_IAM_CATALOG=1 pnpm exec vitest run src/platform/iam/catalog` (in
  packages/fluxiq): 3 files, 11 passed. It regenerated the catalog. The diff is exactly the two
  catalog entries and the two read-only entries.
- `FLUXIQ_REGENERATE_ASSISTANT_TOOLS=1 pnpm exec vitest run src/programs/_shared/assistant`:
  7 files, 36 passed. The diff is the two hidden entries.
- `pnpm exec vitest run src/programs/identity-access src/platform/iam`: 38 files, 345 passed.
  The live role parity printed viewer and admin `"mismatches":0`.
- `pnpm exec vitest run src/programs/identity-access` (after the final `updatedAtMs` change):
  13 files passed.
- `pnpm exec vitest run` on the new tests plus the neighbouring humanness tests
  (`run-session-humanness`, `generate-answer-first`, `answer-first/attempt/tests/task-humanness`,
  `answer-first/flow-run/tests/humanness`): all passed.
  - The new suites: `my-preferences` 8, `starting-humanness` 5, `person-humanness` 5,
    `run-session` 4, `answer-first` 4 (after a rewrite onto `laterAttempts`).
  - My first answer-first test mocked the attempt over `blankFixture` and failed: the build
    stopped before the attempt. I replaced it.
- `pnpm exec vitest run src/framework/automation-service/tests/person-humanness
  src/framework/automation-service/service/person-humanness src/programs/_shared`: 39 files
  passed.
- `pnpm exec vitest run src/server/program-route
  src/programs/automation-studio/api/panel-assistant`: 5 files passed. Another worker is
  editing these files.
- `pnpm structure:check`:
  - First run: FAIL `[directory-files] framework/automation-service/tests/: 27 > 25`. I moved my
    tests into a subfolder.
  - Final run: `structure-audit: passed (534 warning(s), 969 baselined)`.
- `tsc --noEmit` in packages/contracts: exit 0.
- `tsc --noEmit` in packages/fluxiq: 6 errors, none in files I touched.
  - 4 are in `engine/automation/pacing/tests/humanness-helpers.test.ts`, which another lane is
    editing (`humannessSeed`).
  - 2 are in `programs/automation-studio/api/handlers/tests/flow-settings/tests/flows-humanness.test.ts`
    (`revision`).

## Adversarial note: what a caller can and cannot reach
- A caller cannot name a person. The handlers take the user only from `request.actor.userId`.
  Any payload key other than `startingHumanness` (get: none) is refused with
  `preferences.self_only`, and nothing changes. This covers `userId`, `id`, `user`, `username`,
  nested objects, arrays, strings, the caller's own id, and an `authSessionId` that is not the
  caller's session. Tests cover each case for both an admin and a viewer caller.
- An administrator cannot read or change another person's value through any endpoint:
  - `snapshot` (`programs.read`, so every signed-in person can call it) now returns:
    - users: `id`, `username`, `displayName`, `roleId`, `enabled`, `totpEnabled`,
      `passwordConfigured`, `pinConfigured`, `createdAtMs`, `updatedAtMs` (never
      `startingHumanness`);
    - roles;
    - sessions, by digest, with `userId` and `expiresAtMs`;
    - vault status.
  - `update-user`, `create-user`, `confirm-totp` and `disable-totp` return the user without the
    value.
  - `update-user` and `upsertUser` ignore a `startingHumanness` in their input and keep the
    stored one.
- Setting a preference does not change `updatedAtMs`, so others cannot use the snapshot to see
  when a person changed one. A test covers this.
- The assistant is refused both endpoints (`hidden`, `authorization.forbidden`). Both are
  `read`/`authoring`, so neither needs a PIN or a press grant.
- What remains reachable: the person's own value travels on their own session (`validateSession`,
  `authenticate`), so the panel's own auth context can show it. An operator with
  `database-manager` record access (`ops:GetRecord`, admin only) can read raw `user:<id>`
  records, as for every other user field.
- A stored value that is not 0-100 (hand-edited or legacy) is dropped on read, so a run can
  never receive one.

## Not verified
- The live host wiring, because `runtime.ts` is not mine. No live browser or Lab run was done,
  and no full suites were run.
- The paired-client (extension token) route: `get-my-preferences` and `update-my-preferences`
  are not on the paired-client allowlist in `server/program-route/`, which I must not touch. The
  extension can reach them only through a cookie session until someone adds them.
- IAM `service` profile with `FluxIQUserAccess`: that policy's `SelfService` statement does not
  list the two actions, so a future `user` role would be denied. No `user` role exists today.
  `platform/iam/predefined/user-access.ts` is not mine.
- The `FluxIQReadOnlyAccess` document comment asks for a version bump when the generated
  read-only list changes, and no check enforces it. I did not bump it (not my file).

## Open questions or contradictions found
1. One line is needed in `packages/fluxiq/src/programs/_shared/runtime.ts`, after both
   `automationStudio` (~line 160) and `identityAccess` (~line 211) exist, for example beside
   `automationStudio.bindRuntimeService(runtime)` (~line 323):
   `AutomationStudioPersonHumanness.bind(automationStudio, (userId) => identityAccess.preferences.startingHumanness(userId));`
   It also needs this import:
   `import { AutomationStudioPersonHumanness } from "../../framework/automation-service/service/person-humanness/index.ts";`
2. For run-session, the person is known only when the run carries `llmExecution`.
   `service/run-requests/run-session.ts` sets that only when the caller's key is unlocked. To
   apply the person's value to every signed-in run, `run-session.ts` would need to pass the
   caller's id on the run input (for example `actorUserId: caller.userId`). Then the service
   line would read `input.actorUserId ?? runCaller?.actorUserId`.
3. The brief scoped `service.ts` to "a few lines", but the file is at its baselined 4304 lines,
   221 methods and 44 packed lines, so no line, method or field could be added. The new
   `service/person-humanness/` module (outside the owned list) is how the fallback fits. I
   flag it because the brief said to report any extra file. It is new and touches nobody
   else's file.
4. To add the actions to `FluxIQUserAccess` `SelfService` (`platform/iam/predefined/user-access.ts`),
   add `"iam:GetMyPreferences", "iam:UpdateMyPreferences"`. Their resource is already
   `user/${fluxiq:PrincipalId}`, so the statement's resource matches as written.
