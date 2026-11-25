# Data-First Simplification Plan

Status: Active
Status detail: The paid round of 11-24 was halted at $0.80 on a shared look-loop defect; t1008, t1010, t1011 and t1012 fix it and are merged (Core 0.54.7). t1013 (paging per list) and t1014 (rounds keep memory) are in flight; then one watched bigbox run before the rest.
Created: 2026-11-20
Last updated: 2026-11-24
Owner: Senior supervisor agent
Scope: What changes after the 2026-11-19/20 live campaign: extraction keeps every column, one simple data layer dedupes and cleans from that upstream data, the model collects broadly, the framework does the heavy lifting, one model per task, replays that keep their repairs, a cheaper judge, and no paid run before a provider-free proof.
Paired document: ../!FluxIQ/docs/working/data-first-simplification-plan.md
Related: [usable-client-plan.md](./usable-client-plan.md) (the campaign ledger, 2026-11-20 entries), [framework-heavy-lifting-plan.md](./framework-heavy-lifting-plan.md) (W7: typed fields, marks, row identity), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [answer-first-plan.md](./answer-first-plan.md); campaign results `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md`

## Current State

**Week focus (user, 2026-11-23):** "for now we'll only focus this week on getting the core product 100% working". Hosted and cloud work stays paused until this plan's proofs and paid round show the core product working. That includes the web remote viewer the user asked for the same day, recorded as unit HC-V in [hosted-platform-launch-plan.md](./hosted-platform-launch-plan.md).

**Memory is not a reason to wait (user, 2026-11-23):** "dont worry about mem, we have pagefile". Lanes, builds and visible browser runs are dispatched without waiting for free physical memory; the heavy gate queues heavy steps (AGENTS.md).

**State at 2026-11-24 (Claude Code lead; detail per unit in the Work Ledger and "Integration History" below):**
- **Integrated and pushed in both repositories** (fluxiq 0.54.18, contracts 0.23.2; merge commits in the Work Ledger):
  - P0: t976, t979, t981.
  - P1 t982 retained extraction; P4 t983 fixed model; P2+P6 t984/t987 data stage and smaller judge; P3 t989 collection guidance; P5 t985 (F24).
  - S1/S2/S6 t986 offline proof, scoreboard and preflights.
  - t990: recorded-read oracle acceptance (hubs 10/10, earbuds 13/13 processing, job board 7/7 ×3, Netherlands 32/32, 0 calls); photo-social is a recording gap.
  - t991, t992 and t994: every failure of the first 11-23 sweep. t994 also fixed F23 and the read's own process under a declaration.
  - t993 and t998: a captured-but-absent cell is "not shown" (feed and store, migration 0041).
  - t996: the preflight meets the four sites' own person checks.
  - t997 and t999: stored labels hold no page values; binding reads `_`/`-` as word separators.
  - t1000: `ask_person` is a last resort again; a looping judge is caught.
  - t1005: package checks and tests build the workspace dists they import, so `pnpm check` passes in a fresh tree.
  - **From the halted paid round:**
    - t1008: no count ends an answer-first round. A run of looks is a loop finding the model decides; a change_approach on looks is held to its kind; the prompt no longer says to prefer observing over acting, and says how to press.
    - t1011: a judged no on `finish_with_best` shows its defects and keeps the repeat refused.
    - t1012: Core's built-in Anthropic default is Haiku.
    - t1010: every Lab run has a run watcher (`scripts/lab/run-watch/`) that alerts on repeating or no progress, and the Lab's default live model is Haiku.
    - t1013: paging is settled per list from each Next page's `listMove`; a Next page whose list is absent is refused as `list_not_on_page`.
    - t1014: a later round, and a carried-on attempt's first round, is shown every call the earlier rounds made and what each found (`answer-first/earlier-rounds/`), so a round end never empties the window. The last count endings on the answer-first path (a run of refusals for one reason, a completion refused again, unreadable replies) are loop findings the model decides.
    - t1018: a carried earlier round holds no denied key (t1014 had kept them as `[withheld]`, so every fresh round after a Flow replay was refused unsent).
    - t1019: the run watcher reads page resets from where the page is, and alerts `rounds_without_decision`.
    - t1017: Lab runs sharing one Core hold a shared reader lease, so lanes on one Core run at once.
    - t1016: task memory tolerates only a store that could not be read or written (typed at the store boundary), in model resolution and at the attempt's opening; any other error stops the task.
- **Second full sweep of 11-23** (before t1000): every test passed (Core about 30,000, downstream about 11,700); only `pnpm check` failed in a fresh tree, fixed by t1005.
- **Paid round of 2026-11-24: halted at $0.80 of $50.** Five launches; no task finished attempt 1.
  - Bigbox looked for about 170 steps without pressing. Cause, from its steps:
    - the 8-look guard ended each round and the next round's evidence window was empty;
    - the prompt discouraged acting;
    - a consent modal covered the store button.
  - Bikes acted but its `finish_with_best` was refused and it went back to paging checks.
  - Lens hood was killed early; apprentices and Halvard had not started.
  - The user then set four rules, now in AGENTS.md:
    - every Lab run is overseen and stopped early only when really needed;
    - every Lab run has the watcher;
    - no arbitrary limit ends or resets a run;
    - fix an obvious shared problem before running more.
  - Report: `reports/paid-round-1124.md` with its brief, and the five run debugs in `../language-driven-flow-loop-plan/debugs/` (run-mwufisf0, -mwug2xjw, -mwug3pjo, -mwug6pz3, -mwugbs39).
- **Bigbox relaunch of 11-24 (run-mwus396e, lane t1015): stopped at $0.12.** The model acted (6 landed acts, a draft with search, list read and paging, its Flow run three times), then every fresh round's first request was refused inside Core, unsent, because t1014's carried rounds kept denied keys; fixed by t1018 and proven offline on the recording. Debug: `../language-driven-flow-loop-plan/debugs/run-mwus396e-5447c6f6.md`.
- **Second bigbox relaunch (run-mwuuo3zk, lane t1015, on t1014-t1019): stopped by the lead at step 309, $1.83.**
  - What worked: no refused rounds, 17 landed acts, the store set, the Pickup filter applied.
  - The model circled: 40 decisions without an act, 8 identical detections, 11 loop steers without effect.
  - The cause (t1020, correcting the lead): the model read the wrong handle, a "cells" table of the cards' own links offered beside the card list, after its read of the list with the cells' keys was refused with bare codes. It never read the rating and pickup columns.
  - Debug: `../language-driven-flow-loop-plan/debugs/run-mwuuo3zk-75b482b3.md`. Round total about $2.75 of $50.
- **t1020 integrated:** a card list's own links are no longer a grid; a read naming another handle's keys is told which; every detection says how its handle is read and how it replaces the draft's read.
- **Third bigbox run (run-mwuxd2v9, on t1020): stopped by the lead at step 219, $2.23.**
  - Progress: 27 acts, the store set, and Loftwell 6-roll ($10.47, 4.8 stars, pickup) added; the dish soap kept.
  - Judged no 4 times. The pickup listing was "read as only 2 rows ... though the page listed 8", so cheaper candidates were never compared.
  - Every list read in the run, the draft's pickup-listing steps included, replayed as "kept 2 rows from 1 page" (handles `extraction.1`/`.4`, `.4` apparently the cart). One read ran on the home page.
  - The model kept saying it would re-read the listing, never navigated there, and loop handling steered 4 times without effect.
  - Evidence: `fxwork/recorded-evidence/t1015-bigbox/run-mwuxd2v9-33928ea3/`. Round total about $5.00 of $50.
- **Three runs, three defects in reads and pages: a structural fix, not another patch** (the recurring-failures rule).
- **Running:**
  - **t1022 integrated.** A detection aimed at a group's heading answers that group's records, never the run of groups (content script `record-group/`), proven in visible Chromium on bigbox: 8 cards where the run read 2. A saved read whose list does not stand on the page is refused `list_not_on_page`, naming where the list was made. Not covered: Flow playback after the build (the resolved request carries no binding location; a wire change). It found existing browser-spec failures on several realistic scenarios, owned next.
  - **t1023 integrated (0.54.16).** An act's option the page shows chosen by its typed state when the act lands counts as done. The domain reports standing choices on every press (`node-run/standing-choices/`), and Core credits them (`instructed-acts/standing-option.ts`). On the recording, `actsMissing` goes from `[a1.fulfilment]` to `[]`. Being built next: a Flow saved this way carries those options as a precondition checked at playback, so a site whose default differs never gets the act silently done the wrong way.
  - **t1024 integrated (0.54.13).** Every read has a declared place: [draft step, list key, page it ran on, moves of that list], or [step, batch key] for a saved Flow's batch. A replay at a place already held replaces that page, so three runs of a Flow on one page are one place; real paging stays separate pages. Rows are never compared.
  - **t1025 integrated (0.54.12).** All 22 unreadable replies of the three runs had one cause: the Anthropic adapter held each decision to the whole schema before Core's reader saw it. Now one decision reading is shared by the harness and the adapter (`runtime/llm/decision-reading/`). A decision is checked against the variant it names, and an unoffered tool goes to the loop's named refusals; withdrawn looks keep `core.loop_decision`. Of the 22 replies, 7 now read, 12 are refused by name, and 3 stay unreadable. Open: withdrawing and restoring looks changes the schema at the head of the request, which misses the prompt cache (one step paid 93k uncached and 77k cache-write tokens).
  - The full sweep of 11-24 (t1021, at Down 6acba56f8-era dev / Core e3498f9f3; report `reports/t1021-sweep-1124.md`) is done. Core check, downstream check and downstream build passed; 3 tests failed. Being fixed forward:
    - **t1026 integrated (0.54.14):** both Core failures were tests made stale by t1012's intended Haiku default; the panel tests also reloaded the whole llm module graph to re-read one setting (2.8-4.7 s, 15 s timeouts under load), and now inject it (375-558 ms).
    - **t1027/t1028 integrated (0.54.15):** the durable-reconcile failure was a Core race, not a regression. The answer timer kept running after a required command's answer was accepted and, on a busy machine, revoked the proof as "Outcome uncertain" though the browser had answered. It is now cancelled on acceptance (`client-gateway/service/command-ledger/dispatch.ts`). No press is sent twice, and an answer that never came still ends unknown. `main` is promoted after a clean full sweep.
- **Next:** relaunch the one watched bigbox run on lane t1015 synced to dev, after t1022 is merged and proven offline. Only if it reaches its result do the other nine tasks follow, on four lanes sharing one Core, within the remaining ~$45.
- **Fourth bigbox run (run-mwv5m906, on fluxiq 0.54.16): stopped by the lead at step 142, $0.20, with 0 unreadable replies.** It set the store, found the cheapest qualifying item (Softerra 6 Double Rolls, $9.47), added it, kept the dish soap and answered the table. Two judges said yes (0.8, no defects), but each completion was `judged_unsure`: the Flow's result was the 14-row product listing (step 6), not the cart. The result line also said "paging after unplaced read 1 not yet checked" for a list that cannot page, and the model chased it for 24 decisions. t1032 is diagnosing. t1031 (merged) makes a model-sent Flow run explain its own start-page landing to the watcher. Round total about $5.20 of $50.
- **Open (t1020):** a rerun in attempt 2 onward that changes a read's handle, when the draft comes from a saved Flow, may resolve against the step's saved binding (`plan-resolution/extraction/slot.ts`); untested.
- **Open follow-ups, not blocking:**
  - narrow the P4 memory tolerance to store I/O errors;
  - a saved Flow carries its own data declaration;
  - the test leaking `chrome` before act-mark's watch test;
  - the start reading's retry on timeout;
  - the Lab's Core build lease should be a shared reader lease (lanes sharing a Core run one at a time);
  - promote `main` after a clean full sweep;
  - evidence lanes need is kept in `fxwork/recorded-evidence/`.

**User-approved rules (2026-11-20):**
- U1: no model ladder; a task keeps its starting model.
- U2: the data layer automatically dedupes and cleans using upstream data where possible, simply.
- U3: extraction keeps every column; output projection happens in processing.
- U4: collect broadly, then filter deterministically.
- U5: the framework does the heavy lifting.
- U6: the judge stays on that same model.
- U7: all L1-L9, S1-S10 and P0-P7 below are approved, including Haiku as automation default; finish the three interrupted fixes first.
- U8: paid round approved, **$50 absolute total ceiling**. Lead's conservative reading covers the round and reruns together. Only launch while billed total plus the task's $5 purse is at most $50; supervise every run and stop on a balance error. Required provider-free proofs and available Claude credit come first.

**Why this plan exists:** the recorded campaign counted 37 runs, 0 strict SUCCESS, 17 PARTIAL and 20 FAILURE, about $90. Strict SUCCESS means four correct attempts, three predecessor-Flow continuation proofs and zero model calls on attempts 2-4. The original campaign, causes and approved phased design follow; historical task diagnoses remain in the task reports and git history.

**Next:** finish the supervised paid round; merge t1005; diagnose each round failure from its recorded run before any rerun; then a full sweep and `main` promotion.

## Integration History

The 2026-11-22/23 integration detail, superseded by Current State, is in [archive/integration-history-2026-11-22-23.md](./data-first-simplification-plan/archive/integration-history-2026-11-22-23.md) (moved 2026-11-24).

## Evidence

From the campaign's 28 findings (F0-F27 in the results file) and its results table:

| Theme | Findings | What goes wrong |
| --- | --- | --- |
| Getting the data out of the page | F3, F9, F17, F27; result processing below | The read keeps only the asked columns. The evidence a condition needs ("Easily apply", promoted, the ad marker, the post date) is gone, so nothing can filter on it and the judge flips. Summary panels, iframes and opened-post details do not come out as rows. |
| Saving and replaying the Flow | F4, F5, F12, F18, F23, F24, F26 | The saved Flow is not what ran (a stray Next after the loop). A saved target is gone next time. Repairs are refused at save, so every attempt repairs and pays again. A replay that worked is judged anyway. |
| The judge | F10, F11, F14, F22, F25 | Huge trails of page captures. Sonnet and Opus judges at $0.20-$1.01 each. Malformed JSON-in-a-string replies. |
| Agent loop and chat plumbing | F6, F8, F13, F15, F19, F20, F21 | Mostly fixed overnight. F8 and F11 came from the ladder, F19 from turning thinking off. |
| The Lab itself | F0, F1, F2, F7, F16 | Setup and harness defects, plus a web build that crashes under concurrent load. |

**Result processing (t970), 23 runs after it landed.** 9 runs called it, 43 calls in all. It helped in 2: apprentices and bikes within Alex's price, one filter each.
- In the rest it became trial and error: 15 calls in one run that switched between keeping 3 and 7 of the same rows, and 11 calls in another that kept 2 of 77.
- 6 calls were refused because the column they needed was never kept.
- One dedupe on the wrong key left every job in twice.
- It was never called on the earbuds rerun, which answered 42 unfiltered rows.

Details are in `usable-client-plan.md`, ledger entry "How the campaign used result processing".

## The Design

**Stored-row interface frozen by lead, 2026-11-22 (P1/P2):** reuse existing JsonObject rows and RecordSchema/RecordBatch. Add optional RecordField `semanticType` (text, number, currency, count, date, datetime, url, id, flag) and `mark` (badge, flag, state); `valueType` remains the actual JSON type, and `primaryKey` holds validated identity field ids. Preserve original display values; derive typed comparisons with existing shared pure parsers, anchored to the run reference time for relative dates. W7's parsed column sample is not per-row truth. Retain metadata in live/saved extraction bindings, live-read schema and replay batches. Keep all safe discovered fields, with requested columns solely in process.columns; explicit exclusions remain authoritative. Schema overflow must be explicit, never silently sliced. Implementation is pending in t982; P2 may build against this contract once its schema change lands.

1. **Extraction keeps everything it reads (U3).** A read keeps every field it found on each item, not only the columns the answer asks for. The asked columns are a view over the stored rows, not a filter at read time. Storage is the fields' values, never raw page captures.
2. **The model collects broadly (U4).** The build's guidance tells the model to read the items and fields the task may need: more pages, nearby items, every column the page offers. It also says the data layer removes bad and repeated rows afterwards, so over-collecting is fine and under-collecting is not. The words stay generic: they never mirror a realistic scenario's site, task or answer (AGENTS.md, "Model guidance never teaches to the test").
3. **One plain data stage (U2).** It runs after every attempt and replay, without the model asking:
   - remove duplicates (L2);
   - apply the task's conditions to the stored fields (L3);
   - order the rows;
   - shape the asked table.

   It is deterministic, so a replay that read the same rows gets the same answer with zero calls. It records what it removed and why, which the judge sees (2026-11-19 rule). The model is asked only for what the data cannot answer.
4. **The framework does the heavy lifting (U5).** It does whatever can be computed exactly:
   - removing duplicates;
   - page marks (ad, sponsored, promoted);
   - parsed dates, prices and counts;
   - paging;
   - ordering;
   - table shape;
   - row identity;
   - re-finding a target by identity.

   Much of this is already designed in `framework-heavy-lifting-plan.md` W7 (CC1 typed fields, CC2 marks, CC3 row identity). Whether W7 was built has not been checked.
5. **One model per task (U1).** Build, repairs, later attempts and judge stay on the starting model, Haiku (U6, U7). Remove `escalate_model` from the loop decision, and stop offering `ask_person` only once "the ladder has climbed".

## Lead's Suggestions

These are the lead's, from the campaign evidence, approved by the user on 2026-11-20 ("yes for everything").

- **L1. Rows keep their marks, identity and typed values.** A badge or flag on an item is a field: "Sponsored", "Promoted", an ad link. So are the item's own link and the parsed form of each date, price and count. Then "leave out the ads" and "newest first" are lookups, not model work. This is W7's CC1-CC3.
- **L2. Duplicates are removed by row identity.** Identity is the item's own link, or the key columns re-find already uses. Tracking parameters are ignored. Duplicates are removed first, always, never by hand and never by a key the model guesses.
- **L3. Conditions are stated once and applied by the framework.** The task's conditions are turned into the data stage's filter once, from the instruction. The model sees the result and what each condition removed. If a condition needs a field no row has, the stage names the missing field, so the read gets fixed. The filter is never guessed again. This replaces the model iterating on `core.set_result_processing`.
- **L4. Reads that are not lists.**
  - A label/value panel (a checkout summary) becomes one row whose columns are its labels (F27).
  - A frame on the page is read like the page.
  - Details that show only on an opened item are read by the Flow's loop over items, and stored with the item's identity.
- **L5. Replays keep their repairs.**
  - A repair that worked is saved into the Flow. F26: refuse a breaking edit where it is made (t981's design). F23: find out why repairs never reached the saved step.
  - Stray steps after a loop are not saved (F4).
  - A replay whose steps succeeded, automatic retries included, and whose result held stands without a judge. This must stay within the "one judged whole run as it finally stands" rule (F24, which needs its diagnosis).
  - A replay resumes after a person-only check is cleared (F18).
- **L6. A smaller judge.** The judge reads the stored rows, what the data stage removed and why, and a short trail, not page captures. It gets one readable reply format (F25). It is asked only where the rules require one.
- **L7. Spending discipline.**
  - No paid run until a fix passes, without a provider, on the recorded run of the task that failed (the 2026-11-03 simulation rule).
  - Stop paying for a task once the same failure recurs, and fix it provider-free first.
  - Report each run's cost as it happens.
- **L8. The machine's memory gate.** `fxwork/.heavy-slots/heavy-slot.mjs` admits a heavy step whenever 2.5 GB are free at that moment. It should admit by the step's own need and the system's commit headroom: the web build crashed three times beside another heavy job (F1). OneDrive's sync service leaked to 24.8 GB on 11-17 and 11-20. Our repositories are outside its folders, so the cause is OneDrive itself. When it leaks, agents kill it fully, without asking and without restarting it (user, 2026-11-20: "regarding onedrive, next time just fully kill it").
- **L9. Settle the work left in flight.** For each of t976, t979 and t981, the user decides whether to finish it or set it aside. t979's judge climb (`judgeRungsUp`) comes out under U1 either way.

## Phases

Each phase is proven without a provider before the next. The acceptance for P1-P3 is the campaign's own recorded reads: earbuds, free-shipping hubs, Netherlands data engineers, remote jobs and photo-social. Run with the same inputs and zero model calls, the stored rows must give the oracle's exact table.

- **P0. Finish the three fixes in flight** (U7): t981, t979 without its climb, and t976. Merge each as it passes.
- **P1. Extraction keeps every column, mark, identity and typed value (U3, L1).** First find exactly where a read drops undeclared columns (F3 says Core notes it). Then check W7's state, and build what is missing. Domain and extension: the read. Core: the stored rows.
- **P2. The data stage (U2, L2, L3).** Automatic removal of duplicates, conditions from the instruction applied to stored fields, order and shape, plus what was removed and why. Replace the model-iterated processing tool, or reduce it to stating the conditions once.
- **P3. Guidance to collect broadly (U4).** Generic words, checked against the "never teaches to the test" rule.
- **P4. Remove the ladder (U1).** Core's role routing (t962 `laddered`), the loop decision's `escalate_model` (t962, t969), the `ask_person` condition, and t979's climb.
- **P5. Replays keep their repairs (L5).** F26, then F23, F4, F18 and F24, each diagnosed first from its recorded run.
- **P6. A smaller judge (L6).**
- **P7. A small supervised live round**, approved up to $50 absolute max (U8). Only tasks whose fix passed provider-free, with each run's cost reported as it happens.

## Systemic Changes For The Week

These are the lead's, 2026-11-20. The user's bottom line: "we seriously NEED this to be working well by next week", so that the rest of the month goes to deploying and other fixes. Each item names the waste it removes.

- **S1. Prove every fix without paying.** Re-run a failed live run offline: its recorded pages, and its recorded model replies up to the first point the fix changes behaviour. That re-run is the fix's acceptance.
  - Waste removed: the campaign paid to learn whether each fix worked, rerunning photo-social 3 times ($11.82) and saturday-certificate twice ($10).
  - Builds on the trace and offline-trial work in `trace-offline-trials-plan.md` (paused 10-19; tier 1 offline trials exist, offline trials inside builds do not) and on the step logs, which already hold every provider request and reply.
  - This is the user's 2026-11-03 rule ("simulation ... with EXACTLY same inputs as real exploration calls recorded") made the standard path.
- **S2. One fixed scoreboard of ten tasks, easiest that nearly works first.** One task per site. The six that already got 4/4 right reach SUCCESS first: Mk II sellers, lens hood, apprentices, Halvard roles, towels, bikes within Alex's price. They need only the replay and judge fixes. The hard tasks follow.
  - Waste removed: hardest-first put most of the spend on runs that could not pass yet.
  - The scoreboard runs provider-free every day and shows each task's SUCCESS, calls and cost per attempt.
- **S3. The campaign's recorded runs become a regression gate.** A merge that touches the build, replay, data or judge re-runs the affected recorded runs offline (narrow, by import graph).
  - Three of the night's findings came from its own changes (F8 and F11 from the ladder, F19 from turning thinking off), and F26 may have come from t975.
  - Any change to prompts or model settings also gets a one-cent live smoke: the chat starting each site's task on the starting model. F19 would have shown on the first chat.
- **S4. Fewer, larger changes, merged in rounds.** Last night merged about 20 tasks one by one. Each merge moved `dev`, and the lanes waited to resync and rebuild. Merge twice a day, with the lanes rebuilt once per round. This reasserts the existing rule that live lanes merge in rounds.
- **S5. Cost visible as it happens, by stage.** Each attempt reports its decisions, repairs and judge calls in dollars as it runs, not only in interim reports. The campaign supervisor does not launch a task whose known blocker is still open.
- **S6. A provider-free preflight per site before any paid round:** pairing, the chat starting the task, a person check answered, a permission answered, one read. 10 campaign failures were plumbing, and 4 runs were lost to the Lab's own watchdog.
- **S7. One plan of record, with a current Current State.** This session spent its first hour rebuilding the state. `usable-client-plan.md`'s Current State dates from 11-18, and the real state sat in the ledger of a 540-line document; the index lists 22 Active documents. This document is the plan of record for the week. The lead rewrites its Current State at every milestone, and pauses the Active documents that are not this week's work.
- **S8. The machine** (L8): the heavy gate admits by need and commit headroom, OneDrive is killed when it leaks, and parallel agents stay within what two heavy slots can serve.
- **S9. The starting model is Haiku, for build and judge** (approved, U7). With no ladder, the starting model sets both cost and capability.
  - The campaign's runs that stayed on Haiku and got going cost $0.24-$0.76 each. Lens hood was right 4/4 for $0.58, on Haiku apart from one climb on its last attempt.
  - The lead recommends Haiku for build and judge, measured on the scoreboard.
- **S10. `main` catches up.** `main` has not moved since 11-11: 460 extension and 356 Core commits behind `dev`. Run a full sweep once the week's changes land, then promote.

## Next Session

Read Current State first; every unit it lists as integrated is done and verified, so do not reopen it. Check the heavy-slot holders and queue (`heavy-slot.mjs status`) before scheduling checks, and never disturb another lane's validation tree.

1. If t1000 is still running or unmerged: verify its report by rerunning its tests, then finish it in both repositories (downstream first, then Core with `--skip-checks`), merging Core dev first when the finish says it is behind.
2. Read sweep 2's report (`scratchpad/sweep2/` of the 11-23 session, or rerun it). Fix any failure forward on a task branch before paying.
3. The paid round: sync four lane trees to dev (both repositories), rebuild them, and dispatch one supervisor with the brief in "Paid round" above. Track spend against the $50 ceiling yourself, from the ledger.
4. After the round: diagnose each failure from its recorded run (S1), prove its fix offline, then rerun only what changed. Then a full sweep, and promote `main` by fast-forward (AGENTS.md).

Lead owns shared-state updates, exact observed acceptance, commits, pushes and paired integration.

## Work Ledger

### 2026-11-24 - t1032 integrated (fluxiq 0.54.18): no judge yes could stand since 11-22; the asked table is the result
- Changed:
  - Since t987 (11-22) the web judge projector marked every structure detection and Core's own calls as evidence gaps, and Core holds any yes unsure while gaps stand, so no yes could stand in a run that detected a list or set result processing. Core now never hands its own calls (`core.*` but the four that run host nodes, and its control-flow and timing nodes) to a host projector (`judge-evidence/core-call.ts`); the domain reads a detection as an observation.
  - A yes is refuted when the answer contract names the asked table and the yes says the rows are not it (`asked: false`) or the rows hold nothing for a named column (`cited-yes/records-yes.ts`). Words are matched by shared word because the contract reader misreads "with columns title only"; that reader is to be fixed, then tightened.
  - A held yes says why (`flow-less/held-yes.ts`). The result line says a pagerless list holds one page (`listPaging` on every detection) and names asked against held columns. Unsure feedback says how to make the asked table the result.
  - Merged on t1029: t1032's `project.ts` stands, which makes t1029's bookkeeping branch redundant; t1029's toggle fix in `action.ts` stays.
- Validation: the lead's run:
  - t1032 trees after merging dev: Core groups over `result`, `result-feed`, `completion`, `tests/endings` and `result-verification` gave `Test Files  293 passed (293)`, `Tests  2217 passed (2217)`; real-sql `Tests  99 passed (99)`; domain `judge-evidence`, `structure` and `web-sessions` gave `# pass 126 # fail 0`; checks exit 0; both audits passed.
  - After merging t1030: Core `Tests  2443 passed (2443)`, `Tests  188 passed (188)`; domain `# pass 705 # fail 0`; checks exit 0; audit passed.
  - The worker's new tests fail before the fix: 8 in Core, 4 in the domain with the recording's exact gap codes.
- Follow-up: fix the answer-contract column reader in `runtime/flow-authoring`; fake clocks for the deadline tests (`second-attempt-proof`, `later-attempt`).


### 2026-11-24 - t1030 integrated (fluxiq 0.54.17): a saved act checks its standing option at playback
- Changed:
  - Core: the draft step's `chosen` carries the option's place (`at`). `instructed-acts/chosen-precondition.ts` writes each credited option onto the act's node as `requiresChosen`, from the one shared assembly.
  - Domain: `actions/requires-chosen/`, gateway mapping, node definitions, failure code `web.precondition.option_not_chosen`, `standing-choices/at.ts`. Extension: `content/action-runtime/required-choices/` checks typed state before any verb.
  - Only the person's credited options become preconditions. On a site whose chooser leaves the DOM, a replay refuses until a step chooses the option, which is safe. The build-time choose step is a follow-up for the first site that needs it; bigbox's closed chooser stays readable in the shadow DOM.
  - New load-sensitive test: `later-attempt.test.ts` "a run's own deadline" (400 ms) failed once under load. Like t1032's `second-attempt-proof` deadline test, it needs a fake clock before the next sweep.
- Validation: the lead's run: Core groups over `instructed-acts`, `draft-statement` and `answer-first/flow-run` gave `Tests  448 passed (448)`, `Tests  99 passed (99)`. `test-content.mjs required-choices --headed`: "playback with Pickup chosen: succeeded", then "playback with Delivery chosen: failed web.precondition.option_not_chosen", `1 passed (3.0m)`. After merging dev: domain and extension checks exit 0, domain `actions client output-nodes runtime/failure llm-evidence/node-run` gave `# pass 1227 # fail 0`, audit passed.
- Follow-up: fake clocks for the two deadline tests.


### 2026-11-24 - t1029 integrated: two dated product defects behind the decline, and the browser specs
- Changed:
  - Domain `runtime/web-sessions/leased-web-session.ts`: cause A. Since 11-18 (Core t911), every build trial's first page read threw on a bound lease, as `executor.fault.unclassified`.
  - Domain `judge-evidence/{project,action}.ts`: cause B. Since 11-22 (t987), Core's waits, merges, loops and self-toggling presses were held as missing evidence, so such trials were always unsure.
  - Content harness timers: cause C, all 9 auction specs. Specs updated for t982 and t903: causes D and E.
  - Open: cause F, given to t1033. Kept-but-unasked columns make the reader press "See more" (`social-read-completion:90`).
  - `pinned-calls-job-board:79` times out in its own setup with three headed workers; it passes alone.
- Validation: the worker's run: 18 of 20 listed specs passed headed, the 2 being causes F and the setup timeout. The lead's run: `test-content.mjs part-run-job-board auction-marketplace-kestrel-auctions --headed` gave `12 passed (8.5m)`; domain `judge-evidence` and `web-sessions` gave `# pass 27 # fail 0`; domain and extension checks exit 0; audit passed.
- Follow-up: t1033 (cause F); the pinned-calls setup wait.


### 2026-11-24 - t1023 integrated (fluxiq 0.54.16): an act's preset option counts as done
- Changed:
  - Domain `node-run/standing-choices/` (new) records controls shown chosen by typed state (checked, selected, pressed, current, marked), never by words. Every press reports the options standing, wired through `tools.ts`, `run.ts`, `capture.ts`, `context.ts`, `outcome.ts` and `written-step.ts`.
  - Core: a draft step's `chosen`, `instructed-acts/standing-option.ts` (sizes, colours, versions, fulfilment and times, never quantities; a step named for the choice wins), and the statement readers moved to `runtime/llm/draft-statement/`.
  - Merging t1022 took `run.ts` to 805 lines. A worker split it by responsibility (`list-pages/answer-guard.ts`, `standing-choices/{found,stated}.ts`), and it is now at 800.
  - The lead accepted the scope beyond `runtime/llm/**` (the cause was in `flow-authoring`), and accepted that short control words are kept in Core's build-state store as shown addresses already are.
- Validation: the lead's run:
  - Core groups over `runtime/llm/tests`, `evidence-loop`, `draft-statement`, `flow-authoring/draft` and `instructed-acts`: `Test Files  106 passed (106)`, `Tests  1633 passed (1633)`; real-sql `Tests  2 passed (2)`. After merging Core dev: `Tests  363 passed (363)`, check exit 0.
  - Domain `runtime/llm-evidence`: `# pass 1767 # fail 0` after merging t1022. Domain check exit 0; both audits passed.
  - The worker's new test failed 3 of 8 before the fix.
- Follow-up: the playback precondition for a saved option (next lane).


### 2026-11-24 - t1028 integrated (fluxiq 0.54.15): an answered press is never revoked as uncertain
- Changed: Core `client-gateway/service/command-ledger/dispatch.ts` (`accept()` cancels the answer timer for required commands too), `tests/dispatch.test.ts` (the `timeout` case is gone from the revoke-proof test, with deterministic `startTimer` tests: an answer accepted during the deadline completes, an answer that never came ends unknown, and no press is repeated), and `docs/architecture/automation-studio/client-gateway.md` (the t329 paragraph). t1027, the diagnosis, changed no source. Its stall probe reproduced the sweep's failure at 2000 and 4000 ms, and its report is beside this one.
- Validation: the lead's run: `vitest-groups` over `client-gateway/service` and `command-run` gave parallel `Test Files  46 passed (46)`, `Tests  372 passed (372)`; real-sql `Tests  45 passed (45)`; check exit 0; audit passed. After merging Core dev, `command-ledger` gave `Tests  56 passed (56)`. The worker showed the old line with the new test failing (`expected 1 to be +0`), and the downstream stall probe now `"status":"succeeded"` with `asked 1`.
- Follow-up: none.


### 2026-11-24 - t1026 integrated (fluxiq 0.54.14): the sweep's Core failures
- Changed: Core `src/tests/{anthropic-session-panel,session-key-provider}.test.ts`, web `settings/tests/anthropic-settings.test.tsx`, `runtime/llm/flow-execution-limits/run-cost-ceiling.ts` and `runtime/llm/session-key-provider.ts`, which now take an `env`; the default is unchanged. The lead sent it back once: under load the panel tests timed out at 15000 ms, and the root cause was a whole-graph module reload.
- Validation: the lead's run: `vitest-groups` over the two test files and `flow-execution-limits` gave `Tests  27 passed (27)`; web `settings/tests` gave `Test Files  12 passed (12)`, `Tests  77 passed (77)`; check exit 0; audit passed. The worker ran 10 runs across two concurrent loops: 24/24 each, 375-558 ms.
- Follow-up: none.


### 2026-11-24 - t1022 integrated: shelf detection and the saved-read page guard
- Changed:
  - Extension `content/extraction/{infer-list.ts,record-group/}` and the e2e spec `e2e/content/tests/record-group/tests/bigbox-home-shelves.spec.ts`. Domain `plan-resolution/extraction/{list-family,list-stands}.ts`, `node-run/{run,replay}.ts`, `node-run/list-pages/`, `action-failure/read-list-elsewhere.ts`, `rejection-next/list-made-on.ts`.
  - The worker overturned the lead's hypothesis that reads ran on the wrong page. Detection answered a list of two shelves with numbered columns.
  - Existing failures, not caused by this change (they fail with it switched off), need an owner:
    - content-harness: everything-store-cart-names, company-definition-fields, item-conditions, social-read-completion, all 9 auction-marketplace tests, crossborder-spain-hubs, local-classifieds-bike-search x2, professional-network;
    - all 5 part-run tests, whose scripted trial stops at its first navigate (`executor.fault.unclassified`).
- Validation: the lead's run: domain `test-domain.mjs` over `node-run`, `plan-resolution/extraction`, `rejection-next` and `action-failure` gave `# pass 728 # fail 0`; extension `content/extraction` gave `# pass 559 # fail 0`; `test-content.mjs bigbox-home-shelves --headed` gave `1 passed (54.3s)`; domain and extension checks exit 0; audit passed.
- Follow-up: triage the existing browser-spec failures; guard Flow playback after the build.


### 2026-11-24 - t1024 integrated (fluxiq 0.54.13): a replayed read is the same place
- Changed:
  - Core `answer-first/result-feed/place-of.ts` (new), `result-feed/feed.ts`, `result/{place-order,types,page-set}.ts`.
  - The lead sent the first version back. It matched identical whole rows, which guesses identity from content, and a replay whose rows changed would still have counted as a new page. The second version also had a gap: the model's own Flow replays enter through `called`/`passed` with no list key. The place now includes the draft step.
- Validation: the lead's run: `vitest-groups --groups=parallel,real-sql` over `result`, `result-feed` and `tests/endings` gave parallel `Test Files  30 passed (30)`, `Tests  207 passed (207)`; real-sql `Test Files  20 passed (20)`, `Tests  95 passed (95)`; check exit 0; audit passed. After merging Core dev: `result` and `result-feed` gave `Tests  207 passed (207)` and `Tests  10 passed (10)`.
- Follow-up: none.


### 2026-11-24 - t1025 integrated (fluxiq 0.54.12): one decision reading for every provider
- Changed:
  - Core `runtime/llm/decision-reading/` (new), `anthropic/decision-check.ts` (new), `anthropic/task-answer.ts`, `harness/provider-result.ts`, `unknown-tool/refusal-of.ts`, `unusable-decision.ts`, `evidence-loop/decision-refusal.ts`, `decision-handlers/look-withdrawal.ts`, `models/providers/anthropic/reply/reading.ts`. The lead accepted the worker's edit of the reply reading: it is the adapter's parsing, and no other lane owns it.
  - Safety, as the lead reviewed it: every offered variant keeps every constraint, and an unoffered tool takes DeepSeek's long-standing path to the loop's named refusals. A node id given as `toolId` is read as `core.run_node` only when the input already names that node, never by declaring consequences for the model.
- Validation: the lead's run through the gate: `vitest-groups --groups=parallel,real-sql` over llm `anthropic`, `decision-reading`, `decision-handlers`, `evidence-loop`, `harness`, `unknown-tool`, `tests`, `deepseek` and `models/providers/anthropic` gave parallel `Test Files  168 passed (168)`, `Tests  1721 passed (1721)`; real-sql `Tests  2 passed (2)`; `pnpm --filter fluxiq check` exit 0; audit passed. The worker ran its new tests on the pre-fix files: 10 failed and 2 passed, the 2 being guards.
- Follow-up: the prompt-cache cost of look withdrawal (see Current State).

### 2026-11-24 - Second bigbox relaunch stopped circling; t1020 integrated
- Changed:
  - The lead stopped run-mwuuo3zk-75b482b3 at step 309: 40 decisions without an act, 8 identical detections, 11 loop steers without effect. $1.83 by the step index.
  - t1020 (worker-heavy) found the cause. The lead had read Core's `readRows` labels as split rows; the read's real rows held name, URL and price.
  - The content script offered the cards' own links as a "cells" grid (`grid-cells.ts`: one group with two side by side was enough; now at least half the holding groups must have two side by side).
  - A read naming the cells' keys on the list's handle was refused with bare codes. The refused names now ride in `instead`, and `next` says which handle a key belongs to (`rejection-next/unknown-column.ts`).
  - No detection said how its handle is read. `readNote` is in every packet, in generic words.
  - Core unchanged. The worker wrote the run's debug.
- Validation: lead, on the t1020 tree: domain `test-domain.mjs llm-evidence/tests/read-columns llm-evidence/structure llm-evidence/rejection-next llm-evidence/node-run` gave `# tests 697 # pass 697 # fail 0`; extension `test-extension.mjs content/extraction` gave `# tests 553 # pass 553 # fail 0`; domain and extension checks exit 0; audit passed. The worker showed that each fix's test fails without it (`not ok 2` with the `run.ts` line reverted; `not ok 3`, `not ok 5` with the old grid rule).
- Follow-up: relaunch bigbox on lane t1015 synced to dev; the held-Flow handle-change rerun stays open.

### 2026-11-24 - t1016 integrated (fluxiq 0.54.11): task memory tolerates only a store failure
- Changed:
  - Worker: `task-memory/store-io.ts` types a driver failure (a Node system code or a SQLite code, never message words) as `AutomationStudioAnswerFirstTaskMemoryStoreError` at the store boundary (`task-memory/store.ts`). `task-model/resolve.ts` tolerates only that error.
  - Lead: the attempt's opening (`attempt/opening.ts`, `keptOrNothing`) reads unscoped memory the same way. The brief had asked for it while leaving `attempt/` out of the worker's paths. `tests/later-attempt.test.ts` "a memory that fails" now fakes the typed store failure, since a plain `Error` is no longer taken for one.
- Validation: lead, through the gate: task-model, task-memory, `attempt` and answer-first `tests`: 50 of 51 files passed. The one failure was "a memory that fails", with `new Error("disk")` now rethrown; after the fix it is `Tests  24 passed (24)`. After merging Core dev: parallel `Test Files  5 passed (5)`, `Tests  34 passed (34)`; real-sql `Test Files  4 passed (4)`, `Tests  59 passed (59)`; `pnpm --filter fluxiq check` exit 0; audit passed.
- Follow-up: relaunch bigbox on lane t1015 synced to dev.

### 2026-11-24 - Bigbox relaunch stopped on refused fresh rounds; t1018, t1019 and t1017 integrated (fluxiq 0.54.10)
- Changed:
  - Lane t1015 ran bigbox once (run-mwus396e-5447c6f6, Haiku, watcher on). The model now acts, but after loop detection's last rung ended round 1 (step 89), every fresh round's first decision was refused inside Core (`flow_bootstrap.request_refused_evidence_denied_key`), five times, with no model call. The lead stopped it at $0.120981 settled (no call in flight). The evidence is in `fxwork/recorded-evidence/t1015-bigbox/`; the debug is committed.
  - t1018 (lead, Core): `earlier-rounds/carried-step.ts` drops every member under a denied key, key and all (the draft's `automationStudioLlmValueWithoutDeniedKeys`), before the trail screen, and says something was left out. The t1014 test that pinned `secretToken: "[withheld]"` now expects the key gone.
  - t1019 (worker): the watcher's `page_reset` reads the page's own location (a navigate in an opening call's `held` never runs). The five resets on run-mwus396e and six on run-mwufisf0 were all false. New `rounds_without_decision` pattern.
  - t1017 (worker-heavy): Core's build cache gained `acquireStepReadLock` (entry-then-recheck against the writer's lock-then-list; heartbeated; stale at 30 minutes; a waiting build blocks new readers). The Lab lease takes read holds, so lanes sharing one Core run concurrently.
  - Closed lanes t1001-t1004, t1006, t1007 and t1009 after their round files were committed; released lab slots 1-4.
  - Open: `attempt/opening.ts` still reads the attempt-row and act stores best effort with every error swallowed (`automationStudioAnswerFirstBestEffort`); those stores have no typed I/O error yet.
- Validation: lead runs through the gate:
  - t1018 offline proof on the recording (temporary test feeding all 42 recorded calls through `automationStudioResultTrailStepOfCall`): `{"steps":42,"oldStepsWithDeniedKey":3,"newEntryHasDeniedKey":false,"carriedCalls":42,"callsWithSomethingLeftOut":[20,24,27]}`.
  - t1018 tests over answer-first `earlier-rounds`, `tests/endings`, `attempt` and llm `harness`: parallel `Test Files  80 passed (80)`, `Tests  580 passed (580)`; real-sql `Test Files  28 passed (28)`, `Tests  131 passed (131)`; `pnpm --filter fluxiq check` exit 0; audit passed.
  - t1019: `# tests 18 # pass 18 # fail 0`; `lab watch --from-steps` on run-mwus396e gave `{"no_act_after_loop":1,"rounds_without_decision":2}` and no `page_reset`; audit passed.
  - t1017: Core `node --test "scripts/build-cache/tests/*.test.mjs"` gave `# tests 87 # pass 87 # fail 0`; downstream lease `# tests 9 # pass 9 # fail 0`; both audits passed.
- Follow-up: merge t1016; sync the shared Core and lane t1015; relaunch bigbox.

### 2026-11-24 - t1013 and t1014 integrated (fluxiq 0.54.9); the halted round's report and debugs committed
- Changed:
  - t1013 (paging per list, 0.54.8) merged earlier the same day (downstream b222b4ab2, Core 13818c3d4).
  - t1014 (worker-heavy, sent back once): a later round and a carried-on attempt's first round carry the earlier rounds' calls and findings (`answer-first/earlier-rounds/`, screened, at most a quarter of the input window, oldest summarised). A run of decisions refused for one reason (`core.refusal_run`), a completion refused again over the same draft (`core.completion_check`) and unreadable decider replies are loop findings on the ladder when the caller takes a loop signal. Loops with no signal keep the 2026-10-06 three-in-a-row rule.
  - The worker put the two count endings on the ladder as findings, not as `stalling()` at the count (which would still end the round at three). The lead accepts this.
  - The worker found that two endings tests passed only because a count-ended round reset the repeat guard; they were rewritten with the same expectations. Its point about an identical read refused after an unseen page change does not hold on the web domain: `stateDigests` digest the whole sanitized page (`domain/src/runtime/llm-evidence/state-digest/`), so a look that shows a change gives the next read a new page key. Only the fake test site's fixed state key showed it.
  - The paid round's brief, report and five run debugs were copied from lane trees t1001, t1004, t1006, t1007 and t1009, then those lanes were closed.
- Validation: lead, on the t1014 tree merged with Core dev 13818c3d4, through the gate: `vitest-groups --groups=parallel,real-sql` over answer-first `attempt`, `earlier-rounds`, `tests/endings`, `loop-signal`, `result-feed` and llm `decision-handlers`, `evidence-loop`, `repeat-guard` -> parallel `Test Files  117 passed (117)`, `Tests  912 passed (912)`; real-sql `Test Files  32 passed (32)`, `Tests  143 passed (143)`; `pnpm --filter fluxiq check` exit 0; `structure-audit: passed (571 warning(s), 903 baselined)`.
- Follow-up: one watched paid bigbox run.

### 2026-11-24 - Paid round halted at $0.80; the shared look-loop defect fixed (t1005, t1008, t1010-t1012)
- Changed:
  - The lead killed all four live runs on the user's order: "FIX THE FUCKING PROBLEM BEFORE WASTING MORE MONEY".
  - Merged t1005 (check build order), t1011 (judged no on finish_with_best, 0.54.5), t1012 (Haiku built-in default, 0.54.6), t1008 (no count ends a round; look runs are loop findings; prompt; 0.54.7) and t1010 (Lab run watcher and the Haiku Lab default).
  - Started t1013 (paging per list) and t1014 (rounds keep memory).
  - AGENTS.md gained the user's oversight, watcher, no-arbitrary-limit and fix-first rules.
  - A global lesson `fix-shared-problem-before-more-runs` was added (MeritPrompts c77cb1c).
- Validation: lead runs through the gate:
  - t1005, from fresh dists: `# tests 46 # pass 46 # fail 0`; checks 0 `error TS`.
  - t1011: parallel `Tests  2455 passed (2455)`, real-sql `Tests  94 passed (94)`; check 0; audit passed.
  - t1012: `Tests  434 passed (434)` plus 9; web `Tests  479 passed (479)`; check 0.
  - t1008, merged with t1011 and t1012: parallel `Test Files  435 passed (435)`, `Tests  4229 passed (4229)`; real-sql `Tests  499 passed (499)`; check 0; audit passed.
  - t1010: live-llm `# pass 54 # fail 0`; watcher `# pass 16 # fail 0`; Lab tests `# pass 237`; replay on run-mwufisf0 gave 15 alerts.
  - Core finishes: `Tests  70 passed (70)` each.
- Round spend: $0.7748 settled ($0.80 booked) by the supervisor's step-log tally.
- Follow-up: t1013, t1014, then one watched bigbox run.

### 2026-11-24 - t1000 integrated (fluxiq 0.54.4); sweep 2 clean of test failures; paid round started
- Changed:
  - t1000 finished in both repositories. The lead also aligned `refused-words.ts` (ask_person only once offered), `failure-control.md` and a stale ladder comment.
  - The shared Core was synced to 5dfde039c.
  - Paid lanes t1001-t1004 were created at af360c487.
  - The paid round supervisor was dispatched.
  - t1005 (check build order) was started; it merges after the round.
- Validation: lead runs through the gate on t1000:
  - parallel `Test Files  343 passed (343)`, `Tests  3011 passed (3011)`;
  - real-sql `Tests  107 passed (107)`;
  - fluxiq check 0 `error TS`; audit passed; Core finish `Tests  70 passed (70)`.
- Sweep 2 (worker, logs `scratchpad/sweep2/`): Core fluxiq parallel `Tests 20257 passed | 6 skipped` and real-sql `Tests 3241 passed | 1 skipped`; apps/web `4384 passed`; downstream every package `# fail 0`; builds exit 0. Down `pnpm check` exit 1 with 35 `error TS` (missing subpath declarations in a fresh tree).
- Follow-up: the round's per-task results; t1005 after the round.

### 2026-11-23 - t994 integrated (fluxiq 0.54.3); t1000 and the second sweep started
- Changed:
  - t994 finished in both repositories, after the lead committed its team's work (113 files), merged Core dev and kept 0.54.3 over dev's 0.54.2.
  - t1000 started with a brief.
  - Sweep worktrees `fxwork/sweep-20261123b` were created at current dev.
- Validation: lead runs through the gate on the merged t994 tree:
  - vitest-groups parallel `Test Files  61 passed (61)`, `Tests  774 passed (774)`;
  - real-sql `Test Files  76 passed (76)`, `Tests  515 passed (515)`;
  - web `Tests  36 passed (36)`;
  - fluxiq and web checks 0 `error TS`;
  - audit `passed (570 warning(s), 903 baselined)`;
  - finishes: Down audit passed; Core `Tests  70 passed (70)`.
- Follow-up: t1000; sweep 2; then the paid round.

### 2026-11-23 - t996 and t999 (contracts 0.23.2) integrated
- Changed:
  - t996 finished downstream, the preflight's site challenge. Its empty Core branch was abandoned with 0 unmerged.
  - t999 finished in both repositories. Its Core branch was merged with dev 143d80419 first, after a finish refused it as behind.
  - The lead added the downstream `stored-labels.ts` fold and its test on t999.
- Validation: lead runs through the gate:
  - t996: preflight `# tests 14 # pass 14 # fail 0`; runner check `0` `error TS`; audit passed; four `offline-preflight` runs each `{"protocolPassed":true,"siteChallenge":"passed","gaps":[]}`.
  - t999: contracts `Tests  335 passed (335)` (before and after the dev merge); contracts, fluxiq, domain and runner checks exit 0; domain `# tests 188 # pass 188 # fail 0`; read-oracle `# pass 8 # fail 0`; Core and Down audits passed; earbuds `"state": "ready"`, `matchedRecords` 11, `modelCalls` 0.
  - Finishes: Down audits passed; Core `Tests  70 passed (70)`.
- Follow-up: t994; then the paid round.

### 2026-11-23 - t998 (fluxiq 0.54.2) and t997 integrated; t999 started
- Changed:
  - t998 finished in both repositories: migration 0041 and the store's captured fields.
  - t997 finished downstream: stored labels without page values.
  - The shared Core was synced to 143d80419 when t997's finish refused on the lagging Core.
  - t999 was started and handed to the t997 worker. Its downstream tree got dev 1485a34c1.
  - Both t996 trees got dev.
- Validation: lead runs through the gate:
  - t998: vitest-groups parallel `Tests  102 passed (102)` and real-sql `Tests  54 passed (54)`; fluxiq check exit 0; audit passed; Core finish `Tests  70 passed (70)`.
  - t997: domain `# tests 442 # pass 442 # fail 0`; domain check exit 0; read-oracle `# pass 10 # fail 0`; audit `passed (259 warning(s), 551 baselined)`.
  - t997 earbuds proof (runterms): `"state": "ready"`, `kept` 11, `matchedRecords` 11, `expectedInCollected` 11, `modelCalls` 0. It exits 1 only because 2 of the 13 expected records are on pages the recording never read.
- Follow-up: t996 lead preflights; t999; t994; then the paid round.

### 2026-11-23 - t993 integrated (fluxiq 0.54.1); F23 diagnosed; t998 started
- Changed:
  - t993 finished in both repositories.
  - t995 finished downstream (test and report). Its empty Core branch was abandoned with 0 unmerged.
  - F23's fix was given to t994.
  - t998 started with a brief and handed to the t993 worker.
  - Evidence that later lanes need is preserved outside the repositories in `fxwork/recorded-evidence/{t993,t995}/`, because a finish removes the worktree's ignored `test-runs/`.
- Validation: lead runs through the gate:
  - t993: contracts `Tests  323 passed (323)`; feed and completion parallel `Tests  163 passed (163)`; service real-sql `Tests  5 passed (5)`; contracts and fluxiq checks exit 0; Core and Down audits passed; libraries exit 0; job-board proof `"passed": true`, `matchedRecords` 7, `modelCalls` 0.
  - t995: domain target-reacquire `# tests 68 # pass 68 # fail 0`; audit passed.
  - Finishes: Down audits passed; Core t993 contract gate `Tests  70 passed (70)`.
- Follow-up: t994 (including F23), t996, t997 and t998; then the paid round.

### 2026-11-23 - t991 and t992 integrated; t995-t997 started
- Changed: t991 (domain sweep failures, old-client definition admission, retained-extraction doc) and t992 (extension, test-runner, Core build list) finished into dev and were pushed. The shared Core was synced to 6318fac88. t995 F23, t996 person-check preflight and t997 schema labels were started with written briefs.
- Validation: lead runs through the gate:
  - t991: affected `# tests 65 # pass 65 # fail 0`; importers `# tests 200 # pass 200 # fail 0`; domain check exit 0; audit passed.
  - t992: scripts `# pass 12 # fail 0`; extension `# tests 101 # pass 101 # fail 0`; runner build exit 0; lab-attempt-command `# pass 6 # fail 0`; extension check exit 0; audit passed.
  - Finishes: both `"validation":{"passed":true}`.
- Follow-up: t993-t997 results; the paid round after all of them land.

### 2026-11-23 - t990 integrated as Core 0.54.0
- Changed: t990 finished in both repositories. The downstream branch carries the `lab recorded-read --task` oracle mode and two admission fixes. Core adds the re-export-only subpath `fluxiq/automation/answer-first-data`, plus the version. Both t993 trees were moved to the new dev for its proof step.
- Validation: lead runs through the gate:
  - `node scripts/lab/run-lab.mjs recorded-read crossborder-marketplace --task crossborder-marketplace-free-hubs-under-ten …` → `{"passed":true,"phase":"done","gap":null}`, `matchedRecords` 10, `modelCalls` 0;
  - the same for professional-network Netherlands (from44) → 32/32 and job-board remote (mwov5v61) → 7/7;
  - owners `# tests 64 # pass 64 # fail 0`;
  - Down audit `passed (258 warning(s), 551 baselined)` and Core audit `passed (569 warning(s), 903 baselined)`;
  - finishes: Down audit passed; Core `Tests 70 passed (70)`.
- Follow-up: earbuds' broad collection and photo-social are recording gaps for the paid round; t995 schema labels; t993 absent-cell semantics.

### 2026-11-23 - Full sweep results; t990 worker result; four fix lanes dispatched
- Changed: the shared Core `fxwork/!FluxIQ` was synced from cc1230032 to 2dba34613 via `pnpm task sync-core --allow-running` from the t353 sibling, moved to origin/dev. Tasks started: t991 sweep-fix-domain, t992 sweep-fix-extension-runner, t993 absent-cell-semantics (Core-paired) and t994 sweep-fix-core (Core-paired). Each has a written brief in its own tree.
- Validation: sweep step logs read by the lead from `scratchpad/sweep/`:
  - downstream check `# fail 1` (core-build.test.mjs:122);
  - domain `# pass 3150 # fail 14`;
  - extension 4 "not ok";
  - test-runner 1 "not ok";
  - Down build exit 0;
  - Core fluxiq `Tests  25 failed | 20207 passed` (parallel) and `Tests  292 failed | 2944 passed` (real-sql);
  - apps/web `Tests  2 failed | 4382 passed`.
- Worker claims, not yet lead-run: t990's four passes and photo-social's recording gap (report `reports/t990-recorded-oracle.md` in the t990 tree).
- Follow-up: lead verification of t990, then its finish; the four lanes' results; t995 after t991.

### 2026-11-23 - t986 integrated as Core 0.53.1; t990 and full sweep started
- Changed: t986 finished in both repositories (offline proof harness, trace-replay host-stream fixes, commandId hidden from the model, probe instruction). t990 started with `pnpm task start recorded-oracle-acceptance --worktree --core --skip-workspace-build`. Sweep worktrees `fxwork/sweep-20261123` were created at dev. A first attempt created them inside each repository through a relative `git -C` path; the lead removed them with `git worktree remove`, removed the empty folders and recreated them with absolute paths.
- Validation: lead runs through the gate on dev-synced t986: Core trace 15 files `Tests 68 passed (68)`; fluxiq:check `inputs changed` exit 0; Core audit exit 0; Core libraries exit 0; domain check exit 0; domain owners `# pass 645 # fail 0`; runner build and check exit 0; runner owners `# pass 206 # fail 0`; Down audit `passed (258 warning(s), 551 baselined)`. Finishes: Down audit passed; Core `Tests 70 passed (70)`.
- Follow-up: t990 results; sweep results, fixed forward; then the paid round's readiness.

### 2026-11-23 - P2+P6 integrated as Core 0.53.0; shared Core synced; t986 zero-call replay
- Changed: t984 (with t987 merged in) was finished in both repositories, and t987 was abandoned with 0 unmerged. Core was bumped to 0.53.0. The shared fxwork Core moved to cc1230032. t986 commits: Core 869523fdb and 92cd31a39 (session binding by event kind and stream), Down 9685157f6 (commandId hidden from the model) and a9e601d68 (probe instruction, visible sandbox).
- Validation: lead read the raw Vitest logs in `t984/!FluxIQ/node_modules/.cache/t984-combined/`. p2-compat 37 files 195/195; p2-combined 24/192; p6-authority 7/77; semantic 25/255; checkpoint 14/112; composition 20/196; requests 46/420. The type logs have 0 `error TS`. Domain judge-evidence `# pass 125 # fail 0`. Down audit `passed (258 warning(s), 551 baselined)`. `pnpm task finish t984` (Down) audit passed; `pnpm task finish t984 --skip-checks` (Core) `Tests 70 passed (70)`. `pnpm task sync-core --allow-running` reports behind 143 -> shared Core at cc1230032, 0 behind. The lead read result files: `report-original-six-rerun2.json` parityPassed true, gaps []; capture-company-v2 complete true, hostRefusal null; preflight-social-v2 protocolPassed true; replay-company-v5 status ran, gaps [], normalizations [].
- Follow-up: the parity-report host-stream fix, then finish t986. A recorded-run oracle acceptance tool for the campaign tasks. The P4 memory tolerance should be narrowed to store I/O. Saved Flows should carry their declaration. Site-declared person checks are `not_run` on four sites. F23 diagnosis remains open.

### 2026-11-23 - Handover, t985 and t989 integrated, P6 own work accepted pending P2
- Changed: Codex's notes and lane work were committed (dev and task-branch checkpoints). t985 and t989 were finished in both repositories. t989 fix ec6d2517b removes the "tab" substring from Core prose and pins the new site-filter sentence. Core is at 0.52.2. t987 worker commits are Core 0c11fe752 and Down be6a5b08f. t986 worker commit is e5ed50e0e.
- Validation: lead runs. t985 `vitest run` with 5 owners -> 55/55. `pnpm --filter fluxiq check` -> exit 0. t989 `vitest run` with 11 owners -> 215/215 after the fix (2 failures before it). `node scripts/test-domain.mjs extract-list/tests/catalog-text system-instructions/tests/instructions` -> 24/24. Core check -> exit 0. The Down domain check refused a stale Core build until `scripts/build-cache/cli.mjs ... fluxiq:build ...` ran, then exit 0. Finishes: Down audit passed, Core contract gate 70/70 for each.
- Worker claims, not yet lead-run (the lead reviewed the diffs): t987 owner groups 77/77, 255/255, 112/112, 420/420. Composition 160/196, failing only on missing P2 declarations. Downstream 125/125. t986 runner owners 26/26, domain owners 15/15. Both branches pass the pre-push audit.
- Follow-up: t984 acceptance, then merge t987 into t984 for combined checks. Lead re-verification of t986 on synced dev, then its browser proofs. Sync the shared `fxwork/!FluxIQ`, 76+ commits behind Core dev.

### 2026-11-22 - Combined checks and isolated browser startup diagnosis
- Changed: current status reconciled; P3 guidance scoped checks pass and paired task branches are pushed. Bounded F24 source/types/audit pass and paired task branches are pushed; neither is integrated yet while the offline lane holds its parent snapshot.
- Validation: `pnpm --filter @fluxiq-web-extension/domain check` on t989 -> exit0, current Core guard passed,41619ms. `node scripts/structure-audit.mjs` on t985 Core -> exit0,564 warnings/904 baseline. Exact owning commands and earlier results remain in task reports.
- Validation: t986 combined30-owner command ->206/206,200165.7555ms; extension build ->exit0,54363ms. `node scripts/lab/run-lab.mjs recorded-read everything-store --input test-runs/t986-read-parity/input.json --out test-runs/t986-read-parity/report-original-six.json` ->sourceVerified:true, then snapshot_unavailable before parity. Model calls0; external calls/cost null, not zero. Company/social commands were not launched.
- Cause and fix: sandbox stub omitted the production own-page-address reply, so own-document readiness remained unconfirmed. Worker owns snapshot stub/tests; lead owns matching content E2E stub. Guard unchanged; both return truthful empty application addresses for isolated harnesses. Targeted verification/rerun pending; failed report preserved.
- Validation: P6 worker final five-owner batch ->45/45,79.05s; package types ->exit0,91522ms; structure audit ->33 violations, scoped corrections required. Lead13-owner job was withdrawn normally while still FIFO queued, exit1 with no tests run, to avoid testing an obsolete snapshot. Worker full request fixture measures83220->6874 bytes with both rows retained; not live billing evidence.
- Follow-up: finish P2 compatibility/root-cause fixes, P6 structure corrections and lead acceptance, then browser proofs and paired integration. No paid call or completed full FluxIQ sweep.

### 2026-11-22 ? source recovery checks and collection guidance
- Changed: retained extraction plus working records pushed to Down dev dad71ce84 and Core dev eea5c80bc. P2 sourceProof checkpoint5187c81bc merged into P6; semantic checkpoints read current producer authority without re-evaluating data processing. Minimal Core compilation fixes bd431f6e4/c17d0ea19 synced into offline lane.
- Validation (worker, lead combined verification pending): P2 receipt owners68/68; corrected replay/sourceProof owners16/16,72.78s; P6 projector8/8; recovery batch34/35 then corrected checkpoint/witness13/13,63.92s. Replay fixtures had invalid missing reset/effect facts; supported historical omission remains separately tested. P6's failed fixture used sent rather than read packet; no action-success assertion was weakened.
- Validation: offline corrected dependency build passed, including fluxiq149,741ms, gateway6,680ms, UI18,065ms. Down domain build38,904ms and runner types36,961ms passed. Audit then found only statement-packing in the cost reader; root formatting correction bb9f896ae is refrozen for audit rerun.
- Changed: lead owns paired t989 broad-collection-guidance with written brief/report. Core answer-first.3 and conditional automatic-processing prose; Down web-14 requires live paging now and preserves build-only behavior; catalog explains retained fields versus answer view. Core/down owning tests queued; explicit producer-based prompt-pin regeneration added. Preparation's fluxiq build detected overlapping source edits and refused its stamp, so it is not accepted compilation; frozen validation follows final source.
- Not verified: P2/P6 full affected types/owner batches, P3 prompt checks, offline browser commands, four-attempt live task acceptance. No paid calls.

### 2026-11-22 ? retained extraction integrated; product checks resumed
- Validation: first downstream finish refused before mutation because task Core lacked newer dev documentation. Root merged only those docs and `node scripts/structure-audit.mjs --rule working-docs` passed (12 baselined); no product change required repeated source suites.
- Validation: `pnpm task finish t982` -> downstream structure audit passed, merged25300d3ea and removed downstream task worktree. `pnpm task finish t982 --skip-checks` in Core -> mandatory contract gate70/70 passed,17.48s, merged to dev; full sweep deliberately not repeated. Prior narrow package acceptance is recorded above.
- Validation: lead `node --test --test-concurrency=1 test-runs/t986-post-reboot-validation/cost-observer/tests/progress.test.js` ->6/6 passed,185.8699ms. Source was compiled independently with strict exact-optional TypeScript by offline worker.
- Findings: offline combined dependency build passed contracts/SDK then failed four Core type boundaries. Minimal alias/optional-privacy/screen-input corrections checkpointed and synced; rerun active. Processing worker receipt owners68/68 passed; judge projector8/8 passed (claims pending lead combined verification). Processing's four replay-observation tests failed because target observations were absent; cause investigation active, not presumed fixture-only.

### 2026-11-22 ? pagefile-aware scheduler correction
- Cause: after reboot about 35 GiB of Windows commit capacity remained free, but the scheduler required every estimated job peak plus its reserve to fit free physical RAM. The larger pagefile could not help admission. This is an agent-authored scheduler restriction, not evidence of Windows allocation failure or a user requirement to preserve that restriction.
- Decision: under the user's request to resume tests using the larger pagefile, lead revised admission to reserve full estimated peaks against system commit capacity while retaining the 1 GiB available-RAM floor, two slots, FIFO, fresh telemetry, process containment and conservative active reservations. No job-specific override, process kill or runtime state reset.
- Validation: pure policy probe `node --test --test-name-pattern "pagefile|commit pressure|non-atomic|concurrent admissions|two holders|empty machine" tests/heavy-slot.test.mjs` -> 6/6 passed. Candidate full `npm test` ->99/100; a real-process serialization fixture used physical pressure, so the fixture was changed to commit pressure while preserving its exact no-overlap assertion. Corrected full `npm test` ->100/100 passed,47,677 ms, exit0; integration rechecks ->100/100 on branch (50,276 ms) and100/100 on dev (56,281 ms). Merit dev c8a64a1 pushed; installer reported nothing to change, shared wrapper imports updated source directly. Previous ticket-only fix passed99/99.
- Changed: P2 producer receipt checkpoint7c0080394 plus current-only sourceRefs correction61a978799 merged into judge task. P6 incomplete helpers checkpointed before this merge; run-attempt composition ownership handed to judge. These checkpoints are not acceptance.

### 2026-11-22 ? resume after user reboot
- Changed: refreshed worker assignments and task checkpoints above; machine-local queue recovery uses proven process identity rather than killing the unrelated browser process. Memory thresholds and user applications are unchanged.
- Validation: `heavy-slot.mjs run gate-process-reuse-verify -- node --test tests/heavy-slot.test.mjs` -> 47 passed, 0 failed, 21,859 ms. Durable log is machine-local `.heavy-slots/gate-process-reuse-verify.log`. The prior focused run was 46/47 because missing boot telemetry in an existing mock caused a conversion failure; optional telemetry handling was corrected. A subsequent result was lost, so acceptance was rerun with a durable log.
- Not verified: new processing/judge/capture work, browser behavior, paid campaign and full Flux sweeps. Earlier pre-reboot queued sessions are not results. Source checkpoints and new documentation remain local pending gated backup.

### 2026-11-22 - Execution resumed with three workers
- Assignments: task-local briefs resume-processing.md (t984), resume-judge.md (t987), resume-offline.md (t986). Existing workers explicitly restarted; lead owns git and cost observer. No paid or browser launch authorized by the briefs before required checks and coordination.
- Changed: t986 Receipt now has separate pending and unreadable variants; behavior unchanged, validation pending. P2 frozen60-file source checkpointbc49b850f; P6 merge6faae9260 resolves record/store/keep/carry conflicts additively, preserving both publication tracking and judge checkpoint/recovery metadata. Shared ending/run-attempt paths inspected too.
- Validation: P2 pre-merge and resolved-tree `git diff --check` -> exit0. No combined runtime pass inferred from merge. Recovered worker audit21451 -> exit1, six remaining violations (five test-placement, two existing as-never occurrences under one file finding); full original stdout not archived, exact failure excerpt recorded in worker report.
- Next: P2 layout/typed-fixture correction and combined compatibility/store tests; P6 corrected projector test then exact producer-backed source/action recovery; t986 corrected runner check and named owners, then isolated browser proof. Main documents and task branches require final gated backup/integration after observed checks.

### 2026-11-22 - Full status reconciliation after worker handoffs
- Validation: `heavy-slot.mjs status` -> holders=[], queue=[]; physical available3,539,939,328 bytes at inspection. `write_stdin` for former audit21451 -> Unknown process id; no audit pass inferred. Agent states are completed/Partial.
- P2 worker observed33-file baseline214/216; targeted corrections34/34; contracts50/50+typecheck; publication restart2/2 and keep1/1. A real saved-writer precedence defect caused repeated unproven Flow digests/judge calls; canonical recordOutput now follows actual step.settings precedence while preserving ranWith. Final targeted writer/chat/FluxNode8/8 passed, including first+3 provider-free zero-call replays/full safe retained cells. Lead has not independently accepted latest source. Package types failed11 diagnostics: ten fixture fixes written, P6 optional-privacy interface sync still required. Structure initially failed31 violations; corrections written, later result unknown.35 compatibility owners and final builds remain.
- P6 first batch98/100; both failures were new all-letter credential fixtures outside the existing mixed-letter/digit screen contract. Only fixtures corrected; rerun pending. Historical projection gaps can still remain required forever after repair: exact authoritative source replacement receipts and action witness associations are required before acceptance. Synthetic summary size measurements are not live cost or complete provider-request proof.
- t986 runner types failed on four lead-owned reader.ts diagnostics (pending/unreadable union not narrowed before stage/usd access). No browser/capture/preflight followed. Historical F25 remains an open/incomplete trace, not full-task proof.
- Repository state: main dev working plan was stale and is corrected by this entry. Both main dev branches have local documentation commits not pushed; latest P2 source and P6 fixture/report changes are uncommitted in task worktrees. Earlier P0/P4 integration remains pushed. No full FluxIQ sweep completed, main promotion, live browser test or paid call in this execution.

### 2026-11-22 - Provenance and judge checkpoint review
- Frozen validation checkpoint: P6 Core607deb863 records durable issue receipts, actual verified recoveredAtRevision, immediate/reopened resolution facts, restored-owner refusal and presence/window/cache-prefix tests. Root merged P20706d1d97 as4c7f57661; shared run-attempt change preserves both metadata paths and adds restored.evidence forwarding. `git diff --check` -> exit0; runtime checks unrun. Down reports checkpointed P2b11b08900, t986f6968a290 and P68271a2263. These and latest main documentation commits remain local pending gated backup.
- Required next corrections after first owner tests: P6 historical projection-gap resolution by exact source/proof; P2 pending publication retirement across shutdown/restart. P2 traced ending.ts catching retirement failure then saving missing-readiness/no rows; carry may lose tracked publication IDs. Proposed narrow seam persists exact private pending IDs and remaps via actual copy receipts, never scans dataset prefixes. This is an open acceptance gap, not accepted behavior. No more dependent source changes until current owner baseline is observed.
- Update: P2 confirmed crossed-pair matching and vacuous missing-identity matching; corrected both in local 0706d1d97, with exact-source, unknown-source and checkpoint/reopen regression cases. `git diff --check` -> exit 0; runtime tests remain unrun. Truly opaque old dataset refs lack persisted original graph/locator provenance and stay explicitly unknown; no guessed mapping or new terminal condition. P6 recovery is approved only for exact original-source reprojection or authoritative P2 replacement proof; actions require actual Core-owned witness/step association. Lead also caught restored checkpoints incorrectly receiving source-owner authority; worker is correcting issuance to new uninterrupted journals and testing the actual reopen path.
- Validation: direct raw working-doc rule probe reported pre-existing size findings (exit 1, baseline not applied); canonical `node scripts/structure-audit.mjs --rule working-docs` -> passed, 0 warnings/2 baselined. Generated index refreshed through its owning update function.
- Changed: P2 local checkpoint 8c50dc21c carries actual invalid-row counts, dataset association, replay completion receipts and shared input-identifier parity. P6 local cb8f0419a makes checkpoint revisions monotonic and compares full semantic metadata on equal revision. These are source checkpoints, not acceptance.
- Review: independent old listKey/where set checks may admit crossed collection pairs. Assigned an exact tuple/source-association regression and diagnosis to P2 before acceptance; no speculative opaque dataset-id restriction.
- Decision: P6 records rejected checkpoint coverage as a private factual issue with a Core-issued opaque receipt. Only the same uninterrupted complete-source owner may clear that exact issue after a successful newer complete snapshot. Restart, higher revision or an unrelated read is insufficient. Each rejection rotates the receipt; no model reset flag. Metadata-only rejection may persist only this issue while preserving prior evidence and task/P2 fields.
- Remaining: historical projection gaps currently aggregate permanently. P6 must propose and test exact source/current-proof resolution without hiding history or treating uncertain actions as successful. Own-property invalid-version handling and request-window fixtures are written but unrun.
- Validation: `heavy-slot.mjs status` -> no holders; t986 types then t984 runtime tests queued; physical available 1,976,164,352 bytes. No admission override, browser run or paid call. Latest local source and documentation commits await gated remote backup.

### 2026-11-22 - Source checkpoints and remaining acceptance gaps
- Validation: read-only `Get-Process` ->svchost PID13904 working3582MiB/private3588MiB; `Get-CimInstance Win32_Service -Filter 'ProcessId = 13904'` ->defragsvc, Optimize drives, Running/Manual. This is a new instance of the earlier memory-heavy service. User asked asynchronously to pause it with administrator PowerShell or let it finish; no new service stop/override attempted. Fresh gate status succeeded; isolated stale telemetry was not established as another gate defect.
- t986 corrected fixture boundary/discovery checkpointef07032e5 is local, unvalidated/unpushed. P2 restart correction additionally preserves actual optional datasetId on result pages; copied chunk keys cannot replace original source identity. Verification reads existing batch invalid_count/node_id; contradictory or unrepresented aggregate failures retain dataset-scoped holds. Fresh replacement must update actual dataset mapping. Two successive copy/checkpoint/reopen cycles and partial reread tests required. No new database column or guessed association.
- P6 coherent source checkpoint Core284eb77ba then mode sync303f7d75f; Downd63bdae78. Root review found same-length stale save could regress witnesses: approved required monotonic internal revision for unreleased checkpointv1, exact equal-revision semantic equality, preserve actual task/P2 fields on metadata conflict. Correction/tests underway; no P6 validation.
- Input-name discovery confirmed public goal identifiers allow uppercase/underscore and >32 chars, while draft/processing bindings wrongly narrow them. Approved shared neutral contracts identifier rule and owning parser/refusal/tests, preserving case/current own-input membership/item context reservation. Existing secret policy and arbitrary schema keys remain unchanged. Report is t986 reports/input-name-boundary-intake.md; P2 implements the bounded common correction.
- Invalid-source recovery implementation approved: optional exact invalidCount on existing read/page evidence, strict persisted parsing and existing dataset count/answer readiness; actual forward-walk callIds bind a fresh collection receipt. Whole supersession requires known genuine start/end coverage and safe current schemas/count0 for every contributing group; unrelated/partial/prior-invocation rows cannot clear a hold. Existing first-page producer was traced to page1/offset0, opaque starts stay unknown. P2 cancelled only its unstarted test ticket (exit1,no validators) to apply these confirmed corrections; no limit shortcut without proof.
- New P2 read-only integrity finding: row validation drops invalid originals and reports invalidCount, but automatic feed ignores the count and can accept the remaining subset. Lead requires exact persisted source-validation provenance and repairable readiness until that source is actually replaced; no fabricated rejected rows/schema weakening. Minimal seam proposal/regressions pending, no acceptance claim. Mode response seam now checkpointc1f42f283;35 existing compatibility owners are queued after first22 new/runtime owners.
- P2 corrected Core source checkpoint05d61fea4 contains current-input/schema/dispatch guards and automatic runtime; acceptance pending. P6 Core checkpointcf5160993 then merged P2 cleanly as81d96341c; lead confirmed shared replay files preserve both metadata and input-validation hunks. Next P6 fixes: explicit judgeEvidenceVersion:1 capability (legacy untagged behavior preserved), mixed action+data witnesses, unmatched-look source coverage, actual production/restart tests. New-format missing projector/current privacy policy must fail closed, never raw-fallback.
- P3 emitted-context gap: approved core.result processingMode automatic/legacy from existing declaration presence, preserving result text. Missing-first and action-only N/A are automatic; tool/stamp absence is not a mode detector. P2 owns this minimal response seam/test before P3 generic prose changes.
- Validation: lead extraction domain owners ->218/218, reader owners ->42/42; post-sync Core `node scripts/structure-audit.mjs` ->passed,564 warnings/904 baseline. Both task branches synced latest documentation-only dev changes. Down final correction731b2b601 remains unmerged pending finish; main working records committed Downfb1ef2d45/Coreb3e399a3d.
- P6 Down WIP449434406 checkpointed and accepted P1 branch synced. Review then removed unrelated hidden-leaf notices and container text masquerading as control names; actual alert/status/output messages and named hidden controls remain. New regressions not yet run.
- t986 Down WIP4acb250fe plus EOFe3b5b9d3e checkpointed. Exact/slash-descendant fixture URL fix now written after review caught sibling-prefix acceptance; corrected types waiting. Historical traces remain unchanged and open F25 is not whole-task evidence.
- P2 confirmed/fixed missing-schema validation and caller-object binding injection; saved-flow preflight moved into existing best-effort before dispatch. Saved draft routing is flat, so later routed reads are preflighted before earlier lasting acts; no invented nested representation. Corrected explicit owner tests waiting, no runtime acceptance yet.
- Validation: shared gate status ->no holders; corrected t986 types first, P2 tests second, insufficient physical headroom. Root withdrew only its3 unstarted backup/finish sessions by normal Ctrl+C (each exit1, no git/validator started), reducing idle footprint. No queue override, user process stop, browser or paid run. New task checkpoints above are local pending backups; previous pushes remain intact.
- S3 follow-up accepted as design only: pre/post import reach union including paired exports/assets; proof classes raw transport, original read, recorded build, four-attempt task; missing applicable capture blocks; --skip-checks cannot bypass; unaffected receipt requires complete zero-impact graph. Implementation remains after t986 acceptance.

### 2026-11-22 - Gate installed, extraction acceptance and real FluxNode bindings
- Validation: `node apps/extension/scripts/test-extension.mjs content/extraction/tests/list-reader/tests` ->42/42 passed,29,138.4118ms, exit0; domain focused command ->218/218, exit0. Initial working-document audit refused this entry for missing a dedicated Validation bullet; corrected here before retry.
- S8 lock fix installed/pushed Merit dev3008788. Validation: `npm test` ->96/96 isolated,96/96 finish branch,96/96 merged parent; native git smoke exit0. Full details in downstream reports/s8-lock-contention.md. Earlier service question no longer blocks work; no service stopped or memory override used.
- Lead extraction output was lost at context compaction, so closed sessions were not treated as observed passes. Repeated with durable ignored logs. Validation: domain owning suite (extract-list, record-schema, extraction, detect and record filters) ->218/218 passed,7,477.9219ms. Reader suite also passed42/42,29,138.4118ms, exit0.
- P2 real FluxNode dynamic conditions must retain explicit caller-input bindings across attempts. A common neutral validator must reject missing/current-invalid inputs before engine and forward replay resolution can use first-run fallback examples. Constants remain constants; no literal-equality lifting. Same-spec changed-date continuation is required.
- P6 flow-stage/span metadata edits are frozen for serial P2 guard integration. Full retained safe schema stays distinct from display columns; unknown current privacy policy never becomes an empty policy. Semantic control facts must survive actual publisher/declared-state/end-witness composition.
- t986 refreshed Core libraries, types and audit pass; wrapper owners and downstream combined checks pending. No browser or paid run launched.

### 2026-11-22 - Memory admission recovered and lock regression passed
- Validation: gated `node --test --test-name-pattern 'lock|ownership|concurrent admissions' tests/heavy-slot.test.mjs` in isolated Merit fix ->8/8 passed,8,458.7401ms, including open prior reader and400 increments across four processes. No override; actual memory recovered enough for admission. Fix branchdc731ce pushed as backup; active source not yet replaced.
- Validation: gated `node scripts/structure-audit.mjs --rule working-docs --update` ->passed in both main checkouts; downstream551/Core907 baseline entries unchanged, indexes refreshed. Current implementation decisions/briefs remain distinct from runtime acceptance.
- Follow-up: shared-tool full/merge checks and quiet installation, then restart final P1 and t986 dependency checks. P2/P6 and fresh scripted declarations continue independently.

### 2026-11-22 - Quiet gate diagnosis and independent source corrections
- Coordination: workers cancelled four P1 and one P2 owned pre-admission sessions normally; each exited1 without validator output. Gate status then showed holders[]/queue[]. No active command or paid run interrupted; no lock/ticket manually removed.
- Changed: isolated Merit worktree .claude/worktrees/fix-heavy-lock-contention, branch fix/heavy-lock-contention, prepares rename-before-delete lock retirement and removes contender cleanup reads. New tests keep a prior reader open across ownership transfer and exercise400 increments in four independent processes. Active launcher/source are unchanged; tests have not run.
- Validation: `git diff --check` in that isolated worktree -> exit0. Gated `node --test --test-name-pattern 'lock|ownership|concurrent admissions' tests/heavy-slot.test.mjs` -> queued, insufficient physical headroom; root exec99191. Microsoft DeleteFile documentation confirms pending deletion can deny new opens; reproducing the observed race remains required.
- Decision: P2 runtime freeze lifted to fix acknowledged missing-page and strict metadata defects before checks; only model-input stamp refusal in evidence-loop-decision.ts is handed to P2, not P3 prose. Framework-issued persisted stamps remain allowed.
- Decision: real FluxNode entry calls generation directly and has no chat interpretation. P2 may resolve only its still-missing first semantic declaration through the existing evidence loop: explicit process:null plus why for genuinely action-only work, or schema-backed data criteria after capture. Existing declared conditions cannot be erased; no extra interpretation call, heuristic N/A or blanket fixture default. Real FluxNode completion/persistence/replay tests are required.
- Decision: P6 cannot use ephemeral symbols as its only semantic source: spread/clone/persistence lose them. Worker proposes versioned screened semantic checkpoint/source references and final current-policy rescreening. Disjoint call-chain/flow-stage/flow-run helpers approved; attempt-store/keep/ending/carry-on/run-attempt remain P2-owned until serial handoff.
- Checkpoint: t987 Core helpers committedc0244a44d, then accepted P1/current dev synced cleanly to5eb0e2975. Staged diff check passed; no P6 behavior/types/build validation. Root review also requires unknown current privacy policy to stay explicit on reopening durable findings, never default to no exclusions.
- Checkpoint: isolated Merit fix commitdc731ce (version0.3.1) remains unverified/uninstalled; its backup push exec63800 queues behind owning regression exec99191. All thresholds/FIFO remain unchanged.
- Assignment: t986 worker updates only fresh scripted model replies/owning tests with truthful per-task process declarations under briefs/t986-processing-fixtures.md; historical replies, task wording, oracles and generic guidance stay unchanged.
- Follow-up: gate regression/correction, requeue final P1 checks and t986 libraries, corrected P2 acceptance; no paid call, browser launch, full-sweep pass or main promotion.

### 2026-11-22 - Shared gate contention failure before build admission
- Failure: t986-synced-core-libraries exited1 with EPERM opening .heavy-slots/v2/admission.lock before obtaining a slot. No library build ran, so this is not a Core product test failure or acceptance. Its ticket was removed; five other tickets remained and holders were empty.
- Investigation: tools/heavy-slot/state.mjs readJson tolerates disappearance (ENOENT) but propagates EPERM; the mutex repeatedly links, reads and unlinks admission.lock across processes. Windows read/delete contention is a hypothesis, not yet reproduced or fixed. Do not remove a live lock, alter reservations or claim a passing rerun.
- Validation: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs status` -> no holders, five queued checks, physical available1,831,096,320 bytes. Source inspection only; no gate source changed.
- Coordination: all three workers hold new heavy submissions; existing five tickets remain untouched and independent source work continues. Actual drive-optimization process still holds about3.7GB; prior normal stop denied and asynchronous user question remains pending.
- Follow-up: reproduce/correct the mutex error safely, validate its owner/collision behavior, then requeue the failed build without overriding FIFO or memory requirements.

### 2026-11-22 - Exact evidence contracts and remaining regression gate
- Decision: read parity binds the original producer's exact metadata.callId/source/domain/project, the hashed canonical run entry and the scenario/task/snapshot origin. A recursive matching string or self-declared synthetic flag is insufficient. Valid current record schema is required for contract parity; raw row equality is reported separately. Network leakage or unavailable observation is explicit, never reported as zero external activity.
- Decision: P6 semantic projection occurs before legacy trail bookkeeping stripping, preserving actual UUID/date/number values. Actual semantic gaps use existing unsure/model_unconfirmed and meaningful-read continuation; deliberate capture omission with complete rows/effects remains eligible for acceptance. No invented Flow-failure verdict or terminal outcome.
- Finding: S3 discovery found no existing affected-recording merge gate. Generic pre/post import reach belongs in Core, while admitted recording registry, artifact proofs and replay dispatch stay downstream. Open F25 trace proves at most its exact read boundary; no full-task fixture is invented from it. Implementation and complete captures remain pending.
- Review: P2 clears missing-original restoration state on any added read and its new persistence reader relies on a helper that validates only part of the evidence bundle. Worker acknowledged both; new disjoint regressions will require exact missing-page resolution and full typed metadata validation before source corrections after the frozen snapshot. These are open findings, not fixed/tested claims.
- Preparation: P3 collection-guidance brief records obsolete optional-processing and deferred-paging prose, preserves narrow action-row selection, and names disjoint Core/web owners. No P3 source edited or task dispatched yet.
- Validation: `node C:/Users/osrs_/FluxStuff/fxwork/.heavy-slots/heavy-slot.mjs status` -> no holders, six queued checks, physical available 1,900,220,416 bytes; no check admitted or bypassed. Source review only for these decisions; no browser/model execution.
- Follow-up: P1 final checks, P2 runtime and retained-schema regression, P6 independent helpers, t986 exact reader proof and S5 owning tests; persist final acceptance before integration.

### 2026-11-22 - Offline unit checkpoint and processing/judge ownership decisions
- Changed: t986 Core wrapper checkpointd3954767d, accepted P1 source and current dev synced; downstream offline/preflight/scoreboard/capture/read-parity and root cost observer checkpoint14a645262, EOF normalizationb649e9536. Task-branch work is not merged/accepted; combined checks queue behind physical headroom.
- Validation: git diff --cached --check surfaced seven new-file EOF blank-line issues after staging; subsequent targeted EOF cleanup and git diff --check passed. No tests/types/audit run on the new combined snapshot yet. Earlier worker checks remain explicitly historical.
- Decision: P6 exact domain-neutral projector and caller paths approved; shared service.ts/run-attempt.ts remain P2-owned. Separate semantic-gap verdict hold uses existing unsure/repair semantics; intentional raw-capture omission alone must not block complete rows/proven effects. Protect original evidence from callback mutation and preserve real UUID/date/number row values through privacy screening.
- Decision: P2 may persist exact validated pending resultEvidence/provenance in the latest internal attempt row (not checkpoint history), retain validated empty source schemas, and retire only tracked same-attempt publications on missing readiness. No guessed preview/source, no raw-capture deletion, no second selection pass or new terminal failure.
- Follow-up: P2/P6 implementation and focused acceptance, S3 import-graph regression intake, t986 combined validation. No paid run or browser acceptance.

### 2026-11-22 - Gate installed and exact-read replay briefed
- Changed: S8 integrated in MeritPrompts and quiet compatibility launcher installed; detailed exact checks and limitations in reports/s8-lead-acceptance.md. Paired S7/current-state pushes completed (Core4966e2aed, downstream4e36d4531); newer briefs/reports are checkpointed locally pending gated backup.
- Validation: old gate status ->holders[]/queue[] immediately before atomic replacement; installed native git-version run ->exit0; following status ->holders[]/queue[] with physical and commit telemetry. No active reservations migrated. User's existing edits preserved.
- Changed: t986-read-parity.md directs original action89/result96/artifact90 replay and exact canonical read0012 row comparison. Original callId, commandId and artifact digest are directly correlated; full open trace remains inadmissible. t986 Core wrapper checkpointd3954767d then synced accepted P1 source/current dev; dependency rebuild and lead combined checks pending.
- Decision: P2 new-task omission is missing processing, not legacy/N/A; explicit null is N/A, process:{} is a valid empty declaration. Preserve real runtime timestamps and one persisted processing reference across continuation; exact additional attempt-store/carry-on ownership approved and recorded by worker.
- Outcome: S8 done; P1 final metadata fixture assertion and extension checks pending; P2/P6/offline implementation continues. Actual memory pressure can delay validators; no paid calls or browser acceptance.

### 2026-11-22 - Shared gate independently accepted; documentation reconciled
- Validation: MeritPrompts `npm test` through unchanged machine gate -> 94/94 passed, no skips/failures, 50.03 seconds. Final lead correction removes unproven arbitrary batch forwarding (which loses empty arguments); known package-manager native entries remain supported. `node install.mjs --apply` -> nothing to change. Source committed 59341fc; active gate not replaced.
- Validation: downstream `node scripts/structure-audit.mjs --rule working-docs --update` -> exit 0, baseline unchanged 551. Core t988 narrow finish -> mandatory 70/70 contracts passed, merge completed. Initial default finish started pnpm check; lead terminated its verified owned process tree during script tests, observed exit 1/no merge, verified all named check/launcher processes gone, then used --skip-checks with prior working-doc audit and contract acceptance. No full-suite pass claimed.
- Outcome: S7 integrated in both repositories; S8 source accepted, deployment pending. P1 actual-reader tests 2/2 passed; focused domain tests 104/105, remaining mark fixture uses an unsupported text-read flag and needs an attribute fixture correction. Domain test helper also needs a wider field-spec annotation; extension typecheck needs missing private declaration builds. Product source remains frozen.
- Follow-up: paired dev backup and S8 branch integration; P1 corrections/acceptance, P2 runtime, P6 intake, exact historical source correlation.

### 2026-11-22 - Retained-data acceptance and refreshed lane handoffs
- Agent: Senior supervisor.
- Changed: current state and next-session handoff; P1 versions contracts 0.23.0 / fluxiq 0.52.0; P2 synced to accepted Core retention source. p0_permission returns to automatic runtime after its S8 source endpoint; p0_repair has P6 intake available while downstream validators run.
- Validation: P1 `pnpm --filter fluxiq exec vitest run` on the 14 named retention/store/rows/public-export owners -> 111/111 passed, 148.97 seconds; contracts nine schema/record owners -> 69/69 passed, 4.89 seconds. Exact paths remain in t982 report and paired acceptance record. Versioned five-library `pnpm --workspace-concurrency=1 --filter @fluxiq/contracts --filter @fluxiq/sdk --filter fluxiq --filter @fluxiq/client-gateway-websocket --filter @fluxiq/ui-components build` -> exit 0.
- Validation: `pnpm task finish t988` downstream -> structure gate passed and merge completed; Core finish queued. Archive preservation check -> all five archived originals differ only by rebased relative links; angle/reference-relative link scan -> zero unhandled matches in all five.
- Outcome: Core retained-data interface accepted; downstream task not yet accepted. Broad downstream 930/954 passing result and its 24 failures remain recorded, not replaced with an all-pass claim. New actual-reader tests compare absent/present/negated row membership and selected-key dedupe against the prior narrow read.
- Follow-up: downstream focused acceptance, Core S7 integration, independent S8 suite and quiet deployment, P2 runtime and P6 implementation. No paid runs or full FluxIQ sweeps.

### 2026-11-22 - Repeat repair integrated after lead acceptance
- Agent: Senior supervisor.
- Changed: t981 merged in both repositories; Current State rewritten around current assignments and accepted results, removing superseded intake snapshots.
- Validation: `pnpm task finish t981` downstream -> audit passed, merged and worktree removed. Core `pnpm task finish t981 --skip-checks` -> mandatory contract gate 70/70 passed, merged and branch detached/deleted. Independent 281 tests/typecheck/audit recorded in paired Core ledger.
- Outcome: Accepted for t981; whole plan remains active. No paid/full-sweep claim.
- Follow-up: paired dev push, t976 acceptance, P1/P4/P2/P5 and offline proof.


### 2026-11-22 - Judge integrated; extraction and fixed-model lanes active
- Agent: Senior supervisor.
- Changed: t979 integrated in both repositories; t982 extraction and t983 fixed-model implementation assigned. t981 repair source/report checkpointed and parent-synced for lead acceptance.
- Validation: `pnpm task finish t979` downstream -> structure audit passed, merged, worktree removed. `pnpm task finish t979 --skip-checks` in Core -> mandatory contract gate 70/70 passed, merged; focused lead tests/typecheck/audit are recorded in the paired Core ledger. No full suite skipped as acceptance: narrow gates are repository policy.
- Outcome: Partial: judge unit accepted; complete data-first plan still in progress.
- Follow-up: independently validate repair, resolve permission review, complete P1/P4 and provider-free acceptance infrastructure before paid proof.


### 2026-11-22 — P0 workers resumed with written briefs
- Agent: Senior supervisor.
- Changed: Current State, paired Core record and briefs for t976, t979 and t981.
- Why: the user requested agents and durable progress; interrupted changes must be verified before the later lanes.
- Validation: `git status --short` in all three paired task trees -> interrupted Core changes present in all three, Lab changes in t976; prior reports read. No new product acceptance yet.
- Outcome: Partial.
- Follow-up: workers complete scoped fixes; lead verifies and integrates, then establishes the stored-row contract.

### 2026-11-20 — Plan written from the campaign and the user's decisions

- Agent: Senior supervisor.
- Changed: this document (new).
- Why: the user asked for their suggestions and the lead's to be written down after the campaign ended with 0 SUCCESS.
- Validation: not validated: a written plan. Its figures come from the campaign's results table (cost, model and note columns read with awk) and from the step logs' result-processing calls (`processing-calls.mjs`; usable-client-plan.md, 2026-11-20 entries). No code ran.
- Outcome: Accepted.
- Follow-up: P0 with the user.

### 2026-11-20 — Systemic changes and the next session laid out

- Agent: Senior supervisor.
- Changed: this document: "Systemic Changes For The Week" (S1-S10), "Next Session" (lanes and the week), Current State, Open Questions.
- Why: the user asked for anything else that would make everything run smoother, with this working well by next week, and for the next session's systemic changes laid out.
- Validation: not validated: a plan. Checked while writing:
  - `trace-offline-trials-plan.md` is Paused, with tier-1 offline trials built and offline trials inside builds not built;
  - the Lab has a scripted provider (`packages/test-runner/src/demo-llm-*.ts`);
  - `main` is 460 (extension) and 356 (Core) commits behind `dev` (`git rev-list --count origin/main..origin/dev`);
  - the Haiku run costs come from the results table.
- Outcome: Accepted.
- Follow-up: the user's answers to the Open Questions, then "Next Session".

### 2026-11-20 — The user approves the plan; the three fixes go first

- Agent: Senior supervisor.
- Changed:
  - this document: Status, Current State (U6-U8, the three fixes in plain words), Design 5, the suggestions' approval, P0, P7, S9, Next Session step 1, days 1 and 4, Open Questions;
  - AGENTS.md: "No model ladder" now records the judge on the same model and Haiku as the starting model;
  - `usable-client-plan.md`: Current State points here.
- Why: the user said "yes for everything", "if they are important then obviously fix them first", "YES judge stays on same model so we dont burn credits", and, of the day-4 round, "and on any budget". They also asked what the day-4 question meant: it asked whether a paid round could run and on what budget, because the credits are spent.
- Validation: not validated: plan and rule text only.
- Outcome: Accepted.
- Follow-up: next session, "Next Session" step 1.

### 2026-11-20 — The day-4 round is limited to $50

- Agent: Senior supervisor.
- Changed: this document: Status detail, U8, P7, day 4, Open Questions.
- Why: the user: "Lets try and limit budget to $50 absolute max though for that". This replaces "any budget" for the day-4 round. Lead's reading, the safer one: the $50 covers the week's paid runs together, day 4 and the day-5 rerun. The lead's enforcement is to start a task only while spend so far plus its $5 purse is at most $50.
- Validation: not validated: plan text only.
- Outcome: Accepted.
- Follow-up: none.

## Open Questions

- Answered by the user, 2026-11-20:
  - finish the three fixes first (U7);
  - the judge stays on the same model (U6);
  - the day-4 round runs up to $50 absolute max (U8);
  - Haiku is the starting model (U7).

  Nothing is open for the user.
- **Lead:** how much of S1 (re-running a recorded run offline with its recorded model replies) the paused trace and offline-trial work already gives. Answer on day 1 in lane 5.
- **Lead:** what does keeping every column cost per run? Fields only, never page captures. Measure it on the recorded campaign reads in P1.
- **Lead:** is `framework-heavy-lifting-plan.md` W7 built, and if so, why did the campaign's rows lack marks and dates? Answer in P1.

### 2026-11-22: provenance accepted; retained-data handoff and gate lifetime checks

- Changed: P1 public schema exports checkpointed as Core d5cccca16; P1 frozen source merged into both P2 task trees. P2 provenance checkpoint 8c86122d0; downstream report 453389dc3. Shared gate ownership correction brief committed; worker p0_permission owns containment/telemetry lifecycle temporarily, without changing active machine gate.
- Validation: `pnpm --filter @fluxiq/contracts exec vitest run src/record-sets/process/tests/processing-declaration.test.ts src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/binding/tests/bind.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 79/79 passed, 2.10 s. `npm test` in MeritPrompts -> initial 75/76; diagnostic rerun after synchronous-launch cleanup 77/77, 53.97 s. Initial failure detail was truncated and its cause is not asserted. `node --test tests/heavy-slot.test.mjs` after npm/npx native launcher fixes -> 27/27 passed, 8.54 s. All used the existing heavy gate.
- Review: queued telemetry could still block child completion, and unsampled surviving grandchildren require owned process-tree containment. Worker is correcting those before deployment. No active gate replacement or threshold bypass.
- Pending: lead P1 retention validation and downstream checks; P2 runtime readiness/clock/feed integration; P5 F24 typecheck passed (100,501 ms), audit queued, broader F23 proof gap remains. No paid calls or full FluxIQ sweep.
