# Data-First Simplification Plan

Status: Active
Status detail: Written 2026-11-20 after the live campaign (37 runs, 0 SUCCESS, about $90); the user's decisions and the lead's suggestions are recorded, nothing is built, and nothing runs until the user says so.
Created: 2026-11-20
Last updated: 2026-11-20
Owner: Senior supervisor agent
Scope: What changes after the 2026-11-19/20 live campaign: extraction keeps every column, one simple data layer dedupes and cleans from that upstream data, the model collects broadly, the framework does the heavy lifting, one model per task, replays that keep their repairs, a cheaper judge, and no paid run before a provider-free proof.
Paired document: none yet (most of the code is Core's; a Core-side document is owed before the first Core edit)
Related: [usable-client-plan.md](./usable-client-plan.md) (the campaign ledger, 2026-11-20 entries), [framework-heavy-lifting-plan.md](./framework-heavy-lifting-plan.md) (W7: typed fields, marks, row identity), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [answer-first-plan.md](./answer-first-plan.md); campaign results `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md`

## Current State

**What happened.** The 2026-11-19/20 live campaign ran each site's hardest task: 37 counted runs, 0 SUCCESS (all four attempts right, and attempts 2-4 with zero model calls), 17 PARTIAL, 20 FAILURE, about $90. The first attempt was right in 17 runs. 10 failures were our own plumbing bugs, since fixed. 7 of the 11 runs that hit the $5 purse failed on the data: wrong or missing columns, a promoted row kept, a summary panel not shaped, an iframe or account never read. 3 failed on replay and 1 on the judge. Judges were 40-45% of the spend on failing tasks. Every one of those 11 runs had climbed the model ladder. The evidence is under "Evidence" below.

**Decided by the user (2026-11-20). These are standing rules, all five also in AGENTS.md:**

- **U1. No model ladder.** "We're removing the ... ladder system for going to better models. from now on its just the model we start with."
- **U2. The data layer dedupes and cleans by itself, simply.** "the data layer should automatically remoe duplicates, and clean data using upstream data WHERE POSSIBLE. it should be kept simple." It restates the 2026-10-06 rule that post-processing dedupes by default, which the campaign shows was not in effect.
- **U3. Extraction keeps every column.** "we should simply keep all columns data during extraction and have the data processing layer filter out what it needs to. This way we always have the data available."
- **U4. The model collects broadly.** "encourage model to grab results for stuff that we may use, and tell it the data processing layer can remove bad results later."
- **U5. The framework does the heavy lifting.** "obviously the framework should be doing as much heavy lifting as possible."

**Suggested by the lead (not the user's words; see "Lead's Suggestions"):**
- L1. Rows keep their marks, identity and typed values.
- L2. Duplicates are removed by row identity.
- L3. Conditions are stated once and applied by the framework.
- L4. Reads that are not lists.
- L5. Replays keep their repairs.
- L6. A smaller judge.
- L7. Spending discipline.
- L8. The machine's memory gate.
- L9. Settle the work left in flight.

**Not done.** Nothing in this plan is built. Three campaign fixes sit uncommitted in their task trees, stopped by the user on 2026-11-20 (L9):
- **t976:** permission asked once per chat.
- **t979:** an unreadable judge reply is asked again. Its model climb must come out under U1.
- **t981:** a repaired draft is refused at save.

**Blocked.** The Claude credits are spent (user, 2026-11-20). No agent and no paid run starts until the user says so.

**Goal (user, 2026-11-20):** "we seriously NEED this to be working well by next week", so that the rest of the month goes to deploying and other fixes. This document is the plan of record for that week (S7).

**Next, on the user's go:** "Next Session" below. That means settling the work in flight, fixing the stored-row interface, five lanes in parallel, and a ten-task scoreboard proven offline before one small paid round. The phases (P0-P7) and the systemic changes (S1-S10) are the content. Every change is proven without a provider before any paid run.

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
5. **One model per task (U1).** Build, repairs, later attempts and judge stay on the starting model. That the judge stays on it is the lead's reading of U1. Remove `escalate_model` from the loop decision, and stop offering `ask_person` only once "the ladder has climbed".

## Lead's Suggestions

These are the lead's, from the campaign evidence. They are not the user's rules until the user agrees.

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

- **P0. Settle L9 with the user.**
- **P1. Extraction keeps every column, mark, identity and typed value (U3, L1).** First find exactly where a read drops undeclared columns (F3 says Core notes it). Then check W7's state, and build what is missing. Domain and extension: the read. Core: the stored rows.
- **P2. The data stage (U2, L2, L3).** Automatic removal of duplicates, conditions from the instruction applied to stored fields, order and shape, plus what was removed and why. Replace the model-iterated processing tool, or reduce it to stating the conditions once.
- **P3. Guidance to collect broadly (U4).** Generic words, checked against the "never teaches to the test" rule.
- **P4. Remove the ladder (U1).** Core's role routing (t962 `laddered`), the loop decision's `escalate_model` (t962, t969), the `ask_person` condition, and t979's climb.
- **P5. Replays keep their repairs (L5).** F26, then F23, F4, F18 and F24, each diagnosed first from its recorded run.
- **P6. A smaller judge (L6).**
- **P7. A small supervised live round**, on the user's go and budget. Only tasks whose fix passed provider-free, with each run's cost reported as it happens.

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
- **S9. The starting model** (for the user; see Open Questions). With no ladder, the starting model sets both cost and capability.
  - The campaign's runs that stayed on Haiku and got going cost $0.24-$0.76 each. Lens hood was right 4/4 for $0.58, on Haiku apart from one climb on its last attempt.
  - The lead recommends Haiku for build and judge, measured on the scoreboard.
- **S10. `main` catches up.** `main` has not moved since 11-11: 460 extension and 356 Core commits behind `dev`. Run a full sweep once the week's changes land, then promote.

## Next Session

Start: read this document's Current State, check memory and OneDrive, and confirm the gate is empty. Then:

1. **Settle the work in flight (P0, L9) with the user.** The lead's recommendation:
   - finish t981: F26 blocks SUCCESS directly;
   - finish t979 without its model climb;
   - finish t976.

   All three are mostly written and uncommitted in their trees.
2. **Fix one interface before dispatch:** the stored row. It holds every field, each field's typed value, the row's marks and its identity. Lanes 1 and 2 build against it.
3. **Dispatch the lanes in parallel, partitioned by file:**

   | Lane | Work | Where |
   | --- | --- | --- |
   | 1 | P1: reads keep every column, mark, identity and typed value. Check W7 first. | domain and extension reads; Core's stored rows |
   | 2 | P2: the automatic data stage, against the fixed row interface. | Core result processing |
   | 3 | P4 and P3: remove the ladder (with t979's climb), then the collect-broadly guidance. | Core model routing, loop decision, build guidance |
   | 4 | P5: diagnose F23, F24, F4 and F18 from their recorded runs, then fix them. t981's F26 lands first. | Core replay and draft |
   | 5 | S1, S2 and S6: offline re-run of recorded runs, the ten-task scoreboard, and the per-site preflight. | Lab (`packages/test-runner`, `apps/scenario-lab`) |
   | Lead | Verification, merges in rounds (S4), this document (S7), the user's questions. | |

4. **Acceptance before any paid run:** the scoreboard's tasks pass offline on their recorded runs, with zero model calls on attempts 2-4.

**The week, cut for parallel lanes.** These are the lead's estimates; the real constraints are named.
- **Day 1:** P0, the row interface, and lanes 1, 3, 4 and 5 dispatched; lane 2 starts once the interface is fixed. Constraint: the user's decisions on P0.
- **Day 2:** lanes 1-4 land provider-free, and the first offline scoreboard runs. Constraint: two heavy slots on the 12 GB machine.
- **Day 3:** the six near-passing tasks reach SUCCESS offline, and P6 (the smaller judge) lands.
- **Day 4:** one small supervised live round on the starting model, about ten tasks. The lead's estimate is under $10 on Haiku, reported as it runs. Constraint: Claude credits and the user's go.
- **Day 5:** fix forward from day 4 offline, a second small round on what failed, then the full sweep and `main` (S10).

## Work Ledger

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

## Open Questions

- **For the user:** finish or set aside t976, t979 and t981 (L9)?
- **For the user:** does the judge also stay on the starting model (the lead's reading of U1)?
- **For the user:** when may a paid run happen again, and on what budget? The credits are spent. The plan needs one small round on day 4, under $10 on Haiku by the lead's estimate.
- **For the user:** which starting model (S9)? The lead recommends Haiku for build and judge, measured on the scoreboard.
- **Lead:** how much of S1 (re-running a recorded run offline with its recorded model replies) the paused trace and offline-trial work already gives. Answer on day 1 in lane 5.
- **Lead:** what does keeping every column cost per run? Fields only, never page captures. Measure it on the recorded campaign reads in P1.
- **Lead:** is `framework-heavy-lifting-plan.md` W7 built, and if so, why did the campaign's rows lack marks and dates? Answer in P1.
