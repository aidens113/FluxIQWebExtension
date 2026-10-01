# t174-w30: a navigation that lands on a 429/503 page is rate-limited, not refused

## Outcome

Done, with one deviation. When a `web.browser.navigate` lands on a page served HTTP 429 or 503, and that page is not a robot check:

- the navigation now fails `web.action.rate_limited`. That code is retryable and carries `effect: "unacted"`.
- the refusal is told to the worker's page-load pace for the landed origin.
- `retryAfterMs` is the wait the pace now imposes on that origin's next load. With no pace it is 8,500 ms.

Any other status of 400 or above still fails `navigation_unexpected`, as w29 made it.

The deviation is the file name. The brief asked for `runtime/landed-path.ts`, but the structure audit refused it: `[naming] apps/extension/src/runtime/: 3 files share the prefix "landed-"`. The module is therefore `runtime/quoted-path.ts`, and its one export is still `landedPath`.

## What changed and why

- **`apps/extension/src/runtime/action-runner.ts`**
  - **Navigation branch.** After the served status is read, a new `noteRateLimitedLanding(landed, reading, served, request.pace)` runs:
    - It returns undefined for a robot check, an unread status, or a status outside `PAGE_REFUSAL_STATUSES`.
    - Otherwise it calls `pace.noteRefusal(originOf(landed), status)` and answers `{ status, retryAfterMs: pace.waitBeforeNextLoad(origin) }`.
    - When there is no pace, or the landed address is not http(s), it answers `PAGE_LOAD_PACE_SETTINGS.refusalWaitMs`. That is 8,500 ms; `pace-settings.ts` already documents it as equal to `pagination.ts` `FIRST_RETRY_WAIT_MS`. The constant is reused, not copied, and no content code is imported.
  - **`NavigationLanding`** has a new field, `rateLimited`.
  - **`navigationResult`** checks for a rate limit right after the robot check and before the destination comparison. A rate-limited landing fails with:
    - `webAutomationFailureRecord(RATE_LIMITED, { expected, actual, retryAfterMs })`
    - `actual`: `the server answered HTTP <n> for <path>: the site refused the load for now and nothing was loaded; the same navigation may be made again after <ms> ms`
    - message: `Navigation refused by the site for now: HTTP <n> for <path>; it may be made again after <ms> ms.`
    - Only the path is quoted, never the query, the fragment or page content. `expected` is `the page at <requested>`, the same form the robot-check branch uses.
  - **Doc comment.** Updated to describe the new check.
  - **Local `landedPath`.** Removed.
- **`apps/extension/src/runtime/quoted-path.ts`** (new, one export). `landedPath(url)` uses `URL.canParse` rather than try/catch, so the move cannot trip `failure-as-empty`. `click-landing.ts` and `action-runner.ts` both import it.
- **`apps/extension/src/runtime/click-landing.ts`**. The private `landedPath` is removed and the import added. Behaviour is unchanged.
- **`apps/extension/src/background/page-pace/origin-pace.ts`**
  - A new read-only method, `waitBeforeNextLoad(origin)`. It returns `max(0, nextAt - now)`, or 0 for an origin it has never seen, and books nothing.
  - The private `REFUSAL_STATUSES` is replaced by the shared set.
- **`apps/extension/src/background/page-pace/refusal-statuses.ts`** (new). It exports `PAGE_REFUSAL_STATUSES` (429 and 503) and is re-exported from the barrel `index.ts`. The pace and the navigation now judge one set instead of two copies.
- **Docs**
  - `web-capabilities.md`, Navigate row: describes the `rate_limited` branch, the pace note and the fallback wait, and that a robot check served 429 stays the person's. The owning files now include `runtime/quoted-path.ts` and `background/page-pace/`.
  - `failure-taxonomy.md`: the `action-runner.ts` emitter entry now lists `RATE_LIMITED` for a navigation landing on 429/503.

## Tests, before and after

All tests are in `runtime/tests/navigate-action.test.ts`, except the last row. The `navigate()` helper gained an optional `pace` argument, and `stillPace()` builds an `OriginPace` on a frozen clock.

| Test | Before | After |
| --- | --- | --- |
| 429 → `rate_limited`, retryable, `effect: unacted`, `retryAfterMs` 20000 (a pace with `refusalWaitMs` 20000, which proves the wait is the pace's), path only, `refusalsOf` = 1, Core parser accepts | FAIL (`expected 'web.action.rate_limited'`, `actual 'web.navigation.unexpected'`) | pass |
| 503 with a pace → `rate_limited`, wait 8500, refusal noted; without a pace → `rate_limited`, retryable, `retryAfterMs` 8500, parser accepts | FAIL (same) | pass |
| 404 with a pace → still `navigation_unexpected`, no `retryAfterMs`, `refusalsOf` = 0 | pass (regression guard; it cannot fail before) | pass |
| Robot check served 429 → `web.intervention.required`, `refusalsOf` = 0 | pass (regression guard; the robot check was already judged first) | pass |
| `origin-pace.test.ts`: `waitBeforeNextLoad` is 0 for an unseen origin, equals the spacing after a booking, books nothing, equals `refusalWaitMs` after a refusal, is 0 once over, and leaves other origins untouched | FAIL (`pace.waitBeforeNextLoad is not a function`) | pass |

The before and after runs used a scratch single-file esbuild runner under the ignored `apps/extension/.test-build-scratch/`, which has since been deleted.

- Before: `# tests 35 / # pass 32 / # fail 3`.
- After, with `click-landing.test.ts` added: `# tests 62 / # pass 62 / # fail 0`.

## Commands run and observed results

- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w30 ext test" pnpm --filter @fluxiq-web-extension/extension test`
  - Run after the rename: rc=0, `# tests 1687`, `# pass 1687`, `# fail 0`, `# cancelled 0`.
  - The run before the rename gave the same totals.
- `bash C:/Users/osrs_/FluxStuff/build-slots/heavy.sh "t174-w30 ext check" pnpm --filter @fluxiq-web-extension/extension check`
  - Run after the rename: rc=0, `{"build-cache":"build","step":"extension:check","reason":"inputs changed: apps/extension; ...","ms":101815,...}`.
- `node scripts/structure-audit.mjs`
  - First run: `FAIL [naming] apps/extension/src/runtime/: 3 files share the prefix "landed-"`, then `structure-audit: 1 violation(s) across 1 rule(s).`
  - After the rename: `structure-audit: passed (136 warning(s), 118 baselined).`
  - The output contains no line saying an entry for `runtime/click-landing.ts` can be lowered, so `pnpm structure:baseline` was not run.

## How Core and the domain treat a navigation's `web.action.rate_limited` (read only)

- **Domain.** The record row is `{ category: "action_failed", retryable: true, stage: "execution", effect: "unacted" }` (`domain/src/runtime/failure/codes.ts:217`). `retryAfterMs` is kept only on a retryable code, rounded, and capped at 3,600,000 (`codes.ts:267`, `codes.ts:277`, `boundedWait`). By contrast, `web.navigation.unexpected` is `retryable: false` (`codes.ts:211`), so before this change a 429 navigation was never retried.
- **Playback: yes, it is retried after the wait.** Core's graph run assesses each failed attempt (`!FluxIQ/packages/fluxiq/src/programs/automation-studio/runtime/executor/graph-run.ts:579`) with `automationStudioAssessAttemptFault` (`executor/defensive/assess.ts:46-89`):
  - `faultFromRecord` reads `retryable: true` as disposition `retry` and takes the record's `effect: "unacted"` (`assess.ts:112-127`).
  - The stage is `execution`, so the found-after-acting gate does not apply (`assess.ts:63-80`).
  - The effect is `unacted`, so the mutating-node gate does not apply either (`assess.ts:81`). This holds whatever the navigate node's metadata says, so the mutating-node rule does not block it.
  - The record's `retryAfterMs` becomes `hintedWaitMs` (`assess.ts:58-60`, read as milliseconds in `retry-hint.ts:14,42`).
  - The wait taken is the longer of the backoff and the hint. One wait is capped at 30 s, one node's waits at 60 s, and one run's at 300 s (`retry-wait.ts:8,18,29,48-58`, applied at `graph-run.ts:609-618`).
  - The default policy allows 3 attempts (`retry-policy.ts:28-31`).
  - So an 8.5 s wait is honoured, and two retries fit inside the 60 s node budget. The re-sent navigation is also booked on the same pace (`paceNavigation`), which holds it only for whatever remains of the pace's own hold.
- **Build (live phase): not retried automatically, as far as I found.** I searched Core's `runtime/llm`, `conversations`, `live-patch` and `flow-draft` for `retryable`, `retryAfter` and `hintedWait`. The only hits were provider-call retries (`runtime/llm/provider-retry/*`, `conversations/instructions/interpret.ts:84`); I found no re-run of a failed tool action. The model gets the failed result back:
  - The code is `web.action.rate_limited`, retryable.
  - The message says the navigation may be made again after N ms.
  - If the model navigates again, the pace holds that load until the wait is over.

## Not verified

- No Lab and no live browser run (STOP in force). I did not prove that a real Chrome document served 429 by job-board or the everything store reports `responseStatus` 429 at this point. This is the same mechanism w29 relies on.
- I did not read `runAutomationStudioRecoveryLadder` (`graph-run.ts:584`). That the ladder's first rung is `retry` for a `retry` disposition is inferred from `retry-policy.ts` and the call site, not read.
- I did not establish whether the build's dry-run replay (`flow-draft/dry-run.ts`) runs steps through `runAutomationStudioGraph`, which would retry, or through a direct dispatch. Its header says a `failed` step blocks.
- The root `pnpm check`, `pnpm build` and the domain tests were not run. Nothing under `domain/` or Core was edited.

## Open questions or contradictions found

- **File name.** The brief's `landed-path.ts` conflicts with the structure audit's prefix rule, which would require a `runtime/landed/` directory holding `landed-challenge.ts`, `landed-check-wait.ts` and the new file. Those two files are outside my ownership, so I named the module `quoted-path.ts`. The supervisor may prefer the directory move.
- **Order.** The rate-limit check runs before the destination comparison, so a site that redirects to a "too many requests" page served 429 is also read as rate-limited rather than `navigation_unexpected`. Both Lab sites serve 429 at the requested address (`job-board/route.ts:35`, `everything-store/route.ts:42`), so the order does not matter for them.
- **Stale paragraph.** The `RATE_LIMITED` paragraph in `failure-taxonomy.md` (around line 73) still names only the click verb as its producer. I left it alone because my ownership there is the navigation post-condition lines only.
- **Click landings.** `click-landing.ts` still reports a click that lands on 429/503 as `navigation_unexpected` and does not tell the pace. That is the same gap on the click side, and it was out of scope here.
