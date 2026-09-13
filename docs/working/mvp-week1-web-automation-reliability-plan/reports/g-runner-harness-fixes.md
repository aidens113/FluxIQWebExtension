# g-runner-harness-fixes — H1, H2, H3 and H5 (test-runner)

Worker report, 2026-09-13. Brief: `briefs/finish-week1.md`, "g-runner-harness-fixes",
Twenty-fifth dispatch, with the supervisor's amendment that `run-flow-lane.ts` and its
test were also available. Nothing was committed.

## Outcome

**Done.** Each of the four fixes has behavioural tests and a mutation proof:
- **Test-runner type check:** `check` exits 0.
- **Full test suite:** 540 of 540 pass, from a private `dist-grhf` build.
- **Structure audit:** passes.

One widening of ownership was unavoidable: a new directory, `packages/test-runner/src/lane-rules/`
(Open question 1). `run-flow-lane.ts` was not needed and was not touched.

**H1: the runner now follows pagination.** The manifest still claims page 3 of 3.

## What changed and why

### H2 — a Flow-lane run always gets a Core identity, and one that built no Flow fails

**`lane-rules/core-identity.ts`, `coreIdentityRequired`**
- Returns true for a clone run and for every Flow-lane run.
- Otherwise it keeps the old recording-lane rule: pinned recording events, pinned actions, or a playback goal.
- It replaces `scenarioRequiresCore`, which is deleted from `scenarios.ts`. The runner was
  its only consumer.
- `run-scenario.ts:139` now passes
  `bootstrapIdentity: coreIdentityRequired({ clone: target.mode === "clone", flowLane: options.flow === true, scenario, recorded: recordingWorkflow.expected })`.

**`lane-rules/built-flow.ts`, `assertFlowLaneBuiltFlow`**
- **What it checks:** on an isolated or persistent-isolated Flow-lane run, it throws
  `environment.missing` ("The Flow lane built no Flow from this run's recording, so the run
  cannot pass") unless the lane published `flowCreated: true`.
- **Where it runs:** in `run-scenario.ts`, straight after the isolated block and before the
  console and network checks and `verdict = "passed"`.
- **Why it is needed:** with identity always bootstrapped it should now be unreachable. It
  closes the path the six false passes took: no Core session, so the Flow-lane block was
  skipped and the run passed anyway.
- **Why `environment.missing`:** a run can only reach it when the isolated Core was missing,
  which matches the lane's existing "needs an authenticated isolated Core" failure.

### H3 — the Core probe types only into a step whose target is on the start page

**`lane-rules/probe-step.ts`, `selectCoreProbeStep(steps, onStartPage)`**
- Picks the first `type` step, in script order, whose target has a CSS selector and whose
  `onStartPage(selector)` is true.
- Otherwise it returns
  `{ kind: "skipped", reason: "no-css-type-step" | "not-on-start-page", stepIds }`. Step ids
  only, never a value.

**In `run-scenario.ts`, `proveCoreActionRoundTrip` uses it**
- `onStartPage` is `page.locator(selector).first().waitFor({ state: "visible", timeout: 1_000 })`.
- It is asked on the runner's scenario page, which is still the start page, before Core's
  navigate is sent.
- A skip publishes a `runtime.settle` event, "The Core action probe was skipped", with
  `details: { reason, stepIds }`.
- A script with no usable `type` step used to skip silently. It now publishes
  `no-css-type-step`.

**Why "on the page" means visible at run time rather than a rule about earlier steps**
- The extension rejected W12's probe for a zero-size box, and Playwright's `visible` is
  exactly a non-empty box.
- A rule about earlier steps would also pass over a field that is on the start page but
  follows an unrelated click.

### H5 — a negative run is not judged on the playback goal's success facts

**`lane-rules/final-state-facts.ts`, `finalStateFacts(scenario, workflow)`**
- Returns the workflow's `finalState`.
- It adds the goal's success facts only for the primary workflow when the resolved
  `expected.failure` is unset.
- That is the bench's own definition of a negative run (`bench/aggregate-report.ts:46-47`),
  so a negative variant is covered.
- `assertFinalState` in `run-scenario.ts` now asserts that one list, in the same order as before.
- Among scenarios with a playback goal, identity-drift's primary declares no failure. A grep
  for `failure:` in the other two, `llm-target-drift/scenario.ts` and
  `instruction-only-form/scenario.ts`, found nothing, so no positive row changes.

### H1 — the recording lane's final state and pagination

**Decision: the runner now follows pagination.** The manifest is unchanged.

**`scenario-steps/extract-records.ts`, `extractRecords`, when the step has `pagination`**
1. It reads the page.
2. It clicks `pagination.next` with Playwright. That click is trusted input, so the
   extension records it.
3. It waits until the page it read has been replaced. It holds the first item read, or
   `next` when the page had none, and polls `isConnected` every 50 ms, up to
   `step.timeoutMs ?? 15_000`.
4. It reads again, until `next` is absent or `maxPages` pages have been read.

A page that is never replaced fails the step as `runtime.behavior`, and so does a page it
cannot hold. It never reads the same page twice. Without `pagination` it still reads one
page and never clicks.

**`run-scenario.ts:294`** now asserts every extract step's records. The earlier
`!step.pagination` exception is gone.

**Why the runner, not the manifest:**
- The fixture's own e2e spec plays the same script with Playwright, clicks Next, and asserts
  `Page 3 of 3`, `next-absent` and server view 3 (`apps/scenario-lab/e2e/product-catalog.spec.ts:26-47,73,142-162`).
  Dropping those facts would make the manifest describe less than the fixture proves.
- The fixture's 150 ms results latency exists for a reader that follows Next
  (`product-catalog/client-script.ts:3-8`).
- W05's workflow is described as "by following Next".
- Following it gives W05 and W07 recordings that hold the navigation their final state
  claims, so W05's Flow lane can now build a Flow: two Next clicks. The old design left
  following Next to the Flow, but no extract node can come from a recording, so nothing
  followed it.

### Tests added

- **`lane-rules/tests/core-identity.test.ts`**, 2 rows:
  - the Flow lane needs a Core identity with nothing pinned, and the recording lane does not;
  - the recording lane needs one for pinned events, pinned actions or a goal, and a clone always does.
- **`lane-rules/tests/built-flow.test.ts`**, 2 rows:
  - no observation, or `flowCreated: false`, throws; `true` passes;
  - the recording lane, and runs on the existing and clone targets, are exempt.
- **`lane-rules/tests/probe-step.test.ts`**, 3 rows:
  - W12's script is skipped with `not-on-start-page` and `["enter-email"]`;
  - the first on-page type step is chosen in script order;
  - no CSS type step skips without asking the page.
- **`lane-rules/tests/final-state-facts.test.ts`**, 3 rows:
  - a positive primary run gets final state plus goal;
  - the W29-shaped negative run gets final state only;
  - a named workflow, or a scenario with no goal, gets its final state alone.
- **`scenario-steps/tests/extract-records.test.ts`**, 3 new rows on a fake page that replaces
  itself 40 ms after Next:
  - all pages are read in order, with Next clicked on every page that has one;
  - `maxPages` bounds the read, and an unpaginated step never clicks;
  - a Next that never replaces the page fails within the step's timeout.
- **`run-evaluation/tests/runner-wiring.test.ts`**, 1 new test pinning the call sites:
  - the `lane-rules` import and the `bootstrapIdentity` expression;
  - the built-Flow check sits after `runFlowLane` and before `verdict = "passed"`;
  - the probe selection and its published skip;
  - `finalStateFacts` in `assertFinalState`, and no `successFacts` left in the runner;
  - the unconditional extraction assert.

## Commands run and observed results

All commands ran from `F:\!FluxIQWebExtension\packages\test-runner` unless stated, with output
redirected to scratch files and the exit status echoed.

1. **`pnpm check`**, first run: `exit=2`.
   - `src/scenario-steps/extract-records.ts(95,32): error TS2345: Argument of type 'ElementHandle<HTMLElement | SVGElement> | null' is not assignable ...`
   - `(102,11): error TS18047: 'handle' is possibly 'null'`.
   - `Locator.elementHandle()` can return null in `@playwright/test` 1.51.1. Fixed by failing
     the step when the page cannot be held.
2. **`pnpm check`** again: `exit=0`.
3. **Structure audit.** From the repository root, `.git/index` was copied to the scratchpad,
   then `GIT_INDEX_FILE=<scratch> git add packages/test-runner/src/lane-rules`, then
   `GIT_INDEX_FILE=<scratch> node scripts/structure-audit.mjs`.
   - Exit 0: `structure-audit: passed (39 warning(s), 17 baselined).`
   - No finding names `lane-rules`.
   - `run-scenario.ts` shows only the advisory `700 lines is past the 400-line advisory threshold`.
   - This ran before the two-line null-handle check in step 1 and was not rerun; that edit
     adds no file and no export.
4. **`npx tsc -p tsconfig.json --outDir dist-grhf`**, then `node --test "dist-grhf/**/*.test.js"`:
   build exit 0, test exit 0, `# tests 540`, `# pass 540`, `# fail 0`.
5. **Mutation proofs.**
   - `sha256sum` of the five guarded files was recorded first.
   - One mutation was applied in each of the five files. Each test file imports only its own
     subject, so every failure is attributable to its own mutation.
   - The rebuild exited 2. One error was `../test-contracts/src/validation.ts(193,44): error TS2345`,
     from another worker's uncommitted edit (`git status`: ` M packages/test-contracts/src/validation.ts`,
     `?? packages/test-contracts/src/recordable-actions.ts`).
   - The other error was `extract-records.ts(97,41)`, an artifact of the `false &&` mutation,
     which makes the null-narrowed `handle` unreachable. JavaScript was emitted.
   - Each guard's test file was run on its own:
     - **H2, identity.** `if (input.clone || input.flowLane) return true;` became
       `if (input.clone) return true;`.
       `not ok 1 - a Flow-lane run bootstraps a Core identity even when its workflow pins no recording events, actions or playback goal`,
       `expected: true`, `actual: false`.
     - **H2, built Flow.** `flowCreated === true` became `flowCreated !== false`.
       `not ok 1 - a Flow-lane run on an evaluated target fails unless the lane published a Flow it created`,
       `error: 'Missing expected exception (builtNoFlow).'`.
     - **H3.** The `onStartPage` result was or-ed with `true`.
       `not ok 1 - a type step whose target only an earlier step reveals is skipped, naming the reason and the step`:
       actual `kind: 'probe', selector: '[data-testid="invite-email"]'`, expected
       `kind: 'skipped', reason: 'not-on-start-page', stepIds: ['enter-email']`. Row 2 also failed.
     - **H5.** `&& workflow.expected.failure === undefined` was removed.
       `not ok 2 - a negative run is judged on its own final state and not on the playback goal (W29 save-and-exit)`:
       actual had an extra `{ id: 'settings-saved', subject: 'save-status', value: 'Saved: Workspace' }`.
     - **H1.** `while (await stillAttached(handle))` became `while (false && ...)`.
       `not ok 5 - a paginated extract clicks next, waits until the page it read is replaced, and reads every page in order`:
       actual `'Kettle', 'Lamp'` repeated, expected `'Mug', 'Napkins', 'Oven mitt'`. Rows 6 and 7
       also failed.
6. **Restore.** All five mutations were undone. `sha256sum -c` printed `OK` for
   `lane-rules/core-identity.ts`, `lane-rules/built-flow.ts`, `lane-rules/probe-step.ts`,
   `lane-rules/final-state-facts.ts` and `scenario-steps/extract-records.ts`, with `hash exit=0`.
7. **Final rebuild and suite.** Build exit 2, from the same single `test-contracts/src/validation.ts(193,44)`
   error, with no error in test-runner. Test exit 0: `# tests 540`, `# pass 540`, `# fail 0`,
   `# cancelled 0`.
8. **`pnpm check`** retried after that parallel edit: `exit=0`.
9. **`rm -rf dist-grhf`**: afterwards `dist-grhf present after delete: no`.
10. **`git`:**
    - `f-runner-secret-input`'s diff to `run-flow-lane.ts` and its test was committed by the
      supervisor in `413dcb3` during this work. Its line is at HEAD
      `run-flow-lane.ts:133` ("Each declared value once, under the path a node reads").
    - I did not touch either file.
    - HEAD is now `dd9b9f9`. Neither `413dcb3` nor `dd9b9f9` touched a file I own;
      `dd9b9f9` touched `flow-lane/expectations.ts`.

No `pnpm build`, `pnpm lab`, scenario-lab check or test, or content-harness command was run.
The manifest did not change. Every result above is a single observation, apart from the full
suite, which ran twice, 540 of 540 both times.

## Not verified

- **No Lab run and no real browser.**
  - The pagination click and the detach wait were never run against the real product-catalog page.
  - The extension was never shown recording the Next clicks.
  - The start-page visibility check was never run on real fixtures.
- **P3 interaction.** W05 and W07 now click Next twice on a control that does not move. If
  the two clicks land within 750 ms, the recorder drops the second until
  `f-pointer-click-pairing` lands. The Flow would then replay one click and fail its final
  state. The recording lane's own final state would still hold.
- **Recording-lane identity is unchanged**, as H2 is scoped to the Flow lane. W06's recording
  lane still gets no Core session, so the triage's 7-of-23 ceiling for that lane does not
  yet apply.
- **What a Lab run must show:**
  - **H1:**
    - W05 recording passes, with extraction asserted at 23 records, `Page 3 of 3` and
      `web.element.clicked` 2 in the extension log.
    - W07 recording passes, with 18 records.
    - W05 flow shows `flowCreated=true`, two `web.dom.click` actions, and its final state holding.
    - W05 `short-catalog` flow is expected to fail: its Flow clicks a Next the armed page
      does not render (`target_not_found`). That is a product gap like P7, not a harness defect.
  - **H2:** W04, W06 and W08 Flow-lane runs have gateway, recording and Flow events. None
    passes without `flowCreated=true`. W04, whose recording is extract only, fails rather
    than passes.
  - **H3:**
    - W12 on both lanes publishes "The Core action probe was skipped", with
      `reason: "not-on-start-page"` and `stepIds: ["enter-email"]`, then records.
    - W01, W02, W03, W18 and W24 still run the probe.
  - **H5:** W29 `save-and-exit` passes.

## Open questions or contradictions found

1. **Ownership widened by a new directory, `packages/test-runner/src/lane-rules/`:**
   5 source files (`index.ts`, `core-identity.ts`, `built-flow.ts`, `probe-step.ts`,
   `final-state-facts.ts`) and 4 tests under `tests/`. The brief's Owns list could not hold
   these fixes' tests:
   - `packages/test-runner/src` is at its `directory-files` ratchet of 49, and
     `packages/test-runner/src/tests` at 50, so no `scenarios.test.ts` or `run-scenario.test.ts`
     can be added.
   - Core's placement rule forbids a new file beside `run-scenario.ts` ("extract-and-drop").
   - Please confirm the directory and its name. No baseline entry changes.
2. **`runner-wiring.test.ts` gained one new test** of call-site pins. These are new pins,
   whereas the brief allowed that file "for only the pins these move".
3. **Public export removed.** `scenarioRequiresCore` left `scenarios.ts`, and so the package
   barrel. No consumer exists in the repository.
4. **Stale comments in files I do not own now contradict H1:**
   - `packages/test-contracts/src/scenario.ts:22-24`: "`extract` is an authored
     data-extraction step that performs no page interaction of its own".
   - `packages/test-runner/src/flow-lane/expectations.ts:78-83`: "The recording lane asserts
     only unpaginated extraction because it reads the current page and never follows `next`;
     a Flow does follow it".
   - `docs/architecture/testing-facility.md:299`, "For a Core-requiring isolated scenario",
     describes no rule; every Flow-lane run is now Core-requiring. No architecture page
     describes the probe's step choice or its published skip.
5. **H1 reverses an earlier design choice.** Following pagination was left to the Flow. If
   the supervisor prefers the manifest route instead:
   - drop `pageStatus("Page 3 of 3")` and `nextAbsent` from W05's final state, and
     `pageStatus("Page 3 of 3")` from W07's;
   - keep `resultCount`, which reads the same on every page;
   - restore the `!step.pagination` exception and the reader's old doc.
   The e2e spec should still pass its subset of facts, but I did not run it. The cost: W05's
   Flow lane could then never build a Flow.
6. **The probe's skip event now appears in every scenario with no CSS `type` step:** W04,
   W09-W11, W13-W17 and W25-W28. Only runs with a paired Core session get it, since the probe
   is called only then.
