# t195-w32: a refuted result is not a failed step, and a repair round's opening is not a Flow step

`R` = Core `packages/fluxiq/src/programs/automation-studio/runtime/`.

## Outcome

**Partial.** C3 is done. C4 is done in Core's attempt and in the Lab. One part is not done: "it routes to the re-author only".
That routing belongs to a file outside my ownership, `R/service/runtime-adaptation/refuted-result-port.ts`. I added
the predicate that file needs, but did not wire it in. See Open questions 1.

## What changed and why

### C4, Core: `R/recovery/refuted-result/attempt.ts` (+ `tests/attempt.test.ts`)

- When an attempt **stored records** (`metadata.recordCount`), the refuted attempt still names that attempt. It is the
  step whose rows were judged. `repair.ts:135` passes that node to `history.ts:103`, and that is where the
  re-author's brief gets its line "The rows came out of step X (def) authored with parameters …" (`brief.ts:94`).
- When **no step stored records**, the attempt now names no step. The old fallback, "the last attempt that succeeded",
  is removed. That fallback is what named run 38's `s6` navigate and bigbox's `s14` Add to cart.
- A node id cannot be empty. The typed run store refuses an attempt without one
  (`storage/project/runtime-stream-store.ts:536`, `requiredId(action.nodeId, "action node")`, pattern
  `^[A-Za-z0-9._:-]+$`). So a refutation that names no step carries the exported
  `AUTOMATION_STUDIO_REFUTED_RESULT_NODE_ID = "result-verification"` as both its `nodeId` and its `definitionId`.
  This id is valid and no Flow node has it. As a result:
  - `history.ts` finds no `flowShape` entry, so the brief claims no step.
  - Nothing joins the attempt to a real node.
- New exported predicate `automationStudioRefutedResultAttemptNamesNode({ nodeId })` answers `false` for that attempt.
  It is there for the port to route on.
- The failure record is unchanged. It is still `output_not_observed`, stage `verification`, and
  `core-observation.ts` was not edited. The id prefix and the ordering are unchanged. The timing is unchanged: the
  attempt starts at the producer's finish, or else at the last succeeded step's finish.
- A run with no succeeded attempt still builds no attempt, as before.
- Tests:
  - Run 38's six-step shape (navigate, click, navigate, click, click, navigate, no `recordCount`) produces an attempt
    on `result-verification`. Its order is 7, its category and stage are unchanged, and no Flow node is named.
  - `NamesNode` is false for that attempt and true for the record-producer case.
  - When the only record producer failed, the attempt names no step and does not fall back to the step before it.
  - The existing "prefers the step that stored records" tests still pass.

### C4, Lab: `packages/test-runner/src/flow-lane/persisted-flow-run.ts` (+ `tests/persisted-flow-run.test.ts`)

The Lab now spots this attempt by its attempt id, the prefix `result-verification.` from Core's
`AUTOMATION_STUDIO_REFUTED_RESULT_ATTEMPT_PREFIX`. It does not go by node, so Core's old records (filed under `s6`) and
its new ones (`result-verification`) both read the same way. For such an attempt:
- `actionType` is `"result_verification"` and `nodeId` is `null`.
- There is no `durationMs`. No action ran, so it adds nothing to the action-latency figures in `lane-observation.ts`.
- It is left out of `attemptNodeIds` and `durationsByNode`, so its 1228 ms no longer counts toward `s6`'s time.
- The run's `failure` is still the refutation. `recoveredByNode` puts an attempt with a null node in a group of its
  own (`unnamed:<i>`).

The new test covers both ways of filing. It checks for no failed navigate, `failure` equal to the refutation, no
duration, and an `s6` duration of 300 ms rather than 300 + 1228.

### C3, Core: `R/llm/evidence-loop.ts` (lane B's file; I changed only the opening lines, 532-534)

- The opening `ToolCall` now carries `add: true` only when the round is **not** resuming a draft. The check is
  `input.draft !== false && input.draft?.resume`, the same signal the loop reads at `:595` (`const resume = …`).
- The opening still runs. The navigation still happens and is recorded as `taken`, so a resumed n-step draft stays at
  n kept steps.
- The comment was folded into one line because the file is at its line ratchet.
- **Test location (lane B's directory):** three cases were added at the end of
  `R/llm/evidence-loop/tests/resume.test.ts`, in a new `describe("the opening of a round that resumes a draft")`:
  - a resumed 5-step draft keeps exactly `call.1`–`call.5`, and the opening is `taken`;
  - with no draft, the opening is still kept;
  - with `seed: []` and no resume, the opening is still kept.
- I first wrote these as a new file, `resumed-opening.test.ts`. The structure audit failed it: `evidence-loop/tests/`
  would have held 26 files, over the 25-file limit. So I deleted that file and moved the cases into `resume.test.ts`.
- With the fix reverted by hand, the resumed-draft case fails (`1 failed | 12 passed`). I put the fix back afterwards
  (the diff on `evidence-loop.ts` is 2 lines).

### Bigbox `run-muqiojz4-04a7a8fc`: C4, plus C3

Run directory: `C:/Users/osrs_/FluxStuff/fxwork/t193/!FluxIQWebExtension/test-runs/instances/t193-slot-2/run-muqiojz4-04a7a8fc/`.

- **The "unexpected `output_not_observed` failure" is C4.** In `snapshots/flow-lane.json`, `actions` has 15 entries.
  The first 14 (`s1`–`s14`) all have `succeeded` / `matched`. Entry 14 is `s14` `web.dom.click` "Add to cart" again,
  this time `failed` with `output_not_observed` / `core.result.does_not_answer_request`, stage `verification`.
  That is the synthetic refuted attempt, filed under `s14` because no step stored records (`extraction: null`, a
  playback-goal task). `harnessRecovery.resultRepair.nodeId` is `…main.s14`.
- The patch ladder was then handed `s14`:
  - step 0107 (diagnose, $0.004462) says "the 'Add to cart' click (s14) did execute";
  - step 0108 (repair) ended `llm.provider_output_invalid`.
- **C3 is also present.**
  - Step 0041 is `initial.core.run_node`, a navigate to `…/scenarios/bigbox-retail/`, in round 1, phase `repair`.
  - It became Flow step `s11`. The round-1 test lists it as `dryrun.1.13` (step 0078, `replay: "step"`): the seed's
    highest id was d12, so it became d13.
  - Here the model built on that page: `s12` presses the napkin link on the home page. So with `add: false` the
    navigate would have joined the Flow only through the opener rule (`R/flow-draft/opener.ts`), and only if a kept
    step stood on it.
- **The refutation itself was justified, and is not caused by C3 or C4.** The judge saw one "+" press where two packs
  were wanted, and the 100-count napkin link followed by a 250-count selection. Those are model authoring errors.
- **A side observation, not root-caused.** The failure's `expected` text includes Core's fix line "Add or fix the step
  that stores what the Flow read: no record set exists". That line is wrong for a cart (playback-goal) task. It looks
  like the repair-directive finding is emitted for a task that stores nothing by design. I did not trace it to a
  file:line; it is outside this brief.

## Commands run and observed results

- `npx vitest run src/programs/automation-studio/runtime/recovery/refuted-result src/programs/automation-studio/runtime/tests/refuted-result src/programs/automation-studio/runtime/llm/evidence-loop src/programs/automation-studio/runtime/llm/tests src/programs/automation-studio/runtime/result-verification`
  (in `packages/fluxiq`) printed `Test Files 79 passed (79)` and `Tests 775 passed (775)`, exit 0.
- `bash heavy.sh "t195-w32 tsc" npx tsc --noEmit -p .` (in `packages/fluxiq`):
  - The first run, exit 2, found two typing errors in my new tests: TS2493 (the `vi.fn` tuple) and TS18048
    (`actionAttempts` possibly undefined). I fixed both.
  - The final run gave exit 0 with no output.
- C3 regression check: with `add: true` restored by `sed`, `resume.test.ts` printed `Tests 1 failed | 12 passed`.
  With the fix restored, it printed `13 passed`.
- `node scripts/structure-audit.mjs` (Core root):
  - The first run failed with `[directory-files] …/llm/evidence-loop/tests/: 26 source files exceeds the 25-file limit`.
    I moved the test, as described above.
  - The final run printed `structure-audit: passed (217 warning(s), 349 baselined)`, exit 0.
- `bash heavy.sh "t195-w32 test-runner build" pnpm --filter @fluxiq-web-extension/test-runner build` exited 0.
- `node --test dist/flow-lane/tests/persisted-flow-run.test.js dist/flow-lane/tests/node-recovery.test.js` printed
  `tests 34, pass 34, fail 0`. The output includes `ok 7 - a refuted result's attempt is the result's verification,
  not a failed action of the step Core filed it under`.
- `bash heavy.sh "t195-w32 test-runner check" pnpm --filter @fluxiq-web-extension/test-runner check` exited 0.
- `node scripts/structure-audit.mjs` (downstream root) printed `structure-audit: passed (155 warning(s), 118 baselined)`,
  exit 0.

## Not verified

- No Lab run, no browser and no model calls, as the brief ruled.
- The routing to the re-author only is not wired, so it is not verified (Open questions 1).
- Until it is wired, a refutation that names no step still reaches the patch ladder whenever the re-author builds
  nothing. The failed attempt the ladder gets is now on `result-verification`, not on a real step. I did not exercise
  how `R/recovery/annotation/annotate.ts` and `patches.ts` handle a node id that is not in the graph. I read the paths
  (`annotate.ts:297`, `:382`, `patches.ts:283`) and found no throw on that path, but the ladder will still spend a
  diagnosis call.
- No full suites were run.
- I did not compare the Lab's `run.json` and `evaluation.json` for a re-read run. Only the in-memory
  `PersistedFlowRunOutcome` is tested.

## Open questions or contradictions found

1. **"Routes to the re-author only" needs a change in `R/service/runtime-adaptation/refuted-result-port.ts`, which I
   do not own.** The port reaches the ladder in two places:
   - `degradeToPatchLadder` (`:97-99`), when the re-author built nothing;
   - the `!decision.route` branch (`:79-81`).

   The suggested change is to skip both when
   `!automationStudioRefutedResultAttemptNamesNode(refuted.failedTraceAttempt)` and record the reason. Something like
   `automationStudioRefutedResultDegraded(..., { to: "patch_ladder", afterCode, bound: … })` with a new code, or simply
   return `repaired`. Run 38 and bigbox each spent a diagnosis call plus a patch call on a step with nothing wrong.
2. **The brief lists "wrong rows" among the refutations that name no step.** I kept naming the record producer when
   one stored records. `repair.ts:135` takes the history entry's step from the attempt's node, and that is the re-author
   brief's only "the rows came out of step X, authored with parameters …" line. Dropping the node there would lose it.
   To name no node for wrong rows as well, `repair.ts` would need to find the producing step on its own; that file is
   outside my ownership.
3. **C3 with `add: false` still runs the opening navigation.** The debug also offered a second option: run no opening
   at all on a resumed round, because "The page is where the test left it: look first" (`resume.ts` instruction).
   - With `add: false`, the round still moves the page to the start.
   - The opener rule (`R/flow-draft/opener.ts`) can pull that `taken` navigate back into the Flow when a step added
     right after it stands on its page, as bigbox's `s12` did.
   - I followed the brief. Whether a resumed round should skip the opening entirely is the supervisor's call. It
     touches the same lines.
