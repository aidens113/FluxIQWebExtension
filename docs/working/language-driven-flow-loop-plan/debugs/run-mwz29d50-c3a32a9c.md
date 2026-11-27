# run-mwz29d50-c3a32a9c: bigbox new-store cheapest towels, the replay read the cart on the product page

Lane: t1015 `paid-bigbox`. Task: `bigbox-retail/bigbox-retail-new-store-cheapest-towels`, answer-first, `--attempts 4`,
`claude-sonnet-5-5` for build and judge, fluxiq 0.54.35 (Core `f0b7d9f76`), after t1076-t1081. The lead stopped it in
attempt 4, just after attempt 3. It was debugged offline from:

- the step files in `C:/Users/osrs_/FluxStuff/lab-runs/2026-11-27/run-mwz29d50-c3a32a9c/steps/`;
- the Lab log `bigbox5.log`, and the isolated Core's `logs/core.log`;
- the run's own stores under `fxwork/t1015-paid-bigbox/test-runs/instances/paid-bigbox/.attempt-work/run-mwz29d50-c3a32a9c/fluxiq-root/.fluxiq`, read from copies with Python:
  - `project.sqlite` `client_gateway_trace_events`, and `client_gateway_trace_chunks` (raw deflate);
  - `global.sqlite` `automation.state` rows: `task-memory/task.c8143d7f...` and `flows/flow.34fbe190.../answer-attempts`. The secret tables were not read.
- the code in the lane tree and in the shared Core `fxwork/!FluxIQ`.

No live or paid run was made, no code was changed and no git command was used. The full report, with every line
reference, is `docs/working/page-diff-delivery-plan/reports/run-mwz29d50-bigbox.md`.

## What happened

| Attempt | Calls, cost | What it did |
| --- | --- | --- |
| 1 | 17 calls, $0.65 | **Explored, and the answer was right.** It set the store, typed the search, checked Pickup, sorted low to high, and opened the $1.28 roll's product page (0016). It pressed **Add to cart there (0018)**, which opens an "✓ Added to cart" side panel. It then pressed **"View cart" inside that panel (0020, t1615, `same href as t1389`)**, read the cart (0026) and was judged yes twice (0030, 0031; both continued the decider). Saved Flow: steps 1-10 and read 13. |
| 2 | 8 calls, $0.31 | **The replay pressed neither Add to cart nor "View cart".** It left Add to cart alone as already done (0042: no click sent, `skipped: already_done`). "View cart" failed `web.target.not_found` (0043), and state routing passed over it as `executor.state.not_arisen`. The read then ran four times on the **product page** (0044-0047): `0 records ... the item selector named nothing on the page`. The repair pressed the header cart link (0051, t1389), read the cart, dropped step 13 and ran from step 18 (0060-0061). It was judged yes (0064, continuing the decider). Saved Flow: steps 1-10, 15 (header cart link) and read 18. **Step 10 ("View cart") is still in it.** |
| 3 | 12 calls, $0.59 | **The replay worked mechanically.** "View cart" was passed over again (0076), the header cart link took the run to the cart (0077), and the read returned 2 rows (0078). But the Flow had no judged whole run (`flow_not_proven`, 0079). So a judge was asked **on its own, with no decider conversation and no page text** (0080, `continuation: no_decision_in_this_attempt`). It answered `unknown`: it could not see that the item was rated 4.5+ or ready today. A repair followed (0081-0099, judged yes twice). |
| 4 | stopped | It replayed **attempt 2's Flow again**, not attempt 3's: same steps, same "View cart" pass-over (0113), same `flow_not_proven`, same `unknown` (0117). |

## Why

1. **The read was never the problem.** The read command sent at 14:15:02 (attempt 2) carries the same item selector and the
   same ten field selectors as attempt 1's live read (14:14:18). Attempt 3's replay sent the same read at 14:16:47, on the
   cart, and it returned 2 rows. So t1077's columns, t1079's keys, t1074's re-read replacement and t1080's window are not
   involved. What failed is where the read ran: the product page.
2. **The read ran on the wrong page because the step that went to the cart was passed over.**
   - The rule that passes it over is `not-arisen.ts:59-69`. It is reached from `decision.ts:113-114`.
   - Attempt 1's "View cart" lived in the panel that Add to cart opens. On attempt 2 the add was left alone as already
     done, so the panel never opened.
   - `not-arisen.ts` then reasoned that the panel's state never arose, so its step was "not needed". It went on along that
     step's success edge.
   - But this step is not just a press on the panel. Its own effect is navigation to `/scenarios/bigbox-retail/cart`, and
     the read after it needs that page. The task record shows it: `routeSignatures.before.path d8ebc739` and
     `after.path 53622792`, with `stateBefore`/`stateAfter` different.
   - So the rule dropped a navigation along with the panel.
   - **This was exposed by t1073** (Core `edea71f29`, 2026-11-26, `decision.ts:185-203` `followOnLasts`). Before t1073,
     every click was floored as lasting, so not-arisen never applied to "View cart": the step failed and the attempt
     explored. t1073 made it pass over, and the read then failed instead.
3. **Attempt 3 stopped on the judge, not the read.**
   - The Flow repaired in attempt 2 was proven only from step 18 (the model's `run_flow from 18`). Its first whole run is
     attempt 3's replay, and that replay is judged by design (`replay-stands.ts:67`).
   - That judge does not continue a decider. Its evidence holds each step's semantic state only (`captureOmitted: true`) and
     no page text: page views go in only on an unreadable re-ask (`summary.ts:159`, `page-views.ts`).
   - So the words that settle the task never reach it: "4.5 out of 5 Stars" and "Pickup today" on the product page, which
     attempts 1-2's judges read in the decider's conversation.
   - It answers `unknown`, and the attempt repairs. **The same thing would have happened to attempt 2 even with a clean
     replay**: attempt 1's Flow is also `provenWhole: false` in task memory.
4. **Attempt 3's repair was thrown away.**
   - `better-flow.ts:41` keeps the old Flow when both Flows are confirmed and the old one "did not break live". It also
     leaves `provenWhole` false unless a whole run is judged yes (`:34`).
   - So attempt 4 replayed attempt 2's Flow and met the same standalone `unknown`.
   - Every later attempt would repeat this, spending about $0.30-0.60 each, and the Flow could never become proven.
5. **Why the provider-free harness passed 4 of 4.** Its scripted attempt 1 takes a different path:
   - It adds with the results card's "+ Add", which only shows a toast (`bigbox-retail/client/shell-script.ts:162`), and it
     opens the cart through the header cart link (`scripted-model/scripts/bigbox-retail-new-store-cheapest-towels.ts:65-66`).
     It never presses a panel link, so not-arisen never passes over a navigation.
   - Its judge always answers yes (`:97`), so it never shows the standalone judge's missing page text.
   - The read is the same: the same three field keys (`:79` picks `link`, `*select_control` and `price`, as the live model
     did) and the same list.

## Fixes proposed (no caps; detail and offline proofs in the report)

- **F1 (root, Core `engine/automation/state-routing/`):** not-arisen must not drop a step's navigation.
  - When the passed-over step's recorded effect moved the page to another address, the run must still reach that address:
    - first by a link on the page that leads to the same address, preferring a stable region (here the header cart link
      t1389, which the page view already marks `same href as`);
    - otherwise by going to the address the step reached when it was recorded.
  - The destination is kept as the step's effect, never its identity. `from-packet.ts:62` rightly leaves `href` out of
    identity.
- **F2 (root of attempt 3, Core `result-verification/judge-evidence/`):** a judge asked on its own request is shown the
  page text the run's result rests on, within the page budget, not only on an unreadable re-ask. That includes the pages
  its lasting acts, carried acts too, were pressed on.
- **F3 (Core `answer-first/task-memory/better-flow.ts`):** a saved Flow's judged replay that answered `unknown` must not
  leave the old Flow best while discarding the repair that settled it. F2 is what lets a replay be proven at all.
- **Harness (test-runner):** add the product-page path to the scripted model (open the listing, Add to cart, the panel's
  "View cart"), and give it an evidence-reading judge. That reproduces both defects provider-free.
- **Secondary:** `amendment/apply.ts:232-236,259-266` checks `second_copy` against a step the same decision drops (0059,
  "18 is a copy of 13" while 13 was being dropped).
