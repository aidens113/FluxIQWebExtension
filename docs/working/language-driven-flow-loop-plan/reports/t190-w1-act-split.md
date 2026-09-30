# t190-w1 — one act per coordinated object, each with its own quote (cause 5)

## Outcome

Done. Run 6's instruction now yields 3 acts, each with its own quote, and every existing test passes. Package tsc was skipped because both build slots were held for 15 minutes.

## What changed and why

Core worktree `C:/Users/osrs_/FluxStuff/fxwork/t190/!FluxIQ`, under `packages/fluxiq/src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts/`:

- `instruction-acts.ts`
  - **Per-act quote.** Matches are collected per sentence and sorted by position. Each act quotes from its own verb up to the next kept act's verb in the same sentence, or to the sentence end. Whitespace is folded. Trailing punctuation and joining words (`then`, `and`, `also`, `please`, `first`, `next`, `finally`, `now`, `just`) are trimmed by `TRAILING`, and the result is bounded by `MAX_QUOTE` (200). The "one act of a kind per sentence" rule is unchanged: in "Collect and use that store's coupon", `use` is still skipped, so `collect`'s clause runs through it.
  - **Coordinated-object split (`coordinatedObjects`).** This applies only to `add_to` and `save`. The act splits only when all of these hold:
    - its clause begins with a count (`a|an|one..twelve|digits` + a word, but not `a half/quarter/few/bit/lot/little/while/moment`);
    - it has a destination (`DESTINATION`, the regex the `add_to` pattern already used, now a named constant);
    - at least one `and` / `, and` followed by a count comes before that destination.

    Each object becomes its own act with the same kind and verb. Its quote is the verb as written, its own object, and the shared destination tail repeated (for example "add one pack of ... Napkins in the 250 Count size to my cart, both for pickup"). Ids stay `a1..` in instruction order. `MAX_ACTS` is still 8.
  - The header comment now states the new rule and cites run 6 (`run-muncqlr0-3348202b`).
  - Removed the unused `sentence` field from the internal found-act record.
- `tests/instruction-acts.test.ts`
  - The bigbox pickup-cart row now expects `set/switch, add_to/add, add_to/add`.
  - New tests:
    - "gives each act its own clause, not the whole sentence": the job-board style save plus open.
    - "keeps coordinated verbs over one object as one act": Collect and use.
    - "does not split objects that are not each counted": "Add the kettle and the toaster to my cart" gives 1 act.
    - "one verb over coordinated objects": run 6's exact instruction gives exactly 3 acts. a1's quote contains Millbrook and neither product. a2 contains "Paper Towels" and not "Napkins". a3 contains "Napkins" and not "Paper Towels". All quotes are distinct, and there is no submit act.

## Commands run and observed results

- Test-first. I added the tests and ran them against the unmodified extractor with `pnpm --filter fluxiq exec vitest run src/programs/automation-studio/runtime/flow-bootstrap/instructed-acts --maxWorkers=2 --minWorkers=1`. Result: `Tests 3 failed | 41 passed (44)`. The failures were "reads bigbox pickup cart", "gives each act its own clause...", and "reads one act per counted object...".
- The brief's exact command (without `--minWorkers=1`) does not run any tests. It fails with `RangeError: options.minThreads and options.maxThreads must not conflict` and reports `no tests`. Adding `--minWorkers=1` fixes it.
- After the fix, the same command gives `Test Files 2 passed (2)`, `Tests 52 passed (52)`. The count rose because w2's `check.test.ts` changes are in the same tree.
- Package tsc (`pnpm --filter fluxiq exec tsc --noEmit -p tsconfig.json`): SKIPPED. Both build slots were held for the full 15 minutes: b1 by `t174-w5 | npx vitest run`, b2 by `t187 bench | D.check p3 | pnpm check` and then `t187-build-cache | pnpm build x2`. My polling script logged `SKIPPED: both slots held for 15 minutes` and claimed nothing. The only type-level evidence is that vitest transformed and ran the file. The new code only reuses existing types (`AutomationStudioInstructedActKind`, `AutomationStudioInstructedAct`).
- Regression sweep. Scratch script `sweep.mts` in my scratchpad, run with `node --experimental-strip-types --import ./register.mjs`, where `register.mjs` maps `.js` imports to `.ts`. It loads every exported task array in the downstream `apps/scenario-lab/src/scenarios/*/live-tasks.ts` (58 task ids) and runs it through a snapshot of the original extractor (before) and the modified one (after).

### Sweep: acts per task id

Kinds and verbs are identical before and after for every task id except the two bigbox pickup-cart ids, which gained the coordinated split. Every other difference is a narrower quote:

- the lead-in before the verb is gone ("On Hammerline, ...", "Go through my friend requests and ...", "Search the store for wireless earbuds, ...");
- the next act's clause is cut off;
- a trailing space at the 200-character cut is trimmed.

No regression.

Unchanged, no acts (all 26): auction-marketplace-kestrel-auctions, -grid-view, -feedback-survey; bigbox-retail-pickup-towels, -list-layout-after-creation; company-website-gas-engineers, -winter-notice, -business-prices; crossborder-marketplace-spain-hubs, -list-layout; everything-store-plus-earbuds-under-50; job-board-remote-rust-roles, -quiet-market, -quiet-market-after-creation; job-board-apply-quillmark-check-first; local-classifieds-bike-search, -list-layout, -location-check; photo-social-giveaway-entries, -verified-upsell; photo-social-moon-jar-price; professional-network-rotterdam-data-engineers, -upsell; professional-network-invitation-allowance; social-network-feed-feed-digest (and -quiet-feed, -app-install); social-network-feed-move-open-day.

Unchanged acts and quotes: bigbox-retail-pickup-order (a1 submit/order, a2 submit/check out); company-website-quote-request (+redesigned) a1 submit/ask; company-website-book-service a1 submit/book; everything-store-buy-kettle a1 submit/buy; local-classifieds-make-offer a1 submit/send; photo-social-glaze-collection a1 submit/create; social-network-feed-group-post (+regrouped, +regrouped-after-creation) a1 submit/post.

Changed:

| Task id | Before | After |
| --- | --- | --- |
| bigbox-retail-pickup-cart (and -redesigned-after-creation) | a1 set/switch, a2 add_to/add. Both quote the same 200-character clip of the whole sentence | a1 set/switch "Switch my pickup store to Millbrook Crossing Supercenter"; a2 add_to/add "add two packs of the ValueRidge Essentials Select-A-Size Paper Towels in the 12 Double Rolls size to my cart, both for pickup"; a3 add_to/add "add one pack of the ValueRidge Everyday Dinner Napkins in the 250 Count size to my cart, both for pickup" |
| auction-marketplace-watch-endings | a1 add_to/add "On Hammerline, add to my watchlist ..." (200-character clip); a2 open/list "Then list everything ..." | same kinds and verbs; a1 "add to my watchlist every auction ..." (200-character clip); a2 "list everything on my watchlist, ..." |
| auction-marketplace-place-bid | a1 submit/place "On Hammerline, place a maximum bid ..." | a1 submit/place "place a maximum bid of £85 ..." |
| crossborder-marketplace-hub-to-cart (and -flash-deal) | a1 add_to/put "On Farbazaar, put three ..."; a2 claim/collect | a1 "put three of the Voltbay USB-C hub ... shipped from Spain"; a2 unchanged |
| crossborder-marketplace-buy-hub | a1 submit/buy "On Farbazaar, buy two ..."; a2 claim/collect "Collect and use that store's coupon, and pay with my saved Visa card" | a1 "buy two of the Voltbay ..."; a2 unchanged |
| everything-store-first-page-plus-earbuds (and -deal-wheel) | a1 set/narrow "Search the store for wireless earbuds, narrow the results ..." (200-character clip) | a1 set/narrow "narrow the results to Brightaisle Plus items, and collect every search result on the first page, ... columns name, price, rating and url" |
| everything-store-kettle-to-cart | a1 add_to/put, a2 move/move, both quoting the same sentence; a3 open/give "Then give me ..." | a1 "Put two Tidewell electric kettles in sage green, 1.7 litre, sold by Brightaisle itself, in my cart"; a2 "move the phone case that is already in my cart to Save for later"; a3 "give me what is in my cart, ..." |
| job-board-save-halvard-week (and -redesigned, -redesigned-after-creation) | a1 save/save, a2 open/open, both quoting the whole sentence | a1 "Save every job ... to my saved jobs, without unsaving anything that is already there"; a2 "open my saved jobs so the list is showing" |
| job-board-apply-quillmark | a1 submit/apply (200-character clip with a trailing space) | the same text with the trailing space trimmed |
| local-classifieds-save-dining-tables | a1 save/save, a2 open/give, both quoting the whole sentence | a1 "Save the three cheapest dining tables for sale within 5 miles of Kelford to my saved items"; a2 "give me a table of everything in my saved items, cheapest first, with columns title, price and status" |
| professional-network-withdraw-stale-requests | a1 submit/withdraw "On Guildline, withdraw ..." | a1 "withdraw every connection request I sent a month or more ago that is still waiting for an answer" |
| social-network-feed-confirm-requests | a1 submit/confirm "Go through my friend requests and confirm everyone ..." | a1 "confirm everyone I have at least five mutual friends with, and leave every other request as it is" |

Sweep outputs are in my scratchpad (`t190w1/before.json`, `after.json`, `diff.txt`).

## Not verified

- Package tsc was not run: both build slots were held for 15 minutes. vitest's transform strips types and does not type-check.

- No Lab or browser run, per the brief. I have not checked that the check step (`check.ts`) or the resumed-build prompt (`../incomplete-draft/`) behave well with split acts. They take acts as a list, so three acts should just mean three required steps, but I did not run them.
- Only the add_to/save split was exercised on real instructions (bigbox). The non-split guards are covered by unit tests: uncounted objects, a destination before the "and", and "a half/few".

## Open questions or contradictions found

- The brief's vitest command fails as written (`--maxWorkers=2` conflicts with the config's minThreads). `--minWorkers=1` is needed.
- The `contracts.ts` doc on `quote` says "The person's sentence that asks for it, bounded". Quotes are now the act's own clause, and for a split object they are verb + object + destination, which is not one contiguous span. The comment should say so. `contracts.ts` is w2's file, so I left it alone.
- Starting a quote at the verb drops lead-in context: the site name ("On Hammerline,", "On Farbazaar,") and, for social confirm-requests, "Go through my friend requests and". The brief asked for "from its verb". If the model needs the site or the object's context, the quote could start at the sentence start for a sentence's first act instead.
