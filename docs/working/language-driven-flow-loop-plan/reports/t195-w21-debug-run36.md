# t195-w21: full debug of live run 36 (`run-muq3uozx-3153564b`, confirm-requests)

## Outcome

Done. The debug is `docs/working/language-driven-flow-loop-plan/debugs/run-muq3uozx-3153564b.md`. It fills every
template field from the artifacts, has one row per model turn (E1-E51, R1-R10), answers the brief's six questions
with file:line on the t195 trees, and has 14 causes and 6 instrumentation gaps.

**Root cause of the 24 identical refusals.**
- At E11 the model sent `10 add act a1`. Step 10 was a withdrawn listing rerun. Core accepted the act on that read
  and put it back in the Flow (`R/flow-draft/amendment.ts:194-197,217,229`).
- A rerun placed before it moved it to position 11. Every later rerun carried the act onward
  (`R/llm/evidence-loop/rerun-replacement.ts:47-50,59-61`).
- The completion check takes only the first draft step naming an act, in draft order, and ignores both the other
  naming steps and the model's own result claims (`R/flow-bootstrap/instructed-acts/check.ts:155-157,271-273,327-335`).
  So every completion was judged on the listing: `step_changed_nothing`, step 11, then step 6 in the repair.
- The acts checklist tries every naming step (`checklist.ts:104-111`) and showed `a1 done 16/17` at E20, E23 and E25,
  which were refused all the same.
- The model could not see the act on step 11, because the draft entry omits `acts` (`R/flow-draft/entry.ts:81-111`).
- Reproduced provider-free: the check refuses while the checklist says done, and removing the act from the listing
  makes the check pass.

## What changed and why

- New file `docs/working/language-driven-flow-loop-plan/debugs/run-muq3uozx-3153564b.md`: the debug the brief asked
  for. Stage 1 is copied from the lane report, with the verbatim instruction, which was checked against the recorded
  sha256.
- This report.
- No source file was touched. Scratch scripts are in the session scratchpad `w21/`: `turns.js`, `delta.js`, `rows.js`,
  `repro.mts`, `repro2.mts`.

## Causes and fix specs (partitioned by file; full table in the debug)

1. **check.ts judges only the first naming step.**
   - Fix in `R/flow-bootstrap/instructed-acts/check.ts`: per act, try every kept naming step (draft claims, then
     result claims, in draft order) and accept the first fault-free unused one.
   - Report a fault only when none passes, naming the first mutating candidate.
   - Share the loop with `checklist.ts`.
   - Test (`instructed-acts/tests/check.test.ts`): listing (observe, `acts: [a1]`) plus Confirm (mutate, `acts: [a1]`,
     repeat over the listing) with this run's instruction gives `ok: true`. Add a property test: checklist `done` iff
     check `ok`.
2. **An act can be named on a read.**
   - `R/flow-draft/amendment.ts`: refuse `act` on an `effect !== "mutate"` step with `act_on_a_read`.
   - `R/llm/evidence-loop.ts:208-210`: do not record `acts` on a non-mutating tool-call step.
   - `R/llm/evidence-loop/rerun-replacement.ts:47-50`: carry `acts` only onto a mutating rerun.
   - Tests in `flow-draft/tests/amendment.test.ts` and `llm/evidence-loop/tests/rerun-replacement.test.ts`.
3. **`keep` deletes a `repeat`** (E21, E26).
   - `R/flow-draft/amendment.ts:216`: clear only optional, only_if and on_failed, never repeat, and nothing when `act`
     is given.
   - Test in `amendment.test.ts`.
4. **Acts per step are invisible, and the refusal names steps by ids the model never sees.**
   - `R/flow-draft/entry.ts` `stepLine`: add `act`.
   - `check.ts:227`: list positions, not ids.
   - Tests in `entry.test.ts` and `check.test.ts`.
5. **The refusal advises naming an act that is already named; the amendment refuses it as "nothing to confirm".**
   - `amendment.ts:217,220-224`: new reason `act_already_named`.
   - `check.ts:96-100`: when `missing.step` is a read, say "step S is named for this act and only reads: drop it or
     rerun it without act".
   - Test in `amendment.test.ts`.
6. **Reruns reset the no-progress guard.**
   - `R/flow-draft/step.ts`: add `replaces?`.
   - `rerun-replacement.ts`: stamp the lineage.
   - `R/llm/evidence-progress/authored-progress.ts:36-42`: a replaced lineage is not new.
   - `R/llm/evidence-loop.ts:728`: a repeated answer is no progress even when added.
   - Tests in `authored-progress.test.ts` and a stub-host loop test.
7. **The stall note ordered a new lasting act** (E36, Tom Becker confirmed).
   - `R/llm/evidence-progress/stall-redirect.ts:144-148`: say "run it" only for `no_step_added`; otherwise give the
     checklist's reason and step, plus "never press it on an item your listing left out".
   - Test in `stall-redirect.test.ts`.
8. **Repeated single presses for a plural act** (Priya at E16, Jonas at E17, Tom at E36).
   - `R/flow-draft/entry.ts:46`: add the "never act on the others" rule.
   - `R/llm/evidence-loop.ts` tool-call path: refuse, unrun, a press with the act id of a plural act that already has
     a kept mutating step (`act_already_has_its_press`).
   - Stub-host loop test.
9. **"See all" was not detected as the list's continuation.**
   - Extension `content/extraction/pagination.ts`: report a see-all link in the list's section. This is proposed and
     was not traced line by line.
   - jsdom test from the Friends home markup.
10. **The budget counts decisions at the worst case, so wrap-up withheld tools with $0.09 (exploration) and $0.05
    (repair) left.**
    - `R/llm/loop-budget.ts:122-123`: count `1 + floor((costLeft - worstCase)/average)`, as the tokens bound does at
      `:115-117`.
    - Test in `llm/tests/loop-budget.test.ts`.
11. **A regex `where` dropped Jonas Weber, and the rejected-row note did not turn the model.**
    - Domain `node-run/rejected-rows.ts:49`: add "this column reads as numbers (Jonas Weber: 5); use atLeast".
    - Test in `node-run/tests/rejected-rows.test.ts`.
12. **Suspect: the draft test answered `verified` for four Confirms whose controls were gone.**
    - Domain `node-run/verify.ts`: first record what each check resolved to (gap G3).
    - Test: an accepted card answers `present`.
13. **The ending misleads the person**: "changed nothing", "ran ... without failing", "created the Flow", and no
    mention of the four confirmations, two of them wrong.
    - `R/flow-bootstrap/unfinished-build/not-done.ts:19,79`.
    - `R/flow-bootstrap/generation-failure/build-ending.ts`: list the lasting steps that ran.
14. **UI wording.** These belong to t191/t227.
    - The completion check is shown as "Test run" with no detail: `packages/fluxiq/src/ui/activity-action/action-of.ts:95`
      and `names.ts:14`, `R/activity/wording/completion-refusal.ts`.
    - Click cards say "the page": extension `panel/chat/stream/step/card-words.ts:37`.
    - The duplicated failure message and the stale field highlight were not traced.

## Commands run and observed results

- Turn tables from the dumps, run with node over each JSONL:
  - command: `node turns.js`, `node delta.js` and `node rows.js` over the exploration and repair dumps;
  - exploration dump: 314 lines, `{tool: 29, entry: 217, decision: 51, check: 17}`;
  - repair dump: 55 lines, `{tool: 2, entry: 36, decision: 10, check: 7}`;
  - every check: `bootstrap.instructed_act_missing`, a1 `step_changed_nothing`, step "11" (exploration) or "6" (repair).
- Usage totals (node over the dumps):
  - exploration: 51 calls, 1,540,005 input, 944,768 cache hits (61.3%), 7,274 output, $0.1930;
  - repair: 10 calls, 198,090 input, 128,512 hits (64.9%), 871 output, $0.0227;
  - E20-E51: 32 calls, $0.1286.
- `node --experimental-transform-types --no-warnings repro.mts` (imports Core's `check.ts` and `checklist.ts`):
  - `checklist [{..."done":2}]`;
  - `check {"acts":[{..."reason":"step_changed_nothing","step":"1"}],"stepsThatChangedSomething":["d15"]}`;
  - `check without listing act true`.
- `node --experimental-transform-types --no-warnings repro2.mts`:
  - `add act a1 on a read: {"applied":1,"refused":[]} acts now ["a1"] kept`;
  - `keep act a1 on the repeated press: {"applied":1,"refused":[]} routing now undefined`;
  - `after rerun of the read: [[1,"d11","kept",["a1"]],[2,"d10","dropped",null],[3,"d15","kept",["a1"]]]`.
- Instruction check: `node` sha256 of the instruction text from the screenshot gives 339 characters and `6c11d20a...`,
  matching `flow-lane.json`.
- Read: `core.log` (build trace), `events.ndjson`, `summary.json`, `run.json`, `evaluation.json`, the snapshots, the
  Lab log (spend ledger line 85: `totalEstimatedCostUsd 0`), and screenshots 00002-00005, 00007, 00008, 00010, 00012,
  00016, 00019, 00022.

## Not verified

- Cause 9's exact location in the extension's detection code, and whether a see-all link sits inside the detected
  section in the DOM. Only the page view was read.
- Cause 12, the `verified` answers: the element each check resolved to is not recorded (gap G3). The suspicion rests
  on R1's page read, made after the test.
- The worst-case per-call cost in cause 10 is inferred from `decisionsLeft` against `costLeftUsd`
  ($0.023-0.030), not read from the purse.
- The model's reason for pressing Priya Nair (E16). It is not in the dumps (gap G2) and scrolled out of every
  screenshot.
- The on-page overlay's words (U7): the chip is under the side panel in every capture.
- The duplicate failure message (U4) and the stale highlight (U6) were observed but not traced to code.
- No unit test was added or run in the repository; the repros are scratch only.

## Open questions or contradictions found

- `checklist.ts:14-17` promises that the checklist and the check share one rule. They do not: the checklist tries
  every naming step and the check takes the first (cause 1).
- The repair entry tells the model to "Work live on what is failing", while the budget had already put the repair in
  wrap-up with no tools (cause 10).
- The person's ending says "Before that I created the Flow ... and saved what it should do" for a build that created
  no usable Flow. A Flow record `flow.f0d61e7e-...` with no runs does exist in the project (`decision-trace.json`).
  Should a failed chat build leave that shell behind?
- The Lab's spend ledger recorded $0 for a $0.2157 chat build (gap G1,
  `packages/test-runner/src/flow-lane/creation/chat/build-from-chat.ts:165-170`). The live-run waste guards
  therefore undercount every failed chat build until this is fixed.
