# t730-c5-digest-flake: live-state-digest flake and the actionability-gate rows

## Outcome

Partial.

- **live-state-digest.** The spec itself does not flake. Its test body passed every time in this
  session: 35 headed runs in all, including a clean `--repeat-each=10` run (10/10). The "hangs" are
  not in the test. They happen between repeats, while a new Playwright worker starts up and loads
  the spec's imports. On this memory-starved machine, one startup took more than 4 minutes. Waiting
  on page state would not fix that, so I did not change the spec. Its file is exactly as t730-b6
  left it.
- **actionability-gate.** Two of the three failing rows had stale expectations, and I fixed both.
  These are the two bigbox check rows, which now pass 5/5 headed. The third row is the inert upload,
  and it is a **product defect**. I did not fix `src/`, as the brief asked; it is described below.
  That row still fails on every run.

## What changed and why

Changed: `apps/extension/e2e/content/tests/actionability/tests/actionability-gate.spec.ts` only.
I added temporary trace logging to `live-state-digest.spec.ts`, then restored the file
byte-for-byte from a copy taken before the edit. `grep -c c5` on the file prints 0.

### The bigbox check rows had stale expectations

**Row 1, "refused behind the consent scrim".** This row is stale since 2026-09-28.

- Commit 260a4e17 ("…a dialog no longer stops a click") made every verb absorb the obstruction
  codes, mutating verbs included. The commit message says: "Every verb now absorbs the two
  obstruction codes, dismisses the overlay by its own affordance and retries".
- The code is in `action-runtime/recovery/fault.ts`. `OBSTRUCTION_FAULTS` holds
  `BLOCKED_BY_DIALOG → "blocking_dialog"`, and the comment there reads "Every verb absorbs them,
  mutating or not".
- So the gate's BLOCKED_BY_DIALOG refusal is no longer the command's answer. The recovery presses
  the dialog's way out ("Reject all") and checks again.
- The row was written on 2026-09-22 (af9bd66b), before that change.
- Observed reply, when it arrived before the page unloaded: `"actual": "the checkbox is checked;
  the execution recovered on attempt 2 after absorbing blocking_dialog, closing 1 dialog the page
  had put in the way, waiting 150 ms"`.

**Both rows: "Execution context was destroyed".** This error is stale harness behaviour, not a
product defect.

- bigbox's facet sets `location.href` on `change`. That handler has been unchanged since the
  scenario was added (5e02cf69, 2026-09-21).
- `setCheckedState` has waited 50 ms after the press before reading the box back since 4d7a1447
  (2026-10-06): `await new Promise(... setTimeout(resolve, 50))` in
  `action-runtime/checkable-state/checkable-state.ts`.
- In that 50 ms the facet's navigation usually commits, so the content script's reply dies with the
  page.
- The product handles this case in the background on purpose. 8c55eeb0 (t407, 2026-10-10) is titled
  "A check or choice whose reply a page reload lost is judged from the new page". It names "bigbox's
  facets" as the case it fixed, and the code is in `runtime/click-landing.ts` and
  `runtime/requested-state/`.
- The T2 harness has no background, so the rows never got that judgement.

**The fix, in the spec only.**

- `runNavigatingCheck` returns the reply, or `"lost"` when `page.evaluate` dies to the navigation.
- `expectPickupFilterSet` then judges the check the way t407 does:
  - the address carries `facet=fulfillment_method%3APickup`;
  - the new document's facet box is checked;
  - a reply that did arrive is `succeeded`/`passed`, with `actual` starting "the checkbox is
    checked".
- Row 1 is renamed "…is not set through it; the dialog is answered first". Its oracles:
  - The scenario state goes from `consent: "pending"` before to `consent: "rejected"` after. If the
    box had been set through the scrim, consent would still be pending, because the navigation
    would have left first.
  - The dialog is gone.
  - When the reply arrived, its `actual` contains "after absorbing blocking_dialog, closing 1
    dialog".
- Row 2 now also waits for `consent: "accepted"` before it checks.
- The file header explains both changes and names the commits.

### Inert upload: a product defect, reported and not fixed

- **What fails.** The row expects `web.target.not_shown` / `target_not_found`, and the product
  returns `web.target.not_actionable` / `unexpected_state`.
- **The cause** is in `apps/extension/src/content/actions/upload.ts`.
  - Line 41: `if (unusable) return deps.rejected(action, startedAt, "disabled", expected, unusable,
    evidence);`
  - `unusableReason` returns "the file input is inert" (line 74), but the refusal travels under the
    reason word `disabled`.
  - `results.ts` `PAGE_STATE_CODES` maps `disabled` to TARGET_NOT_ACTIONABLE.
- **Why the row is right and the product is wrong.**
  - ba9fea58 (t193-1002m, 2026-10-03) made a "target that is there and not shown" into
    `web.target.not_shown`. It changed this row's expectation, with the comment "An inert control is
    one the gate calls `hidden`".
  - It left `upload.ts` alone. That code dates from af9bd66b, 2026-09-22.
  - The authored contract, `docs/architecture/failure-taxonomy.md` ("`TARGET_NOT_SHOWN` is the
    gate's third reason, `hidden` … `display:none` …, no box, not rendered, **inert**, …"), puts
    inert under TARGET_NOT_SHOWN.
  - So the newer, documented intent is the row's. The upload verb lags behind it, and the row has
    probably failed ever since t193.
- **Fix, for the supervisor to decide.**
  - Send the inert case with reason `"hidden"` and keep `disabled` for a disabled input. Line 41
    would need to tell the two cases apart.
  - `recovery/fault.ts` treats TARGET_NOT_SHOWN as `obstructed_target`, so an inert upload would
    then be retried after layer clearing. That is the behaviour the upload.ts comment wants for
    everything-store's notification prompt.
  - The unit test for upload refusals would need the same change.

### live-state-digest: the cause of the "hangs"

I added logging to a scratch file: timestamps at each phase, every gateway action, the provider
turns, a result summary, a 5 s heartbeat in each worker, and process uptime at module load. It
showed the following.

- **Every test body completed with all assertions passing.** Each run printed the same result:
  - steps `before/after` digests formed the chain A→A, A→B, B→A, A→C;
  - `stateDigestFailures: []`, `replayable: true`, `stateChainIntact: true`;
  - dropped reasons `observation_only, undone, undone`;
  - the panels were asserted, and `afterEach` was logged.
- **`--repeat-each` gives every repeat a fresh worker.** Each repeat ran in a new process: a new pid
  every time, and the old one logged `process exit` about 3–20 s after `afterEach`.
- **Each new worker loads the whole import graph again**: the domain package's `src/index.ts`
  barrel (469 non-test `.ts` files, transformed by Playwright), Core's `automation-studio`, and the
  harness's scenario-lab registry. Measured from the process's own uptime when the spec module
  finished evaluating:
  - the runner process: 264 s;
  - workers in a quiet period: 15–27 s;
  - one stall snapshot: a new worker created 13 s after the previous `afterEach` took 87 s to load
    the module, using CPU while its working set grew from 325 to 412 MB;
  - in run 6, the third pair of workers never finished loading in over 4 minutes.
- Free memory during these runs was 1.2–2.6 GB of 12 GB, with other workers' Playwright and tsc
  processes running in the same tree.
- **The test timeout does not cover module loading.** The 120 s test timeout never fired. Playwright
  listed the stuck tests as "did not run", or as `x … (0ms)` when the run was killed. That matches
  t730-b6's "hang" with no test error, and both of my unbounded first runs.
- **The same stall happens without this spec's Core runtime.** `field-entry-target-stability.spec.ts`
  imports the same domain barrel. Run with `--repeat-each=2` (comparison only, not edited), its
  second round stalled the same way: tests 3 and 4 never started, and the run was killed at 400 s
  ("worker process exited unexpectedly (code=143)").
- **The site traps the brief listed are already handled, and never showed up in any body.**
  - The notifications prompt and cookies are answered through `/api` before the search page loads.
  - Each test starts its own Lab, so there is one search per session and no 4th-search cover.
  - `loadWholeFeed` scrolls through every batch and presses "Try again".
- **One more cause of earlier failures: a shared artifacts directory.** Concurrent `test:content`
  runs by other workers in this tree deleted `test-results/content/artifacts` under a running test.
  That produced `ENOENT … .playwright-artifacts-N` and teardown timeouts in my first actionability
  run, and in t730-b6's runs. With `--output=<my scratch dir>`, that never happened again.

## Commands run and observed results

All runs are headed, Chromium, from the tree root. `S` is my scratchpad directory. `--output` and
`--reporter=list` are CLI flags only, used to isolate artifacts from the other workers' concurrent
runs. No config was edited.

1. `pnpm --filter @fluxiq-web-extension/extension test:content -- content/tests/exploration-state/tests/live-state-digest.spec.ts --headed --workers=2 --repeat-each=10` (wrapped in `timeout 590`)
   → 4 passed, then tests 5 and 6 sat at "0ms" until the kill (exit 143).
2. `pnpm … test:content -- content/tests/actionability/tests/actionability-gate.spec.ts --headed --workers=2`
   → `3 failed / 3 passed (4.5m)`. The 3 failures are the 2 bigbox check rows ("Execution context
   was destroyed") and the inert upload. Also seen: ENOENT on `.playwright-artifacts-0/1`, and
   "Test timeout of 30000ms exceeded" in teardown.
3. digest `--repeat-each=10 --output=$S/pw-c5-out --global-timeout=500000` → `2 passed`, `8 did
   not run` (stalled in worker startup).
4. digest with logging, `--repeat-each=6` → first try: all 6 failed at import, because another
   worker was moving `bigbox-retail/pages/account-recovery-panel.ts` at that moment ("Cannot find
   module"). Next try: `3 passed, 3 did not run`.
5. Retargeted check rows: `… actionability-gate.spec.ts --headed --workers=2 -g "check:"` → `2
   passed`.
6. digest with logging, `--repeat-each=6` (run 6) → `4 passed, 2 did not run`. All 4 bodies passed
   their assertions, and the third worker pair never loaded.
7. digest with logging and the stall watcher, `--repeat-each=10 --global-timeout=540000` (run 7) →
   `8 passed, 2 did not run`, at about 2 min per repeat cycle (about 30 s of test).
8. digest with logging, `--repeat-each=4` (run 8) → `4 passed (6.6m)`. Uptimes at module load:
   runner 264 s, workers 27 / 27 / 15 / 19 s.
9. Comparison: `… field-entry-target-stability.spec.ts --headed --workers=2 --repeat-each=2` → `2
   passed, 2 failed` ("worker process exited unexpectedly (code=143)", which is the kill at 400 s
   during the second round's startup).
10. **Final digest run**, spec restored, no global timeout: `… live-state-digest.spec.ts --headed
    --workers=2 --repeat-each=10 --output=$S/pw-c5-out --reporter=list` → **`10 passed (11.9m)`**,
    exit 0, each test 24–35 s.
11. Final gate run, first version of the fix: `… actionability-gate.spec.ts --headed --workers=2` →
    `2 failed / 4 passed`. Row 1 failed because that time the reply outran the navigation and
    `actual` carried the recovery account after "the checkbox is checked;". I relaxed the match to
    `^the checkbox is checked(?:;|$)` and added the explicit "after absorbing blocking_dialog" check.
12. `… --repeat-each=3` (run before the step 11 edit was applied) → `3 failed / 15 passed`, all 3
    failures the inert row.
13. **Final gate run**: `… actionability-gate.spec.ts --headed --workers=2 --repeat-each=5
    --output=$S/pw-c5-gate --reporter=list` → **`5 failed / 25 passed (1.3m)`**. The 5 failures
    are only the inert upload row, every repeat: "Action rejected: the file input is inert";
    expected `web.target.not_shown`/`target_not_found`, received
    `web.target.not_actionable`/`unexpected_state`. Both check rows, the hidden and disabled upload
    rows, and the scroll row passed 5/5.

Totals for live-state-digest across this session: 35 bodies started and 35 passed. 0 failed inside
a test. Every non-pass was a worker that never got to load.

## Not verified

- **No typecheck.** The specs were not run through `tsc`, and Playwright only transpiles them.
  `expect.stringMatching` inside `toMatchObject` and `(await harness.finalState()).state` (typed
  `object`) in `toMatchObject` are not type-checked.
- **How often row 1 takes each branch.** I did not count how often the check reply arrives versus
  being lost. Both branches are asserted, and the reply branch was observed once (step 11).
- **Firefox and the chromium-baseline configs** were not run.
- **Which import dominates worker startup.** I did not split the load time between the domain
  barrel, Core and the scenario-lab registry. A probe inside the spec could not separate them,
  because the static imports are already cached by then.
- **t730-b6's in-body hang.** It reported "runAction hung … `page.evaluate: Test ended`" in one
  run. I did not reproduce it in 35 bodies with an isolated output directory. Its runs shared
  `test-results/content/artifacts` with concurrent runs, which I saw causing ENOENT and teardown
  timeouts, but I did not prove that link.

## Open questions or contradictions found

1. **The inert upload code (product call).** Route `upload.ts`'s inert refusal through `"hidden"`,
   so it becomes TARGET_NOT_SHOWN as the taxonomy doc and t193 intend. The alternative is to amend
   the doc and the row to say inert uploads are TARGET_NOT_ACTIONABLE. I recommend the first; it is
   a small src change plus its unit test.
2. **Making repeated runs of Core-importing specs affordable.** This belongs in the harness or the
   config, which I may not touch. With `--repeat-each`, every repeat pays the full worker import.
   On this machine that is 15 s to more than 4 min, depending on memory pressure. Options:
   - give each content-harness run its own `outputDir` by default;
   - have the specs import the domain's built `./node` entry instead of the `src/index.ts` barrel;
   - set a larger `--global-timeout` for flake runs.

   The first also removes the cross-run ENOENT problem.
3. **Other workers' runs share this tree's `apps/extension/e2e/test-results/content/artifacts`.** A
   concurrent `test:content` run clears it. Any worker validating headed specs in this tree should
   pass `--output` to a directory of its own.
