# paired-route (t928, key-backend): a paired client saves, replaces and removes its person's model key

## Outcome

Done. A paired client (a real pairing token from the real client gateway) can call Secret Keys'
`save-model-key`, `replace-model-key` and `remove-model-key` with no password, PIN or code. IAM alone
decides each one: `secrets.manage`, Write, on the workspace. An administrator's client succeeds. A
member's client, whose role lacks `secrets.manage`, is refused, and nothing is written. Every other key
write stays refused to a token before its handler runs. The panel route is unchanged.

One follow-up is needed outside my paths, in `apps/web` (see Open questions 1). Until it lands, a
**hosted multi-tenant** server's pre-check still refuses these three endpoints to a token.

## What changed and why

All changes are under `packages/fluxiq/src/server/program-route/` in the Core tree
`fxwork/t928/!FluxIQ`, on branch `task/t928-key-backend`. Nothing was committed.

- **`program-route.ts`**
  - `PAIRED_CLIENT_ENDPOINTS["secret-keys"]` now has `snapshot`, `save-model-key`,
    `replace-model-key` and `remove-model-key`. The allowlist stays the guard. `create-key`,
    `update-key`, `rotate-key`, `delete-key`, `set-default-key`, `set-assistant-model`, `offer-key` and
    `reveal-key` are still not on it.
  - `PAIRED_CLIENT_PERMISSIONS` gains `secrets.manage`. The comment explains that it reaches no other
    key endpoint, because the allowlist names none and is checked before IAM. Only a role that holds
    `secrets.manage` keeps it, so a member's client is refused exactly as the member's login is.
  - **Classification rule.** I added a new frozen constant,
    `PAIRED_CLIENT_IAM_DECIDED_ENDPOINTS = { "secret-keys": [the three] }`.
    `isPairedClientClassification(classification, programId?, endpoint?)` admits `read` and
    `authoring` as before. It admits `program-gated` only when the program and endpoint are named and
    appear in that list.
    - This is narrower than admitting `program-gated` in general. Other `program-gated` endpoints do
      run a credential check (reveal-key asks for the password), and a later allowlist entry must not
      reach them on the classification alone.
    - A caller that names no endpoint gets the old answer, so `program-gated` is refused.
    - The reasoning is in the doc comment and in the route's header comment ("Nothing destructive,
      ever" now names this one exception and the user rule behind it).
  - **Request narrowing (new).** A token's body is rebuilt from the fields each handler reads:
    - save: `provider`, `value`, `name`;
    - replace: `value`;
    - remove: nothing.

    Other keys are ignored rather than refused, so an older client's `authorizationPassword` or PIN
    field does not break the call. Malformed values go on as sent, for the handler to refuse in its own
    words.
  - **Response projection (defence in depth).** An answer to one of the three is rebuilt as exactly
    `{ modelAccess }`, through `readModelAccessState` and then `pairedClientModelAccessState`, so it
    carries no key id. A state that does not read becomes `{}`. A refusal keeps only its `error` and
    `errorCode`. The snapshot's projection now uses the same `pairedClientModelAccess` helper, with
    unchanged behaviour.
- **`handle-program-request.ts`**: the classification preflight now passes `programId` and `endpoint`
  to `isPairedClientClassification`.
- **`tests/program-route.test.ts`** (unit tests):
  - the allowlist now includes the three, and every other key write is still absent;
  - the new classification rule, including other `program-gated` key endpoints, the wrong program,
    no endpoint named, and `destructive` or unknown classifications, all refused;
  - the actor's permissions now include `secrets.manage`;
  - narrowing and projection of the three.
- **`tests/paired-model-key-writes.test.ts`** (new). It runs through `handleProgramRequest` with the
  real composition from `RuntimeAccessFixture` (disk stores, a real `pair()` token, the real registry
  and IAM on the local profile):
  1. An admin's paired client saves (sending stale password, PIN and authSession fields), replaces and
     removes its key, all with 200. Each answer's payload is exactly `{ modelAccess }`. The raw body
     never holds the key id or a value. `authorizeSessionCredentials` is never called, and the
     session-unlock count does not change across the writes.
  2. A `member` role (the four other paired permissions, without `secrets.manage`) pairs. All three
     writes are refused with 403, and the stored keys are unchanged.
  3. `set-default-key`, `offer-key`, `reveal-key`, `create-key`, `rotate-key`, `delete-key` and
     `set-assistant-model` by token all get 403 with "not available to a paired client", and
     `runtime.api.call` is never reached.
  4. The panel cookie route: save answers with the key id, `update-key` still works by cookie, and
     remove leaves `no_key`.

## Commands run and observed results

Every command ran inside `heavy-slot.mjs run paired-route`.

- First run, the new test plus `program-route.test.ts`: 73 passed and 1 failed.
  - The failure was `activeSessionUnlockCount()` returning 1 where the test expected 0.
  - The count is `heldKeys.sessionCount()`. On the disk-backed fixture, the sign-in itself holds a
    session before any route call; the two-step test's in-memory runtime does not.
  - I changed the assertion to compare against the count taken just before the token's writes. That is
    the property the test means. If the writes held an unlock, it would still fail.
- `npx vitest run src/server/program-route src/programs/secret-keys --poolOptions.forks.maxForks=2 --poolOptions.forks.minForks=1`
  (from `packages/fluxiq`): **Test Files 38 passed (38), Tests 427 passed (427)**, exit 0. This
  includes `paired-model-key-writes.test.ts` (4/4), `program-route.test.ts` (70/70) and
  `two-step-writes.test.ts` (3/3).
- `pnpm --filter fluxiq check`: exit 0. tsc `--noEmit` rebuilt ("inputs changed: packages/fluxiq") and
  printed no errors.
- `node scripts/structure-audit.mjs` (Core root): **structure-audit: passed (550 warning(s), 914
  baselined)**, exit 0. `program-route.ts` has two advisory warnings that were already there before my
  change: 765 lines against a 400-line advisory threshold (it was 674), and 12 exported values (I added
  no export).

Logs are in my scratchpad: `paired-route-vitest.log`, `paired-route-check.log` and
`paired-route-audit.log`.

## Not verified

- **Hosted multi-tenant path.** The `apps/web` pre-check at
  `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts:38` is outside my paths and was not
  run (see Open questions 1).
- **The `service` IAM profile** (hosted). The new test runs on the `local` profile. On `service`, the
  registry narrows a paired client by its permissions and its person's policies. The admin policy
  allows `secrets:*Model*Key`, but I did not test it.
- **The extension's live save from its settings screen.** I ran no browser.
- The member test checks 403 and that nothing was written. It does not assert IAM's exact refusal text
  ("Permission required: secrets.manage"). The allowlist and classification both pass for these
  endpoints, so the 403 can only come from the registry's IAM decision.
- **The chat assistant.** I checked that `secrets.manage` in the cap does not let it reach
  `set-default-key` or `set-assistant-model` (both assistant-callable): the panel-assistant endpoints
  refuse a `paired-client` actor (`programs/automation-studio/api/panel-assistant/register.ts:88`). I
  confirmed this by reading the code; no test covers it.

## Open questions or contradictions found

1. **`apps/web`, one line, required for hosted multi-tenant.**
   `apps/web/src/app/api/programs/[programId]/[endpoint]/route.ts:38` calls
   `isPairedClientClassification(classification)` with no endpoint. Under multi-tenancy it therefore
   refuses the three model-key writes before `handleProgramRequest` runs. The fix:
   `!isPairedClientClassification(classification, programId, endpoint)`. It compiles today unchanged,
   because the new parameters are optional; I chose that so `apps/web` does not break, and it fails
   closed until updated.
2. **Docs.** `docs/architecture/automation-studio/client-gateway.md` (around line 567, "a token call's
   answer is projected") and the allowlist description there should name the three model-key writes,
   their narrowing and their `{ modelAccess }` answer. Docs are outside my paths.
3. **`programs/**`: no change needed.** The `program-gated` doc in `_shared/api.ts:43-45` still says
   the program "runs its own, stronger credential check". The key-writes report already flagged this
   for its owner. The route now carries a named exception list rather than relying on that wording.
4. **Copies of the permission list.** `programs/_shared/key-access/authority.ts:19` and
   `programs/_shared/tests/iam-registry-fixtures.ts:59` still hold the four-permission list. The
   key-writes report says those copies only build the use-authority and test actors; I left them, since
   they are outside my paths.
