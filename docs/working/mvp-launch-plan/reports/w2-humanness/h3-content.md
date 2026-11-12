# W2 H3: humanness in the content script (click, type, scroll)

## Outcome

Done. Above humanness 0, the content script now does three things. A click is aimed at a point near the target's centre. Typing has a person's cadence. A scroll dwells once before the result is read. At 0, or when a command carries no level, every path runs exactly as it did before: the same points, the same events in the same order, and no added await or timer. A unit test checks that for each verb. No misclicks were added; that is H4.

## What changed and why

New module `apps/extension/src/content/action-runtime/humanness/` (barrel `index.ts`):

- `command-humanness.ts`: `commandHumanness(action)` returns `undefined` at level 0 or when the level is missing or unreadable (`normalizeHumanness`). Above 0 it returns `{ level, share: level/100, random }`, where `random = humannessRandom(humannessSeedOf(action.commandId))` from `@fluxiq/contracts/automation`. Every choice a command makes draws from this one generator, in order.
- `standard-normal.ts` (Box-Muller, 2 draws) and `skewed-delay.ts` (log-normal with the given mean, 2 draws).
- `point-near-centre.ts`: draws a click point.
- `typing-gaps.ts`: plans the gap before each character.
- `scroll-dwell.ts`: plans the dwell after a scroll.
- `fit-within-command.ts`: fits planned pauses within the command's own time.
- `pause-for.ts`: an awaited timer that sets no timer for 0 ms.
- `aim-press.ts`: `aimPress(element, gateReport, human)` calls the gate's `aimWithinTarget` with `pointNearCentre` as the draw.

Hook points in the owned files:

- `action-runtime/actionability.ts`: one new export, `aimWithinTarget(element, report, draw)`, which reuses the gate's own `visibleArea`, `centreOf`, `hitAt` (deepElementFromPoint), `composedContains` and `landedOn`. It returns `undefined`, so the caller keeps the gate's report, in any of these cases:
  - the gate's point is not the centre of the visible box (within 0.5 px), meaning the probe or same-control fallback chose the point;
  - the centre's hit is no longer inside the target;
  - the drawn point is not strictly inside the visible box;
  - the drawn point's hit is not the target or inside it;
  - the nearest control around the drawn hit (`PRESSABLE_HOST, label`) differs from the nearest control around the centre's hit.

  If the point passes, the report carries the drawn point and a detail that names it ("the point x,y landed on ...").
- `actions/click.ts`:
  - First press: `gate = measure()`, then `report = human ? (aimPress(element, gate, human) ?? gate) : gate`. The link path and `pressInPlace` both press at `report.point`.
  - Press made once more: above 0 it is aimed again at the target as it then stands, using `now`, the gate's fresh answer. If that point fails, it falls back to the first gate's point. At 0 it presses at `report.point`, as before. The second press is a new parameter `aimAgain` on `pressInPlace`.
  - Watch windows, the robot-check wait (`robotCheckWaitMs`) and the reply margin are untouched.
- `action-runtime/keyboard/type-text.ts`:
  - `typeText(element, text, gapsMs?)`. Without gaps it is the old synchronous loop and returns `void`; the loop body is now in `typeCharacter` and `finishTyping`, but the calls are the same and in the same order.
  - With gaps, `typeAtCadence` awaits `pauseFor(gap)` before each character after the first, and skips the wait when the gap is 0. The events and the final value are the same as without gaps.
  - Number, date and time inputs return through `typeSanitizedInput` before any cadence is used.
- `keyboard/capability.ts`: `KeyboardCapability.typeText` becomes `(element, text, gapsMs?) => void | Promise<void>`. Existing test stubs still type-check.
- `actions/type.ts`: `if (human) await deps.keyboard.typeText(element, text, fitWithinCommand(typingGaps(text, human), action, startedAt)); else deps.keyboard.typeText(element, text);`. At 0 this is the old line, byte for byte.
- `actions/scroll.ts`: `human` is computed once in `scrollAction`. Each mode then dwells once:
  - `by`/absolute: after `scrollTo` (and after `settleAt` for a smooth scroll).
  - `toElement`: between the move and the gate's read. It is split into `moveToElement` and `targetInView`; at 0 it runs the old synchronous path through the same calls.
  - `untilStable`: after the last pass.

  Every dwell is awaited before the position, the target or the snapshot is read. At 0 no dwell is planned and nothing is awaited.

## Design numbers

| Choice | Value |
|---|---|
| Click: margin kept clear on each side | 20% of the box's size per axis, at least 2 px |
| Click: farthest from the centre | 40 px per axis, and never past the inset |
| Click: spread | normal, σ = 0.4 × reach × level/100, clamped to ±reach (4 draws per aim) |
| Click: when drawn at all | only when the gate accepted the centre (±0.5 px) |
| Typing: gap | one before each character after the first; log-normal, mean 160 ms × level/100, σ_log 0.45 |
| Typing: hesitation | 5% of gaps add 2 to 6 mean gaps (3 or 4 draws per gap) |
| Scroll dwell | log-normal, mean 900 ms × level/100, σ_log 0.5 (2 draws); one per command |
| Fitting | all pauses together take at most 40% of the command's remaining time; a longer plan is scaled down proportionally, floored to whole ms, never dropped or failed |
| Command time | `webAutomationBaseTimeoutMs` (timeout before the robot-check allowance), else `WEB_AUTOMATION_DEFAULT_ACTION_TIMEOUT_MS` (5,000 ms) |

**Reproducibility.** The command id reproduces the drawn plan exactly. Two inputs outside the seed affect what a run actually does:

- A fitted pause also depends on how much of the command's time had passed when it was planned. This matters only when the plan is longer than the room.
- Whether a click draws a point at all depends on the page: the centre must have been accepted.

## Safety argument

- **The point stays in the visible box and is re-hit-tested.** `pointNearCentre` clamps each axis to the inset reach. `aimWithinTarget` independently rejects any point that is not strictly inside `visibleArea`, then hit-tests it with the gate's own `hitAt` + `composedContains`.
- **A point that misses falls back to today's choice.** Every rejection returns `undefined`, and click then uses `gate` (first press) or `gate.point` (press made once more), which is exactly the point used at level 0.
- **A different control is never pressed.** Events are always dispatched on the resolved target element itself, so only clientX/clientY change. On top of that, a drawn point is used only when its hit has the same nearest control (`PRESSABLE_HOST`, or a `label`) as the centre's hit. A nested Remove button or a label inside the target is therefore never aimed at. Probe and same-control fallbacks are never re-aimed.
- **Robot-check waits and pauses are untouched.** `ROBOT_CHECK_WAIT_MS`, `robotCheckWaitMs`, the notice, ignored-press and settle windows, and `checkWaitMs` are not touched. Fitting uses the base timeout, which excludes the check allowance.
- **Level 0 is today's path.** `commandHumanness` is a pure read that returns `undefined`. Every humanness branch is behind `if (human)` or `human ? ... : <old expression>`. Tests prove this:
  - the click test at 0 makes every geometry read throw and still passes, with the same events at the gate's point;
  - the keyboard test shows that typing without gaps returns `undefined` and sets no timer;
  - the type test shows the keyboard is called with two arguments;
  - the scroll test shows no timer is set at 0.

## Commands run and observed results

1. New tests only: `cd apps/extension && EXTENSION_TEST_BUILD_LABEL=t898-h3 node scripts/test-extension.mjs content/action-runtime/humanness/tests content/action-runtime/keyboard/tests content/action-runtime/tests/actionability-aim content/actions/tests/click/tests/humanness content/actions/tests/type-humanness content/actions/tests/scroll-dwell` printed `# tests 35`, `# pass 35`, `# fail 0`. This ran before the files were moved for the structure audit.
2. Mutation check: I temporarily removed `composedContains` from the drawn-point hit test in `aimWithinTarget` and re-ran the aim and click humanness tests. The result was `not ok 11 - a drawn point a badge covers is never pressed: the press falls back to the centre`, `# pass 11`, `# fail 1`. I then restored the file from a backup, and the diff stat is identical to before.
3. Brief check plus the new fragments: `EXTENSION_TEST_BUILD_LABEL=t898-h3 node scripts/test-extension.mjs content/actions/tests content/action-runtime/tests content/action-runtime/humanness/tests content/action-runtime/keyboard/tests` exited 0 with `# tests 438`, `# pass 438`, `# fail 0`, `# cancelled 0`. This was re-run after the move, with the same count.
4. `node scripts/structure-audit.mjs`, first run: 3 violations.
   - `action-runtime/tests/` had 26 files and `actions/tests/` had 27, over the 25-file limit, because of my new tests there.
   - `keyboard/type-text.ts` imported `../humanness/pause-for` instead of the barrel.

   To fix them, I moved the tests to `action-runtime/humanness/tests/aim-press.test.ts` and `actions/tests/humanness/tests/{type,scroll}.test.ts`, following the existing `actions/tests/check/tests/` pattern, and changed the import to the barrel. Second run: `structure-audit: passed (245 warning(s), 552 baselined).`, with no warning naming a file I touched.
5. Narrow typecheck through the slot. The command was `node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t898-h3 -- node --max-old-space-size=4096 node_modules/typescript/bin/tsc -p tsconfig.t898-h3.json`. That temporary config extended `tsconfig.test.json` and listed the 6 changed sources, `execute.ts`, `execute-action.ts`, all new tests, and three existing type-verb tests that stub `keyboard.typeText`; it has since been deleted. The run waited for a slot and then exited 0 with no diagnostics.

New test files:
- `action-runtime/humanness/tests/command-humanness.test.ts`
- `action-runtime/humanness/tests/plans.test.ts`
- `action-runtime/humanness/tests/aim-press.test.ts`
- `action-runtime/keyboard/tests/type-text-cadence.test.ts`
- `actions/tests/click/tests/humanness.test.ts`
- `actions/tests/humanness/tests/type.test.ts`
- `actions/tests/humanness/tests/scroll.test.ts`

## Not verified

- The whole-package typecheck (`pnpm check`), the extension build, and the content bundle. In particular, I did not confirm that the content bundle tree-shakes `@fluxiq/contracts/automation` down to the humanness functions; the background bundle already imports that subpath.
- Live browser behaviour and the Playwright content harness. The brief excluded harness specs.
- End-to-end: whether commands actually arrive carrying `humanness`. That is the domain and background worker's part; the working tree shows their uncommitted `gateway-mapping.ts` change.

## Open questions or contradictions found

- **Core contracts dist was stale at the start.** `!FluxIQ/packages/contracts/dist/humanness/` had no `random`/`seed-of` until partway through my work. The extension tests bundle `@fluxiq/contracts` from that dist, so any extension test run (and the typecheck) fails to resolve `humannessRandom`/`humannessSeedOf` until Core's contracts are rebuilt. Sequence the Core build before merging or validating this lane.
- **Untilstable dwells once, after the last pass, not between passes.** The growth poll already paces passes, and a per-pass dwell would multiply the time spent. Say if you want a per-pass dwell.
- **The press made once more draws a fresh point** at the target as it then stands, rather than repeating the first point. Either way it is re-hit-tested or falls back to the first gate point.
- **Architecture docs not updated.** There is no humanness section in `docs/architecture/`; it is not in my owned paths. The behaviour is documented in the headers of `click.ts`, `type.ts`, `scroll.ts`, `actionability.ts`, `type-text.ts` and `humanness/index.ts`.
