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

**Next, on the user's go:** the phases below, in order. Every phase is proven without a provider before any paid run.

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

## Work Ledger

### 2026-11-20 — Plan written from the campaign and the user's decisions

- Agent: Senior supervisor.
- Changed: this document (new).
- Why: the user asked for their suggestions and the lead's to be written down after the campaign ended with 0 SUCCESS.
- Validation: not validated: a written plan. Its figures come from the campaign's results table (cost, model and note columns read with awk) and from the step logs' result-processing calls (`processing-calls.mjs`; usable-client-plan.md, 2026-11-20 entries). No code ran.
- Outcome: Accepted.
- Follow-up: P0 with the user.

## Open Questions

- **For the user:** finish or set aside t976, t979 and t981 (L9)?
- **For the user:** does the judge also stay on the starting model (the lead's reading of U1)?
- **For the user:** when may a paid run happen again, and on what budget? The credits are spent.
- **Lead:** what does keeping every column cost per run? Fields only, never page captures. Measure it on the recorded campaign reads in P1.
- **Lead:** is `framework-heavy-lifting-plan.md` W7 built, and if so, why did the campaign's rows lack marks and dates? Answer in P1.
