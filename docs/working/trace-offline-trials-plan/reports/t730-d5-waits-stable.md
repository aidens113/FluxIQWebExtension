# t730-d5-waits-stable

## Outcome

Done. The `stable` row no longer injects anything. It waits on job-board's own rate-limit countdown, which changes the page and then stops by itself.

## What changed and why

`apps/extension/e2e/content/tests/waits.spec.ts`, the row "stable: the wait holds while the page keeps changing and resolves once it goes quiet":

- Removed the `page.evaluate` that appended eight ticking `<p>` elements to `main`.
- The row now opens job-board's rate-limiter notice the same way the `enabled` row does: five `results-view` mutations through the site's own `/api`, so the next results page is the notice.
- That page has real churn. `board/client-script.ts:288-299` rewrites the button text "Try again in N" once a second. When N reaches 0, the script enables the button, sets its text to "Try again", and stops.
- The wait uses `stableForMs: 1200`, which is longer than one 1 s tick, and `timeoutMs: 10000`.
- The row keeps its assertions about holding during churn and resolving once quiet:
  - When the wait starts, the button reads `Try again in N` and is disabled.
  - The reply is `succeeded` / "The page is stable." / `the page stopped changing for 1200 ms`.
  - When the reply arrives, the button is already enabled and reads "Try again". This is read once, not polled.
  - Elapsed time is at least `(N-1)*1000 + 1200` ms.

### Alternatives rejected

- **social-network-feed countdown** (`requests-script.ts:45-53`): it ticks every 250 ms, but it runs as long as the 15 s rate window. It also has to be reached by pressing Confirm past the limit, so the row would be longer.
- **Feed batches:** they load only when scrolled, so the churn does not stop on its own without the test driving it.
- **job-board's countdown:** chosen because it is on the same site, reached by the same setup the `enabled` row already uses, and ends after about 5 s.

## Commands run and observed results

- `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/waits.spec.ts --headed --workers=2`
  - Result: `10 passed (3.0m)`. The stable row took 7.4s.
- `node scripts/structure-audit.mjs`
  - Result: `1 violation(s) across 1 rule(s)`. The one violation is `[statement-packing]` in `apps/scenario-lab/src/scenarios/bigbox-retail/tests/partner-widgets-browser.test.ts:71`, a file this brief does not own.
  - `grep -c waits.spec` over the audit output gives 0, so there is no finding for waits.spec.ts.

## Not verified

- I ran the file once, not repeatedly, so flakiness was not checked.
- I did not run a negative check that the row fails when the wait resolves early.

## Open questions or contradictions found

- The brief says professional-network has the 250 ms countdown. The atlas line and `requests-script.ts` both belong to **social-network-feed**.
- The structure audit currently fails on bigbox-retail `partner-widgets-browser.test.ts:71`, which is unrelated to this brief.
