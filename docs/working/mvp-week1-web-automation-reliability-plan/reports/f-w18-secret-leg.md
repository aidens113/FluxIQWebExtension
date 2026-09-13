# f-w18-secret-leg — letting auth-gate's password replay

## Outcome

**Done, for the part a worker without the Lab can finish and prove.** I checked
at HEAD `99eca80` first: none of the three edits from `p-secret-binding` had
landed. All three have now landed. Each has a unit test and a mutation proof,
and every mutated file was restored byte-identical (SHA-256 matched).

In plain terms, a password step recorded in auth-gate now goes like this:

1. The recorder withholds the password. The step's node asks for the value under
   a path (`web.secret.<key>`) instead of carrying it, and it **stays in the
   Flow**. Before, it was dropped silently (edit 1).
2. The Flow lane reads that path off the approved Flow's node. It pairs the path
   with the scenario's declared secret by matching the declared step's target
   against the recorded control. The run then gets the value under exactly that
   path. If requests and declarations do not pair one-to-one, the run fails
   before it starts (edit 3).
3. A command can still reach the extension with the request unanswered, for
   example from a Core that did not resolve it. The domain then refuses the
   command, naming parameters and paths. It no longer types an empty string and
   reports success (edit 2).

Whether W18 actually replays is a Lab question. See *Not verified*.

## What changed and why

### Edit 1: the gate (`domain/src/io/input-model.ts:178`)

`hasExecutableParameters` now counts a required parameter as present when it is
a non-empty string **or** a secret request
(`webAutomationSecretBindingPath(...) !== undefined`). This is the report's
one-line edit. The doc comment above it now explains why: refusing the request
removed the password step from the Flow, and nothing said so. Only
secret-namespace requests count, so an ordinary field with nothing recorded is
still not executable.

### Edit 2: the refusal (`domain/src/client/gateway-mapping.ts:134`, helpers at `:338`)

`webAutomationActionFromGatewayCommand` runs
`webAutomationUnresolvedSecretParameters(parameters)` after the action-type
check, so an unknown type is still refused as unknown first. If any request is
unmet, it returns the existing rejection shape:

- `message`: `Not dispatched: these parameters need values supplied at run time that this run did not supply: text (web.secret.password)`.
  It holds parameter names and paths only.
- `failure`: built by `webAutomationFailureRecord(USER_INTERVENTION_REQUIRED, …)`,
  which gives category `user_intervention_required`, retryable `false` and
  stage `execution`. `expected` reads `values supplied at run time for <paths>`
  and `actual` reads `the run supplied none, so the action was not dispatched`.
  Core's parser keeps the record whole, and a test asserts that.

The extension already treats any `status: "rejected"` with a `failure` as a
refusal (`apps/extension/src/runtime/result-mapping.ts:22-27`), so this path is
live without further changes. I also updated the doc comment on
`WebAutomationActionRejection`, which said a rejection only ever meant an
unknown type.

### Edit 3: supplying the value (`packages/test-runner/src/flow-lane/`)

`declared-secrets.ts` gains two functions:

- **`readFlowSecretRequests`** (`:102`) reads the parent Flow and every Subflow
  graph through `get-flow` and `list-flow-subflows`. Approval writes each
  recorded node as `parameterValues: { outputId, parameters }`, which I checked
  in Core `recordingProposalGraphFlow`, `runtime/service.ts:5855-5859`.
  For each node it returns `{ nodeId, parameter, path, selector, element }`,
  found by the domain's own `webAutomationUnresolvedSecretParameters`. It never
  holds a value.
- **`declaredSecretBindingInputs`** (`:133`) keeps only the declarations whose
  step belongs to *this run's* recording script. It parses each step's target
  with `parseScenarioTarget` and matches it against the requesting node's
  recorded identity (`targetMatchesRequest`, `:173`):
  - `testid:` matches `element.testId` or `attributes["data-testid"]`.
  - `role:` matches `role` or `implicitRole`, plus `accessibleName` or `label`.
  - `frame:` matches its inner target.
  - A CSS target matches only an identical selector.

  Requests are grouped by path, since two nodes on one control share a path.
  If any path is answered by a number of declarations other than one, or any
  declaration pairs with a number of paths other than one, it throws
  `RunnerFailure("fixture.invalid", …)` (`:152`). The message and `details` name
  scenario id, secret ids, steps, node ids, parameters and paths, never a
  value. Otherwise it returns `{ [path]: value }`.

`run-flow-lane.ts:86-97` calls both right after `readFlowActionTypes` and
before `executeRecordedFlowRun`. The run's `inputs` keep the id-keyed entries
and add the path-keyed ones. Core resolves `$state` paths as flat keys of the
inputs, so `inputs["web.secret.password"]` is the key the node reads.

The `scenario-steps` import goes through its barrel (`../scenario-steps/index.js`).
The first audit run flagged the direct `parse-target.js` import. That barrel's
Playwright imports are all `import type`, so it loads nothing extra at runtime.

### Tests

- `domain/src/io/tests/input-model.test.ts` (+12 lines): a password `dom.input`
  with no value is a `web.user.text_entered` / `web.dom.type`. Its `text` is
  exactly `{ $state: { path: "web.secret.password" } }`, and the live gateway
  path agrees. An ordinary field with no value is still not executable.
- `domain/src/client/tests/gateway-mapping.test.ts` (+60 lines):
  - The exact rejection object for an unmet request, with no `text` on it.
  - Core's parser round-trip of the record.
  - An answered request dispatches as plain text.
  - Two unmet requests are both named, and a literal beside them is not echoed.
  - A binding outside the secret namespace is not refused.
  - An unknown action type is still `web.action.unsupported_type`.
- `packages/test-runner/src/flow-lane/tests/declared-secrets.test.ts`: five new
  tests covering:
  - pairing for `testid`, `frame` and `role` targets, and two nodes sharing one
    path;
  - an unanswered request;
  - a declaration with no request, one with two paths, and two declarations on
    one control;
  - a declaration for a step this run did not record;
  - the reader across parent and Subflow graphs, ignoring literals and non-secret
    bindings.

  Every failure is checked to not carry the supplied value.
- `packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts`: the fake
  Core can now serve a Subflow graph and records the inputs passed to
  `startPersistedFlow` and `runPersistedFlow`. There are two new tests:
  - **the run's inputs carry the declared value at the path the Flow's node
    asks for**, which deep-equals both calls' inputs to
    `{ "auth-gate-password", "web.secret.password", scenarioId, facilityRunId }`;
  - an unanswered request fails with `fixture.invalid` before anything starts,
    and `startedInputs` and `runInputs` stay empty.

## Commands run and observed results

All commands ran one at a time. Exit codes came from `$LASTEXITCODE` with output
redirected to a file, not a pipe.

| Command | Observed |
| --- | --- |
| `pnpm --dir domain check` | exit 0 |
| `DOMAIN_TEST_BUILD_LABEL=f-w18-secret-leg pnpm --dir domain test` (after the edits) | exit 0; `# tests 349`, `# pass 349`, `# fail 0`; `Web automation gateway mapping tests passed.`, `Web automation input model tests passed.` |
| `pnpm --dir packages/test-runner exec tsc -p tsconfig.json --outDir .f-w18-secret-leg/dist` | exit 0 |
| `node --test` on the `declared-secrets`, `run-flow-lane` and `flow-action-types` tests | exit 0; 18 of 18 |
| `node scripts/structure-audit.mjs` (first) | exit 1: my `[imports] declared-secrets.ts … "../scenario-steps/parse-target.js" at line 5` (fixed by importing the barrel), and `[working-docs] docs/working/README.md is out of date`, which is not my file |
| Same audit (final) | exit 0; one advisory: `warn [file-lines] domain/src/client/tests/gateway-mapping.test.ts: 504 lines is past the 400-line advisory` (fail limit 800; not baselined) |
| Domain test, final clean run after all restores | exit 0; `# tests 349`, `# pass 349`, `# fail 0` |
| test-runner compile and every `flow-lane/tests/*.test.js`, final | tsc exit 0; `node --test` exit 0; `# tests 43`, `# pass 43`, `# fail 0` |

The scratch build directories (`packages/test-runner/.f-w18-secret-leg`, which
sits under an ignored `dist/`, and `domain/.test-build-scratch/f-w18-secret-leg`)
were deleted afterwards, and both were confirmed absent.

### Mutation proofs

The pre-mutation SHA-256 values were recorded first. Each mutation was reverted
with the inverse edit, then the file was hashed again.

| # | Mutation | Failing test, quoted | Restored hash matches |
| --- | --- | --- | --- |
| M1 | `input-model.ts:178`: `|| (false && webAutomationSecretBindingPath(...) !== undefined)` | domain test exit 1: `AssertionError [ERR_ASSERTION]: a withheld value is still a text entry, not evidence … + undefined - 'web.user.text_entered'` | `605AEC31…2B74F4F`, identical |
| M2 | `gateway-mapping.ts`: `if (unmet.length > 99)` | domain test exit 1: `Expected values to be strictly deep-equal` for `command.unsupplied`. Actual had `options: { selector: '#password', text: { '$state': { path: 'web.secret.password' } } }` and `selector: '#password'`; expected had `status: 'rejected'`, the message and the `user_intervention_required` failure | `E0509B63…47129FE11`, identical |
| M3a | `run-flow-lane.ts`: dropped `...secretInputs` from `inputs` | `not ok 3 - the run's inputs carry the declared value at the path the Flow's node asks for` / `the run is started with the value under the node's path` / `-     'web.secret.password': 'value-declared-for-the-run'` (1 of 4 failed) | `4281D191…C354F467B`, identical |
| M3b | `declared-secrets.ts`: `if (false && (unpairedPaths.length || unpairedSecrets.length))` | `not ok 7 - a request no declaration answers fails the run, naming the path and never a value` (`error: 'a RunnerFailure'`); `not ok 8 - a declaration that pairs with no request, or with several, fails the run` (`error: 'Missing expected exception.'`); `not ok 14 - a request no declaration answers fails the run before it starts …` (`TypeError: Cannot read properties of undefined (reading 'secret')`) (3 of 14 failed) | `BB88F20C…E7E25BF7B`, identical (value taken after the barrel-import fix, before M3b) |

One hash comparison, a combined `Get-FileHash … -eq "<hash>"` command, was
denied by the auto-mode permission classifier. I re-ran it as a plain
`(Get-FileHash …).Hash` and compared the printed value by eye. All four
comparisons above were made that way.

Each observation above was made once, on this machine. None was uniform or
impossible, so none was rerun.

## Not verified

- **W18 replays (Lab only).** The run that proves this is bench row W18 on the
  Flow lane: `FLUXIQ_TEST_ENV_FILES=none pnpm lab bench --corpus week1 --target isolated`,
  the command in `Current State`. I did not check whether a single-scenario
  form exists. It needs `FLUXIQ_TEST_SECRET_AUTH_GATE_PASSWORD` set and a Core
  containing `368b3c9` plus the trace-withholding change. It must show:
  1. The approved Flow has **a password node** whose
     `parameterValues.parameters.text` is `{ $state: { path: "web.secret.<key>" } }`.
     Before edit 1 that node was absent. The Flow should have the username
     node, the password node, the submit node, and so on.
  2. The run starts with no `fixture.invalid` pairing failure, and the run's
     inputs carry `web.secret.<key>`. The inputs are in memory and must not be
     printed. Seeing no pairing failure proves the key.
  3. The password `web.dom.type` attempt `succeeded`, with **no** rejection
     carrying `web.intervention.required`. Seeing that code means Core did not
     resolve the nested binding.
  4. The final-state oracle **passed**: signed in, account summary extracted.
     Before, W18 failed there.
  5. The supplied value appears nowhere in the run trace, run history,
     evidence packet or Lab logs. That is Core's trace-withholding change, plus
     `declaredSecretValues` on the redaction list.
  6. W19 (`auth-gate`, variant `expired`) still reports its expected failure,
     not a `fixture.invalid` runner error. It runs the same Flow, so pairing
     applies to it too.
- The Chrome/Edge content harness was not run; no content script changed.
- Root `pnpm check`, `pnpm test` and `pnpm build` were not run (the brief
  forbids build). The package-level check, domain tests, test-runner compile,
  flow-lane tests and the structure audit were run as listed.
- The test-runner compiled against the existing `domain/dist`, which already
  exports `webAutomationUnresolvedSecretParameters`. I did not rebuild it. My
  domain edits change no export the test-runner uses.
- Core was not touched or run. That Core `368b3c9` resolves `$state` at any
  depth as a flat input key is the brief's statement. I only read
  `resolveAutomationNodeParameterValues` (`nodes/parameter-bindings.ts:34-62`),
  which matches it.

## Open questions or contradictions found

1. **Duplicated Flow traversal.** `readFlowSecretRequests` repeats the
   `get-flow` + `list-flow-subflows` walk of `readFlowActionTypes`
   (`flow-action-types.ts`), so a Flow-lane run now reads the Flow twice.
   `flow-action-types.ts` was not in my ownership. The clean fix is to have it
   return the node records, or export a `readFlowNodes`, so both derive from one
   read. That file should be briefed together with `declared-secrets.ts` next
   time.
2. **Failure code for an unmet request.** The closed set has no code meaning
   "a value supplied at run time was missing". I used `USER_INTERVENTION_REQUIRED`
   because only an operator can fix it and retrying unchanged cannot succeed.
   `codes.ts:49-58` still lists two producers of that code, and this is a
   third. If the supervisor prefers a dedicated code, that is an edit to
   `domain/src/runtime/failure/codes.ts`, which I do not own. The test pins the
   record exactly, so any change shows up there.
3. **Other scenarios now fail loudly on the Flow lane.** `storefront-checkout`
   (the `account-password` control is `type="password"`, `card-number` is
   `cc-number`, `billing-card-number` is `billing cc-number`) and
   `sensitive-input` type into marked controls and declare no `secrets`. Before
   edit 1 those steps silently dropped out of their Flows. Now they become
   request nodes, and the lane fails with `fixture.invalid` naming each path.
   Neither is in the week-1 corpus (`bench/corpus/week1.ts`; only auth-gate
   W18/W19 type into a marked control), but any Flow-lane run of them needs
   manifest declarations in `apps/scenario-lab/src/scenarios/*/manifest.ts`. I
   believe this is the intended loud behaviour; recording it so nobody reads it
   as a regression.
4. **Structure baseline.** No entry needs to change. None of my files is
   baselined, and the final audit is clean apart from the 400-line advisory on
   `gateway-mapping.test.ts` (504 lines). A future split of that test by topic
   would clear it.
5. **CSS targets pair only on an identical selector.** A scenario declaring a
   secret on a raw CSS target will fail to pair unless the recorder wrote the
   same selector. It fails loudly, not by guessing. All current declarations
   and sensitive steps use `testid:`, `frame:…/testid:` or `role:`.
