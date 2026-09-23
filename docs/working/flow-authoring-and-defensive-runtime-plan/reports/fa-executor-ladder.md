# fa-executor-ladder — B0, B1, B1a, B2, B3, B4, B9

Task t076. Core worktree `F:\fxwork\t076\!FluxIQ` on `task/t076-executor-ladder`;
downstream worktree `F:\fxwork\t076\!FluxIQWebExtension` on the same branch, with
no source changes of its own.

## Outcome

**Partial.** B1, B1a, B2, B3, B4 and B9 are built, unit-tested, and the retry
loop is proven live in a browser with zero provider calls. **B0 is blocked** on a
one-line change in `runtime/service.ts`, which the brief forbids; the reader half
of B0 is built and tested, and the exact missing line is named below.

The live evidence shows the ladder **running** on a real site, and shows it
correctly **declining** to run on a failure the domain marks non-retryable. It
does **not** yet show a run that failed before and passes after, and the reason
is a finding rather than an omission: no variant in the current scenario corpus
is absorbable by a deterministic ladder, because the corpus was built to prove
model repair. That is set out under *The absorption proof that does not exist
yet*.

## What changed and why

### B1 — a per-node retry loop, on by default

`runtime/executor/retry-policy.ts` (new) owns the policy;
`runtime/executor/graph-run.ts` runs the loop by re-entering the same node in its
own step loop, so every attempt keeps its own trace entry, its own outputs merge
and its own region bookkeeping.

`AUTOMATION_STUDIO_DEFAULT_NODE_RETRY_POLICY` is **three attempts at 250 ms,
1 s, 2 s**. It is a default, not an opt-in. Resolution order, highest first:
`node.parameterValues.retry` → `node.metadata.retry` → a `builtin.timing.retry`
node guarding the branch → `flow.metadata.retry` → `options.retryPolicy` →
the default; then capped by `recoveryBudget.maxRetriesPerAction`.

Attempts from the second onwards carry `retry: { attemptNumber, maxAttempts,
backoffMs, rung, previousAttemptId }`. `options.delay` lets a caller supply the
wait, so a test spends no wall clock; the default timer is unreferenced.

### B1a — the wait ceiling gated by expected state

`runtime/executor/recorded-state.ts` (new) turns a node's `recordedGapMs` into
`clamp(gap x 2, 2 s, 30 s)`. `automationStudioAwaitNodeReadiness`
(`runtime/executor/ladder-run.ts`) asks the bound host evaluator for the node's
`readyState` with that ceiling as the timeout, **before every attempt**. State
seen early returns early, so a replay on a fast page beats the recording that
produced it. The deadline passing attempts the node anyway and writes
`readiness: { ceilingMs, waitedMs, satisfied: false, ... }` on the attempt. A
missing state never fails a node.

The readiness condition is deliberately `readyState`, not `expectedState`.
`expectedState` is what the node is meant to *produce*; waiting for a click's own
result before clicking would wait forever. **Nothing writes `readyState` today** —
see *What is still missing downstream*.

### B2 — the expectation is evaluated on a failed attempt

`transition-comparison.ts:109` guarded the whole check with `attempt.status !==
"succeeded"`, so the recorded state claim was consulted only to demote a success.
It now runs for a failed attempt too. A failed attempt is never promoted here;
its comparison records `metadata.expectationSatisfiedAfterFailure`, and the
ladder reads that to decide whether to skip the node.

A rejection on a succeeded attempt is now **re-checked once**, with the node's
wait ceiling as the timeout, before the failure record is built — so a page a
moment late is not minted as a non-retryable state mismatch that would have been
retried.

### B3 — the recorded state link is read

`automationStudioRecordedState(node)` reads `stateLink`, `stateSnapshotId`,
`stateRef`, `screenshotRef` and `recordedGapMs` from node metadata — the fields
`recordingCandidateStateLinkMetadata` writes and that d2 confirmed no execution
path read. It is stamped onto every attempt as `recordedState`, and it supplies
B1a's ceiling and B2's re-check timeout.

### B4 — rungs as consumed candidates, and non-`deterministic_path` execution

Four new candidate kinds, in ladder order ahead of everything that existed:
`skip_satisfied_node` (1), `await_recorded_state` (2), `clear_interference` (3),
`retry_node` (4); `deterministic_path` moves to 5, `approved_runtime_patch` to 6,
`reroute` to 7, `llm_diagnosis` to 8.

`runAutomationStudioRecoveryLadder` (`runtime/executor/ladder-run.ts`) walks
them, runs each, and **consumes** it. The decision written onto the attempt is
recomputed *after* consumption, which is what satisfies d3's constraint: any
non-`llm_diagnosis` candidate left on the list makes
`llmEligibilityForFailure` answer "a deterministic recovery is available" and
suppresses the model for good (`adaptive-orchestrator.ts:92,250`). `retry_node`
needs no consumption mark — it leaves the list when the attempt allowance is
spent, which cannot disagree with the executor's own count.

Rungs that execute rather than route: `await_recorded_state` waits then retries;
`clear_interference` runs a Flow node marked `metadata.clearsInterference` and
retries only if it succeeded, appending its attempt to the trace;
`skip_satisfied_node` routes the run down `success` from a node whose attempt
still reads `failed`, so what happened and what the ladder made of it stay two
separate facts.

Rung 1 of the plan's ladder (re-resolve the target) is **not** implemented as a
rung, and the ladder says why in a comment: it already happens inside the host's
own target resolution before the action is ever reported failed (d2 finding 5).

### B9 — the four inert retry surfaces, resolved explicitly

| Surface | Resolution | Why |
| --- | --- | --- |
| `RetryPolicy.backoffMs` (`model/policies.ts`) | **Implemented** | `automationStudioNodeRetryPolicy` now accepts exactly this shape from `parameterValues.retry`, `metadata.retry` and `flow.metadata.retry`. Both fields have a consumer. |
| `builtin.timing.retry` (`nodes/timing/retry.ts`) | **Implemented** | It now declares the policy for the branch its `success` port feeds: the edge target, and each node after it that only this branch reaches (one way in, one way on). Its outputs are unchanged, so a Flow reading `attempts` off it still works. |
| `retryable` on a failure record | **Implemented** | It is the retry gate. Narrowed by `stage`: a failure at `verification` or `confirmation` happened *after* the action ran, so re-dispatching it is how a double submit happens — those are the state checker's to answer. An attempt with no structured record is not retried, because Core would be guessing. |
| `maxRetriesPerAction` | **Implemented as the allowance it is named for** | It no longer sits in `recoveryBudgetExhaustion` withdrawing the Flow's own authored failed route the moment a node had failed before. It now caps the retry loop: `maxAttempts = min(policy, cap + 1)`. `recoveryBudgetState.failedAttemptsForAction` excludes attempts that carry `retry`, so a node's own retries do not spend the reroute and subflow budgets. |

The default in `defaultAutomationStudioFlowSettingsMetadata` moved from
`maxRetriesPerAction: 1` to `2`, so a Flow created with Core's defaults gets
Core's three attempts instead of being silently capped at two.

### One file outside the owned set

`runtime/flow-change/trial.ts` — four lines. Its host proxy downgraded any
attempt asked twice to `unknown`, which B2's re-check made fire on every
rejection and turned `expected_state_rejected` into `expected_state_unevaluated`.
It now treats a second answer *from the same source* as the re-check it is (last
answer wins) and keeps `unknown` only for two answers from different sources.
This was a regression my change caused; flagging rather than fixing it would have
left `pnpm test` red.

## Commands run and observed results

### Live, provider-free, in a browser — the retry loop

All four runs used `FLUXIQ_TEST_ENV_FILES=none` and report `llm: { mode:
"disabled", calls: 0 }`. Run directories are under
`F:\fxwork\t076\!FluxIQWebExtension\test-runs\`.

| Run id | What | `web.dom.wait_for_selector` attempts | Verdict |
| --- | --- | --- | --- |
| `run-mud4ms6b-49efa68d` | `delayed-ui --flow --variant too-slow`, **before** | **1** (5,019 ms) | `passed` (68.4 s) |
| `run-mud68uv1-df951056` | the same, **after** | **3** (5,015 / 5,012 / 5,019 ms) | `failed` (80.7 s) — see below |
| `run-mud6f4pi-0e1bf31d` | `modal-flows --workflow interstitial --flow --variant armed`, control | n/a — one blocked click, not repeated | `passed` |
| `run-mud6jlu7-be371748` | `delayed-ui --flow` baseline, no variant | 1 (10 ms), nothing failed | `passed` (103.4 s) |

**The before/after is the proof that the loop exists and runs.** One wait
attempt became three, with the 250 ms and 1 s backoffs between them, on a real
page, with zero provider calls. The reported failure is `timeout /
web.action.timeout`, whose domain record is `retryable: true, stage: "execution"`
— exactly the gate.

**The control is the proof the gate discriminates.**
`modal-flows/interstitial/armed` fails with `web.action.blocked_by_dialog`,
`retryable: false`. The blocked click was attempted **once**, the run's verdict
is unchanged at `passed`, and no provider was called. Retries on by default did
not turn every failure into three expensive attempts.

**Why the `too-slow` run's verdict flipped, and what it means.** The failure code
is identical before and after. What changed is the *fixture's* final-state fact.
`too-slow` reveals its late content 20 s after the click and declares
`late-action-absent: exists = false`; the Flow run took 27.3 s end to end
(events 13 → 14, 21:14:45.000 → 21:15:12.273), so by the time the fixture's final
state was read the late action **had appeared**. The fixture's expectation
encodes a single-attempt runtime. Re-expressing it belongs to
`fa-lab-measurement` (D0/D2), not here, and I did not touch
`apps/scenario-lab/**` or `packages/test-runner/**`.

### Core

- `npx tsc --noEmit` (packages/fluxiq) — clean.
- `node scripts/structure-audit.mjs` — `passed (174 warning(s), 361 baselined)`.
  It caught one real defect first (a caught failure returned as `undefined` in my
  `transition-comparison.ts` refactor), which I fixed by letting the throw reach
  a single `catch` that returns the attempt, as the original did.
- `pnpm check` (Core root) — structure tests, task tests, audit, and
  `tsc --noEmit` across all four packages: **Done**, no failures.
- `npx vitest run --maxWorkers=4 --minWorkers=1` (packages/fluxiq) — **325 test
  files, 2,817 passed, 1 skipped, 0 failed.** That includes the 22 new tests in
  `runtime/executor/tests/retry-policy.test.ts` and
  `runtime/executor/tests/ladder-run.test.ts`.

### Downstream

- `pnpm check` — structure tests, lab tests, task tests, audit
  (`passed (88 warning(s), 122 baselined)`) and `tsc` across ten packages:
  **Done**, no failures.

### A note on test-suite flakiness on this machine

At default parallelism `npx vitest run` on Core reported 24 failed files, 14 of
them `Test timed out in 15000ms`. Every one passed at `--maxWorkers=4`, and the
whole 325-file suite passed there. The timeouts are host contention, not the
change; I have recorded the exact command that gives a clean signal above rather
than reporting a pass I did not see.

## Not verified

- **B0's write path is not implemented, and no node carries `recordedGapMs`
  today.** The ceiling therefore always resolves to its 2 s floor in a real run.
  The reader, the clamp and the metadata key are built and unit-tested.
- **`readyState` is never written**, so B1a's gate and the `await_recorded_state`
  rung did not fire in any live run. Both are covered by unit tests with a fake
  host.
- **`clearsInterference` is never written**, so the `clear_interference` rung did
  not fire live either. Unit-tested only.
- **`skip_satisfied_node` did not fire live**, because the only `expectedState`
  the recording path produces is a URL landing claim on a navigating click
  (d2 finding 2). Unit-tested only.
- I did not run the downstream `pnpm test`, or any scenario other than the four
  above. No real-provider run was made, and none was needed: the ladder is
  deterministic and every run reports `calls: 0`.
- The 27.3 s Flow-run duration is read from the run's own event timestamps, not
  from an instrumented per-rung breakdown.

## Open questions or contradictions found

1. **B0 is blocked on one line in `runtime/service.ts`.** The gap must be derived
   where the recording timeline and the candidate meet, and that is only
   `service.ts:2359-2385`: `recordingMapperCalls` builds the observations,
   the loop over `mapperTimeline.entries()` holds each entry's
   `monotonicOffsetMs`, and `recordingFlowActionCandidate` is called from inside
   it. Nothing downstream of that call has a timestamp:
   `RecordingFlowActionCandidate` carries none, and `appendRecordingProposalToFlow`
   receives only the proposal. The change needed is an optional `recordedGapMs`
   on `RecordingFlowActionCandidate`, passed at that one call site from
   `entry.monotonicOffsetMs - previous.monotonicOffsetMs`, and written into node
   metadata by `appendRecordingProposalToFlow` and `candidate-definitions.ts`.
   Two of those three files are outside my owned set and the third is the frozen
   service, so I stopped rather than guess. I deliberately did **not** add the
   candidate field on its own: unreachable code is worse than a named gap.
2. **No fixture in the corpus is absorbable by a deterministic ladder.** I read
   every variant in `apps/scenario-lab/src/scenarios`. `delayed-ui/too-slow` is
   documented as unabsorbable on purpose ("no timeout on either lane can be
   satisfied by waiting longer"); `modal-flows/interstitial/armed` expects a stop
   and the Flow holds no dismissal for the offer; `intermediate-state/unannounced`
   and the realistic-site variants are all written for the repair lane. This is
   the same shape as the pinned rule that the corpus must exercise the
   capability: **D0 needs a condition whose absorbing rung is a deterministic one,
   or B4's success criterion has nothing to measure it against.** Concretely, a
   `delayed-ui` variant revealing at ~8-12 s would be absorbed by the default
   three attempts today, and one with a recorded `readyState` would be absorbed
   by B1a.
3. **The arithmetic that decides whether a timing failure is absorbed.** Three
   attempts of a 5 s wait plus 250 ms and 1 s of backoff is 16.3 s of ceiling.
   The `too-slow` fixture reveals at 20 s. B1a's gate would add up to 2 s *per
   attempt* — 22.3 s, enough — but only once something writes `readyState`. That
   is the single highest-value downstream wiring for this workstream, and it
   belongs to `fa-domain-tools` / `fa-extension-defenses`, not here.
4. **Two design choices worth a supervisor's eye.** (a) Narrowing the retry gate
   by `stage` means `web.validation.output_not_observed`, which the domain marks
   `retryable: true`, is no longer re-dispatched; I judged a double submit the
   worse failure, and rung 3 is the intended answer for it. (b) Moving
   `deterministic_path` from priority 1 to 5 means a Flow's authored `failed`
   edge is now taken only after the node's retries are spent. Both are
   deliberate and both are covered by tests.
5. **`too-slow`'s fixture expectation now contradicts the runtime.** Named here
   so it is not discovered as a mystery regression by whoever runs the corpus
   next.

## Files changed

Core, `F:\fxwork\t076\!FluxIQ`:

- new `packages/fluxiq/src/programs/automation-studio/runtime/executor/retry-policy.ts`
- new `packages/fluxiq/src/programs/automation-studio/runtime/executor/recorded-state.ts`
- new `packages/fluxiq/src/programs/automation-studio/runtime/executor/ladder-run.ts`
- new `packages/fluxiq/src/programs/automation-studio/runtime/executor/tests/retry-policy.test.ts`
- new `packages/fluxiq/src/programs/automation-studio/runtime/executor/tests/ladder-run.test.ts`
- `runtime/executor/contracts.ts`, `graph-run.ts`, `index.ts`,
  `recovery-budget.ts`, `recovery-ladder.ts`, `transition-comparison.ts`
- `runtime/executor/tests/node-execution.test.ts`,
  `runtime/executor/tests/transition-comparison.test.ts`
- `runtime/flow-change/trial.ts` (four lines; see above)
- `model/flows.ts`, `model/policies.ts`, `nodes/timing/retry.ts`
- `docs/architecture/automation-studio.md`

Downstream: no source changes. Run artifacts only, under `test-runs/`.
