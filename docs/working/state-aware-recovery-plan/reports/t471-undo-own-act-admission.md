# t471: undo admission, honest endings, and a reset that cannot judge a dirty site clean

Worker report. Two rounds: the brief (lane B round 9) and the supervisor's addendum (lane D round 9). Nothing committed.

## Outcome

Done for the Core and domain work, both rounds. Two items in the addendum are only partly met:

- **Already-done skips in the executor.** These were not changed. The model is told to write the Flow so it passes over an item that is already done, and the judge is told what the trial started with. Nothing in the executor itself skips an item that is already done.
- **Live behaviour.** No live run was made (the brief says no Lab paid run).

## Round 1 (brief): lane B round 9, `run-mv5q4j33-d04ac463`

### Why the act-3 "undo" was refused: the premise does not hold

The step logs show the undo of act-3 *was* admitted. The refusal at 0052 was on a different item, one the cart held before the build began.

- The cart held 1 item from the start: the dish soap, $3.97. Steps 0002 to 0024 all show `🛒 1 $3.97`.
- The build added towels (act-2, at 0020) and napkins (act-3, at 0038), so the cart went to 3.
- 0046: `undoes: act-2` was a **navigation** to the cart, declaring `[]`. Under t462 it "landed", so act-2 was marked undone and its one unasked delete was spent.
- 0048: `undoes: act-3`, Remove on the napkins line (t2139), declaring `delete`. It was **admitted** and succeeded; the cart went to 2.
- 0050: `undoes: act-2`, Remove on the towels line (t2127), declaring `[]`. It succeeded and the cart went to 1, which is the start.
- 0052: `undoes: act-3`, Remove on t2264. **This is the dish soap**, which was there before the build began (0050's page shows `Cart (1 item)` and t2264 is the soap's Remove button). The model's summary at 0051 shows it misread the "Frequently bought together" napkins as still in the cart.
  - The ledger accepted the re-claim as "a second try at the same undo" with `allowed: []`.
  - The gate rightly asked. The Lab declined, which gave `consequences_declined`.
- 0054, 0056 and 0058: the same call three times, each refused as a repeat. The build then ended.

So there were two real defects, and neither was "the undo was not admitted":

1. **A navigation under `undoes` spent the act's allowance.** That is the B-shaped failure the brief describes. Had 0050 declared `delete`, the towels removal would have been asked about.
2. **A claim on an act that was already undone reached the gate and the person.** The model was never told the act was done, so it kept going.

### The "bare GenerationError" ending: also not as reported

- The ending did carry a code: `flow_bootstrap.evidence_repeat_without_progress`, with `issueCodes [..., llm_evidence_loop.repeat_refused]`.
- It also carried a plain sentence: "The build failed: it kept trying without getting any further, so it was stopped." (`snapshots/flow-lane.json`).
- `code=-` came only from the build-trace line. `automationStudioLlmBuildTrace.timed` read `error.code`, but `AutomationStudioFlowBootstrapGenerationError` keeps its code in `diagnostic.code`.
- The same `code=-` appears in lane D's core.log:238.

### What changed (round 1)

- `site-reset/ledger.ts`, `words.ts`: the once-per-act unasked delete is spent only by a landed undo of that act that declared `delete`. A claim on a spent act is refused before anything runs, as `candidate.undo_already_done`, naming the call that spent it (`undoneBy`).
- `llm/repeat-guard/permission-refused.ts` (new), `feedback.ts`, `candidate-feedback.ts`: a repeat whose first attempt was refused by the permission gate (a `resultCode` ending in `permission_required`) is now told the real cause: "it needs a person's permission that it does not have … Sending it again cannot get past that … Do not make this call again", plus what to do instead. This applies in both candidate and legacy mode.
- `llm/evidence-progress/build-trace.ts`: a throw's code falls back to `diagnostic.code`, so the trace now prints `code=flow_bootstrap.evidence_repeat_without_progress`.

## Round 2 (addendum): lane D round 9, `run-mv5q4j2n-25784472`

Lane D's debug report gives the causes: the start check compared only the start page, an `undoes` call marked its act undone on landing alone, and confirms that cannot be reversed trapped the model. What changed:

- **(a) An undo counts only when the act's effect is gone.**
  - Calls that carry `undoes` no longer mark an act undone. They only count as attempts and spend the allowance.
  - New `site-reset/act-places.ts`: the candidate loop reads the target in place (`startState`, passive) just before and just after each exploration call that declares `create_new`, `modify_existing` or `delete`. The act keeps its page's state, its `location`, and what it changed (`placed`).
  - For calls with `undoes`, the ledger is told whether the undo changed the page it ran on without leaving it (`undoSeen`). A click on static words gives false; a link that leaves the page gives false.
- **(b) Each act is checked on its own page.**
  - New `AutomationStudioSiteResetStartCheck.read` and `compareAt`. `compareAt` navigates through `runsNodes.arrival`'s node, with the act's `location`, then diffs against the state from before the act.
  - In `ledger.beforeTrial`, an act is undone once nothing it changed is still there (`stillThere` is shown to the model).
  - The B-shaped test exposed a shared-line problem: two adds both change one basket-total line. To handle it, the domain now also returns the differences as structured `lines: {gone, added}`, and Core compares these only for equality.
    - A line an act removed is excused when another act of the build added it.
    - Without `lines`, Core falls back to the worded `differs`.
  - Fallbacks:
    - An act with no place (a trial's act, or a page that could not be read) is undone only when a landed undo of it changed the page in place.
    - With no reader at all, the t462 rule holds: a landed undo counts.
  - `trial-policy.ts` no longer marks every act undone because the start page is clean.
- **(c) Acts the site cannot undo.**
  - An act becomes **kept** in three cases:
    - the reset made no progress on it (the existing no-deadlock admission);
    - it was asked for twice;
    - the model named it under the new `core.test_candidate` input `cannotUndo` after a reset had listed it.
  - A kept act is never asked for again. Naming it gives `candidate.undo_act_kept`.
  - Every later trial runs with it in place, under `startedWith.cannotUndo`, with generic words that tell the model to make the Flow pass over items already done.
  - The judge is told: the trial request gets `startedWith` lines from the new `candidate/started-with.ts`, with one line per act including its id. `run.ts` and `summary.ts` put these into `resultSummary.startedWith`.
  - The verification instruction (`llm/diagnosis-instructions.ts`) gets one sentence saying these are already done, neither the run's doing nor its failure.
  - The two `loop_verification` system-prompt pins were re-pinned by inserting exactly that sentence. That is a 2-line diff, allowed by the pin test's header because Core's own prose changed.
  - The no-deadlock rule is kept.
- **Domain (cross-repo contract).** `start-state/observe.ts` now answers `location` and `lines`. The new `start-state/changed-lines.ts` holds the multiset logic, and `differences.ts` now uses it. The type in `tools.ts` was updated. Core's `binding.ts` documents both optional fields.
- **Docs.** Core `docs/architecture/automation-studio/llm-flow-bootstrap.md` and extension `docs/architecture/page-evidence.md` were updated.

### Tests added (beyond the updates to existing ones)

- `site-reset/tests/ledger.test.ts` (19 tests), including:
  - the lane-D sequence (three confirms, a click on words, no undo exists: the trial runs with them, and later trials show `cannotUndo`);
  - the lane-B sequence (two adds sharing one total line, a go under act-1, both removed with `delete`, a partial state still asking for act-1, and the earlier line refused unrun);
  - kept after two asks; `cannotUndo` honoured only after a listing; no-reader legacy.
- `site-reset/tests/act-places.test.ts` (5), `start-check.test.ts` (+3) and `trial-policy.test.ts` (13).
- `flow-bootstrap/tests/site-reset-irreversible.test.ts` (3): the D shape through the real wrapper, ledger and loop on a two-page stand-in. The start page is clean while the confirms remain. It covers `stillThere`, the stall admission, the judge's `startedWith`, `cannotUndo`, and refusal of a kept act.
- `flow-bootstrap/tests/site-reset-build.test.ts` (+1): the B shape through the real wrapper and gate. A go under act-1, two removals declaring `delete` that run unasked, a re-claim refused unrun, and a pre-existing removal still asked.
- `candidate/tests/trial-gate-reset.test.ts` (+3), `candidate/tests/started-with.test.ts` (3), and `candidate-trial/tests/run.test.ts` (+2). The second shows `startedWith` reaching the real judge's provider request past the harness checks.
- `repeat-guard/tests/permission-refused.test.ts` (2) and the feedback tests (+2), `build-trace.test.ts` (+2), and `diagnosis-channel.test.ts` (+1).
- The domain `start-state.test.ts` (+2).
- The B-shaped composed test was checked against the old ledger: it fails at the removal after the go (`expected { ok: false … } to match { ok: true, lines: 0 }`) and passes with the fix.

## Commands run and observed results

All Core commands were run from `fxwork/t471/!FluxIQ` (vitest and tsc inside `packages/fluxiq`). The domain commands were run from `fxwork/t471/!FluxIQWebExtension`.

- `npx vitest run …/flow-bootstrap …/action-permissions …/llm …/service/candidate-trial …/service/candidate-failure …/service/flow-bootstrap-commands …/result-verification`
  - Gave `Test Files 1 failed | 409 passed`, `Tests 4 failed | 4579 passed | 2 skipped`.
  - The 4 failures were the `system-prompt-pins` byte pins. After re-pinning, `npx vitest run …/llm/deepseek` gave `Tests 123 passed (123)`.
  - A final re-run of `…/flow-bootstrap …/service/candidate-trial …/llm` gave `Test Files 327 passed | 1 skipped`, `Tests 3855 passed | 2 skipped`.
- `npx tsc --noEmit -p .` (in `packages/fluxiq`) gave `exit=0`, with 0 `error TS`.
  - `npm run check` once printed `"reuse" … inputs and outputs match the stamp` after source edits, so I used tsc directly.
- `node scripts/structure-audit.mjs` (Core) gave `structure-audit: passed (334 warning(s), 1159 baselined)`.
  - An earlier run failed on `failure-as-empty` (start-check `read` returned `undefined` from a catch) and on statement-packing in tests. Both were fixed: `read` now answers `{ unread: "no_reader" | "no_answer" | "failed" }`.
  - It also says "2 baseline entries can be lowered"; I did not run `structure:baseline`.
- `pnpm --filter @fluxiq/contracts --filter fluxiq --filter @fluxiq/client-gateway-websocket build` (Core) gave `exit=0`.
- `DOMAIN_TEST_BUILD_LABEL=t471 npm test -- start-state` (domain) gave `# tests 9 # pass 9 # fail 0`.
- `npm run check` (domain) gave `exit=0`, with a real build (`"build-cache":"build"`, 20329 ms).
- `node scripts/structure-audit.mjs` (extension) gave `structure-audit: passed (186 warning(s), 646 baselined)`. `--rule docs-links` passed in both repos.

## Not verified

- **No live or Lab run.** These were not exercised in a real browser:
  - the extra in-place captures around each lasting act;
  - navigating to an act's `location` (the domain's navigation scope policy, and whether a screened `evidence.location` navigates back to the same state);
  - the timing cost.
- **Aggregate state that only shows on other pages.** Suppose an act's own page changes only through a total that a *still-present* act also changed. For example, act-1 is removed but act-2 is not: act-2's page then shows a new total, and act-2's added line is gone. The per-act check can then read act-2 as undone. A start page that shows the total still catches this (`trial_start_differs`, once). Otherwise the trial runs with the act in place, and `startedWith` does not name it.
- **Executor already-done skipping.** Not touched. A trial step that fails on a row the build already did (lane D's `web.target.not_found` on an accepted row) still fails. Only the words and the judge changed.
- **Changes outside the brief's listed ownership:** the `candidate/` files (trial gate, contracts, authoring loop, `started-with.ts`), `service/candidate-trial/{run,summary}.ts`, `result-verification/contracts.ts`, `llm/diagnosis-instructions.ts` and its prompt pins, `llm/harness-options/binding.ts`, and the domain start-state files. The addendum's judge and contract requirements needed them.
- **Full suites.** Not run, per AGENTS.md.

## Open questions or contradictions found

1. **The brief's premise did not match the evidence.**
   - The act-3 undo was admitted at 0048. The refused call at 0052 was on the line that was there before the build began, under a misattributed `undoes`, and the gate was right to refuse it.
   - The ending did have a named code and a plain reason; only the trace line said `code=-`.
2. **The permission ask at 0052 was put to the person** (`asks.permission: 1`) for a removal the model had misattributed. With the fix, a claim on a spent act is refused before any ask. A removal of a pre-existing item *without* `undoes` is still asked, which is correct.
3. **The ending sentence.** "It kept trying without getting any further" does not say *why* (a permission refusal). Carrying the repeated call's cause into the stall's `issueCodes` and wording it in `conversations/commands/progress.ts` would be a small follow-up outside this brief.
4. **Kept acts.** When the reset makes no progress, the trial now runs with the acts in place, and those acts stay kept for the rest of the build. A model that truly could undo an act, but needed two rounds without visible progress, loses the reset for that act. The judge is told, so the cost is honesty about the start rather than a false pass.
