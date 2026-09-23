# t099 — a Flow that runs cleanly and returns the wrong answer is now repaired

All source changes are in **FluxIQ Core**, in the worktree
`F:/fxwork/t099/!FluxIQ` on `task/t099-repair-wrong-answer`. The
web-extension worktree `F:/fxwork/t099/!FluxIQWebExtension` has **no source
change** — only this report. Nothing under
`packages/test-runner/src/flow-lane/**` was touched. No Lab run, campaign or
provider run was started. Nothing was committed or pushed.

## Outcome

Done. A run whose every node succeeded and whose result Core's own
verification refuted now reaches the repair planner as a repairable failure,
is repaired automatically through the existing failure entry point, and the
repair is handed the result, the conversation, the page, the Flow's shape and
the failure's own record. Three of the five required context pieces are
complete; two are partial and the gaps are stated below with what closing them
would cost.

## The defect, and the four gates that produced it

The post-mortem's cause 2 named one gate (`recovery/plan.ts` emitting
`stop`). Reading the code, there were four, and all four had to go:

1. **Ordering.** `runRuntimeSession` annotated the run with the recovery
   *before* verifying its result (`service.ts:2820` / `:2876`, then `:2844` /
   `:2898`). At annotation time the run still said `succeeded`.
2. **The annotation's first line.** `annotateAutomationStudioRunDetailWithRuntimeLlm`
   returns immediately on `detail.summary.status !== "failed"`.
3. **The planner.** `plan.ts:100` returns `unclassifiedPlan` when there is no
   failed attempt — `steps: [{action: "stop"}]`, the exact record both
   `ten-sites-r5` runs carry.
4. **A fourth gate the brief did not name, found by the concurrent design
   worker and confirmed here.** `service.ts` returned a *retried* session
   without verifying it at all, so a repair's own product was never judged. A
   repair that produced a second wrong answer was reported as a success.

## What was built

### 1. A wrong answer is a repairable failure

`runtime/recovery/refuted-result/attempt.ts` (new) turns a refuted
verification into the failed attempt the ladder was waiting for. It reuses the
`AutomationStudioFailureRecord` the verification **already** produces
(`core-observation.ts:74`, category `output_not_observed`, stage
`verification`, with `expected` and `actual`) — no second judge, no new
failure class, no contract change.

- The node it names is the last attempt that stored records, falling back to
  the last that succeeded. That is the node a repair edits or inserts steps
  ahead of, and the node whose page the failure-evidence capture reads.
- It claims nothing about the step: no route, no inputs, no outputs, no
  transition comparison. Every step did what it said.
- Only `does_not_answer` becomes an attempt. `unsure` still fails the run and
  still must not read as a pass, but a repair planned from "nobody could tell"
  would be a change to a Flow on evidence that nothing was wrong with it.
- A run with no recorded step produces no attempt: there would be no node to
  speak about.

### 2. The candidate kind — the trap the coordinator flagged, avoided

`output_not_observed` maps to `expectation_wait_retry`, whose only remedy is
`temporary_wait_retry`. A wrong answer repaired with a wait is not a repair.
`adaptive-orchestrator.ts` now classifies a **run-result** failure as
`recovery_path_or_reroute`, whose remedies are `temporary_reroute`,
`temporary_recovery_subflow_call` and `temporary_action_sequence` — the kinds
that can insert the filter click the Flow never had.

**The discriminator is not the stage alone, and this matters.** My first draft
keyed on `stage === "verification"`, which would have been a regression: the
web domain reports step failures at that stage too —
`web.validation.output_not_observed`, `web.validation.state_mismatch`,
`web.assert.text` (`domain/src/runtime/failure/codes.ts:142-143`), and Core's
own `nodes/policy/expectation.ts:18` — and those *are* repaired by a wait. The
condition is now `stage === "verification"` **and** `code` in Core's own
`core.result.` namespace, which only `result-verification/` writes. A test
pins both directions.

`ambiguous_or_unknown` at the same place stays `diagnosis_only`.

### 3. The repair is automatic, and it happens once per run

`runtime/recovery/refuted-result/repair.ts` (new) is the entry point, called
from inside `verifyAutomationStudioRuntimeSessionResult` after it has written
its verdict. It appends the attempt to the run detail, sets the summary to
`failed`, and hands the run to
`annotateAutomationStudioRunDetailWithRuntimeLlm` — the same Stage A–D the
loop runs for a failed step. Nothing is filed and left for a person; a
permission request the recovery raises is carried on the run exactly as one
raised by a failed step.

The seam is a new optional port `repairRefutedResult` on
`AutomationStudioResultVerificationPorts`, supplied by the service. The run
detail is saved with the attempt whether or not the recovery produced
anything, so a run refused a provider still says which step's output was
wrong instead of showing a `succeeded` node list beside an unconnected
verdict.

**Gate 4 settled, as asked.** Both `if (retry?.session) return retry.session;`
lines now verify the retried session. The reasoning in
`result-verification/index.ts` — that a retried session came back through the
change verdict, "which has already judged it" — does not hold: the change
verdict judges whether the patch applied and whether the retried steps
succeeded, not whether the result answers the request. I rewrote that comment
to say so.

That closes a circle (verify → repair → retry → verify), so the entry point is
bounded to **once per run**, by a `resultRepair` marker written onto the run
detail. The adaptive retry spreads the pre-retry metadata forward
(`service.ts:2641`), which is what makes the marker survive the run detail
being rebuilt from the retried session's trace. A second refutation is
recorded and not repaired again — a stated bound rather than a budget running
out mid-repair.

### 4. The context the repair is handed

| Required | Status | Where it now comes from |
|---|---|---|
| The steps that already ran, **with the parameters they ran with** and the results they produced | **Partial** | Steps: `recentActions` (identity, order, status, failure category) and `recoveryContext.recent_nodes`. Results: the new `resultSummary` slot — rows stored, rows refused, columns, sample rows — plus each step's own `metadata.recordCount`. **Parameters: not available.** See below. |
| The conversation so far | **Complete** | New packet slot `conversation`, read through a new `conversationForRecovery` port |
| The page as it was when the failure happened | **Complete in practice, with a caveat** | `captureSanitizedFailureEvidence`, already in `annotate.ts`, now reached because there is a failed attempt to capture for |
| The Flow itself — nodes, routing, the node that failed in place | **Partial** | `resultSummary.flowShape` (authored step list, in order), `recoveryContext.route_context` (route decisions), `packet.nodeId` and `recoveryContext.failure.nodeId`. **Edges and router rules: not carried.** |
| The failure's own record — expected vs observed | **Complete** | `recoveryContext.failure.failure` — category, code, stage, `expected`, `actual` |

Mechanics: `resultSummary` was carried only to `loop_verification`; it is now
carried to `runtime_diagnosis` and `runtime_patch` as well, and threaded from
the repair entry point through `annotate.ts` into both provider calls. The
conversation is packed by a new `llm/harness/conversation.ts` — the turns
nearest the failure, bounded to 20 turns / 4,000 bytes / 1,500 characters per
turn, oldest-first in the request, with what was left behind counted.

**A trap inside this, found by reading the provider path.** Widening the
packet builder's slot was not enough. `automationStudioLlmRequestEvidenceRefusal`
(`llm/harness/request-evidence-check.ts`) re-checks every evidence-bearing slot
before the request leaves the process, and `sendableResultSummary` refused any
task but `loop_verification`. The builder would have put the summary on the
diagnosis and patch requests and the pre-send check would have refused both
with `llm.provider_result_summary_invalid` — **every repair call killed before
it was sent**, and the run would have recorded a provider error rather than a
missing slot. The two lists are now the same set, and a test drives the
finished patch packet through the real pre-flight and asserts it is not
refused.

Belt and braces beside it: `annotate.ts` carries the summary only where the
request can also declare the domain's denied keys, because the pre-send check
holds a result summary to that declaration like every other evidence slot. A
summary on a request that cannot declare would not arrive with less context —
the whole call would be refused.

**Where the design worker and I differ, deliberately.** They expected a
twelfth `recoveryContext` section for the result. I used the packet's existing
`resultSummary` slot instead: it is already a bounded, screened, versioned
contract built by `summarizeAutomationStudioRunResult`, it already carries the
Flow shape, and the recovery context's 4,000-byte budget would have squeezed
it against the failure record. The repair sees the result either way, and the
test asserts it in the finished packet.

## The gaps, stated rather than papered over

**1. The parameters each step ran with are not available at this point in the
code, at all.** `runtimeActionAttemptsFromSession`
(`runtime/service/summaries/conversions.ts:143`) builds the persisted run
record and never copies `attempt.inputs`; `recovery/context.ts` refuses
`attempt.inputs` and `transitionComparison.actual.outputs` by design ("live
values of unknown sensitivity"). So the model repairing a wrong answer is told
*that* `web.dom.extract_list` ran and produced 24 rows with four columns, and
is not told which selector, which field map, or what text was typed. For the
`ten-sites-r5` failures that is survivable — the defect was a *missing* step,
not a mis-parameterised one — but for "the filter was clicked and the wrong
one was clicked" it is not. Closing it means either persisting screened node
inputs on the attempt record or carrying the Flow document's authored node
parameters into the request, and both need a screening decision (a selector is
exactly what `locator-text.ts` strips). **That is a decision above my brief; I
did not take it.** A test asserts the absence rather than hiding it.

**2. The Flow arrives as a step list, not as a graph.** `flowShape` gives node
ids and definition ids in authored order and `route_context` gives the route
decisions taken, but the edges and the router's rules are in no slot. A repair
that wants to author real routing (which Core's patch kinds allow) is
reasoning about a graph it has only seen flattened.

**3. Page timing — the honest version.** `captureSanitizedFailureEvidence`
captures the page **live, at repair time**, not a stored snapshot from the
moment of failure. For this entry point the two coincide in practice: the
repair is entered from inside the verification, microseconds after the run's
last action, with the browser still on the page the run finished on. Nothing
in the code *guarantees* it, and if a future caller verifies a run long after
it finished, the repair will be shown a different page and will not know. A
stored end-of-run evidence packet would close this properly.

## Changed files (Core)

New:
- `runtime/recovery/refuted-result/{attempt,repair,conversation,index}.ts`
- `runtime/llm/harness/conversation.ts`
- `runtime/recovery/refuted-result/tests/attempt.test.ts`
- `runtime/recovery/tests/refuted-result-plan.test.ts`
- `runtime/tests/refuted-result/tests/repair-context.test.ts`

Modified:
- `runtime/adaptive-orchestrator.ts` — run-result failures get a repair shape
  that can serve them
- `runtime/result-verification/run-outcome.ts` — the `repairRefutedResult`
  port, and the call after the verdict is recorded
- `runtime/result-verification/index.ts` — the module comment that documented
  the old "a retried session is not verified" behaviour
- `runtime/recovery/annotation/{annotate,ports}.ts` — `resultSummary` and the
  conversation port
- `runtime/llm/harness/{context-packet,task-request,index}.ts` — the two new
  packet slots
- `runtime/llm/harness/request-evidence-check.ts` — the provider pre-flight's
  result-summary task kinds, widened to match the builder's
- `runtime/llm/tests/deepseek-evidence-preflight.test.ts` — the existing test
  that encoded the old rule, updated to the new one with a positive case
- `runtime/service.ts` — supplies both ports; verifies the retried session.
  **Net 5 lines shorter** (4610 → 4605): `maybeAnnotateRunDetailWithRuntimeLlm`
  now takes `Omit<AutomationStudioRuntimeRecoveryAnnotationInput, "ports">`
  instead of a hand-copied restatement of it — which is also why the new
  `resultSummary` field reached the recovery without anyone editing a second
  list. No method was added.
- `.structure-baseline.json` — `file-lines` for `service.ts` lowered 4611 →
  4606 per `pnpm structure:baseline`

## For Core's paired working document

Core's working document should record:

- **Decision.** A verdict on a finished run's *result* is a repairable failure
  with candidate kind `recovery_path_or_reroute`, discriminated by Core's
  `core.result.` code namespace and not by the `verification` stage, which
  domains also use for step failures.
- **Decision, reversed.** A retried session **is** verified. The previous
  reasoning (the change verdict has already judged it) was wrong: that verdict
  judges the patch, not the answer.
- **Bound.** The result-repair entry point is taken once per run, marked by
  `metadata.resultRepair` on the run detail, which the adaptive retry carries
  forward.
- **Invariant worth pinning.** The packet builder's set of task kinds that may
  carry a `resultSummary` and the provider pre-flight's set are two lists of
  the same thing, and they were allowed to disagree. They now agree; a test
  drives a real patch packet through the real pre-flight.
- **Contract additions.** `AutomationStudioResultVerificationPorts.repairRefutedResult`;
  `AutomationStudioRuntimeRecoveryPorts.conversationForRecovery`;
  packet slots `resultSummary` (widened to `runtime_diagnosis` /
  `runtime_patch`) and `conversation` (those two tasks only).
- **Open, and above this task:** persisting screened per-step parameters so a
  repair can see what each step ran with; carrying the Flow's edges and router
  rules; storing an end-of-run evidence packet so "the page when it broke" is
  a stored fact rather than a coincidence of timing.

## What the Lab side would need to observe this

No change is required for the product to repair; the Lab change is only to
*see* it. Left to the supervisor, since
`packages/test-runner/src/flow-lane/**` is owned by a concurrent task:

1. `flow-lane.json` should publish `metadata.recoveryTrace` and
   `metadata.resultRepair` for a run whose verification refuted it. Today the
   post-mortem could prove no repair was charged and none landed, and could
   not prove whether one started.
2. `persisted-flow-run.ts:450` takes the **first** non-null `action.failure`,
   so a recovered transient miss outranks the run-result failure this work
   appends last. A run whose answer was wrong will still be filed under
   whatever failed first and recovered. That is the post-mortem's cause 4 and
   it is unchanged by this task.
3. `lane-observation.ts:198` writes the bare string `ambiguous_or_unknown`
   with no code when nothing failed. With this change a refuted run now has a
   failure record carrying `core.result.does_not_answer_request`, so that
   placeholder can be replaced by the real code.
4. `terminal-run-wait.ts:48`'s `RECOVERY_RECORD_WAIT_MS = 300_000` cost both
   r5 runs 5 min 11 s each waiting for a record that never came. A repair now
   does run, so the wait should start producing a record — but a run that
   still plans `stop` (an `unsure` verdict, a provider refusal) will still
   burn the full five minutes.

## Commands run, and what they printed

In `F:/fxwork/t099/!FluxIQ`:

- `npx tsc --noEmit -p packages/fluxiq/tsconfig.json` → `tsc=0`, no output.
- `node scripts/structure-audit.mjs` → first run **failed** with two
  violations I caused: `directory-files` (`runtime/tests/` at 26 of 25 files)
  and `failure-as-empty` (my `.catch(() => [])` on the conversation read,
  raising `annotate.ts` from its baseline of 1 to 2). Both fixed — the test
  moved to `runtime/tests/refuted-result/tests/`, and the catch removed
  entirely rather than swallowed (a deployment with no thread supplies no
  port; one that keeps a thread and cannot read it has a real fault, and
  repairing while pretending the person said nothing is how a repair
  contradicts an instruction they already gave). Final run:
  `structure-audit: passed (177 warning(s), 360 baselined).`
- `node scripts/structure-audit.mjs --update` →
  `lowered [file-lines] .../runtime/service.ts: 4611 -> 4606`.
- `pnpm check` (final) → `structure-audit: passed (177 warning(s), 360
  baselined)`; `packages/contracts check: Done`,
  `packages/client-gateway-websocket check: Done`, `packages/fluxiq check: Done`,
  `apps/web check: Done`.
- `npx vitest run src/programs/automation-studio` (the whole Core
  automation-studio suite, final run) →
  `Test Files 1 failed | 303 passed (304)`,
  `Tests 1 failed | 2661 passed | 1 skipped (2663)`. The single failure,
  `rolls back created subflows and rejects invalid durable mutations`, timed
  out at 15,040 ms; run alone it passes in **1,989 ms**. That file is
  `service-adaptation/tests/durable-patches.test.ts`, untouched by this work.
- An **earlier** full run of the same suite reported
  `13 failed | 291 passed (304)` files. Every one of those 18 failing tests
  also sat at ~15,000 ms, and each file passed when re-run serially or alone:
  `service-adaptation` → `13 passed (13) / 55 passed (55)`;
  `result-verification` + `llm/harness/tests` + `adaptive-orchestrator` +
  `service/summaries` → `18 passed (18) / 125 passed (125)`;
  `service-bootstrap` + `scale-pages` → passed;
  `deepseek-bootstrap-exploration.test.ts` alone → `8 passed (8)` in 88,242 ms;
  `storage/project/tests/runtime-stream-store.test.ts` alone → `10 passed (10)`,
  its "million events" case in 16,646 ms against a 60,000 ms limit it blew
  under load.
- **One real regression, found by that full run and fixed.**
  `deepseek-evidence-preflight.test.ts > holds a result verification's summary
  to the same rule, under its own code` failed in 5 ms (an assertion, not a
  timeout): `expected 'llm.provider_request_task_mismatch' to be
  'llm.provider_result_summary_invalid'`. That test encoded the old rule that
  *only* a verification may carry a result summary, which this work
  deliberately reverses. Its "a task that has no finished result to judge"
  case now uses `flow_bootstrap`, which still has none, and a new positive
  case sends a `runtime_diagnosis` request carrying a summary and asserts it
  resolves. The file now reports `14 passed (14)`.
- Targeted runs of the new work, serial:
  `tests/refuted-result` + `recovery/tests/refuted-result-plan.test.ts` +
  `recovery/refuted-result` + `llm/harness/tests` + `result-verification` →
  `Test Files 15 passed (15) / Tests 112 passed (112)`.

In `F:/fxwork/t099/!FluxIQWebExtension`:

- `pnpm check` → **fails**, on `FAIL [working-docs] docs/working/README.md is
  out of date with the documents' header blocks`. **This is pre-existing and
  not mine**: `git status --short` in that worktree was empty at the time, so
  the failure is inherited from `dev`. Left for the supervisor; regenerating
  the index is a shared-document edit.
- `pnpm -r check` (the typecheck half of `pnpm check`) → one attempt died with
  `Exit status 3221225477` in `domain check`, which is this machine's faulty
  RAM; another run of `npx tsc` died with a segmentation fault for the same
  reason. Re-run each time. Final run, after rebuilding Core's `dist` from the
  finished code: all ten projects `Done`, including `domain`,
  `apps/extension`, `apps/scenario-lab` and `packages/test-runner`.
- `pnpm --filter @fluxiq-web-extension/domain test` (final) →
  `# tests 760 / # pass 760 / # fail 0`.

## Not verified

- **No live behaviour.** No Lab run, no campaign, no provider call. Whether
  the model, shown this context, actually authors a repair that narrows the
  list is exactly what the supervisor's single live verification is for. What
  is proven here is that the planner now plans a repair, that the repair is
  attempted rather than filed, and that the five context pieces above are in
  the request.
- **That the remaining timeout is contention and not my change.** The final
  full run has one failure, at the 15,000 ms default timeout, in a file this
  work does not touch, and it passes alone in 1,989 ms. I did not bisect
  against a stashed tree, so I am inferring load from the timeout signature
  and the isolated re-runs rather than proving it. A serial run of the whole
  suite was started and abandoned: I edited source while it was in flight, so
  its results were stale and worthless as evidence.
- **`packages/test-runner`'s own tests** were not run: that package's
  `flow-lane/` is owned by a concurrent task and I was told not to touch it.
  Its typecheck passes.
- **The conversation port against a real store.** The reader
  (`refuted-result/conversation.ts`) is covered only through the packet test's
  fixture turns; it has not been driven against
  `AutomationStudioConversations` with a project database.
- **The `resultRepair` marker surviving a real adaptive retry.** The
  once-per-run test feeds the repair a run detail shaped the way
  `retryRuntimeSessionAfterAutoAppliedPatch` saves one; it does not drive the
  service through an actual retry.

## Open questions and contradictions found

1. **Per-step parameters are withheld by an explicit privacy decision in
   `recovery/context.ts`, and the brief requires them.** I did not overturn
   that decision. Someone has to: either the rule changes for the repair
   request, or the requirement is relaxed to "the Flow's authored parameters"
   (which are also not carried today, but are authored data rather than
   resolved values, and are already the kind of thing `expectedState` is
   allowed through for).
2. **Verifying the retried session costs up to two more provider calls per
   repaired run.** That is the price of not reporting a second wrong answer as
   a success, and I judged it worth paying. If the campaign's cost budget
   disagrees, the cheaper option is to verify a retried session only when the
   original run was refuted (rather than on every retry), which is a one-line
   condition.
3. **A retried session is verified against the pre-patch Flow document.**
   `retryRuntimeSessionAfterAutoAppliedPatch` re-reads the patched Flow
   internally and does not return it, so the verification call after it still
   passes `canonicalFlowDocument(selectedFlow ?? runtimeCanonical)`. The
   verdict itself is about the rows, so this only makes
   `resultSummary.flowShape` show the Flow as it was before the repair. It is
   a one-field fix in the retry's return value; I left it rather than widen the
   change, and it should not survive into the measurement, because a reader
   comparing "the Flow that produced this" against a repaired run would be
   reading the wrong graph.
4. **`RECOVERY_RECORD_WAIT_MS = 300_000` is still five dead minutes for any
   run that plans `stop`.** This task removed the most common reason for
   planning `stop`; it did not make a `stop` plan settle promptly. That is the
   post-mortem's cause 9 and is still open.
