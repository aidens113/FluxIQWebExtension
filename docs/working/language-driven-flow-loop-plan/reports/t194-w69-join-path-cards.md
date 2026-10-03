# t194-w69: no "Join paths" cards, and a "Step N of M" that leaves merges out (UI-3)

## Outcome

Done. While a Flow runs, Core no longer emits a step card for a `builtin.control.merge` node. "Step N of M" now counts only the nodes a person sees, in both N and M. The screenshot's Flow (five acts and two merges) would read "Step 5 of 5" over five cards, not "Step 7 of 7".

## What changed and why

- Core `R/executor/graph-run.ts`:
  - A module-local predicate, `shownAsStep(node)`, is false only for `builtin.control.merge`. Branches, checks, start, end and every other node stay shown, as the brief asks.
  - In `runGraphFromSeed`:
    - `shownStepCount = flow.nodes.filter(shownAsStep).length` replaces `flow.nodes.length` as `count`.
    - A `hiddenSteps` counter rises each time a merge is reached. A merge gets no `emitAutomationStudioActivityStep` call, and every other node is sent `index: step + 1 - hiddenSteps`.
  - Resume:
    - For a resumed run, `hiddenSteps` starts at the number of merge attempts in `seed.attempts`, so the merges passed before the park stay out of N.
    - It also starts at 1 more than that. The resumed first pass only leaves the parked node, and that node is already counted in `stepsTaken`.
    - This fixes a pre-existing off-by-one: before this change, the step after a resume was numbered one too high (a 5-node Flow showed "step 6" after a park, with no merges involved).
  - The step budget (`step`, `maxSteps`, `stepsTaken`) is unchanged. Only the displayed numbers changed.
- Core `R/activity/step.ts`: the doc comment changed so that `count` says "steps a person sees (every node but a merge)". There is no code change.
- Core new test `R/executor/tests/step-count-activity.test.ts`:
  - Five acts with two merges give five step events, numbered 1 to 5 of 5.
  - A run that parks after a merge, then resumes past another merge, numbers its steps 1, 2 and 3 of 3.
- Downstream `apps/extension/src/panel/chat/tests/live-run-display.test.ts`:
  - The `failedRun()` fixture now sends what Core sends: no merge step event, and `count: 2` across the two presses.
  - U-A2 now asserts no "Join paths" card, no bare "Action" card, and exactly two cards for the two counted steps.
  - U-A1 still passes on the same fixture.

### What reads index/count

- **Core.** The only producer is `graph-run.ts` → `emitAutomationStudioActivityStep` (`R/activity/step.ts`), which sets `ClientGatewayActivity.step` and the "Running step N of M" label. Nothing else in Core reads `step.index` or `step.count`; I grepped `packages/fluxiq/src`. There is no Core run-detail consumer.
- **Extension.** These only print or pass through what Core sends, so they are consistent with no change:
  - `background/activity/pacer.ts:155-173`: normalizes the step and compares it for pacing.
  - `content/activity-overlay/content-message.ts:65` and `overlay-view.ts:70-73`: the overlay's "Step N of M".
  - `panel/chat/view/step-text.ts:10-12`: the panel's "Step N of M".
  - `panel/chat/stream/step/words.ts:76`
  - `shared/activity/wording.ts:221-222`
- **Lab run detail.** `packages/test-runner/src/lab-runs/lab-run-record.ts` counts its own `steps/` directories and does not read `step.index`/`count`.

## Commands run and observed results

- Failing first: `npx vitest run src/programs/automation-studio/runtime/executor/tests/step-count-activity.test.ts` (packages/fluxiq), before the fix.
  - `expected [ [ 'a', 1, 7, …(1) ], …(6) ] to deeply equal [ [ 'a', 1, 5, …(1) ], …(4) ]`
  - `expected [ [ 'a', 1, 5 ], [ 'm1', 2, 5 ], …(3) ] to deeply equal [ [ 'a', 1, 3 ], …(2) ]`
  - `Tests 2 failed (2)`
  - The test's edges first used port "next" for merges and the run failed. Merges route on "success", and I fixed the test.
- After the merge fix only, the resume test still failed with `read` at index 4 rather than 3. That was the resumed-pass off-by-one, which the change then fixed.
- `npx vitest run src/programs/automation-studio/runtime/executor src/programs/automation-studio/runtime/activity`: `Test Files 47 passed (47)`, `Tests 535 passed (535)`.
- `bash heavy.sh "t194-w69 pnpm check fluxiq" pnpm check` (packages/fluxiq): the build-cache line `"step":"fluxiq:check","reason":"inputs changed..."` with no tsc errors printed.
- `node scripts/structure-audit.mjs` (Core root): `structure-audit: passed (222 warning(s), 349 baselined).`
- `bash heavy.sh "t194-w69 narrow panel/chat" node .../narrow-tests.mjs <ext>/apps/extension t194-w69 panel/chat`: `ok 192 - U-A1 ...`, `ok 193 - U-A2: a run shows a card for each step a person sees, and none for joining paths`, `# tests 225 # pass 225 # fail 0`.

## Not verified

- A live run showing the panel and overlay with the new count.
- I did not run the new downstream U-A2 against the old fixture to show it failing first. With a merge event, the extension renders a "Join paths" card, which U-A2 now asserts is absent.
- The extension still renders a merge step event as "Join paths" if an older Core sends one; I kept that path unchanged.

## Open questions or contradictions found

- Start and end nodes (`builtin.control.start` / `builtin.control.end`) are still counted and still emit step cards. The brief limits hiding to merges. If a Flow has them, the count still includes them; the supervisor may want the same treatment for them.
- The resume off-by-one fix is a behaviour change beyond merges, though it is inside the same counter.
