# Breadth round: task picks for Answer First (read-only, 2026-11-05)

Sources: t869 tree scenarios (`live-tasks.ts`), `final-facts-audit.md`, the hub `breadth-forty-tasks-plan.md` and `diag-coverage-2026-10-27.md`, `spend-ledger.jsonl` (finish events), Core `answer-first-plan.md` paid-run table, the four scripted-model scripts. Nothing run, nothing paid, nothing edited.

## What the record says (read this first)

- Only two tasks have ever run in answer-first mode, all on Anthropic: company-website-apprentices (Sonnet, passed, $0.42, run-mw37qofs-6116e1b1) and local-classifieds-save-dining-tables (Sonnet budget-out $4.84; Sonnet $0.79 where the task was right but the Lab's own check was wrong and is since fixed; Haiku passed, $0.077, 81% cache). Every other figure below is DeepSeek in `project` mode (2026-10), roughly $0.02-0.15 a run, and is not comparable.
- A second attempt only happens if attempt 1's answer was right (`attempt-lane/live/can-go-on.ts`). A wrong attempt 1 wastes the second attempt, so attempt-1 safety is what matters most.
- Scripted attempt forms exist for four tasks only: apprentices, batteries-and-descaler (a deliberately double-acting script), accept-messaged-invitations, save-dining-tables. Core's plan says the provider-free browser proofs of every attempt-2 form are still to come on t869.
- Provider-free proof for the rest is the honest-path and wrong-path browser tests in the scenario folders (`breadth-paths.test.ts`, `scenario.test.ts`, and each task's own test), recorded in the per-site `audit-<site>.md` and `tasks-<site>.md` under `docs/working/breadth-forty-tasks-plan/reports/`. After the final-facts audit only everything-store, job-board, local-classifieds, social-network-feed and company-website suites were re-run (all passing, per the audit); the other five scenarios' last proof predates it, but their facts were declared unchanged.
- Task ids below are the `--task` values (site prefix included).
- The hub's `tasks-company-website.md` still describes saturday-certificate as an empty table; the live-tasks file now has the positive Wrenfield form (2 rows). Do not trust that report's row.

## Per site

### everything-store
- Pick: `everything-store-batteries-and-descaler`. Second: `everything-store-coupon-earbuds-rated-four` (read).
- Asks: raise the cart's AA batteries to three packs (not three more), add one Tidewell descaler 4 pack, leave phone case and saved items, then table the cart.
- Kind: lasting act, count. Set-to-three is idempotent, but the descaler add is a count: a second press makes two (the scripted double-add form presses the cart line's Increase to prove the oracle catches it).
- Proof: 3-record expected dataset plus an account fact (`breadth-oracles.test.ts`), accepted live 2026-10-17 (run-mvcws1l9-f43e197f, $0.023, DeepSeek, zero-call replay passed). Facts untouched by the final-facts audit, so no page-bound fact.
- Scripted form: yes (`everything-store-batteries-and-descaler.ts`, double-act only; there is no honest attempt-2 form).
- Right attempt 2: batteries still 3, descaler still quantity 1, cart table identical, and the run said the first attempt already did it. It must not press Add or Increase.
- Waste risks: none known for attempt 1. Second choice is 5 pages of results (the dearest read; $0.10 on DeepSeek). Avoid `first-page*`: two false passes and open failures (run-mvtdoyf3-47ffaac1 latest), and `office-checkout-review` (stop-before-order, 5 failures, passed once 10-28).

### crossborder-marketplace
- Pick: `crossborder-marketplace-free-hubs-under-ten` (read). Second: `crossborder-marketplace-follow-official-store` (lasting, toggle).
- Asks: usb c hub, free shipping, 10,00 EUR or less, no ads, cheapest first, 10 records (title, store, price, rating).
- Proof: 10-record dataset; accepted 2026-10-18 (run-mvdism0y-ba67f226, $0.024); later passed 2026-11-03 in `legacy` mode (run-mw0l0e9y-a7d8ae51, $1.12; one earlier fail, $1.89). Facts are header flyouts on every page (audit: nothing changed).
- Scripted form: none. Right attempt 2: same 10 rows, no change to account; a saved read should make it cheaper.
- Waste risks: a traffic/robot screen replaces the third results load (declared as `personCheck: completes, not required`); the run must get past it unaided. Second choice: Follow toggles (Following label), Voltbay Official Store versus lookalike "VoltBay Store"; audited only, never run; attempt 2 pressing Follow again unfollows.

### bigbox-retail
- Pick: `bigbox-retail-napkins-for-delivery`. Second: `bigbox-retail-rated-delivery-towels` (read).
- Asks: add two packs of the 500 Count dinner napkins for Delivery (buy box defaults to 100 Count and Pickup), keep soap and store, show the cart.
- Kind: lasting act, count (a second run would make four).
- Proof: own test `napkins-for-delivery.test.ts`; audited only, never run live, no spend. Exact account JSON and mini-cart facts, unchanged by the final-facts audit.
- Scripted form: none. Right attempt 2: cart still soap 1 and napkins 2, no extra add; no change.
- Waste risks: never run live; traps (wrong size, pickup, Next dropping filters) are the point. Fallback if the user wants a proven task: `rated-delivery-towels` (16 rows over 2 pages, a bot check; accepted 2026-10-18 after 3 failures, run-mvdf5nlp-4878758e, $0.027).

### job-board
- Pick: `job-board-save-quillmark-remote`. Second: `job-board-remote-easy-apply` (read, 7 rows, accepted 2026-10-17, run-mvcw0qct-0f4257a5).
- Asks: save Quillmark's 3 remote UK jobs (not Quillmark Labs, not hybrid London), keep the two already saved, then read the saved list (5 rows).
- Kind: lasting act, toggle (heart; a second press unsaves). Two jobs start saved, so a blanket "save all" unsaves them.
- Proof: expected + account read-out (`expected.test.ts`). Live: failed 4 rounds, then passed 2026-10-28 (run-mvsknvqv-555a5de2, $0.094, DeepSeek). Facts: this task is not among the page-bound fixes.
- Scripted form: none. Right attempt 2: saved list still those 5, nothing unsaved or doubled.
- Waste risks: slow to pass historically; it is the slowest of the safe picks. Careful with `halvard-careers-roles` and `apply-quillmark` (facts were just changed).

### local-classifieds
- Pick: `local-classifieds-save-dining-tables`. Second: `local-classifieds-nearby-furniture` (read, 7 rows, accepted 2026-10-18, run-mvebbnwm-47169b0d).
- Asks: save the three cheapest dining tables within 5 miles of Kelford, then table saved items cheapest first (title, price, status).
- Kind: lasting act, toggle (Save is a toggle; a second press of a row unsaves it).
- Proof: `browser.test.ts`, `scenario.test.ts`, 43 pass after the audit; answer-first runs above (Haiku passed). Not changed by the final-facts audit.
- Scripted form: yes, many (plain, reshape, row-link, open-save-back, by-hand, by-hand-unread, again-check, again-press, run-again).
- Right attempt 2: all three tables still saved, saved list unchanged, no press of Save (carried as already done, per header of the script).
- Waste risks: Sonnet burned $4.84 to a budget-out on first sight and $0.79 on a Lab-check bug (fixed); Haiku is the cheap, proven model here. Expect Sonnet to be the costly one; set its ceiling deliberately.

### auction-marketplace
- Pick: `auction-marketplace-lens-hood-seller-shop` (read). Second: `auction-marketplace-save-mark-ii-sellers` (lasting, toggle).
- Asks: find the lens hood on its own (not the set "with 3 lenses & hood"), open its seller's shop (the_camera_loft), list all 8 items, title and price, in shop order.
- Proof: accepted 2026-10-19 (run-mvecxd6w-ed72a1ca, $0.032, zero-call replay replay-mvfllkon-e7a35190). Facts unchanged by the audit.
- Scripted form: none. Right attempt 2: same 8 rows, account unchanged.
- Waste risks: the Flow of that accepted run opens the shop by a fixed address because navigation to the read address was refused (R5, `web.browser.permission_denied`); whether that is fixed is not checked here. Second choice: saves four sellers (a watch limiter exists on the site; not the save), audited only, never run, a second press unsaves. The other three auction tasks failed (cheap-accessory-auctions 3 times, buy-it-now-quote's oracle failed) and need repair first.

### photo-social
- Pick: `photo-social-kiln-notes`. Second: `photo-social-august-over-1300` (read, 1 row).
- Asks: on Saved, New collection named "Kiln Theory notes", add the two saved Kiln Theory posts, then read every tile in order (Kitchen 3, Studio inspo 5, Kiln Theory notes 2).
- Kind: lasting act, count (creation: a second run would make a duplicate collection). Must not press the filled bookmarks.
- Proof: `expected.test.ts`, `breadth-paths.test.ts`; audited only, never run live. This site has no accepted task at all; the diag recommends kiln-notes as the next run.
- Scripted form: none. Right attempt 2: still exactly one Kiln Theory notes collection with 2 posts, tile list identical.
- Waste risks: the hardest site. newest-likes failed 4 times in 2026-10-28/29 (latest run-mvtdn37t-e1e4d0a7, 120 calls, no Flow) and priya-tags took 90 calls, so avoid both. august-over-1300 failed once pre-fix; the fixture now has 1 positive row (August 21, 1,349), but its qualifying post sits on the grid's third screen behind a rate limit and a session check.

### social-network-feed
- Pick: `social-network-feed-recent-group-posts` (read, 3 rows). Second: `social-network-feed-delete-stranger-requests` (lasting, delete, one-way).
- Asks: read the home feed to the end and list the 3 posts from Maya's own groups on or after 19 Sep 2026, with full text behind See more.
- Proof: accepted 2026-10-29 (run-mvtdmo5p-4dca4787, $0.082, exact oracle, zero-call replay) after 8 failed rounds, then three more failed runs 2026-10-30 (0.11 and two zero-cost). Facts of this task are not among those changed.
- Scripted form: none. Right attempt 2: same 3 rows, state unchanged.
- Waste risks: unstable history (accepted once, failed after). The lasting alternative asks a delete permission (needs a person, once), and attempt 2 finds the stranger already gone, so its "removed rows" answer is a question for the oracle. Avoid `hide-suggested-posts` (known row-bound defect, rerun owed) and `claim-found-key` (a send; double post).

### company-website
- Pick: `company-website-apprentices` (read, 4 rows, name/role/branch). Second: `company-website-newsletter-signup` (lasting, count).
- Proof: passed in answer-first mode on Sonnet (run-mw37qofs-6116e1b1, $0.42) and earlier accepted (run-mvdes30x-65848f60, $0.016). The page-bound path fact was dropped; its account literal stays; 68 tests pass.
- Scripted form: yes (`company-website-apprentices.ts`). Right attempt 2: same 4 rows, no change, cheaper from the saved work.
- Waste risks: a newsletter pop-up on a timer; the grid's first "Show more people" press only shows a spinner. Second choice signs ada.synthetic@example.test up once (subscriberCount 1); audited only, never run, not verified whether a second sign-up is refused or doubles. Avoid saturday-certificate and quote tasks until their reports are reconciled (see above).

### professional-network
- Pick: `professional-network-accept-messaged-invitations`. Second: `professional-network-kade-lead-contact` (read, 1 record / 2 fields, accepted 2026-10-18, run-mvdi9e8u-678c35df).
- Asks: accept only the 3 connection invitations that came with a message (Ximena Ruiz, Lucia Romano, Chidi Nwosu); leave page and newsletter invitations; table name and message.
- Kind: lasting act, one-way (accepted invitations leave the list).
- Proof: `breadth-expected.test.ts`, `breadth-paths.test.ts`; audited only, never run live. Not gated, no permission ask. Facts unchanged by the audit.
- Scripted form: yes (plain, reshape, thin; none for attempt 2).
- Right attempt 2: no further accepts, the 3 accepted people stay accepted, nothing else accepted. How the oracle judges attempt 2's "table of people you accepted" when none are waiting is not stated in anything I read; check before the paid run.
- Waste risks: never run live. If the user wants only proven tasks, swap to the read second choice.

## Ranked ten picks, safest first

1. company-website-apprentices (answer-first pass on record, script, read)
2. local-classifieds-save-dining-tables (Haiku answer-first pass $0.077, scripts for attempt 2; Sonnet is dear)
3. everything-store-batteries-and-descaler (accepted, count, a double-act script)
4. auction-marketplace-lens-hood-seller-shop (accepted with replay, read; fixed-address note)
5. crossborder-marketplace-free-hubs-under-ten (accepted, recent legacy pass; robot screen)
6. social-network-feed-recent-group-posts (accepted once, unstable after)
7. job-board-save-quillmark-remote (toggle; accepted after 4 failures)
8. professional-network-accept-messaged-invitations (never live; script exists; attempt-2 oracle unclear)
9. bigbox-retail-napkins-for-delivery (never live; count)
10. photo-social-kiln-notes (never live; hardest site)

## Needs proof before it can run

- Attempt-2 provider-free proof (the Lab's attempt proof, `run-attempt-proof.ts`, or a scripted form) for every pick without a scripted form: lens-hood, free-hubs, recent-group-posts, save-quillmark-remote, napkins, kiln-notes (and any second choice used). Plan says these proofs are still pending on t869.
- Nonempty positive path (browser, no model) is on record for all reads (apprentices 4, free-hubs 10, recent-group-posts 3, lens-hood 8, kade-lead 1, august 1, nearby-furniture 7, remote-easy-apply 7), but only the five scenarios the audit re-ran were re-run on t869; re-run the owning tests for crossborder, auction, photo, bigbox and professional-network on t869 before launch.
- Never run live, so first-time risk: napkins, kiln-notes, accept-messaged-invitations, save-mark-ii-sellers, follow-official-store, newsletter-signup.
- Not to run until repaired or reworded: photo newest-likes and priya-tags, social hide-suggested-posts, auction cheap-accessory-auctions and buy-it-now-quote, everything-store first-page and office-checkout-review, company saturday-certificate (reconcile report), any task whose expected dataset is empty.

## Not verified

No evaluation.json or replay file opened; run ids and costs are from the ledger, hub and Core table. I did not run any test. Whether newsletter sign-up is idempotent, whether the accept task's attempt-2 oracle accepts a table of earlier-accepted people, and whether the auction fixed-address navigation refusal is fixed, are not established.
