# Data-First Simplification Plan

Status: Active
Status detail: P0 and fixed-model P4 accepted/integrated; paired P4 push next. Extraction, automatic processing, recorded proof and memory-gate work active. No paid runs.
Created: 2026-11-20
Last updated: 2026-11-22
Owner: Senior supervisor agent
Scope: What changes after the 2026-11-19/20 live campaign: extraction keeps every column, one simple data layer dedupes and cleans from that upstream data, the model collects broadly, the framework does the heavy lifting, one model per task, replays that keep their repairs, a cheaper judge, and no paid run before a provider-free proof.
Paired document: ../!FluxIQ/docs/working/data-first-simplification-plan.md
Related: [usable-client-plan.md](./usable-client-plan.md) (the campaign ledger, 2026-11-20 entries), [framework-heavy-lifting-plan.md](./framework-heavy-lifting-plan.md) (W7: typed fields, marks, row identity), [first-class-data-extraction-plan.md](./first-class-data-extraction-plan.md), [answer-first-plan.md](./answer-first-plan.md); campaign results `C:/Users/osrs_/FluxStuff/fxwork/t959/!FluxIQWebExtension/docs/working/mvp-launch-plan/reports/live-campaign-2026-11-19/results.md`

## Current State

**Execution active, 2026-11-22.** User asked to assign agents, execute the approved plan, and keep durable progress. This is the plan of record; the paired Core document holds Core acceptance evidence. Worker reports are claims until lead verification.

| Unit | Current state | Next action |
| --- | --- | --- |
| P0 t979 judge recovery | Accepted, integrated and pushed to both dev branches. Lead: 125/125 tests, package check, audit; merge contract gate 70/70. Same-model unreadable recovery and paid receipt preservation. | Covered by subsequent combined checks. |
| P0 t981 repeat-safe repair | Accepted and integrated in both repositories. Lead: 281/281 tests in 16 files, package check (87,253 ms), audit; merge contract gate 70/70. Core 0.50.4. Both dev branches are pushed. | P5 can sync and continue. |
| P0 t976 start-only permission | Worker complete: 170 Core tests, 66 Lab tests, 13 catalog tests, package checks/builds and both audits pass. Lead review fixed gate closure, concurrent startup and plan-refusal abort. Source checkpointed and parent synced; Core 0.50.5; lead 161/161 Core tests, 66/66 Lab tests, 13/13 catalog tests, both package checks, dependency builds and audits passed. Integrated in both repositories; Core merge contract gate 70/70 passed. Paired dev push next. | Paired integration, then fixed-model combined acceptance. |
| P1 t982 retained extraction | Worker p0_repair. Schema seam stable; 68 record-set tests reported passing. Full field/metadata transport, compatible schema growth and batch retry parity under test. | Complete additive-page/privacy/campaign-shaped tests, checks, lead verification. |
| P4 t983 fixed task model | Accepted and integrated in both repositories. Lead 140/140 combined tests, typecheck, library build and audit; Core merge contracts 70/70. Core 0.51.0. | Paired dev push; dependent lanes sync before shared edits. |
| P2 t984 automatic data stage | Worker p0_permission active on a minimal stable retainedRows evaluator seam, then operators/binder. Seam backed up/merged into P1; binder 8/8 worker tests/typecheck/audit pass. Explicit automatic-mode readiness/identity work active; dependent memory/interpretation seams await handoffs. | Validate/commit retainedRows seam and merge into P1; continue operators; sync P1/P4 before dependent edits. |
| P5 t985 replay continuity | Lead implemented F24 successful-retry proof subset; 12/12 focused completion tests pass. Source/docs checkpointed on task branches; not integrated. F4/F23 diagnosis and F18 revalidation remain. | Sync t981; typecheck/audit and remaining recorded-path diagnosis. |
| S1/S2/S6 t986 offline proof | Worker p0_judge active. Recorded adapter/scoreboard/CLI foundations implemented; narrow Core public trace wrapper 10 worker tests passed, types pending. Real preflight and admitted prefix composition in progress. | Build runnable real-entry proofs; no classifier/prefix mislabeled as task SUCCESS. |

**Assignments and records:** written briefs and worker reports live under `docs/working/data-first-simplification-plan/{briefs,reports}/`, in the corresponding paired task tree until merged. Trees are `C:/Users/osrs_/FluxStuff/fxwork/t<id>/!FluxIQWebExtension` and sibling `!FluxIQ`. Lead owns integration, shared docs and git. t984 retainedRows seam 2c4099965 passed lead 25/25 tests, preserves source symbols, is backed up and merged into P1; t985's F24 subset is lead-owned.

**Contract and review decisions:** retained rows reuse JsonObject + RecordSchema/RecordBatch; The Design below fixes semanticType, mark and primaryKey. P1 retains full safe schemas through live/saved/replay paths and reconciles compatible additive schemas explicitly. Identical old-batch retries must preserve ordered rows after schema growth. P2 uses existing processing with one run clock, exact-id/unique-label binding and explicit missing evidence; no guessed filters or second DSL. P4 persists the original model atomically, preserves historical records, and must not treat an invalid stored model as a new task. Shared service/memory/interpreter edits are serialized and synced before acceptance.

**New retained-data boundary (2026-11-22):** P2 exposes full qualifying `retainedRows` from the same selected array before display projection; lead will commit that minimal seam and merge it into P1 before dependent edits. P1 internal paging distinguishes collected raw rows and qualifying full rows from public projected views. Migration `0040_run_dataset_exclusions` is reserved to P1 for private excluded-field hashes and an answer_rows_retained marker; old projected rows are never guessed into full records. No user database migration/testing is authorized by the unit tests.

**Validation and environment:** no paid calls or full sweeps have run. Main downstream pre-existing AGENTS.md, .clinerules/fluxiq.md and the untracked language-driven debug note are preserved. Heavy work uses the machine gate and narrow checks. S8 finding: `position < freeSlots` lets the first two tickets race, repeatedly starving the oldest job when only one fits; strict FIFO plus need/commit-headroom admission remains to build. No thresholds or priority overrides changed. OneDrive was about 33 MiB private memory, not leaking, and was left running. Serial validators now release/requeue between stages.

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

**Next:** push paired fixed-model integration; complete extraction; execute data processing, replay persistence and recorded offline proof; only then run the approved small supervised round and final full sweep/promotion. Nothing needs a user decision now.

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

Read Current State and the corresponding task report first; do not restart completed P0 work. Inspect running heavy-slot holders/queue before scheduling checks, and preserve another lane's frozen validation snapshot.

1. P0 judge/repeat/permission are integrated and pushed. Fixed-model t983 is now integrated after 140 passing combined tests, typecheck/build/audit and 70 merge contracts; confirm paired push completed. Do not reopen those completed units.
2. P1 t982 owns retained schema/rows, internal collected/answer paging, migration 0040, private exclusion hashes/readiness/batch receipts and public projection. It includes t984 seam 2c4099965. Complete its focused Core/downstream acceptance, synchronize current parent, verify and integrate before dependent P2 edits.
3. P2 t984 owns exact field binding and explicit automatic-mode processing/readiness. Independent binder tests/types/audit passed. Synchronize P1/P4/permission before interpretation, task-memory and completion edits; preserve saved legacy process behavior.
4. P5 t985 has the tested F24 retry-proof subset. F4/F18 regressions pass with permission parent; F23 still needs exact target/semantic-repair reconstruction. Screened artifacts prove all successors loaded predecessor digests and some digests changed: do not repeat the unsupported blanket claim that nothing persisted.
5. t986 owns recorded model/domain proof, strict scoreboard and real preflight. Public trace-scope wrapper and CLI foundations exist; enforce first-divergence closure and actual starting-state admission. A prefix, scripted model response, missing call count or generic confirm is not full task, zero-call or permission proof.
6. After P1/P2 interfaces settle, implement P3 generic collection guidance, preserving action-row selection. P6 judge evidence reduction, S3 affected-recording gate, S5 live stage costs, S7 unrelated-plan reconciliation and S8 need/commit-headroom admission remain. Heavy-slot FIFO starvation is recorded; no threshold/priority bypass is authorized.
7. Paid acceptance remains blocked on the approved provider-free proofs, not on another permission question. Strict SUCCESS is four correct attempts, three predecessor Flow/digest proofs and zero logical model calls on attempts 2-4. Only then launch the supervised approved round within the total $50 ceiling, report spend as it happens, and stop on balance error. Final full sweep/promotion follows coherent completed work, within the twice-daily sweep rule.

All agents have written briefs and task-local reports. Lead owns shared-state updates, exact observed acceptance, commits/pushes and paired integration. No paid calls, full sweeps or browser acceptance have run in this resumed session so far.

## Work Ledger

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
