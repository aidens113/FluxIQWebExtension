# Breadth round: one new task per realistic site, proven provider-free

All proofs ran in the t885 worktree, from `apps/scenario-lab`, after `scenario-lab:build` (through heavy-slot). Form of every command:
`node C:/Users/osrs_/FluxStuff/fxwork/.tools/heavy-slot.mjs run t885 -- node --test --test-name-pattern="<P>" dist/scenarios/<site>/tests/<file>.test.js`.
The tests drive the honest recording (or a hand sweep) in headless Chromium against the fixture and check the oracle; each file also ran the matching wrong-path test, which failed the oracle as intended.

| site | task | kind | rows | proof (pattern, file) -> result | scripted form | risks |
| --- | --- | --- | --- | --- | --- | --- |
| everything-store | everything-store-coupon-earbuds-rated-four | read, paged dataset (5 pages) | 5 (nonempty; name, price, coupon, url) | `"sweeps all five pages"`, `everything-store/tests/breadth-paths.test.js` -> pass 1 / fail 0, 26 s; page 1 alone gives 2 of 5 | none | Paged read over 5 pages; the workflow comment says no recording can make it and FluxIQ's read reads one page, so the test is a hand sweep (it passes, but no recorded Flow exists). Near-misses: four couponed pairs rated 3.3 to 3.8 (the "4 Stars & Up" filter admits two), sponsored cards, accessories, boundary repeats. A person-check exists for the site (not tied to this task). |
| crossborder-marketplace | crossborder-marketplace-follow-official-store | lasting act (follow) + one-row read | 1 (`Followed stores: Hubsmith; Mirafone; Qinport; Voltbay Official Store`) | `"follow-official-store"`, `crossborder-marketplace/tests/breadth-paths.test.js` -> pass 3 / fail 0 (honest; lookalike store fails; second press unfollows) | none | Lookalike "VoltBay Store" under the same title; Follow is a toggle, so a repeat press undoes it. Asked act: following:voltbay-official. Console noise allowed (site noise). |
| bigbox-retail | bigbox-retail-checkout-quote-without-ordering | read (quote, no act) | 1 (pickup `2pm–3pm`, total `$4.26`) | `"checkout quote"`, `bigbox-retail/tests/breadth-browser-paths.test.js` -> pass 2 / fail 0 (honest; naive first-slot-then-Place-order fails) | none | Support launcher overlays the cart's checkout button; the first request for pickup times is refused (429) and needs the "Taking longer than usual? Retry" link; the earliest slot is the first open one (11am, noon, 1pm are full), so a first-slot read is wrong; guest checkout is the only change and the cart must stay as it was. "today" is the fixture's fixed clock. |
| job-board | job-board-remote-easy-apply | read, count (7) | 7 (nonempty; title, company, salary) | `"recorded remote search"`, `job-board/tests/breadth-paths.test.ts` (dist .js) -> pass 3 / fail 0, which includes the 7-job honest read; the naive first-page read test was not selected | none | Three pages of remote results; ordering note (newest first, ties in results order); excluded near-misses: Brightwater Rust Engineer (no salary), two hybrid quick-apply roles, a closed Pinecrest job. Account must be unchanged. 429 console noise allowed. Pattern also ran 2 other honest paths in that file (save, careers), both passed. |
| local-classifieds | local-classifieds-test-ride-question | lasting act (send one message) + one-row read | 1 (title, price, seller of the cheapest qualifying bike) | `"test-ride question"`, `local-classifieds/tests/breadth.test.js` -> pass 2 / fail 0 (honest; sending the ready-made message misses the oracle) | none | Has a permission point (message send). Cookie and notification popups; a chat window from Alex Rowe opens over the message box with its own "Message" box that sends nothing; the box comes pre-written with "Hi, is this still available?" and sending that first also trips the rate limit; sponsored posts excluded. |
| auction-marketplace | auction-marketplace-save-mark-ii-sellers | lasting act (4 saves) + list read | 4 (fotokiste-utrecht, kameraboden, northgate_photo, sprocket-and-spool, in the account's alphabetical order) | `"Mark II sellers"`, `auction-marketplace/tests/breadth-paths.test.js` -> pass 3 / fail 0 (honest, other order, 35S seller / double press fail) | none | Mark II is spelled several ways (Mk II, MkII, Mark 2); the 35S and the original must not count; Save seller is a toggle (second press forgets). Saved list is alphabetical, which the instruction's "order the site lists them" covers. |
| photo-social | photo-social-priya-tags | read, dataset (comments and replies) | 5 (author, comment, date) | `"priya-tags"`, `photo-social/tests/breadth-paths.test.js` -> pass 2 / fail 0 (honest; wrong reads give wrong rows) | none | Consent banner must be declined (oracle checks it); four load-more batches and replies must be opened; Priya's own comment does not tag her, and a mention-only read gives six rows. Final-state checks relay "never blocked". |
| social-network-feed | social-network-feed-hide-suggested-posts | lasting act (2 hides) + read | 2 (community, text: Urban Growers Network, Kettle & Crumb) | `"suggested"`, `social-network-feed/tests/breadth-paths.test.js` -> pass 2 / fail 0 (honest recording; hiding a friend's share fails). First attempt with a `a\|b` pattern failed on the shell, not the test; rerun is the result quoted | none | Must scroll the feed to "all caught up"; friends' shares look similar and must stay; below-the-end suggestions must not be hidden; Undo removes an id. No permission point. |
| company-website | company-website-saturday-certificate | read (slots across 3 weeks) | 2 (2026-10-03 11:30, 2026-10-17 09:00) | `"saturday-certificate"`, `company-website/tests/breadth-paths.test.js` -> pass 3 / fail 0 (honest; closed Corve Bridge branch and one-week read fail) | none | Wrong branch (closed Corve Bridge) and unavailable slots add wrong rows; only two matching rows, so a missed week shows at once. Nothing booked or paid. No person-check on this task. |
| professional-network | professional-network-kade-lead-contact | read (one profile's contact info) | 1 (Pieter Groen, pieter@example.com) | `"contact"`, `professional-network/tests/breadth-paths.test.js` -> pass 2 / fail 0 (honest; other first-degree Kade engineer, or a 2nd-degree profile with no email, is wrong) | none | Two filters (1st degree, Kade Energy) then profile then Contact info; the other first-degree Kade engineer is the trap; read only, no connect. Alternative if a bigger count is wanted: `professional-network-netherlands-data-engineers` (32 rows over 4 pages), proof `"Netherlands"` same file -> pass 2 / fail 0, but its asked-table row notes the reference reader cannot follow its numbered list. |

No scripted-model form exists for any chosen task (`scripts/index.ts` holds only the six already-run tasks).

## Kinds across the round

Reads: everything-store (count 5), bigbox (quote), job-board (count 7), photo-social (dataset), company-website (slots), professional-network (one profile). Lasting acts: crossborder (follow), local-classifieds (message), auction (4 saves), social-network-feed (2 hides). No task here has a robot check or person-only dependency. Only local-classifieds carries a permission point (message send).

## Asked acts (from `asked/table.ts`)

everything-store, bigbox-checkout-quote, job-board, photo-social-priya-tags, company-website-saturday-certificate and professional-network-kade-lead-contact ask for none. crossborder: `following:voltbay-official` +1. local-classifieds: `message:1054477481311927` +1. auction: `followed:` for the four sellers. social-network-feed: `hidden:g_3a5e17`, `hidden:g_d40f52`.

## Commands and results

- Build: `heavy-slot run t885 -- node ../../scripts/build-cache/cli.mjs scenario-lab:build` -> built (68 s).
- Eleven test runs as in the table; every run exited 0 with `# fail 0`. Everything-store 1 test, crossborder 3, bigbox 2, job-board 3, local-classifieds 2, auction 3, photo-social 2, social-network-feed 2, company-website 3, professional-network contact 2 (and Netherlands 2).
- One failed invocation: social-network-feed with pattern `hide-suggested|hide suggested` ("'hide' is not recognized", exit 255, shell split on the pipe). Rerun with `"suggested"` passed.

## Not verified

- No live or paid run, and no scripted-model run. These tests drive the recording script, not the product's chat/Flow path, so they prove the oracle is reachable and nonempty, not that the model finds it.
- Everything-store coupon: no recorded Flow exists for the paged read, only a hand sweep.
- Job-board's naive (first-page-only) test was not selected by the pattern; it passes in the file as a whole only if run (not run here).
- Whether a person-check or interruption appears differently in a live extension session.

## Open questions or contradictions

- The scratchpad directory was shared and cluttered with other tasks' files; my `run.sh`, `run.log` and `out-*.txt` there may have replaced older files with the same names.
- Heavy-slot contention (a long `lead-sweep` held one slot) delayed this work by about 50 minutes.
