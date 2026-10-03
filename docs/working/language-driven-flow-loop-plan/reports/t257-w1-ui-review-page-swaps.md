# t257-w1: UI review, page changes with the overlay present, and when each picture was taken

## Outcome

Done. Both instrumentation gaps marked UI in the debug's table (`run-murzln6g-11debe1d.md` l.539-540) are closed. Item 1 was proved offline against the run's real samples. Item 2 is covered by unit tests only, because the old run never recorded when its pictures were taken.

## What changed and why

All paths are under `packages/test-runner/src/run-scenario/ui-review/` unless stated otherwise.

1. **Every document change is a page load** (`count-overlay-changes.ts`, `types.ts`).
   - Cause: `pageLoads` was incremented only inside `isPageLoadGap`, which needs an absent sample between two present samples from different documents. Moment 6 changed `documentOrigin` at sample 12 with the overlay present in all 16 samples, so the counter skipped it.
   - Fix: `pageLoads` now counts each change of `documentOrigin` between consecutive readable samples that name a document. Failed reads, and samples with no origin, are skipped.
   - The old gap-excusing count is kept as a new additive field, `pageLoadGaps`. It still suppresses toggles exactly as before, so toggles and status are unchanged.
   - No existing field was renamed or removed. `pageLoads` is broader than before, which is what the brief asked for.
2. **Each sample carries its page URL** (`read-overlay-sample.ts`, `types.ts`).
   - The main-world read now returns `location.href`. It is kept as `OverlaySample.pageUrl`, screened by `screenLocation` (origin and path with secrets redacted, never the query or fragment), the same as the window's `pageUrl` and the capture's `location`.
   - It is also present when the overlay is absent. It is absent on a failed read.
3. **Each picture is placed among the samples** (new `place-capture-in-window.ts`, `recorder.ts`, `types.ts`, barrel `index.ts`).
   - Cause: the recorder runs the captures and the sampler concurrently but kept only the capture's duration (`ms`). Nothing said where a picture fell among the samples. In moment 2 the overlay was absent for samples 0-6 (0-1206 ms) and present from 1411 ms; the picture was probably taken in the absent stretch, but nothing recorded it.
   - Fix: the recorder times each capture (scenario and panel) and adds three optional fields to `UiReviewCapture`:
     - `takenAt`: ISO time.
     - `windowMs {from,to}`: the span on the overlay window's clock, measured from `overlay.startedAt`, negative before the first read.
     - `overlaySamples {lastBefore, firstAfter}`: sample indices.
   - The `[lab] ui review` line now prints the scenario picture's window span and `N page load(s), M of them with the overlay gone`.
4. **Sidecar summary** (`write-ui-review-sidecar.ts`): each `summary.overlay[]` entry gains `pageLoadGaps`. Every existing field is unchanged.
5. **Docs**: in `docs/architecture/testing-facility.md`, the section "The UI review's overlay counts" now describes the new `pageLoads` meaning, `pageLoadGaps`, the per-sample `pageUrl`, and the picture timing fields.
6. **Tests** (`ui-review/tests/`):
   - `count-overlay-changes.test.ts`: existing assertions updated to the new meaning, plus `pageLoadGaps` assertions. One case mirrors moment 6 (16 present samples across two origins, expecting 1 load, 0 gaps, `stable`), and one case covers multiple swaps with a failed read and an unnamed sample between them.
   - `read-overlay-sample.test.ts`: `pageUrl` is screened, has no query or fragment, and is kept when the overlay is absent.
   - New `place-capture-in-window.test.ts`.
   - `write-ui-review-sidecar.test.ts`: the summary carries `pageLoads` and `pageLoadGaps`.

No other reader in test-runner consumes these counts (grep for `pageLoads|presenceToggles|documentOrigin|ui-review.local` outside `ui-review/` found only the docs).

## Commands run and observed results

- `bash .../heavy.sh "t257 test-runner check" pnpm --filter @fluxiq-web-extension/test-runner check`: `test-runner:check` built, and tsc printed no errors.
- `bash .../heavy.sh "t257 test-runner build" node ../../scripts/build-cache/cli.mjs test-runner:build`: exit 0.
- `node --test dist/run-scenario/ui-review/tests/*.test.js` (in `packages/test-runner`): `tests 29, pass 29, fail 0`.
- Offline proof: the built `countOverlayChanges` recounted every moment of `fxwork/t193/!FluxIQWebExtension/test-runs/instances/t193-slot-2/run-murzln6g-11debe1d.ui-review.local.json`. The brief's `lab-runs/2026-10-02/run-murzln6g-11debe1d/` holds no ui-review files; they are in the t193 lane tree.
  - Moment 6: recorded `pageLoads 0`, now `pageLoads 1, gaps 0, status stable`.
  - Moment 1: recorded 0, now `pageLoads 1` (another swap the old counter missed; the overlay was absent throughout).
  - Moments 2-5 and 7-9: `pageLoads 0`.
  - All nine statuses are unchanged.
- `bash .../heavy.sh "t257 structure audit" node scripts/structure-audit.mjs`: `structure-audit: passed (162 warning(s), 118 baselined)`, exit 0. All warnings are pre-existing file-length advisories in other files.

## Not verified

- Live behaviour: no Lab run, per the brief. Nothing has yet confirmed in a real run that `location.href` is read, or that the picture spans come out as expected.
- Moment 2 could not be re-placed offline: the old JSON has no capture start time, only `ms: 135` and the moment's end time. The new fields would have answered it; only the unit tests cover them.
- The full `pnpm test` of test-runner was not run, and no full suite was run. Only the ui-review tests ran.

## Open questions or contradictions found

- The brief locates the ui-review files under `lab-runs/2026-10-02/run-murzln6g-11debe1d/`. They are actually under `fxwork/t193/!FluxIQWebExtension/test-runs/instances/t193-slot-2/` (the debug's `UI/` path). The Lab's published run folder does not copy the ui-review files.
- `pageLoads` changed meaning (broader). A reader comparing old runs' `pageLoads` with new ones should know that the old value equals today's `pageLoadGaps`.
