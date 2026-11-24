# t1022 report: a read is bound to the list and page it was made for

Worker: Claude Code (Opus 5.5), worker-heavy. Trees: downstream `fxwork/t1022/!FluxIQWebExtension`, Core `fxwork/t1022/!FluxIQ` (Core not edited).
Run debug: `docs/working/language-driven-flow-loop-plan/debugs/run-mwuxd2v9-33928ea3.md`.
Two passes: the first brief (diagnosis and the detection fix) and the lead's follow-up, which asked for (1) a browser proof of the detection change and (2) the page-binding guard the diagnosis found missing.

## Outcome

Done.

1. **Cause (first pass).** Every handle the model read (`extraction.1`, `extraction.4`) was the home page's **two shelves** ("Pickup today ..." with 8 cards, and "Rollbacks" with 4). The detection answered them as a two-item list, with each shelf's cards flattened into columns numbered by place (`li_1` ... `li_8`), so every read kept one row per shelf: its first card. Fix, in the content script: a run whose items are groups of records (a heading over a list) is never the list; the records of the target's group are.
2. **Browser proof (follow-up 1).** It ran provider-free on the bigbox-retail fixture in visible Chromium. Aimed at each shelf heading, the detection now answers that shelf's 8 (or 4) cards with every column, and the read gives one row per card. With the change switched off, the same spec fails with `Expected: 8, Received: 2`, which is the recording's answer. In the other list-inference content specs on the realistic scenarios, every failure also fails with both of my changes switched off, so none comes from t1022 (see Commands).
3. **Guard (follow-up 2), in the domain.** A saved read, whether run fresh, run again or replayed, is refused when its list does not stand on the page it read. It stands on a page with the same origin and path shape as the page it was detected on, or on a page its own Next page moved it to. A refused read names the list (`target`) and the page it was made on (`instead: web.list.made_on:<path>`), with t1013's reason `list_not_on_page`, and keeps none of the other page's rows.

## What the steps say (the brief's three questions)

1. **Where each handle was made, and where each read ran.** `extraction.1`: step 4, the home page, target `t45` (the shelf h2), 2 items. `extraction.4`: step 18, the same page after the store change, the same target, 2 items. It is not the cart's list. Both bindings hold `location` = the home page and the item `main > section.css-0yqogxo` (a shelf). The fresh reads (steps 6, 20, 34, 199) report the home page, and the 18 replays ran in Flow runs that navigated to it first (40, 49, 85, 114, 207) or started there (141). No read ran on another page. Before t1022 the binding's location was compared only with a location the call wrote (`slot.ts`), never with the page.
2. **Why the model never got back to the listing.** It never left it. It re-detected from the shelf heading 11 times and got the same two-shelf list each time, or a refusal as a repeat. The result line counted replays as pages ("4 rows over 13 pages ... unplaced read 12 (2)"), and the model searched for "Next page" 8 times. Two page-wide detections (steps 108, 112) did answer the 8 cards; they were never read.
3. **`a1.fulfilment`.** It was done by the site's own state: "Pickup" was marked before any act (step 10), and the cart said "Pickup at Millbrook Crossing Neighborhood Market" (step 36). The act checklist counted it as missing anyway. Not fixed (Open questions).

## What changed and why

**Detection (`apps/extension/src/content/extraction/`).**
- `record-group/group-records.ts` and `index.ts` (new). An item is a group when it holds a run of records (three or more of one template, or a structural record pair), the run covering most of it, never one drawn from the item's own template, and shows no words of its own outside that run except in a heading or a link or button. A run is a list of groups when the target's item and more than half of its items are groups.
- `infer-list.ts`: `groupRecordsAt` is tried at each level before the level's own run. A list of groups yields the run of records inside the target's group, provided they hold at least two values each. The shelf's "View all" link becomes the run's section link (`continues`).

**Guard (`domain/src/runtime/llm-evidence/`).**
- `plan-resolution/extraction/list-family.ts`: a page's family is its origin plus its path shape, using the route signature's rule (a segment holding a digit reads as `#`, one over 24 characters as `*`; query and hash ignored). So page 1 and page 5 of one search, or two product pages, are one family, and a home page and a cart are two.
- `plan-resolution/extraction/list-stands.ts`: `webPlanListReadElsewhere(parameters, readAt, movedByPager)` returns the handle, `madeAt` and `readAt` when the step's saved binding is in another family than the page read and the list was not moved there by its own pager.
- `node-run/list-pages/`: a per-build memory of the lists the build's own Next page steps moved, keyed by item selector from the pager's `moved` verdict. `read-address.ts` reads the page from the read's answer (`url`, which is a frame's own address for a list inside a frame). `read-elsewhere.ts` is the one check both paths call.
- `node-run/run.ts`: after a read answers, a read elsewhere is refused with the page view, as other refusals are. A Next page that moved its list is remembered.
- `node-run/replay.ts`: a replayed read elsewhere fails `core.replay.failed` with `resultReason: list_not_on_page` and answers no rows, and is not remembered as a source of rows. Replayed Next pages are remembered.
- `action-failure/read-list-elsewhere.ts` builds the refusal. `rejection-next/list-made-on.ts` and `next-sentence.ts` give a read refused `list_not_on_page` its own `next`: "Nothing was kept: the list extraction.N is not on this page, so the rows the read found here belong to another list. Go back to the page it was detected on (/path) and read it there; or, for a list this page shows, detect it here and read it by the handle that detection issues." A Next page refused for the same reason keeps t1013's sentence.
- Why after the page answers, rather than before: the read's own answer states the page it read (a typed fact), so neither path needs an extra look first. A read is read-only, so nothing is acted on.
- Model-facing words: one new `next` sentence, generic (no site, task or product words).

**Browser spec.** `apps/extension/e2e/content/tests/record-group/tests/bigbox-home-shelves.spec.ts` (new). It is its own directory because `extraction/tests/` is at the audit's 25-file limit.

## Commands run and observed results

All runs are provider-free. No LLM, Lab or paid run.

- `EXTENSION_TEST_BUILD_LABEL=t1022 node scripts/test-extension.mjs record-group/tests` -> `# tests 6 # pass 6 # fail 0`. `... content/extraction` -> `# tests 559 # pass 559 # fail 0`.
- **Browser (content harness, `--headed`, bigbox-retail fixture).** `node scripts/test-content.mjs bigbox-home-shelves --headed --workers=1` -> `ok 1 ... aimed at a shelf's heading, the detection answers that shelf's cards, every column read per card`, `1 passed`. With the wiring switched off (`groupRecordsAt` bypassed, restored afterwards) -> `x 1 ... Error: the Pickup today at shelf's cards, not the two shelves ... Expected: 8 Received: 2`.
- **Other list-inference specs, with changes.** `node scripts/test-content.mjs "content/tests/(extraction|list-states|live-tasks|one-element-read|part-run)/" --headed --workers=3` hit its 1700 s timeout (exit 124) after 111 ok and 19 x, three of which were killed unrun (0 ms). Failing: everything-store-cart-names:76, company-definition-fields:55, item-conditions:262, social-read-completion:90, auction-marketplace-kestrel-auctions (9 tests), crossborder-marketplace-spain-hubs:358, local-classifieds-bike-search:302 and :316, professional-network:406 (plus 426 and 439 killed unrun).
- **Same failing specs, with both t1022 changes switched off (baseline).** `node scripts/test-content.mjs company-definition-fields everything-store-cart-names item-conditions social-read-completion auction-marketplace-kestrel-auctions crossborder-marketplace-spain-hubs local-classifieds-bike-search professional-network-rotterdam-data-engineers --headed --workers=3` -> `18 failed, 26 passed (29.1m)` (exit 124). The same tests fail: cart-names:76, company:55, item-conditions:262, social:90, all 9 auction tests, crossborder:358, bike-search:302 and :316, professional-network:406 (and :493 killed at the timeout). So the failures predate t1022. Two I read: cart-names expects only the requested columns and gets every retained column (the data-first "keep every column" behaviour); company-definition-fields expects 2 Next page attempts and gets 1.
- **The rest, with changes:** `node scripts/test-content.mjs professional-network-rotterdam-data-engineers "content/tests/(part-run|one-element-read|record-group)/" --headed --workers=3` -> professional-network :167, :350, :426, :439, :465, :493, :510 ok and :406 x (failing in the baseline too); one-element-read :102 ok; record-group bigbox spec ok. Part-run's 5 tests failed at once for `environment.missing: E2E extension artifact not found`. After `node scripts/build-extension.mjs` (exit 0), `node scripts/test-content.mjs "content/tests/part-run/" --headed --workers=2` -> `5 failed`, each with `flow_bootstrap.evidence_repeat_without_progress` (`project.completion_not_latest`, `project.build_ending_told`). The scripted build's trial stopped at step 1, a navigate (`executor.fault.unclassified`), before any read. The baseline with both changes switched off (extension rebuilt) gives the same `5 failed`, with the same error. Both changes were then restored, the artifact rebuilt, and list-stands (5 pass), record-group (6 pass) and the audit run again (passed).
- `DOMAIN_TEST_BUILD_LABEL=t1022 node scripts/test-domain.mjs plan-resolution/extraction/tests/list-stands` -> 5 pass. With the check switched off -> `# pass 2 # fail 3` (tests 2, 3, 4 fail), restored afterwards.
- `DOMAIN_TEST_BUILD_LABEL=t1022c node scripts/test-domain.mjs llm-evidence/node-run/ llm-evidence/plan-resolution/extraction/ llm-evidence/rejection-next/ llm-evidence/action-failure/` -> `# tests 728 # pass 728 # fail 0` (run before and after the refactor that kept `run.ts` under 800 lines).
- `pnpm --filter @fluxiq-web-extension/domain check` -> exit 0 (`domain:check` built, 96842 ms). `pnpm --filter @fluxiq-web-extension/extension check` -> exit 0 (`domain:build` built, `extension:check` built, 246115 ms).
- `node scripts/structure-audit.mjs` -> `structure-audit: passed (260 warning(s), 551 baselined).` The first run of this pass failed on two counts: `extraction/tests/` held 26 files, over the 25-file limit, so the spec moved to `record-group/tests/`; and `run.ts` reached 806 lines, over 800, so the check moved into `node-run/list-pages/read-elsewhere.ts` and `run.ts` is now 796.
- Core: not changed, so Core `vitest-groups` and `pnpm --filter fluxiq check` were not run.

## Not verified

- A Flow's playback after the build (`output-nodes/extract-list/dispatch.ts`) is not guarded. It runs the resolved request, which no longer carries the binding's location. Guarding it would mean carrying the location into the resolved request, which is a wire change.
- The page-family rule is the route signature's path shape. A site that pages by path is covered by the pager memory, but only within a build: a later attempt's playback is not guarded at all (above). A legitimate list reached at a different path shape by anything other than its own Next page (a redirect to another route, a different SPA route) is refused. The refusal says to detect the list on the page it is on.
- No live run checked that the model now takes the shelf's 8 cards. The pre-existing failures in the content specs above were not investigated.

## Open questions or contradictions found

- "Rows say which list they came from" was not built separately. A refused read now names its list and the page it was made on, and kept rows can only be from the list's own page family. A read step's `does` still names columns only (`node-run/call-words.ts`).
- The act checklist (`a1.fulfilment`) counts a choice the page already shows as made as missing (domain or Core act recording).
- The result line counts replays as pages ("unplaced read N"). This is Core's result description.
- 11 unreadable decisions (`llm.provider_output_invalid`), two of them costing $0.14 and $0.17. Not investigated.
- About 18 content-harness tests, plus the 5 part-run tests, fail on this base without t1022 (listed above). They need an owner.
- `docs/architecture/` was not updated (outside the owned paths). The detection rule (`web-capabilities.md`, structure detection) and the read refusal (`list_not_on_page` for reads) belong there.
