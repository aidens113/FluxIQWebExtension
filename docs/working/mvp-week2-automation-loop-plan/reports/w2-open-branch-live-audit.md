# w2 open-branch live audit

Worker report, 2026-09-20. This was a read-only audit of the seven tasks shown
by `pnpm task list`, their branch deltas, paired Core worktrees where present,
and only the report directly associated with each task. No source, test, task
branch, Core file, commit, push, build, unit test, or live run was touched. This
report is the only file added.

## Outcome

Three branch units still matter to live Week 2 work:

- **t011 is the active correctness gate.** Continue it first and do not land it
  until the single `social-scheduler-schedule-post` live proof passes through
  exploration, proposal, playback, and oracle judgement.
- **t005 has an unlanded downstream half.** Contrary to the working document's
  summary, commit `4766b59` is unique to its branch. Core's state-recording half
  is on Core `dev`, but downstream `dev` has no `captureStateDigest` binding or
  `state-digest.ts`. This needs a current-tree port and focused live repair
  proof, not a merge of the 64-commit-stale branch.
- **t021 belongs in the live sequence, but not in `dev` as it stands.** Its Core
  implementation is uncommitted, based 18 Core commits behind current `dev`,
  and its own live comparison demonstrated zero completed multi-action batches
  and no benefit. It becomes meaningful only after t011, a field-entry
  exploration action, and a truthful downstream `targetsUnchanged` signal.

The other four open task branches contain no commits or working changes not
already on `dev`. Their task records should be closed; any residual product gap
from their reports is new follow-up work, not a reason to retain the branches.

## Branch-by-branch disposition

| Task | Evidence against current `dev` | Disposition | Dependencies and overlap risk | Narrow first live proof |
| --- | --- | --- | --- | --- |
| **t005 `exploration-state`** | Extension is **1 ahead / 64 behind**. Unique commit `4766b59` adds `state-digest.ts`, its tests, and wiring in `llm-evidence/{tools,index}.ts`. Current extension `dev` has no `captureStateDigest` occurrence. Paired Core branch has no unique commit because its state recorder is already on Core `dev`. | **integrate-live** | Port the downstream half onto current code rather than merging the stale branch. It overlaps t011 in `domain/src/runtime/llm-evidence/tools.ts` and `index.ts`; land/stabilize t011 first, then reconcile the digest with the newer element and stable-handle shapes. The exhaustive projection will need review for fields added since the old base. | One repair exploration that changes page state and then reverses it: inspect the recorded before/after digests and require a truthful `stateChainIntact` plus a replayable reduced sequence. Do not start with a corpus or unit suite. |
| **t006 `resumable-caller`** | Extension is **0 ahead / 63 behind**, clean. Paired Core has no unique commit or working change; its commit `1bb3f9e` is already reachable from Core `dev`. Current State records the resumable refusal/resume-point work as landed. | **superseded/close** | No branch integration. The report's remaining “prior values after resume” gap is separate work, not an unmerged branch delta. | None for branch closure. If the remaining gap is scheduled, use one live repaired Flow whose resumed node consumes an earlier node's value and prove no side effect before the resume point repeats. |
| **t007 `adaptation-confidence`** | Extension is **0 ahead / 63 behind**, clean. Paired Core has no unique commit or working change; `5e1fe9b` is already reachable from Core `dev`. The recorder exists on current Core `dev`; grep still finds no non-test caller of `recordAutomationStudioAdaptationReplays`, exactly the report's unwired follow-up. | **superseded/close** | Close the branch. Wiring the recorder and deciding how `testing` advances are new Core work; do not pretend the old branch contains them. | None for branch closure. For the follow-up, replay one saved repaired Flow twice without a model and observe the same adaptation progress from provisional to established in persisted detail. |
| **t008 `live-campaign`** | Extension is **0 ahead / 61 behind**, clean. The campaign catalog/runner described by its report is present on `dev` and has since been extended and split. | **superseded/close** | No branch integration; reviving this old branch risks reverting later campaign, lane, and reporting work. | None. Use current `pnpm lab:campaign` only as the end-of-fix measurement, after focused single-task live proofs. |
| **t011 `exploration-reveal-safety`** | Extension is **7 ahead / 1 behind** with a 41-file diff. `4a39262` wires exploration press permission, while the report records failed live proofs: `create_new` versus instruction-derived `send_or_publish`, plan-handle consequence metadata rejected by Core, and a created-lane 30 s timeout. The worktree source is clean; its only untracked file is the current Core-seam investigation report. | **integrate-live** | First incorporate current extension `dev`. Core must (1) explicitly decide the exact declared consequence classes while retaining exact fail-closed comparison and (2) accept/validate consequence metadata on reserved plan-handle references. Downstream must make opening/showing/ticking declare `[]`. Its `tools.ts`/`index.ts` overlap t005, and Core permission changes must precede any meaningful t021 proof. | Run only `social-scheduler-schedule-post`. The opening `New post` press must declare `[]`; the first lasting action must be explicitly authorized from the instruction; no permission request should remain; playback must schedule the post and the oracle must pass. Only then isolate the still-observed `run-runtime-session` timeout if it recurs. |
| **t017 `tgt-telemetry`** | Extension is **0 ahead / 38 behind**, clean; the report intentionally changed no code. It proved live that Core's constant `unresolved_no_candidates` is published as if it were browser resolution and then fed to repair. | **superseded/close** | Close the empty branch. The diagnosis remains valid backlog: Core should omit its non-answer and separately lift the adapter's real resolution; test-runner then publishes it. That is a new cross-repository task, not integration from t017. | After that new implementation, run one known successful select/click and one auth-gated failure. The successful action must show the adapter's real strategy; the auth failure must not tell repair that zero candidates were found. |
| **t021 `batch`** | Extension is **0 ahead / 27 behind**, clean. Paired Core branch is 18 commits behind current Core `dev` and holds **uncommitted** changes: 13 tracked files plus new `evidence-batch/`, `evidence-window.ts`, and a batch test. Current Core `dev` has no `tool_calls`, `core.batch_result`, or `targetsUnchanged` implementation. The live report observed four batch-shaped replies, but every batch stopped after its first action; calls rose 15 → 27 and no Flow was created. | **integrate-live**, sequenced; **do not merge as-is** | Required before a fair proof: t011 landed and passing; a downstream field-entry exploration action; downstream `targetsUnchanged: true` only when the page address and handle meaning genuinely remain stable. Merge current Core `dev` into the task before further edits. Current Core changed both `generation-failure.ts` and `service.ts` since the base, so those need manual reconciliation. Preserve per-action permission checks and fail the batch before later actions on a request/refusal. Resolve the report's audit concern that a permission request must not claim the model saw intermediate evidence it did not see. | On the now-correct `social-scheduler-schedule-post`, run a same-code single-action baseline, then enable optional batching. Require at least one batch to complete two or more ordered actions (for example open/inspect or field entries), the created Flow and oracle to pass in both runs, and report provider calls, actions, stops, time, and cost. If every batch still stops after action one or correctness regresses, keep t021 held rather than landing it. |

## Recommended live order

1. Finish t011's schedule-post proof and land it only after the proof passes.
2. Port t005's downstream digest onto that current tree and prove one live repair
   reduction; do not merge `4766b59` mechanically.
3. Add the missing field-entry action and truthful `targetsUnchanged` result,
   then reconcile t021 with current Core and run its focused before/after.
4. Close t006, t007, t008, and t017 as stale task records. Preserve the t007
   recorder-caller and t017 telemetry findings as separately owned backlog.
5. Run the full live corpus only after these focused proofs work; unit and full
   regression suites remain the final net, not the iteration loop.

## Validation and limits

- `pnpm task list` reported exactly t005, t006, t007, t008, t011, t017, and
  t021 as open.
- Branch ahead/behind counts and `dev...branch` diff stats were inspected for
  every row. Paired Core worktrees were inspected for t005, t006, t007, and
  t021. The t021 uncommitted Core diff is 176 insertions / 101 deletions before
  counting its untracked new files.
- No tests or live runs were performed, as required by the audit brief. Live
  claims above come from the task reports and are identified as such.
- The t011 worktree is being actively resumed by another unit. This audit did
  not read future edits into its disposition and did not touch that worktree.
