# t758 store-wheel-fixture

## Outcome
Done. Wheel opens synchronously as the results page script runs; the deal-wheel task has its own clause.

## What changed and why
- `everything-store/client/search-script.ts`: `openWheel()` is called directly instead of `setTimeout(..., dealWheel)`. The search script runs after the shell script (which defines `storeModals`) and after the page root, so the root goes inert at once; it still returns on every results page until answered. Modal-busy retry unchanged. Comment updated.
- `client/timings.ts`: removed the now-unused `dealWheel` timing and its doc line.
- `state/types.ts`, `workflows/first-page.ts`: "first results page ... a moment after" comments and the variant description now say every results page, as it renders, until answered.
- `live-tasks.ts`: only `everything-store-first-page-plus-earbuds-deal-wheel` gets `DEAL_WHEEL_CLAUSE`: `If the store pops up a spin-to-win offer ("Spin to win up to 20% off!"), turn it down with its "No thanks, I would rather pay full price" line rather than spinning the wheel.` Base task unchanged. Oracle untouched.
- `tests/fixtures/realistic-task-baseline.ts`: baseline row for the deal-wheel task carries the clause.
- `tests/live-instructions.test.ts`: the deal-wheel task now has its own instruction family, so it was added to `ASKS_NOTHING` ("a read, after turning down a promotion").
- `everything-store/tests/honest-paths.test.ts`: wait for the wheel was `STORE_TIMINGS.dealWheel + 5000`; now `5000` (the timing no longer exists).
- New `everything-store/tests/deal-wheel-timing.test.ts`: armed, once the first result card is present the dialog exists, exactly one `[inert]` element, and the Plus link is under it.

## Commands run and observed
- `pnpm run build` (apps/scenario-lab): built.
- `FLUXIQ_DEMO_HEADLESS=false node --test dist/scenarios/everything-store/tests/*.test.js dist/scenarios/tests/live-instructions.test.js dist/scenarios/tests/realistic-site-live-tasks.test.js`: first run `# tests 94 # pass 93 # fail 1` (ASKS_NOTHING gap above); after fix `# tests 94 # pass 94 # fail 0`. Includes honest-paths deal-wheel row and the new timing test.
- `pnpm run check` (scenario-lab typecheck, src + e2e): passed.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (222 warning(s), 616 baselined)`.

## Not verified
- Fail-first was not demonstrated: the new test was written after the fixture edit, never run against the old 1500 ms timer. By the earlier probe (cards ~0.95 s, wheel ~1.6 s) it would fail there.
- No scratch Playwright probe; no live Lab, model calls, or full suites.
- The wording was not run through a model; whether the build honours it is unknown.

## Open questions
- Docs quoting the task (not edited): `docs/working/breadth-forty-tasks-plan/reports/audit-everything-store.md` lines 23 and 54-60 say the deal-wheel row shares the base instruction ("change together"); now stale. The listing also shows `adaptation-and-breadth-plan.md` and `mvp-final-month-plan` reports mentioning the task id; not checked for quoted text.
- The product-side gap in store-wheel.md section B (Flow that reaches the Plus page by address never meets the wheel via a gated verb) is untouched; this change only fixes the timing race and the wording.
- Other dirty files in the tree (packages/test-runner, docs/architecture/testing-facility.md) predate this work and are not mine.
