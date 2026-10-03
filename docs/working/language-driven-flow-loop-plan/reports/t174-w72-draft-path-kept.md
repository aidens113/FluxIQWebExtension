# t174-w72-draft-path-kept (F41) — worker report

Status: **Ready to commit** (Core tree `fxwork/t174/!FluxIQ`), files listed below. One wiring line in
`R/llm/node-tools/dry-run-gate.ts` (not mine) is needed before (c) reaches the model; see Open questions.

## Outcome

Done for (a), (b) and (c) within the files I own. (c) is implemented and tested in `dry-run.ts` behind a new optional
`steps` argument. The only caller, `R/llm/node-tools/dry-run-gate.ts` (Must not touch: `R/llm/**`), does not pass it yet,
so `notInFlow` will not show in a live refusal until the supervisor adds that argument.

## (a) Why the rule kept 6 and 3 and not 5 and 4

The run's own draft entries settle it (`lab-runs/2026-10-01/run-muqk4u32-0b36e58f/steps/*-decide/request.txt`,
`disposition` per position):

| Request | 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8 |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| 0015 (after the Space Grey press, before 7-in-1) | kept | did_not_work | taken | taken | taken | taken | taken | — |
| 0017 (after 7-in-1 ran with `add`) | kept | did_not_work | taken | taken | taken | **kept** | **kept** | kept |
| 0028 (dry run 1 follows) | kept | did_not_work | taken | taken | taken | kept | kept | kept |
| 0055 (after 0054 `keep` 4 and 5) | kept | did_not_work | **kept** | kept | kept | kept | kept | kept |

- 0015's 7-in-1 call carried `add`, so `evidence-loop.ts:217` called `automationStudioFlowDraftKeepOpeners(draft, step 8)`.
  The opener of 8 was the newest page-changing step, 7 (Space Grey, `pageChanged`), and the opener of 7 was 6 (Reject
  non-essential). `MAX_OPENERS = 2` then stopped the walk: 5 (listing) and 4 (search) were never reached. Step 7 was
  therefore already `kept` before the 0019 `add` that named it `a1.colour`.
- Step 3 (the ×) was not kept "without an add" before the dry runs: 0028 shows it `taken`. It became `kept` at 0054,
  when the model's `keep` of step 4 ran the opener rule from 4 (`amendment.ts:278`) and found 3. That one was correct.
- The digests were not the cause. They come from the call's own captures (`stateDigests.before/after`, read in
  `evidence-loop.ts` `statesOf`; downstream `domain/src/runtime/llm-evidence/capture.ts:363`, the packet read before
  and the packet left after). A type that submits leaves the results page, and a press that opens a new tab leaves the
  new tab's page (the active tab follows it, F20); both are recorded as changes, and 4 and 5 would have qualified if
  the walk had got to them. Nothing for t243's `D/state-digest/**`.
- Reproduced as the unit row "run muqk4u32: adding 7-in-1 brings every step back to the arrival ..." in
  `flow-draft/tests/opener.test.ts`. At HEAD it answered `[7, 6]`, which is the run exactly.

## What changed and why

All paths are under `packages/fluxiq/src/programs/automation-studio/runtime/flow-draft/` in the Core tree, unless named.

- `path-to-step.ts` (new): `automationStudioFlowDraftPathToStep(steps, step)` gives the taken steps that got the target
  to where `step` ran, oldest first. It walks back by iteration, newest first, until a step in the Flow
  (kept and proposable). On the way:
  - a non-proposable step (a look, or a call that did not work) is passed over, even when its digests differ;
  - a step with no change or no states is passed over;
  - a `dropped` or `exploratory` changer ends the walk;
  - every other `taken` changer is on the way.

  Detours are then removed: a stretch that comes back to a moment already seen on the way is dropped. A moment is the
  pair {state a step left, state the next one found}, compared exactly. It starts from the last kept step's
  `stateAfter`. The old rule "back where the press started" is the one-step case of this.
- `opener.ts`: `MAX_OPENERS` and `openerOf` are removed. `automationStudioFlowDraftKeepOpeners` marks the whole path
  `kept` and returns it newest first, with the same signature and return order as before. The header now gives the F41
  failure.
- `dry-run.ts`: `automationStudioFlowDraftDryRunFeedback(verdict, told, steps?)` takes a new optional third argument.
  When it is given and the first `unreproducible` outcome's step (by position) has a non-empty path, the feedback
  carries `notInFlow`. Example: "Steps 3, 4 and 5 changed the page on the way to step 6 when you ran them, and are not
  in the Flow, so the test never reached the page step 6 acted on: add them (amend_draft add)." One step gets the
  singular form. The legend constant is unchanged.
- `tests/opener.test.ts`: the "no more than two presses back" row now expects the whole chain. New rows cover:
  - the muqk4u32 reproduction;
  - stopping at the last kept step;
  - a listing detour;
  - a stretch that returns to the kept step's state;
  - walking past a failed press whose digests drifted;
  - stopping at an `exploratory` step.
- `tests/dry-run.test.ts`: a new describe with 3 rows:
  - naming 3-5 for the muqk4u32 draft;
  - the singular form with a detour left out;
  - no `notInFlow` when everything on the way is kept, when the first non-replayed step failed rather than went
    unreached, or when no draft is passed.
- `docs/architecture/automation-studio/llm-flow-bootstrap.md` (Core): a new paragraph in the draft section, "A step
  added to the Flow brings the way to its page (t174/F41)".

Files: `R/flow-draft/path-to-step.ts` (new), `R/flow-draft/opener.ts`, `R/flow-draft/dry-run.ts`,
`R/flow-draft/tests/opener.test.ts`, `R/flow-draft/tests/dry-run.test.ts`,
`docs/architecture/automation-studio/llm-flow-bootstrap.md`.

## Commands run and observed results

All were run from the Core tree, and the heavy ones went through `build-slots/heavy.sh`.

- **Failing-first, with my new tests and HEAD sources:**
  `npx vitest run .../flow-draft/tests/opener.test.ts .../flow-draft/tests/dry-run.test.ts` gave
  `Tests 7 failed | 22 passed (29)`. The failures:
  - muqk4u32 `expected [7, 6] to deeply equal [7, 6, 5, 4, 3]`;
  - whole chain `[4, 3]` vs `[4, 3, 2, 1]`;
  - detour `[1, 4, 5, 6]` vs `[1, 2, 5, 6]`;
  - stretch `[4, 3]` vs `[4]`;
  - failed press `[]` vs `[2]`;
  - the two `notInFlow` rows `expected undefined`.
- **After the fix, the same command:** `Test Files 2 passed (2)`, `Tests 29 passed (29)`.
- `npx vitest run .../flow-draft/tests .../llm/node-tools/tests` gave `Test Files 20 passed (20)`,
  `Tests 185 passed (185)`.
- Extra, because the loop calls the opener: `npx vitest run .../llm/evidence-loop/tests .../llm/tests` gave
  `Test Files 50 passed (50)`, `Tests 533 passed (533)`.
- `pnpm --filter fluxiq check` printed `build-cache reuse ... inputs and outputs match the stamp`. Because it was served
  from the cache, I also ran `npx tsc --noEmit -p .` in `packages/fluxiq` directly, which exited 0 with no output.
- `node scripts/structure-audit.mjs` gave `structure-audit: passed (218 warning(s), 349 baselined)`. The only warning on
  my files is the pre-existing `[exported-values] flow-draft/dry-run.ts: 12 exported values`; I added no exports.
  `--rule docs-links` passed with 0 warnings.
- `node scripts/docs-reference.mjs --check` failed with `docs/reference/framework-reference.md is stale`. The reference
  records source line numbers: `automationStudioFlowDraftDryRunFeedback` at `dry-run.ts:314` and
  `automationStudioFlowDraftKeepOpeners` at `opener.ts:30`, and both of those lines moved. w73's edits in the same tree
  may move others. The file is generated and shared, so I did not regenerate it.

## Not verified

- No live run or provider call was made, per the hold. Whether the model, given `notInFlow`, adds the steps in one
  decision has not been tested live.
- `notInFlow` does not reach a live refusal yet, because of the caller wiring described below.
- `pnpm check` (the full suite) and Core's whole vitest run were not run.

## Open questions or contradictions found

1. **Wiring (c):** `R/llm/node-tools/dry-run-gate.ts` calls `automationStudioFlowDraftDryRunFeedback(again, asked)` at
   line 153 and `(replay.verdict, asked)` at line 200. Both need `input.steps` as a third argument. That is a one-line
   change each, in `R/llm/**`, which I may not touch.
2. **Regenerate the reference:** run `pnpm docs:reference` once after integrating w72 and w73.
3. **Residual risk, not new but now unbounded.** The walk follows iteration order and cannot see a dry run's reset or a
   rerun's "back to its place". A step taken after a refused dry run (run muqk4u32's 0041 press on `t1005`) would join
   the Flow if the model later added a step after it. The old rule had the same exposure for one or two steps. No step
   record carries the reset, so a fix needs the loop (`R/llm`) to mark draft steps taken after a reset.
4. A small correction to the brief: step 3 became `kept` only at 0054, correctly, as the opener of the model's `keep`
   of 4. Before the dry runs, only 6 (and 7) had been kept without an add.
