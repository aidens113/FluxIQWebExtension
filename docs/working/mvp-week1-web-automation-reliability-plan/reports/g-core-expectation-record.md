# g-core-expectation-record — one expectation-rejected record, and no empty expectation (Core)

Worker report for brief `g-core-expectation-record` in
[finish-week1.md](../briefs/finish-week1.md), which takes up open questions 2 and 5
of [w19-c2.md](./w19-c2.md). The work is in FluxIQ Core (`F:\!FluxIQ`, branch
`dev`), which was at `c0e0ce9` from start to finish. Nothing was committed.

## Outcome

**Done.** Both parts of the brief are in place, every check the brief names
passed, and each new guard has a mutation proof.

1. **One record.** Core's `expected_state_missing` failure record, the one used
   when the host rejects an expected state without giving its own record, is now
   defined once, in `nodes/policy/expectation.ts`. The policy barrel exports it,
   and the transition comparison imports it from there. The copy in
   `transition-comparison.ts` is deleted.
   - **Cycle check first:** importing the policy barrel into the executor
     creates no import cycle (evidence below).
   - **Proof there is one source:** one change to the record failed the
     expectation node's own test and both executor rows that pin Core's record,
     at the same time.
2. **An empty expected state (`{}`) counts as none, in two places.**
   - **In the recording lift:** a recording mapper that proposes `{}` gets a
     candidate with no `expectedState`, and the approved node has none either.
     The action is still proposed.
   - **In the transition comparison:** an attempt whose node carries
     `expectedState: {}` is not sent to the host. It keeps its own outcome, and
     the run goes on.

## What changed and why

Paths are under
`F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\`. Every file is in
the brief's Owns list. `git diff --stat` over them reports 103 lines added and 33
removed.

### The import-cycle check (done before editing)

- **The policy files import nothing that leads back to the executor.**
  - `nodes/policy/action.ts`, `expectation.ts` and `recovery.ts` import only
    `./shared.ts`, `../shared/definition.ts`, and two type-only modules:
    `../contracts.ts` and `core/index.ts`.
  - `nodes/shared/definition.ts` and `nodes/contracts.ts` have type-only
    imports.
  - No file under `nodes/` imports anything under `runtime/`, and none uses
    `import(` or `require(`.
- **Nothing new enters the module graph.** `nodes/registry.ts:7` already imports
  `./policy/index.ts`.
- **No declared boundary forbids the import.** `importBoundaries` is empty in
  `scripts/structure-audit/config.mjs:23`.
- **The import is allowed.** It targets the directory's barrel, which the import
  rule permits (`scripts/structure-audit/rules/imports.mjs:127`).

### `nodes/policy/expectation.ts`

- **`:9-14`:** a doc comment, and `export` added to the existing
  `EXPECTATION_REJECTED_FAILURE`. Its value is unchanged:
  `expected_state_missing`, `core.policy.expectation_rejected`, retryable,
  stage `verification`.
- **`:63`:** the node still spreads it, as before.

### `nodes/policy/index.ts`

- **`:5`:** `export { EXPECTATION_REJECTED_FAILURE } from "./expectation.ts";`
- **Not public.** `nodes/index.ts` does not re-export `./policy`, so the public
  reference gains no row.

### `runtime/executor/transition-comparison.ts`

- **`:5`:** `import { EXPECTATION_REJECTED_FAILURE } from "../../nodes/policy/index.ts";`
- **Deleted:** the private copy `EXPECTED_STATE_REJECTED_FAILURE` and its comment
  (formerly `:88-96`).
- **`:128`:** a rejection without a parseable host record now falls back to
  `{ ...EXPECTATION_REJECTED_FAILURE }`.
- **`:108`:** `attemptWithHostExpectationEvaluation` now also returns the attempt
  untouched when `Object.keys(expectedState).length === 0`. Its doc comment
  (`:90-98`) and the comment above the check say so.
- **The rest of the comparison already treated `{}` as no expectation.** With no
  host verdict, `stateCheckCount` is the number of keys, which is 0.
- **Line move:** `compareAutomationStudioTransition` moved from `:37` to `:38`,
  so the framework reference was regenerated.

### `runtime/service/recordings/proposal-candidates.ts`

- **`liftedExpectedState`:** after the plain-object check it clones the value,
  then keeps the clone only when `Object.keys(clone).length > 0`.
- **Keys are counted on the clone, not on the mapper's object,** because the
  clone is what the proposal would store. An object whose only keys are symbols
  is also dropped, since the clone loses those keys.
- **The comment above it, and the doc comment on
  `recordingFlowActionCandidate` (`:43-45`),** now say "a plain object with at
  least one key".

### `runtime/executor/tests/transition-comparison.test.ts`

- **A new block, "the host check after a succeeded action", with one row.** It
  runs a two-node Flow through `runAutomationStudioGraph` against a host whose
  evaluator rejects everything it is asked:
  - a click carrying `expectedState`;
  - a second output joined to it by a `success` edge.
- **Control: a one-key expected state is asked once, and the click fails.** This
  shows the evaluator is bound and reached, so the empty case below cannot pass
  vacuously.
- **The empty expected state, `{}`:**
  - the host is never asked;
  - the run and the click succeed, and the click has no `failure`;
  - the comparison is `matched`, with `stateCheckCount` 0;
  - both outputs are dispatched.
- **Why it runs through the graph runner:** that is the path that actually calls
  `attemptWithHostExpectationEvaluation` (`node-execution.ts:138`).

### `runtime/service/recordings/tests/proposal-candidates.test.ts`

- **A new helper, `expectEveryExpectedStateDropped(values, recordingId)`.** It
  proposes one click for each value and approves the proposal into a Flow. Then
  it checks:
  - every click was proposed, with no "could not map" issue;
  - no candidate and no graph node carries `expectedState`.
- **Existing row 2** ("not a plain object") now calls the helper with the same
  nine values and the same assertions.
- **New row 3, "is dropped, and the action still proposed, when it has no
  keys":** `{}`, `Object.create(null)`, and an object whose only key is a
  symbol. Row 1 already shows that a non-empty expected state is kept.

### Compatibility effect

- **An existing Flow node carrying `expectedState: {}`** used to make a bound
  host evaluator run with conditions `[{}]`. It is no longer sent to the host,
  and its attempt keeps its own outcome.
- **A mapper that proposes `{}`** now produces a candidate without
  `expectedState`, so the approved node has no `parameterValues.expectedState`.
- **Nothing downstream proposes `expectedState` yet** (D1 is not written), so no
  web Flow changes.
- **No public API changed.** The only change in the public reference is the
  moved line number.

## Commands run and observed results

- **Where they ran.** Vitest ran from `F:\!FluxIQ\packages\fluxiq`; the `pnpm`
  commands ran from `F:\!FluxIQ`.
- **Outputs.** Saved as `gcer-*.out` in my scratchpad.
- **Exit codes.** Captured by redirecting to a file and echoing `$?`, never
  through a pipe.
- **Single observations.** Every result below was observed once. No run failed
  in a uniform or impossible way, so nothing was rerun.

1. **Before any edit.** The three test files
   (`runtime/executor/tests/transition-comparison.test.ts`,
   `runtime/executor/tests/node-execution.test.ts`,
   `runtime/service/recordings/tests/proposal-candidates.test.ts`) were run with
   `--no-file-parallelism`.
   - Exit 0: `Test Files 3 passed (3)`, `Tests 23 passed (23)`.
   - The owned files' hashes matched the snapshots in `w19-c2`'s report
     (`expectation.ts` `3e8bc744…`, `transition-comparison.ts` `e3f434aa…`,
     `proposal-candidates.ts` `2f1f8e22…`), so the item was not already settled.
2. **The same three files after the edits.** Exit 0,
   `Tests 25 passed (25)`: 9 in `transition-comparison`, 11 in `node-execution`,
   5 in `proposal-candidates`.
3. **Mutation proofs.**
   - **Method.** Each mutation was applied with `sed` to a copy-verified file.
     Each file was restored by copying it back from a post-edit snapshot, and
     `cmp` reported it byte-identical to that snapshot every time. The final
     hashes: `transition-comparison.ts` `8b0565c3…`, `proposal-candidates.ts`
     `ce5fe8a2…`, `expectation.ts` `a397f152…`.
   - **Order.** A and C ran alone. B and D ran at the same time; they changed
     different files, and each ran only its own test files.
   - **A: the executor's empty-state check removed.**
     - Exit 1, `Tests 1 failed | 8 passed (9)`.
     - Failing row: "does not ask the host about an expected state with no keys,
       and the run goes on".
     - Quoted: `AssertionError: expected [ [ [ {} ], 'all', +0, { …(3) } ] ] to deeply equal []`
       at `transition-comparison.test.ts:90:25`.
   - **B: the lift keeps a clone with no keys** (`return lifted;`).
     - Exit 1, `Tests 1 failed | 4 passed (5)`.
     - Failing row: "is dropped, and the action still proposed, when it has no
       keys".
     - Quoted: `AssertionError: expected { …(10) } to not have property "expectedState"`
       at `proposal-candidates.test.ts:91:77` (the helper), called from `:122:5`.
   - **C: keys counted on the mapper's object before the clone**
     (`Reflect.ownKeys(value)`).
     - Exit 1, `Tests 1 failed | 4 passed (5)`.
     - The same row and the same assertion as B. Only the symbol-keyed value can
       fail this way.
   - **D: the shared record changed** (`retryable: false` in `expectation.ts`),
     running `node-execution.test.ts` and `nodes/policy/tests/expectation.test.ts`.
     - Exit 1, `Tests 4 failed | 11 passed (15)`.
     - Failing rows:
       - `builtin.policy.expectation` "routes failed with an expected-state failure
         when the bound evaluator rejects" (`expectation.test.ts:18:20`);
       - "routes the expectation node to failed when the bound evaluator rejects"
         (`node-execution.test.ts:77:31`);
       - "gives Core's expected_state_missing record when the host rejects
         without one" (`:174:40`);
       - "gives Core's record, and its comparison status, in place of a host
         record that does not parse" (`:183:40`).
     - What it shows: the transition comparison's rows now read the node's
       record, so there is one source.
4. **Core `pnpm check`,** run alone on the final tree. No new files were
   created, so no scratch index was needed.
   - Exit 0, `structure-audit: passed (121 warning(s), 256 baselined).`
   - `packages/contracts`, `packages/client-gateway-websocket`, `packages/fluxiq`
     and `apps/web` each printed `check: Done`.
   - No line of the output names an owned file.
   - It printed no "baseline entries can be lowered" line.
   - The only warnings shown name the other worker's files, and they are
     warnings, not failures:
     - `client-gateway/bridge.ts` at 26 methods and 796 lines;
     - `client-gateway/tests/bridge.test.ts` at 711 lines.
5. **`pnpm docs:reference`,** run once, at the end.
   - Exit 0: "Wrote docs/reference/framework-reference.md and
     packages/fluxiq/docs/reference/framework-reference.md (1574 public
     declarations)."
   - **The reference lines that changed.** Compared with copies taken just
     before the run, and by `git diff --stat` against HEAD, one line changed in
     each file:
     - line 851, `compareAutomationStudioTransition`, moved from
       `runtime/executor/transition-comparison.ts:37` to `:38`;
     - `2 insertions(+), 2 deletions(-)` across the two files, and nothing else.
6. **The final run of four test files:** the three above plus
   `nodes/policy/tests/expectation.test.ts`.
   - Exit 0, `Test Files 4 passed (4)`, `Tests 29 passed (29)`: 11, 5, 9 and 4.
7. **`pnpm docs:check`.** Exit 0, "Validated local links in 100 authored/reference
   Markdown files." and "Deterministic framework reference is current."

**`git status --short` in Core at the end.**
- **My changes:** the six owned files, plus the two regenerated
  `framework-reference.md` files.
- **Also modified:** the other worker's `client-gateway/bridge.ts`,
  `client-gateway/tests/bridge.test.ts` and
  `docs/architecture/automation-studio/client-gateway.md`. I did not touch them.
- **Untracked:** none.

## Not verified

- **Core tests not run.**
  - Root `pnpm test` and Core `pnpm build` did not run (forbidden).
  - `runtime/tests/service.test.ts`, `service-flow-bootstrap-*.test.ts`,
    `apps/web` and the quality config did not run.
  - `proposal-candidates.test.ts` does go through `AutomationStudioService`.
- **This repository against the new Core.** The domain and extension were not
  compiled against it.
- **Lab.** Nothing ran (forbidden). What a Lab run must show:
  - **Now:** no Week 1 row changes verdict because of this change alone, since
    no downstream mapper proposes `expectedState` yet.
  - **Once D1 lands:** no recorded click node carries an empty
    `parameterValues.expectedState`. A node that carries a real URL claim is
    still sent to the host: W19 `expired` fails with `auth_required` and
    comparison `blocked`, and W18 passes with its click `matched`.
- **The other worker's regeneration.** If `g-core-start-order` regenerates the
  reference after this, line 851 must still read `transition-comparison.ts:38`.

## Open questions or contradictions found

1. **An expected state with keys but nothing to check is still sent to the host.**
   - `{ conditions: [] }` has a key, so it is still sent, with no conditions.
   - The brief scoped the rule to "no own keys", so I did not widen it.
   - The existing row at `transition-comparison.test.ts:62` uses
     `{ conditions: [] }` with the comparison function directly.
   - Decide whether an empty `conditions` list should also count as none.
2. **Two authored doc sentences are now slightly incomplete.** I did not own
   them, so I did not edit them.
   - `docs/architecture/automation-studio-native-nodes.md:239` says Core keeps
     the expected state "only when it is a plain object". It should add "with at
     least one key".
   - `docs/architecture/automation-studio.md:426` says the comparison asks the
     host about a node "that carries `expectedState`". It should say an
     expected state with no keys is not asked about.
   - The record sentence at `automation-studio.md:431-432` is still accurate.
3. **The trace still shows an empty expectation.**
   - `runtime/executor/expected-transition.ts:8` (not owned) still copies `{}`
     into the comparison's `expected.expectedState`.
   - A trace therefore shows an empty expected state that was never checked.
     This is harmless, but say if it should be dropped there too.
4. **What "no own keys" means here.**
   - The lift judges it on the clone, so an object whose only keys are symbols
     or non-enumerable is dropped. Mutation C pins this.
   - A strict `Reflect.ownKeys` reading would keep such an object, and it would
     then be stored as `{}`, which I think is wrong.
5. **Baseline.** I believe no `.structure-baseline.json` entry should change, and
   the audit suggested none.
