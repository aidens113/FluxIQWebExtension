# Repair acts on the verifier's instructions (worker report)

Status: done (Core working tree, uncommitted). Three machine crashes interrupted
this brief; after each, every file was re-checked for truncation and NUL bytes.
The third crash zeroed `result-verification/tests/run-outcome.test.ts` and the
two files being split out of it. The test file was restored from HEAD and the
split redone. My earlier uncommitted edits to that file were lost with it, and
their cases were rewritten against the current loop (see below).

**The brief's own text was lost in the second restart**, and is not in the
working document. This report's diagnosis sections (items 1, 3, 4) and the
coordinator's follow-up messages were the reconstruction. Item 2's wording is
known only from the open question below (qualifying clauses, including dedupe
and sort, become node parameters).

## Diagnosis (brief item 1): what the re-author received

Path: `result-verification/run-outcome.ts` hands a refuted run to
`repairAutomationStudioRefutedRunResult` (`recovery/refuted-result/repair.ts`),
which builds the synthetic failed attempt (`attempt.ts`) and calls the
service's `repairRefutedResult` port. The port was a closure in
`runtime/service.ts`, and it called the build with only
`{ projectId, flowId, mode: "extend", evidenceGuided: true, executionGrant }`.
The verifier's directive (findings, fix lines, screened judgement and advice)
and the result summary were in the port's input and were dropped at that call.
The build's model calls carried the Flow's own instructions only. So the
re-author was a fresh build of the same instruction, seeded with the existing
Flow as its draft, and was never told the Flow had been judged wrong, why, or
what to change. The catalog told it that `where` is optional ("omit it, keep
every item, narrow later"), and nothing said that "later" had arrived.

There is **no dedupe and no sort parameter on the extract node, and none
anywhere in Core** (both repos searched). That is a domain gap.

## Diagnosis (brief item 4): repeated refutation

No second attempt was ever made. `repair.ts` returned at its first line when
`metadata.resultRepair.attempted === true`, and that marker survives the rerun,
so a second refutation was recorded and never repaired.

## Diagnosis (brief item 3): why the re-author is unrecorded

The build's decision rows sit on its adaptation, but the run's `resultReauthor`
record held only `{routed, adaptationId, applied, code}`. The Lab never reads
the adaptation, and a re-author that threw lost its diagnostic's evidence-loop
summary entirely.

## Diagnosis (coordinator item): run-mulxk0ro-36bf090d's re-author, `flow_bootstrap.unexpected_error`

**Cause, reproduced in a test against the real code:** a wrong-answer repair
extends the Flow that ran, and `node-tools/draft-from-flow.ts` seeds the Flow's
nodes into the draft with their parameters. The draft is shown to the model as
an evidence item beside the loop's evidence. A web click, type or keypress step
holds its resolved locator under `selector` and `element.selector`. The bundle's
`parametersWithheld` lists both for this Flow's click, type and keypress nodes.
`selector` is one of the web domain's denied evidence keys. `packEvidenceLoop`
(`llm/harness/context-packet.ts`) screens every evidence item for denied keys
and throws a plain `Error`. So the very first decision of the repair was refused
while being built, before any provider call. The service's `runHarness` wrapper
classified the plain error at stage `provider_request` as
`flow_bootstrap.unexpected_error`, and the repair ended.

`llm/harness/tests/draft-screen.test.ts` asserts the precondition on the real
seed and entry builders: a draft seeded from a Flow with a click and a type step
trips the denied-key screen.

Why run 1 (`run-mulwm2dc-0bd95f22`) got through with the same grant shape: its
Flow was navigate plus extract. **Not verified.** It is consistent with the draft
entry replacing an extract step's large input with an `inputTooLarge` line, so
its selectors never appear. The `builtin.control.merge` node the debug pointed at
is a red herring: seeding skips nothing but start and end, and merge carries no
denied key.

## Outcome

Done. The re-author is given the verifier's findings and advice and every
earlier attempt. A re-run refuted again is repaired again, up to a bound, and
stops early when the answer stops changing. Every attempt is recorded on the
run. The mulxk0ro refusal is fixed at its cause. Every request guard, and each
of the port's own guards, now throws a closed code. A re-author build that fails
is retried once if retryable, then degrades to the patch ladder rather than
ending.

## What changed and why

All in `F:\!FluxIQ\packages\fluxiq\src\programs\automation-studio\runtime\`.

Brief items 1, 3 and 4 (done before the crashes, re-verified after):

- `recovery/refuted-result/brief.ts` (new) builds the repair brief: repair
  attempt n of max, what the run stored (counts, columns), the step the rows
  came from and its authored parameters, Core's findings and fix, the check's
  advice, and each earlier attempt (it says so outright when an attempt left
  the answer unchanged). It tells the build that "narrow later" is now. It is an
  instruction riding beside the Flow's own instructions on every model call of
  the build, and it is never stored. It sorts after the person's instruction and
  fits the budget.
- `recovery/refuted-result/history.ts` (new) is the loop's memory:
  `AUTOMATION_STUDIO_RESULT_REPAIR_MAX_ATTEMPTS`, a history entry per refutation,
  an answer digest over rows and step parameters, and the continuation rule (stop
  as `result_repair.not_converging` after two unchanged repairs in a row, or as
  `result_repair.attempts_exhausted` past the bound). The run record carries
  counts and Core's own lines, never the check's prose.
- `recovery/refuted-result/repair.ts` and `attempt.ts`: multi-attempt loop
  replacing the one-shot guard. A `phase` marker (`reauthoring`, `rerunning`,
  `settled` with an outcome) is written while the repair runs.
- `recovery/refuted-result/reauthor.ts`: the `resultReauthor` marker keeps an
  `attempts` list (duration, accounting, the failed build's evidence-loop rows,
  and the brief record).
- `result-verification/run-outcome.ts`: passes the history through re-runs and
  settles the phase.
- `service/runtime-adaptation/refuted-result-port.ts` (new): the port, moved
  out of `service.ts` (which shrank by about 20 lines). `service.ts` passes the
  brief into `generateFlowBootstrapAdaptationInternal`, which adds it to the
  `instructions` of the `evidence_tool_decision` and `flow_bootstrap` harness
  calls only.

Coordinator item (mulxk0ro):

- `llm/harness/draft-screen.ts` (new): `automationStudioLlmDraftEntryWithoutDeniedKeys`.
  For the draft entry (`core.flow_draft`) only, it removes denied keys at any
  depth from the copy shown to the model, and adds a `withheld` note. The loop's
  own draft is untouched, so a step the model keeps keeps its working locator.
  Gathered page evidence carrying a denied key is still refused whole.
- `llm/harness/context-packet.ts`: `packEvidenceLoop` screens the draft through
  the function above before its refusal check.
- `llm/harness/request-refusal.ts` (new): `AutomationStudioLlmRequestRefusedError`
  and seven closed codes (`llm.request.evidence_denied_key`, `routing_denied_key`,
  `denied_keys_undeclared`, `reusable_context_invalid`, `diagnosis_misplaced`,
  `failure_evidence_invalid`, `exploration_evidence_invalid`). Every plain throw
  in `context-packet.ts`, `explored-evidence.ts` and `failure-evidence.ts` now
  throws it. Messages are unchanged and still never travel.
- `flow-bootstrap/generation-failure/codes.ts` and `phase-failure.ts`: seven
  `flow_bootstrap.request_refused_*` codes at `pre_provider_validation`.
  `automationStudioFlowBootstrapFailureDiagnosticOf` maps a request refusal to
  its code (recognised by `name` and `code`, with a type-only import from `llm`),
  whatever stage the caller vouched for, with `providerInvocation: not_attempted`.
- `refuted-result-port.ts`: the port's own guards throw the existing closed grant
  codes (`execution_grant_unavailable`, `execution_grant_purpose_invalid`) instead
  of plain errors. **Defensive rule:** a build that produced no edit and whose
  failure is `retryable` is built once more, with both attempts recorded. A build
  that still produced nothing degrades to the patch ladder (`deps.annotate`, the
  path a refutation the route does not take is given). A ladder that throws in
  turn is recorded as `degraded.failed`.
- `recovery/refuted-result/reauthor.ts`: `automationStudioRefutedResultDegraded`
  writes `resultReauthor.degraded = { to: "patch_ladder", afterCode, failed? }`.

Structure: `result-verification/tests/run-outcome.test.ts` had passed the
800-line hard limit (813). The repair loop's cases moved to
`tests/run-outcome-repair.test.ts`, with the shared fixtures in
`tests/run-outcome-harness.ts`. The main file is 542 lines.

Tests added or rewritten: `llm/harness/tests/draft-screen.test.ts` (4),
`flow-bootstrap/generation-failure/tests/request-refused.test.ts` (2),
`service/runtime-adaptation/tests/refuted-result-port.test.ts` (4: guard
refusal degrades and is not retried; missing grant named; retryable failure
rebuilt and applied; ladder throw recorded),
`result-verification/tests/run-outcome-repair.test.ts` (5, including "repairs
again ... stops when the answer stops changing": 2 repairs, 2 re-runs, the
second handed attempt 1, settled `stopped` / `result_repair.not_converging`;
and the phase case: `reauthoring` during the build, `settled` / `answered` at
the end), plus `brief.test.ts` (4) and `history.test.ts` (6) from before the
crashes. `history.test.ts` needed one typing fix (`JsonObject` for the
parameters fixture), which tsc caught after the first crash.

## Commands run and observed results

- `npx tsc --noEmit` (packages/fluxiq) -> exit 0, no output (after the split and
  after one missing type import was added).
- `npx vitest run runtime/result-verification runtime/recovery/refuted-result runtime/tests/refuted-result runtime/service/runtime-adaptation runtime/flow-bootstrap/generation-failure runtime/llm/harness`
  -> `Test Files 38 passed (38)`, `Tests 659 passed (659)`.
- `npx vitest run runtime/llm runtime/flow-bootstrap runtime/flow-draft`
  -> `Test Files 95 passed (95)`, `Tests 1309 passed (1309)`.
- `npx vitest run runtime/tests/service-bootstrap` plus the DeepSeek bootstrap,
  recovery-request, reusable-context and grant-limit tests: first run
  `4 failed | 127 passed (131)` (adaptation, catalog, permission and
  plan-parameters in service-bootstrap). The four files alone: `31 passed (31)`.
  The whole group again: `Test Files 20 passed (20)`, `Tests 131 passed (131)`.
  The first run's failures did not reproduce. Another worker was editing
  `flow-bootstrap/plan/` and `flow-bootstrap/instructed-acts/` at the time, and
  this machine has faulty RAM, so this rests on one clean rerun.
- `node scripts/structure-audit.mjs` (Core root): first `FAIL [file-lines]
  run-outcome.test.ts: 813 lines`; after the split, no violations, advisory
  warnings only, and "1 baseline entries can be lowered" (not run:
  `pnpm structure:baseline` writes a shared file).

## Not verified

- No live run. Whether the next wrong-answer repair on a Flow with click, type or
  keypress steps now builds and applies an edit is unmeasured.
- That run 1's re-author passed because an extract step's large input is shown
  as `inputTooLarge` without its selectors (inferred, not tested).
- The port's retry and degrade are unit-tested with stub dependencies. The
  service-composition test (`reauthor-service.test.ts`) does not exercise a
  refused request through the real `runHarness` wrapper.
- The full Core `pnpm check` and `pnpm test` were not run, only the directories
  above and the structure audit.
- The Lab (this repository) does not yet read `resultReauthor.degraded`, the
  `attempts` list, or the brief record.

## Open questions or contradictions found

- Dedupe and sort do not exist as extract-node parameters (domain). The brief
  asks that a dedupe or sort fix turn into node parameters, which needs a domain
  change outside this brief's ownership.
- The re-author still requires the grant purpose to be `build_and_adapt` or
  `explore_and_adapt`. It is now named by a closed code rather than thrown
  plainly, but under the standing grant rule a purpose gate on the automation's
  own repair should arguably be removed. That is left to the supervisor, because
  a grant with another purpose may not carry the build's budget.
- Other files modified in Core's working tree are not mine and were not touched:
  `flow-bootstrap/plan/*`, `flow-bootstrap/instructed-acts/`, `llm/index.ts` and
  `llm/deepseek/*`.
