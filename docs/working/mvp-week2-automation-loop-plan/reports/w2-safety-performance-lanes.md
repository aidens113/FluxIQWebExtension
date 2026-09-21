# Safety and performance live-lane map

Status: read-only design complete; no run executed  
Date: 2026-09-20  
Worker: `w2-safety-performance-lanes`

## Outcome

The current tree has a good live-browser foundation, but it does **not** yet
prove the complete batching safety contract. Chromium already proves that four
stable field entries can continue in one batch and that field entries publish
truthful target-continuity evidence. Existing content specs separately prove
browser failures, navigation outcomes, and intervention detection. What is
missing is one focused live Chromium spec that puts each outcome *inside an
ordered evidence batch* and proves that the following action did not run.

Performance evidence is similarly useful but incomplete. The Lab already
records whole-run duration, recording-step and Flow-action latency, build and
exploration aggregate duration, provider-call counts, token totals, and cost.
It does not timestamp the stages needed to explain a slow user-visible run:
provider wait, capture/sanitization, browser action, verification, proposal
save, review/approval, repair, and replay. The first performance lane can use
the existing aggregates without changing code; stage attribution needs one
small, run-scoped timing contract and runner projection.

## Evidence already present

- `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-exploration.spec.ts`
  is the current live Chromium A/B. The same six browser tool calls take six
  decisions in single-action mode and three in batched mode. Its four-entry
  batch records positions 1 through 4 and all four final DOM values.
- `.../field-entry-target-stability.spec.ts` proves opening the composer yields
  `targetsUnchanged: false`, while each text/select entry yields `true`; it also
  proves entered values do not leak into evidence.
- `apps/extension/e2e/content/tests/failures.spec.ts` proves real-DOM rejected,
  missing-target, auth-required, timeout, and failed-navigation outcomes, but
  not the evidence batch's first-failure behavior.
- `apps/extension/e2e/content/tests/modal-intervention.spec.ts` proves a modal
  produces `web.intervention.required` and the underlying action does not run,
  but it likewise does not place that action inside a batch.
- Core's `runtime/llm/evidence-batch/stop.ts` names the implemented stop rules:
  `action_refused`, `effect_not_applied`, `targets_may_have_changed`,
  `action_limit`, and `batch_limit`. `run.ts` marks the last executed trace
  step with `batch.stoppedBy` and reports later calls as `not_run` in the
  `core.batch_result` packet. Permission still ends the enclosing execution
  directly; it intentionally is not inferred from a result code.
- The t025 live state-digest proof covers a state reversal and reduction, and
  t026 covers field entry and truthful continuity. Neither is proof that every
  unsafe batch boundary stops later calls.

## Live-first safety matrix

All deterministic rows should live in one new content spec so one browser
worker can run the whole safety gate once, or independent workers can select a
single title with Playwright `--grep`. The proposed file is
`apps/extension/e2e/content/tests/exploration-state/tests/multi-action-safety.spec.ts`.
It should use the production Core loop, downstream LLM evidence runtime, real
content script, and Scenario Lab DOM exactly as the existing A/B does.

| Lane | Fixture and ordered action | Live oracle | Current state |
| --- | --- | --- | --- |
| Stable continuation | `social-scheduler`: open composer first, then batch the four field entries | Four tool calls run; batch positions are 1..4 with no `stoppedBy`; all four DOM controls hold their values; evidence contains no entered value | Already proven by the A/B and t026 specs; retain as the positive control |
| Target instability | `social-scheduler`: batch `press(New post)` followed by `inspect` | Only the press executes; its trace says `targets_may_have_changed`; the result packet marks inspect `not_run`; composer is open and command count is exactly one | Missing as a batch assertion; t026 already proves the press returns `targetsUnchanged: false` |
| Refused action | After opening the composer, batch `press` with an unknown/stale handle followed by a valid field entry | First result is `{ok:false}` and trace stops `action_refused`; second command never reaches the harness; valid field stays empty | Missing; downstream already returns closed refusal codes for unknown handles |
| Failed/not-applied action | After opening the composer, batch an invalid account selection followed by a valid body entry | First mutation reports no applied effect; stop is `action_refused` when the tool returns the common refusal shape, otherwise `effect_not_applied`; body remains empty and command count advances by one | Missing; the first t026 live iteration already exposed this real select failure, but did not assert batching |
| Navigation | `navigation`: inspect, then batch `press(Full navigation)` followed by `inspect` | First press succeeds and browser URL changes; `targetsUnchanged` is not true; stop is `targets_may_have_changed`; second inspect is `not_run` | Missing as a batch assertion; the fixture's successful and swallowed-navigation paths already exist |
| Intervention/refusal | `modal-flows`, armed interstitial: after first Add section reveals the modal, batch a press behind it followed by any safe observation | First action reports `web.intervention.required`/refusal; second does not run; one section remains and modal remains visible | Missing as a batch assertion; underlying browser outcome already proven |
| Permission required | Real created-Flow run for `order-operations-refund-quote` | Build ends `flow_bootstrap.permission_required`; permission request names the action/consequence; no refund or later lasting action occurs; `evaluation.json` and fixture state must not claim success | The product permission path exists, but previous live attempts did not reliably make the relevant press; must remain a real-provider lane rather than be inferred from a content test |

Deterministic browser command after the new spec exists:

```text
pnpm --filter @fluxiq-web-extension/extension test:content -- exploration-state/tests/multi-action-safety.spec.ts --workers=1
```

One-row diagnosis commands use the same command plus, for example,
`--grep "target instability"`. Do not shard cases from this one spec into the
same browser profile; independent workers need independent worktrees, Lab
instances, profiles, ports, and run roots.

The real permission lane uses the ordinary isolated created-Flow path (profile
and budgets shown explicitly, credentials still supplied only through the
existing secret mechanism):

```text
FLUXIQ_TEST_ENV_FILES=none pnpm lab run order-operations --target isolated --live-llm --llm-profile lab-create-flow --llm-provider deepseek --llm-model deepseek-chat --llm-task create-flow --instruction-task order-operations-refund-quote --llm-max-input-tokens 48000 --llm-max-output-tokens 8000 --llm-max-total-tokens 56000 --llm-max-run-tokens 600000 --llm-max-calls 26 --llm-max-cost-usd 0.25
```

The worker must inspect the run bundle call by call. A top-level verdict is not
the oracle. If the model never requests the permission-bearing action, the row
is inconclusive, not passed. There is no retry for a model decision; only a
recognized transient provider/facility signature gets the plan's one retry.

## Performance fields: emitted versus missing

| Question | Existing artifact/field | Coverage |
| --- | --- | --- |
| How long did the whole run take? | `evaluation.json.durationMs`; `run.json.startedAt/finishedAt` | Emitted |
| How long did recording-script steps take? | `run.json.steps[]`: operation, start, duration, outcome | Emitted |
| How long did persisted Flow actions take? | `run.json.actions[]` and `evaluation.json.actions[]`: action type and duration | Emitted |
| How long did Flow creation take? | `snapshots/live-llm.json.build.durationMs` | Emitted as one aggregate |
| How long did exploration take? | `snapshots/live-llm.json.exploration.counts.durationMs` | Emitted as one aggregate when Core publishes the recovery stage |
| How many provider calls and what did they cost? | `build.providerCalls`, `build.accounting`; run `observed.calls`, per-call token/cost records, and accounting totals | Emitted; build calls are aggregate, run calls are itemized when Core publishes them |
| How many exploration decisions/actions/evidence bytes? | build `evidenceLoop.{decisionCount,toolCallCount,evidenceBytes}`; run exploration counts | Emitted |
| How long did each provider request wait? | No duration/start/end on `LiveLlmObservedCall`; created-Flow builds are not itemized | Missing |
| How long did evidence capture and sanitization take? | No separate stage timing | Missing |
| How long did each exploratory browser tool take? | Build evidence steps keep tool/result/effect only; runtime exploration publishes aggregate duration only | Missing |
| How long did verification, proposal persistence, review/approval, and application take? | No stage timing in the bundle | Missing |
| How long did repair and deterministic replay take separately? | Repair usage and action/run totals exist, but no stage boundaries | Missing |
| What did the CLI tell the worker immediately? | CLI prints the run result/run id; timing requires opening bundle artifacts | Existing summary is insufficient for attribution |

## Performance worker lanes

### P1: zero-code baseline and batching comparison

Run the same `social-scheduler-schedule-post` task on the frozen candidate with
the same-code single-action/batching toggle, identical provider/model/budgets,
and separate isolated resources. The exact Lab command is the permission
command above with scenario `social-scheduler`, task
`social-scheduler-schedule-post`, and the lane's assigned toggle. Compare:

- `build.durationMs`, evidence-loop decisions/tool calls/bytes;
- provider calls, input/output/total tokens, estimated cost;
- whole-run `durationMs` and Flow action durations;
- Flow proposed/approved/executed and fixture oracle result;
- batch sizes and every stop reason from the Core trace/batch result.

This can start immediately after the configuration seam exists. It answers
whether batching materially helps, even before finer timing hooks exist.

### P2: stage attribution

After P1 is correct, add one sanitized `stageTimings` record to the run bundle,
using a closed stage vocabulary and monotonic durations only. Required stages:
`panel_startup`, `provider_wait`, `evidence_capture`, `action_execution`,
`verification`, `proposal_persist`, `review_approval`, `repair`, and `replay`.
Each entry should carry `{stage, durationMs, count}` only; never URLs, prompts,
page values, selectors, or error prose. The same worker reruns one baseline and
one batching lane and identifies the largest avoidable component. Only that
component receives an optimization branch and a focused live rerun.

### P3: warm panel measurement

The panel UI worker performs the accepted golden path once with an already
running isolated panel and records user-visible timestamps for instruction
submit, first progress, Flow ready, approval accepted, execution start, and
final outcome. This is deliberately separate from cold Lab provisioning so
MVP interaction latency is not confused with test-environment build time.

## Safe parallel grouping

Once the candidate is frozen, the following are independent:

- one worker runs the deterministic Chromium safety spec;
- one worker runs the single-action real-provider baseline;
- one worker runs the batching real-provider candidate;
- additional read-only workers may inspect completed artifacts or prepare the
  panel timing oracle.

The permission-bearing provider lane should wait until one provider slot is
free. The baseline and batching provider lanes are the only paid pair that
should overlap initially; adding a third makes rate-limit/provider congestion
indistinguishable from product latency. The warm panel lane waits for correct
A/B behavior and runs with its own server, profile, store, ports, and run root.

Do not run the target-instability, failed-action, and navigation cases in
separate workers against one checkout or browser profile. Their runtime is
short enough that one focused spec is faster and produces cleaner provenance.
If a row fails, only that row is re-run while diagnosing.

## Narrow follow-up ownership

1. **Batch safety live spec** — own only
   `apps/extension/e2e/content/tests/exploration-state/tests/multi-action-safety.spec.ts`.
   It should require no production change. If a production change is needed,
   report the gap and stop rather than mixing fix and oracle ownership.
2. **Core batch audit projection** — Core should publish per-step batch
   position/size/stop and sanitized outcome status on successful proposals,
   not only the reduced `toolIds`; likely ownership is Core
   `runtime/llm/evidence-batch/{run,packet}.ts` plus the proposal audit DTO.
   Downstream projection is
   `packages/test-runner/src/flow-lane/creation/build-proposal.ts` and its
   direct test. This is needed to judge successful real-provider batches from
   artifacts without reading private page evidence.
3. **Stage timing contract** — own
   `packages/test-contracts/src/run.ts`, validation/barrel and direct tests;
   producer ownership is `packages/test-runner/src/run-scenario.ts` plus a new
   focused `run-timing/` module. Provider call timing requires a synchronized
   Core DTO change rather than timing the HTTP wrapper from the Lab.
4. **CLI/inspection summary** — after the contract exists, project only
   sanitized timing totals in `packages/test-runner/src/inspect-run.ts` (or its
   owning inspection module). Do not make CLI stdout the source of record.

These changes should remain separate task branches: the safety spec can land
as soon as its live Chromium rows pass; timing instrumentation can land after
contract checks and one live bundle prove it; an actual latency optimization
is a third branch selected from measured evidence.

## Acceptance and stop rules

- Every deterministic row proves both the stop code and that the next action
  did not execute in the live DOM/command count.
- At least one positive batch completes two or more actions.
- Permission/intervention rows prove the page was not mutated past the gate.
- Baseline and batching both create, run, and pass the same Flow oracle before
  latency or call-count improvement is credited.
- Performance reports state cold provisioning separately from warm product
  latency and never infer stage cost from whole-run duration.
- Stop the cohort for provenance mismatch, shared resources, an action after a
  refusal/unstable target, or a lasting action without permission.
- Run narrow automated checks only after the focused live behavior passes; run
  the full integration gate once at the coherent merge boundary.

## Verification performed

Read-only source/contract inspection only. I read the Week 2 Current State,
the concurrent plan, t025/t026 reports, current A/B and target-stability specs,
the existing live failure/intervention specs, Core's batch stop/run contract,
and the Lab run/evaluation/live-LLM timing projections. I did not start a
browser, server, provider call, test, or build, and did not verify any newly
designed lane live.
