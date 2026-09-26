# t128 — The 60-second tail is two screenshots of a tab that cannot be photographed

## Outcome

Done. The 60.0 s is not one wait; it is **two** waits of 30.0 s each, both of
them `page.screenshot()` against a backgrounded Chromium tab, both expiring on
Playwright's own default timeout. It is not a recording wait, it is not
`finalized-recording.ts`, and it is not in FluxIQ Core. The removal is in this
repository and is unit-tested.

## The constant

    DEFAULT_TIMEOUT = 30000

`node_modules/.pnpm/playwright-core@1.51.1/node_modules/playwright-core/lib/client/timeoutSettings.js:25`
(and the identical `server/timeoutSettings.js:26`).

`page.screenshot()` takes no `timeout` at either call site, and nothing in
`packages/test-runner/src/` ever calls `setDefaultTimeout` or
`setDefaultNavigationTimeout` — verified by grep, zero hits. So every screenshot
that cannot complete costs exactly 30 000 ms before it throws. Two of them is
the tail, to the tenth of a second, twice.

`finalized-recording.ts`'s `DEFAULT_TIMEOUT_MS = 90_000` is **not** on this path.
`awaitFinalizedRecording` is called only from `flow-lane/run-flow-lane.ts:141`,
the recorded-Flow lane. These runs are the created-Flow lane
(`flow-lane/creation/lane.ts`), which never calls it. The brief was right to say
"do not assume it".

## The call path

The lane's own work finishes at the repair settlement and the failure is thrown
almost immediately after it:

1. `flow-lane/creation/lane.ts:308` — `await input.settleRun(run.runId)`.
   `live-llm/live-llm-run.ts:368 settleRepair` writes
   `snapshots/live-llm.json`, then calls `publish`, which is
   `capture.trigger(...)` for the `runtime.settle` event.
2. `lane.ts:311-313` — `judgeCreatedFlowDataset`, `createdFlowDatasetHolds`,
   `flowLaneObservation`. All synchronous; no `await` on any of them.
3. `lane.ts:322` — `recordEvidence`, which writes `snapshots/flow-lane.json`
   and `snapshots/extraction-mismatches.json`. Two small file writes.
4. `lane.ts:332` — `assertFlowFailure` throws
   `"The Flow reported an unexpected output_not_observed failure"`
   (`flow-lane/expectations.ts:51`).

Then, and this is where the hour goes:

5. `run-scenario.ts:504` — the scenario catch builds `failureEvent`.
   **`event()` at `run-scenario.ts:797` attaches no timestamp.** The timestamp is
   stamped later by `bundle.appendEvent`. That is why the cost shows up as a gap
   *before* the error event rather than after it.
6. `run-scenario.ts:519` (as it was) —
   `await failurePage.screenshot({ type: "png" }).catch(() => undefined)`.
   **30.0 s**, then `undefined`.
7. `run-scenario.ts:525` — `await capture.trigger(failureEvent)` →
   `EvidenceCaptureController.trigger` (`packages/test-evidence/src/capture.ts:33`)
   → `screenshotAdapter.capture(input)` → `shown.screenshot({ type: "png" })` on
   **the same page, chosen by the same rule** (`stepRunner?.activePage() ??
   scenarioPage`). **30.0 s**, then `undefined` → `suppressed:
   "capture-unavailable"`.
8. `bundle.appendEvent` stamps the timestamp and the `error` event lands.

30.0 + 30.0 = **60.0 s**.

## Why the screenshot never completes

A screenshot is `Page.captureScreenshot` over CDP
(`playwright-core/lib/server/chromium/crPage.js:216 takeScreenshot`). The Lab
runs **headed** — `run-scenario.ts:680`,
`chromium.launchPersistentContext(..., { headless: false, ... })` — and a headed
Chromium does not composite a tab that is not in front, so the command never
answers. Playwright's screenshotter does not raise the tab first: grep for
`bringToFront` in `playwright-core/lib/server/screenshotter.js` returns nothing.
The attempt therefore runs to `DEFAULT_TIMEOUT` and throws.

The created-Flow lane makes that the ordinary case:

- `run-scenario.ts:264` does `await page.bringToFront()` once, at the start. That
  is why the very first event of both runs carries a real photograph
  (`screenshots/00001-936ae9ed1074.png`) and every later one does not.
- A task whose Flow must reach its own page has the harness blank its tab before
  the build and again before playback — `run-scenario.ts:293`,
  `for (const open of [page, ...]) await open.goto(BLANK_TAB_URL)`, governed by
  `lane-rules/flow-start-page.ts`. FluxIQ then drives a tab of its own, which
  takes the front.
- `scenarioPage` is never reassigned in this lane: it is set at
  `run-scenario.ts:262` and only `checkFinalState` would move it, which a
  dataset-judged task (`judgeBy: "expected-dataset"`) never calls. `stepRunner`
  is only built in the recording lane, so it is `undefined` here.

From the first blanking onward, every capture photographs an abandoned
`about:blank` in the background, and none of them can ever succeed.

## The arithmetic

`test-runs/run-muhnh0s5-98a27f42`, `startedAt 2026-09-26T00:27:10.521Z`,
`finishedAt 00:34:27.753Z` = 437.2 s. Bundle file mtimes, relative to
`startedAt`, pin the window better than the events do:

| at | what |
| --- | --- |
| 38.1 s | `screenshots/00001-...png` — the one capture that succeeded |
| 331.2 s | last Flow action ends (`extract_list`, 330.2 s + 1.025 s) |
| 346.6 s | `snapshots/live-llm.json` — `settleRepair` writes its snapshot |
| **376.6 s** | `runtime.settle` "repair attempt finished" published — **30.0 s after the write**, all of it inside `capture.trigger` |
| 376.6 s | `snapshots/flow-lane.json`, `snapshots/extraction-mismatches.json` — `recordEvidence`, same instant |
| **436.6 s** | `events.ndjson` gains the `error` event — **60.0 s later** |
| 437.2 s | `finishedAt` |

`test-runs/run-muher0en-508ddb69` repeats it exactly: `live-llm.json` 859.0 s →
settle event 889.0 s = **30.0 s**; `flow-lane.json` 889.0 s → error event
949.1 s = **60.1 s**.

So each run paid **four** 30 s timeouts, not two: the build settlement, the
repair settlement, the failure screenshot, and the error event's own capture.
All four are recorded in `events.ndjson` as `capture-unavailable`. That is
**120 s of 437 s — 27% of the run** — spent learning four times that a blank
background tab cannot be photographed.

Only three of the four are individually measurable from the bundle: the
build-settlement one is inferred, because `live-llm.json` is overwritten by the
later settlement and its earlier mtime is gone. The mechanism, the page and the
`capture-unavailable` marker are identical.

## What changed

New focused module, `packages/test-runner/src/evidence-capture/`
(`page-screenshot-adapter.ts`, `index.ts`, `tests/`), holding the capture rule
that was previously an inline object literal in `run-scenario.ts` plus a copy of
the same page-choice rule written out again in the failure path.

`createPageScreenshotAdapter(shownPage)` **latches**. The first attempt on a page
is made in full and waited for, because a capture that can succeed must be. Its
failure is then the proof that this page, as it now stands, cannot be
photographed, and every later request for the same page object at the same
address is answered from that proof instead of paying 30 000 ms to be told the
same thing. A page that navigates, a different page, or a capture that succeeds
re-arms it.

This is deliberately **not** a shorter timeout. No number was reduced and no
capture that could have arrived is skipped. What is removed is the second, third
and fourth wait for evidence the first wait already established cannot come.

`run-scenario.ts` now uses that one adapter for both the event captures and the
failure screenshot (previously two independent code paths that photographed the
same page with the same rule), so the failure path asks the question once.

Expected effect on a run of this shape: one 30 s attempt instead of four, so
**90 s off a 437 s run (~21%)**, and the 60 s tail goes to roughly zero. Nothing
that used to be photographed stops being photographed: the only successful
capture in either run is the first event, which precedes every failure and so
can never be latched.

Incidental: `run-scenario.ts` lost one `catch(() => undefined)`, so its
`failure-as-empty` baseline entry can drop 4 → 3. I did not run
`pnpm structure:baseline`, because that command also regenerates
`docs/working/README.md`, a shared document I must not edit.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/test-runner check` — passed, no
  diagnostics printed.
- `pnpm --filter @fluxiq-web-extension/test-runner build` — passed.
- `node --test "packages/test-runner/dist/evidence-capture/tests/*.test.js"
  "packages/test-runner/dist/evidence-policy/tests/*.test.js"` →
  `# tests 9 # pass 9 # fail 0`.
- `node --test "packages/test-runner/dist/tests/*.test.js"` →
  `# tests 325 # pass 325 # fail 0` (11.6 s). This is the test directory that
  owns `run-scenario.ts`.
- `pnpm --filter @fluxiq-web-extension/test-evidence test` →
  `# tests 17 # pass 17 # fail 0`. The capture controller the adapter plugs into.
- **Regression proof.** I patched the *built* adapter to throw the latch away
  (`unphotographable = undefined`) and re-ran the new tests:
  `not ok 3 - a page that could not be photographed is not waited for a second time`
  / `only the first capture of an unphotographable page is waited for`, and
  `not ok 4 - a page that navigates is attempted again, and so is a different page`,
  `# fail 2`. Restored, re-ran: `# tests 5 # pass 5 # fail 0`. The tests measure
  the thing, rather than merely passing.
- `node scripts/structure-audit.mjs` — my two new findings
  (`failure-as-empty` on the new file, `file-lines` on `run-scenario.ts` at 807)
  are both fixed; `run-scenario.ts` is back to 800. One violation remains:
  `[working-docs] docs/working/README.md is out of date`. **Pre-existing and not
  mine** — it failed on the first audit run, before I had touched anything
  outside `packages/test-runner/`, and `git diff --stat HEAD -- docs/` is empty.
  The supervisor's `pnpm structure:baseline` clears it.

## Not verified

- **No live run.** I could not run `pnpm lab:campaign`, so the 90 s saving is
  arithmetic from bundle mtimes plus the mechanism, not a measured before/after.
- The build-settlement timeout is **inferred**, not measured — its `live-llm.json`
  mtime was overwritten by the later settlement.
- That the latch fires in a real run depends on the page object and its address
  being identical across captures, which the unit tests assert about the latch
  logic but cannot assert about a live Playwright `Page`. If FluxIQ navigates the
  harness tab between captures, that capture is attempted again — correctly, but
  it would cost 30 s again.
- I did not run `pnpm check`, `pnpm test` or `pnpm build` repository-wide:
  another worker is concurrently editing `apps/extension/src` and `domain/src`
  (visible in `git status`), and a repository-wide run would report their
  in-flight tree, not mine.

## Open questions, and the finding under the finding

**The created-Flow lane captures no visual evidence at all after its first
event.** That is the more serious half of this. Every `runtime.settle` and every
`error` in both runs is `capture-unavailable`, because the page the capture rule
names is the harness's abandoned `about:blank` and not the tab FluxIQ is
actually driving. A run that fails on `output_not_observed` therefore has no
picture of the page it failed on — which is exactly the picture a diagnosis
wants. My change makes that cheap instead of expensive; it does not make it
*present*.

Two ways to make it present, neither safe to do blind:

1. Photograph the tab the Flow drove — the last page in `context.pages()` whose
   URL is a scenario URL — rather than the harness's tab. Cheap and correct-
   looking, but it is inference about which tab matters and needs a live run.
2. `bringToFront()` before capturing. It would certainly work. It also steals
   focus from the tab FluxIQ is driving in the middle of a run, and a
   visibility change can alter page behaviour, so this must not go on the
   automation's critical path without evidence.

Also worth a later, separate change: `capture-unavailable` says nothing about
*why*. Had the bundle recorded `Timeout 30000ms exceeded` the first time, this
task would have been ten minutes rather than an investigation. The adapter now
distinguishes "no attempt" from "attempt failed" internally; publishing the
reason needs one widened field in `packages/test-evidence/src/types.ts`.
