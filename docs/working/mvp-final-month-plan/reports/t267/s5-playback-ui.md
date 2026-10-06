# t267 S5 — playback steps and UI review port (part 1 of 3)

## Outcome

Done. Lane A's (t174) and lane C's (t194, w82) changes to `T/lab-runs/write-playback-steps.ts` and lane A's changes to `T/run-scenario/ui-review/**` are ported, together with lane C's wording change in `recorder.ts`. All 64 tests in `T/lab-runs/tests/` and `T/run-scenario/ui-review/tests/` pass, and the package check passes.

## What changed and why

The tree had no changes in either area since base `45bd6232`, so every lane hunk had the same context it was written against. I exported the lane diffs as LF and read each hunk before applying it.

### `T/lab-runs/write-playback-steps.ts` (both lanes, merged)
- **Lane A (ported):** the playback steps are numbered at their own time among Core's steps, by `numberInTimeOrder` (replaces `highestStep`). A Core folder that started after a playback step moves up: the folder is renamed and its `meta.json` `step` rewritten. Also added `readJson` and the `rename` import, and updated the header comment.
- **Lane C (ported):** a list read (`web.dom.extract_list`) writes its counts as `result.read` and adds them to the step's summary (`listRead`, `readSummary`, `ListRead`). The stop word comes from `RUN_EXTRACTION_PAGINATION_STOP`, which `@fluxiq-web-extension/test-contracts` exports from its root (`extraction-read/index.ts`). I confirmed that export exists in this tree. Lane C's header comment is included.
- **How they were merged:** lane A applied with `git apply`, then lane C with `git merge-file` against the base blob. Neither lane changed the other's hunks; the only clash was the adjacent import lines, which the 3-way merge resolved. Both lanes' code is kept and nothing was dropped.

### `T/lab-runs/tests/write-playback-steps.test.ts` (both lanes)
- Lane A's test "playback steps are numbered in time order..." and lane C's two tests ("a list read's step carries the read's counts...", "a step that is not a list read carries no read record") were all appended at the same spot. The 3-way merge flagged that as a conflict. I kept all three, and restored the closing `});` of lane A's test, which the merge had treated as a shared line.

### `T/run-scenario/ui-review/**` (lane A, all hunks ported)
- `choose-scenario-tab.ts`: reads every tab with `chrome.tabs.query({})` and returns `openTabs` (`OpenTab` type). When the browser's tabs cannot be read, it lists the context's pages with front `unknown`.
- `capture-scenario-tab.ts`: takes `openTabs` and records each tab's location, screened.
- `types.ts`: adds the `before-flow-run` label, `OverlaySample.navigationSuspected` and `documentError`, `OverlayChangeCounts.probablePageLoads`, and `UiReviewCapture.openTabs`.
- `count-overlay-changes.ts`: a failed read that names a document now counts as a page load. A window that ends in a navigation-shaped failure with nothing to settle it adds one `probablePageLoads`.
- `read-overlay-sample.ts`: split into `readOnce`. A failure shaped like a navigation is marked `navigationSuspected` and the tab's document is read again (`documentAfterFailure`). The overlay text is screened with `screenOverlayText`.
- New `screen-overlay-text.ts`: keeps a location or path the overlay names (origin and path only) and still screens secrets, codes and long opaque strings.
- `schedule.ts`: a Flow run's entry moment is labelled `before-flow-run`; its periodic moments stay `flow-run`.
- `index.ts`: exports `captureScenarioTab`, `chooseScenarioTab` and `OpenTab`, which the new test uses.
- `write-ui-review-sidecar.ts`: the note wording, plus `probablePageLoads` and `openTabs` in the summary.
- Tests: `count-overlay-changes.test.ts` (one shape updated, plus 2 new D13 tests), `read-overlay-sample.test.ts` (2 new D13 and D14 tests), `ui-review-schedule.test.ts` (expects `before-flow-run`), and the new `tests/choose-scenario-tab.test.ts` (3 tests). The two new files were copied from lane A after I read them, converted CRLF to LF, and needed no merging.
- `recorder.ts`: both lanes edit the same log line, so I merged it by hand. Lane A added `openTabs: chosen.openTabs` to the capture call, and appended the probable-page-load clause and the "N tab(s) open" count to the log. Lane C changed the wording "taken X-Y ms into the overlay window" to "taken from X ms to Y ms of the overlay window". The line now has lane A's additions with lane C's wording.

### Call-site note for `T/run-scenario.ts` (not edited)
- No change is needed for it to compile. `run-scenario.ts:328` still calls `uiReview.phase("flow-run")`, which is still a valid phase; only the moment's label changes, to `before-flow-run`. I found nothing outside `ui-review/` that reads the labels, `openTabs` or `probablePageLoads`.

## Commands run and observed results
- `node <scratchpad>/t267-s1/run-subset.mjs <pkg> t267-s5-ui <all 11 test files>` → **the bundle failed** on `Could not resolve "chromium-bidi/lib/cjs/bidiMapper/BidiMapper"` and `.../cdp/CdpConnection`, from `playwright-core/lib/server/bidi/bidiOverCdp.js`. Bundling each file on its own showed that all 4 `lab-runs/tests/*` fail, including 3 I did not touch; all 7 `ui-review/tests/*` bundled. So this comes from the bundler script meeting a runtime Playwright import, not from this port. As a workaround I used my own copy of the script, `scratchpad/t267-s5/run-subset-s5.mjs`, which is identical except that it adds `@playwright/test`, `playwright`, `playwright-core` and `playwright-core/*` to `external`.
- `node --test <11 printed paths>` (from `packages/test-runner`) → `# tests 64 # pass 64 # fail 0`. The ported tests, by name: ok 26 (time order), ok 27-28 (list read), ok 29-31 (open tabs), ok 46-47 (D13 counts), ok 55 (D13 re-read), ok 56 (D14 overlay text), ok 59 (schedule with `before-flow-run`).
- `pnpm.cmd --filter @fluxiq-web-extension/test-runner check` → printed no errors. It was not stamped because `packages/test-contracts` changed while it ran (another worker).
- I ran the check a second time with its output discarded, and it exited 2. A third run straight after, with my files unchanged, exited 0 and printed no tsc errors (`exit=0`). I believe the exit 2 came from another worker's edit in progress, but because its output was discarded, that is not confirmed.
- I deleted `packages/test-runner/.test-build-scratch/t267-s5-ui`.

## Not verified
- No live browser or Lab run. The `chrome.tabs.query({})` path, the navigation re-read and the renumbering of folders against a real Core steps directory were tested only with fakes.
- Whether the structure audit accepts the new `screen-overlay-text.ts`; I did not run it.
- Whether the exit 2 described above was really another worker's change.

## Open questions or contradictions found
- `t267-s1/run-subset.mjs` cannot bundle `lab-runs/tests/*` in this tree, because something those tests import reaches `playwright-core` at runtime. Later briefs that point at it for lab-runs tests should add Playwright to `external`, as `run-subset-s5.mjs` does.
