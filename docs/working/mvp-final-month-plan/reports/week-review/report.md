# FluxIQ extension: what failed this week, and why (2026-09-29 to 2026-10-06)

Written for Aiden by the supervisor on 2026-10-06, from four evidence reports in this folder
(`numbers.md`, `causes-late.md`, `friction.md`; `causes-early.md` for 09-29/30 is still being compiled
and will be added) plus the round-3 lane reports. Every claim below has a run id or commit in those files.

## The short version

- **Almost nothing passed.** About 190 paid live runs, about **$17 spent, 99% of it on failed runs**.
  Only **5 real passes**, all on one task (lane A, crossborder hub-to-cart). No lane has passed twice in a row.
  Lanes B (bigbox cart), C (earbuds list) and D (confirm requests) never passed.
- **73% of runs produced no Flow at all** (57 of 78 in the ledger period). The build ran out of its 48 calls or
  $0.10 before it finished, almost always because the model was stuck repeating refused or useless decisions.
- **The model is mostly not failing at the web task. It is failing at our build loop.** It finds the right
  pages and does the right clicks most of the time. What sinks it is the loop's bookkeeping: acts credited to
  the wrong step, refusals that do not say how to get out, reruns that change nothing, and lists it cannot read.
- **The judges are wrong as often as they are right.** In the 11 runs where both the task oracle and FluxIQ's
  judge gave a verdict, they disagreed 6 times: 3 correct Flows were thrown away and 3 wrong ones accepted.
  Round 3 did it again: lane C's answer was exactly right (13/13 rows, 52/52 fields) and was refuted; lane D's
  answer was wrong and was accepted.
- **A lot of time went to process, not product.** Serial integration by one supervisor, lane fixes sitting
  unmerged in lane trees for days, a 09-30 relaunch loop that burned $4.25 with nobody watching, slow and flaky
  full suites, and stale builds giving false failures.
- **Many causes are now fixed** (most judge evidence gaps, page-view gaps, lasting acts done twice, loop
  bookkeeping for refused reruns). The ones still open are listed at the end.

## 1. The numbers

| Measure | Value |
| --- | --- |
| Live launches | ~536 (190 paid; 346 more failed at $0 against an empty balance on 09-30) |
| Spend | ~$17.04 total; $16.82 on failed runs; passes cost $0.22 in all |
| Passes | 5, all lane A (`murwd8le`, `musp8nz1`, `mut4fvkm`, `mutepu6b`, `mux6n7m4`) |
| Runs with no Flow produced | 57 of 78 (73%), $4.95 |
| How failed builds ended | purse ran out 17; "build not finished" 14; repeat refused 7; amendments refused 4; other 1-2 each |
| Judge vs oracle | disagreed in 6 of 11 (3 right Flows refuted, 3 wrong Flows accepted) |
| Mean cost per run | $0.10; 9 runs used 64+ calls |
| Peak-hour runs | 10 runs, $0.82, no passes (peak halves the decisions $0.10 buys) |

Per lane since 09-30 evening: A 22 runs, 5 passes, $1.61. B (and its variants) 26 runs, 0 passes, $2.88.
C 17 runs, 0 passes, $2.00. D 13 runs, 0 passes, $1.09.

## 2. What stops the model from succeeding (ranked by runs affected)

### 1. Acts credited to the wrong step (23 runs)
The model says "this step adds to cart" (or does a choice) on a step that does not do it: a search, a product
link, a popup dismissal, the Spain option, the quantity field. Core accepts the claim. From then on every
checklist, "nothing left to do" answer, stall note and ending treats the act as done, so the real Add to cart
is never authored or tested. Lane B's round-3 build failed exactly this way (towels "added" by the click that
opened the product page).
- Fixed: one act per step; acts on reads are information only; doubtful claims flagged; origin as its own choice;
  tonight, a click that only opened the page of its choices no longer counts (`cb783cba`).
- Open: Core still trusts the model's claim in general. An `add` whose settings rewrite what a step did is still
  accepted (lane A run 2, fix in progress in t281).

### 2. Refusal churn: re-sending what was already refused (23 runs)
The model re-sends `keep`, `repeat`, `act`, `bind` or `rerun` amendments that are refused or change nothing,
and the answer does not show a way out. This eats the budget: 27 of 38 decisions in one run, 35 of 55 in
another, about 20 in lane A's round-3 run 2, 19 in lane D's.
- Fixed: many specific answers now name the way out ("keep adds nothing", how to reorder, bindable keys); a
  refused amendment with a rerun no longer loops (the nine-round loop you watched), verified working live.
- Open: new shapes still appear each round (no path to "a read after the act" in D; a no-op drop mixed with keeps
  escapes the keep answer in B).

### 3. Judges given the wrong evidence (18 runs) and verdict handling (7 runs)
Judges judged without the end page, without the rows, without each step's change, or treated exploration's
cart as the Flow's result. Separately, a lone unconfirmed "yes" could finish a build.
- Fixed: judges now see the end page, each step's change, would-be-stored rows, paging evidence, rows Core
  checked; tonight, a left-out row is only treated as testing a label when that label is the tested column
  (lane C's refutation, `8552ba71`).
- Open: judges still read state left by exploration as if the Flow made it; the lone-unconfirmed-yes path
  (lane D round 3) is being fixed now.

### 4. List reading (12 runs directly, and most of C and D)
Lane D ran the read node 10-16 times per build; lane C 6-13. Causes found tonight:
- The model almost never asks for the node's definition (2 of 23 runs), so it writes list parameters blind.
  **Fixed tonight** (`a3cc9a47`): a node's definition is given to the model the first time it runs it.
- The detection tool names fields by the site's scrambled CSS classes with no sample value, so the model reads,
  inspects rows, and reads again to learn which column is which. **Fix ready** (t279, samples and readable labels).
- Pagination inside the read node caused repeated failures (last-page detection, refused reruns).
  **Your redesign** (read one page; every read's rows collect into the run's dataset; post-processing dedupes)
  has a full design ready with 10 questions for you.

### 5. Loop bookkeeping and the repeat guard (14 runs)
The guard that should stop identical failing calls never fired live: the page-state digest included the
browser's frame id, which changes on every reload. Refused work was recorded as "applied". Reruns counted as
progress.
- Fixed tonight: frame-stable digest (`c16895b2`), refused-with-rerun loop (`68c4c9a7`).
- Open: a check that ran nothing is counted as a failed attempt and blocks the real call (lane A run 2, in t281).

### 6. Spend limits (14 runs)
$0.10 and 48 calls buy 20-45 decisions. Peak pricing halves that. Early on, cache prefixes broke and requests
grew. Much of this is now fixed (true-cost purse, stable prompt prefix, names-only catalog); the rest is policy
and launching off-peak.

### 7. Wrong page for a rerun or repair (13 runs), and page view gaps (14 runs)
Reruns ran on page 5 of 5; repairs opened where the test left the page; stale handles after reloads; the page
view hid controls (clipped lists, unnamed +/− buttons, search box by placeholder). **Mostly fixed.**

### 8. The model's own judgement (15 + 8 runs)
Filters that drop wanted rows (the "charging case" rule in every C run; a regex over "and 4 other mutual friends"
in every D run), picking a shipping-only product, not pressing Search. Detection after the fact is fixed; the
model still makes these mistakes. Node definitions and readable fields should reduce the filter errors.

### 9. Lasting acts done in tests (9 runs)
Build tests pressed Add to cart again (a cart reached 13 items) and confirmed the wrong friend requests.
**Fixed** (none since 10-05): lasting acts are checked, not repeated.

## 3. Biggest friction and time wasters in how the work ran

1. **Integration was a serial bottleneck.** Lane fixes sat in lane trees and branches; twelve integration rounds
   in four days fought over the same hot files; leads cannot merge; Codex's t262 stayed local 10-03 to 10-05.
   Every live round waited on it.
2. **Unsupervised relaunch loops (09-30).** After the leads died on a session limit, launcher scripts kept
   starting runs: $4.25 over 47 runs nobody debugged, then 346 failed runs on an empty balance. Now guarded
   mechanically (balance stop, no relaunch on unchanged source, at most 3 starts per 30 minutes).
3. **Slow, noisy full suites and stale builds.** Every sweep produced 15-second timeouts under load (7 to 39 at a
   time, none real), each needing a rerun to prove it. Stale Core/domain builds produced false failures on 5 days.
4. **Live days lost to design stops.** Correct stops, but each cost a day: a 500 KB raw page view (09-30), a page
   view that hid controls (10-01), general Flow authoring (10-03).
5. **Two supervisors with different conventions** (Codex and Claude), reconciled on 10-05 at real cost.
6. **Peak-hour launches** (round 2 on 10-06) bought half the decisions for the same money; only a memory rule
   prevents it, nothing enforces it.
7. **Under-counted spend.** The ledger missed $1.22 of failed chat builds on 10-01 and killed runs; fixed since 10-02
   except killed runs.

## 4. What a person using the extension hits most

1. **The chat speaks the system's language.** Node names, "pagination", step numbers, raw ids, judge sentences cut
   mid-parenthesis. Mostly fixed (t276, t277, tonight's sentence splitter).
2. **Cards hid what happened.** No row counts, "Passed" on an empty result, refusals shown as work and stacked six
   deep, "it wasn't on the page" when the list was visible. Fixed, except read counts during a build.
3. **A failed build does not say what blocked it.** The ending gave dollar arithmetic instead of the blocker.
   Fix ready (t279: "What blocked the last fix: it was tried 7 times, and each time ...").
4. Still open: the previous build's "is ready" chat flashing at start; the overlay absent for ~4.7 s after send;
   "6 of the 6 things you asked have a step" overstating; list names on detect cards (fix ready in t279).

## 5. Fixed vs not fixed

**Fixed and on dev (pushed):** judges see the end page, step changes, stored rows and Core's row checks; lasting
acts never repeated in tests; page view shows every control; reruns run from their own page; repairs told where
each step starts; refused-amendment loop; frame-stable page digest; node definitions given on first use;
"keep adds nothing"; drops that strand a step refused; a list read on the wrong page reported as such; a click
that only opens a product page no longer counts as adding to cart; lane C's label check; the 49-of-48 call count.

**Ready, not yet merged:** readable field labels with sample values, list names on detect cards and the plain
failure ending (t279).

**In progress:** lane A run-2 causes (an `add` rewriting what a step did; checks that ran nothing counted as
failures; a toggle step that passes only by luck); lane D's unconfirmed-yes path and "a read after the act".

**Open, no fix yet:** Core trusting the model's act claims in general; judges reading exploration's leftovers;
the re-author having no honest "nothing to change" ending; read-list redesign (design done, needs your answers);
the model's own filter and product-choice mistakes; enforcing off-peak launches; killed runs' spend.

## 6. What I would change next, in order

1. **Make verification trustworthy before anything else.** A judge that is wrong 6 times in 11 turns every live
   run into noise. Next fixes: judges see only what the Flow did (not exploration's leftovers), and no build ends
   on an unconfirmed yes.
2. **Stop trusting act claims.** Core should decide which step did an act from what changed on the page (cart
   count, chosen state), not from the model's label. This is the single largest cause (23 runs).
3. **Every refusal must carry its way out, and churn must end early.** When the same kind of refusal repeats, end
   the round and test what exists, rather than spending the purse on it.
4. **Land the read-list redesign** once you answer its questions; it removes the paging failures in C and makes
   collection explicit.
5. **Integrate continuously.** Merge each verified fix the hour it is ready (as tonight), keep lane trees short-lived,
   and enforce off-peak launching in the Lab guard rather than by memory.
</content>
</invoke>
