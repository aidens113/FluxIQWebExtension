# Report: t751-h-specs-job-office (worker)

## Outcome

Done. Both specs are written and were run headed and provider-free on realistic scenarios against today's Core
(dev `d78c8d4a`). Each one fails for the reset cause it targets. No commits were made. No Core file, existing spec
or existing helper was touched.

## What changed and why

- `apps/extension/e2e/site-reset/tests/job-unexplored-step.spec.ts` (job-board). Reproduces job round 5 cause 1.
  - What the builder does: reads My jobs (ref issued), opens the job, and finds the heart without pressing it. It
    submits `open` + `save` (`consequences: modify_existing`) and tests. It then reads My jobs again to see what the
    test did to the site. Next it presses the heart while exploring, naming the ref, resubmits the same Flow text and
    tests. If the gate lists the explored save under `actsToUndo`, it presses that row's own Unsave job under
    `undoes` and tests again. After a trial runs, it asks the gate once more.
  - First test, expected: `ok:false`, `candidate.trial_step_unwitnessed`, `failed: no_witness`,
    `canMeet: another_page`, and one `stepsUnwitnessed` entry whose `step`/`label` is `save`/`save the job`. Also
    no `trialRunId`, no feedback steps, no `leftOnSite`, and My jobs read straight after the test hashing equal to
    its baseline.
  - After exploring, expected: the explored save is admitted and lands, the resubmission is revision 2, the explored
    act is `act-1` where it is named, and a trial answers yes with `save the job` succeeded. That trial does not
    start with the explored save under `actsToUndo`, and a trial act's settle contains the My jobs URL.
  - The script is a state machine keyed on the previous call, so it runs to an end on either Core. A later brief,
    when the supervisor re-dispatches, completes at once.
- `apps/extension/e2e/site-reset/tests/office-site-reverted-toggle.spec.ts` (everything-store checkout). Reproduces
  office round 5 cause 1.
  - How the site returns the toggle: `state/checkout-ops.ts` `opened()` starts every checkout session with
    `plusTrial: true`, so a second Buy Now resets the box. This is the same thing brief-8 did in the live run.
  - What the builder does: reads the cart (ref issued) and presses Buy Now naming it. It unticks the Plus box
    (`web.output.dom-check`, `checked:false`, `modify_existing`), goes back, and presses Buy Now again naming the
    cart. It then presses the box back (`checked:true`) under `undoes: act-2`, submits `open` + `buy` and tests.
  - Expected: the undo is answered `candidate.undo_already_back` unrun, with nothing clicked and the declaration not
    permitted. Then the test's `actsToUndo` is empty, the trial answers yes with Buy Now succeeded, the untick is not
    among the acts the trial started with, and the ending is `proposed`. On the site, every cart read equals the
    baseline, and checkout's Plus box is checked at the end (checked through Playwright after the build).
- No new helper. Both specs import only from `../index`.

## Commands run and observed results

1. Extension build, run once at the start and again after another worker's domain edits made the e2e artifact stale
   (the fixture refused with `environment.stale`). From `apps/extension`:
   `node ../../scripts/build-cache/cli.mjs extension:build -- "tsc ... && node scripts/build-extension.mjs"`.
   Observed: `e2e-chromium: verified 22 files` both times.
2. `pnpm test:e2e` was not usable. Its first gate, `scripts/check/core-build.mjs`, refuses because the t751 Core
   source is being edited ("not current with its source"). Playwright was run directly instead:
   `node --no-experimental-strip-types node_modules/@playwright/test/cli.js test -c e2e/playwright.config.ts <spec> --reporter=list`.
   Extension sessions launch headed through their fixture.
3. How the runs were held to today's Core:
   - Job run 1 ran against the t751 Core dist while it was still current with dev.
   - At 21:32 another agent ran `pnpm --filter fluxiq build` in the t751 Core. That build deleted the dist and then
     rebuilt it from the lane's in-progress source, which already changes `reset-settlement/control-tracker.ts`,
     `judge.ts` and others.
   - To keep testing today's Core, I extracted `git archive d78c8d4a` (read-only) into
     `C:/Users/osrs_/AppData/Local/Temp/claude/c--Users-osrs--FluxStuff--FluxIQWebExtension/53d1357c-b7da-4f48-9665-ff78992a8998/scratchpad/core-d78c8d4a`.
     Its `node_modules` and `packages/fluxiq/node_modules` are junctions into the t751 Core. I compiled it with
     `tsc -b tsconfig.build.json` (3m48s, no errors).
   - Every `fluxiq` / `fluxiq/*` import was redirected to that copy with a Node resolve hook
     (`.../scratchpad/core-hook/register.mjs`, through `NODE_OPTIONS=--import ...` and
     `H_PRISTINE_CORE=<that dir>`). I checked the redirect: `import.meta.resolve('fluxiq/automation-studio')` gives
     the scratch dist.
4. Job spec (run 1 against the dev dist; run 2, the final spec, against the pristine `d78c8d4a` copy). The same
   failure both times:
   - First failing expectation: `expect(unexplored?.ok).toBe(false)` (line 167). Expected `false`, received `true`.
   - Why: today the unwitnessed save step's trial is admitted and runs. It answered `verdict: yes` with steps
     `open the job` and `save the job` both `succeeded`, and `leftOnSite` named `act-1` "trial step 2 \"save the job\"".
   - On the site, My jobs read 2 rows at baseline and 3 rows straight after the test. The test pressed the heart,
     so the trial's act became the build's first lasting act with no witness.
   - Further today: `submit.again` was refused `candidate.unchanged_submission`, so there was no revision 2.
     `trial.explored` and `trial.after` answered from the stored yes.
5. Office spec (runs 4 and 5 against the pristine `d78c8d4a` copy; run 5 is the final spec):
   - First failing expectation:
     `expect(actsUnder(tests[0], "actsToUndo").filter(act => act.act === untickAct || act.call === "untick")).toEqual([])`
     (line 170). It received one act: `act-2`, call `untick`.
   - Why: every earlier expectation passed. Buy Now was admitted with one click. The untick was declared
     `modify_existing` with a place and state, and admitted. The box was shown checked, then unchecked, then
     checked again after the second Buy Now. The undo was answered `candidate.undo_already_back`, `already_back`,
     `no_call`, unrun and not permitted.
   - The test was then refused `candidate.trial_reset_required`, `failed: acts_in_place`, `canMeet: another_page`.
     `actsToUndo` held act-2, whose settle says "Its control at <checkout> still shows the state this act set: press
     that same control back once". Both Buy Now acts were under `cannotUndo`.
   - This is office round 5 cause 1 exactly: the act stays listed, and its only undo is refused. The build ended
     `failed` (`flow_bootstrap.evidence_repeat_without_progress`). The Plus box was checked at the end.
   - Run 3 failed earlier, at the stale-artifact gate, before the rebuild in item 1.
   - Run 2 hung with no output for 560s and was killed. Its cause was not traced. The likely cause is Playwright's
     first babel transform of the scratch Core dist, which sits outside `node_modules`. Run 3 took several minutes
     before starting.

## Not verified

- Neither spec has run against the lane's finished Core. The post-lane expectations are partly my reading of the
  brief. These shape details are guesses:
  - the `stepsUnwitnessed` entry's field names (`step` or `label`);
  - `trialRunId` being absent on the refusal;
  - a trial act carrying `settle` in `leftOnSite` or in a later `actsToUndo`;
  - the explored act being `act-1`.
- In the job spec, "the trial runs after Core's reset settles the explored act" is handled both ways. If Core admits
  the trial directly, that is accepted. If the gate lists the explored save, the builder undoes it on its own My jobs
  row and tests again. Which path the lane takes is not pinned.
- The instrumented click counter does not see a trial's own presses. Today's trial pressed the heart, yet the count
  stayed 0 -> 0. So "no click dispatched by the test" is proven by site state instead: My jobs hashes equal to its
  baseline right after the test, and there are no steps and no `leftOnSite`. The click-count assertion stays but
  proves nothing on its own.
- Domain code was not pristine for the runs. The e2e loads `@fluxiq-web-extension/domain` from `src` (its `"."`
  export). Job run 1 had no tracked domain edits. Job run 2 and office runs 4 and 5 included another worker's
  in-progress edits to `domain/src/output-nodes/definitions.ts` and `extract-list/index.ts` (listing order, not on
  these specs' paths). The extension bundle was rebuilt with them.
- The spec files were not typechecked. No tsconfig covers `apps/extension/e2e`, and Playwright strips types.

## Open questions or contradictions found

- The brief says not to rebuild the t751 Core because other workers are editing it. Another agent did rebuild it
  at 21:32, from in-progress lane source. Any e2e run in t751 now measures half-landed lane code, not today's Core.
  The scratch copy and the hook above are a way to keep reproducing "today". To reuse them, point `H_PRISTINE_CORE`
  at `core-d78c8d4a` and pass the `--import` hook.
- Warning: the scratch copy holds junctions into the t751 Core's `node_modules`. Remove them with
  `cmd /c rmdir <junction>` (not recursive) before deleting that folder. A recursive delete could follow them into
  the t751 tree.
- Brief vs today: the brief expects the same Flow text resubmitted after exploring to be a new revision. Today it is
  refused `candidate.unchanged_submission`. If the lane does not change that (for example by counting the witness
  stamp in the digest), the job spec's `resubmitted?.revision` toBe(2) will fail after the lane.
