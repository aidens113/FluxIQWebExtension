# Report: w1-fixture-auth-gate

Worker brief: `briefs/wave-1.md`, sections `Brief: w1-fixture-auth-gate` and
`Fixture briefs: common terms`. Corpus rows W18 and W19.

## Outcome

**Done.** The `auth-gate` placeholder is replaced by a sign-in gate with a
protected account page and a session-expiry variant. Every definition-of-done
check passes:
- the scenario-lab build exits 0;
- the fixture's node tests pass 10 of 10;
- its Playwright spec passes 6 of 6, headless;
- the structure audit shows no finding in these files.

Earlier runs failed only because of other workers' in-progress files:
`data-table` octal escapes, a `modal-flows` type error, and the contracts
`dist` re-exporting modules it had not compiled yet. The final runs were made
after those cleared.

## What changed and why

The placeholder is replaced. The export name (`authGateScenario`), id
(`auth-gate`), seed (120), start path (`/scenarios/auth-gate/`), and title
(`Auth gate`) are unchanged. All paths are under `apps/scenario-lab/`.

| File | Lines | Holds |
| --- | --- | --- |
| `src/scenarios/auth-gate/constants.ts` | 16 | Paths, the fixture-only demo credentials (`demo.user` / `fixture-demo-password`), and the protected account record |
| `src/scenarios/auth-gate/state.ts` | 90 | `AuthGateState`, `createAuthGateState`, `isAuthGateSessionValid`, `mutateAuthGateState` |
| `src/scenarios/auth-gate/pages.ts` | 79 | `renderSignInPage` (start page) and `renderAccountPage` (protected page) |
| `src/scenarios/auth-gate/manifest.ts` | 61 | The W18/W19 manifest |
| `src/scenarios/auth-gate/scenario.ts` | 27 | `defineScenario` wiring and the `route` hook (replaces the placeholder) |
| `src/scenarios/auth-gate/tests/scenario.test.ts` | 208 | 10 node:test cases |
| `e2e/auth-gate.spec.ts` | 164 | 6 Playwright tests |

The fixture is split by responsibility: data, state machine, HTML, manifest,
and wiring. There is deliberately **no `index.ts` barrel** in `auth-gate/`.
The audit's `imports` rule flags an import that reaches past an existing
barrel, and `registry.ts` imports `./scenarios/auth-gate/scenario.js`. A barrel
here would create a finding in `registry.ts`, which I do not own. Sibling
fixtures have no barrel either.

### Fixture behaviour

**Start page (`render`): the sign-in form.** It has:
- a labelled username field (`autocomplete="username"`);
- a labelled password field (`type="password"`, `autocomplete="current-password"`);
- a `Sign in` submit button;
- a `role="status"` line;
- an `aside` that states the fixture-only demo credentials;
- a hidden `role="alert"` notice, "Your session expired. Sign in again to
  continue.". The page script reveals it when the URL has `?expired=1`,
  because `render` receives no query.

Submitting calls `mutate('sign-in', { username, password })`. On success the
page navigates itself to `/scenarios/auth-gate/account`, as real sign-in pages
redirect to their destination. On rejection it says "The username or password
is incorrect." and clears the password. The start page renders the same form
whatever the session state.

**Account page (`route`, subpath `account`).**
- **Valid session** (`session.status === "active"` and `sessionPolicy ===
  "standard"`): 200. The body has a "Signed in as demo.user" header with
  `Sign out`, heading `Your account`, and `account-summary` (holder `Demo
  Customer`, plan `Team (annual)`, balance `$1,284.50`). Its mutation is
  `view-account`.
- **Otherwise:** 302 with `location: /scenarios/auth-gate/?expired=1` and
  mutation `deny-account`.
- **Any other subpath:** `undefined` (404).

The server applies the mutation on GET only, so HEAD records nothing.

**State: the oracle at `/__control/final-state`.**
- `seedMarker` (`auth-gate-seed-<seed>`)
- `sessionPolicy` (`standard` | `expire-before-account`)
- `session` (`{ id, username, status: active|expired }` or null; the id is
  `<seedMarker>-session-<n>`)
- `signInCount`, `rejectedSignInCount`, `accountViewCount`, `deniedAccountCount`
- `lastDenial` (`no-session` | `expired` | null)
- `lastOperation`

The password is compared with the demo credential and discarded. No state
field ever holds it; unit and e2e tests assert this. There is no randomness and
no clock. The protected content does not depend on the seed, so the manifest's
expected records hold for any lab seed; the seed shows only in `seedMarker` and
the session id.

**Mutate operations.** Unknown operations return the state unchanged.

| Operation | Source | Effect |
| --- | --- | --- |
| `sign-in` | sign-in page | Correct demo credentials: new active session, `signInCount+1`. Anything else, including malformed payloads: `rejectedSignInCount+1`, session unchanged |
| `sign-out` | account page | `session: null` |
| `view-account` | account route (valid session) | `accountViewCount+1`; no-op unless the session is valid |
| `deny-account` | account route (invalid session) | `deniedAccountCount+1`; `lastDenial` is `expired` if a session existed, else `no-session`; any session becomes `expired`. No-op while the session is valid |
| `expire-session` | **`expired` variant arm** | `sessionPolicy: expire-before-account` and any current session becomes `expired`. Sign-in still succeeds afterwards, but the account request is refused and that session expires |

### Workflows and variants

| Workflow / variant | Row | Arm | Expected outcome |
| --- | --- | --- | --- |
| primary | W18 | none | **Success.** Script: `type testid:username`, `type testid:password`, `click testid:sign-in`, `waitForState testid:account-heading` (5000 ms), `extract read-account` (target `testid:account-summary`, fields `holder`, `plan`, `balance` by test id), `checkpoint`. `finalState`: path `/scenarios/auth-gate/account`, `signed-in-user` text `demo.user`, `account-summary` visible. `extracted`: `read-account` count 1, records `[{ holder: "Demo Customer", plan: "Team (annual)", balance: "$1,284.50" }]`. `actions`: `web.dom.type` and `web.dom.click` succeeded. `recordingEvents`: `web.element.input_changed` ×2, `web.element.clicked` ×1. `pageFacts`: form visible, demo username stated, expiry notice hidden. `allowedConsoleErrors: []` |
| primary → `expired` | W19 | `expire-session` | **Failure `AUTH_REQUIRED`.** Sign-in succeeds, and the page's navigation to the account page is answered 302 to `/scenarios/auth-gate/?expired=1`, where the notice shows. `finalState` (replaced): path `/scenarios/auth-gate/`, `session-expired` visible and contains "session expired", `account-summary` absent. `extracted` (replaced): `[]`. `pageFacts`, `recordingEvents`, `actions`, and `allowedConsoleErrors` are inherited: the recording and the sign-in actions are the same |

There are no `workflows[]` entries: the fixture carries one corpus workflow.

### Corpus decisions I made

1. **Where W19's armed behaviour shows.** Arming happens after recording and
   before the run, and a replay signs in again. Merely expiring the current
   session would therefore have no effect. So the arm also sets a policy under
   which every later session expires when the protected page is requested.
   The replay's sign-in succeeds and the gate refuses the account page, which
   is a realistic mid-workflow expiry. Arming while signed in also expires the
   live session; an e2e test covers both paths.
2. **An unauthenticated visit also redirects with `?expired=1`**, as the brief
   says literally ("otherwise answers 302 ... with `?expired=1`"). The state
   still separates the cases through `lastDenial` (`no-session` vs `expired`).
3. **Post-sign-in navigation is the page's own redirect, not a separate
   `navigate` step.** It is realistic, and it keeps the start page identical
   before and after a recording. That matters if the Testing Lab does not
   reset fixture state between the recording lane and the run: the replay can
   always find the form.
4. **W19 replaces `extracted` with `[]`, not `{ step: "read-account", count: 0 }`.**
   The run must stop at the auth gate before any extraction. `count: 0` would
   equate "never reached the page" with "read an empty list", which is the
   successful `no-results` shape used elsewhere in the corpus.
5. **`web.page.navigated` is not in `recordingEvents`.** The event exists
   (`domain/src/constants.ts:7`), but I could not confirm that the recorder
   emits it for a script-initiated `location.assign`. The final `path` fact
   already proves the navigation.
6. **`expected.actions` lists only `web.dom.type` and `web.dom.click`.** I left
   out wait and extract action names because I could not confirm how the
   runner maps a `waitForState` or `extract` step to an action. Existing
   manifests treat `actions` as a subset, not a sequence.
7. **`evidencePolicy.reviewRequired: true`**, matching `sensitive-input`,
   because the recording types a credential (a fixture-only one).
8. **No `playbackGoal`.** A variant cannot override it, and W19 must not meet
   the W18 goal.

### Test coverage

**`tests/scenario.test.ts`** (node:test, 10 cases):
1. manifest validity (`assertWebScenario`), plus W18 and W19 resolution
   through `resolveScenarioWorkflow`, including which fields W19 inherits;
2. deterministic state and render for a seed;
3. `sign-in` accept and reject, including malformed payloads and the
   password-never-stored check;
4. `sign-out`;
5. `view-account` and `deny-account`, including the no-op guards;
6. `expire-session`, the variant arm, both with a live session and before
   sign-in;
7. unknown operations;
8. every `route` response: 200, 302, HEAD, and `undefined` for `account/`,
   `account/settings`, `admin`, `sign-in`;
9. sign-in page markup;
10. through the real lab server: 302 and its `location`, HEAD recording
    nothing, 200 after sign-in, 302 after arming, and 404.

**`e2e/auth-gate.spec.ts`** (plain Playwright, 6 tests). The spec drives the
manifest's own steps and evaluates the manifest's own facts the way the
runner does: the subject is a `data-testid`, `text` is trimmed text, and
`path` is the pathname. That proves the manifest's selectors, values, and
facts match the page. The tests:
1. W18, end to end, including the extraction records and final state;
2. wrong credentials;
3. an unauthenticated account visit;
4. sign-out;
5. W19 armed before the run;
6. W19 armed with a live session, then reload.

## Commands run and observed results

All commands were run from `F:\!FluxIQWebExtension`.

1. `pnpm --filter @fluxiq-web-extension/scenario-lab build`. The first two
   runs exited 2. Their only errors were
   `src/scenarios/data-table/table-page.ts(15,49)` and `(16,50)`:
   `error TS1487: Octal escape sequences are not allowed`, in another
   fixture. A later run's only error was
   `src/scenarios/modal-flows/mutate.ts(35,22): error TS2322`, also another
   fixture. **The final run exited 0** (`BUILD_EXIT=0`, no errors).
2. `node --test apps/scenario-lab/dist/scenarios/auth-gate/tests/scenario.test.js`.
   Earlier attempts failed at module load, never in an assertion. The causes
   were the `data-table` `SyntaxError`, then
   `ERR_MODULE_NOT_FOUND ... packages\test-contracts\dist\bench-report.js`, then
   `... bench-report-validation.js`, while the contracts were rebuilt in
   parallel. **The final run printed all ten `ok 1` … `ok 10`, then
   `# tests 10`, `# pass 10`, `# fail 0`, `# skipped 0`,
   `# duration_ms 215.9644`.**
3. `pnpm --filter @fluxiq-web-extension/scenario-lab exec playwright test -c e2e/playwright.config.ts e2e/auth-gate.spec.ts`.
   Earlier attempts printed "No tests found" because of the same two loading
   failures. **The final run printed `Running 6 tests using 6 workers` … `6 passed (3.7s)`.**
   Per-test times were 1.3–1.7 s. The six tests are:
   - "W18 signs in with the stated demo credentials, reaches the account page, and reads the protected content"
   - "wrong credentials are rejected on the sign-in page"
   - "an account visit without a session is redirected to the sign-in page, which says the session expired"
   - "signing out ends the session, so the account page redirects again"
   - "W19 expired: after arming, signing in ends back at the auth gate instead of the account page"
   - "arming the expired variant expires a live session: reloading the account page lands on the sign-in page"
4. `node scripts/structure-audit.mjs`.
   - **Before my edits:** two `FAIL [working-docs]` lines (the plan's line
     count and a stale `README.md`; not mine) and
     `structure-audit: 1 baseline entries can be lowered.`
   - **After my edits, run twice:** exit 0,
     `structure-audit: passed (27 warning(s), 19 baselined)`, and no line
     naming `auth-gate`.
   - **For the supervisor:** the line
     `structure-audit: 1 baseline entries can be lowered. Run "pnpm structure:baseline" to record the improvement.`
     is still printed. It was already present before I edited anything, so it
     does not come from these files. I did not run `pnpm structure:baseline`.
5. **Extra:** `node --test apps/scenario-lab/dist/tests/registry.test.js apps/scenario-lab/dist/tests/server.test.js apps/scenario-lab/dist/tests/state-store.test.js`
   printed `# tests 17`, `# pass 17`, `# fail 0`. That includes "every
   scenario page is directly renderable" and "manifest ids, paths, seeds, and
   step ids are unique across the corpus".
6. **Extra: a type check of the spec**, which the package build does not
   compile. It used a scratchpad tsconfig that extends
   `tsconfig.base.json` with `files: [e2e/auth-gate.spec.ts]`.
   - It first reported
     `e2e/auth-gate.spec.ts(64,99): error TS2379` (`exactOptionalPropertyTypes`
     on `waitFor({ timeout: step.timeoutMs })`).
   - I fixed it to `step.timeoutMs ?? 5_000`.
   - On re-run, no error named `auth-gate`; the only error left was the
     then-pending `modal-flows` one.
7. **Extra, while the contracts `dist` was mid-build:** I ran the compiled
   unit test from a scratchpad copy that imports the built `validation.js`
   and `scenario-workflow.js` directly, skipping the barrel. Result: 9 pass,
   1 skipped (the lab-server case). Run 2 above supersedes it.

## Not verified

- **The Testing Lab recording lane and a FluxIQ replay of W18/W19.** No
  extension run was in scope. Only the plain-Playwright workflow drive and the
  node tests exercise the fixture.
- **Whether the recorder emits `web.element.input_changed` ×2 and
  `web.element.clicked` ×1** for this page. The counts follow `basic-form` and
  `sensitive-input`, which type into two fields (one a password) and click once.
- **How the runner treats `extracted: []` and `expected.failure` on a variant
  run.** The runner is being changed in parallel (`w1-runner-asserts`).
- **Other browsers.** The spec ran only on the headless Chromium channel set
  in `e2e/playwright.config.ts`.

## Open questions or contradictions found

1. **The W18 replay depends on a credential the recording will not hold.** The
   recorder redacts password values (`autocomplete="current-password"`), so a
   Flow built from the recording cannot type the password from the recording
   alone. The manifest's `type` step carries the demo password for the
   recording lane, and the page states it. How a replay gets a redacted value
   (a Flow input or secret) is outside this fixture, but W18's success depends
   on it.
2. **Does the Testing Lab reset fixture state between the recording lane and a
   variant run?** Either way the fixture works: arming expires any live session
   and the start page is always the form. But the expected W19 counters differ
   by one sign-in, so only facts are asserted in the manifest, not counters.
3. **Reads beyond the listed files.** I made narrow greps so the facts and
   selectors I authored are ones the runner can evaluate:
   - `packages/test-runner/src/scenario-assertions.ts`: fact predicates, and
     that `text` is trimmed `textContent` and `path` is the URL pathname;
   - `packages/test-runner/src/run-scenario.ts:356`: the `testid:` selector;
   - the `recordingEvents` lines of `basic-form` and `sensitive-input`;
   - `domain/src/constants.ts` for `web.page.navigated`;
   - `scripts/structure-audit/rules/` for the barrel rule.

   I edited none of these.
4. **Concurrency breakages seen, all cleared by the final runs:**
   - `data-table/table-page.ts` octal escapes in a template literal;
   - a `modal-flows/mutate.ts` type error;
   - the `packages/test-contracts/dist/index.js` barrel re-exporting
     `bench-report*.js` before those files were compiled.

   The last one briefly breaks every package that imports the contracts at
   runtime.
