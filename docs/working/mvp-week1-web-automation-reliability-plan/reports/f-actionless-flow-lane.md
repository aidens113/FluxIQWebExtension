# f-actionless-flow-lane: a workflow whose script performs no action plans no Flow-lane row

Worker report for `f-actionless-flow-lane` in [finish-week1.md](../briefs/finish-week1.md).
Written 2026-09-13. Started at HEAD `0257357`; HEAD moved to `c15896d` during the work, and
`git diff --stat 0257357 HEAD` over every owned path printed nothing. No commit, no Lab
command, no `pnpm build`, no Core edit.

## Outcome

**Done.** One shared check in test-contracts, `flowLaneExclusion(script)`, decides that a
workflow whose non-empty recording script records no action has no Flow lane, and names why.
- **The planner** uses it, so the week1 plan now has 63 runnable results per repeat, not 67.
- **The runner** uses it, so a `--flow` run of such a workflow is refused as `fixture.invalid`
  before the evidence bundle, Core or a browser exists.

Each guard has a mutation proof and was restored byte-identical, checked by sha256. Both
packages' `check` passed, and so did the structure audit.

**One gate needs the supervisor.** test-runner's full suite needs a rebuilt shared
`packages/test-contracts/dist`; see Commands, items 7-9. I did not rebuild it, as instructed.

## What changed and why

**1. New `packages/test-contracts/src/flow-lane-exclusion.ts`** (28 lines, one exported value).
- `flowLaneExclusion(script: readonly Pick<ScenarioStep, "operation" | "pagination">[]): string | undefined`.
- It returns a reason when the script is non-empty and `recordableActionTypes(script).size === 0`.
- Which steps count as actions comes from the contract's own table, `ACTIONS_BY_OPERATION`
  in `recordable-actions.ts`. That table is keyed by every `ScenarioStepOperation`, not by a
  list of rows.
  - `waitForState`, `checkpoint`, `waitForDownload` and an `extract` with no `pagination`
    yield nothing.
  - A paginated `extract` yields clicks.
- **An empty script returns `undefined`.** An empty script is a playback goal, which no
  recording produces. This mirrors `validation.ts:190-192`, which does not judge it either.
  It also keeps `bench/tests/run-bench.test.ts` valid: its stub scenarios use
  `recordingScript: []` and plan Flow rows.
- **The reason text** (W04 shown; W08's says `operations: extract`):
  `the Flow lane builds its Flow from the workflow's own recording, and no step of the
  workflow's recordingScript records an action (operations: extract, checkpoint), so no
  recording of it can yield a Flow`

**2. `packages/test-contracts/src/index.ts`:** `export * from "./flow-lane-exclusion.js";`.
Without it the runner could not import the check. `recordable-actions.ts` stays unexported,
because nothing outside the package needs it.

**3. `packages/test-runner/src/bench/expand-corpus.ts`** (`planEntry`).
- The change is one line:
  `const skipReason = laneSkip ?? (lane === "flow" ? flowLaneExclusion(resolved.recordingScript) : undefined);`.
- `planEntry` is the first point where the resolved script is known.
- The doc comments on `lanesForResult`, `BenchPlanEntry.skipReason` and `planEntry` now say so.
- **A choice, see Open question 1.** All four W04 and W08 Flow-lane entries are *planned and
  skipped* with the reason, not dropped.
  - `plannedLanes` already holds that a result no lane can run is "listed as skipped with
    its reason rather than dropped without a word".
  - A skipped entry is never counted as a pass or a failure (`run-bench.ts:100-110`), and
    `report.md` lists it with its reason (`render-markdown.ts:39-56`).
  - So the Stage 3 exclusion the supervisor now does by hand is printed by every future bench.

**4. `packages/test-runner/src/run-scenario.ts`** (694 → 697 lines).
- `flowLaneExclusion` is added to the test-contracts import.
- In `resolveWorkflow`, right after the existing variant refusal:
  `const noFlowLane = options.flow ? flowLaneExclusion(workflow.recordingScript) : undefined;`
  `if (noFlowLane !== undefined) throw new RunnerFailure("fixture.invalid", \`A Flow run was refused: ${noFlowLane}\`);`
- **Gated on `options.flow` alone.** `commands.ts:40` already refuses `--flow` on existing and
  clone targets, and a recording-lane run of W04 or W08 is untouched.
- **Where it runs:** `resolveWorkflow` is called at line 53, before `bundle.initialize()`,
  `requireExtension` and `startTopology`.

**5. Tests.**
- **New `packages/test-contracts/tests/flow-lane-exclusion.test.mjs`**, 3 tests covering both ways:
  - W04's and W08's shapes, and every non-acting operation, give the reason.
  - Every other contract operation, and a paginated extract, keep the lane. The list of acting
    operations is pinned, so a new operation fails until someone places it.
  - An empty script is not judged.
  - **Placement:** the package's own `tests/` folder beside `src/`. All seven existing
    test-contracts tests live there, and it is the only place its `test` script runs
    (`node --test tests/*.test.mjs`, against `dist`). A file in `src/tests/` would run nowhere.
- **`packages/test-runner/src/bench/tests/week1-corpus.test.ts`:**
  - The counts are now `[63, 23, 0, 21, 19]`.
  - The Flow lane's unarmed results equal the recording lane's, minus W04 and W08.
  - The criterion-1 list drops W04 and W08.
  - W04 and W08 still run on the recording lane.
  - The resolved-but-skipped entries are exactly the four W04 and W08 Flow entries, each with
    the reason.
  - Unresolved entries still equal `UNRESOLVED_TODAY`.
- **`packages/test-runner/src/run-evaluation/tests/runner-wiring.test.ts`**, one new test. It
  goes here because `src/tests/` holds 50 files and has no headroom.
  - **Source pins:** the import; exactly one call; the `options.flow` gate; and the order
    resolve < `bundle.initialize()` < `requireExtension` < `startTopology`.
  - **A real call:** `runScenario({ scenarioId: "product-catalog", flow: true, runsDirectory: <mkdtemp>, environment: { FLUXIQ_LAB_EXTENSION_PATH: <nonexistent> } })`.
    - It must reject with a `RunnerFailure` of category `fixture.invalid` and the message.
    - The runs directory must stay empty.
    - The nonexistent extension path is the safety net: a run the refusal missed stops at
      `requireExtension`, before Core or a browser. The runner mutation below demonstrated this.
    - Cleanup retries `rm` (`maxRetries: 10`), so a half-closed bundle cannot mask the assertion.

## Commands run and observed results

**How the private builds ran.**
- Each package was built with `pnpm exec tsc -p tsconfig.json --outDir dist-f-actionless`.
- Why a resolve hook was needed:
  - test-runner type-checks test-contracts from `src/index.ts`, but at runtime it imports
    `packages/test-contracts/dist`.
  - That shared dist has no `flowLaneExclusion`: `ls dist/flow-lane-exclusion.js` printed
    `No such file or directory`.
- What the hook does: a scratchpad resolve hook (`f-actionless-register.mjs`, `f-actionless-hooks.mjs`)
  rewrote `/packages/test-contracts/dist/` to `/packages/test-contracts/dist-f-actionless/`.
- How it was passed to Node:
  - the first runs used `node --import <hook> --test`;
  - the final runs used `NODE_OPTIONS=--import=<hook>`, so spawned CLI children use it too.
- Proof it was in effect: test-contracts' own tests import `../dist/index.js`, so the new
  tests passing shows the redirect worked.
- Both `dist-f-actionless` directories were deleted afterwards (`ls` printed "No such file" for both).

1. **test-contracts `pnpm run check`:** exit 0, after the edits and again at the end.
2. **test-contracts private build:** exit 0.
3. **test-contracts tests:** exit 0, `# tests 69 # pass 69 # fail 0`, both times. The new
   tests were ok 27, 28 and 29.
4. **test-runner `pnpm run check`:**
   - First run: exit 0.
   - The last-pass run: exit 2, with
     `src/run-evaluation/tests/observed-run-evaluation.test.ts(13,82): error TS2322: Type '{ sanitizedPacketBytes: number[]; rawSnapshotBytes: never[]; truncationCount: number; }' is not assignable to type 'FlowLaneEvidence'`.
   - Why: another worker's in-flight edit. `git status` showed `M` on `run-evaluation/flow-lane-evidence-sizes.ts`,
     `observed-run-evaluation.ts` and their tests, and `??` on `evidence-budget-invariant.ts`.
   - A rerun alone: exit 0.
5. **test-runner private build:** exit 0 at first; exit 2 during that same parallel edit;
   a clean rebuild then exited 0.
6. **Targeted tests** (`week1-corpus`, `runner-wiring`, `run-bench`): exit 0, `# tests 21 # pass 21`.
   The diagnostic printed `runnable: 63 (23 recording; 40 flow, 21 unarmed and 19 variants); skipped: 4`.
7. **Full test-runner suite, first run with `--import`:** `# tests 573 # pass 571 # fail 2`.
   - The failures were `not ok 297 - CLI auth status and clear need only existing origin and username`
     and `not ok 310 - clone-cache refresh reports invalidate-now and refresh-on-next-run semantics`.
   - Both had the same error:
     `Command failed: node ...\dist-f-actionless\cli.js auth status` (and `clone-cache refresh`), then
     `SyntaxError: The requested module '@fluxiq-web-extension/test-contracts' does not provide an export named 'flowLaneExclusion'`.
   - Cause: the spawned child did not get the hook, so it read the shared dist. **So test-runner's
     gate needs a rebuilt shared `packages/test-contracts/dist`.**
8. **Full suite with `NODE_OPTIONS`, during the parallel edit:** `# tests 573 # pass 568 # fail 5`.
   - The failures were tests 208-213 in `flow-lane-evidence-sizes.test.js` and
     `observed-run-evaluation.test.js`, the other worker's files. The build had exited 2.
   - `ok 297` and `ok 310` passed: the CLI tests pass once the child sees the private build.
9. **Full suite with `NODE_OPTIONS`, after a clean check and build:** `# tests 588 # pass 586 # fail 2`.
   - The failures were `not ok 63 - two new recordings fail as soon as both are listed`
     (`Missing expected rejection.`) and
     `not ok 64 - a second new recording listed while the first finalizes fails once the first is finished`
     (`The validation function is expected to return "true". Received false`).
   - Both are at `demo-workspace/tests/control-waits.test.js:77` and `:84`. Its source file is
     untracked, `control-waits.ts` is modified, and both belong to another worker.
   - That file run alone: `# tests 7 # pass 5 # fail 2`, so the failure reproduces. It has real
     assertion messages and is not mine; I did not touch it.
   - Mine in the same run: `ok 27` (run-bench on both lanes), `ok 37` (week1, 63), `ok 236`
     (the refusal), `ok 312` and `ok 325` (the CLI tests).
10. **`node scripts/structure-audit.mjs`**, through a scratch `GIT_INDEX_FILE` with `git add -N`
    on the two new files: exit 0, `structure-audit: passed (41 warning(s), 17 baselined).`, twice.
    - Advisory warnings on my files: `packages/test-contracts/src/: 19 source files is past the 15-file advisory threshold`
      and `packages/test-runner/src/run-scenario.ts: 697 lines is past the 400-line advisory threshold`.
    - No failure, and no baseline entry is needed.

**Mutation proofs.** Each mutation was applied with Edit, rebuilt privately and tested, then
restored. Each file was checked with `sha256sum -c` against the hash taken before the mutation.

| Guard | Mutation | Failing test and quoted output | Restored |
| --- | --- | --- | --- |
| Planner (`expand-corpus.ts`) | `const skipReason = laneSkip;` | `not ok 4 - week1 plans 63 runnable results per repeat: ...`. The diff showed `+ 67, - 63, ... + 23, + 21, - 21, - 19`, and the diagnostic printed `runnable: 67 (23 recording; 44 flow, 23 unarmed and 21 variants); skipped: 0` | `expand-corpus.ts: OK` (`5b61f3e6…`) |
| Runner (`run-scenario.ts`) | the `if (noFlowLane !== undefined) throw ...` line deleted | **First attempt:** the failure was reported as `ENOTEMPTY: directory not empty, rmdir '...\.staging-run-mu04w6us-c6962527'`, from the test's own cleanup, which hid the assertion. After the retrying cleanup, rerun with the mutation still applied: `not ok 8 - a Flow-lane run of a workflow whose script records no action is refused ...` with `error: "the run is refused, not run: ENOENT: no such file or directory, open '...\no-extension\manifest.json'"`, and the other 7 tests ok | `run-scenario.ts: OK` (`384ab86c…`) |
| Shared check (`flow-lane-exclusion.ts`) | `size > 0` became `size >= 0` (never excludes) | `not ok 1 - a script whose steps only read or wait on the page has no Flow lane ...`, `+ 'undefined' - 'string'`. Downstream: week1 `not ok 4` with `runnable: 67 ... skipped: 0`, and runner-wiring `not ok 12` with "the run is refused, not run: ENOENT ..." | `flow-lane-exclusion.ts: OK` (`6632bb39…`) |

The first runner mutation left one temporary directory, `fluxiq-no-flow-lane-fsFGBQ`, which was
removed. Every later count of `$TEMP/fluxiq-no-flow-lane-*` printed 0.

## Not verified

- **No Lab run.** What a Lab run must show:
  - A week1 bench plans 63 results per repeat.
  - `report.md`'s skipped table lists exactly four entries, each with the reason above:
    - W04 `product-catalog` unarmed, Flow lane, `operations: extract, checkpoint`;
    - W04 `text-variant`, Flow lane, `operations: extract, checkpoint`;
    - W08 `data-table` unarmed, Flow lane, `operations: extract`;
    - W08 `column-reorder`, Flow lane, `operations: extract`.
  - W04's and W08's recording-lane rows still run and pass.
  - A direct `lab run product-catalog --flow` and `lab run data-table --flow` exit at once with
    `fixture.invalid` and "A Flow run was refused: ...". No Core starts and no bundle is written.
- **How the CLI prints a refusal thrown before the bundle.** It is the same path as the existing
  variant refusal, and was not exercised.
- **test-runner's `pnpm test` against the shared dist.** It fails the two CLI tests until
  `pnpm --filter @fluxiq-web-extension/test-contracts build` has run. Lab worktrees need the same
  rebuild before a Lab run at a pin that includes this change.
- **Not run:** root `pnpm check`, `pnpm test` and `pnpm build`.
- **Other workers' failures** (the demo-workspace `control-waits` tests and the evidence-sizes
  compile errors) were not investigated.

## Open questions or contradictions found

1. **Skipped, or not planned at all?**
   - **What the brief and the investigation say.**
     - The brief says "plans no Flow row", and its test wants W04's and W08's Flow rows "absent"
       from the 63.
     - The investigation contradicts itself. Its section 4.3 would plan the unarmed Flow row not
       at all and skip only the variants; its section 4.5 wants "exactly the four W04 and W08 Flow
       entries, each with the reason".
   - **What I did:** all four are planned and skipped. They are absent from the 63 runnable
     results, which keeps the "never dropped without a word" rule and one rule in one place.
   - **If the unarmed Flow entries should be dropped entirely:** `plannedLanes` would need the
     resolved script, and the week1 test's skip list would shrink to the two variants.
2. **Stale text outside my ownership.** This is the "ownership around a file" defect: these now
   state wrong counts, but were not in Owns.
   - `packages/test-runner/src/bench/corpus/week1.ts:16-23` says "67 runnable results per repeat,
     23 on the recording lane and 44 on the Flow lane (23 unarmed, 21 variants)" and "makes W01-W18
     a measurement of FluxIQ". It should say 63; 40 on the Flow lane (21 unarmed, 19 variants); and
     W04 and W08 on the recording lane only.
   - `docs/architecture/testing-facility.md:1111-1116`, per `i-w04-w08-no-proposal`; I did not read
     it. It describes the bench planner, so it is required documentation.
3. **Test placement in test-contracts.** The AGENTS.md rule reads `a/tests/b.test.ts`, but this
   package runs only root `tests/*.test.mjs` against `dist`. I followed the package's layout;
   placing it under `src/tests/` would need the package's `test` script changed.
