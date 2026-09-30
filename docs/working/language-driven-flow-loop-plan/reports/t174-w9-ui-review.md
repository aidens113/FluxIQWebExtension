# t174-w9: a UI review for every Lab run

## Outcome

Done. Every Lab run now writes a local UI review. It holds PNGs of the scenario tab and the extension panel at `start`, during a build (`mid-build`), while a Flow runs (`flow-run`), at `end` and at a `failure`. At each of those moments it also samples the on-page activity overlay about every 200 ms for about 3 s. During a build or a Flow run it takes one more moment about every 20 s. No UI was changed.

Validated with a provider-free, headed, recording-lane run on crossborder-marketplace. The third run (`run-munnzfiz-58c009b1`) passed and captured all 4 PNGs. The first two runs found two defects in my own code, which I fixed (see below).

## How to find a run's UI review

Look beside the bundle in the runs directory, not inside it. For an instanced Lab run that directory is `test-runs/instances/<instance>/`.

- `<runId>.ui-review.local.json` holds:
  - `summary`: the moment count, pictures taken, which panel source was captured, and one overlay status line per moment;
  - `moments[]`: each with `label`, `phase`, `atMs`, `scenario` and `panel` capture records, and `overlay`, the sample window with every sample and its `counts`;
  - `skipped` (phases before the browser existed), `skippedTicks` and `failures`.
- `<runId>.ui-review.local/NN-<label>-scenario.png` and `NN-<label>-panel.png`.
- Each capture record says `file` (relative to the runs directory), or `withheld` (and why), or `error`. The scenario record also has `location` (origin and path), `inFront`, `frontTabs` and `documentVisibility`. The panel record has `source` (`side-panel (devtools target, type page)`, `popup`, `side-panel`, or `control-page` when neither was found) and `masked` (how many pairing-code regions were blacked out).
- Overlay `counts`: `samples`, `readFailures`, `presentSamples`, `visibleSamples`, `textChanges`, `presenceToggles`, `visibilityToggles`, `textRevisits` (A→B→A), `distinctTexts`, and `status`, which is one of:
  - `absent`;
  - `stable`;
  - `changed`;
  - `flickering`: any revisit, 2 or more toggles of either kind, or 3 or more text changes.
- Each sample holds:
  - `present` and `hostCount`;
  - `visible`: displayed, not hidden, opacity above 0.05, and a box inside the viewport;
  - `rect`, `display`, `visibility`, `opacity`, `inViewport`;
  - the host's attributes;
  - `textParts` read through the **closed** shadow root via CDP `DOM.describeNode({pierce:true})`, plus `phaseName` (the first part) and `step` (the `· x` part);
  - `documentVisibility`.
- The stderr log also has one line per moment: `[lab] ui review #N <label>: scenario …; panel (…) …; overlay <status>, v/n visible, k text change(s), p presence toggle(s)`.

Privacy and handling:
- Every string is screened with the run's secrets: `screenText` from the extension-start trace, and `redactText` for page paths.
- The JSON is asserted clean with `assertNoSensitiveText` before it is written. If the check fails, a `withheld: "redaction_failed"` stub is written instead.
- A scenario picture is withheld when a run secret appears in the page's text or in a non-password field value. The check runs in Node, so the secret never reaches the page. Nothing is injected into the scenario page, which may be the recorded tab: no mask, and `caret: "initial"`.
- The panel's `#pairingReferenceCode` is blacked out while it is rendered. A panel picture is withheld when:
  - the code appears elsewhere in the panel text;
  - a secret appears in it;
  - the code could not be masked.
- No cookies, headers or tokens are read.
- Nothing is written into the bundle's staging directory. The validation bundle's `artifact-index.json` has 0 matches for `ui-review`.

## What changed and why

New module `packages/test-runner/src/run-scenario/ui-review/`. Each file has one export. `index.ts` is the barrel and tests are in `tests/`.
- `recorder.ts`, `UiReviewRecorder`: the facade the spine uses. Its methods are `attach`, `phase` (non-blocking), `finish` (awaited terminal moment) and `close` (stop, wait, write the JSON). None of them throws.
- `schedule.ts`, `UiReviewSchedule`: one moment per phase, in order.
  - During `build` or `flow-run`, one more moment every 20 s. A tick that finds a moment in flight is skipped and counted.
  - Periodic moments are capped at 60.
  - Nothing is taken after `end` or `failure`.
- `sample-overlay-window.ts`: 200 ms reads for 3 s (16 samples), scheduled from the window's start. `read-overlay-sample.ts` does one read. `count-overlay-changes.ts` does the counting.
- `choose-scenario-tab.ts`: picks the web tab the browser has in front, from the extension's read-only `chrome.tabs.query({active:true})`, preferring the run's own tab.
- `capture-scenario-tab.ts` and `capture-extension-panel.ts` capture the pictures. `panel-target-session.ts` runs a non-flattened CDP session on the side-panel target, which Playwright does not expose as a page.
- `review-paths.ts`, `write-ui-review-sidecar.ts`, `screen-location.ts`, `with-timeout.ts`, `types.ts`.

Hooks in `run-scenario.ts`. The file stays at 706 lines: every change edits an existing line or extends one.
- The import on line 68 gains `UiReviewRecorder`.
- Line 141 constructs the recorder.
- Line 274 calls `attach` after `bringToFront`.
- Line 305, in `prepareFlowPage`, calls `phase("flow-run")` unless `moment === "build"`.
- Line 332 calls `phase("start")` after pairing and `activateScenarioTab`, which comes after the live panel.
- Lines 374 and 474 call `phase("build")` at the created-lane and recorded-Flow-lane dispatch.
- Line 499 calls `finish("end")`.
- Line 517 calls `finish("failure")`.
- Line 542 calls `close()` before `context.close()`.

`run-scenario/index.ts` re-exports the new barrel.

Defects found by the Lab runs and fixed:
1. Run 1 (`run-munnkaw7-35695cdd`) photographed the context's initial `about:blank` tab. That tab also reports `visibilityState: "visible"`, so visibility cannot choose the tab. The chooser now uses the extension's active-tab list.
2. Run 1 withheld both panel pictures: "pairing code shown and could not be masked". The pairing card stays in the DOM, hidden, after pairing. The code now counts as shown only when its element has a rendered box.
3. Run 2 (`run-munnt88j-3850c0a9`) screened the fixture path to `[long]`. Paths now use `redactText` rather than `screenText`.
4. Playwright's multi-line call logs, with ANSI codes, are cut to their first line.

## Commands run and observed results

- `bash heavy.sh "t174 w9 test-runner build" pnpm --filter @fluxiq-web-extension/test-runner build`: exit 0, no tsc errors on the final tree. One intermediate build failed on my own broken `sed` edit, which I repaired.
- `node --test --test-concurrency=2 "dist/run-scenario/ui-review/tests/*.test.js"`: `# tests 18 # pass 18 # fail 0`. The tests cover:
  - change counting: stable, absent, changed, A/B flicker, presence and visibility toggles, failed reads skipped;
  - window timing;
  - the shadow-root read and screening;
  - the schedule: order, the periodic ticks, the timer replaced on phase change, skipped ticks, terminal phases, the cap, a failure kept;
  - the sidecar paths and withholding.
- `node scripts/structure-audit.mjs` (DS): `structure-audit: passed (123 warning(s), 120 baselined)`. The first run failed `[naming]` on 4 files sharing the prefix "ui-", so I renamed them.
- The source-pinning suites (`runner-wiring`, `single-run-evaluation`, `lane-observation`, `launch-containment`, `coordinator-existing`, `scenario-assertions`): 60 tests, 59 pass. The one failure is `runner-wiring` "the redaction attestation scans once Core has stopped…". Its assertion is on the persistent-isolated workspace bound (redaction lines ~609-612), which I did not touch. It is the stale pin w6 and w7 already reported.
- Lab. Slot-1 was claimed with owner `t174-w9 ui-review provider-free lab run crossborder-marketplace 2026-09-30T05:14:27Z` and released afterwards. The runs went one at a time, each as `FLUXIQ_LAB_INSTANCE=t174-w9 bash heavy.sh "t174 w9 lab run N" pnpm lab run crossborder-marketplace`: headed, recording lane, no `--live-llm`. Live panel: `side-panel (verified open)` in all three runs.
  - Run 1 `run-munnkaw7-35695cdd`: passed. Defects 1 and 2 above.
  - Run 2 `run-munnt88j-3850c0a9`: passed. 3 PNGs; the end scenario shot timed out after 4000 ms (cause unrecorded then, see below).
  - Run 3 `run-munnzfiz-58c009b1`: **passed**, 2 moments, 4 PNGs, under `test-runs/instances/t174-w9/run-munnzfiz-58c009b1.ui-review.local/`:
    - `01-start-scenario.png`: 60 KB, at `/scenarios/crossborder-marketplace/`, inFront true;
    - `01-start-panel.png`: 32 KB, source `side-panel (devtools target, type page)`, masked 0;
    - `02-end-scenario.png`: 66 KB, at `/scenarios/crossborder-marketplace/item/1005008123450`, inFront true;
    - `02-end-panel.png`: 29 KB.
  - I opened three PNGs with Read:
    - the start scenario shows the farbazaar home page with its cookie banner;
    - the start panel shows the real side panel: "Connected to FluxIQ", "Get set up", "RIGHT NOW Nothing running", "What should FluxIQ do?";
    - the end scenario shows the item page with quantity 3 and a "Never miss a price drop" prompt.
  - **Overlay counts (run 3):** start `absent`, 16 samples, 0 present, 0 visible, 0 text changes, 0 presence toggles, 0 read failures. End: the same, `absent`, 16/16 samples with 0 present. Runs 1 and 2 recorded the same (absent, 16 samples each).

## Not verified

- **A build or Flow-run moment, and the periodic 20 s schedule, in a live browser.** The recording lane has no build or Flow run, so only `start` and `end` fired live. The schedule is unit-tested only. The first `--live-llm` or `--flow` run is where `mid-build` and `flow-run` moments first appear.
- **The overlay on a page where FluxIQ acts.** In the recording lane `<fluxiq-activity-overlay>` was never present (0 of 64 samples across runs 2 and 3). That is plausible, since the Lab drives the page and FluxIQ is not acting, but it proves nothing about visibility or flicker during a build. The shadow-root text read has been exercised against a fake DevTools tree only, never against a real overlay.
- **Why run 2's end screenshot timed out.** Run 2 recorded no `inFront` field. Run 3 records it, and its end tab was in front and captured in 117 ms. If this recurs, `inFront: false` and `frontTabs` will say which tab was in front.
- **Pairing-code masking with the code on screen.** In every moment the code was not rendered (`masked: 0`). The mask paths, CDP `MASK_ON`/`MASK_OFF` and Playwright `mask`, have not been exercised live.
- **The popup and control-page fallbacks.** The side panel opened every time.
- **The `failure` moment in a live run.** All three runs passed.
- **Flicker faster than the 200 ms sampling.** It is not observable by design; a DOM mutation observer through CDP would be the next step if one is needed.
- **The whole DS `pnpm check`, `pnpm test` and `pnpm build`.** Not run. Only the test-runner build, the ui-review tests, the six source-pinning test files and the structure audit ran.

## Open questions or contradictions found

1. **Lab slots.** When I claimed slot-1, `slot-2`, `slot-3` and `slot-4` were held by t193, t194 and t195, and `slot-2` and `slot-4` were still held at release. The Current State says only slot-1 and slot-2 exist.
2. **heavy.sh took b2, then "b3", while I held slot-1.** Its own rule uses b2 only while slot-1 is absent, and "b3" is not a slot heavy.sh knows about in the copy I read. Someone may have changed heavy.sh or the build-slots directory mid-session. I did not touch either.
3. **The overlay never appeared** during a paired, recording-lane run while the panel said "Nothing running". If the user expects the overlay during Lab-driven recording, that belongs to t191's scope. I only measured it.
4. Scratch and outputs: logs `t174w9-lab-run*.log`, the original `run-scenario.ts` copy and two edit scripts in the session scratchpad; bundles and reviews under `test-runs/instances/t174-w9/`; instance builds under `.lab-instances/t174-w9/`. All git-ignored.
