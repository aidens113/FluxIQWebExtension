# t739-u1: photo-social scenario-lab failures

## Outcome

Done for failure (a). Failure (b) did not come back in any run and has no code fix; the cause is below.

## Causes

### (a) breadth-paths "newest-likes": a like went missing from the account

- **The fixture was at fault, not the test or the oracle.** In `client/post-script.ts` the heart changed to
  "Unlike" before the `like` request had even gone out. The honest path waits for "Unlike"
  (`newest-likes-liked-N`) and then opens the next page. That navigation cancels any `like` request still in
  flight, so the server never records it. The page showed a like that the server did not have.
- **When it was introduced.** The heart has worked this way since the scenario was added (`3a62305e`, 2026-09-21).
  The newest-likes path that leaves the page straight after a like came with `f5f750ba` (t702 breadth tasks). No
  commit between sweep-1019b (which passed) and sweep-1020 touched these files. The t730 commit `4441cde5`
  (saved-logins mode) and t733 do not affect it. The race only shows when the in-process lab server answers late.
  sweep-1020 ran more browser test files at once (t730 added browser specs, and `347317c7` widened the scan), and
  that extra load exposed it.
- **Reproduced.** I held each `/api/photo-social/*` request for 400 ms through `context.route`. With the old
  fixture, the `like` requests failed with `net::ERR_ABORTED` and the final account had `liked: []`. Without the
  delay the test passed, which matches a failure that appears only under load.

### (b) honest paths "collection workflow": `close-dialog` click timed out after 5000 ms

- **No fixture or test defect found.** Nothing in photo-social changed between the passing and failing sweeps.
  I found nothing that could block the dialog's Close button:
  - the scrim has `z-index` 60;
  - the dock has 50, the popover 30 and the banner 25;
  - the only element above the scrim is the toast (90), which sits at the bottom centre and is gone after the
    navigation;
  - strict-mode duplicates would fail at once, not time out.
- **Every non-loaded run passed.** That covers single runs, 2 runs headed, 6 parallel sessions with 4x CPU
  throttle, and 6 parallel sessions with random API delays of up to 1.5 s.
- **Heavy load breaks every step, not this one.** With 10 parallel sessions at 10x CPU throttle, every session
  timed out at some step (`save-first`, `collapse-dock`, `dock-expanded`, `offer-collection`).
- **Conclusion: renderer starvation.** sweep-1020 ran the whole package (998 tests, many Chromium instances) on a
  12 GB machine. The failing test took 20.4 s, against about 10 s when the machine is idle.
- **Why the cause could not be proven.** The sweep log kept only the first line of Playwright's error, so it did
  not say what the click was waiting for. The driver now keeps the call log, so a repeat will show it (see below).

## What changed and why

- `apps/scenario-lab/src/scenarios/photo-social/client/post-script.ts`
  - The heart now turns after `act('like', ...)` returns, as the bookmark already did.
  - "Unlike" now means the server holds the like. This makes the honest path's wait sound. It also stops the
    page telling a Lab model a like is done when it is not.
  - The doc comment records the behaviour.
- `apps/scenario-lab/src/scenarios/photo-social/breadth/newest-likes/workflow.ts`: doc comment only. The next page
  opens once the heart has turned, which happens on the server's answer. No steps, oracle or instruction changed.
- `apps/scenario-lab/src/scenarios/photo-social/tests/breadth-paths.test.ts`
  - New suite "breadth honest paths on a slow server". It runs the newest-likes recording with every fixture API
    request held 400 ms, then asserts the dataset and every final-state fact.
  - I wrote it first and ran it against the old fixture, where it failed with `liked: []`. It passes with the fix
    (2 of 2 runs).
- `apps/scenario-lab/src/scenarios/photo-social/tests/recording-driver.ts`: a failed step now reports Playwright's
  first line plus the last 4 lines of its call log, with ANSI codes removed, instead of only the first line. This
  is so a repeat of (b) says what the click was waiting on. All existing `assert.rejects` regexes still match.

No timeout was raised and no assertion or oracle was loosened.

### Required outcome for photo-social-newest-likes

- **Oracle.** `breadth/newest-likes/expected.ts` holds 3 records, one per post, in order: `D1OKDvAEHfa`,
  `DgYZxS8LJOe`, `DPIEH3I491a`.
  - The account fact is liked = exactly those 3.
  - `breadth/tests/expected.test.ts` checks the oracle against the fixture data: the newest non-pinned posts are
    grid cells 4 to 6, the first 3 cells are pinned and older, and a reel is among the newest.
- **Instruction.** It says "three most recent posts", "reels included", "newest first" and names the one column,
  `link`. Nothing changed: it was already unambiguous in the site's terms.
- **Honest path.** It passes provider-free, both normally and with the slow server.

## Commands run and observed results

| Command | Result |
| --- | --- |
| `pnpm --filter @fluxiq-web-extension/scenario-lab build` | Built every time, final build OK (scenario-lab:build 53 s) |
| Slow-server test on the old fixture (client files temporarily reverted from HEAD, rebuilt) | `# pass 0`, failing `newest-likes-account` with `"liked":[]` |
| Same test with the fix | `# tests 1 / # pass 1 / # fail 0`, twice |
| `node --test dist/scenarios/photo-social/tests/breadth-paths.test.js` | `# tests 9 / # pass 9 / # fail 0` |
| `node --test dist/scenarios/photo-social/tests/honest-and-naive-paths.test.js` | `# tests 12 / # pass 12 / # fail 0` |
| `node --test dist/scenarios/photo-social/tests/*.test.js dist/scenarios/photo-social/breadth/tests/*.test.js` (5 files) | `# tests 45 / # pass 45 / # fail 0` |
| Same 5 files before any change | `# tests 44 / # pass 44 / # fail 0` |
| `pnpm --filter @fluxiq-web-extension/scenario-lab check` | Completed with no tsc errors |
| `node scripts/structure-audit.mjs` | `structure-audit: passed (212 warning(s), 618 baselined).` |

I also ran ad hoc repro scripts from `apps/scenario-lab/dist/zz-t739u1-*.mjs` (build output, never tracked):
headed and headless, API delay, CPU throttle and parallel sessions. They are deleted.

## Not verified

- **The extension e2e spec `apps/extension/e2e/site-reset/tests/photo-toggle.spec.ts`.** It likes and unlikes on
  photo-social. The heart now turns about one local round trip later, and I did not run the spec (it is outside my
  files and needs the extension build). Its checks read the post after each node runs, so I expect no change.
- **That (b) is starvation.** This is inferred from the load experiments and the clean code reading. It was not
  shown on the exact sweep run, because the call log was lost.
- **Headed browsers in the named test files.** The test files hard-code `headless: true` (unchanged). Only my repro
  scripts ran headed.
- **No whole-package or Lab runs**, per the brief.

## Open questions or contradictions found

- **The dock has the same latent flaw, with no failure to show for it.** The messages dock in
  `client/overlay-script.ts` also paints its collapsed state before `act('dock')` returns. A navigation straight
  after collapsing would drop that request too, and the dock would expand again on the next page. In every current
  workflow the step after collapsing waits on a server round trip first, so this never happened. My slow-server
  run with the old overlay passed, and I reverted the change to keep this fix to what the evidence shows. The
  supervisor can decide whether to apply the same "paint on answer" rule there.
- **The opening "Not Now" answer to notifications is dropped as well.** The navigation right after it aborts the
  request (`notifications net::ERR_ABORTED` in the repro). It does no harm today, because no fact reads it and the
  prompt only shows on the home feed. A workflow that returns home would meet the prompt again.
- **The full-package sweep may need less concurrency on this 12 GB machine.** Running every browser test file at
  once can starve any click, as (b) shows. That is a sweep-harness question outside this brief.
