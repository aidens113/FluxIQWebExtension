# Audit: auction-marketplace (t713)

## Outcome

Done. I audited all ten Hammerline rows in `REALISTIC_SITE_LIVE_TASKS`: two originals reworded, eight ok. No oracle or
fixture needed fixing. Each task already has a browser-path proof in the site's tests, so no test was added.

The reword breaks the frozen-baseline test until the supervisor updates the baseline (see "Open questions").

## What changed and why

Only `apps/scenario-lab/src/scenarios/auction-marketplace/live-tasks.ts` changed: two instruction constants.

### Verdicts per task id

Times below come from the fixture's clock (Mon 21 Sep 2026, 14:00 BST). Pound estimates use the site's rates (EUR
0.8679, USD 0.7463).

- **auction-marketplace-kestrel-auctions**: **reworded.** Its two variant rows share the constant and changed with it.
  - Old: "...and not a lens, case, box or any other accessory. Leave out..."
  - New: "...and not a lens, case, box or any other accessory; a camera that comes with a case, flash or other extras
    still counts. Leave out..."
  - Why: two of the ten owed auctions have extras in their titles. m4 is "Kestrel 35 rangefinder camera body +
    original leather case" and m8 is "Kestrel 35 camera with flash & manual". A careful reader could take "not a ...
    case" to drop them. Nothing else had to change:
    - Edge prices: x8 at £152.00 and x9 at EUR 175 (about £151.88) are £150 or more. m9 at EUR 169 (about £146.68) and
      m6 at US $189 (about £141.05) are under.
    - For-parts listings (x1, x2, x3, x12, x13) carry that condition label on the card.
    - Fixed-price listings (x4 Best Offer, x5, x6, x11) are excluded.
    - Same title twice: m1 and m3 are both called "Kestrel 35 Rangefinder Camera", and "each auction once" keeps both.
    - The pair o4 (£180) and the set x7 (EUR 1,165) are over the limit whichever way they are read.
  - Purse: one search, then either about eight filtered page loads (bot check and sort included) or three keyword
    pages read card by card. That fits $0.25.
- **auction-marketplace-kestrel-auctions-grid-view**: **reworded** (shares the instruction). It owes the same ten.
  Proof: the "gallery layout, whole chain" test.
- **auction-marketplace-kestrel-auctions-feedback-survey**: **reworded** (shares the instruction). It owes the same
  ten. Proof: the "survey, whole chain" test.
- **auction-marketplace-watch-endings**: **reworded.**
  - Old: "...not the 35S, the Mark II, the 350 or an accessory, and nothing listed as for parts or not working. Then
    list..."
  - New: "...not the 35S, the Mark II, the 350, or a lens, case or any other accessory, and nothing listed as for
    parts or not working; a camera that comes with a case still counts, and so does an auction that also offers Buy it
    now. Then list..."
  - Why: m4 is one of the three owed additions. It is the auction that also offers Buy it now, and it comes with a
    case. Unlike its sibling instruction, this one never said either still counts.
  - Lens and case are now named, matching the sibling, because some accessories pass both the time and the price
    tests: the lens o6 (EUR 32, ends Tue 11:00), the case a6 and the box a7.
  - Unchanged and unambiguous:
    - m5 ends Wed 23 Sep 00:05, just after the limit, and its card shows that date.
    - m3 is already watched, and the oracle catches a second press that would remove it.
    - The final list includes the unrelated n1 lens ("everything on my watchlist").
  - Oracle: m1, m2, m3, m4, then n1, ending soonest. The proof is the browser test "the watch workflow's honest
    path".
  - Purse: about eight pages and three watch acts. That fits.
- **auction-marketplace-place-bid**: **ok.**
  - harrow_cameras has three Kestrel listings: m7, the original 35 at auction; x4, the original at fixed price with
    Best Offer, which is not "up for auction"; and l1, a 35S.
  - A maximum of £85 beats the rival's £82 maximum, so the bid wins at £84.00.
  - The permission point `move_money` / "Confirm bid" is declared. Proof: the browser test "the bid workflow's honest
    path". Purse: three to four pages.
- **auction-marketplace-remove-watched-accessories**: **ok.**
  - The watchlist starts with m3 (a camera) and n1 (an Ostara lens). "Lenses and other accessories" removes n1 and
    leaves m3: "Kestrel 35 Rangefinder Camera" at £41.00.
  - The permission point `delete` / "Remove" is declared. Proof: two "qualification readiness" browser tests.
- **auction-marketplace-cheap-accessory-auctions**: **ok.**
  - The search "kestrel 35" turns up seven auctions under £10. Six are owed: a1 £9.50, a3 £4.20, a9 EUR 6,50 (about
    £5.64), o2 £8.00 (the "K-35" token matches), a5 £7.00 and a8 £5.00.
  - The seventh, x12, is the £9.00 display dummy, a camera ("working or not"). The cable release a10 (£8.99) is
    fixed price. The advertisements (the n listings) are all £10 or more.
  - Proof: three breadth-path tests, by filters, by reading the keyword pages, and the dummy refused.
  - The one live failure on this task (t565 debug `run-mvcwp3wh-bcea2115`) was the plan tool's JSON placement in
    Core, not wording.
- **auction-marketplace-save-mark-ii-sellers**: **ok.**
  - There are four Mk II auctions, however each title writes the model: l4 fotokiste-utrecht, l5 sprocket-and-spool,
    l6 kameraboden ("Mark 2") and l10 northgate_photo. There is no fixed-price, ended or for-parts Mk II.
  - The Saved sellers list is alphabetical whatever the save order, which the breadth test pins.
  - Purse: about six pages and four saves.
- **auction-marketplace-buy-it-now-quote**: **ok.**
  - m4 is the only `auction-bin`. x11 is fixed price, despite "Buy it now" in its title, and the breadth test refuses
    it.
  - The review shows "Price: £140.00" and "Postage: +£6.50 postage". The instruction asks for price and postage as
    separate columns, so the current bid (£96.00) and a total are both ruled out.
- **auction-marketplace-lens-hood-seller-shop**: **ok.**
  - A search for a Kestrel 35 lens hood returns a4, the hood on its own (the_camera_loft), and x7, the collector's set
    "with 3 lenses & hood" (fotokiste-utrecht). The instruction excludes the set by name.
  - The shop lists eight live items in its own order. Proof: two breadth-path tests.
  - Purse: four pages. The shop opens in a new tab.

## Commands run and observed results

All of these ran in the t713 worktree.

- `node ../../scripts/build-cache/cli.mjs scenario-lab:build` (in `apps/scenario-lab`): built in 28.8 s.
- `node --test "dist/scenarios/auction-marketplace/**/*.test.js"`: tests 56, pass 56, fail 0, in 149.6 s.
- `node --test dist/scenarios/tests/realistic-site-live-tasks.test.js dist/scenarios/tests/live-instructions.test.js`:
  16 pass, 1 fail. The failure is "qualification additions preserve the complete ordered original 57 tasks". It is
  expected: the baseline fixture still holds the old text of the two reworded originals.
- `pnpm.cmd --filter @fluxiq-web-extension/scenario-lab check`: exit 0.
- `node scripts/structure-audit.mjs`: passed, with 204 warnings and 638 baselined. Exit 0.

## Not verified

- No live Lab run of the reworded instructions.
- I did not run the whole scenario-lab suite, as the brief says.

## Open questions or contradictions found

- **Needed outside my ownership:** `apps/scenario-lab/src/scenarios/tests/fixtures/realistic-task-baseline.ts`
  lines 33-36 hold the old instruction text. Replace it with the new `KESTREL_AUCTIONS` text in the three
  kestrel-auctions rows (33-35) and the new `WATCH_ENDINGS` text in the watch-endings row (36). Then
  `realistic-site-live-tasks.test.ts` passes again.
- `docs/working/language-driven-flow-loop-plan/reports/scenario-inventory.md` (lines 1077 and 1081) quotes the old
  text. It is a historical report; updating it is optional.
