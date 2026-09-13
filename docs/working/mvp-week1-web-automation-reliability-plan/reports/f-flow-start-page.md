# f-flow-start-page — every Flow run starts on the scenario's start page (F1)

Worker `f-flow-start-page`, 2026-09-13, at `HEAD 2b7acb0`. Nothing committed or
pushed. No Lab command and no `pnpm build` were run.

## Outcome

**Done.** The Flow lane now loads the scenario's start page before every Flow
run, whether or not a variant is armed. Before this change it did so only for
armed runs. An unarmed run such as W18 therefore started wherever its recording
had left the browser tab. The order is now: reset, prepare the page, read the
Flow's nodes, run.

- **Re-verified at HEAD before editing.** `run-flow-lane.ts:93` still read
  `if (input.workflow.variant) await input.armVariant();`, so the item was open.
- The new unit row passes. It fails when the variant guard is restored, and the
  file is byte-identical after the restore.
- Test-runner `check`, the full test-runner suite (500 of 500), the rerun of
  `src/tests/scenario-assertions.test.ts` and the structure audit all pass.

## What changed and why

1. **`packages/test-runner/src/flow-lane/run-flow-lane.ts`**
   - The `FlowLaneInput` callback `armVariant` is renamed `prepareFlowPage`,
     because it now does more than arm. Its doc comment says it arms the variant
     if there is one, loads the start page, and runs on every run.
   - The variant guard is gone. The call is now
     `await resetScenarioLab(...); await input.prepareFlowPage();`, followed by
     `readFlowNodes` and then the run, as before.
   - The function's doc comment now lists the steps in the order the code runs
     them. It explains why the reset comes before page preparation (a reset
     discards an arm) and why both come before the run.
2. **`packages/test-runner/src/run-scenario.ts`, the callback only (`:320-333`)**
   - The key is renamed to `prepareFlowPage`. The body is unchanged: it still
     arms only `if (workflow.variant)`, always calls
     `openScenarioStart(page, …)`, then checks `pageFacts.afterArm`.
   - `afterArm` is `[]` for an unarmed workflow
     (`packages/test-contracts/src/scenario-workflow.ts:66-70`), so no new check
     runs for unarmed rows.
   - The two comments inside the callback now describe both cases, in the same
     number of lines (8 insertions, 8 deletions).
   - The literal line `await openScenarioStart(page, activeTopology.scenarioOrigin, scenario);`,
     which `scenario-assertions.test.ts:77` looks for, is untouched.
3. **`packages/test-runner/src/flow-lane/tests/run-flow-lane.test.ts`**
   - `fakeCore` now keeps a `sequence` log: flow reads (`get-flow:`,
     `list-flow-subflows:`) and `start` from `startPersistedFlow`.
   - `runLane` appends `reset` from its fetch stub and `prepare` from
     `prepareFlowPage`, and accepts an optional `variant`.
   - New row: *"every Flow run, armed or not, prepares its page once, after the
     reset and before the Flow is read or started"*. For an unarmed workflow and
     then an armed one, it asserts the sequence is exactly
     `["reset", "prepare", "get-flow:flow.new", "list-flow-subflows:flow.new", "start"]`.

## Commands run and observed results

All test-runner commands were run from `packages/test-runner` with
`EXTENSION_TEST_BUILD_LABEL=f-flow-start-page`. Exit codes were captured to
scratchpad files and echoed, never piped.

| Command | Observed |
| --- | --- |
| `pnpm exec tsc -p tsconfig.json --outDir dist-ffsp` | `tsc exit=0` |
| `node --test "dist-ffsp/**/*.test.js"` | `test exit=0`; `# tests 500`, `# pass 500`, `# fail 0`; `ok 122 - every Flow run, armed or not, prepares its page once, …` |
| `sha256sum src/flow-lane/run-flow-lane.ts` (after the edit) | `df88a79e4a3129b6c4ff955d7f9017dd66cefd136def784472ffb23a2ca1fb3b` |
| **Mutation:** restored `if (input.workflow.variant) await input.prepareFlowPage();`, rebuilt, ran `node --test dist-ffsp/flow-lane/tests/run-flow-lane.test.js` | `mutated tsc exit=0`, `mutated test exit=1`, `# tests 11`, `# pass 10`, `# fail 1` (quoted below) |
| Restored the line; `sha256sum` again | `df88a79e…a1fb3b`, identical to the value before the mutation |
| Rebuilt the restored code; `node --test dist-ffsp/flow-lane/tests/run-flow-lane.test.js dist-ffsp/tests/scenario-assertions.test.js` | `restored targeted test exit=0`; `# tests 16`, `# pass 16`, `# fail 0`, including `ok 15 - the runner checks page facts only from the schedule, …` and `ok 16 - the Flow lane's post-arm load lands on the scenario's startPath, …` |
| `rm -rf dist-ffsp` | `dist-ffsp present after delete: no` |
| `pnpm check` (test-runner) | `test-runner check exit=0` |
| `node scripts/structure-audit.mjs` (repository root) | `structure audit exit=0`; `structure-audit: passed (38 warning(s), 17 baselined).` The only warning on an owned file is the pre-existing advisory `[file-lines] packages/test-runner/src/run-scenario.ts: 660 lines`; this change adds no net lines there. No baseline entry needs to change. |

The mutated run's failure:

```text
not ok 4 - every Flow run, armed or not, prepares its page once, after the reset and before the Flow is read or started
  error: |-
    an unarmed run
    + actual - expected
      [
        'reset',
    -   'prepare',
        'get-flow:flow.new',
        'list-flow-subflows:flow.new',
        'start'
      ]
```

No new files were added, so the audit needed no scratch `GIT_INDEX_FILE`. The
scratch outputs (`ffsp-*.txt`) are in the session scratchpad, not the
repository. `git status` also shows `dist-germ/` and several `run-evaluation/`
and `bench/` edits. Those belong to `g-evidence-reader-merge`; I did not touch
them.

## Unarmed week1 Flow-lane rows whose starting page changes (for the Lab to re-measure)

- **Scope.** `bench/corpus/week1.ts:30-58` has 23 unarmed rows. Every one runs on
  the Flow lane too (`:16-18`).
- **Before:** an unarmed Flow started on the tab exactly as the recording left
  it, with the page content from before the reset.
- **Now:** it starts on a fresh load of `startPath`, after the reset.
- **Method.** Classified from each workflow's `recordingScript`, and from the
  fixture scripts where a step could navigate. Search, filter, form submit and
  upload all `preventDefault` or `fetch`, so none of them change the URL.

**A. The URL changes (2 rows).** The Flow used to start on a different page.

| Row | Workflow | Recording left the tab on | Now starts on |
| --- | --- | --- | --- |
| W10 | navigation | `/scenarios/navigation/history` (`navigation/scenario.ts:35,41`) | `/scenarios/navigation/start` |
| W18 | auth-gate | `/scenarios/auth-gate/account` (`auth-gate/manifest.ts:45-46,58`) | `/scenarios/auth-gate/` |

**B. Same URL, different page content (18 rows).** The recording changed the page
in place, and the Flow used to replay onto those changes.

| Row | Workflow | What the leftover page already showed | Inference about the old leftover-page start (not verified) |
| --- | --- | --- | --- |
| W01 | basic-form | name, plan and notes filled; submitted (`basic-form/scenario.ts:19-22,66`) | form still usable, so it passed (`i-stage1-failures` (a)) |
| W02 | keyboard-forms | display name typed and submitted with Enter; both checkboxes set (`keyboard-forms/manifest.ts:16-19`) | a replayed `check` of an already-checked box |
| W03 | keyboard-forms `combobox` | country chosen (`manifest.ts:46-50`) | |
| W06 | product-catalog `search` | search applied, results replaced by fetch (`product-catalog/manifest.ts:81-84`, `client-script.ts:40-43`) | |
| W07 | product-catalog `in-stock-only` | filter checked, results replaced (`manifest.ts:109`, `client-script.ts:44`) | a replayed click would *uncheck* the filter |
| W09 | data-table `sort-by-price` | sorted ascending by price (`data-table/scenario.ts:49`) | a replayed click on an ascending sort toggles to descending (`data-table/table-page.ts:79`) |
| W11 | infinite-feed | scrolled three times; pages 2-4 appended (`infinite-feed/scenario.ts:36-41`) | |
| W12 | modal-flows | invite opened, filled and confirmed (`modal-flows/manifest.ts:22-25`) | |
| W13 | modal-flows `consent-then-click` | consent accepted (banner gone); draft published (`manifest.ts:42-43`) | the consent button the Flow clicks first was absent |
| W14 | modal-flows `interstitial` | two sections already added (`manifest.ts:63-64`) | the Flow would add two more |
| W15 | multi-tab | review of PO-4472 confirmed, back on `/scenarios/multi-tab/` (`multi-tab/manifest.ts:34-35,43`) | |
| W16 | file-transfer | report downloaded; "download recorded" shown (`file-transfer/manifest.ts:19-21`) | |
| W17 | file-transfer `upload` | file uploaded; echo shown (`manifest.ts:38-40`, `page.ts:76`) | |
| W24 | intermediate-state | claim submitted; result shown; form hidden (`intermediate-state/scenario.ts:33-36`) | the form the Flow types into was hidden (`i-stage1-failures` "Not verified") |
| W25 | delayed-ui | content loaded; late action clicked (`delayed-ui/scenario.ts:34-36`) | |
| W26 | ambiguous-targets | primary chosen; result shown (`ambiguous-targets/manifest.ts:19-20`) | |
| W27 | failure-surfaces | target detached (`failure-surfaces/manifest.ts:41`) | the detach target was already gone |
| W28 | iframe-checkout | both frame actions clicked (`iframe-checkout/scenario.ts:17-18`) | |

**C. Page content unchanged (3 rows).** These recordings only extract, and an
extract step never clicks (`scenario-steps/extract-records.ts:38-43`). The page
is now reloaded, but it should look the same.

| Row | Workflow | Recording |
| --- | --- | --- |
| W04 | product-catalog | one extract (`product-catalog/manifest.ts:37`) |
| W05 | product-catalog `paginated-extraction` | one extract; the recording lane never follows pagination (`manifest.ts:58`) |
| W08 | data-table | one extract (`data-table/scenario.ts:30`) |

**No change for armed rows.** The 21 variant rows already got this load, and the
callback's body is unchanged for them.

## Not verified

- **The Lab proof. No Lab command was run.** A Lab run must show:
  - **W18 `lab run auth-gate --flow`, on a run whose proposal has all 3
    candidates.** B1 stops a short proposal at `recording.contract` before the
    Flow runs, so that outcome says nothing about F1 (`i-stage1-failures`, open
    question 3).
    - The Flow's first node runs on `/scenarios/auth-gate/`.
    - The `#password` type node does not fail `target_not_found` with
      "0 control(s) of the same family".
    - Any failure screenshot shows the sign-in form, not "Signed in as
      demo.user".
    - W18 passing 3 of 3 also needs `i-recording-loss`'s fix (the username
      entry) and W19's chain (the click's URL claim).
  - **Step 4b `basic-form --flow`** keeps 4 candidates and passes.
  - **W10 `navigation --flow`** starts on `/scenarios/navigation/start`.
  - **Re-measurement.** The 20 rows in groups A and B are re-measured. The three
    in group C, and every variant row, keep their previous results.
- **Group B's inferences.** Each rests on reading the fixture code, not on a run
  or a Stage 1 bundle. That includes the W07 uncheck, W09's descending sort, W13's
  missing button, W14's four sections and W27's missing target. I did not check
  whether any Stage 1 result for these rows is explained by the leftover page.
- **Which tab the Flow acts in.** The callback loads `page`, the first scenario
  tab (`run-scenario.ts:198`), exactly as the armed path always did. I did not
  check that the extension's active tab is that same tab for every fixture.
- **Faulty RAM.** Every run above passed or failed exactly as expected on its
  first attempt, so nothing needed a rerun. Each result is still a single
  observation.

## Open questions or contradictions found

1. **Stale wording outside my lines (not edited).** Each of these now describes
   only the armed half of what happens:
   - The `openScenarioStart` doc comment, `run-scenario.ts:597-615` ("the Flow
     lane's armed load", "The Flow lane's post-arm load").
   - `src/tests/scenario-assertions.test.ts` comments and assert messages
     (`:77-78`, `:83-86`, `:110`, `:116`), which say "armed load".
   - The plan document, line 745, which still quotes `armVariant`.

   Every assertion still holds, because the armed path is unchanged and the one
   Flow-lane load is still that call. A later documentation brief should own
   those lines.
2. **The name `arms-after-loading` is now slightly misleading.** `armingOf`
   returns it for every Flow-lane run, armed or not (`run-scenario.ts:636`), and
   the test-contracts doc describes it as "resets, arms and reloads". It stays
   correct because an unarmed schedule's `afterArm` is empty. No change is
   proposed.
3. **B1 still hides F1 for W18** whenever the username entry is lost (see Not
   verified).
