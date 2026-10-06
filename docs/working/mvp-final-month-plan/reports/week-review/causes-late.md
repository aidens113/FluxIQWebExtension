# Week review: causes of live-run failures, 2026-10-01 .. 2026-10-06

Worker: week-review-causes-late. Read-only. I edited only this file. I ran no build, test, Lab, browser or provider
command.

## Outcome

Done. 69 run debugs were read, and their causes are merged into one table (Table 1) with run ids, dollars where known,
status and evidence. The per-run register is Table 2.

- 65 debugs were added on dev from 2026-10-01 to 2026-10-06, found with `git log --since=2026-10-01
  --until=2026-10-06T23:59 --diff-filter=A` on `language-driven-flow-loop-plan/debugs`.
- 4 debugs are newer than dev and exist only in the lane trees: t262 has `mux6n7m4`, `mux6pndp` and `mux74k5q`; t274
  has `mux6naez`. The `mux6naez` file holds only expectations and a watch log, because that run was still in flight.
  It has no causes yet.
- None of these 69 files is a relaunch-loop stub. Those stubs date from 2026-09-30 and belong to the causes-early
  brief.
- I also read these reports:
  - the lane reports `mvp-final-month-plan/reports/live-{a,b,C,d}.md`, `live-a-r2-fix-rerun-node.md`,
    `live-b-fix-1.md` and `live-b-fix-2.md`;
  - Codex's `mvp-live-continuation-2026-10-03/reports/resume-ab.md` and `resume-cd.md`.
- Every run id named in the Codex live-run reports (`live-*`, `debug-*`, `full-debug-*`) has a debug in this set, so
  those reports added status, not new runs. `resume-ab` and `resume-cd` are integration inventories with no new causes.
  Their one relevant finding: on 2026-10-03, prepared fixes sat uncommitted in four lane trees (t174, t193, t194,
  t195), and the lead documents were stale.

Run ids below drop the `run-` prefix and the hash suffix (for example `muq3ubys` is `run-muq3ubys-4b4dbf5b`). All 8-letter
prefixes in the window are unique. `R/` is Core `packages/fluxiq/src/programs/automation-studio/runtime/`. A hash is
from `git log dev` of Core (`!FluxIQ`) or of this repository (`ext`). "Fixed" means the hash's subject names this
cause. I did not re-test any fix.

## The answer in short

**Results of the 68 debugged runs.** `mux6naez` is excluded because it was still running.

| Result | Runs |
| --- | --- |
| Pass (oracle and verdict) | 3: `musp8nz1` (A, flash, $0.024), `mutepu6b` (A, $0.057), `mux6n7m4` (A round 3, $0.040) |
| Oracle held but the run failed | 2: `mut4fvkm` (runtime status after a recovered busy press), `muw5zv4m` (post-run judges refuted a correct cart) |
| FluxIQ said pass, oracle failed | 1: `muqj2bgb` (10 of 13 rows) |
| Ended before any useful provider call | 5: `muq0in9r` (killed by the supervisor), `muq2dlhq` (chat read timed out), `mut6b2re`, `mut7h5k2` and `mut7hh6c` (Lab chat setup) |
| No pass | the other 57 |

Lane A, the crossborder hub-to-cart task, made all 3 passes. Lanes B (bigbox cart), C (earbuds list) and D (confirm
requests) did not pass once in this window.

**Spend.** Of the 68 runs, 67 state a cost (four of them $0). Those 67 total $6.41. The 3 passes cost $0.12 of
that. `muq5v4zg` states no cost.

**What stops the model from succeeding, by runs affected:**

1. **Acts claimed on the wrong step (W1, 23 runs).**
   - The model names "add to cart", or a choice, on a step that does not do it: a search, a link, a dismissal, the
     Spain option, the quantity field.
   - Core accepts the claim. Every checklist, refusal and ending that reads it then hides the act as done.
   - Status: partly fixed. Core now flags such claims as advice and has an origin choice. The round-3 fix that stops
     counting such a claim as done is still uncommitted in the t262 tree.
2. **Refusal churn (W2, 23 runs).**
   - The model resends amendments (`keep`, `repeat`, `act`, `rerun`) that Core refuses or that change nothing.
   - The answers do not show it the way out, and the build spends its budget there: 27 of 38 decisions in
     `mustzxhi`, 14 of 30 in `murzln6g`, about 20 in `mux74k5q`, 19 in `mux6nxst`.
   - Status: partly fixed (many commits). New shapes were still found in round 3.
3. **Judges given the wrong evidence (W4, 18 runs).**
   - Build-test and result judges judged without the page, without the rows, without each step's change, or with the
     exploration's cart as the Flow's result. They passed wrong Flows and refuted right ones.
   - Status: mostly fixed between 2026-10-02 and 2026-10-05. Two pieces remain open:
     - judges still read state that exploration left as if the Flow made it;
     - a lone unconfirmed yes can still finish a build (W5).

**Model judgement (W3, 15 runs).** The model's own filter mistakes are next:

- The earbuds "charging case" rule removes 3 true pairs in every lane C run.
- A regex over "and 4 other mutual friends" drops Jonas in every lane D run.

The notes and judge evidence now catch these after the fact, but the model still writes them.

**UI defects (W25-W27) appear in most runs** (about 37 debugs list some). They did not cause failures.

## Table 1: causes, merged

Theme names follow the shared rules. Rows are ordered by runs affected within each group, starting with what stops a
build.

| # | Cause in plain words | Theme | Runs affected (count) | Dollars where known | Status | Evidence |
| --- | --- | --- | --- | --- | --- | --- |
| W1 | The model names an act (add to cart, a choice) on a step that does not do it: a search, a typing step, a link or product press, a popup dismissal, the Spain option, the quantity field, a read. Core accepts the claim, so the checklist, refusals, stall notes and the ending all treat the act as done, and the real press is never authored or tested. | loop bookkeeping and guards | muq3ubys, muq3uozx, muq5vb5w, muq6lqnw, muq6mlom, muq70foz, muqclqt5, muqiho5c, muqiojz4, muqk4u32, murwdp4f, murzln6g, musp4h2f, musq0b1m, musuq910, mut58jbo, mut8rxuc, mutacf69, mutcb2ic, muteqswo, muw60unq, mux6pndp, mux74k5q (23) | `musq0b1m`: $0.0646 on repair plus a 41 s test caused by a reorder on the false claim. Whole runs at stake. | **partly**. Core 553ff0ff (one act per step), 30f65794 (an act on a read is information), 9f756676 (doubtful claims flagged as advice), 32b4e37c (origin is its own choice, so Spain stops claiming a1). **Open**: the act judge in `R/flow-bootstrap/instructed-acts/standing.ts` (`step_only_opens_its_choices`) is uncommitted in the t262 tree. A1a (an `add` amendment's `settings` rewrites the target of a ran step) is open. Refusing a claim whose control does not name the act is open. | debugs `run-mux6pndp-16feb842.md` cause 1 (t262 tree), `run-mux74k5q-1c3c2127.md` C1 (t262 tree), `run-musp4h2f-72e8ed99.md` 7, `run-muqiho5c-e830ce01.md` 1-3 |
| W2 | Refusal churn. The model resends `keep`, `repeat`, `act`, `bind` or `rerun` amendments that are refused or change nothing, or it reruns a listing unchanged. Core's answers name no way out: no `reorder`, no "keep adds nothing", no clear-repeat, no "a read after the act is a new step", no `next` on `no_such_step` or `already_in_flow`. The build's decisions run out there. | model guidance/prompt | muq3uozx, muq5v4zg, muq66ff9, muq6lqnw, murz83zy, murzln6g, musp39u8, musp4h2f, musr9pv3, mustvzvg, mustzxhi, mut58jbo, mut6bevx, mut8rxuc, mut8t1fk, mutac2q6, mutcb2ic, mutcbgbx, muteqswo, muw5zv4m, muwaq9w3, mux6pndp, mux6nxst (23) | `murzln6g` $0.0436 (14 of 30 decisions). `muwaq9w3` $0.033 (10 of 25). `mustzxhi`: 27 of 38 decisions. `mut58jbo`: 35 of 55. `mux74k5q`: about 20. | **partly**. Core 51e3df3e (`over_not_before` says how to reorder), 93a97346 (an act already done is told what is left), 6a9da8ea (amendment answers, stable rerun numbers, repeat revalidation, routing words), f83eeb5a (bind refusals point to bindable keys), 115f67e9 (model-facing feedback), 68c4c9a7 and merge fe8b274c ("keep adds nothing"). **Open**: D3-2 (no way to a read after the act, `R/llm/draft-amendment-feedback.ts`). Lane B `keepOnly` ignoring a no-op `drop`. `mustvzvg` C4 (`changes_nothing` worded for a step that never ran). | `run-mustzxhi-2e2cda87.md` R2-R3, `run-murzln6g-11debe1d.md` C2, `run-mux6nxst-c9bca37c.md` D3-2, `run-muwaq9w3-baaa4e19.md` 3 |
| W3 | The model's list filter drops rows the person asked for. The earbuds rule `name not contains "charging case"` removes the three "with Wireless Charging Case" pairs. A regex over "Aisha Khan and 4 other mutual friends" drops Jonas (5). The model ignores the rejected-rows note, and judges sometimes agree with the model or contradict the note. | model guidance/prompt | muq4oaof, muq66ff9, muqbzu32, muqj2bgb, muqk713g, murwcmx2, musp39u8, muw60j7c, muq3uozx, murdouox, murwcaj0, musp474o, musr9pv3, muw6144a, mux6nxst (15) | `muqj2bgb` shipped a 10-of-13 Flow judged right ($0.048). `muw6144a`: the repair broke a correct filter. | **partly** (the catch is fixed, the model error is not). ext 45a35c73 (note: a row that only mentions an excluded thing is not that thing), ext 073f2372, 3282abd7, 9d35e1ec; Core 925a4439 (`leftOutOnlyByThis`), fe7e3fbd, d764e86c, d7cb90ca (`leftOutNamingTheItem` turns an unexplained yes into a no). 30f65794 (atLeast hint). **Open**: D3-4. The model never reads the node definition and writes a regex instead of a count condition. Fix t280 (node definition on first use) is in flight. | `run-muqk713g-d08ad3dc.md` C1, `run-muw60j7c-bb7c9a62.md` C-2, `run-mux6nxst-c9bca37c.md` D3-4 |
| W4 | Judges are given the wrong or too little evidence, so they pass wrong Flows and refute right ones. Missing: the page after the run, each step's change lines, the rows a read kept or left out, what the Flow would store, the meaning of a paging stop (`pageLimit` read as "limit reached"), and that a read ran after checked (unpressed) acts. They also see exploration's cart as the Flow's result. | judges and verification | muq4oaof, muq66ff9, muqiojz4, muqj2bgb, muqk4u32, muqk713g, murwcaj0, murwd8le, murz83zy, musp39u8, musp4h2f, musp8nz1, musq0b1m, musuq910, mutac2q6, muw5zv4m, muw60j7c, muw6144a (18) | `muw5zv4m`: the playback built the exact cart, and the refutation plus re-author cost $0.0725. `murwd8le`: $0.0116, 20% of the run, on a judge flip. | **mostly fixed**. Core f11717b0 (judges see the end page; tests verify lasting acts), fe7e3fbd, 925a4439, 3d3aab17 (dedupe and page repeats), d764e86c (tested value of left-out rows), 5c893a98 (paging evidence), 5613270d (change lines), 7087e9ec (the finished-run check sees each step's change), d7cb90ca (`buildTest.stores`), eb672178 (`afterWithheld`); ext 3282abd7, 22f26582. **Open**: judges still read state exploration left (cart count, coupon) as the Flow's (`musp8nz1` 3, `musq0b1m` 7). The domain diff reads an in-place URL rewrite as a location change (`muw5zv4m` limit). | `run-murwd8le-79e735a8.md` 6-9, `run-muw5zv4m-52d83027.md` 1, `run-musp8nz1-dbd3905a.md` 3 |
| W5 | Verdict handling of judge replies. A reply is voided by an empty or over-long diagnosis text. An unsettled pair drops the no's reading. A lone first yes finishes a build. A yes then no buys a repair on an identical Flow. A yes with wrong `patchNeeded` advice is recorded. The judge reply hold is 8,000 tokens. | judges and verification | muqiho5c, muqk713g, murwcmx2, murwd8le, musp4h2f, muqilf9s, mux6nxst (7) | `murwd8le` $0.0116. `muqilf9s`: a test went unjudged with $0.009 left. | **partly**. Core 71cc5bae (empty text), 3aaa8386 (over-long text clipped), 781943ce (an unsettled pair keeps the no; a finishing yes is confirmed), ed35dfa1, 5c9cfb51 (2,000-token judge hold), 5613270d (softened progress). **Open**: D3-5. At the judging reserve an unconfirmed lone yes still finished `mux6nxst`'s build (`R/result-verification/agreement.ts`, `reserve-judging.ts`). | `run-murwcmx2-a1c6edf7.md` C-A..C-H, `run-mux6nxst-c9bca37c.md` D3-5 |
| W6 | Build tests and reruns do lasting acts on the person's account. They pressed Add to cart again (the cart reached 13 items and $198.67 in `musp4h2f`), and confirmed friend requests for the wrong people (Tom Becker, Priya Nair). The instruction reader missed split or counted cart acts and the coupon. | permissions and consequential acts | muq3uozx, muqilf9s, murwcaj0, muqiojz4, murwd8le, murwdp4f, musp4h2f, mut5amuc, musp8nz1 (risk only) (9) | Fixture accounts only. No real money. | **fixed** (none seen after 2026-10-05). Core f11717b0, 98324a2c (an act step is checked, not pressed), a9580f36 (a build never does an instructed act twice), 97e279de (split lasting acts protected), 9975ce6d (one instruction authority for lasting acts), 7eb25da4. | `run-musp4h2f-72e8ed99.md` 1, `run-murwcaj0-40e56557.md` R3/R7, `run-muqilf9s-c3211328.md` C6 |
| W7 | Checking instead of doing goes too far. A step that claims a lasting act is only verified in the build test, even when it is a navigation, the Spain option or a quantity typing. So the test never reaches the page or state that later steps need. Steps fail `unreproducible` or are excused, and a check that ran nothing can be taken as a change. | permissions and consequential acts | murzln6g, muw60unq, musuq910, mut58jbo, mut6bevx, mutcb2ic, muteqswo, mux6pndp, mux74k5q (9) | whole runs | **partly**. 32b4e37c removes the Spain case. 97e279de and 115f67e9 separate checked candidates from performed ones. **Open**: R2-C8. The comment in `R/flow-draft/verify-only.ts:35` still says "open". `mux74k5q` C2 (`rerun-check.ts` `checked()` takes a new node from a check that ran nothing) and C3 (the repeat guard counts that check as a failed attempt) are both open. | `run-mux6pndp-16feb842.md` 2, `run-mux74k5q-1c3c2127.md` C2/C3 |
| W8 | A rerun or repair runs on the wrong page or state. A paginating read reruns on page 5. A repair round opens off its start location (`not_at_start_location`) or on the page the test left. The put-back restores the address but not the in-page state. Handles go stale after a reset reload. A toggle rerun un-chooses the preset colour. | page state, routing and navigation | muq3vuwx, muq4oaof, muq5v4zg, muq66ff9, muqbzu32, muqc07fh, muqiojz4, muqk4u32, muqk713g, murwcmx2, musq0b1m, mutacf69, muwansvz (13) | `muq66ff9`: all 9 re-author reruns. `musq0b1m`: $0.0317 on stale handles. | **mostly fixed**. Core 5ba54a0a (a rerun runs from its step's own page), b1a12948 (a build opens at its start location), 2d45dc80 (the put-back redoes the earlier steps), 7f7f36f0 and 75a3b6d8 (a seeded step's start page), b17525d9, 863bb0ba and 29bf240e (the repair is told where each step starts); ext 50f8f62f, 218a6789, 0fae7130. **Open**: `musq0b1m` 4 (a stale handle after a put-back reload; the refusal does not say the page was renumbered). | `run-muq66ff9-cb3767a1.md` 1-2, `run-musq0b1m-0472cfa0.md` 4, `run-muwansvz-a2b4a987.md` R2-4 |
| W9 | The repeat guard and no-progress bookkeeping are blind or wrong. A refused amendment that came with an applied rerun was recorded as "applied", so the guard never fired (9 rounds). A rerun counted as progress. The guard reset on interleaved calls. 45 `find_on_page` calls went uncaught. Identical `run_flow` calls were not refused. A signature change counted as progress. Later the guard refused a real call because a check that ran nothing matched it. | loop bookkeeping and guards | muq3ubys, muq3uozx, muq4jztv, muq5v4zg, muq5vb5w, muq66ff9, muq70foz, muqiho7e, muqk713g, murwcmx2, murwdp4f, musr9pv3, muwaobm2, mux74k5q (14) | `muwaobm2` $0.0838 (the whole build looped to the ceiling). `muqk713g` $0.030 on a round after an unchanged one. | **partly**. Core c11fac90 (RG), 553ff0ff, 7c108850, 9549a34a, 67b95113 (draft signature), 6a9da8ea, 68c4c9a7 (refused amendment with a rerun no longer loops; verified in `mux6n7m4`). **Open**: `mux74k5q` C3. `muqiho7e`'s stronger progress test under a judge was proposed and not traced to a commit. | `run-muwaobm2-882cadd9.md`, `run-musr9pv3-f4bf6256.md` C7, `run-mux74k5q-1c3c2127.md` C3 |
| W10 | Rerun merge-patch semantics build inputs the model never wrote. A list is replaced whole and loses its selectors. A field merges by key and keeps the old attribute. A changed node keeps the old node's parameters. A stray key survives because the rerun merges over the refused attempt. `consequences: null` is carried. `consequences` lands inside `parameters`. The patch shape is ambiguous (14 `unexpected_input_keys`). An `add` amendment's `settings` rewrites what a ran step did. | loop bookkeeping and guards | muq4oaof, muq66ff9, muq6lqnw, murdouox, murzln6g, musp39u8, musp4h2f, mustvzvg, muwaobm2, mux74k5q (10) | `muq4oaof` $0.06 (16 calls refused `consequences_unreadable`) | **partly**. ext a5e5f5ef (no null consequences), 13a3b5cd (consequences inside parameters are read), 747668f0 (one missing key named); Core 41f96a49 (patches not refused for shape), b4091f30 (rename), 68c4c9a7 (`rerun-input.ts` drops parameters when the node changes). **Open**: `mustvzvg` C3 (merging over the refused attempt), `mux74k5q` C1a (`settings` rewrite, `R/flow-draft/amendment/apply.ts:225`), dropping a left-out key of a restated map (`murdouox` R3). | `run-mustvzvg-99695308.md` C3, `live-a-r2-fix-rerun-node.md`, `run-mux74k5q-1c3c2127.md` fixes table |
| W11 | Spend. The $0.10 ceiling and the 48-call allowance buy about 20-45 decisions. Early purse holds priced each call at its worst case and reserved 8,000-token replies. Requests grew (a 74k-character read result, a full node catalog). Cache prefixes broke when node definitions were inserted mid-prompt or tools were withdrawn. Peak pricing halves the decisions. | budget, cost and purse | muq3uozx, muq4jztv, muqbzqtu, muqbzu32, muqc07fh, muqclqt5, muqilf9s, murz83zy, murzln6g, musp4h2f, muwansvz, muwaq9w3, muwao5n4, mux6pndp (14) | `muwaq9w3`: $0.084 at peak against $0.044 off-peak for the same exploration. `murzln6g`: about $0.008 of cache collapses. `musp4h2f`: $0.0031. | **partly**. Core 30f65794 (budget by average call cost), 306296ae (names-only catalog), 9397dd0a (stable prefix), ab781df8 (one purse per Flow), 6cb19105 and 61698f0a (true-cost purse, no reply cap), 5c9cfb51; ext 9d841203 (rejected rows listed once). **Open**: cache collapses from describedNodes inserted mid-prompt (`murzln6g` C18, `musp4h2f` 12; t280 touches this area). Peak pricing is operational (memory rule: launch off-peak). The 48-call allowance is policy. | `run-muqbzu32-8691a65e.md` 1-5, `run-muwaq9w3-baaa4e19.md` 2, `run-mux6pndp-16feb842.md` 5 |
| W12 | Page view and press evidence hide what happened. False "covered" (clipped list, pinned bar, any overlap). Lone + − × dropped. Search box shown by its placeholder. Chips without chosen state. Typing does not say the form was not sent. Enter landed on a robot check unnoticed. A press result did not say what changed (un-chose). "Please select a Color." read as success. A hidden target read as "not on the page". The quantity field lost its name. Refusals did not quote the notice. | page state, routing and navigation | muq310ht, muq3ubys, muq3vuwx, muq4jztv, muq5vb5w, muq6lqnw, muq6mlom, muq70foz, muqbzqtu, muqc07fh, muqk4u32, murwd8le, musp8nz1, musq0b1m (14) | `muqc07fh`: about $0.027 (12 decisions on `find_on_page`). `muqbzqtu`: 6 of 22 decisions. | **mostly fixed**. ext 56065664, 96da6782 (F24-F28), e8c55d16 (every visible control, search fields marked, chosen chips), 47153ef1 (Enter landing), 50f8f62f (`find_on_page` scope), 72b36aff and b92e163a (press results say what changed, the notice, the quantity name), 415de3c3 (refused_by_page), 016dea39, 2294dd16 (type can submit), 747668f0 (consent closer). **Open**: none traced as still live. `musp8nz1` 4 (pressing a `marked` option) stays information by the user's rule. | `run-muqk4u32-0b36e58f.md` 1-3, `run-murwd8le-79e735a8.md` 1,4,5,14 |
| W13 | Model behaviour on site traps. It opened the shipping-only "250 Count (3-Pack)" instead of the 100 Count page that offers 250 Count. It never shortened a failed search. It pressed the wrong popup or item. It typed without pressing Search. Its narration contradicted its decisions. | model guidance/prompt | muq3ubys, muq5vb5w, muqbzqtu, muqclqt5, murwdp4f, murzln6g, mutcbgbx, mux6pndp (8) | whole runs (lane B) | **open** (model). The fulfilment ("both for pickup") is never parsed as a choice (`musp4h2f` 9; no `pickup` form in `R/flow-bootstrap/instructed-acts/instruction-choices.ts`). | `run-murwdp4f-35f976d2.md` C3, `run-musp4h2f-72e8ed99.md` 9 |
| W14 | Toggles and choice order. The model pressed an option already chosen. The Flow kept a cancelling pair (un-choose, then choose). A choice landed after its act. The choice-order note prescribed a reorder onto the wrong page. The stall note sent the model to an act before its owed choice. A kept toggle passes only because its target cannot be re-found (F1). | model guidance/prompt | muqk4u32, murwd8le, murwdp4f, murzln6g, musp8nz1, musq0b1m, mut4fvkm, muwaq9w3, mux6n7m4, mux74k5q (10) | `musq0b1m`: $0.0646 plus $0.0066 on the reorder. `musp8nz1`: $0.0027 on the pair. | **partly**. ext b92e163a (a press says it un-chose); Core 9f756676 and 6a9da8ea (`flow-draft/reversal.ts`), b52bf47d (page-aware reorder advice), 6f8212a5 (stall redirect: owed choice first). **Open**: F1 in `mux6n7m4` (pass leans on two defects: a kept toggle plus a resolver that cannot re-find a title-named swatch, `apps/extension/src/content/action-runtime/resolve-target.ts`). `murzln6g` C3 (no `move` for a choice after its act). | `run-mux6n7m4-8273e7a0.md` F1 (t262 tree), `run-musq0b1m-0472cfa0.md` 2 |
| W15 | The Flow's structure gets steps it should not, or loses ones it needs. The opener walk pulled an unadded unfiltered read into the Flow. A second copy of a read was re-added. A continuation round added its opening navigation. The opener needed an exact digest. Steps 3-5 were never added. The "See all" press ran but was not kept. An amendment stranded a kept step off its page. | loop bookkeeping and guards | muq4oaof, muq5v4zg, muqclqt5, muqilf9s, muqiojz4, muqk4u32, murwdp4f, muw60j7c, muwao5n4 (9) | `muw60j7c` $0.0814 (30 rows stored for 13) | **mostly fixed**. Core 5e368d1d (an observe-only read is never pulled in), 5156ea96 (OP2), de32cac2 and b17525d9 (opening navigation), 6902f21e (a joining step keeps its way; a refusal names the missing steps), 92d692fa and a3690810 (strands). **Open**: refusing an `add` of a second read of the same handle (`muq4oaof` 3) and enforcing "no second copy of a step" (`murwdp4f` C9) are not traced to a commit. | `run-muw60j7c-bb7c9a62.md` C-1, `run-muwao5n4-44977b2a.md` D2-1 |
| W16 | List reading, detection and extraction gaps. A shared row object made every read with rows refused `evidence_not_json` (a regression from F42). Atomic-CSS labels and hashed column names are unreadable. A column the first item lacks had no `at`. A detected column was required everywhere. "See all" was not offered. The last page's disabled Next meant no pagination. `paginate: true` read one page. A bound beside `paginate` was refused. A read never found was reported `failed`. Helper columns were stored. | list reading, extraction and detection | muq310ht, muq3uozx, muq4oaof, muq66ff9, muqiho7e, muqilf9s, murdouox, murwcaj0, mustvzvg, muwansvz, muwao5n4, mux6nxst (12) | `muqiho7e` $0.088 and `muqilf9s` $0.116 (every read refused). `muwansvz` $0.079. | **mostly fixed**. Core 6be39730 and ext 1f8c2e0a (evidence_not_json), ext 112b5334 (`at`), 6156e4f3, e898fde8, 30f65794 (See-all), e37cc473 (disabled Next), 2d6dc2e3 (R2-2), 9c0c97e6 (paginate true reads every page), 747668f0 (paging bound), e50d99c2 (D2-2), 41f96a49 (declared columns only). **Open**: D3-3 hashed detect labels (supervisor fix in flight). | `run-muqilf9s-c3211328.md` C1-C2, `run-muwansvz-a2b4a987.md` R2-1, `run-mux6nxst-c9bca37c.md` D3-3 |
| W17 | The re-author and repair ladder misbehave. A re-author could not rerun carried click or type steps (`target_not_a_handle`). Carried merges could never run. It was built twice on one brief. It was applied untested. It followed advice its own account contradicted. It could not conclude "nothing to change". A refutation was filed on the last innocent node, and the patch rung ran after the re-author. | judges and verification | muq66ff9, muqilf9s, muqiojz4, muqk713g, musp39u8, muw5zv4m, muw60j7c (7) | `musp39u8` $0.186 (113 calls). `muw5zv4m` re-author $0.0725. | **partly**. Core 844859ba, a48d28c8 (ladder skip), de1ec458 (do-only repair), d7cb90ca (carried steps run as saved), e8c89bbd (bounded re-author retries), ed35dfa1. **Open**: `muw5zv4m` 2 (the re-author has no honest "nothing to change" ending). | `run-musp39u8-9ac026ab.md` R3a-R6, `run-muw5zv4m-52d83027.md` 2 |
| W18 | Lab accounting and contract defects. Failed chat builds recorded $0. The re-author's calls went unrecorded (Lab counted 34 of 80). A killed run is invisible to the ledger. A phantom call published 49 for 48 sent. Core counted 73 calls in a chat build against 48 authorized. The Lab's $0.30 per-call cap passed Core's $0.25 settings bound, so playback was refused after a full build. A contract refusal was filed as `environment.missing`. `flowCreated` was false for a created Flow. Result checks were called "repair". | Lab, harness and infrastructure | muq0in9r, muq3ubys, muq3vuwx, muq4jztv, muq4oaof, muq66ff9, murwd8le, musp8nz1, musq0b1m, musr9pv3, mut8t1fk, mutacf69, mux6nxst (13) | `musq0b1m` $0.2127 (build paid, no playback). `mux6nxst`: a proposed, judged Flow was failed on the count. | **partly**. Core 553ff0ff (failed build spend reaches the ledger), 67b95113 (Flow cost bound, no $0.25 literal; checked in `api/handlers/llm-execution-settings.ts:35-39`), e8c89bbd (scoped Lab build calls), 5ef566ac (D3-1); ext 5fbe8b67 (count every call from the step log), ab4679f5, f668ceca, 30c0b76c. **Open**: a killed run's spend (`muq0in9r` 3; `spend.partial.json` proposal not traced to a commit). The `environment.missing` classification (`musq0b1m` R1) is not verified fixed. | `run-musq0b1m-0472cfa0.md` 1/R1, `run-mux6nxst-c9bca37c.md` D3-1, `run-muq0in9r-0793b448.md` 3 |
| W19 | Lab chat-creation setup. The driver typed into the previous conversation, so Core treated it as "improve", which it refused. The readiness poll waited on a session project id that never changed. A connection-state timeout hit before Send. The panel shows the previous run's thread at start. | Lab, harness and infrastructure | mut6b2re, mut7h5k2, mut7hh6c, mux6n7m4 (4) | $0.0002 | **partly**. ext f9afcb12 (isolated chat creation), 408ec3da (scoped mounted chat creation). **Open**: R2-U-10, an old thread at moment 1 (seen again in `mux6n7m4`, `mux6nxst`). | `run-mut7h5k2-26c8252d.md`, `run-mut6b2re-d0e475d1.md` |
| W20 | The provider was slow. Every decision timed out at 45 s, and a 5-token ping took 60 s. The chat read timed out (three 15 s tries) and fell back to words, so nothing was built. | Lab, harness and infrastructure | muq0in9r (lane B's concurrent run), muq2dlhq (2) | $0 | **partly**. Core 7a4e9c47 (a provider that stops answering ends the build within three requests and says so). A slow chat read still ends with no build. A fix for that was not traced to a commit. | `run-muq2dlhq-96bffb09.md`, `run-muq0in9r-0793b448.md` 2 |
| W21 | Read-after-act structure (lane D). The model never adds a read of the list after the confirms. Notes invited it to move the loop's listing instead. A rerun left a stale copy and renumbered the draft. An unrepeated twin act stayed beside the repeated one. | model guidance/prompt | murdouox, murwcaj0, murz83zy, musp474o, musr9pv3, mux6nxst (6) | `mux6nxst`: 19 decisions asking for it | **partly**. Core 7035c802 (read-before-act note), fae350dc, 51e3df3e (twin), 6a9da8ea (stable rerun numbers). **Open**: D3-2 (no path to a read after the act). | `run-mux6nxst-c9bca37c.md` D3-2 |
| W22 | Runtime status and replay costs. A run whose four facts held ended `failed` after a recovered busy press. Optional steps were retried 3 times. `remembered` steps wait 5-7 s each. Tabs pile up across tests. | page state, routing and navigation | muq66ff9, mut4fvkm, musp8nz1, musq0b1m, murwd8le (5) | about 72 s per run (`muq66ff9`). 13-17 s per test (`musp8nz1`, `musq0b1m`). | **partly**. Core 71cb8bfb (absent optional skipped), 42434f42 (healed recovery causes ignored); ext f4d7a876 (tab cleanup and remembered waits). **Open**: `mut4fvkm` C6. The cause of the terminal status was not established ("NO EVIDENCE terminal trace"). | `run-mut4fvkm-e2fc03e6.md` C5-C7 |
| W23 | Agent process. The supervisor killed every live Lab run with a command-line pattern to stop one. The supervisor stopped a run mid-playback. Lanes launched in DeepSeek's peak window. Fixes sat uncommitted in lane trees, so runs started on sources that lacked other lanes' fixes (resume-ab/cd: dirty inventories of 69-77 files per tree on 2026-10-03). | agent process | muq0in9r, muq70foz, muwaq9w3, muwao5n4 (4 runs, plus the integration lag across lanes) | `muq70foz` $0.3232 with no record. Peak runs: about 2x price. | **open** (operational). Memory rules exist (off-peak, sync before testing). The pid-based stop command proposed in `muq0in9r` 1 was not traced to a commit. | `run-muq0in9r-0793b448.md` 1, `resume-ab.md` "Latest endings" |
| W24 | The person is not told the build's lasting acts, and the ending overstates: "6 of the 6 things you asked have a step", "ran from its start", "Couldn't fix your Flow" on a first build, dollar bookkeeping as the ending, a judge's sentence cut at "(e.g.". | extension UI | muq3ubys, muq3uozx, muq5vb5w, muq6mlom, murdouox, murwcaj0, murwdp4f, murz83zy, murzln6g, musp474o, musr9pv3, mustvzvg, muwansvz, mux74k5q, muw60unq (15) | n/a | **partly**. Core 51ec2f12, 5ba54a0a ('worked' only for shown steps), 8622f65d, 98324a2c, 4b9bb9f5, 7d2fc09d (honest endings), f0fe78f4 (R2-U-3); ext 59af7675 (no "Couldn't fix" during a build). **Open**: R2-U-2 (budget ending's dollar bookkeeping; brief t279), and "6 of the 6" still overstated in `mux74k5q`. | `run-mux74k5q-1c3c2127.md` UI review, `live-C-r2-ui-review.md` |
| W25 | Internal words in the chat: raw handles ("t33", "(t958)"), node ids, "act a3", "extraction.4", "extract_list", "Step 8", `endView`, `pageLimit`. Model summaries are shown as fact. | extension UI | muq3uozx, muq3vuwx, muq4jztv, muqiojz4, muqk713g, murwdp4f, murzln6g, musp39u8, musp4h2f, mustvzvg, muw6144a, muwansvz, muw60unq (13) | n/a | **partly**. Core 532b541c, 84117643, 7d2fc09d, 633e4591 (R2-U-4); ext a55d7076, f6cd7409. **Open**: per the round-3 debugs, no internal words in `mux6n7m4`. A cut quote ("...shipped f...") remains. | `run-mux6n7m4-8273e7a0.md` UI U4 |
| W26 | Cards and status mislead. "Done" on a refused read or an unpressed test step. "Didn't work: it wasn't on the page" for a refusal. Refused amendments shown as work. A header with no card. The completion check is labelled "Test run". "the page" names nothing. The stop message appears twice. The welcome screen shows mid-build. Join-paths cards. "Step 5 of 5" during the re-author. | extension UI | muq3ubys, muq3uozx, muq5v4zg, muq5vb5w, muq6lqnw, muq6mlom, muqbzqtu, muqiho7e, muqiojz4, muqj2bgb, muqk4u32, muqk713g, murdouox, murwcaj0, murwcmx2, murwdp4f, murzln6g, musp39u8, musp4h2f, mustvzvg, mux6nxst, mux74k5q (22) | n/a | **mostly fixed**. Core 51ec2f12 and ext 6e2e312f (no welcome flash, one stop message), 383d529a, f340623c, 6b5aaf1a, 98324a2c, 84117643, 633e4591; ext 25119130, 03b6885c, 2bac6b5a, ce1e8903, 59af7675, f6cd7409 (repeated refusals fold, seen working in `mux74k5q`). **Open**: U-R3-1 (test card title "name and..." cut); "The result didn't pass its check" heading a completion refusal (`mux74k5q`); U1 (per-row cards do not name the row). | `run-mux6nxst-c9bca37c.md` U-R3-1, `run-mux74k5q-1c3c2127.md` UI review |
| W27 | Overlay and composer. The overlay is absent at start or after a page load, flickers, collapses to a dot, or sits over the product image. The instruction stays in the composer while sending. The chat stops following the stream. A price is glued to its label. | extension UI | muq3vuwx, murdouox, murwdp4f, murzln6g, musp39u8, musp4h2f, mustvzvg, mux6n7m4, mux74k5q (9) | n/a | **partly**. ext 94428215, 02bc174a, d71735e5 (follow), 59af7675; Core 7d2fc09d. **Open**: R2-U-5 and R2-U-11. The overlay is still absent about 4.7 s after send in `mux6n7m4`. | `run-mux6n7m4-8273e7a0.md` U3 |

## Table 2: run register (68 runs plus one in flight)

Lane letters follow each debug. "Codex" marks a Codex-supervisor run on 2026-10-03/04 under t262. A cost is the debug's
stated total. When a debug gave only build or exploration cost, that figure is used and marked "~".

| Run | Date (debug) | Lane / task | Verdict | Cost | Main causes |
| --- | --- | --- | --- | --- | --- |
| muq0in9r | 10-01 | C earbuds | killed 23 s in | $0 | W23, W20, W18 |
| muq2dlhq | 10-01 | C earbuds | no build (chat read timed out) | $0 | W20 |
| muq310ht | 10-01 | C earbuds | failed, 0 rows | $0.2769 | W12, W16 |
| muq3ubys | 10-01 | B bigbox | failed | ~$0.227 | W1, W9, W12, W13, W26 |
| muq3uozx | 10-01 | D confirm | failed | $0.1513 | W1-W3, W6, W9, W11, W16, W24 |
| muq3vuwx | 10-01 | A crossborder | failed | $0.1322 | W12, W8, W18 |
| muq4jztv | 10-01 | A | failed ($0.25 ceiling) | $0.2290 | W12, W9, W11 |
| muq4oaof | 10-01 | C | failed | $0.1729 | W8, W10, W15, W3, W4, W18 |
| muq5v4zg | 10-01 | D | failed | not stated | W2, W8, W9, W15 |
| muq5vb5w | 10-01 | B | failed | $0.2259 | W12, W13, W1, W9 |
| muq66ff9 | 10-01 | C | failed | $0.3239 | W8, W10, W3, W4, W17, W18, W22 |
| muq6lqnw | 10-01 | A | failed at playback | $0.2077 | W1, W12, W10 |
| muq6mlom | 10-01 | B | failed | $0.2276 | W12, W1, W24, W26 |
| muq70foz | 10-01 | A | stopped by the supervisor | ~$0.3232 | W23, W12, W9, W1 |
| muqbzqtu | 10-01 | B | failed (ceiling) | $0.0772 | W12, W11, W13 |
| muqbzu32 | 10-01 | C | failed (ceiling) | $0.0738 | W11, W3, W8 |
| muqc07fh | 10-01 | A | failed (ceiling) | $0.0774 | W8, W12, W11 |
| muqclqt5 | 10-01 | B | failed (ceiling) | $0.0786 | W11, W15, W13, W1 |
| muqiho5c | 10-02 | A | failed (cart empty) | $0.0415 | W1, W5 |
| muqiho7e | 10-02 | C | failed | $0.0880 | W16, W9 |
| muqilf9s | 10-02 | D | failed | $0.1164 | W16, W15, W17, W6, W5, W11 |
| muqiojz4 | 10-02 | B | failed | $0.1336 | W1, W8, W4, W17, W6 |
| muqj2bgb | 10-02 | C | FluxIQ said pass; oracle failed (10/13) | $0.0484 | W3, W4 |
| muqk4u32 | 10-02 | A | failed | $0.0617 | W12, W14, W1, W4, W8, W15 |
| muqk713g | 10-02 | C | failed | ~$0.048 (creation only) | W3, W5, W4, W8, W17 |
| murdouox | 10-02 | D | failed | $0.0562 | W16, W10, W21, W3 |
| murwcaj0 | 10-03 | D | failed | $0.0892 | W21, W16, W6, W4, W3 |
| murwcmx2 | 10-02 | C | failed | $0.0975 | W5, W8, W3, W9, W26 |
| murwd8le | 10-02 | A | unverified, run succeeded | $0.0579 | W14, W6, W4, W5, W18, W22 |
| murwdp4f | 10-03 | B | failed | $0.0872 | W1, W14, W13, W6, W15, W27 |
| murz83zy | 10-03 | D | failed | $0.0877 | W2, W21, W5, W11 |
| murzln6g | 10-03 | B | failed | ~$0.086 | W11, W2, W14, W1, W7, W26 |
| musp39u8 | 10-05 | C | failed | $0.1859 | W4, W17, W10, W3 |
| musp474o | 10-05 | D | failed | $0.0495 | W7, W21, W3, W5 |
| musp4h2f | 10-05 | B | failed | $0.0920 | W6, W4, W5, W2, W1, W11, W13 |
| musp8nz1 | 10-05 | A flash | **pass** | $0.0242 | W14 (latent), W4, W18, W22 |
| musq0b1m | 10-05 | A pro | failed at playback ($0.25 bound) | $0.2127 | W18, W14, W1, W8 |
| musr9pv3 | 10-05 | D | failed (Lab call count) | $0.0870 | W2, W9, W21, W18 |
| mustvzvg | 10-05 | C | failed | $0.0536 | W16, W10, W2 |
| mustzxhi | 10-03 | B (Codex) | failed | $0.0497 | W2 |
| musuq910 | 10-03 | A (Codex) | failed | $0.0483 | W1, W7, W4 |
| mut4fvkm | 10-03 | A (Codex) | oracle held, status failed | $0.0403 | W22, W14 |
| mut58jbo | 10-03 | A (Codex) | failed | $0.0790 | W1, W2, W7 |
| mut5amuc | 10-03 | B (Codex) | failed | $0.0750 | W6, W7 |
| mut6b2re | 10-03 | A (Codex) | setup refusal | $0.0002 | W19 |
| mut6bevx | 10-03 | B (Codex) | failed | $0.0739 | W7, W2 |
| mut7h5k2 | 10-03 | A (Codex) | setup timeout | $0 | W19 |
| mut7hh6c | 10-03 | B (Codex) | setup timeout | $0 | W19 |
| mut8rxuc | 10-03 | A (Codex) | failed | $0.0581 | W1, W10, W2 |
| mut8t1fk | 10-03 | B (Codex) | failed (budget) | $0.0927 | W2, W10, W18 |
| mutac2q6 | 10-03 | B (Codex) | failed | $0.0760 | W18, W2, W4 |
| mutacf69 | 10-03 | A (Codex) | failed | $0.0920 | W1, W8, W18 |
| mutcb2ic | 10-03 | A (Codex) | failed | $0.0502 | W1, W7, W2 |
| mutcbgbx | 10-03 | B (Codex) | failed | $0.0672 | W2, W13, W11 |
| mutepu6b | 10-03 | A (Codex) | **pass** | $0.0566 | none. Passed with the origin choice missing (W1); the A round-1 debug calls it luck in ordering. |
| muteqswo | 10-03 | B (Codex) | failed | $0.0602 | W1, W2, W7 |
| muw5zv4m | 10-05 | B round 1 | playback right; refuted by the post-run check | $0.1187 | W4, W17 |
| muw60j7c | 10-05 | C round 1 | failed (30 rows) | $0.0814 | W15, W3, W4, W17 |
| muw60unq | 10-05 | A round 1 | failed | $0.0453 | W1, W7 |
| muw6144a | 10-05 | D round 1 | failed | $0.0537 | W4, W3 |
| muwansvz | 10-05 | C round 2 | failed (ceiling) | $0.0791 | W16, W8, W11 |
| muwao5n4 | 10-05 | D round 2 | failed (budget, peak) | $0.0865 | W15, W16, W11, W23 |
| muwaobm2 | 10-06 | A round 2 | failed (looped to ceiling) | $0.0838 | W9, W10 |
| muwaq9w3 | 10-05 | B round 2 | failed (ceiling, peak) | $0.0838 | W14, W11, W2, W23 |
| mux6nxst | 10-06 | D round 3 | failed (Lab call count); Core proposed a Flow | $0.0601 | W18, W21, W16, W3, W5 |
| mux6n7m4 | 10-06 (t262 tree) | A round 3 | **pass** (replay passed) | $0.0405 | W14 latent F1, W19, W27 |
| mux6pndp | 10-06 (t262 tree) | B round 3 | failed (48 calls) | $0.0767 | W1, W7, W13, W11, W2 |
| mux74k5q | 10-06 (t262 tree) | A round 3, second pass | failed (48 calls) | $0.0710 | W1, W7, W9, W10, W14, W24 |
| mux6naez | 10-06 (t274 tree) | C round 3 | in flight when read | n/a | none yet |

## Fixed and not fixed, in one view

- **Fixed in the window, with no recurrence seen afterwards:**
  - W6 (lasting acts done twice or on the wrong person);
  - the `evidence_not_json` regression (W16);
  - most of the page-view and press evidence gaps (W12);
  - most of the judge-evidence gaps (W4);
  - the rerun page and put-back fixes (W8);
  - the $0.25 settings bound (W18, 67b95113);
  - the phantom call (5ef566ac);
  - the opener pulling in reads (5e368d1d);
  - the origin choice (32b4e37c);
  - the refused-amendment-with-rerun loop (68c4c9a7, seen fixed in `mux6n7m4`).
- **Still open as of the newest debugs (2026-10-06 round 3):**
  - W1, the act judge (`standing.ts`; fix uncommitted in t262);
  - `mux74k5q` C1a (settings rewrite), C2 (a check taking a new node) and C3 (the guard counting a check);
  - W7, R2-C8 (a navigation claiming a lasting act is only verified);
  - W21/W2, D3-2 (no way to a read after the act);
  - W5, D3-5 (a lone unconfirmed yes);
  - W16, D3-3 (hashed labels) and W3, D3-4 (node definitions; t280), both in flight;
  - W14, F1 (the toggle plus the title-named swatch resolver);
  - W13, fulfilment ("for pickup") not parsed;
  - W11, cache collapses from mid-prompt insertions;
  - W24, R2-U-2 (budget ending; t279);
  - the UI items listed in W26-W27.

## Commands run and observed results

- `git log --since=2026-10-01 --until=2026-10-06T23:59 --diff-filter=A --name-only --format= --
  docs/working/language-driven-flow-loop-plan/debugs` listed 65 files. Every file from the first `muq0in9r` debug to
  the last `mux6nxst` debug was listed.
- For each file, `git log --diff-filter=A --format=%ad --date=short` gave the add dates in Table 2 (2026-10-01 to
  2026-10-06).
- A listing of `fxwork/t262/.../debugs` and `fxwork/t274/.../debugs` against dev's folder found 4 files missing from
  dev: t262 `mux6n7m4`, `mux6pndp` and `mux74k5q`, and t274 `mux6naez`. I did not read t275 or t279: the brief names
  t262 and t274, and lane D round 3 (`mux6nxst`) is already on dev.
- I extracted the header and cause sections of every debug to a scratch file of about 300 KB and read all of it. For
  debugs whose causes sit under other headings (`muqiho7e`, `muqj2bgb`, `mustzxhi`, `mut4fvkm`, `mutepu6b`,
  `muw60unq` and the 4 lane-tree files) I read those sections with `sed`.
- `git log dev --since=2026-09-30 --no-merges` gave 271 Core commits and 175 commits in this repository outside
  `docs/`. I matched causes to commits by subject. I spot-checked these by file history:
  - `standing.ts`: last commit 98324a2c on 2026-10-03, so the round-3 fix is not on dev;
  - `verify-only.ts:35` still says "R2-C8, open";
  - `instruction-choices.ts` has no pickup or fulfilment form;
  - `llm-execution-settings.ts:35-39` bounds by `AUTOMATION_STUDIO_LLM_RUN_COST_CEILING_MAX_USD` (67b95113);
  - `rerun-input.ts`: last commit 68c4c9a7 on 2026-10-06;
  - `agreement.ts`: no commit after d7cb90ca.
- A grep for `$0.` in each debug's header gave the per-run costs.

## Not verified

- I did not test any fix. "Fixed" means a commit's subject names the cause, sometimes confirmed by a later debug that
  saw it working.
- Run counts come from each debug's cause table and its carried-cause rechecks. A debug that met a cause without
  listing it is not counted, so counts are lower bounds. The UI rows (W24-W27) are approximate.
- Dollar totals are the debugs' own figures. Some are build-only or exploration-only (marked "~": `muq3ubys`,
  `muq70foz`, `muqk713g`, `murzln6g`). `muq5v4zg` states no total. The $6.41 sum adds Table 2's figures with an
  `awk` sum over the table, not a ledger read; the week-review-numbers report owns the ledger figures.
- Whether these uncommitted lane-tree fixes have landed since the debugs were written: the t262 `standing.ts` act
  judge and the t275 D3-1 fix, which is on dev as 5ef566ac.
- I did not read lane-tree lane reports that are not on dev (for example t262's round-3 `live-a.md` and `live-b.md`).
  Only dev's copies were read.
- Codex reports other than resume-ab and resume-cd were read only by run id, to map them to debugs, not in full.

## Open questions or contradictions found

- `mutepu6b` is recorded as a Lab pass. The later lane A round-1 debug (`muw60unq`) says that pass had the same
  missing origin choice and "passed by the model's luck in ordering, not by design". Treat it as a weak pass.
- `mux6n7m4` (round 3) passed, but its own debug shows the pass depends on two defects cancelling out (F1). A Flow
  needing a non-default swatch would fail playback.
- `muqj2bgb` was reported passed by FluxIQ and failed by the oracle. `muw5zv4m` and `mut4fvkm` had correct final
  states and failed verdicts. Of the 68 runs, 3 FluxIQ verdicts disagree with the oracle. Only `muqj2bgb` was a false
  pass.
- The `muq0in9r` debug records the supervisor killing other lanes' runs with a command-line pattern. No stop-by-pid
  command was found in `git log`.
- The `mux6nxst` debug says the build "succeeded" inside Core while the Lab failed it on the call count. After
  5ef566ac, that run would have reached playback with a Flow that still lacked the read after the confirms (D3-2). A
  Lab pass of this lane would therefore still need D3-2.
