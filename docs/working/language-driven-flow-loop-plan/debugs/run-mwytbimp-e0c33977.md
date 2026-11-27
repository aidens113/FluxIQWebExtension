# run-mwytbimp-e0c33977: bigbox new-store cheapest towels, the saved Flow stopped at its page-"2" click

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, `--attempts 4`,
`claude-sonnet-5-5` for build and judge, fluxiq 0.54.34. This run came after t1071, t1074 and t1075. The lead stopped it
during attempt 3. It was debugged offline from:

- the step files (`C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwytbimp-e0c33977/steps/`);
- the Lab log (`bigbox4.log`);
- the run's own stores (`fxwork/t1015-paid-bigbox/test-runs/instances/paid-bigbox/.attempt-work/run-mwytbimp-e0c33977/fluxiq-root/.fluxiq`,
  `project.sqlite` tables `client_gateway_trace_events` and `client_gateway_trace_chunks` (deflated), `run_dataset_answer_rows`);
- the code in the lane tree and in the shared Core `fxwork/!FluxIQ`.

No live or paid run was made and no code was changed. Full report:
`docs/working/page-diff-delivery-plan/reports/run-mwytbimp-bigbox.md`.

## What happened

| Attempt | Calls, cost | What it did |
| --- | --- | --- |
| 1 | 31 calls (28 decisions, 1 chat, 2 judges), $2.12 | Explored. Both "Sort by: Price low to high" tries failed (0014, 0026), so it read the list unsorted and went back and forth between results pages 1 and 2 (0020-0033). The repeat guard refused the next return (0034), and two loop decisions followed (0036, 0038). It then opened the $1.28 roll's product page and pressed Add to cart once (0042), read the cart, and was judged yes twice (0058, 0059). The saved Flow kept the page-"2" click as step 10. |
| 2 | 11 calls, $0.40 | The replay stopped at step 10 (`web.target.ambiguous`, 0068-0071, 4 tries each, `effect: unacted`; note 0072). After that the model checked the cart and fought the draft's result step (0081 and 0083 refused `second_copy`, a loop steer at 0084). It never repaired step 10, and it completed achieved (0093, 0094). |
| 3 | stopped | The replay stopped at the same step 10 (0103-0107). |

## Why

1. **Step 10 is the click on results page link "2", and its saved identity had lost everything that says which link it is.**
   - The command sent at 10:06:17 is trace event row 585. Its target is `main > div > section > nav > a:nth-of-type(2)`,
     `accessibleName: "2"`, `classNames: ["css-1foc4gr"]`, `context: {landmark: "navigation"}`, **`readsWords: true`**, and
     **`href: "/scenarios/bigbox-retail/search"`**, which is a path with the `page=2` query cut off.
   - The page answered (deflated trace chunk): `Target ambiguous: no exact match ... 16 scored candidate(s) tied: a "2" (0.51),
     a "ReorderMy Items" (0.42), a "Sign InAccount" (0.42), a "Pharmacy Delivery" (0.42), a "Registry" (0.42), and 11 more`.
     So one leader stood against a crowd of header links. The gap of 0.09 is under `TARGET_SCORE_MARGIN` 0.2
     (`apps/extension/src/content/identity/score.ts:146`).
2. **t1071's state-words rule wrongly marked the link "2" as a link whose words are state.**
   - `domain/.../plan-resolution/self-changing/state-words.ts` keys a control by its address. Here that address was a
     positional `:nth-of-type` selector, plus tag, id, test id and label (`:111-118`), and the pagination links have none of
     the last three.
   - The bigbox pagination (`apps/scenario-lab/.../bigbox-retail/pages/results-pagination.ts:15-20`) puts a "Previous page"
     `<a>` first only on page 2. So on page 1 `a:nth-of-type(2)` is "2" (`...Pickup&page=2`), and on page 2 it is "1" (`...Pickup`).
     The stored captures show both under xpath `.../section[1]/nav[1]/a[2]` (1 capture of "1", 10 of "2").
   - Two wordings and one query-less path (`destinationPath`, `:127-132`) met the rule (`of`, `:99-106`), so the link was
     marked `{destination: "/scenarios/bigbox-retail/search"}`.
   - The mark turned the words "2" into a value, which no longer counts as a veto or a corroboration. It also replaced the
     link's address with that path. Those two things, the words and the `page=2` query, were exactly what stays the same
     for this control.
3. **Nothing left could break the tie.**
   - `scoreReadTarget` sends a marked target to `ledToDestination` (`score.ts:215-217`). That function resolves only to a
     leader whose destination `confirms`, and it returns `ambiguous` as soon as any ranked candidate is `shared`
     (`:234-242`).
   - `destinationVerdict` (`destination/verdict.ts:61-67`) calls it `shared` when another visible real link has the same
     path. On this page that includes "1", "Next page", "Rollbacks & More", "Clear all" and the facet links, all
     `/scenarios/bigbox-retail/search?...`.
   - The veto needs a distinguishing signal that agrees exactly (`corroboration.ts:61`, `:70-76`: visible text, name, label,
     id, test id or drawing). Selector, class, landmark and place never count. With the words marked as a value, there was
     none.
4. **The step should not have been in the Flow at all.**
   - Draft step 10 (`next_page_2`) is `kept`, while steps 12-16 are `dead_end` (the `core.flow_draft` entry in request 0057).
   - Step 17 then navigates by URL to the product page, so page 2 is never used.
   - Core's dead-end rule (`fxwork/!FluxIQ/.../flow-authoring/draft/compose/dead-end.ts:16-40`) only marks a detour that
     returns to the same state digest. It found the detour 12-16 (page 2 to page 2) and not 10-15. Why the 10-15 bracket
     failed is not visible in the recording, because the draft does not print digests.
   - The model itself called step 10 "a dead end" (0027) but dropped only steps 21 and 22 (0055).
   - On bigbox, replaying it also loads a third results document, which is what raises the site's robot check.
5. **No double add.**
   - The replay never reached Add to cart: it stopped at step 10, and every try is `effect: unacted`.
   - Attempt 2 pressed nothing lasting live. It opened the cart (0075), read it (0079) and ran only the read (0090).
   - The site's attempt-2 record shows `change: {}`, activity `search-view` x2, and the cart still holds sku 5510204 at qty 1.
   - The checklist counted `a1` as done at step 18 (0092), which is t1075's carried act being recognised. The run gate's
     skip was never exercised.
6. **Why 31 calls.**
   - The first 6 decisions match run-mwynbry2 and run-mwyfc9uf almost byte for byte (0003 input 25,042 tokens against
     25,046 and 24,928). So neither t1074 nor t1075 bloated the prompt.
   - The run split at the sort. Both runs failed `dom-select` with `label: "Price low to high"`. run-mwynbry2's next guess,
     `value`, worked. This run guessed `option: {label: ...}`, which also failed (0026).
   - Both sends returned the verb's own words, `expected "an option named by value, label, or index"`, `actual "the command
     named none"` (8 stored validations, 4 tries x 2). The model received only `code: output_not_observed`, plus
     `undeclaredParameters: ["label"]` on the first.
   - The `option` parameter is shown to the model as a bare `{"id":"option","type":"object"}`
     (`domain/src/output-nodes/definitions.ts:355`, `:364`), although the action requires `{by, value|label|index}`
     (`domain/src/actions/schemas.ts:93-104`).
   - Without the sort, the task needed a 2-page scan. The page channel's per-request budget of 20,000 characters
     (`fxwork/!FluxIQ/.../llm/view-channel/budget.ts`) holds about one search page: page 1 is 11,762 characters (0012) and
     page 2 is 10,202 (0020). Both share one key, because the address drops `?` parameters.
   - So each visit retired the other page to a `{key, replacedBy}` reference (`view-channel/projection.ts:16-31`, `:106-125`),
     and page 2 was never read as rows. The model forgot what it had seen, and went p1, p2, p1, p2, p1 until the repeat guard
     stopped it (0023-0034, model text 0031: "Page 2 could hold something cheaper, so I'll check it first").
7. **Why $2.12.**
   - Each retirement rewrites an earlier record in place, so every later request has to rebuild the cache from that point
     (requests diff at `replacedBy`/`droppedAt`, for example 0027 to 0029 at byte 137,930).
   - 10 of the 28 decisions fell back to a cache hit at or near the system prompt. Attempt 1 wrote 482,628 cache tokens,
     about $1.21 of its $1.90 decision cost at the $2.50/M write rate that step 0029's bill implies.
   - run-mwynbry2's attempt 1 had the same pattern (142,480 write tokens of 14 decisions).

## Fixes (root causes; no caps)

| # | Fix | Where | Offline proof on this recording |
| --- | --- | --- | --- |
| F1 | Words are state only while the link's full destination (path and query, fragment aside) stays the same. Words that change together with the address mean two links sharing one position, so neither is marked. | `self-changing/state-words.ts` (`captured`, `of`, `destinationPath`) | Feed the two stored captures (xpath `nav[1]/a[2]`: "2" `...&page=2` and "1" `...Pickup`) to `createWebLlmStateWords`: today `of()` gives `{destination: ".../search"}`, after the fix nothing. Keep t1071's cart fixture marked (`/cart` both times). Then re-resolve trace row 585's target with words kept against the stored page-1 capture (`b3069613...` artifact): resolved to "2". |
| F2 | When a marked link's destination is `shared`, a rival counts only within the recorded control's own region (nearest landmark and its name: header, main pagination, dialog or drawer). Record the landmark's name and region in `context`, which today is only `{landmark: "navigation"}`. | `identity/destination/verdict.ts`, `identity/context.ts`, `score.ts:234-242` | t1071's cart fixture with a visible drawer "View cart" to `/cart`: ambiguous today, header link after. This page with F1 off: 16 candidates, and the header crowd at 0.42 leaves the pool. |
| F3 | A kept framework press with nothing lasting, whose page no kept step uses before a later navigation by URL, is left out (`replaced`). This applies whatever the state digests say. | Core `flow-authoring/draft/compose/` (beside `dead-end.ts`) | Drive compose with this run's draft steps (request 0057 `core.flow_draft`, steps 9-17): step 10 is left out, and attempt 2's 12-node Flow loses it too. |
| F4 | `dom-select`: (a) describe `value` (the option's value or its words as the page view prints them) and `option` (`{by: "label", label: ...}`, `by` one of value, label or index) in the node definition. (b) A select that names no option, or an `option` without `by`, fails as `INVALID_PARAMETER` (`invalid_input`, not retried), carrying the verb's expected and actual, instead of a bare failed validation that maps to `output_not_observed` and is tried 4 times. | `domain/src/output-nodes/definitions.ts:364`, `apps/extension/src/content/actions/select.ts:97-104`, `:202-206` | Replay the recorded inputs of 0014 (`label`) and 0026 (`option: {label}`) through the domain tool path on the bigbox search page provider-free: 1 try, `parameter_not_readable` with the shape. Then `option: {by: "label", ...}` and `value: "Price low to high"` both select. Also check that the describedNodes text for `dom-select` carries the shape. |
| F5 | Keep earlier records append-only. The page window becomes one trailing block of the current whole or changed views within the 20,000-character budget, and history carries references from the start. This keeps the user's per-request page limit and stops in-place rewrites. | Core `llm/view-channel/projection.ts` | `automationStudioLlmPageChannelProjection` is pure (records in, evidence out). Re-project the 28 recorded attempt-1 requests in both layouts and compare the common prefix of consecutive requests: today it falls to the system prompt 10 times, after the change it grows monotonically. Estimate cache writes from the token counts. |

F1 alone makes step 10 resolvable. F3 removes the step, which also avoids a third results load. F4 removes the sort
failure that led to the 2-page scan. F5 removes about 60% of the decision cost in both runs.

## Not verified

- Why the dead-end walk did not bracket steps 10-15. The draft entry has no state digests, and the stored stores have
  no compose input.
- Why attempt 2 completed without the Flow running whole from its start (0090 ran only from step 27). It was not checked
  against `completion/replay-stands.ts`.
- The scorer's per-signal contributions for the 16 candidates. Only the summary string is stored.
