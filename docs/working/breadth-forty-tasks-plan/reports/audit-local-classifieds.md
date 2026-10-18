# Audit: local-classifieds (t712, worker `audit-local-classifieds`)

## Outcome

Done. All ten local-classifieds rows in `REALISTIC_SITE_LIVE_TASKS` have a verdict. Eight are ok as written.
Two breadth instructions are reworded to name the site's own category, because the bare word ("furniture",
"bicycle") does not pick out exactly the oracle's rows. No oracle or fixture data changed, and the five
original rows are untouched, so the 57-task baseline fixture still matches.

## Per-task verdicts

How I checked each one: I worked the answer out from the catalog (`catalog/listings/*`, `matching.ts`,
`places.ts`), read every term against the site's labels (`view/filters.ts`, `view/card.ts`, `view/listing.ts`,
`view/saved.ts`, `view/inbox.ts`, `client/chat-script.ts`), and confirmed a browser test in `tests/` reaches
the oracle. The judge compares values exactly (`run-expectations/extraction/value-match.ts`). Its only
loosening: a root-relative expected url also matches the absolute url on the run's origin.

| Task id | Verdict | Possible (browser test) | Notes |
| --- | --- | --- | --- |
| local-classifieds-bike-search | ok | `tests/browser.test.ts` "bike search: category, radius, …" | 12 rows, prices all different (£100 to £400, both ends included, matching the filter's Min/Max). Searching "bike" instead of using the Bicycles category adds nothing in this price range (exercise bike £85, helmet £20, rack £45, balance bike £35 all fall outside it). The traps are named or follow from the filters: adverts ("leave out sponsored posts"), the card sent twice ("each bike once"), the sold bikes ("for sale"), the Hallam Cross relisting at 11.4 mi, "Results outside your search". Location and url are defined. Price and title as the card prints them is the only form on the page, and the struck-through "was" price is not the price. About 20 acts on 2 pages. Fits. |
| local-classifieds-bike-search-list-layout | ok | `tests/browser.test.ts` "bike search, list layout" (row read on the variant) | Same instruction and oracle. The row's meta line is `place · condition`, and the place span alone is the location. |
| local-classifieds-bike-search-location-check | ok | `tests/browser.test.ts` "bike search, location check" | "Yes, that's right" keeps Kelford at 20 mi, and the filters then apply as before. The answer is the same. |
| local-classifieds-save-dining-tables | ok | `tests/browser.test.ts` "dining tables" | Within 5 mi the cheapest real dining tables are pine £45, glass £60 and industrial £95. The hairpin legs (£28, "Legs only, no table top") and the four dining chairs (£40) are not tables. Drop-leaf (Brackwater 6.7 mi) and white gloss (Hallam Cross) are outside the radius. The £35 veneer table is sold ("for sale"). The Oakhaus advert is £299, so it is never among the three. "Everything in my saved items" includes the two earlier saves: lamp £22 Available and armchair £65 Sold. No price ties. Status is the row's Available/Sold. This is the heaviest path: 3 listing pages, the chat window closed once, the radius picker's double Apply, then the saved page and its sort, about 20 acts on 6 pages. Plausible at $0.25, but the most likely of the ten to run short. |
| local-classifieds-make-offer | ok | `tests/browser.test.ts` "offer: …" (plus the forbidden-message path missing the goal) | The cheapest like-new folding bike within 10 mi listed in the last 7 days is the £165 16in bike (Morgan Tate, listed 44 h ago). The £95 Brackwater folder is 216 h old, so the site's own "Last 7 days" filter excludes it. Its page says "Listed 1 week ago" with an exact-date tooltip (12 September against the site's 21 September), so a reader who skips the filter can still tell. The Velomart advert is excluded by name. £140 is a valid offer. Judged by `playbackGoal`, and the goal facts let a judge confirm the act. |
| local-classifieds-remove-sold-saves | ok | `tests/browser.test.ts` "qualification preservation: remove Sold save …" (and Hide failing the account oracle) | Only the armchair is Sold. Removing it leaves the £22 lamp, Available. Hiding, offering and messaging are each forbidden by name. Values are "exactly as the saved list shows them". About 5 acts. Fits. |
| local-classifieds-nearby-furniture | **reworded** | `tests/breadth.test.ts` "nearby furniture: …" (and the no-limit read missing it) | Why: "every piece of furniture" may leave out the £28 hairpin legs. That listing is in the Furniture category, but it is a part: its description says "Legs only, no table top". The oracle includes it, so the instruction did not decide the answer. The fix names the site's category, which the oracle already follows (`FURNITURE_QUERY`). Old: "list every piece of furniture for sale within 5 miles of Kelford that costs £100 or less, newest listings first. Leave out sponsored posts and list each item once, …". New: "list every listing in the Furniture category that is for sale within 5 miles of Kelford and costs £100 or less, newest listings first. Leave out sponsored posts and list each listing once, …". Ages all differ (6 to 50 h), so "newest first" gives one order. About 12 acts plus scrolling. Fits. |
| local-classifieds-test-ride-question | ok | `tests/breadth.test.ts` "test-ride question: …" (and the ready-made message missing the account oracle) | Within 5 mi, new to good: the cheapest titled road bike is the £285 56cm (Tomasz Wrona). The vintage £210 is "Used – fair", the 54cm £199 is sold, the 50cm is at 8.9 mi, and the gravel advert is excluded by name. The single-speed "town bike" (£190) and the cruiser are not road bikes. The message is quoted word for word, "only that one message" rules out the ready-made one, and seller is defined. About 15 acts. Fits. |
| local-classifieds-carbon-price-check | ok | `tests/breadth.test.ts` "carbon price check: …" (and the forbidden offer failing the account) | There is one carbon road bike, and it is in Kelford Harbour: £395, reduced from £450. "What it costs now" selects £395, which is over £350, so nothing is sent. Condition is "the condition the listing states", which is "Used – like new" (en dash, as the Details row prints it). About 5 acts. Fits. |
| local-classifieds-bikes-within-alex-price | **reworded** | `tests/breadth.test.ts` "bikes within Alex's price: …" (and the buyer's £180 missing it) | Why: under £200 "every bicycle" no longer settles the set. A "bike" search finds the exercise bike (£85, Sport), the helmet (£20) and the car rack (£45), which the oracle excludes. The Bicycles category also holds the £35 wooden balance bike, which has no pedals, and the oracle includes it. The fix names the category the oracle follows (`BUDGET_BIKE_QUERY`). Old: "Then find every bicycle for sale within 10 miles of Kelford that costs no more than that price and is new, like new or in good condition. … and list each bike once, …". New: "Then find every listing in the Bicycles category that is for sale within 10 miles of Kelford, costs no more than that price and is new, like new or in good condition. … and list each listing once, …". Alex's figure is £200 on both the Buying snippet and the chat window, and the buyer's own £180 is labelled as the buyer's. "No more than" includes £200. Prices all differ. About 18 acts. Fits. |

No task has an empty right answer, so none needs to say one is possible. None of the four lane trees' debug
notes (`fxwork/{t563,t565,t566,t567}/…/debugs/`) names this site. All of them are everything-store, so there is
no live wording failure here to account for.

## What changed and why

- `apps/scenario-lab/src/scenarios/local-classifieds/live-tasks.ts`: the two rewordings above. Each now names
  the site's own category in place of a word that reads wider or narrower than it. Each task is still one row,
  so no other row shares its instruction.
- `apps/scenario-lab/src/scenarios/local-classifieds/breadth/tests/answers.test.ts`, in "each plausible wrong
  reading…": new checks that a "bike" search under Alex's filters finds the exercise bike, the helmet and the
  rack; that the Furniture answer holds the table legs; and that both instructions say "every listing in the
  Furniture/Bicycles category". If someone rewords back to the bare word, the test fails.

## Commands run and observed results

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`), after the last edit:
  build completed (`"step":"scenario-lab:build" … "ms":65084`).
- `node --test "dist/scenarios/local-classifieds/**/*.test.js"`: `# tests 41`, `# pass 41`, `# fail 0`. This
  includes the browser tests in `tests/browser.test.ts` and `tests/breadth.test.ts`, headless Chromium, one per
  task and variant.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`
  (two unit-only catalog files, no browser): `# pass 17`, `# fail 0`. This covers no selector-like tokens,
  every column named, the permission-point families, and "qualification additions preserve the complete
  ordered original 57 tasks".
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs` (repo root): `structure-audit: passed (204 warning(s), 638 baselined).`
  The warnings are existing advisory file-length warnings in other packages.

## Not verified

- No live (paid) run. The purse figures are act counts from the honest path, not measured spend.
- Whether a model building a Flow would choose the category route over a search is a live question. The
  rewording only makes the instruction decide the answer.
- The whole scenario-lab suite was not run, as the brief requires while live lanes run.

## Open questions or contradictions found

- The price format is left implicit in the bike, tables, furniture, test-ride and Alex instructions. The judge
  compares exactly, and the oracle uses the card's form ("£285"). I left these alone: extraction reads that form
  off the page, and the site prints no other. If the supervisor wants "as the listing shows it" added to the
  original rows (bike ×3, tables), `scenarios/tests/fixtures/realistic-task-baseline.ts` lines 28 to 31 would
  need the same text, because "preserve the complete ordered original 57 tasks" deep-equals them.
- Nothing under `scenarios/tests/*` or `src/tests/*` needs changing for this audit's edits.
