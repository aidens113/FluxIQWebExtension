# R4b: why the repair's judged test cannot prove the cart act (run-mv4dgmki-2b13db91)

Investigation only. No source edited.

**Step numbering note.** The run finished at 22:10:55 and the step folders were renumbered then: the extension's
run rows 0036-0046 were merged in. The brief's judge steps 0098/0099 are now **0109/0110**. Every number below is
the final numbering in `~/FluxStuff/lab-runs/2026-10-11/run-mv4dgmki-2b13db91/steps/`. The Core log moved to the
bundle: `fxwork/t418/!FluxIQWebExtension/test-runs/instances/t418-proofs/run-mv4dgmki-2b13db91/logs/core.log`.

## Outcome

Root cause found. There are two defects, and fixing either one alone does not give an honest pass.

1. **The act landed once in this run, but on the wrong item.** The repair loop's first action, `rerun.7` (step
   0057, 22:08:05), pressed "Add to basket" live. "Added to cart!" appeared and the cart went from 0 to 1. The
   rerun's put-back only reloaded the item page. It did not redo steps 3-6, so the page still showed the default
   choices: Space Grey, **4-in-1, China, quantity 1**. The reason is that `step-place.ts` finds the steps to redo
   before a rerun through `replay.from`, and steps seeded from a Flow never have that field.
2. **The judge is never shown that landing.** Every later rerun of step 7 was turned into a check (`replay:
   verify`) because the act was done. The check overwrites the step's evidence with `effectApplied: false,
   resultCode: core.replay.verified`, and the earlier press survives only in `priorExecution`. The build test
   (D1) withholds step 7. Its `explored` field reads only the overwritten fields, so the judge sees `changed: no`
   and no evidence anywhere that the Flow's add-to-cart works.

The judge's `no` is correct. The cart holds the wrong line, and the rules forbid a second press in this session,
so no further repair round could pass honestly. The loop went on for two more rounds (`unknown` at 22:10:04 and
22:10:49) and then ended failed.

## (a) Why step 7 was withheld in the judged test

- **Had it already landed in this run?** Yes, once: step 0057 (`rerun.7`, `consequences: [create_new]`).
  - 0057 `result.json`: `control: "Add to basket"`, `changed: ["t1099 \"Added to cart!\" appeared", ...]`.
  - The same page shows `t950 "4-in-1" marked`, `t957 "China" marked` and `field "Quantity" ="1"`.
  - The cart was `0 Cart` at 0049 (22:07:58) and `1 Cart` from 0069 onward.
  - The failed live run never landed it: run rows 0043-0046 are four `web.target.not_found`, and the page did not
    change.
  - So 0057 was the first and only press in this run, and it added the wrong configuration.
- **Which rule withheld it, by phase:**
  - **Repair reruns** `rerun.7.2` (0076/0077) and `rerun.7.3` (0086/0087):
    - `llm/node-tools/rerun-check.ts:118` sends the rerun as a check because `automationStudioFlowDraftStepActDone`
      (`flow-draft/verify-only.ts:198-202`) is true: 0057 left `effectApplied: true` on a step whose mode is
      `verify`.
    - The check "took" (`rerun-check.ts:145-176`). It moved the 0057 record to `priorExecution` and set
      `step.effectApplied = false`, `checkedCandidate` and `resultCode = core.replay.verified` (lines 162-164).
  - **Judged build test** (`dryrun.1.*`, steps 0101-0108; step 7 is 0108, `replay: verify`):
    - This is decision D1, `automationStudioFlowDraftStepReplayMode` (`flow-draft/verify-only.ts:184-189`).
      `effect: mutate` with declared `consequences: [create_new]` returns `verify`.
    - D1 is unconditional: a dry run never performs a lasting step, whether or not it landed in this run
      (`flow-draft/dry-run.ts:83-89`).
    - Step 2 (the coupon, `consequences: []`) is withheld by the same function's `lastingActs` branch, because it
      claims act a2 ("collect").
  - **Not involved:** the executor's completed-act ledger (`executor/lifecycle-run/completed-act.ts`), `done when:`
    and `actLanded`.
    - These are runtime-executor rules.
    - `flow-draft/`, `llm/node-tools/` and `result-verification/` never consult them (grep finds no reference).

## (b) What the judge is given for step 7, and why it is not enough

From `steps/0109-judge/request.txt` (0110 is the same packet):

- `buildTest.steps[6]` contains:
  - `outcome: verified`, `withheld: true`, `observed: {code: core.replay.verified, said: "as step 2"}`
  - `explored: {changed: no, resultCode: core.replay.verified}`
- `startView` and `endView` both show `t884 link "1 Cart"`. The judge prompt says to credit an act only where the
  two views differ.
- The instruction (`llm/diagnosis-instructions.ts:162`, the build-test paragraph) says: "A withheld step ... judge
  it from explored (whether it changed anything when the build did it) ... what a withheld step's effect shows,
  in endView or elsewhere, is exploration's doing, not proof the Flow does it."
- The judge's own summary: "its explored result was 'changed: no' ... Step 7 ... was withheld in the test, so the
  cart fill is unverified."

Why this is not enough:

- **The evidence is overwritten.** `result-verification/build-test/summary.ts:448-455` (`explored(step)`) reads
  `step.effectApplied` and `step.resultCode` only. For a checked candidate those fields hold the check, not the
  press. The real landing sits in `step.priorExecution` (with its `changed` lines), and `summary.ts` never reads
  it.
  - Only `flow-draft/entry.ts:194` (the model's draft view) shows `priorExecution`.
  - `flow-bootstrap/instructed-acts/act-evidence.ts:271` deliberately skips steps that have it.
  - So the judge has no positive evidence path at all for a withheld act whose landing was later checked.
- **Surfacing it would still be wrong here.** The 0057 landing ran on a reloaded page with the default variant and
  quantity 1. Showing it as `changed: yes` would credit a cart line the person did not ask for. So the judge's
  refusal is substantively right.

## (c) What the rules require here, and the page state

- **Page state at repair start:** `0 Cart` (0049 snapshot after reload, 22:07:58). Earlier `0 Cart` readings
  appear in the build (0002-0035).
  - The build's trial (0032) pressed Add to cart ("Added to cart!" in 0033's endView), but the header still read
    `0 Cart` at 0033.
  - So the cart was empty when the post-redesign run began. I did not trace whether the Lab or the variant empties
    the cart between creation and the redesign run; the page shows it empty.
  - The failed run had done steps 1-6 correctly (rows 0036-0042) and failed at step 7 without landing.
- **What the rules call for:** the act had not landed, so exactly one press in this run was owed. It belongs
  where its preconditions hold:
  1. **First choice, the in-run rung at the failing step.** Steps 1-6 had just run there.
     - The ladder proposed `temporary_target_override` to the "Add to basket" button (0048).
     - The ladder refused it: `patch_refused` with `target_unanchored` (run detail `inRunRepairs[0]`).
     - The cause is the domain's equivalence check (`domain/src/runtime/llm-evidence/target/equivalence.ts:69-90`).
       "Add to basket" shares no whole or shortened name with the recorded "Add to cart", and there is no form
       anchor.
     - This refusal is what sent the repair into the reauthor loop.
  2. **Otherwise, the judged whole run from the start**, after steps 3-6, so the press's own `observed.changed`
     proves it.
- **What happened instead:** an isolated single-step rerun pressed the act on a reloaded page. After that, D1 and
  `ActDone` correctly forbid any second press, so the session cannot reach the requested cart (3x Space Grey /
  7-in-1 / Spain) honestly.

## (d) The general fix

Two parts, both in Core, plus one judge-side companion.

1. **A rerun of a seeded step must redo the steps before it** (`llm/node-tools/step-place.ts`).
   - `stepsBefore` (lines 174-183) compares only `each.replay?.from`.
   - The caller (`llm/evidence-loop.ts:425-426`) passes `startedOn` for the replaced step only, taken from
     `input.draft.seedStartedOn`.
   - Seeded steps never get `replay.from` (`llm/node-tools/draft-from-flow.ts:35-46`, 218-219). So in a re-author
     draft the run of steps to redo is always empty.
   - This run confirms it. Every rerun's `rerunPlace` reads `startPage: seeded_run` with no `doneAgain`
     (0058/0098/0160 request packets). The 0091 page shows step 5 chosen while step 4 is back at 4-in-1.
   - Fix: pass the whole `seedStartedOn` map, and compare each earlier step's effective place, `replay?.from ??
     seedStartedOn[standsFor ?? id]`.
   - The redo already sends lasting steps as checks (`automationStudioFlowDraftReplaySteps` with `lastingActs`), so
     step 2 stays unpressed.
   - This is the same defect class as the t193 bigbox "Qty 1" case the header names, but on the seeded path.
2. **Do not perform an unlanded lasting act in exploration. Perform it once in the judged run from the start.**
   - Rule: in a repair draft, a rerun of a lasting step whose act has not landed in this run is sent as a check
     (`replay: verify`), the same answer as `ActDone`.
   - The judged build test then sends that step as `replay: step` instead of `verify`, exactly once, after its
     prefix on the put-back page. It records the landing on the step (effect applied, the act id), so any later
     test round checks it and does not press it again.
   - Where to change it:
     - `automationStudioFlowDraftStepReplayMode` / the dry run (`flow-draft/dry-run.ts`, `llm/node-tools/replay-draft.ts:321`)
       need a "landed in this run" input. That is the session's record of performed lasting acts; the executor
       ledger's act identity (`executor/lifecycle-run/act-identity.ts`) is the natural key.
     - `rerun-check.ts:118` checks an unlanded lasting act in a repair draft as well.
   - Result: exactly one press, with its preconditions, inside the judged run the user requires before saving.
     The judge sees the press's own change ("Added to cart!", cart 0 to 1).
   - For a creation build nothing changes: exploration lands the act in sequence, and D1 withholds it in the test.
3. **Judge-side companion** (`result-verification/build-test/summary.ts:448-455` and the
   `diagnosis-instructions.ts:162` paragraph).
   - For a withheld step with `priorExecution`, report the landing as evidence: `explored: {changed: yes,
     resultCode, landed: "earlier in this run", after: [steps redone before it]}`.
   - Report it only when the landing ran after its prefix (`doneAgain` covering it, or a judged run). Otherwise
     say `landedOutOfOrder` and let the loop end honestly instead of looping.
   - Add one sentence to the instruction: a withheld act shown as landed earlier in this run, after the steps
     before it, is done once; do not ask for it to run again.
   - Without this, round 2+ of any repair (after part 2's first landing) hits the same `no`.

Tests to add (Core, beside each subject):

- `llm/node-tools/tests/step-place-done-again.test.ts`: a seeded draft (from `draft-from-flow` with `startPages`,
  no `replay.from`). A rerun of the last, lasting step redoes steps 3-6 in order (`doneAgain`) before running,
  checks step 2 without pressing it, and the rerun sees the chosen variants.
- `llm/node-tools/tests/rerun-check.test.ts`: in a repair draft, a rerun of an unlanded lasting step is a check,
  and nothing is pressed.
- `llm/node-tools/tests/lasting-acts-build.test.ts` (or `replay-draft-verify.test.ts`): the judged test performs
  an unlanded lasting step once and records it; a second test round verifies it.
- `result-verification/build-test/tests/summary.test.ts`: a checked candidate with `priorExecution` landed after
  its prefix gives `explored.changed: yes` with the landing. One landed out of order is flagged, not credited.
- A judge fixture from this run's packet (0109): step 7 verified with a landing shown is credited; with no
  landing it is refused (today's behaviour).

## What changed and why

Nothing. This was investigation only. The only file written is this report.

## Commands run and observed results

- Listed and read `steps/index.md`, the `call.json`/`result.json`/`meta.json` of 0049-0108, and the judge
  `request.txt`/`response.txt` of 0109, 0110, 0137, 0138, 0171 and 0172.
  - The index was renumbered between my first and second listing (162 to 173 entries): the run finished at
    22:10:55.
- Grepped every step for `N Cart`: `0 Cart` through 0066, `1 Cart` from 0069 onward.
- Core `core.log` (bundle copy): the judge ran at 22:09:18-22:09:25 (`verdict=no calls=2 tested=1`), then
  `unknown` at 22:10:04 and 22:10:49.
- Copied three run-detail objects into a private scratch folder (`scratchpad/r4b-withheld-worker/`) because the
  paths were too long to read in place. They show `inRunRepairs[0].code: patch_refused`, reason
  `target_unanchored`.
- Read the Core sources cited above (step-place.ts, rerun-check.ts, verify-only.ts, dry-run.ts header, summary.ts
  `explored()`, draft-from-flow.ts header, evidence-loop.ts:420-430) and the downstream `equivalence.ts`.

## Not verified

- I did not run any test or reproduce the put-back offline. The empty prefix redo is inferred from the code
  (`stepsBefore` keys on `replay.from`) and confirmed by the run (`startPage: seeded_run`, no `doneAgain`, 0057's
  page at 4-in-1/China/qty 1).
- I did not trace who emptied the cart between creation and the redesign run (Lab reset or variant). The page
  shows it empty at 0049.
- I did not check whether `automationStudioFlowDraftReplaySteps` can redo carried steps that have no
  `replay.from` when they are passed in as the prefix. The dry run did replay them (0102-0107), through the
  scheduled-candidate path, so it is likely.

## Open questions or contradictions found

- **The in-run rung refused a real rename** ("Add to cart" to "Add to basket", same role and place, beside "Buy
  now") as `target_unanchored`.
  - That rung is the user's primary path. Accepting it would have pressed once in the live run with steps 1-6
    done.
  - Whether `equivalence.ts` should anchor on something beyond name and form (for example landmark plus sole
    control of its kind) is a design decision. The check exists to refuse guesses (2026-09-17 campaign).
- **Part 2 versus the D1 header.** The `dry-run.ts` header says the build test never performs a lasting act, and
  part 2 makes one exception: a repair's unlanded act.
  - It needs the supervisor's or user's sign-off as a change to decision D1.
  - The user rule "never pressed twice" holds either way.
