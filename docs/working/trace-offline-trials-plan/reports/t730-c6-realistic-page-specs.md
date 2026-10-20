# t730-c6 realistic page specs: report

## Outcome

Done. Both failures came from out-of-date specs. In each case the site was changed on purpose, with unit tests, after the specs were written on 2026-09-21. I fixed both specs and kept the intent of each test. I did not touch any scenario source or manifest.

## What changed and why

### 1. local-classifieds.spec.ts:183 (now :186)

- **Cause.** Commit `7e360eb0` (2026-09-29, t184, "Every live task on the ten realistic scenarios is sound...") added the `only-the-offer` fact to the `offer-on-folding-bike` playbackGoal and to finalState. It also added `conversationText` in `readouts.ts`. The fact's doc comment says why: the instruction says to offer and nobody else, so a run that also presses Send on the ready-made "Hi, is this still available?" must fail the goal. Before this fact existed, the receipt and Buying count let such a run pass. The commit also added a unit test in `src/scenarios/local-classifieds/tests/browser.test.ts` ("offer: pressing Send on the ready-made message, then offering once the rate limit allows, misses the goal"). That test asserts that only `only-the-offer` fails, with the actual text "You've sent Morgan Tate 1 message and 1 offer".
- **Decision.** The spec is out of date. The manifest and the site agree, and they match the task's intent (the task can be done and is unambiguous). The spec's final `factsHold(page, offerGoal)` would accept a run the instruction forbids, so changing the oracle to make it pass would weaken it.
- **Fix.** I renamed the test to "...until the rate limit has passed, and misses the goal". It now checks four things:
  - Every goal fact except `only-the-offer` holds, so the offer did go through once the rate limit passed.
  - `marketplace_conversation` reads "You've sent Morgan Tate 1 message and 1 offer".
  - `only-the-offer` fails, checked with `factFails`.
  - Only the ready-made message was sent (this check was already there).

### 2. social-network-feed.spec.ts:313

- **Cause.** Three commits added hidden oracle readouts to `markup/shell.ts`. They are `<script type="application/json|text/plain" data-testid=...>` elements, and the page script rewrites them after every change:
  - `0bbd0141` (2026-10-07, "Add final four scoped qualification fixtures"): `social-request-audit-account`
  - `59f2f0c8` (2026-10-13, "The confirm-requests oracle fails a Flow that confirms a request not asked for"): `social-friend-request-<id>`
  - `b9cd46cb` (2026-10-17, "four breadth tasks on social-network-feed with exact oracles"): `social-account-changes`

  The qualification and breadth expected facts read these subjects, for example `qualification/*/expected.ts`.
- **Decision.** The spec is out of date. The readouts are oracle subjects inside `<script>` elements, which the browser never renders. They are not visible and not interactive, so they give an automation no hold on the feed. The point of the test still holds: the build marker is the only test id on anything a person sees. Removing the readouts would break the oracles.
- **Fix.** The assertion now has two parts:
  - Among elements that are not `<script>`, the only test id is `build-marker`. This is the original check, still strict.
  - Every `<script>` test id matches `^social-(request-audit-account|account-changes|friend-request-rq_[0-9a-z]+)$`. The account readout, the changes readout and at least one friend-request readout must all be present.

  A test id added later to a visible element, or an unexpected script id, still fails the test.

## Commands run and observed results

From `apps/scenario-lab` in the t730 worktree:

`node_modules/.bin/playwright test -c e2e/playwright.config.ts local-classifieds.spec.ts social-network-feed.spec.ts --headed --reporter=line`

Result: `Running 33 tests using 4 workers` ... `33 passed (3.5m)`, headed, including:
- `local-classifieds.spec.ts:186 ... and misses the goal`
- `social-network-feed.spec.ts:313 the build: class names move ...`

Scenario source was not changed, so no scenario build or `node --test` run was needed.

## Not verified

- I did not re-run the scenario's unit tests (`browser.test.ts`). I only read them to confirm the site's intent; none of them changed.
- The brief mentions "41" tests. These two files have 33 between them, so the other 8 presumably come from other scenario-lab specs, which I did not run.
- I did not run a typecheck of the spec files on their own. Playwright compiles them, and they ran.

## Open questions or contradictions found

None. In both cases the manifest, the site and the scenario's unit tests agree with each other, and only the 2026-09-21 specs disagreed.
