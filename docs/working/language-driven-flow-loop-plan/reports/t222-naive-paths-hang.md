# t222: the everything-store naive-paths test hangs idle under load

## Outcome

Done. The cause is reproduced and fixed. A lost browser, or any failure while
a session is opening, left that session's scenario lab listening. The lab's
two HTTP servers keep the node test process alive forever, so the file never
exits. This matches the observed state: 0 CPU, no browser child, and 12
listening sockets, which is 6 labs times 2 servers. The same teardown existed
in 9 sibling browser harnesses and is fixed there too.

## What changed and why

**Cause.** Every browser harness closed a session with
`await context.close(); await lab.close();`.
- Once the browser has gone away, Playwright's `browserContext.close()`
  rejects with "Target page, context or browser has been closed".
  - `playwright-core` 1.51.1 `client/browserContext.js` makes an unguarded
    `_channel.close()`.
  - So `lab.close()` never runs.
- Separately, each `open*`/`session()` started the lab, then ran
  `set-mode`/`newContext`/`newPage`/`goto` with no guard. A throw there
  returned no session, so nothing ever closed the lab.
- Leaked lab servers keep the event loop alive, and the suite-level `after`
  has already closed the browser. Result: an idle process with listening
  ports, no running test, nothing printed. That is the observed hang.

**Fix.**
- New `apps/scenario-lab/src/scenarios/tests/close-lab-session.ts` exports
  `closeLabSession(lab, context?)`.
  - It closes the context, then always closes the lab (in a `finally`).
  - It does not raise again a context-close rejection when the context's
    browser is disconnected. The step that met the lost browser has already
    failed, and the teardown error used to replace its message.
  - It raises any other context-close error after the lab is closed.
- Every harness now closes through it. Each opening path catches a failure,
  calls `closeLabSession(lab, context)`, and rethrows the original error.
  - `everything-store/tests/browser-kit.ts`
  - `auction-marketplace/tests/browser.test.ts`
  - `local-classifieds/tests/browser.test.ts`
  - `job-board/tests/browser-paths.test.ts`
  - `photo-social/tests/honest-and-naive-paths.test.ts`
  - `social-network-feed/tests/variant-and-naive-paths.test.ts`
  - `bigbox-retail/tests/browser-harness.ts`
  - `company-website/tests/site-driver.ts`: `newContext` moved inside the try.
  - `crossborder-marketplace/tests/browser-harness.ts`: split into
    `openSession` plus a private `openTab`.
  - `professional-network/tests/browser-session.ts`: `openSession` and
    `closeSession`.
- **Bound.** The everything-store kit's `control()` fetch now has
  `AbortSignal.timeout(15 s)` and names the path on failure. Before, undici's
  300 s default was its only bound. Every other wait in the file is
  Playwright's, already bounded at 30 s by default or given an explicit
  timeout, so no test-level timeout was added.

**Two loud load failures, separate from the hang.** These were found while
reproducing it, in files I own:
- `browser-kit.ts` `search()`: the fixed `{ timeout: 6000 }` on "Continue
  shopping" and on the first result also counted navigation time. Under load,
  the navigation alone passed 6 s. Both waits are the page's own timers
  (`softCheckButton` 1.5 s, `resultsHydrate` 0.7 s), so they now keep
  Playwright's default bound.
- `naive-paths.test.ts`, the rate-limit subtest: the burst `page.goto`s waited
  for each page to fully load. On a loaded machine five pages then spanned
  more than the limiter's 8 s window, giving `200, 200, 200, 200, 200`.
  - The burst gotos now return at `waitUntil: "commit"`, leaving each page
    unread, as the test's premise says.
  - The 429 page is awaited with `waitFor()`, which replaces an immediate
    `isVisible()`.

Probe code: none was added to the repository. The handle probe and the
browser-kill injection were a scratchpad module loaded with
`node --import`. `browser-kit.ts` was set to HEAD's content for the "before"
series and restored byte-for-byte; `diff -q` against the saved copy confirmed
it.

## Commands run and observed results

All heavy runs went through `build-slots/heavy.sh`. The machine was shared
with other lanes holding the other build slots (CPU 100%, 2.8 GB free of
12 GB at one check).

- **Original code, natural load.** N parallel copies of
  `node --import probe.mjs dist/scenarios/everything-store/tests/naive-paths.test.js`,
  each capped at 300 or 400 s:
  - 8 copies: 0 of 8 hung, 8 of 8 passed 6/6, about 34 s each.
  - 16 copies: 0 of 16 hung, 8 of 16 had failures, about 100 s each.
    - 3 burst failures: `a burst is refused: 200, 200, 200, 200, 200`.
    - 5 failures in `search()`: `Timeout 6000ms exceeded` waiting for
      "Continue shopping" or for the first result.
  - Natural load did not reproduce the hang in these runs.
- **Original code, the test's own Chromium child killed mid-run** (probe
  `PROBE_KILL_BROWSER_AT`, 120 s cap):
  - kill at 12 s (first run, 90 s cap): HUNG.
    - Subtests failed with
      `browserContext.close: Target page, context or browser has been closed`.
    - The probe then showed only 10 `TCPServerWrap` listeners, alive until
      the cap.
  - Series at 6, 8, 10, 12 and 14 s: 5 of 5 HUNG (exit 124). Listening
    servers at the last probe: 12, 10, 8, 8, 8. The 6 s run is exactly the
    observed state: 12 listeners, browser gone, idle.
- **Fixed code, same injection:**
  - kill at 12 s (single run): exited in 16 s with 2 passed and 4 failed.
    - Each failure names its step, for example
      `locator.waitFor: Target page, context or browser has been closed` on
      the chat dialog, the Close banner or the first result.
    - Zero `context.close` errors; the probe shows no servers.
  - Series at 6–14 s: 0 of 4 delivered kills hung, all exited with 0
    listeners. The 6 s kill was not delivered because the browser child did
    not exist yet under load, so that run passed 6/6.
  - The 10 s run took 95 s to exit: tests failed at 14 s, then the killed
    Chromium child took about 70 s to finish exiting. Its process handle was
    the only live handle.
  - Early kills at 0.7–2.5 s were not delivered. A kill at 4 s landed inside
    `openStore` for all 6 sessions; the file exited in 5 s with 6 failed and
    no leak.
- **Fixed code, 16 parallel copies:** 0 of 16 hung. 0 burst failures and 0
  `search()` failures. 7 of 16 copies failed in `settleIn`, 16 failures in
  all:
  - 15 × `locator.waitFor: Timeout 15000ms exceeded` waiting for the "Never
    miss a deal" dialog, a 4 s site timer;
  - 1 × the "Not now" click at 30 s.
  - This is timer starvation on top of the other lanes' load, and is left as
    is (see open questions).
- `pnpm --filter @fluxiq-web-extension/scenario-lab check`: passed (tsc src
  and e2e).
- `pnpm --filter @fluxiq-web-extension/scenario-lab test`: exit 0,
  `# tests 620 # pass 620 # fail 0 # cancelled 0`, 186.7 s. The tested `dist`
  was confirmed to contain `closeLabSession` and `waitUntil: "commit"`.
- `node scripts/structure-audit.mjs`: `structure-audit: passed (135
  warning(s), 119 baselined)`, exit 0. The only warning on a changed file is
  advisory: `auction-marketplace/tests/browser.test.ts` is 444 lines, up from
  435, and was already past 400.

## Not verified

- **Why the browser died in the supervisor's run.** The fixed code no longer
  hangs whatever the cause, but I could not reproduce a natural browser
  death. The evidence fits two triggers:
  - Chromium crashing or being killed externally, for example an agent
    killing `chrome.exe`;
  - every `openStore` failing, for example a 30 s `goto` timeout, and then
    the `after` hook closing the browser.
- **Sibling harnesses under fault injection.** They were not individually
  run with a killed browser. They were covered by the type check and the
  passing package run only.
- **Two-session finally in auction.** In `browser.test.ts`
  `finally { await first.close(); await second.close(); }`, a non-browser-loss
  context-close error on `first` would still skip `second`. Not changed.

## Open questions or contradictions found

- **`settleIn`'s 15 s bound.** Under 16 copies on 8 cores, plus other lanes,
  7 of 16 copies failed it. Its wait is for a 4 s site timer.
  - I did not loosen it: it fails loudly, and raising bounds to absorb
    starvation is not a root-cause fix.
  - The supervisor may want a ruling on what overload level these browser
    files must survive.
- **Backstop outside my brief.** `node --test --test-force-exit` in
  `apps/scenario-lab/package.json`'s `test` script would turn any future leak
  into an exit instead of a hang. It is outside my owned paths, so I did not
  change it.
- **Brief vs. comment.** The brief says the file "passes 6/6 in 36 s" alone.
  Here it passed alone in 18–20 s on the fixed build, and in about 34 s each
  under 8 copies.
