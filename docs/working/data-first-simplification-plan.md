# Data-First Simplification Plan

Status: Active
Status detail: P0 and fixed-model P4 accepted, integrated and pushed in both repositories. Extraction, automatic processing, recorded proof and memory-gate work active. No paid runs.
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
| P0 t976 start-only permission | Worker complete: 170 Core tests, 66 Lab tests, 13 catalog tests, package checks/builds and both audits pass. Lead review fixed gate closure, concurrent startup and plan-refusal abort. Source checkpointed and parent synced; Core 0.50.5; lead 161/161 Core tests, 66/66 Lab tests, 13/13 catalog tests, both package checks, dependency builds and audits passed. Integrated in both repositories; Core merge contract gate 70/70 passed. Both dev branches are pushed. | Accepted together with fixed-model combined checks. |
| P1 t982 retained extraction | Core frozen and lead-verified: 111 retention/storage plus69 record-contract tests pass; contracts0.23.0/fluxiq0.52.0 libraries rebuilt. Downstream final content owners42/42, domain types and audit pass; one replay fixture used the wrong output path and is corrected/frozen. Four final checks cancelled before admission for quiet gate diagnosis. Earlier930/954 and104/105 failures remain recorded. | Requeue same four checks after gate correction, then lead acceptance and paired integration. |
| P4 t983 fixed task model | Accepted and integrated in both repositories. Lead 140/140 combined tests, typecheck, library build and audit; Core merge contracts 70/70. Core 0.51.0. | P1, P2 and offline-proof lanes synced to accepted permission/P4 parent. |
| P2 t984 automatic data stage | Independent evaluator/binding/provenance checkpointed. Lead 77/77 operator tests and 79/79 provenance/automatic/binder tests pass. First runtime check cancelled before admission; worker now fixes lead-reviewed source restoration/strict metadata parsing and reserved model-authored stamps, with regression tests. | Freeze corrected snapshot, validate runtime/schema/clock/publication, then coordinate P6 additive checkpoint handoff. |
| P5 t985 replay continuity | Lead F24 successful-retry fix checkpointed; combined 55/55 tests, Core types and audit pass on accepted P0/P4 parent. Not integrated. F23 missing source mapping remains under diagnosis; recorded amendments exist but do not prove the cause. | Complete remaining recorded-path diagnosis and paired integration; four-attempt acceptance remains later. |
| S1/S2/S6 t986 offline proof | Core wrapper checkpointed, then synced to accepted P1/current dev; combined library refresh queued. Downstream source checkpointed14a645262+b649e9536, final checks pending. F25 original read.results.2/action89/result96/HTML90 directly correlated; open trace still not whole-task proof. | Validate original six-field actual-reader parity, fixed scoreboard/preflight/capture. New-task fixtures need explicit P2 processing declarations; historical replies stay untouched. |
| P6 t987 smaller judge evidence | p0_repair implementing approved neutral sent-copy projector and domain-owned semantic evidence. Core preserves full rows/accounts/effect facts; invalid projection has explicit repairable gap, deliberate capture omission alone does not. | Independent helpers first; service.ts/run-attempt.ts forwarding waits for P2 ownership handoff. |
| S5 t986 live cost | Root observer/forwarding checkpointed with offline unit; five owning tests prepared, not yet run. Reads settled Core metadata only; pending/unpriced costs remain unknown and late receipts retain attempt ownership. | Combined runner checks after memory gate opens; canonical purse/budget untouched. |
| S7 t988 plan status | Integrated and pushed in both repositories: downstream structure gate and Core 70/70 contracts pass. Older plans retain unresolved work and now point to this plan. | Maintain current state at each milestone. |
| S8 shared heavy-work gate | Installed after suites94/94/native smoke; Merit dev47dbc88 pushed. t986 refresh later failed EPERM opening admission.lock before build. All five other unstarted jobs cancelled normally for quiet diagnosis; root prepared rename-before-delete lock retirement in isolated Merit fix/heavy-lock-contention worktree. Active gate source unchanged. | Only owning gate regression check is queued for memory. Workers hold new heavy submissions; no memory/FIFO override. |

**Assignments and records:** written briefs and worker reports live under `docs/working/data-first-simplification-plan/{briefs,reports}/`, in the corresponding paired task tree until merged. Trees are `C:/Users/osrs_/FluxStuff/fxwork/t<id>/!FluxIQWebExtension` and sibling `!FluxIQ`. Lead owns integration, shared docs and git. t984 retainedRows seam 2c4099965 passed lead 25/25 tests, preserves source symbols, is backed up and merged into P1; t985's F24 subset is lead-owned.

**Contract and review decisions:** retained rows reuse JsonObject + RecordSchema/RecordBatch; The Design below fixes semanticType, mark and primaryKey. P1 retains full safe schemas through live/saved/replay paths and reconciles compatible additive schemas explicitly. Identical old-batch retries must preserve ordered rows after schema growth. P2 uses existing processing with one run clock, exact-id/unique-label binding and explicit missing evidence; no guessed filters or second DSL. P4 persists the original model atomically, preserves historical records, and must not treat an invalid stored model as a new task. Shared service/memory/interpreter edits are serialized and synced before acceptance.

**Accepted retained-data boundary (2026-11-22):** P2 exposes full qualifying `retainedRows` from the same selected array before display projection; the lead accepted and merged that minimal seam into P1. P1 internal paging distinguishes collected raw rows and qualifying full rows from public projected views. Migration `0040_run_dataset_exclusions` holds private excluded-field hashes and an answer_rows_retained marker; old projected rows are never guessed into full records. No user database migration/testing is authorized by unit tests.

**Continuation clock decision:** P2 preserves actual runtime-run start/end timestamps. One strictly validated processingReferenceTimeMs is anchored to the first actual session start of the logical attempt, persisted in internal attempt metadata and runtime summary_json, and carried into subsequent segments. Feed, tools and final storage consume that one reference; missing/invalid legacy reference is repairable/unavailable, never silently replaced with current time. No DB migration or public timing-schema change.

**Validation and environment:** no paid calls or completed full FluxIQ sweeps. Core t988's default finish unexpectedly launched pnpm check after 70 passing contracts; lead stopped only that identified owned check during script tests and reran finish with narrow validation. This interrupted sweep is not a pass. Main downstream pre-existing AGENTS.md, .clinerules/fluxiq.md and the untracked language-driven debug note are preserved. S8 is installed and agents resumed normal gated work. Windows Optimize drives was using about3.5GiB; its normal service stop was denied for lack of administrator rights, and the user was asked asynchronously to pause it or wait. No service/process was stopped; no admission overrides. OneDrive was not diagnosed as leaking.

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

**Next:** complete queued extraction acceptance while P2/P6 source work proceeds; validate recorded offline proof and live-cost observer; only then the approved supervised round and final sweep/promotion. An asynchronous request asks the user to pause Windows drive optimization because this session cannot stop that service; it is not a request for another paid-run approval.

### Earlier execution checkpoint (2026-11-22; superseded by the table above)

- Both dev branches pushed: downstream 93cda7b0d and Core 4ddfe98a5. No main promotion or paid run.
- P1 source checkpointed (Core 3b85dd9d0, downstream ba64bbf1c) and both task trees merged current dev. Worker resumed public schema-parser exports and combined validation; 392 tests in loaded downstream entries passed, but 73/135 entries could not load before that export fix. This is not acceptance.
- P2 lead validation: `pnpm --filter @fluxiq/contracts exec vitest run src/record-sets/process/tests/process-rows.test.ts src/record-sets/process/tests/automatic-processing.test.ts src/record-sets/process/tests/result-operators.test.ts src/record-sets/process/binding/tests/bind.test.ts --maxWorkers=1 --minWorkers=1 --fileParallelism=false` -> 77/77 passed. Independent declaration provenance is implemented; runtime/store integration waits for P1 handoff.
- S8 shared gate on MeritPrompts branch `feat/memory-aware-heavy-gate`: `node --test tests/heavy-slot.test.mjs` through the existing gate -> 24/24 passed, 6.72 seconds. Real crash/child-lifetime fixtures now pass; an earlier fixture lost its child on parent exit and was corrected to launch an owned detached child. Full suite pending. No active-gate replacement.
- Offline proof: worker reports Core wrapper 11 tests, types, audit and library build passing on synced parent; lead acceptance pending. Historical F25 has an open/incomplete trace and missing original-start proof and remains inadmissible for whole-task success. Fresh capture architecture separates source trace archive from pre-entry snapshot.

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
2. P1 t982 owns retained schema/rows, internal collected/answer paging, migration 0040, private exclusion hashes/readiness/batch receipts and public projection. It includes t984 seam 2c4099965. Core lead acceptance is complete (180 tests); finish downstream corrected selection/legacy compatibility checks and paired integration. P2 may now edit its Core runtime against this frozen accepted interface.
3. P2 t984 owns exact field binding and explicit automatic-mode processing/readiness. Independent binder tests/types/audit passed. Synchronize P1/P4/permission before interpretation, task-memory and completion edits; preserve saved legacy process behavior.
4. P5 t985 has the tested F24 retry-proof subset. F4/F18 regressions pass with permission parent; F23 still needs exact target/semantic-repair reconstruction. Screened artifacts prove all successors loaded predecessor digests and some digests changed: do not repeat the unsupported blanket claim that nothing persisted.
5. t986 owns recorded model/domain proof, strict scoreboard and real preflight. Public trace-scope wrapper and CLI foundations exist; enforce first-divergence closure and actual starting-state admission. A prefix, scripted model response, missing call count or generic confirm is not full task, zero-call or permission proof.
6. After P1/P2 interfaces settle, implement P3 generic collection guidance, preserving action-row selection. P6 t987 source implementation is active; shared callers remain P2-owned. S7 is integrated and pushed in both repositories. S8 is integrated, pushed and installed with lead/branch/parent 94/94 tests and native smoke passing. S3 discovery is complete but its graph/registry gate is not implemented; S5 observer is checkpointed and awaits combined runner checks. No threshold/priority bypass is authorized.
7. Paid acceptance remains blocked on the approved provider-free proofs, not on another permission question. Strict SUCCESS is four correct attempts, three predecessor Flow/digest proofs and zero logical model calls on attempts 2-4. Only then launch the supervised approved round within the total $50 ceiling, report spend as it happens, and stop on balance error. Final full sweep/promotion follows coherent completed work, within the twice-daily sweep rule.

All agents have written briefs and task-local reports. Lead owns shared-state updates, exact observed acceptance, commits/pushes and paired integration. No paid calls or browser acceptance; one inadvertently launched Core full check was deliberately interrupted and is not acceptance.

## Work Ledger

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
