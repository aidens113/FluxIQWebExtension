# t996 report: the preflight meets each site's own person check

## Outcome

Done. The S6 preflight now runs a site-challenge stage on every site that declares person checks. It passed on all four:
everything-store, crossborder-marketplace, bigbox-retail and company-website. `siteChallenge` is `passed` in each
`preflight.json`, with `protocolPassed: true`, `gaps: []`, `runtimeFailure: null`. The other five sites still record
`not_declared`. No product defect was found, so no Core or extension edit was made or proposed.

## What changed and why

Reused, not copied: `attemptPersonFor` (the person the live attempts already play, answering in the chat),
`playPersonCheck` and each module's `steps`, `pendingPersonAsks`, `armScenarioVariant`, and `openLiveAttemptSession`.

New, all under `packages/test-runner/src/attempt-lane/preflight/`:
- `scripted-session.ts`: the scripted-model session opener, lifted out of `permission-probe.ts` (which now calls it, behaviour unchanged).
- `site-challenge/plan.ts`: how the check is brought up. A module's required hand-off row that names a variant arms that variant (everything-store `robot-check`, crossborder `timed-check`). The two sites whose check the page raises (bigbox, company-website) are raised by the Lab.
- `site-challenge/raise-check.ts`: the Lab does what a visitor does. Bigbox: three results loads, so the third is the bot check. Company: decline cookies, close the chat greeting and the offers popup, fill the quote drawer, press Send request. The Lab raises it; the product never does.
- `site-challenge/probe-script.ts`, `probe-sink.ts`: a scripted model that only reads the page once and says done. It never presses, types into or reloads anything, so a check can be met only by the product. It records yes/no and field names only, never page text.
- `site-challenge/prove-site-challenge.ts`: arms the check and waits until a declared check shows. The chat starts the task. It waits for a pending person-needed ask on the thread, and for the chat to show "FluxIQ needs you". Only then does the Lab's person start, pass the check through the module's own steps and press Continue in the chat. Then it waits for the run's read on the restored page, and cancels the build.
- `site-challenge/judge.ts`: the verdict by stage: `arm`, `hand_off`, `person_pass`, `continue`, each with a closed code. "Product touched the check first" is caught by the person module's own `tampered` (everything-store: wrong answers or a new image before the person came), which makes the person decline.
- `evidence.ts`: new optional `siteChallengeFailure {stage, code}`. A failed challenge is now a gap (`site_challenge_failed_<stage>_<code>`), so the command exits 1.
- `run.ts`: runs the stage when a site declares checks, writes `site-challenge.json`, records `passed`/`failed`.
- Tests: `site-challenge/tests/{judge,plan,probe-script}.test.ts`, plus a case in `tests/evidence.test.ts`.

Decision to confirm: bigbox's check is declared not person-only (it counts down and passes by itself, its module has no
hand-off row). On it the product waited the check out and never asked a person. The judge accepts that as
`how: "waited_out"` only when the site's rows do not require a person, and only after a read succeeded on the restored
page. For a site whose rows require a person (everything-store, crossborder timed-check), a check that lifts without one
fails (`required_person_check_cleared_without_a_person`). So bigbox's "passed" means "waited out", not "handed off". If you
want bigbox to be handed to a person instead, that is a product change (the extension waits out self-clearing checks on
purpose, `domain/src/actions/check-wait.ts`), not a preflight one.

No scenario `person-check.ts` was edited.

## Commands run and observed results

All with `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs run <label> -- ...`, one at a time, from `fxwork/t996/!FluxIQWebExtension`.

- `pnpm --filter @fluxiq-web-extension/test-runner check`: first run failed on my own file (an untyped `catch` result) plus missing `browser-host` dist errors; after building `browser-host`, `test-contracts` and `test-evidence` in this worktree and fixing mine, `grep -c "error TS"` on the log -> `0`. After the last edit (a comment-only change in `raise-check.ts`) the check was not rerun.
- Preflight tests (built `dist`, `node --test dist/attempt-lane/preflight/tests/*.test.js dist/attempt-lane/preflight/site-challenge/tests/*.test.js`) -> `# tests 14`, `# pass 14`, `# fail 0`.
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (258 warning(s), 551 baselined)`. It failed twice on my code first (`as never` casts; undocumented swallowed `catch`), both fixed.
- Preflights, `node scripts/lab/run-lab.mjs offline-preflight <site> --task <task> --evidence test-runs/t996-preflight-<site>[-vN]`, visible Chrome, no provider:

| Site | Task | Armed by | How it ended | Result dir |
| --- | --- | --- | --- | --- |
| everything-store | everything-store-plus-earbuds-under-50 | variant `robot-check` (first-page-earbuds) | person typed the characters and pressed Continue shopping, answered Continue in the chat, read succeeded | `test-runs/t996-preflight-everything-store-v2/` |
| crossborder-marketplace | crossborder-marketplace-free-hubs-under-ten | variant `timed-check` | person pressed Verify you are human, answered in the chat, read succeeded | `test-runs/t996-preflight-crossborder-marketplace/` |
| bigbox-retail | bigbox-retail-new-store-cheapest-towels | Lab's three results loads | check lifted by itself, no ask, product waited, read succeeded (`how: waited_out`) | `test-runs/t996-preflight-bigbox-retail-v2/` |
| company-website | company-website-apprentices | Lab sent the quote form | person pressed Confirm you are human, answered in the chat, read succeeded | `test-runs/t996-preflight-company-website-v7/` |

Each `site-challenge.json` records `armedCheck`, `askOnThread: true` and `askInChat: true` (except bigbox), the person's `handOff` (`did: cleared`, `answer: person_done`, `via: chat`), and `after.readSucceeded/checkGone: true`. The final CLI line on each: `{"protocolPassed":true,"siteChallenge":"passed","gaps":[],"externalUsd":0,...}`.

Runs that failed on the way (each cause was in the Lab's own raising, owned paths, fixed and rerun):
- bigbox v1: the check lifted by itself and the judge called it a failure (`check_cleared_without_a_person`); fixed by the `waited_out` rule above.
- company v1/v2: `locator.fill` timed out because `goto(...#quote)` on the same page does not reload, so the drawer never opened; now it clicks Get a free quote.
- company v3: a click timed out behind the consent banner; now declined first.
- company v4-v6: the person could not click the check because the offers popup (opens 4 s after load) covered it; the screenshot `test-runs/t996-preflight-company-website-v6/site-challenge-person-failed.png` showed it. The raiser now closes the chat greeting and the popup as a visitor would.
- Failed-run dirs are left in `test-runs/` (ignored): `t996-preflight-bigbox-retail`, `t996-preflight-company-website`, `-v2` to `-v6`, `t996-preflight-everything-store`.

## Not verified

- The crossborder result was produced by an earlier build of this code (no `how` field in its JSON); the person path itself was unchanged afterwards. Everything-store was rerun on a later build; neither was rerun on the final one.
- The probe's read is `core.run_node` of `web.output.dom-capture_snapshot` with no parameters. "Read succeeded" means the result has no `ok:false`, `error` or `code` and the page no longer shows the check; the actual contents of the read were not inspected (the keys are in `site-challenge.json` `model.readResultKeys`).
- Company's check was raised by the Lab's own press of Send, not by a product act, and the quote it sends is a fixture quote. The campaign's quote-request path (the product filling the drawer) was not exercised.
- `model.decisionRequests` is 4 to 6 on three sites, more than the two the script needs: the build asked again after the script's `complete`, then was cancelled. Not investigated.
- `check` was not rerun after the last comment-only edit; the 14 tests were run on the build before it.
- The extension's chat showed the ask as text `FluxIQ needs you`; the exact UI (buttons, overlay) was not reviewed beyond that string being visible.
- Pairing/permission stages of these four runs were not re-read; only `gaps: []` and `runtimeFailure: null`.

## Open questions or contradictions found

- Bigbox: should a self-clearing check be handed to a person? Today the product waits it out (by design); see above.
- The brief names result dirs `t996-preflight-<site>`; reruns needed a fresh dir each time, so the passing ones carry `-v2`/`-v7` suffixes (crossborder has none).
- `browser-host`, `test-contracts` and `test-evidence` had no `dist` in the t996 worktree (it was started with no workspace build), so `pnpm check` and the tests failed until they were built. Built here only; not a source change.
