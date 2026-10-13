# t492 (downstream half): the confirm-requests oracle catches over-confirmation

## Outcome

Done. Before this change, a run of `social-network-feed` / `confirm-requests` that confirms all eight friend requests passed the oracle whenever its final read still returned the four expected rows. That was trial 1 of run-mv6bg8sv-99895ba1 (item D6). It now fails, and the failure names each of the four people (Tom Becker, Priya Nair, Diego Alvarez, Marta Kowalczyk) whose request should have stayed pending. The honest run still passes.

## What changed and why

All the work is under `apps/scenario-lab/src/scenarios/social-network-feed/`.

- **New `oracle/` module** (with an `index.ts` barrel and one export per file):
  - `answers-subject.ts`, `friendRequestAnswerSubject(id)`: returns the test id `social-friend-request-<id>`.
  - `request-answers.ts`, `friendRequestAnswer(requests, id)`: returns the server's answer to one request. That is `pending`, `confirmed` or `deleted`, and an unanswered request is written out as `pending`, so a fact can check that a request is still pending.
  - `confirm-requests-facts.ts`, `confirmRequestsFacts(minimum)`: returns one fact per request, using predicate `text`. Requests with at least `minimum` mutual friends must read `confirmed`; every other request must read `pending`. Fact ids name the person, for example `request-tom.becker.9-pending`.
- **`markup/shell.ts`**: every page now carries one `<script type="text/plain" data-testid="social-friend-request-<id>">` per request, rendered from `state.requests`. This is the server's own state, not the text the page shows. The existing `mutate` wrapper, which already keeps the `social-request-audit-account` JSON current, now also rewrites these eight elements after every server answer. The live page therefore reads exactly what a fresh render would, even without a reload. Both helpers are self-contained so that their `.toString()` can run in the page.
- **`manifest.ts`**: `confirm-requests` `expected.finalState` is now `[path(.../friends/requests/), ...confirmRequestsFacts(5)]`. The threshold is a named constant (`MUTUAL_FRIENDS_TO_CONFIRM`) that the `QUALIFYING` list also uses. The `expected.extracted` dataset is unchanged.
- **"Confirmed exactly once"**: no counter is needed. `mutateFeedState` records one answer per request and ignores any later confirm or delete. A test checks that pressing Confirm again on all four leaves every fact holding.
- **Why `text` rather than `contains` on a single JSON element**: my first version used one JSON element and `contains` facts. The scenario's browser spec (`apps/scenario-lab/e2e/social-network-feed.spec.ts`, which I do not own) has an `expectFacts` that throws on `contains`, so I switched to one element per request. `text` is supported by every fact evaluator: the Lab's `scenario-assertions.ts` and that spec.

### How the Lab judges final-state facts beside the expected dataset (`judgeBy`)

This needed no change in `packages/test-runner`. The judging module is `packages/test-runner/src/flow-lane/creation/oracles.ts` (`judgeCreatedFlowOracles`), called from `lane.ts:488-489`.

- **`judgeBy: "expected-dataset"`**: the stored records are judged against `expected.extracted[step]`. When the workflow declares a `finalState`, it is also judged through `judgeFinalState` (`run-scenario.ts:345`), which evaluates `finalStateFacts(scenario, workflow)` (`lane-rules/final-state-facts.ts`) with the Playwright fact probe. A run passes only when both oracles hold (`createdFlowOraclesHold`). When only the final state fails, the failure reads "stored the expected records, but the scenario's final state did not hold afterwards (facts not held: …)".
- **`judgeBy: "playback-goal"`**: only the final state is judged: the workflow's `finalState` plus, for the primary workflow, `playbackGoal.successFacts`.
- **Replays (`--replays`)**: `checkGoal` calls `findScenarioPageWithExpectedState`, which asserts the same `finalStateFacts`.
- **Recovery matrix**: `run-matrix-case.ts:147` also judges with `finalStateFacts`.

Because the new facts sit in the workflow's `finalState`, builds, replays and the recovery matrix all apply them, and the dataset oracle is kept as it was.

## Commands run and observed results

- **Fail-first** (new test, original manifest from `git show HEAD`): `node --test dist/scenarios/social-network-feed/tests/confirm-requests-oracle.test.js` printed `# pass 2 # fail 3`. Tests 1, 3 and 4 failed: no per-request facts were declared, the over-confirm run was not rejected, and the confirm-one-extra, delete-one and miss-one runs were not rejected. With the change: `# pass 5 # fail 0`. (An earlier fail-first run against the first `contains` design printed `pass 1 fail 4`.)
- **Scenario-lab compile**: `node scripts/build-scenario-lab.mjs` emitted with no errors.
- **Tests in the touched directories**: `node --test dist/scenarios/social-network-feed/tests/*.test.js dist/scenarios/social-network-feed/qualification/tests/*.test.js dist/scenarios/tests/*.test.js` printed `# tests 60 # pass 60 # fail 0`.
- **Typecheck**: `pnpm run check` (scenario-lab, src and e2e tsconfigs) printed no errors. `npx tsc -p tsconfig.json --noEmit` gave `tsc exit 0`.
- **Browser spec** (Playwright, fixture server only; no Lab, no extension, no provider): `npx playwright test -c e2e/playwright.config.ts e2e/social-network-feed.spec.ts -g "confirm requests"` printed `2 passed (30.0s)`. The honest-path spec runs `expectFacts(page, workflow.expected.finalState)` on the live page after the confirms, with no reload, so the client-side rewrite of the eight elements works in a real browser. The first `contains` attempt failed here with "Fact predicate contains is not used by this fixture", which is what led to the redesign.
- **Structure audit**: `node scripts/structure-audit.mjs` printed `structure-audit: passed (188 warning(s), 646 baselined)`, plus "1 baseline entries can be lowered". None of the warnings name social-network-feed. I did not run `pnpm structure:baseline`, because the baseline is not mine to edit.

## Other realistic scenarios: tasks whose oracle may not see an over-act

I worked these out from the manifests and fact definitions only; none of them was run. "Over-act" here means acting on more items than asked, of the same kind.

**Probably blind to an over-act:**
1. **job-board `apply-quillmark` (and `-check-first`)**: `finalState` is only `application-reference` text, the receipt for one application, plus a one-record dataset. A second application to one of the lookalike postings (contract, London, Quillmark Labs) would leave the same receipt and records.
2. **company-website `book-service`**: `finalState` reads `booking-deposit` and `booking-service` text on the booking receipt. A second booked slot is not counted.
3. **company-website `quote-request`**: the goal reads the receipt (`quote-reference`, service, contact, marketing) and the path. A second quote request is not counted. local-classifieds needed `ONLY_THE_OFFER` for exactly this reason.
4. **everything-store `buy-kettle`**: `ORDER_FACTS` catches extra lines inside the order (`order-line-2` absent). It reads one confirmation, so a second order is not seen.
5. **bigbox-retail `pickup-order`**: `ORDER_FINAL_FACTS` (cart emptied, one saved) plus the order record. A second order placed after the first is only caught if it changes the record that is read. This is weak and I did not verify it.

**Unclear:**
- **photo-social `moon-jar-price`**: `one-question-sent` counts the outbox to Saltmarsh Goods. Messages to other shops depend on what the `outbox` subject covers, which I did not read.

**Over-act visible:**
- **whole-account state facts**: auction `watch-endings`, `place-bid` and `remove-watched-accessories`; professional-network `withdraw-stale-requests` and `invitation-allowance`; job-board `save-halvard-week` and `remove-closed-saved-jobs`; local-classifieds `save-dining-tables`, `make-offer` and `remove-sold-saves`; photo-social `glaze-collection` and `extend-studio-inspo`; everything-store `restore-saved-cloths`; bigbox `ensure-soap-quantity`; company-website `review-service-without-booking`.
- **counts or exact list text**: everything-store `kettle-to-cart` (subtotal "3 items", "Saved for later (3 items)"); crossborder `buy-hub` (orders 1, cart 0); crossborder `hub-to-cart` (Cart (3) plus coupon text); crossborder `collect-official-coupon-only` (account JSON); bigbox `pickup-cart` ("4 items · Subtotal").

## Not verified

- No Lab live run, no Lab provider-free run and no provider call, as the brief required. The new facts have not been exercised through `run-scenario.ts` `judgeFinalState` or through replays. They reach those paths only by declaration, which I confirmed by reading the code.
- I did not run the full `pnpm --filter scenario-lab test` or `pnpm check`, under the repository's full-suite rule. I did not run the extension's `apps/extension/e2e` specs that mention this scenario.
- Whether the model's page view shows the `text/plain` script elements. The existing `social-request-audit-account` JSON script sets the precedent, and the page shows no visible text for them.
- The survey of the other nine scenarios comes from reading manifests and fact definitions, not from running any over-act.

## Open questions or contradictions found

- The brief says "confirmed exactly once". The server cannot record more than one answer per request, so in server state "confirmed" already means once. If the intent was also to catch repeated presses, that would need a count of confirm attempts. That is a page-behaviour question, not a server-state one, and I did not add it.
- The structure audit reports "1 baseline entries can be lowered". It looks unrelated to this change, and the supervisor's own checkout already has a modified `.structure-baseline.json`.
