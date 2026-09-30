# t195-w13: corner probes and walls over a missing target

## Outcome

Done. R1: the interference probe now covers the four viewport corners, and can take the blocked point when a caller has it. R2(B): the recovery loop now clears a covering layer on `target_absent`, but only when a layer it is allowed to clear is standing over the page. Both are tested in the owning `tests/` folders, and I checked that each test fails without its change. No browser or Lab run was made.

## What changed and why

All paths are under `apps/extension/src/content/action-runtime/`.

- **`interference/probe-points.ts` (new).** Pure `probePoints(width, height, blockedAt?)`.
  - The seven old points are kept in the same order.
  - Four corners are added, inset 6% from each edge: (0.94,0.94), (0.06,0.94), (0.94,0.06), (0.06,0.06). Bottom-right comes first.
  - `blockedAt` is probed first when it is given and lies inside the viewport. It is floored and deduplicated.
  - At most 12 points; a viewport with no area gets none.
  - Checked against bigbox's card (`scenarios/bigbox-retail/shell/support-chat.ts`: 360x210, 16 px from right and bottom). The (0.94,0.94) point lands inside it at 800x600, 1024x768, 1280x720, 1366x768, 1440x900 and 1920x1080. None of the old seven did.
- **`interference/overlays.ts`.** `overlaysOverPage(blockedAt?)` now iterates `probePoints(...)`. The inline `PROBE_FRACTIONS` list is gone and the file comment is updated. How a layer is classified is unchanged: `coveringDialog`, `way-out.ts` and the consent and rate-limit rules are not touched.
- **`interference/pressable-way-out.ts` (new).** `pressableWayOut(overlay)` combines guard 1 (a `challengeIn(overlay, "dialog")` layer gets `undefined`) with `dismissControlIn`. `clear.ts` and `presence.ts` both use this one rule, so the layer that gets pressed and the layer whose presence triggers clearing cannot drift apart.
- **`interference/clear.ts`.** Uses `pressableWayOut` in place of the inline challenge check plus `dismissControlIn`. Behaviour is the same.
- **`interference/presence.ts` (new).** `clearableLayerOverPage()` asks whether any painted modal or probed layer has a pressable way out. It never throws, and in Node, with no `document`, it returns false.
- **`interference/index.ts`.** Exports `clearableLayerOverPage`; the header comment is updated.
- **`recovery/fault.ts`.** New `faultMayHideBehindLayer(fault)`, true only for `target_absent`. `faultNeedsInterference` is unchanged, so `budget.ts` keeps the target ladder (250/500/1000/2000 ms) for a missing target inside the same 5 s budget.
- **`recovery/attempt.ts`.** New optional 7th parameter `layerOverPage: RecoveryLayerProbe = clearableLayerOverPage`. It is called only when the fault is `target_absent`, and then the existing `intervene(fault)` runs only if it returns true, before the pause, the same way it runs for obstructions. The only caller is `actions/execute.ts`, which passes 3 arguments and needs no change.
- **`recovery/index.ts`.** Exports `faultMayHideBehindLayer` and the `RecoveryLayerProbe` type.
- **Tests.**
  - `interference/tests/probe-points.test.ts` (new, 8 tests): corners and inset; the bigbox card across 6 viewports, which also asserts that the old seven points missed it; the old order kept first; the bound of 11 or 12 points; the blocked point probed first, deduplicated, and ignored when out of range; a viewport with no area.
  - `recovery/tests/attempt.test.ts`:
    - The existing "nothing pressed for a fault pressing cannot help" test now injects an explicit false probe.
    - Added 5 tests: no probe is asked for any non-`target_absent` fault; a wall is cleared once and the target is then found on the target ladder, pausing `[250, 500]` with `dismissed: 1`; the order is attempt, probe, clear, pause 250, attempt; with no clearable layer nothing is pressed and the probe is asked 4 times; a wall that will not clear leaves the ladder and budget unchanged.
    - The file is 397 lines, under the 400-line advisory.

## Commands run and observed results

- `EXTENSION_TEST_BUILD_LABEL=t195w13 bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w13 ext" node apps/extension/scripts/test-extension.mjs`, run twice:
  - **First run:** exit 1, `# tests 1465 # pass 1455 # fail 10`. All 10 failures were in `content/actions/tests/click.test` with `ReferenceError: press is not defined` at `content/actions/click.ts:101`. That file is w12's and was being edited at the time.
  - **Final state:** exit 1, `# tests 1500 # pass 1499 # fail 1`. The one failure is `content/action-runtime/ignored-press/tests/page-press-listener.test` "without a PerformanceObserver the timeline itself is read" (expected `['request']`, got `[]`). That directory is w12's and untracked.
  - Every test in my files passed in both runs: probe-points 1-8, attempt rows including the 5 new ones.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t195 w13 tsc" npx tsc -p apps/extension/tsconfig.json --noEmit`: printed `[heavy] t195 w13 tsc holds b3` and no diagnostics; exit 0. Run twice, including on the final state.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (129 warning(s), 120 baselined).` It was 128 before my edits. No warning names `interference/` or `recovery/`, and the new one is not in my paths.
- **Mutation check.** A throwaway esbuild script bundled only my two test files, with the source reverted in memory by an `onLoad` plugin. Nothing on disk changed, and the script and its output were deleted afterwards. Results:
  - Recovery condition reverted to `if (faultNeedsInterference(fault))`: the wall rows 20, 21 and 22 fail.
  - Corner fractions removed: probe rows 24, 25, 27, 29 and 30 fail.
  - Totals: `# pass 23 # fail 8`. With the real source: `# pass 31 # fail 0`.

## Not verified

- No live DOM run, per the user rule; the lead runs the ten scenarios. So these are unconfirmed in a real browser:
  - that `deepElementFromPoint` at (0.94,0.94) actually reaches bigbox's card inside `<vr-assist>`'s shadow root;
  - that `outermostFixed` then returns the card and `×` is pressed;
  - that the company-website wall's "Reject non-essential" is pressed on `target_absent`.
- `clearableLayerOverPage` has no unit test, because it needs a DOM and none is installed.
- **Timing on company-website.** The offer opens about 4 s after consent is answered. Clearing on the first retry leaves about 3.75 s of target ladder, so the in-page loop will probably still give up just before the offer appears. The gain is that the wall is gone, so Core's node retry (`retry_node`) should find the offer. I did not lengthen the ladder or budget, per the brief.

## Open questions or contradictions found

- **"any point the blocked target itself sits at when known."** `overlaysOverPage` and `probePoints` accept `blockedAt`, but the recovery loop never has it. The point is `ActionResultEvidence.blockedAt` in `results.ts`, and it is consumed in the page before a `BrowserActionResult` exists. Handing it to `intervene` would need `results.ts` or `actions/execute.ts`, and both are outside my paths (w12's or `actions/**`). The corners cover bigbox's card without it.
- The brief cites the old path `recovery/fault.ts:176-178`. That is `faultNeedsInterference`, which I left unchanged; the new rule sits beside it as `faultMayHideBehindLayer`.
