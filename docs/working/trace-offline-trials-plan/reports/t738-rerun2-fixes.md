# Report: t738-rerun2-fixes (lane lead)

Trees: downstream `fxwork/t738/!FluxIQWebExtension`, Core `fxwork/t738/!FluxIQ`, both on
`task/t738-rerun2-fixes` (downstream `ddf41bf4`, Core `ca23a8ba`). No commits, merges or pushes.

## Outcome

Done. All four units landed and were verified by the lead: tests beside each change, the prompt
contract tests, typechecks of Core, domain and extension, both structure audits, and the six
site-reset installed-gateway browser tests (headed, scripted provider). Nothing was run live; the
supervisor reruns live.

## Plan (2026-10-20)

Sources: the four rerun-round-2 debug notes (job `run-mvgf4pk5`, office `run-mvgf04kw`, social
`run-mvgf7ij5`, photo `run-mvgf801u`). One extra cause was traced before dispatch:

- **Office's `unexpected_input_keys` on every later brief's opening call.** Core's `told` wrapper
  (`service/project-build/brief-ports.ts`) sends a prepared builder's opening look with
  `arrived: true`. The domain strips that key only when Core's frame marks the call as its opening
  (`domain/.../node-run/arrival.ts` `webNodePreparedEntry`, `opening`, t728); otherwise `arrived`
  is an unexpected key (`node-run/run.ts` `ACCEPTED_KEYS`). Every refused opening (0102, 0141, 0204,
  0223) was a `web.output.dom-capture_snapshot` look on a prepared entry, and both that succeeded
  (0013, 0044) were plain navigations with no predecessors. So the frame's `opening` mark is likely
  missing on that path. Unconfirmed until W6 reproduces it.

Machine constraint: about 600 MB available (other lanes' tsc and a web build). Workers run only
the tests beside their change in one fork; the lead runs typechecks and audits serially between
waves.

Work split by file (worker labels are the report file names, `reports/t738-<label>.md`):

| Wave | Worker | Unit | Owns (Core unless marked) |
| --- | --- | --- | --- |
| 1 | a1-reset-witness (high) | A | `flow-bootstrap/site-reset/` except `start-check.ts` and `project-reset.ts` |
| 1 | a2-trial-act-address | A | `service/candidate-trial/landed-acts.ts`, `service/subflow-trial/run.ts`, `service/candidate-trial/run.ts`, `service/project-build/entry-preparation.ts`, `executor/graph-run.ts` |
| 1 | b1-write-records (high) | B | `nodes/data/write-records.ts`, `authoring/{record-output,matching,script-binding,draft-bindings,values}.ts`, `plan/flow-script-format.ts` |
| 1 | d1-downstream-hints | D | downstream `rejection-next/next-sentence.ts`, `output-nodes/definitions.ts`, `action-failure/refusal.ts` |
| 2 | b2-issue-places | B | `authoring/{locate-issue,script-locator,draft-routing}.ts`, `plan/validation.ts` |
| 2 | c1-loop-feedback (high) | C | `llm/repeat-guard/candidate-feedback.ts`, `subflow-candidate/builder-loop.ts`, `candidate/trial-view.ts`, `site-reset/start-check.ts` |
| 2 | c2-opening-arrived (high) | C | `llm/harness-options/*`, `service/project-build/brief-ports.ts`; downstream `node-run/arrival.ts`, `node-run/build-state/*` |
| 2 | c3-ending-truth (high) | C | `activity/wording/left-told.ts`, `activity/build.ts`, `conversations/commands/{build,execute}.ts`, `project-agents/dispatch/reset-done.ts`, `flow-bootstrap/unfinished-build/*`, `service/project-build/run.ts` |
| 3 | lead | all | typechecks, both audits, prompt contract tests, site-reset installed-gateway specs (serialized, headed, scripted provider) |

## Progress log

### 2026-10-20 — Wave 1 landed (A1, A2, B1, D1), lead review and follow-ups

- **A1 reset witness** (worker report `t738-a1-reset-witness.md`). Core `site-reset/`: new
  `reset-witness.ts` (pure: a reversible press with none of an issued ref, a recorded complete list
  it sits in, or a stated state at a place for exactly `modify_existing`); `create-baselines.ts`
  `check` refuses such a press before the seal with `candidate.reset_witness_required`, and any call
  naming a ref no receipt printed with `candidate.reset_destination_unissued`; `refsClosed()`;
  `ledger.ts` `claim(undoes, resetDestination)` refuses an unissued ref before the call runs;
  `settlement-words.ts` says a sealed no-ref act cannot be settled in this build and never prints a
  withheld place; `words.ts` gains the two instructions and one settle-model sentence. Unscoped
  presses and a lone `create_new` keep their old policy. Downstream `job-failed-save.spec.ts`
  scripted turns rewritten (not run yet).
- **Lead follow-up to A1**: the three claim forwarders dropped the ref, so the unissued refusal
  never fired under `undoes`. Fixed `flow-bootstrap/action-permissions.ts` `claimed()`,
  `service/project-build/acts-record.ts`, `service/project-build/reset-calls.ts` (baselines are one
  object per project, `project-ledger.ts:58`, so the owner's ledger resolves the same refs).
  Rewrote `flow-bootstrap/tests/action-permissions.test.ts` "F1 continuation" (it pressed an
  unwitnessed save first): now asserts the unwitnessed press is refused unrun, a ref-named press
  lands and seals, a later ref-less press is admitted and settled by a ref named under `undoes`;
  added a test that a look under `undoes` with an invented ref is refused before it runs.
  `npx vitest run .../flow-bootstrap/tests/action-permissions.test.ts --pool=forks
  --poolOptions.forks.singleFork` -> 27 passed.
- **A2 trial act address** (`t738-a2-trial-act-address.md`). New `executor/executed-locations/`
  (WeakMap keyed by the saved trace's `controls` object, filled once per graph run in
  `graph-run.ts`, same pattern as `withheldBySavedTrace`); `landed-acts.ts` takes only the location
  from it. Callers unchanged (detached runners drop `onExecutedTrace`). New seam test
  `subflow-trial/tests/trial-act-address.test.ts`; worker reports it fails with the fix reverted.
- **B1 write-records** (`t738-b1-write-records.md`). `nodes/data/write-records.ts`: `records`
  parameter (rows of values or `$step` bindings), input port no longer required, written rows win
  over the port, refusals `record_output.no_records|invalid_records|unresolved_value`;
  `authoring/script-binding.ts` resolves bindings nested in a JSON list or object (any parameter
  that takes bindings, not only write-records); `assembled-record-output.ts` derives columns from
  row keys; one generic example (account settings page) in `plan/flow-script-format.ts`. Lead
  checked the example binds `value`, the single-value read's real port (`domain/.../extract/value-port.ts`).
- **D1 downstream hints** (`t738-d1-downstream-hints.md`). `next-sentence.ts` incomplete_text
  sentence loads every row first and nests no repeat; scroll parameter description and example in
  `output-nodes/definitions.ts`; `action-failure/refusal.ts` names an unreadable scroll's keys from
  the request sent.
- **Lead follow-ups to D1**: wired the sent command through every failure path:
  `node-run/retries/uncertain-outcome.ts` (`webNodeFailureRefusal(result, lastingAct, sent)`),
  `node-run/run.ts`, `node-run/replay.ts`, `capture.ts`; test added to
  `node-run/retries/tests/uncertain-outcome.test.ts`. Aligned the extension's own failure text
  (`apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts`) with the new order.
  Updated the regex pin in `node-run/tests/run.test.ts` (it required "Next page" at the end) and
  added a no-"after each Next page" assertion.
  `DOMAIN_TEST_BUILD_LABEL=t738-lead node scripts/test-domain.mjs node-run/retries/tests
  action-failure/tests rejection-next/tests output-nodes/tests llm-evidence/tests/capture` -> 178
  pass, 0 fail; `... node-run/tests/run.test node-run/tests/replay` -> 101 pass, 0 fail (first run
  1 fail on the old pin, fixed).

### 2026-10-20 — Wave 1 lead verification

- Core, one fork, 93 files incl. site-reset, landed acts, subflow-trial, write-records, authoring,
  executor, the claim forwarders and the three contract tests -> `Test Files 93 passed (93)`,
  `Tests 1134 passed (1134)`.
- `node scripts/structure-audit.mjs`: Core `passed (421 warning(s), 1152 baselined)`; downstream
  first `1 violation`: my `sent` const put `node-run/run.ts` at 801 lines (limit 800); folded the
  command into the refusal call, back to 800 lines, then `passed (211 warning(s), 618 baselined)`.
- `npx tsc --noEmit -p tsconfig.json` (Core) -> one error, `landed-acts.test.ts(244)` passing a
  flow artifact to the graph runner; cast fixed in the test; re-run `tsc exit: 0`.

### 2026-10-20 — Wave 2 landed (B2, C1, C2, C3), lead review and wiring

- **B2 issue places** (`t738-b2-issue-places.md`). `plan/validation.ts`: input issues are written
  at the node's index (the locator already places index paths), the unconnected-input issue carries
  an `instead`, and a node whose input port has a same-id stand-in parameter (write-records
  `records`) with neither written nor connected is refused `bootstrap.missing_parameter` at its own
  step. `authoring/draft-routing.ts`: `repeat_body_is_routed` points at the inner repeat's line and,
  for a row loop, appends NO_ROW_LOOP_IN_PAGE_LOOP plus a load-the-growing-list-first clause
  (file now exactly 800 lines).
- **C1 loop feedback** (`t738-c1-loop-feedback.md`). New `llm/repeat-guard/unchanged-standing.ts`;
  `candidate-feedback.ts` tells an untried unchanged revision to call the test tool with its
  revision and digest (builder and candidate loops), a tried one to change what its feedback names;
  `outcomes.ts` carries `standing`. `builder-loop.ts` routes every `core.test_subflow` answer
  through `automationStudioCandidateTrialView`; `trial-view.ts` takes `targetMoved` and answers a
  refusal that moved the target with the page; `start-check.ts` counts `moves` (compare,
  compareAt, lookAt). Cause of office 0126/0159: the ledger's own look at stale places
  (`lookAt`), never reported as a move; photo 0057 had `effectApplied: true` and lost only the view.
- **Lead wiring for C1** (paths C1 did not own): `project-agents/dispatch/types.ts` `moves?`,
  `service/project-build/brief-ports.ts` returns `moves: () => reader.moves`,
  `project-agents/dispatch/run-brief.ts` forwards it, `flow-bootstrap/candidate/authoring-loop.ts`
  compares `startCheck.moves` around the whole-candidate test. Tests added to
  `project-agents/dispatch/tests/whole-trial-port.test.ts` (refused test after a moving reset
  carries `pageAfterTrial`; none when nothing moved) -> `6 passed`; mutation check (forwarding
  removed) -> `1 failed | 5 passed`, restored.
- **C2 opening arrived** (`t738-c2-opening-arrived.md`). Root cause differs from the lead's guess:
  the web panel bundles its own copy of Core (`apps/web/next.config.ts` `transpilePackages`) while
  the domain host imports Core's `dist`, so the process held two `AsyncLocalStorage` frame stores
  and the domain never saw Core's frame (evidence: office 0116, a read that a fresh frame would have
  refused `not_at_start_location`, succeeded). Fix: `llm/harness-options/evidence-build-scope.ts`
  and `evidence-build.ts` keep one store per process under `Symbol.for(...)`. Since t728 no live
  domain call saw a frame, so `held`/`repairs` openings and build memories were affected too. Core
  tests `19 passed`; domain reproduction in `node-run/tests/arrival.test.ts` needs Core's dist
  rebuilt (and the live panel rebuilt).
- **C3 ending truth** (`t738-c3-ending-truth.md`). `activity/wording/left-told.ts` +
  new `act-words.ts`: unnamed acts counted ("3 presses it could not name"), `seen: false` acts told
  as possibly unchanged; `project-agents/dispatch/reset-done.ts` names acts in words;
  `conversations/commands/execute.ts` draft line says what the whole test came to; new
  `service/project-build-ending/{reason-checked,record-told}.ts` and `service/project-build/run.ts`:
  ending rows state Core's record of part and whole tests and drop the model's part-level test
  claims where the record is said.
- **Lead wiring for C3**: `site-reset/ledger.ts` `changeSeen(actId)` getter;
  `project-agents/supervisor/left-on-target.ts` passes `seen` for acts in place. Test added to
  `project-agents/supervisor/tests/left-on-target.test.ts` (three unnamed presses, no change seen ->
  counted, "may not have changed anything", not "still on the site") -> with
  `activity/wording/tests`: `Tests 160 passed (160)`.
- Lead fixed four type errors in C1's new tests (`start-check-moves.test.ts` place missing
  `changed`, `builder-trial-view.test.ts` JsonValue, `untried-standing-repeat.test.ts`
  `Record<string, unknown>`), and renamed a test page id away from a store word.
- Downstream typechecks against the existing Core dist: `npx tsc -p tsconfig.json --noEmit`
  (domain) -> exit 0; `npx tsc -p tsconfig.test.json --noEmit` (domain) -> exit 0;
  `node scripts/check-extension.mjs` (extension src + tests + e2e) -> exit 0.

### 2026-10-20 — Final verification and wording fix

- Core typecheck after wave 2 and lead wiring: `npx tsc --noEmit -p tsconfig.json` -> 4 errors, all
  in C1's new tests (fixed, see above); re-run `TSC_EXIT 0`.
- Core, one fork, over repeat-guard, subflow-candidate, candidate, site-reset, authoring, plan,
  harness-options, activity/wording, conversations/commands, project-agents/dispatch and
  supervisor, service/project-build, action-permissions and the system-prompt contract test ->
  `Test Files 1 failed | 244 passed (245)`, `Tests 1 failed | 2131 passed (2132)`. The failure was
  `project-build-reset.test.ts` "save still in the box": with `seen` now passed, an open save that
  no read showed was told "may not have changed anything", while the fixture's save had really
  landed. I changed the open-act sentence in `activity/wording/left-told.ts` to hedge both ways ("no
  read ever showed a change from them, so they may have changed nothing; check them if you need the
  site exactly as it was"). `reset-done.ts` keeps "may not have changed anything", because it says
  that only of acts the ledger settled as unchanged on fresh complete reads. Updated
  `left-told.test.ts`, `left-on-target.test.ts` and `project-build-reset.test.ts`. Those three files
  with `reset-done.test.ts` -> `Test Files 4 passed (4)`, `Tests 26 passed (26)`.
- `npx vitest run .../service/project-build-ending/tests` (C3's ending-truth tests) -> `Tests 4 passed (4)`.
- Mutation check of A2: with the location line in `landed-acts.ts` reverted -> `Tests 2 failed | 13
  passed` (both new address tests failed); file restored.
- Core libraries rebuilt: `pnpm --filter @fluxiq/contracts --filter fluxiq --filter
  @fluxiq/client-gateway-websocket build` -> `BUILD_EXIT 0`. Downstream `node
  scripts/check/core-build.mjs` -> "current with its source".
- Domain against the rebuilt dist: `DOMAIN_TEST_BUILD_LABEL=t738-lead node scripts/test-domain.mjs
  node-run/tests/arrival node-run/tests/run.test node-run/tests/replay node-run/retries/tests
  action-failure/tests rejection-next/tests output-nodes/tests llm-evidence/tests/capture` ->
  `# tests 301`, `# pass 301`, `# fail 0`. C2's reproduction now passes.
- Extension: `pnpm test:e2e:build` -> `EXT_BUILD 0`. Site-reset installed-gateway specs, headed,
  scripted provider, `--workers=1`, a separate `--output` folder per run under the lead's scratchpad:
  - `job-failed-save.spec.ts` -> `1 passed`. Diagnostic: `{"ending":"proposed","tests":["yes"],
    "refused":"candidate.reset_witness_required"}`. This reproduces the job shape without a
    provider: an unwitnessed save is refused unrun, the save that names the ref is admitted, Core's
    own look settles it, and the trial runs.
  - `installed-project.spec.ts` (2 tests), `office-buy-now.spec.ts` (2), `photo-toggle.spec.ts` (1)
    -> `5 passed (4.4m)`.
- Both structure audits on the final tree: Core `passed (424 warning(s), 1152 baselined)`,
  downstream `passed (211 warning(s), 618 baselined)`.

### Open points for the supervisor

- **Frame stores (C2): larger than the office symptom.** Since t728, the live panel's domain never
  saw Core's frame, so `held` and `repairs` openings and build memories were affected as well.
  Expect the next live run to behave differently on those paths. Both the Core dist and the web
  panel must be rebuilt from this source before a live run. A structural follow-up was not done
  here: make `fluxiq` server-external in Core's `apps/web/next.config.ts`, or add a check that flags
  module-level stores on Core's public exports.
- `service/project-build-ending/reason-checked.ts` drops any sentence of the model's ending reason
  that names a part, stage, section or step together with a test, pass, fail or work word, whenever
  Core's record is shown. This is broad by design: a reason such as "the save step failed because
  ..." loses that sentence.
- A1's scope: unscoped presses and a lone `create_new` keep their old policy, and the stated-state
  witness counts only for exactly `modify_existing` with a place. Subject distinctness (the "Open"
  item in the job debug note) was not taken up.
- The rewritten job spec no longer checks that an undo aimed at a job saved before the build is
  refused. That rule is still covered by unit tests in `site-reset/tests/`.
- B1's nested-binding reader applies to every parameter that takes bindings, not only write-records.
- A2 keys the executed address by the saved trace's object identity, as `graph-run.ts` already keys
  its other per-trace data. A cloned trace falls back to no address, which the settle words now omit.
- The unchanged-submission codes are listed in two files (`candidate-feedback.ts` and
  `unchanged-standing.ts`).
- `flow-bootstrap/plan/index.ts` shows as modified but has no content change (line endings only).

UNIT READY: Core `flow-bootstrap/site-reset/{reset-witness,create-baselines,ledger,settlement-words,words,contracts,index}.ts`, `site-reset/tests/{reset-witness,create-baselines,settlement-shapes}.test.ts`, `flow-bootstrap/action-permissions.ts`, `flow-bootstrap/tests/action-permissions.test.ts`, `service/project-build/{acts-record,reset-calls}.ts`, `executor/executed-locations/{locations,index}.ts`, `executor/{graph-run,index}.ts`, `service/candidate-trial/landed-acts.ts`, `service/candidate-trial/tests/landed-acts.test.ts`, `service/subflow-trial/tests/trial-act-address.test.ts`; downstream `apps/extension/e2e/site-reset/tests/job-failed-save.spec.ts` (Unit A: reset witnesses and trial acts)

UNIT READY: Core `nodes/data/write-records.ts`, `nodes/data/tests/write-records.test.ts`, `flow-bootstrap/authoring/{script-binding,assembled-record-output,record-output,matching,draft-routing}.ts`, `authoring/tests/{written-rows,locate-issue,candidate-loops}.test.ts`, `candidate/tests/refusal-locator-corpus.test.ts`, `plan/{flow-script-format,validation}.ts`, `plan/tests/{flow-script-format,validation}.test.ts` (Unit B: script format)

UNIT READY: Core `llm/repeat-guard/{candidate-feedback,unchanged-standing,outcomes,index}.ts`, `repeat-guard/tests/untried-standing-repeat.test.ts`, `subflow-candidate/builder-loop.ts`, `subflow-candidate/tests/builder-trial-view.test.ts`, `candidate/{trial-view,authoring-loop}.ts`, `candidate/tests/trial-view.test.ts`, `site-reset/start-check.ts`, `site-reset/tests/start-check-moves.test.ts`, `project-agents/dispatch/{types,run-brief}.ts`, `project-agents/dispatch/tests/whole-trial-port.test.ts`, `service/project-build/brief-ports.ts`, `llm/harness-options/{evidence-build-scope,evidence-build}.ts`, `harness-options/tests/evidence-build-scope.test.ts`, `activity/wording/{left-told,act-words,index}.ts`, `activity/wording/tests/{left-told,act-words}.test.ts`, `project-agents/dispatch/reset-done.ts`, `project-agents/dispatch/tests/reset-done.test.ts`, `project-agents/supervisor/left-on-target.ts`, `project-agents/supervisor/tests/left-on-target.test.ts`, `conversations/commands/execute.ts`, `conversations/commands/tests/execute.test.ts`, `service/project-build/run.ts`, `service/project-build/tests/{project-build-facade,project-build-reset}.test.ts`, `service/project-build-ending/**`; downstream `domain/src/runtime/llm-evidence/node-run/tests/arrival.test.ts` (Unit C: loop feedback, trial views, the opening frame, ending words)

UNIT READY: downstream `domain/src/runtime/llm-evidence/rejection-next/next-sentence.ts` (+ its test), `domain/src/output-nodes/definitions.ts`, `domain/src/output-nodes/tests/scroll-node-text.test.ts`, `domain/src/runtime/llm-evidence/action-failure/refusal.ts` (+ its test), `node-run/retries/uncertain-outcome.ts` (+ its test), `node-run/{run,replay}.ts`, `node-run/tests/run.test.ts`, `llm-evidence/capture.ts`, `apps/extension/src/content/extraction/text-disclosure/text-disclosure.ts` (Unit D: downstream hints and scroll keys)
