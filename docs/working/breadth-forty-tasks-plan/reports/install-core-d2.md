# install-core-d2 (task t707, round 3): covered refusal on a target whose centre alone is overlapped

## Outcome

Done. The actionability gate now probes further points inside the target's visible box when its centre does not land on the target. It accepts the first point that does, and every verb dispatches at that point. It refuses as `covered` only when no probed point reaches the target, and the refusal keeps naming what covers the centre.

## What changed and why

**Cause confirmed in code.** `apps/extension/src/content/action-runtime/actionability.ts` (before the change, lines 54-70) hit-tested only the viewport-clamped centre (`hitPoint`). On a miss it returned `covered` at once, with no other point tried. That is exactly the live D2 refusal ("the point 220,451 landed on p.css-1y6w9q1, which covers the target").

**How the point reaches dispatch (traced, nothing changed there).**
- `actions/click.ts` passes `report.point` from `checkActionability` to `press(element, report.point, ...)`, which calls `dispatchClickGesture(element, point, ...)` (click.ts about line 337).
- The navigating-link branch calls `dispatchClickGesture(element, report.point, ...)` directly.
- The press made once more reuses the first report's `report.point`.
- `actions/check.ts` passes `report.point` to `setCheckedState`.
- `dispatchClickGesture` (`action-runtime/click-gesture.ts`) sets `clientX`/`clientY` from that point on every pointer and mouse event.

So returning the probed point as `report.point` is enough for the press to go to that same point. Covered refusals still carry the centre as `point`, which the callers pass on as `blockedAt` for the recovery's layer reading, so that is unchanged.

**Changes.**
- `apps/extension/src/content/action-runtime/actionability.ts`:
  - `hitPoint` is replaced by `visibleArea` (the same viewport clamp) plus `centreOf`.
  - The centre is tried first. A hit on the target or inside it returns exactly as before: same point, same words.
  - On a miss, `pointReachingTarget` lays `probePoints(width, height)` from `interference/probe-points.ts` over the visible box, offsets each point by the box's left and top, skips the centre, and returns the first point whose deep hit is the target or inside it. That is at most 11 extra hit tests, and only for a target whose centre missed.
  - An accepted point's detail is `the point X,Y landed on the target; its centre CX,CY landed on <label>`, or `nothing painted` when nothing was hit at the centre.
  - The refusal text, its layer sentence and its point are unchanged, and computed at the centre.
  - The hidden, disabled, inert and viewport checks and their order are unchanged. The file has no separate "stable" check, so there was none to keep.
  - The header comment is updated with the D2 rationale.
- `apps/extension/src/content/action-runtime/interference/index.ts`: the barrel now exports `probePoints`, and its comment says the gate uses it too. `probe-points.ts` itself is unchanged: the same logic is reused, not copied.
- `apps/extension/src/content/action-runtime/tests/actionability.test.ts` (new) has three rows on a fake page with the D2 geometry: a 543 x 900 view, the link 80 x 22 px centred at 220,451, and the static `p.css-1y6w9q1` price box over its upper part.
  1. **Partly covered.** Accepted at a point other than 220,451. That point hit-tests to the link, and the detail names the centre's cover. `dispatchClickGesture(link, report.point)` dispatches every event, `click` included, at exactly that point.
  2. **Fully covered.** Refused `covered` at 220,451, with the detail starting `the point 220,451 landed on p.css-1y6w9q1, which covers the target`. More than one distinct point was hit-tested, and all of them lie inside the target.
  3. **Centre hits.** Accepted at 220,451 with the exact old words, and only one hit test.

Existing wording that other code matches still holds: the e2e regexes `^the point \d+,\d+ landed on the target$` and `... which covers the target; <layer sentence>`.

## Commands run and observed results

All runs used `EXTENSION_TEST_BUILD_LABEL=t707-d2` from `apps/extension`.

- **Fail-first, first try.** `node scripts/test-extension.mjs content/action-runtime/tests/actionability` -> pass 2, fail 1. Row 1 failed with "the point 220,451 landed on p.css-1y6w9q1, which covers the target / false !== true", which reproduces the live refusal.
  - Row 2 passed before the fix. That was a weak assertion: `coveringLayerSentence` hit-tests the centre a second time. I tightened it to count distinct points.
- **Fail-first, after tightening row 2.** The same command -> `not ok 1`, `not ok 2` ("only 220,451 was hit-tested"), `ok 3`; pass 1, fail 2.
- **After the fix.** The same command -> ok 1, ok 2, ok 3; pass 3, fail 0.
- `node scripts/test-extension.mjs content/action-runtime/tests/ content/action-runtime/interference/tests/` -> tests 196, pass 196, fail 0, cancelled 0.
- `node scripts/structure-audit.mjs` (repo root) -> "structure-audit: passed (205 warning(s), 638 baselined)". No warning names a file I changed (grep for actionability, interference/index and probe-points found nothing).
- `npx tsc -p tsconfig.test.json --noEmit` (apps/extension, typecheck only, no emit) -> exit 0, no output, 1m31s.
  - This ran on the shared tree, which also holds another worker's uncommitted `panel/` edits. It passed with them included.

## Not verified

- Live browser behaviour: no Lab, no browser, no extension build, as the brief required. Whether the real "Save for later" link is now accepted and the click takes effect on the cart is unproved. So is the narrow-tab run as a whole.
- The Playwright content specs (`e2e/content/tests/click.spec.ts`, `scroll.spec.ts`, `shadow-roots/...`) that match this wording were not run. They need a build and a browser. By reading the code, their centre-hit and covered paths produce the same text as before.
- The verbs under `apps/extension/src/content/actions/` were not re-tested, because they are outside this brief's directory. Their dispatch use of `report.point` was traced by reading only.

## Open questions or contradictions found

- **Behaviour change.** A target partly under a real overlay, such as a sticky header or a fixed card over half a button, is now pressed on its uncovered part instead of being refused and sent to the recovery. That is what a person would do, and a full-viewport scrim still covers every probed point and is refused. But it means the recovery no longer sees partial covers. The supervisor may want to confirm that is intended.
- The brief mentions a "stable" check. `actionability.ts` has none; stability is not checked in this gate.
- The probe pattern's inset points (6% and 8% from the edges) can miss a sliver of a very thin target that is the only visible part. The live case (27 of 63 points hitting) is well within what it finds.
