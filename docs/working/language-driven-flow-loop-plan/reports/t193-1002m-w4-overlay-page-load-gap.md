# t193-1002m-w4-overlay-page-load-gap: worker report

## Outcome

Done. The UI review now treats a single missing overlay sample at a page load as `pageLoads`. It does not count as flicker. Every other absence is counted exactly as before.

## What changed and why

What the sampler read before: `read-overlay-sample.ts` ran a main-world expression that returned `hostCount`, `document.visibilityState`, and the host's box, style and attributes. It also read the text through the closed shadow root over CDP. Nothing in a sample said which document it was read from, so a document swap could not be told apart from a real disappearance. In run-murwdp4f-35f976d2, moments 5, 6 and 8 each had exactly one sample with `present: false`, `hostCount: 0` and no error, inside an otherwise steady window. That one sample produced 2 presence toggles **and** 2 visibility toggles, and either pair alone gives `flickering`.

The rule (`count-overlay-changes.ts`, `isPageLoadGap`): a sample is a page load only when all of these hold:
- the sample is absent;
- the samples immediately before and after it in the raw window are both readable (no `error`) and present;
- both carry `documentOrigin`, and the two values differ.

Such a sample is counted in `pageLoads` and skipped, so it makes no presence toggle **and no visibility toggle**. The brief named only presence toggles, but the visibility toggles alone would have kept the status at `flickering`. Every other absence is counted as before:
- two or more absent samples;
- one absent sample inside a single document;
- one next to a failed read;
- one whose neighbours name no document.

Text changes, revisits and the status thresholds are unchanged. `pageLoads` does not push the status to `changed`.

Files (all under `packages/test-runner/src/run-scenario/ui-review/` unless noted):
- `types.ts`: `OverlaySample.documentOrigin?: number` and `OverlayChangeCounts.pageLoads`.
- `read-overlay-sample.ts`: the expression also returns `performance.timeOrigin`, which is kept when it is a finite number.
- `count-overlay-changes.ts`: the rule above.
- `recorder.ts`: the `[lab] ui review #N` line now ends `, N page load(s)`.
- `write-ui-review-sidecar.ts`: the summary row of each moment now includes `pageLoads`.
- `tests/count-overlay-changes.test.ts`: 5 new tests, and the existing deepEqual test now includes `pageLoads: 0`.
- `tests/read-overlay-sample.test.ts`: asserts that `documentOrigin` is read, for both a present host and an absent one.
- `docs/architecture/testing-facility.md`: new subsection "The UI review's overlay counts", added at the end of "Per-step logs and the central run folder". The file had no earlier lines about the UI review.

## Commands run and observed results

Failing first. I added the type field and a `pageLoads: 0` stub so the new tests would compile, then ran the build and `node --test dist/run-scenario/ui-review/tests/*.test.js`:
- Result: `# pass 19`, `# fail 4`.
- `not ok 8 - one absent sample between two documents is a page load, not flicker`: expected 1, actual 0.
- `not ok 12 - a revisit across a page load is still flickering`: expected 1, actual 0, on `pageLoads`.
- `not ok 13` and `not ok 15`: the read tests for `documentOrigin`.
- Passed already, as intended: test 9 (one gap in one document is still flickering), test 10 (a two-sample gap is still counted as toggles) and test 11 (a gap next to a failed read or a sample with no document is still counted).

After the fix:
- `pnpm run check` (test-runner): no tsc errors printed.
- `pnpm run build` (test-runner): succeeded.
- `node --test dist/run-scenario/ui-review/tests/*.test.js`: `# tests 23`, `# pass 23`, `# fail 0`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (159 warning(s), 118 baselined)`. All warnings are in files outside my scope.

Replay of the real sidecar through the built `countOverlayChanges`:
- Untagged, as recorded (no `documentOrigin`): moments 5, 6 and 8 still give `flickering`, 2 toggles, `pageLoads 0`. The fallback holds.
- With document origins added by hand (one before the gap, another after it): each gives `changed`, 0 presence toggles, 0 visibility toggles, `pageLoads 1`.

## Not verified

- No live run. I have not seen `performance.timeOrigin` read across a real navigation in the Lab. The absent sample may come from the old document, the new one or an intermediate one. The rule depends only on the neighbours, so this should not matter, but it has not been observed.
- If a read fails during the swap (for example "Execution context was destroyed"), the gap stays counted as before, by design. Such a moment would still read as `flickering` if it also had an absent sample.
- No full suites were run, per the brief.

## Open questions or contradictions found

- The brief said "do not count it as a presence toggle", but the recorded moments also had `visibilityToggles: 2`, which gives `flickering` by itself. I excluded the gap from visibility toggles as well. Without that the fix would not change any status.
- The brief pointed to existing UI-review lines in `testing-facility.md`, but there were none. I added a short subsection instead.
