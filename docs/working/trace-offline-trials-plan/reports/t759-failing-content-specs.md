# t759 failing content specs

## Outcome
Done. Both specs pass headed; neighbouring specs and unit tests pass.

## What changed and why
1. wake-press-cover.spec.ts: PRODUCT REGRESSION. Cause: 296b710c (t707 D2, "a click whose target is only partly covered goes through") made checkActionability accept any probe point that hits the target. Bigbox's support card (360x210, bottom 16px) leaves a ~2px strip of the pinned Add to cart (button bottom 691, card bottom ~689). After the wake press the gate found the strip at (1129,688), judged the control actionable, skipped the "covered" refusal, pressed once more at the stale point under the card and reported "pressed once more" instead of closing the card (observed NOW=... centre landed on a div, another point landed on the target). Fix in apps/extension/src/content/action-runtime/actionability.ts: when the hit over the centre is a dialog or fixed layer with its own way out (existing overlaysAt, guarded by coveringLayerSentence), neither the probe-point nor the same-control acceptance applies; it is refused covered so recovery closes the layer. D2's plain overlapping box still passes. Spec unchanged.
2. company-website-team-more.spec.ts:57: STALE SPEC. d2302b5f (t743) made a press the page answers only with its own notice fail as web.action.page_reported_failure (Core retries). The team page's first "Show more people" press only shows a spinner, so the first runAction now fails with that code (the spec's own comment already said the first press only spins; before t743 it was reported done). Spec updated to assert the failure code, the "scrolling N times toward where the target would be" account and "the control can still be pressed"; the second press, as Core's retry, still must load more. Not loosened: the reveal and the second-press load are still asserted.

## Commands run and observed
- Before: both specs failed (wake: received "the point 1129,668 landed on the target; the page ignored the first press, so it was pressed once more"; team: first press failed).
- `pnpm test:content -- press-answers reveal-by-scroll --headed --workers=1` -> 9 passed (2.2m).
- Neighbours `actionability, click.spec.ts, dialog-refusal.spec.ts, evidence pinned-bars/clipped-controls/shadow-overlays` headed -> 39 passed (3.1m).
- `EXTENSION_TEST_BUILD_LABEL=t759 node scripts/test-extension.mjs src/content/action-runtime` -> pass 429, fail 0 (first attempt failed 2 actionability unit tests because overlaysAt reads global document in Node; fixed by guarding behind coveringLayerSentence plus try/catch).
- `npx tsc -p tsconfig.json --noEmit` and `tsconfig.test.json` -> no output (clean).
- `node scripts/structure-audit.mjs` -> passed (222 warnings, 616 baselined).

## Not verified
- Team spec timing: the reveal races the fixture's 429 (Retry-After 2 s) against the 2.8 s reveal ladder (400/800/1600 ms). Two early runs (right after rebuilds) ended with the button still hidden after attempt 4; later runs (6+) revealed. Possible residual flake; not changed (ladder/fixture tuning is a product call).
- No unit test added for the new layered branch (the fake DOM in actionability.test.ts cannot model a fixed layer); covered by the headed spec.
- Full suites not run.

## Open questions
- The account says "without a confirmed reveal" even when the final failure is page_reported_failure on the revealed button (attempt.ts `shown: last.status === "succeeded"`); arguably should say revealed. Left as is.

## 2026-10-27 -- t759-team-more-escalation (second worker)

### Outcome
Done. This was a product defect: the runtime gave up too early, and the spec's expectation was right. The reveal ladder now waits long enough for the page's own retry. Both specs pass headed in 3 runs in a row.

### Cause (measured, not inferred)
I used a temporary timeline probe (wrapped `fetch`, watched `more.hidden` and the status line, logged scrolls, then deleted it). Over 4 headed runs with the old ladder (400/800/1600 ms):
- Attempt 1 scrolls at about 0.1 s and wakes batch 2, which gets a 200 and renders at about 0.58 s.
- In 2 of the 4 runs, attempt 2's scroll (about 0.58 s) landed just after that render, with the grid's end in view. The page asked for batch 3 inside the endpoint's 900 ms window and got a 429. The page wrote "Trying again in 2 seconds" and retried on its own at about 2.6 s. It unhid "Show more people" at **3.07 to 3.10 s**.
- Attempt 4 pressed at **3.12 to 3.15 s**, a 30 to 50 ms margin. A slightly slower page gives the supervisor's failure: display none after 4 attempts.
- In the other 2 runs there was no 429 (the scroll at 0.56 to 0.61 s came while batch 2 was still loading). Attempt 3 woke batch 3 and the button appeared at about 1.95 s.

The fixture behaves like a real small site. Its rate limit and its "two faults the live site has" are deliberate, and a visitor who waits is never the worse for it. It also triggers the 429 itself, because it asks for the next batch the moment one lands with its end in view. A person who is told "Trying again in 2 seconds" waits and then sees the button, about 3 s after scrolling. The runtime stopped at 2.8 s with about 2 s of `RECOVERY_BUDGET_MS` (5 s) unspent. The old ladder's comment says it was sized for this page, but it missed the page's own 429 chain. I did not change the fixture's timing.

### What changed
- `apps/extension/src/content/action-runtime/recovery/budget.ts`: `RECOVERY_REVEAL_BACKOFF_MS` changed from `[400, 800, 1_600]` (2.8 s) to `[400, 1_000, 2_400]` (3.8 s). That matches the length of the target ladder: one load, a short Retry-After, and the render of the retried load. It is still 3 rungs, so there are still 4 attempts, and the last attempt starts about 1 s inside the 5 s budget. The comment states the measurement. The fix is generic and contains no page knowledge.
- `.../recovery/tests/reveal-attempt.test.ts`: the expectations now use the new ladder (pauses 1000/2400, "waiting 3800 ms"). I added a regression test driven by a clock: the target appears 3.1 s after the first scroll, the loop must reach it within 4 attempts, and the ladder must leave at least 1 s of budget. I checked that this test **fails on the old ladder**: I put the old ladder back temporarily, ran the recovery tests (3 failed, including the new one), and restored it.
- `company-website-team-more.spec.ts`: header comment only. It says which two paths the page takes and that the spec asserts the same outcome for both. The assertions are the previous worker's t743 expectations, unchanged and not weakened.
- I kept the previous worker's `actionability.ts` fix as it was.

With the new ladder, the probe took the 429 path in 4 of 4 runs. The button appeared at 3.03 to 3.08 s, the last attempt pressed at 4.06 to 4.11 s (about 1 s margin), and the result was page_reported_failure "waiting 3800 ms", which is what the spec expects.

### Commands run and observed
- `pnpm test:content -- e2e/content/tests/press-answers/tests/wake-press-cover.spec.ts e2e/content/tests/reveal-by-scroll/tests/company-website-team-more.spec.ts --headed --workers=1 --reporter=line`, 3 times in a row on the final files: `3 passed (51.4s)`, `3 passed (1.2m)`, `3 passed (51.2s)`. An earlier set of 3 runs, before the comment-only spec edit, also gave 3 passed each time.
- `pnpm test:content -- e2e/content/tests/reveal-by-scroll e2e/content/tests/actionability --headed --workers=1 --reporter=line` -> `11 passed (1.3m)`.
- `EXTENSION_TEST_BUILD_LABEL=t759 node scripts/test-extension.mjs src/content/action-runtime` -> tests 430, pass 430, fail 0.
- `npx tsc -p tsconfig.json --noEmit` -> exit 0. `npx tsc -p tsconfig.test.json --noEmit` -> exit 0.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (222 warning(s), 616 baselined).`

### Not verified
- No live or Lab run. I did not check other realistic pages whose reveal never succeeds: they now spend up to 1 s more (3.8 s instead of 2.8 s), still inside the 5 s budget.
- A page with a Retry-After longer than about 2 s, or a slow server, can still go past the ladder. The fixed ladder covers short honest retries, not every retry.
- Full suites were not run.

### Open questions
- `docs/architecture/web-capabilities.md:166-167` still says "waits of 400, 800 and 1600 ms". It needs to say 400, 1000 and 2400 ms. I left it alone because it was outside my brief, so the supervisor needs to change it.
- A sturdier design would keep waiting while the place the target would be drawn is still changing, or read the page's own "try again in N seconds" from a status region. That would let a longer Retry-After be waited out without lengthening every reveal. I did not do it here because it is a bigger change than this brief.
- The account still says "without a confirmed reveal" when the final failure is page_reported_failure on the revealed button (the previous worker noted this too).
