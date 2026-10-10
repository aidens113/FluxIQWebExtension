# t392 executor integration (waves 2-3) - lane report

Lead: lane lead (Claude). Trees: Core `C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQ`, downstream
`C:/Users/osrs_/FluxStuff/fxwork/t392/!FluxIQWebExtension`, both on `task/t392-executor-integration`. Nothing
committed. AS = `packages/fluxiq/src/programs/automation-studio/`.

## Plan

| Unit | Contract | Worker | Files (owned) | State |
| --- | --- | --- | --- | --- |
| hooks | C1/C11 | lead | `AS/runtime/executor/contracts.ts` (`framePath`, `subflowTarget`, options `invocation`, `subflowGraphs`), `AS/runtime/executor/frames/invocation-options.ts` | Done |
| A | C1 | worker-high | frames, graph-run (minimal), composite-execution, call-subflow node, routine removal, service wiring, runtime-session | Done |
| B | C11 | worker | contracts.ts trace types, refusal types, run detail, summaries, activity, stream store, client-gateway, extension mirror | Done |
| E1 | C6 step 8 patch kinds | worker-high | llm/harness, live-patch | Done |
| C0 / C1 / C2 | C3, C5, C6 1-7, C7 | worker-high x3 | step-loop extraction; host facts + dispatcher; graph-run wiring | Done |
| G | t388 compat | worker-high | Call Subflow shape, fixture, `metadata.requires`, fact handles | Done |
| D1 / D2 | C2, C6 safe routing | worker, worker-high | state-routing; entries, checkpoints, success check, counts | Done |
| F1 / F1b / F2 | C8, B3 | worker-high, worker, worker-high | late results, `interrupted`, sweep; effect check | Done |
| P / RC / H / I | packing, regression, C11, prompt | various | statement-packing; exploration test; cleared layers; in-run slot | Done |
| E2a / E2b / K / R1 / R2 / R3 | C6 step 8-9, C12 | worker-high | hold in place; supplier + applier + docs; proofs; pipeline; tests; defects | Done |

## Ledger

### Hooks (lead)
- Added `framePath?`, `subflowTarget?` on the attempt trace and `invocation?`, `subflowGraphs?` on the graph
  execution options; the option types live in `frames/invocation-options.ts` (A owns that file from here on).
- Validation: `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  in `packages/fluxiq` -> no output (clean).

### A, B, E1 verified (lead)
- A (Call Subflow, report `t392-call-subflow.md`): frames pushed/popped in `finally` (`frames/graph-frame.ts`), `framePath`
  stamped once per frame (`frames/framed-trace.ts`), one typed boundary for Call Flow and Call Subflow
  (`composite-execution/boundary.ts`), container one attempt (`retry-policy.ts`), cycle/missing refusals, Router mapping
  and sibling source in `service/runtime-session/subflow-frame.ts`, `service.ts` still 4380 lines, `subroutine.ts` gone,
  `flow.subflow-calls@1` granted. Read the diffs of graph-run, service, retry-policy, call-subflow, attempt dispatch.
- B (trace contract, report `t392-trace-contract.md`): `lifecycle`/`entry`/`failureClass` on attempts, `refused` on
  state routing, run-detail projection, `handler_execution` stream kind, `detail.recovery` on step rows, extension
  reader `apps/extension/src/shared/activity/step-recovery.ts`. Protocol version unchanged (additive).
- E1 (patch kinds, report `t392-repair-patch-kinds.md`): `add_handler`/`replace_unit` schema, validation, one pure
  overlay (`live-patch/overlay.ts`) with unit digest guard; offered only with `inRunRepair`. Gap carried to E2: both
  map to `edit_recovery`, which has no durable applier.
- Validation (lead, Core `packages/fluxiq`): tsc -> no output; `node scripts/structure-audit.mjs | tail -1` ->
  "structure-audit: passed (300 warning(s), 708 baselined)."; `npx vitest run` over executor, composite-execution,
  composite-executor, router-runtime, service-flows, runtime-session, summaries, activity, runtime-stream-store, nodes,
  llm/harness/tests, live-patch, live-patch*.test, recovery, model -> "Test Files 232 passed (232) / Tests 2127 passed".
  Downstream: `node apps/extension/scripts/test-extension.mjs shared/activity/tests` -> "# tests 31 # pass 31 # fail 0";
  extension `npx tsc -p tsconfig.json --noEmit` -> exit 0.
- Main told of A+B (contract for chat cards) by message.

### Core dev merged (main)
- The hook blocks `git merge` for the lead; main fast-forwarded the Core branch to dev `5a3bf045` (t388, t391). No overlap
  with uncommitted files.
- Found: t388's dialog fact (`op: "visible"`, name in `target`) is refused as unsupported by t389's domain parser
  (`domain/src/runtime/facts/query.ts`: dialog takes exists/absent/contains with the name in `value`), so every dialog
  handler would stay `unknown`. Reported to main for a domain fix (outside this lane).

### Course corrections from main
- C gains: fact `{handle}` targets resolved like step targets; parent `metadata.requires` written at candidate save
  (`service.ts` ~3486). Unit G takes both plus t388's Call Subflow shape and fixture.
- New unit F after C: Core side of lost-command reconciliation (C8/B3, t393).

### C0, C1, G verified (lead)
- C0 (`t392-step-loop-extraction.md`): graph-run 796 -> 431 lines, seams in `executor/step-loop/`, no behaviour change.
- C1 (`t392-lifecycle-dispatcher.md`): host `factEvaluator` (domain runtime assignable), batched observation, registry
  on the run holder, `dispatchAutomationStudioLifecycleEvent` (none / authored / handled), incidents, start-node and
  graph-navigation exclude handlers.
- G (`t392-authoring-compat.md`): t388's `call:` shape runs (inputs are values; part outputs read through
  `metadata.binding`), real Call Subflow in t388's fixture, parent `metadata.requires` written at apply (extracted
  module, `service.ts` 4380 -> 4368), fact `{ handle }` resolved at bootstrap completion via `fluxiq.fact.target`
  (domain side is t400, merged).
- Validation (lead): tsc no output; audit passed (304 warnings); narrow vitest 447 files / 4715 passed.

### Statement-packing, C2, D1, F1, P verified (lead)
- t397's rule flagged 8 of our files; P, C2 and F1 fixed theirs. Lead added D1's three guard codes to the shared
  unions and widened the run-detail projection (`summaries/state-routing.ts`).
- C2 (`t392-lifecycle-wiring.md`): five events wired; `flow.handlers@1` granted. Decision (main confirmed):
  `failureClass` is stamped only with a Handler in scope; incidents mark true failure in every run.
- D1 (`t392-checkpoint-routing.md`), F1 (`t392-lost-commands.md`, partial -> F1b).
- Validation (lead): tsc + contracts tsc clean; audit passed (308 warnings, 1160 baselined); narrow vitest 504 files /
  5146 passed.

### D2, F2, F1b verified; service.ts saves (lead)
- D2 (`t392-entries-checkpoints.md`): entries after On Start, ancestor routes unwind, success check at End (no default
  from the End's `expectedState`), incident records and `failureCounts` for every run.
- F2 (`t392-effect-check.md`): one effect-check hook; uncertain lasting act checked before any rung; interrupted
  committing record now reaches it.
- F1b (`t392-lost-commands-finish.md`): literal `interrupted` (lead added it to the two status unions; migration
  0024), late results on ordinary commands attached to their run, swept `queued` sessions.
- Lead: t398's `validation: { subflowRole }` on both subflow-graph saves and the projection check in `service.ts`
  (net 0 lines); test "applies a Flow whose handler applies everywhere" added; mutation check: without the role the
  apply fails `flow.handler_automation_scope_outside_recovery`. Fixed t398's `written-labels.test.ts` call for G's
  fixture signature; `run-control.ts` ENDED includes `interrupted`.
- Validation (lead): tsc no output; audit passed (312 warnings); narrow vitest 577 files / 5582 passed.

### E2a, E2b, RC, K, H, I (lead)
- RC (`t392-exploration-regression.md`): A's Call Subflow node grew every request's catalog by 162 tokens on a
  135-token margin under the test harness's 20,000 stand-in limit; harness limit raised with a reason. Main confirmed
  dev passes the test. Note for main: the harness size check counts the full catalog (~8x what is sent).
- E2a (`t392-in-run-repair-executor.md`), E2b (`t392-in-run-repair-session.md`), I (`t392-in-run-repair-prompt.md`):
  hold in place, one `runtime_patch` request per incident with a typed `inRunRepair` slot and stage instruction,
  overlay, trial, drop on a failed trial; durable `add_handler` / `replace_unit` applier after the judged end;
  architecture doc rewritten.
- K (`t392-in-run-repair-proofs.md`): seven service-level proofs; representation tests rewritten to the in-run path.
  Found a deliberate-stop defect and ~42 `runtime/tests/service-adaptation` failures (old after-run path).
- H (`t392-cleared-layers.md`): `clearedLayers` on attempts and `interference` recovery rows; domain lift reported to
  main. Lead fixed the extension's `gateway-session.ts` for the `interrupted` reported status (tsc clean;
  `background/connection` tests 281/281).

### R1, R2, R3 and lead follow-ups
- Sweep after E2 found 43 failures (42 in 13 `runtime/tests/service-adaptation` files, 1 datasets wiring): the in-run
  supplier had its own single request and skipped the after-run gates. R1 (`t392-in-run-repair-pipeline.md`): the
  callback now runs today's diagnosis -> patch pipeline (`recovery/annotation/annotate.ts` + `in-run.ts`) with every
  gate; a deliberate stop (failed End, `resultStatus: failed`) ends the run with its authored reason, no incident, no
  model (`llm.gate.deliberate_stop`). R2 (`t392-adaptation-tests.md`): the 18 left moved onto the in-run path, each
  changed expectation tabled with its plan clause; lead decision: a held fix becomes `validated`. R3
  (`t392-in-run-repair-defects.md`): repaired run judged against the Flow it ran; kept fixes counted as durable
  changes; one-unit rule (C12) enforced before any trial; validation only on positive evidence.
- Lead: in-run offer narrowed to kinds that change only the failing node (`recovery/plan.ts`, test added);
  `transition-comparison.ts` marks host-judged comparisons (`metadata.hostEvaluated`) and held-fix validation reads
  it, so a throwing evaluator proves nothing (tests added in `executor/tests/transition-comparison.test.ts` and
  `held-fix-validation.test.ts`); architecture doc updated (offer, one-unit rule, evidence, verification); Core plan
  Current State, C11 note (failureClass decision) and ledger; regenerated `docs/reference/framework-reference.md`
  (`node scripts/docs-reference.mjs`) and the working-docs index plus baseline (`node scripts/structure-audit.mjs
  --update`: 3 lowered, 3 removed).

## Final validation (lead, 2026-10-09)
- Core `packages/fluxiq`: `npx tsc --noEmit --incremental --tsBuildInfoFile node_modules/.cache/fluxiq-build/check.tsbuildinfo`
  -> no output; `packages/contracts` and `packages/client-gateway-websocket` `npx tsc --noEmit -p tsconfig.json` -> no output.
- Core root: `node scripts/structure-audit.mjs | tail -1` -> "structure-audit: passed (317 warning(s), 1160 baselined).";
  `node scripts/docs-reference.mjs --check` -> "Deterministic framework reference is current."
- `npx vitest run` over AS `runtime/tests`, `runtime/executor`, `composite-execution`, `runtime/service`, `activity`,
  `parking`, `run-control`, `conversations`, `llm`, `live-patch`, `recovery`, `flow-bootstrap`, `durable-behavior`,
  `storage`, `nodes`, `model`, `api`, plus `src/client-gateway` and `src/programs/_shared` ->
  "Test Files 839 passed | 3 skipped (842)", "Tests 7853 passed | 7 skipped (7860)". Not the whole-package suite.
- Downstream: extension `tsc -p tsconfig.json` and `tsconfig.test.json` -> no output; domain both configs -> no output;
  `node apps/extension/scripts/test-extension.mjs shared/activity/tests background/connection` -> "# tests 313 # pass 313
  # fail 0"; `node scripts/structure-audit.mjs | tail -1` -> "structure-audit: passed (184 warning(s), 651 baselined)."

## Proofs (provider-free) and where they live
| Proof | Test |
| --- | --- |
| Popup before step 1 and midway handled, run resumes, no act repeated | `AS/runtime/executor/lifecycle-run/tests/wiring.test.ts` (On Before; On Retry) |
| Removal fails: no loop, honest end | same file, "ends honestly, without a loop" |
| Node scope beats automation scope, trace says why | same file (`selection`) |
| An inactive part's handler never runs | same file, "never runs a handler stored in a graph no frame runs" |
| Equivalent fallback passes the same success check | `lifecycle-run/tests/success-check.test.ts` |
| Route to a checkpoint does not repeat a confirmation | `lifecycle-run/tests/checkpoint-routes.test.ts` |
| Retries and planned fails: zero model calls; true failure: one repair consultation (diagnosis + patch, per C6 step 8 "today's diagnosis -> patch"), run carries on | `AS/runtime/tests/in-run-repair/tests/service-proofs.test.ts` (real service, scripted model); executor level `lifecycle-run/tests/in-run-repair.test.ts` |
| Flow with no Handlers: zero fact calls, identical trace | `lifecycle-run/tests/wiring-boundaries.test.ts` |

## Existing tests whose expectations changed (by the plan's new behaviour; details and clauses in the named reports)
- `runtime/tests/service-adaptation/**` (13 files, 42 cases) and `service-flows/tests/representation.test.ts` (2):
  after-run repair -> in-run repair (R1, R2 tables).
- `flow-bootstrap/authoring/tests/state-statements.test.ts` (t402 case: a handle beside a locator is now resolved; RC),
  `written-labels.test.ts` (fixture arity; lead), `runtime/tests/deepseek-bootstrap/tests/harness.ts` (stand-in
  per-call limit 20k -> 28k because the built-in catalog grew; RC; dev passes at 19,865/20,000).
- Executor, state-routing, ladder, composite, Router tests: unchanged.

## Decisions taken (supervisor may revisit)
- `failureClass` stamped only with a Handler in scope; counts for every run come from incident records (main confirmed).
- In-run repair runs today's diagnosis -> patch pipeline (one consultation, two calls), not a single call.
- A held fix is `validated` only on host-judged expected state or all declared outputs observed; saved only after the
  judged end. In-run offers only kinds that change the failing node, plus `add_handler` / `replace_unit`.
- No default success check from the End's `expectedState`. `interference` added as a recovery kind (main informed).

## Needs a live check
- Handlers on a real page (dialog facts after t389/t400 fixes), in-run repair with a real provider under the cost
  ceiling, Call Subflow through the real extension, the effect check on an interrupted command after a service-worker
  restart, the orphan sweep after a Core kill, cleared-layer rows (the domain lift is on downstream dev, not in this
  tree).
- Exploration acting on the page while a run is held (R1 note); child-frame and part repairs through the service.
- Harness design note for main: the per-call size check counts the full catalog (~8x what a request sends,
  `llm/harness/run.ts:381`).
