# g-expected-action-guard — an expected action a recording cannot produce fails the check

Worker report, 2026-09-13, at `HEAD dd9b9f9`. Brief: `briefs/finish-week1.md`,
twenty-sixth dispatch. A mid-task correction from the supervisor, after
`g-runner-harness-fixes` finished H1, asked for two stale comments to be fixed. It
is covered below.

## Outcome

Done.
- **The check.** The test-contracts scenario validator now rejects a scenario
  whose `expected.actions` names an action type that no step of its recording
  script can produce.
- **Admin-console** is corrected. The check flags no other manifest.
- **Mutation proofs.** Three were run, and each file was restored byte-identical.
- **The stale comments** were corrected: the two the supervisor named, plus one
  more in the same Flow-lane doc block.
- **Gates.** The package gates and the structure audit pass.
- **No Lab run** was made; the brief forbids one.

Re-verified at HEAD first:
- Admin-console's `extract-customer-list` still pinned
  `{ action: "web.dom.extract", outcome: "succeeded" }` (`manifest.ts:143`).
- The H4 change was already committed in `dd9b9f9`, not left uncommitted:
  `flow-lane/expectations.ts:18` reads `outcome === undefined ||` at HEAD. That
  logic is untouched. Only its doc comments changed.

## What changed and why

### Where the check lives: the test-contracts validator, not `flow-lane/expectations.ts`

- **It runs before any lane can start.** Every manifest is asserted when it is
  built (`apps/scenario-lab/src/types.ts:63`, `:68`) and again when the runner
  loads it (`packages/test-runner/src/scenarios.ts:15`). A manifest with the defect
  cannot be imported, so it never reaches a run and can never appear as a product
  failure. Scenario-lab's own unit tests fail on it.
- **It covers every lane.** The Flow lane judges `expected.actions`
  (`run-flow-lane.ts:153`), and so do the existing and clone lanes
  (`run-scenario.ts:226`, `:252`, through `existing-flow-run.ts:107`). A check in
  `flow-lane/expectations.ts` would cover only the Flow lane.
- **No caller I don't own has to change.** `assertFlowActions` never receives the
  recording script. A Flow-lane check would need `run-flow-lane.ts` to pass the
  script in, and that file is another worker's. Without that change the check
  would never run.

### Files

- **New: `packages/test-contracts/src/recordable-actions.ts`.** 66 lines, one
  exported value: `recordableActionTypes(script)`.
  - It holds the table of what each step operation yields once recorded, plus the
    rule for a paginated extract.
  - The table is keyed by every operation, so a new operation will not compile
    until its row is written.
  - It is not exported from the barrel; only `validation.ts` uses it.
  - The name avoids a third `scenario-*` file, which would trip the shared-prefix
    rule.
- **`packages/test-contracts/src/validation.ts`** (289 lines).
  `checkExpectedActionSources` runs in `validateWorkflowBody`, beside
  `checkExtractionReferences`, for the primary workflow and each `workflows[]`
  entry.
  - Variants are judged against their workflow's script, since a variant never
    changes the recording.
  - A workflow with no steps is a playback goal (instruction-only-form) and is not
    judged.
  - The issue path is `…actions[i].action`. The message ends "the expectation can
    never be met, so it is a scenario defect, not a product failure".
- **`packages/test-contracts/src/scenario.ts`**, comments only:
  - **Lines 21-28:** the stale "`extract` … performs no page interaction of its
    own", the first comment the supervisor named, now says that `extract` is never
    recorded as an extract action; that without `pagination` it only reads; and
    that with it the step clicks `next` as trusted input, and those clicks are
    recorded.
  - **New doc comment on `ExpectedAction`,** which the dispatch allowed. The action
    must be recordable. A missing `outcome` is judged on presence alone in the Flow
    lane, and the existing and clone lanes still read it as `succeeded` (open
    question 1).
- **`packages/test-runner/src/flow-lane/expectations.ts`**, comments only; no code
  changed:
  - **`assertFlowExtraction`'s doc**, formerly lines 78-83 and the second comment the
    supervisor named. It said "The recording lane asserts only unpaginated
    extraction … never follows `next`; a Flow does follow it". It now says the
    recording lane asserts every extract step's records, paginated ones included.
    Its reader clicks `next` and reads each page, so the recording holds those
    clicks, and a Flow built from it replays them as clicks, not as an extract
    node.
  - **`FlowExtractionExpectation`'s `not_applicable` bullet**, formerly lines 60-65.
    This one was not named, but it is stale for the same reason. "nothing is
    recorded for it" is now "no extract action is recorded for it", followed by:
    "A paginated step's clicks on `next` are recorded, but only as clicks."
- **`apps/scenario-lab/src/scenarios/admin-console/manifest.ts`**, `expected.actions`
  only. The `web.dom.extract` entry is removed from `extract-customer-list`, and it
  now carries the comment W11 and W15 carry. That workflow's script is one
  unpaginated `extract` step and a checkpoint, so it now declares no action;
  `short-book` inherits that.

### The table, and where each row comes from

The rows follow three sources:
- what the domain maps a recorded event to (`domain/src/io/input-model.ts:90-135`);
- how the recording lane drives each step
  (`packages/test-runner/src/scenario-steps/step-runner.ts:79-100`);
- for a paginated extract, `scenario-steps/extract-records.ts:46-55`, as H1 changed
  it.

| Operation | Action types a recording can yield | Why |
| --- | --- | --- |
| `click` | click, check, wait_for_selector | A click on a checkbox, radio or switch also records a change, which maps to check (`input-model.ts:129`). A wait is proposed from the DOM addition recorded before a click (`recording/proposals/late-target-wait.ts:39-51`). |
| `type` | type, clear | An empty filled value maps to clear (`input-model.ts:130`). |
| `select` | select | The runner presses only typeahead and arrow keys (`trusted-input/select-option.ts:33-39`), which the domain drops (`input-model.ts:153-161`). |
| `scroll` | scroll | `input-model.ts:120-121`. |
| `navigate` | browser.navigate | A navigation marked `typed` (`input-model.ts:110-113`). The navigation manifest expects it from this step. |
| `press` | keypress, type, clear, select, check | A key can change the focused control's value. |
| `check` | check, click | `setChecked` clicks the control. |
| `extract` with `pagination` | what `click` yields | The runner clicks `next` as trusted input, and the extension records those clicks (`extract-records.ts:46-55`, `reports/g-runner-harness-fixes.md` H1). |
| `extract` without `pagination`; `waitForState`, `checkpoint`, `switchTab`, `closeTab`, `waitForDownload`, `upload` | none | Reading, waiting and tab moves record nothing. `upload` has no recorded mapping. |

### Which manifests the check flags

All 25 manifests were loaded from the privately built registry and judged with the
new validator:
- **Before the admin-console fix:** exactly one flag,
  `FLAG admin-console $.workflows[0].expected.actions[0].action: names web.dom.extract, which no step of this workflow's recordingScript records; …`
- **After it:** `scanned 25 manifests, 0 flagged`. This held both before and after
  the pagination rule. That rule only accepts more, so it cannot add a flag.
- W11 and W15 were already corrected at HEAD. Auth-gate, which another worker is
  editing, was not flagged.

### Tests

**`packages/test-contracts/tests/scenario-validation.test.mjs`:**
- **Rejected**, in "an expected action that no step of its workflow's recording
  script records is rejected as a scenario defect". Exactly three paths are
  flagged:
  - `web.dom.extract` beside an extract step, at `$.expected.actions[1].action`;
  - a keypress in a variant with no press step, at
    `$.variants[0].expected.actions[0].action`;
  - a click in a named workflow that only scrolls, at
    `$.workflows[0].expected.actions[1].action`. The primary workflow's click does
    not count, so no workflow borrows another's steps.

  Every message must end with the defect wording, and `assertWebScenario` must
  throw.
- **Accepted**, in "an expected action some step records is accepted, and a
  playback goal with no script is not judged":
  - delayed-ui's shape: type, click, and a wait that follows a click;
  - a playback goal with no script that expects a select;
  - a workflow that only extracts with `pagination` and expects a click, which is
    valid. The same workflow without `pagination` is rejected at
    `$.workflows[0].expected.actions[0].action`.

**`apps/scenario-lab/src/scenarios/admin-console/tests/scenario.test.ts`:** the
extraction test now asserts that `extract-customer-list` and `short-book` declare
no `expected.actions`.

## Commands run and observed results

**How the builds and tests were isolated.**
- All builds went to private `dist-geag` directories at `dist`'s depth:
  - test-contracts and test-runner: `pnpm exec tsc -p tsconfig.json --outDir dist-geag`;
  - scenario-lab: `FLUXIQ_LAB_SCENARIO_OUT_DIR=dist-geag node scripts/build-scenario-lab.mjs`.
- I did not rebuild test-contracts' shared `dist`, because other workers run
  against it. Scenario-lab's output and the test-contracts tests import that shared
  `dist`, so a scratch Node resolve hook (`--import geag-register.mjs`) redirected
  them to `dist-geag`.
- The rejected row passes only against the new validator, so its passing proves
  the hook applied.
- Exit codes were echoed, never piped.

**Round 1** (the check and the admin-console fix):
- **First build:** failed with `TS2345` in my own parameter type. That was my
  defect, not a parallel edit. I fixed it, and every later build exited 0.
- **Tests:**
  - test-contracts tests: exit 0, `# tests 65`, `# pass 65`, `# fail 0`;
  - scenario-lab tests: exit 0, `# tests 204`, `# pass 204`, `# fail 0`,
    including `ok 188 - every registered fixture exposes a valid versioned
    WebScenario manifest`.
- **Checks:** test-contracts, scenario-lab and test-runner `check` each exited 0.
- **Structure audit,** with the new file added through a scratch `GIT_INDEX_FILE`:
  - exit 1, with two `working-docs` failures that are not in my files. The plan's
    `## Current State` "is 151 lines", and `docs/working/README.md` "is out of
    date". Both carried other agents' uncommitted edits.
  - Later runs passed (below).

**Round 2** (after the H1 correction: the pagination rule and the comment fixes):
- **Tests:**
  - test-contracts tests: exit 0, 65 of 65;
  - scenario-lab tests: exit 0, 204 of 204;
  - the corpus scan: `0 flagged`;
  - test-runner build: exit 0, with the other workers' uncommitted diffs
    compiling. `node --test dist-geag/flow-lane/tests/expectations.test.js`:
    exit 0, `# tests 6`, `# pass 6`, `# fail 0`.
- **Checks:** all three `check` runs exited 0, and a grep of their output found no
  error.
- **Structure audit:** exit 0, `structure-audit: passed (39 warning(s), 17
  baselined).` The only finding touching my area is advisory:
  `packages/test-contracts/src/: 18 source files is past the 15-file advisory
  threshold`. It was already past the threshold at 17.

**Mutation proofs.** Each file was backed up and hashed, restored with `cp`, and
checked with `cmp`.
- **M1: the check is not called.** In `validateWorkflowBody`, the call became
  `void checkExpectedActionSources;`. Result: `not ok 12 - an expected action that
  no step of its workflow's recording script records is rejected as a scenario
  defect`, `AssertionError`, `expected: false`, `actual: true`; `# pass 14`,
  `# fail 1`. Restored: `cmp` exit 0, sha256 `53bff906…b66133`.
- **M2: admin-console's extract entry is put back, with the check present.** Both
  `registry.test.js` and admin-console's test failed to load with
  `ContractValidationError: WebScenario validation failed: -
  $.workflows[0].expected.actions[0].action: names web.dom.extract, …` (`# fail 2`).
  Restored: `cmp` exit 0, sha256 `72ff80a1…b77a8d`.
- **M3: the pagination rule is removed**, so a paginated extract yields nothing.
  Result: `not ok 13 - an expected action some step records is accepted, …`, with
  issues `[{"path":"$.workflows[0].expected.actions[0].action","message":"names
  web.dom.click, which no step …"}]`, `expected: true`, `actual: false`;
  `# pass 14`, `# fail 1`. Restored: `cmp` exit 0, sha256 `26cd4447…6611b8`.

**Final state.** After the restores, test-contracts was rebuilt: 65 of 65, and the
scan found `0 flagged`.

**Diff.** `git diff --stat` shows 6 tracked files, 108 insertions and
11 deletions, plus the new `recordable-actions.ts`.

**Cleanup.** All three `dist-geag` directories, the scratch indexes and the backups
were deleted, and `ls` confirmed each directory is gone.

No parallel edit broke a compile. Every passing result was observed once in each
round. The two suites and the scan passed in both rounds.

## Not verified

- **No Lab run.**
  - **W11 and W15:** both had their extract entries removed before this work. A Lab
    run's Flow lane must not report "did not produce a web.dom.extract action".
  - **Admin-console:** `extract-customer-list` is not in the week1 corpus, so no
    Stage 3 bench row runs it.
- **Test-contracts' shared `dist` still holds the old validator.** Until the
  supervisor rebuilds it, which happens before root `pnpm test` or any Lab run, the
  runner's load-time check (`scenarios.ts:15`) and unhooked scenario-lab tests do
  not apply the new check.
- **Three table cells come from reading code, not from watching a recording.**
  - **Paginated extract yields a click.** This rests on H1's statement that the
    extension records the Next clicks, which that report says was never seen live.
  - **`upload` yields nothing.** I did not confirm whether the recorder records a
    file input's change, which would map to `web.dom.type`.
  - **`navigate` yields `web.browser.navigate`.** This rests on the recorder marking
    `page.goto` as `typed`, and on the navigation manifest's existing expectation.

  A wrong cell of the first and third kind only lets a bad expectation pass; it
  cannot reject a valid manifest. The `upload` cell is the one that could wrongly
  reject a valid manifest, and none in the corpus expects an action from an
  upload.
- **A recording with zero actions.** Admin-console's `extract-customer-list` now
  expects no recorded event and no action. I did not check what the Flow lane, or
  the short-recording check, does when a recording holds zero actions.
- **Root gates.** Root `pnpm check`, `pnpm test` and `pnpm build`, and the content
  harness, were not run; the brief did not name them.

## Open questions or contradictions found

1. **The existing and clone lanes still read a missing outcome as `succeeded`.**
   `packages/test-runner/src/existing-flow-run.ts:107` has
   `expected.outcome ?? "succeeded"`. H4 changed only the Flow lane, so W15
   `popup-blocked` and W26 `no-context` would still fail on those lanes. The new
   `ExpectedAction` doc comment states both behaviours.
2. **A rejected manifest reaches a Lab run as `unknown`, not `fixture.invalid`.**
   `createScenarioManifest` validates when `registry.js` is imported, so the
   runner's `scenarios.ts:11` import throws `ContractValidationError`, which
   `failure.ts:63-68` classifies as `unknown`. That is still never a product
   failure, but it is not the harness category. `scenarios.ts` is another worker's
   file.
3. **Nothing mechanical ties the table to the domain.** test-contracts cannot
   import the domain. A test-runner test could compare the table with the domain's
   `actionInputDefinitions` and the late-target wait, since test-runner imports the
   domain.
4. **One stale sentence remains outside my files.**
   `docs/architecture/testing-facility.md:299`, which `g-runner-harness-fixes` also
   named, is not mine to edit.
