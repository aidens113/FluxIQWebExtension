# t433: honest-path browser tests that failed under load

## Outcome

Done for the failures the sweep reported, with one remaining problem (see Open questions). I reproduced the failures under load and traced them to two causes:

1. **A fixed wall-clock deadline charged the site for time the machine took away.** The harnesses limited every step to `timeoutMs` or a 10 s default, counted on the wall clock. While the load runs, the CPU stays at 100%, free memory falls to about 0.5 GB and the page file is paging (up to 6,490 page-ins a second, with about 190 chrome processes). In that state a page's renderer can go 10 s or more without running. The failing clicks were stuck at Playwright's "performing click action": the input had been sent and the page had not acknowledged it. The failing waits were for site timers that fired late, such as bigbox `offer-opens` (8 s). This explains `close-chat-greeting`, `accept-consent`, `accept-cookies`, `offer-opens`, `await-second-batch`, `await-reference`, `await-booking-confirmation` and `towels-added`.
2. **A real ordering race in one honest test (company-website winter-notice).** The inserted `continue-past-notice` step came straight after `accept-cookies`. The newsletter offer opens 4 s after consent, over the notice. On a slow page the click landed on the offer's scrim. The call log said: `<div role="dialog" aria-label="Newsletter"> ... intercepts pointer events`.

The sites have no race, so I changed neither the product behaviour nor any oracle or manifest.

## What changed and why

- `apps/scenario-lab/src/scenarios/tests/within-page-time.ts` (new): `withinPageTime(page, budgetMs, what, act, diagnose?)` gives the site its budget in the page's own time.
  - Each page gets an init-script heartbeat: a 100 ms interval that adds up how late it fires. It is stored on a non-enumerable global. The current document is also armed.
  - The test process keeps the same account of itself, because the lab server and the Playwright driver run in that process.
  - The step's clock starts once the page answers. The deadline is the budget plus whichever lost more time during the step, the page or the process, capped at 60 s.
  - A page that runs normally and never reaches the state still fails at its budget.
  - A read also counts a tick that is overdue at that moment. Without this, a read that arrives just after a freeze runs before the late tick and sees no lost time. I found that case while writing the unit test.
  - The action runs with `timeout: 0` and is abandoned when the deadline passes. Its rejection is swallowed, and closing the context ends it.
- `apps/scenario-lab/src/scenarios/tests/diagnose-action.ts` (new): runs a 1 s trial click when an action runs out of time and appends Playwright's call log to the error, which names any element covering the target.
- `apps/scenario-lab/src/scenarios/tests/within-page-time.test.ts` (new), 3 cases:
  - A page frozen for 3 s still meets a 1.5 s budget for a state that appears 0.5 s into its own time.
  - A page that runs normally fails at its 1 s budget, in under 3 s, and the error names the step.
  - An error from the action itself is raised unchanged.
- `company-website/tests/site-driver.ts` and `bigbox-retail/tests/browser-harness.ts`: click, type, check, press, select and waitForState now run through `withinPageTime`. Bigbox's Next click and its page-replacement wait do too. Budgets are unchanged: the step's `timeoutMs`, else 10 s, and 15 s for page replacement. The company driver now keeps Playwright's whole error message, call log included, instead of only the first line.
- `company-website/tests/honest-path.test.ts` (winter-notice): `continue-past-notice` now goes after `decline-newsletter`. The newsletter scrim is later in the DOM at the same z-index (70), so it sits above the notice. The step is still the one extra step the situation needs, with a comment explaining why it goes there.

## Commands run and observed results

All runs used the two files `dist/scenarios/company-website/tests/honest-path.test.js` and `dist/scenarios/bigbox-retail/tests/browser-paths.test.js`, 22 tests per copy. "Load" means that many copies started at once, run by the scratch script `load.sh`. "+runner" means `pnpm --filter @fluxiq-web-extension/test-runner test` was also running.

| Load | Before | After |
| --- | --- | --- |
| Idle, 1 copy | 22/22, 54.7 s | 22/22, 52.6 s |
| 4 copies, no runner | 88/88 | not run |
| 4 copies + runner | 88/88 | 88/88 (earlier build of the fix) |
| 6 copies + runner | **126/132**: 6 × `offer-opens` waitFor 8000 ms | **132/132** (final build) |
| 8 copies + runner, run 1 | **25 step failures**: accept-consent, close-chat-greeting ×4, accept-cookies ×6, offer-opens ×8, await-second-batch and others, plus about 52 cancelled | — |
| 8 copies + runner, run 2 | 4 to 5 failures per copy plus cancellations | — |
| 8 copies + runner (final build) | — | **0 step failures**, 49 cancelled by the test's own 120 s or 90 s timeout |

At 8 copies + runner, the cancelled tests are almost all bigbox "naive paths fail" cases, the same ones cancelled before the fix (see Open questions).

- `pnpm --filter @fluxiq-web-extension/scenario-lab test`: exit 0, 697 tests, 697 pass, 0 fail, 0 cancelled, 143.8 s.
- `pnpm --filter @fluxiq-web-extension/scenario-lab check` (tsc for src and e2e): exit 0.
- `node scripts/structure-audit.mjs`: "structure-audit: passed (184 warning(s), 651 baselined)."
- `node --test dist/scenarios/tests/within-page-time.test.js` ×3: 3/3 pass each time.

## Not verified

- Not run in the real full sweep (`pnpm -r --no-bail test`). I used the load runs above instead.
- The browsers ran headless, not headed. These files hard-code `headless: true`, as the Lab's page specs do, and I did not change that. Headed windows on Windows get occlusion throttling, and this mechanism would then credit that throttling as lost time.
- The other scenarios' harnesses, such as crossborder-marketplace `browser-paths` and everything-store, do not use `withinPageTime` yet.

## Open questions or contradictions found

- Separate from the brief, under extreme load only (8 copies + runner): bigbox's "naive paths fail" describe runs 7 tests at once, and in 6 to 7 of 8 copies all of them hit their 120 s test timeout together. That includes "a click aimed at the page before the consent dialog", which only opens the page and makes one 1.5 s click. The same thing happened before the fix (diag2: 7 of 8 copies). Because they all stop at once, this looks like a stalled or wedged browser rather than slowness. I did not trace it, and it did not occur at 6 copies + runner.
- Should the same page-time budget apply to the Lab's own step runner (`packages/test-runner/src/scenario-steps/step-runner.ts`)? It uses the same wall-clock `timeoutMs`, so a live or provider-free Lab run on a saturated machine can fail the same way. I did not touch it; that is the supervisor's decision.
- A fixed budget of 10 s or the step's `timeoutMs` is still the scenario's statement about the site. I kept those numbers and changed only what counts against them.
