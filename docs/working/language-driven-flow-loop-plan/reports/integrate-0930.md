# integrate-0930: merge-conflict resolution for lanes t176 and t182

Worker report, 2026-09-29. Nothing committed, pushed, or branch-switched. No Lab
or browser run.

## Outcome

**Partial.**

- Job 1 (t176) is done: resolved, staged, and validated.
- Job 2 (t182): the service.ts reduction is written and staged, but **not
  validated**.
  - The supervisor's slot-1 hold stopped me from running checks.
  - Then the restart notice stopped me from running anything.
  - So `structure-audit`, Core tsc and vitest have not run for the t182 change.
    The next agent must run them before committing.

## Job 1: lane t176

Downstream tree `C:\Users\osrs_\FluxStuff\fxwork\t176\!FluxIQWebExtension`,
branch `task/t176-repair-replay`, `git merge dev` in progress (MERGE_HEAD
2680dabf, "Merge task t180: run-control"). **A merge commit is pending**: all
three conflicts are resolved and staged, `git diff --name-only --diff-filter=U`
is empty, and the supervisor commits.

The three conflicted files were not the ones the brief predicted (flow-lane /
run-scenario / bench). Everything else, including `run-scenario.ts`, merged
cleanly.

### Files resolved

1. `packages/test-runner/src/flow-lane/terminal-run-wait.ts`. The only conflict
   was the post-loop return.
   - t176 returned `unsettled: pending` for `recovery` or `repair`.
   - dev (t177) returned `unsettled: "recovery"` plus
     `recoveryState: "recovery.still_running"` when Core had marked it running.
   - Resolution: two lines. A `repair` returns `{ unsettled: "repair" }`, and a
     `recovery` returns dev's form with the marker. The auto-merged loop body
     already holds both sides: dev's `coreRecoveryState` marker handling and
     t176's `fullDeadline` restore for `repair`. They compose, because the
     marker is only read when `pending === "recovery"`.
2. `packages/test-runner/src/flow-lane/tests/terminal-run-wait.test.ts`. Both
   sides appended independent tests at the same spot. I kept both: t176's two
   repair tests, then dev's `markedRun`/`waitOn` helpers and five recovery-marker
   tests.
3. `apps/scenario-lab/src/scenarios/photo-social/live-tasks.ts`. The two rows
   are the union of both sides.
   - verified-upsell: `variantArmedAfterBuild: true` from dev (t184).
   - moon-jar: `permissionPoint: { consequence: "send_or_publish", control: "Send" }`
     from t176.
   - dev's updated `photo-social/tests/scenario.test.ts` (auto-merged) projects
     only id/judgeBy/expectedDatasetId/variantId/variantArmedAfterBuild, so it
     agrees with the union.

### Core sibling

`C:\Users\osrs_\FluxStuff\fxwork\t176\!FluxIQ`, on branch
`task/t176-repair-replay` at 069b1f4 "Merge branch 'dev' into
task/t176-repair-replay". `git merge-base --is-ancestor dev HEAD` succeeded, so
Core dev (e85a02a, t180) was already merged. No merge was run and no Core commit
is pending.

### Commands and observed results (t176)

These ran before the supervisor's slot-1 message reached me.

- `pnpm --filter @fluxiq/contracts --filter @fluxiq/client-gateway-websocket --filter fluxiq build`
  (Core t176): contracts, client-gateway-websocket and fluxiq each printed
  `build: Done`.
- `pnpm check` (downstream t176): EXIT=0.
  - Printed `structure-audit: passed (120 warning(s), 120 baselined).`
  - Every package check printed `Done`.
  - Advisory warning: `terminal-run-wait.ts: 407 lines is past the 400-line
    advisory threshold` (baselined warning, not a failure).
- `pnpm build` then `node --test dist/flow-lane/tests/terminal-run-wait.test.js`
  (packages/test-runner): 13 tests, 13 pass, 0 fail.
- `pnpm build` then `node --test dist/scenarios/photo-social/tests/scenario.test.js`
  (apps/scenario-lab): 12 tests, 12 pass, 0 fail.
- `node --test "dist/flow-lane/**/*.test.js" "dist/tests/*.test.js"`
  (packages/test-runner): 651 tests, 651 pass, 0 fail.

## Job 2: lane t182

Core worktree `C:\Users\osrs_\FluxStuff\fxwork\t182\!FluxIQ`.

### State

- **No merge is in progress in this tree, and none was needed.** HEAD is detached
  at 80d818c, "Merge branch 'dev' into task/t182-hardening-privacy". That is
  exactly the tip of `task/t182-hardening-privacy`, and it already contains Core
  `dev` (e85a02a, "Merge task t180: run-control");
  `git merge-base --is-ancestor dev HEAD` succeeded.
- **`git merge` is blocked for workers.** The worker PreToolUse hook refuses it
  ("workers must not change git history"), even though the brief allowed it. I
  did not try to get around the hook. It is moot here, since dev is already in.
  It also applies to Job 1's Core sibling, which needed no merge either.
- **The branch cannot be checked out in this worktree.** `git checkout
  task/t182-hardening-privacy` fails with "already used by worktree at
  'C:/Users/osrs_/FluxStuff/!FluxIQ'", which is the primary/shared Core
  checkout.
  - The edits sit on the detached HEAD at the branch tip.
  - To commit them onto the branch, the supervisor can commit here and then run
    `git branch -f task/t182-hardening-privacy HEAD`. That only works if the
    primary checkout is moved off the branch first, because git refuses to
    force-move a branch that is checked out elsewhere.
  - Or it can commit in the primary checkout after carrying the staged diff
    across.
- **The t182 change is staged, not committed:**
  - `M  packages/fluxiq/src/programs/automation-studio/runtime/service.ts`
  - `M  .../runtime/service/indexes/index.ts`
  - `A  .../runtime/service/indexes/without-recording.ts`
  - `A  .../runtime/service/indexes/tests/without-recording.test.ts`
  - `M  .../runtime/service/recordings/store.ts`

### What changed and why

- **Line count:** `service.ts` goes from 4559 to 4548 lines (`wc -l`), under the
  4558 ratchet with 10 lines of headroom.
- **Class methods unchanged:** no method was added or removed, so it stays 222
  against the 222 limit.
- **Moved logic:** `deleteProjectRecordingPipeline` had an inline 11-field
  filter that removes a deleted recording's rows from the project pipeline
  index. It was a pure function, and `AutomationStudioRecordingStore.prunePhysicalPipelineIndex`
  in `service/recordings/store.ts` held a byte-identical copy of it.
- **New module:** `service/indexes/without-recording.ts` exports
  `pipelineIndexWithoutRecording(index, recordingId, artifactIds): PipelineIndex`.
  It is exported from the `service/indexes` barrel, and both callers now use
  it, so the two deletion paths cannot drift.
  - Semantics are unchanged: the same 11 keys, the same predicate (the row names
    the recording, or its id is in `artifactIds[kind]`), and pipelines are
    filtered by recording only.
- **Imports:** `recordings/store.ts` now imports a value, not only a type, from
  `../indexes/index.ts`. I read the `indexes/` imports (`store.ts`, `types.ts`):
  neither imports `recordings/`, so there is no import cycle.
- **New test:** `service/indexes/tests/without-recording.test.ts` (vitest, 2
  cases).
  - It drops only the deleted recording's rows across the pipelines, miningRuns
    and policyProposals kinds.
  - It drops a row with no `recordingId` whose artifact id belongs to the
    recording, and returns the full 11-key shape.
- **Baseline not touched:** I did not edit `.structure-baseline.json`, which is
  not mine to edit. The supervisor may ratchet `file-lines` for service.ts down
  to 4548 with `pnpm structure:baseline`.

### Checks for Job 2: NOT RUN

Run these in `C:\Users\osrs_\FluxStuff\fxwork\t182\!FluxIQ` before committing:

- `node scripts/structure-audit.mjs`
  - Expect service.ts at 4548 against a limit of 4558, with class-methods at 222.
- `pnpm --filter fluxiq exec tsc -p tsconfig.json --noEmit`, or the package's
  own check script.
  - The test file uses `status: "proposed"`, which matches
    `PolicyProposalArtifact["status"]`. Nothing has compiled it.
- `npx vitest run --minWorkers=1 --maxWorkers=2` on
  `packages/fluxiq/src/programs/automation-studio/runtime/service/indexes/tests/without-recording.test.ts`,
  plus any existing recording-deletion tests. Search for `prunePhysicalPipelineIndex`
  or `deleteRecording` under `runtime/tests` and `service/**/tests`.

## Not verified

- **Job 2:** none of the audit, tsc or vitest ran.
- **Job 1:** not run are full `pnpm test`, `pnpm build`, and Core tests in the
  t176 Core tree. Only the build ran there.
- **Job 1 ran during the hold:** the t176 checks ran while `lab-slots/slot-1`
  existed, before the supervisor's hold message reached me. If a live run
  shared the machine then, it may have been slowed. The checks themselves
  passed.

## Open questions or contradictions

- **The brief's conflict list was wrong.** It predicted conflicts in
  flow-lane/run-scenario/bench/scenario-lab. The actual conflicts were
  terminal-run-wait (source and test) and photo-social live-tasks.
- **Brief vs hook:** the brief allowed `git merge`, but the worker hook denies
  it. Worker briefs should not rely on `git merge`.
- **Branch checked out elsewhere:** `task/t182-hardening-privacy` is checked out
  in the primary Core checkout `C:/Users/osrs_/FluxStuff/!FluxIQ`, so the t182
  worktree can only stay detached.
- **Background task:** a waiter (id blv5nyua2) that polls for slot-1 to vanish
  may still be alive. It only prints one line and exits.
