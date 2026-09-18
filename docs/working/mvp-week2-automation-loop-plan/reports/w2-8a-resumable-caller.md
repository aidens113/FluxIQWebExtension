# w2-8a — The caller for `resumable`

Worktree pair: Core `F:\fxwork\t006\!FluxIQ`, downstream
`F:\fxwork\t006\!FluxIQWebExtension`, both on `task/t006-resumable-caller`.
Core HEAD at the start: `02c9f9c` (Merge task t004). Nothing outside the Core
worktree was edited; the downstream worktree is clean and `F:\!FluxIQ` and
`F:\!FluxIQWebExtension` were not touched. Nothing committed.

`AS/` below means `packages/fluxiq/src/programs/automation-studio/`.

## What the brief claimed versus what is at HEAD

All three claims hold, but two of the three line numbers point somewhere else.

1. **"The retry runs only after an auto-applied patch."** True. The gate was at
   `AS/runtime/service.ts:2986-2988`, inside
   `retryRuntimeSessionAfterAutoAppliedPatch`, not at :3260-3271 — those are the
   two call sites (:3227 and :3281). It read
   `attempt.retryOriginalAction === true && attempt.approvalDecision.autoApply === true`
   over `detail.metadata.runtimePatchAttempts`. The doc claim holds too:
   `docs/architecture/automation-studio.md:716-720` says the shipped app never
   produces an auto-applied retryable patch. **Unchanged, as instructed.**
2. **"The rerun restarts the Flow from its beginning."** True. The rerun was at
   `service.ts:3004` (not :3287): `runCanonicalAutomationStudioFlow(updatedFlow,
   snapshots, input.graphOptions, …)`, and `input.graphOptions` carried no
   `startNodeId`, so the graph run fell back to `chooseAutomationStudioStartNode`.
3. **"`startNodeId` already exists as an executor option."** True, but at
   `AS/runtime/executor/contracts.ts:197`, not :154 — `:154` is inside
   `AutomationStudioNodeAttemptTrace`. It is honoured at
   `executor/graph-run.ts:196-207`, and a start node id that is not in the graph
   produces a failed trace with "No start node is available in this flow."

The brief's own claim that nothing consumes `resumable` also held: at HEAD,
`resumable` appeared only in `AS/runtime/flow-change/{contracts,resume,verdict}.ts`
and that directory's tests.

### Two things the brief did not mention, which the work needed

- **The resume point did not name its Subflow.** `resumeFrom.subflowId` comes
  from `request.options.currentSubflowId` (`flow-change/trial.ts:94`), and
  **nothing in the runtime ever set `currentSubflowId`** — it was only ever read,
  by the recovery budget. So every resume point produced by a live patch named a
  bare node id belonging to no named graph, even when the trial ran inside a
  Subflow. Honouring `subflowId` was impossible until that was fixed.
- **`startNodeId` leaked across a Call Flow boundary.** In
  `composite-executor.ts`, a child snapshot ran with `{ ...parentOptions }`, so
  setting `startNodeId` for a resume would have been handed to every Call Flow
  child, where no node carries that id and the child fails outright. Nothing set
  `startNodeId` on a composite run before, so the bug was latent; item 2 would
  have activated it.

## Where the refusal now sits

`decideAutomationStudioAdaptiveRetry` in the new
`AS/runtime/service/adaptations/adaptive-retry.ts`, called from
`retryRuntimeSessionAfterAutoAppliedPatch` in place of the old `.some(...)` gate.
It reads the receipts in `detail.metadata.runtimePatchAttempts` and returns one
of three answers:

- `null` — no receipt asked for a retry. Unchanged behaviour, and nothing is
  recorded; a run that was never going to continue does not gain an
  `adaptiveRetry` entry it did not have before.
- `{ declined: { notResumableCode } }` — a receipt asked, and the trial's own
  decision refuses it.
- `{ resume: { nodeId, route } }` — the node the run continues at.

It fails closed on top of the verdict, adding four codes of its own to the
verdict's `no_checks` / `check_failed` / `check_unknown` / `no_resume_point` /
`no_evidence`:

| Code | Refused because |
| --- | --- |
| `resume_decision_missing` | the receipt has no `resumable` field at all (an older run detail, or a path that records none). Unknown is not a yes. |
| `resume_point_missing` | `resumable` is true but no `resumeFrom` survived. |
| `resume_point_malformed` | `nodeId` or `route` is not a usable string. |
| `resume_point_completed` | the trial ran the Flow to its end, so no node is left to take again and restarting would repeat every side effect. |
| `resume_point_subflow_mismatch` | the point does not name the Subflow graph the retry would run. |
| `resume_points_disagree` | two repairs vouched for different continuations, so there is no single place to go on from. |

The gate had to fit in the lines it replaced: `service.ts` is at its ratcheted
`file-lines` baseline of exactly 6405, so any net line added fails
`structure-audit`. The file is still 6405 lines, and the `AutomationStudioService`
class gained no method (its `class-methods` baseline is 223, which may only fall).

## How the reason reaches a reader

Two places, both inside `getFlowRunDetail`, which is what a person reads after
the run:

1. **`metadata.adaptiveRetry`** now has a declined form:
   `{ attempted: false, notResumableCode: "check_unknown" }`, written by
   `automationStudioRunDetailWithDeclinedAdaptiveRetry` at both call sites just
   before `saveFlowRunDetail`. It sits beside the existing
   `{ attempted: true, status, attemptCount }`, so "did the run continue" and
   "why not" read off one key.
2. **Each `runtimePatchAttempts` receipt** now carries the trial's own answer —
   `resumable`, `notResumableCode` and `resumeFrom` — added in
   `AS/runtime/recovery/annotation/patches.ts`. This is also what makes the
   refusal possible at all: by the time the retry runs, the trial is over and the
   receipt is the only copy of its verdict left.

**Deliberately not changed:** the session's `trace.message`, and therefore the
`terminalReason` the `runFlow` endpoint returns. That message is the run's own
failure, and overwriting it would hide the original cause behind the refusal.
A caller that wants the refusal reads the run detail. Surfacing it on the
endpoint would need a `packages/contracts` field, which would have been widening.

## Mutations

Each was applied, run, and reverted. Guards confirmed restored afterwards by grep.

| Mutation | What broke |
| --- | --- |
| **Continue when `resumable` is false** — drop the `attempt.resumable !== true` guard in `adaptive-retry.ts`. | 4 tests failed. End to end: `refuses to continue past a repair the verdict did not vouch for` → `AssertionError: expected 'succeeded' to be 'failed'` — the run carried on past a repair the verdict declined. Plus 3 unit cases → `expected { resume: { nodeId: 'end', … } } to deeply equal { Object (declined) }`. |
| **Resume from the Flow's start** — pass `input.graphOptions` instead of `{ ...input.graphOptions, startNodeId: decision.resume.nodeId }` at `service.ts:3004`. | 1 test failed: `continues at the node the trial reached instead of re-running the Flow from its start` → `AssertionError: expected 2 to be 1`. The 2 is `calls.charge`: the side-effecting node ahead of the failure ran a second time. |
| **Drop `subflowId` when resuming into a subflow** — remove `currentSubflowId` from `trialOptions` in `live-patch.ts`, so the resume point stops naming its graph. | 1 test failed: the same resume test → `AssertionError: expected 'failed' to be 'succeeded'`. The point no longer names the Subflow the retry runs, so the caller fails closed and the run stays failed. |
| *(complement of the above)* **Stop holding the point to its graph** — drop the `point.subflowId !== subflowId` guard. | 1 unit test failed: `holds the resume point to the graph the retry would run`. |

## Changed and added files (Core worktree only)

Modified:
- `AS/runtime/service.ts` — the gate, the resumed rerun, the two call sites, one
  import appended to an existing line. Net 0 lines.
- `AS/runtime/recovery/annotation/patches.ts` — receipts carry the resume decision.
- `AS/runtime/live-patch.ts` — `trialOptions` names the Subflow being patched.
- `AS/runtime/composite-executor.ts` — a parent's `startNodeId` no longer crosses
  into a Call Flow child.
- `AS/runtime/service/adaptations/index.ts` — barrel entry.
- `docs/architecture/automation-studio.md` — a new paragraph in the resume-decision
  section naming the caller, the declined `adaptiveRetry` shape and the four new
  codes; and the "The retry after an applied patch" bullet corrected.

Added:
- `AS/runtime/service/adaptations/adaptive-retry.ts` (96 lines)
- `AS/runtime/service/adaptations/tests/adaptive-retry.test.ts` (10 cases)
- `AS/runtime/tests/service-adaptation/tests/adaptive-retry-resume.test.ts` (2 cases)

The end-to-end tests run `start → charge → drift → end`, where `charge` counts
its executions. `calls.charge` is the measurement that separates resuming from
restarting: a run that restarts charges twice for one order.

## Validated, with observed output

All from inside `F:\fxwork\t006\!FluxIQ\packages\fluxiq`, never a repository root.

- `npx tsc --noEmit` → exit 0, no output.
- `node scripts/structure-audit.mjs` (from the Core worktree root) →
  `structure-audit: passed (162 warning(s), 361 baselined).` `service.ts` is still
  6405 lines, equal to its baseline.
- `npx vitest run src/programs/automation-studio/runtime/service/adaptations/tests/adaptive-retry.test.ts`
  → `Test Files 1 passed (1) / Tests 10 passed (10)`.
- `npx vitest run src/…/tests/service-adaptation/tests/adaptive-retry-resume.test.ts`
  → `Test Files 1 passed (1) / Tests 2 passed (2)`, 3.7 s.
- `npx vitest run src/programs/automation-studio/runtime` →
  `Test Files 1 failed | 159 passed (160) / Tests 1 failed | 1705 passed | 1 skipped (1707)`.
- `npx vitest run` (whole `packages/fluxiq`) →
  `Test Files 1 failed | 288 passed (289) / Tests 1 failed | 2527 passed | 1 skipped (2529)`, 192 s.
- Targeted rerun after every mutation was reverted —
  `adaptations`, `service-adaptation`, `live-patch`, `live-patch-target-override`,
  `flow-change`, `executor` → `Test Files 23 passed (23) / Tests 271 passed (271)`.

### The one failure, and why it is not this change

`src/…/runtime/tests/service-flows/tests/instruction-readiness.test.ts` →
`Error: Test timed out in 15000ms.` It failed the same way in both full runs and
**passed alone in 6.0 s** (`Test Files 1 passed (1) / Tests 1 passed (1)`). It
covers instruction readiness summaries and unfiltered paging — no file on any
path this change touches. Load-correlated, non-reproducible alone: the machine's
known RAM fault, not a defect. Stated as a single observation, not a proof.

## Not verified

- **No live browser or real-provider run.** Everything above is Core unit and
  service-level tests with a mock provider.
- **Resuming carries no prior values.** The retry starts the graph at
  `resumeFrom.nodeId` with `graphOptions.inputs` only. A node after the resume
  point that reads a value an earlier node produced will not find it. The trial's
  `executedTrace` holds those values but is in-memory only and never reaches
  `retryRuntimeSessionAfterAutoAppliedPatch`, which sees JSON metadata. The old
  behaviour recomputed them by re-running everything — which is the side-effect
  repetition this change exists to stop. **This is a real remaining gap**, not
  one the brief asked for, and nothing here closes it.
- **`resume_point_completed` changes behaviour for a whole-Flow trial.** When the
  trial ran the Flow to its end, the run previously re-ran the whole Flow and
  could end `succeeded`; it now stops `failed` with that code. The run detail
  says why, and the trial's own completion is not adopted as the run's outcome —
  adopting it would have been widening. No existing test covered that shape, so
  nothing failed, and I did not construct one.
- **`resume_points_disagree` is unit-tested only.** No end-to-end run produces
  two auto-applied retryable repairs in one recovery today.
- **The `composite-executor.ts` fix is covered only indirectly.** The existing
  composite tests pass and no test sets `startNodeId` on a Flow containing a
  Call Flow node, so the leak I closed has no dedicated regression test.
- **Whether the shipped app ever auto-applies** — not investigated, not changed,
  per the brief. The documented claim that it never does was read, not tested.
- **Downstream.** The downstream worktree was not built or tested. It reads
  `runtimePatchAttempts` in `packages/test-runner/src/flow-lane/harness-recovery.ts`
  by named field only, so the three keys added to each receipt cannot reach its
  contract — verified by reading, not by running its suite.

## Open questions / contradictions found

1. **`currentSubflowId` was dead.** It is documented as the thing that makes a
   resume point name its graph, and nothing set it. I set it from
   `input.subflowId` in `live-patch.ts`'s `trialOptions`. That also means the
   trial's own recovery-budget accounting is now scoped to the Subflow rather
   than unscoped — correct, but a behaviour change the brief did not anticipate.
   Worth a second opinion.
2. **The refusal cannot be seen from the `runFlow` endpoint.** `terminalReason`
   is `runtimeSession.trace?.message ?? status`, so an API caller sees the
   original failure and must fetch the run detail to learn the run stopped rather
   than continued. Fixing that means a contracts field; I judged it out of scope.
3. **`resumeFrom` is present on every verdict, including contradicted ones.**
   The retry only ever sees points from `verified` receipts, since
   `retryOriginalAction` requires `verified`. If a later caller reads `resumeFrom`
   off a contradicted verdict, the guards here do not protect it — `resumable` is
   the only thing that does, and that contract lives in `flow-change/contracts.ts`.
