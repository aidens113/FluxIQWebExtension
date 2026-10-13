# Live Testing Handoff Audit — 2026-10-11

Status: Active
Status detail: t460 pushed; B/D repair replays passed; t461 observations/order independently checked; headed proof passed; t461 bothdev pushed; round-eight B/C/D .25 zero-call readiness underway on frozen sourcepair. B/C/D qualification open.
Created: 2026-10-11
Last updated: 2026-10-12
Owner: Codex senior supervisor
Scope: Reconcile Claude's live testing, saved run verdicts, lane worktrees and working notes, and provide an executable continuation plan.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [MVP plan](./mvp-final-month-plan.md), [recovery plan](./state-aware-recovery-plan.md), [working index](./README.md)

## Current State

Qualification means two consecutive passing paid builds on one frozen source pair. Each build is followed by a
separate model-free replay with an unchanged Flow hash and all five counters at zero, and every run is fully
debugged.

- A qualified in round 3, on an earlier pair.
- B and D qualified in round 12 on downstream f2d100a6 / Core f2e6b076:
  - B: run-mv62icw0-2be384b4 and run-mv636xvb-e1426db1.
  - D: run-mv62icw0-070f88ad and run-mv636xyp-2e4fe54d.
  - All four replays passed. All four debugs are in the lane trees (t262, t275).
  - B's Flow borrows a cross-page "+" handle that works only positionally.
- C is not qualified. Round 12 build 1 (run-mv62icw3-9118516f) failed. For "under $50" the Flow applied a
  "$25 to $50" site filter, which dropped two rows, and every judge said yes. C waits for t482.

In flight: t482-t487, in task worktrees under fxwork/, none merged. Each worker owns its report in that task's
docs/working/state-aware-recovery-plan/reports/.

- t482: judges refuse over-narrowing; rowsActedOn rows keep their content; read-condition and record-set
  wording.
- t483: lab replay goes through launchExtensionSession and keeps failure details; a rejected trial gets a
  verdict.
- t484: a byte-stable request prefix; route state is appended, not inserted.
- t485: pace from the stated limit; an interruption branch before "Complete now"; label-only resubmits.
- t486: cross-page handles refused in exploration and at submit; a type into a non-editable element refused at
  submit; dotted read fields; the covering line names its cover; a satisfied step routed by state and not counted
  as an act.
- t487: chat wording.

Next steps:

1. Verify and merge t482-t487 on narrow gates. Core merges run under Core's pnpm check.
2. Sync the lane trees, then run the recovery matrix and the dry runs.
3. Run C's round-13 qualification: two builds, their replays and their debugs.

B and D need no further routine builds. Rerun them only to confirm a change that touches their path.

Launch settings for a paid build:

- Process environment: FLUXIQ_TEST_TARGET=persistent-isolated and FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25 (each
  lane's .env.local says isolated and 0.10), FLUXIQ_LAB_INSTANCE=<lane slot>, FLUXIQ_LAB_CORE_BRANCH=<lane Core
  branch>, FLUXIQ_DEMO_HEADLESS=false.
- CLI: --llm-max-cost-usd 0.25, --llm-max-calls 64, --llm-max-run-tokens 48000000.
- Replays: env -u DEEPSEEK_API_KEY FLUXIQ_TEST_ENV_FILES=none, with the same instance and branch.

Rules:

- Only the ten realistic scenarios, in a visible browser, started from the extension chat.
- A balance error stops all paid work.
- Every failed run gets a full debug and changed source before a rerun.
- No model guidance shaped like a scenario.
- Full suites at most twice a day.
- Preserve profiles, projects, keys, recordings and the user's .clinerules edit.

Earlier history (rounds 7-11, t460, t461) is in the Work Ledger and the archive.

## Audit Findings

[Settled audit findings and briefs](./live-testing-handoff-audit-2026-10-11/archive/2026-10-12-t460-handoff-history.md) preserve prior decisions; Current State supersedes them.

## Continuation Plan

### Phase 0 — Recover the handoff without losing work

1. Read this Current State, the recovery plan's rules, and each lane's report. Recheck processes and git status
   before changing ownership; preserve profiles, run artifacts, user edits and every dirty lane file.
2. Bring A's run-2 debug and B/D run debugs to completion in their existing lane trees. Record every step,
   final verdict, costs, UI findings and running product identities. Preserve the original instructions/oracles.
3. Review C's exact diffs alongside its three worker reports. Preserve WIP with scoped supervisor commits;
   do not treat the worker's reported tests as supervisor verification or push unfinished code to dev.
4. Reconcile the MVP/recovery Current State and headers after recovery. Compact their ledgers if required by
   the working-document protocol; retain history in archives. Core has matching stale summaries to reconcile
   when cross-repository work resumes. The present audit deliberately makes no Core edits.

### Phase 1 — Close A and integrate existing bounded fixes

1. A: inspect both bundles' running-build/Core/host identities, matching product fingerprints, accepted
   candidate/trial receipts, all four oracle checks, and replay provider accounting. Check UI and all step logs.
   If they establish two consecutive qualifying passes, mark A qualified without another paid run.
2. C: in its paired tree, rebuild the changed Core libraries; run focused candidate authoring-loop/endings,
   look-withdrawal/loop-budget/state-digest tests and downstream system-instructions tests. Run affected package
   typechecks and structure audits against current outputs; investigate suspect cache reuse only if reproduced.
3. Integrate C's verified unit using task lifecycle tooling in downstream first, then Core. Inspect any t383
   overlap rather than reimplementing or overwriting it. Push both devs only after coherent integration passes.
4. Review t380 separately with its changed test files. Review t381 for ownership/connection release and overlap
   with t435; reproduce the B recording failure provider-free before deciding its final scope. Narrow checks
   gate integration; another whole-package run is not a per-task merge requirement under the newer AGENTS rule.
5. Once A's gate is signed, implement the documented candidate-default switch in Core's `model/authoring-mode/`
   owner with its affected API/default tests and documentation. This is a future implementation step, not done here.

### Phase 2 — Debug failed lanes and qualify B/C/D

1. B and D: trace `lab.chat_build_failed` to the underlying Core ending, trial/refusal/tool sequence and budget.
   The wrapper code is not a root cause. Compare each failure with current source before proposing a fix.
2. D: use the existing design only if the new trace supports it. Keep a generic dismissal action downstream;
   Core owns generic trial feedback, handler grammar and acceptance. Synchronize protocol, routing, schemas,
   capabilities, tests and architecture docs. No scenario-specific model examples or weakened acceptance gate.
3. Implement each evidenced defect on an isolated task unit with file-partitioned briefs. Use workers where
   AGENTS calls for them; alert the user before the first Core edit. Supervisor verifies each worker's claims.
4. Synchronize each lane to a fixed product pair and rebuild before paid testing. Verify slot ownership,
   running identities, zero-call preflight, current guards and the $0.10 whole-Flow purse. Use headed browsers,
   real extension chat, candidate mode and one attempt per launch. Do not launch paid testing as part of this audit.
5. Debug every completed run before rerunning. Require two consecutive creation passes per lane on one product
   pair, independent exact oracles and zero-call replay. A failure resets that lane's qualification streak.

### Phase 3 — Expand proof after the loop holds

1. Prove create → drift → diagnose → in-run repair → judged persistence → deterministic reuse on three sites,
   twice per site; later reuse must make zero model calls. Include restart/uncertain lasting-act cases.
2. Run the 67-task breadth plan across the ten allowed realistic sites; retain an explicit denominator and
   distinguish creation, repair and typed-node success. Recording plus mandatory instructions follows A-D.
3. Finish scoped UX, extraction and catalog gaps exposed by these tests; then installed Chrome/Edge and Firefox,
   privacy/performance/packaging and the unfamiliar-user acceptance script. Keep the October 29 freeze and
   November 10 deadline; present a scope proposal if the established gates cannot fit.

## Validation And Risks

- Audit validation: git statuses/ref comparisons, retained branch ahead/behind counts, lane report/diff
  inspection, sanitized saved verdict/runtime/oracle fields and process inventory. No fresh live proof claimed.
- Before any source integration: tests beside changed modules, typechecks of affected packages and structure
  audit. Full sweeps remain at most twice daily, on dev in the background; previous sweep-1011 was not rerun here.
- Safety-critical follow-ups in the recovery plan (optional way-out presses, repair-written effect metadata,
  committing-act uncertainty) should be prioritized when lane traces expose them; wording polish follows.
- Do not erase historical passes merely because reports are stale, and do not infer complete qualification
  from compilation, worker claims, branch names or a saved top-level passed verdict alone.

## Worker Briefs

### Brief: a-review - t461 headed rejection evidence proof

- Frozen t461 current Core/domain/extension builds; read own producer and consumer reports. No source edits.
- Own only producer report appendix and ignored run-scoped harness artifacts; no shared-doc/branch/commit.
- One bounded actual headed T2 proof on existing everything-store realistic fixture, fresh owned profile,
  no synthetic page/fixture patch or original lane/profile reset. No providers/Core host/user panel.
- Use normal harness build and actual compiled gateway mapper/extract-list dispatch/content action/public
  result mapper, then compiled Core extraction summary/read account. Never hand-shape BrowserAction options.
- Exercise helper-rejection observations, sparse original predicate indices, requested schema order and
  standalone/continuation alignment as feasible. Independent DOM comparisons return only counts/state/
  equality/order booleans. Keep raw packets/screenshots private outside disposable worktree.
- Verify legacy/withheld handling through existing owner units; state actual sensitive browser values count
  and do not claim live withholding when zero. No addressing/binding additions or semantic judge pass.
- On driver failure preserve/debug before correcting; bounded fixture-driver corrections allowed, no
  product changes or model calls. Report browser/build/page/profile/pipeline/hashes/exact checks/limits.
- Full background/WebSocket/Core host path remains unproved by T2; new paid production C creation tests it.

### Brief: b-debug — t460 provider-disabled B/D live repair validation

- After supervisor t460 integration/push and explicit source-sync signal, own retained t262 B replay and t275 D
  replay operation, sequentially; no provider-enabled creation, second attempt, source/shared-doc edits.
- Own only t262/t275 reports/replay-settlement-live-proof.md. Preserve old profiles/projects/keys/hash/evidence.
- Read original round-seven replay helper/options; use exact original project/Flow/task/workspace/instance,
  FLUXIQ_TEST_ENV_FILES=none and actual withoutProviderSecrets, constructor modelProvidersEnabledfalse.
- Rebuild through normal owners/current source validators. Send run ID/receipt promptly; preserve failed receipt.
- Verify runtime/original goal/hash equality, five explicit counters0, settled accounting, no pending/omitted/
  contradictory rows, credential env[], stored keys preserved, no harness. No inference from disabled wiring.
- On failure stop/full debug, no relaunch or retry; balance error stops paid work globally. No user panel or reset.
- This is repair validation on changed source, not a same-pair qualification creation/replay streak.
- No full suites/lifecycle/commits. Root independently reviews actual receipts before claiming browser success.

### Brief: b-debug — t461 column fidelity

- Nested paired t461 under C:/Users/osrs_/FluxStuff/fxwork/t461. Read Current State and retained t451
  reports/exclusion-provenance-audit.md; source-supported author order differs from normalization.
- Own domain/output-nodes/extract-list/reconciled-record-output.ts and nearest tests, declared-columns.ts/
  record-output.ts only if needed, and nearest dispatch test. No other producer/wire/Core/shared-doc edits.
- Fail-first neutral field insertion alpha/beta/gamma versus authored gamma/alpha/beta. Actual dispatch
  schema retains authored order, valid types/labels/exclusions/subsets/helpers/processing unchanged.
- No-authored-schema fallback retains derived field order. Preserve duplicate/unknown/excluded refusal;
  no task-aware sorting, oracle changes, model guidance or output-data mutation.
- Own report reports/column-fidelity-repair.md only; report exact files/checks/architecture wording.
- Coordinate with A producer: do not run whole domain/extension types/build until its source is stable.
  Narrow nearest unit tests may run only over stable imports. No full suites/browser/provider/panel/commits.

### Brief: a-review — t461 rejection observation producer and contract

- Nested paired t461, read Current State/own exclusion audit, Core boundary if consulting paired generic types.
- Own extension content/extraction/{item-filter,list-reader,rejected-samples}.ts, content/actions/extract-list.ts,
  content/extraction/continued-read/read-checkpoint.ts/nearest test, shared/extraction-continuation.ts and nearest
  tests. Own domain/actions/extraction/{summary,rejected-samples,
  seen-values}.ts/barrel/types as required and domain/runtime/llm-evidence/node-run/replay-answer.ts/tests.
- domain/client/index.ts may export only the new observation parser/type for shared checkpoint use.
- No extract-list output schema/reconciliation files (B), Core consumer files (C) or shared docs.
- First propose optional generic positional companion shape in own report and message root/C BEFORE edits
  depend on it. Approved state union present/absent/unavailable/withheld; value only present, including empty.
  Closed known reader-kind tokens, positive page/item passive ordinals; never arbitrary descriptor text.
  Capture rejecting read once during evaluation with truthful original observed value,
  original observed text including empty string, condition ordinal and bounded passive provenance. No selectors,
  handles, raw DOM/attribute maps or executable binding; generic Core must not import web contracts.
- Preserve legacy absence as unknown, grouping/counts/continuations/alignment; do not coalesce identical rows
  with contradictory observations. Sensitive/refused/thrown reads cannot be labelled absent. No filter change.
- Fail-first neutral absent/empty/present numeric/multi-rejection/duplicate-observation/continuation cases;
  wire parser refuses malformed alignment and undeclared sensitive/addressing metadata. Existing privacy wins.
- Own report reports/rejection-observation-producer.md only. Coordinate source stability before package checks;
  report exact contract/consumer seams/owner tests. No full suites/browser/provider/panel/commits/lifecycle.

### Brief: c-validation — t461 generic rejection observation consumer

- Start only after t460 replay repair handoff; nested paired t461 Core, read Current State/exclusion audit and
  A proposed optional contract. Own Core runtime/service/summaries/extraction-summary.ts and nearest tests;
  result-verification/contracts.ts/read-account/{accounts,alone-rows}.ts/tests, build-test/read-rows.ts if needed.
- Focused generic result-verification/condition-observation/{parse,screen,index}.ts and nearest tests approved
  for shared closed-shape validation/privacy; parser types-only imports, no new cycle or web dependency.
- read-account/looped-account.ts and nearest tests approved to concatenate aligned observations across passes;
  legacy labels get null only when a known companion exists elsewhere, never invented absence or provenance.
- No downstream source files (A/B) or Core evidence-loop files. Generic optional condition observation only,
  no DOM/selectors/browser APIs/domain imports or reimplementation of domain predicates.
- Fail-first actual stored-summary and trial/saved-result consumer propagation of neutral companion evidence.
  Original observed text/predicate context retained, absent/empty/withheld/legacy-unknown truthful and distinct.
- Sanitize before text flattening using existing denied-key/credential screen; no addresses/executable bindings,
  no invented numeric truth or eligibility verdict. Keep witness counts, ordering, truncation and old shape valid.
- Own downstream reports/rejection-observation-consumer.md only. No shared-doc/source-overlap/full suites/
  browser/provider/panel/commits. Coordinate stable contract/source before exact tests/types/owner build.












### Worker brief: round-eight changed-source qualification

- Starts only after supervisor owning paired integration/push and explicit frozen-head clearance. No paid launch
  until root independently accepts each new zero-call ready receipt and current owner inventories.
- A-review owns B/t262 slot3, own reports/b-round-eight.md only; bigbox-retail, original task
  bigbox-retail-pickup-cart-store-remembered-after-creation, variant store-remembered, t262-slot-3/t262-b.
- C-validation owns C/t451 slot1, own reports/c-round-eight.md only; everything-store, original task
  everything-store-plus-earbuds-under-50, instance t451-slot-1/workspace t451-c.
- B-debug owns D/t275 slot4, own reports/d-round-eight.md only; social-network-feed, original task
  social-network-feed-confirm-requests, instance t275-slot-4/workspace t275-d.
- Supervisor syncs nested Core/downstream clean lanes to frozen paired dev. Workers use normal owning builds
  and persistent-isolated/headed Lab dry-run, separate new evidence/log names; never overwrite prior receipts.
- Process ceiling0.25 AND CLI maxcost0.25; current lab-create-flow/deepseek/deepseek-flash/candidate/create-flow
  unchanged; perrequest992000/8000/1000000, calls64, max-run-tokens48000000; no time/default/guard override.
- Ready must show calls0, original unchanged instruction/oracle digest, both purses0.25, candidate/reset/trials
  and current owner inventories. Root clears exactly one paid attempt, verifies actual four running identities.
- Fully debug every step/packet/UI/accepted candidate/oracle/runtime/cost before reporting success. Failure
  stops lane, full debug required and relevant source change before paid relaunch; balance error stops allpaid.
- Passing creation requires separate provider-disabled replay original IDs/hash, actual all5counters0/full
  settled ledger/keys preserved; first replay passes before root clears second same-frozen-pair creation.
- No source/shared-doc/commit/merge/push/fullsuite/userpanel/profile/key/original task mutation. Preserve all
  artifacts/profiles/recordings; don't copy task answers into guidance. Two passing pairs required, not assumed.

## Work Ledger

### 2026-10-13 - Round 16: C passed build 1 and replay; D passed; B failed after an accepted trial

- Agent: Claude senior supervisor; debug workers.
- Preflight on pair Core 3ace826c / downstream 87f85e72 (t495-t498 added): matrix `{"passed":14}`; B, C and D dry runs
  `ready` with 0 provider calls.
- C qualification build 1 `run-mv6i27oi-a87fb247` passed $0.0974 (13/13 in order, 52/52 fields, 0 unexpected);
  replay `replay-mv6ih7r5-7f5958bb` passed (13/13, goal true, hash equal, all five zero).
- D confirming build `run-mv6i2akr-516b2f03` passed $0.0707; replay `replay-mv6ih7r5-188a0197` passed (4/4, goal true,
  hash equal, all five zero).
- B confirming build `run-mv6i28zl-a53d36db` failed $0.1936: trial 3 judged yes and the Flow was saved, but the oracle
  failed; the run went on to step 0225 (105 calls, 780 s) and ended on an unusable answer.
- Validation: spend-ledger finish lines; each run's `evaluation.json` read by the supervisor; replay receipts above.
- Debugs: C build 1 sound (no site band; every left-out row accounted for; no false yes); t498 worked live (one current
  script; the refused one superseded); t495 raised first-judge cache to about 9-10.6k tokens. Defects: on a double no Core
  forwards only the first judge's reading (`agreement.ts:63-79`); the receipt stops at a refused submit (`receipt.ts`);
  superseding rewrites early context (cache). D sound (9/9 facts; exploration pressed no Confirm), but its trial 1
  confirmed all 8 requests (hidden by the Lab reset); a `fields` refusal drops its issues. B: the saved Flow's store step
  recorded a chat card ("chat with us ×") as part of its effect, so playback on a site that already remembered the store
  never saw it hold; recovery knew the store was set but could only propose a refused retarget; the repair pressed a
  different store twice and stopped at its 64-call allowance. Not a false acceptance; t498 not involved.
- C qualification build 2 `run-mv6itasw-cca0dcc9` passed $0.0387 (13/13 in order, 52/52 fields, 0 unexpected); replay
  `replay-mv6j6kre-348e80f7` passed (13/13, goal true, hash equal, all five zero). C has two consecutive passing builds on
  pair 3ace826c / 87f85e72, each followed by a passing replay; its build 2 debug is in progress.
- Outcome: In progress. Decision (supervisor): C's build 2 launched on the C debug's verdict (no blocker) before B's debug
  returned; B's cause proved lane-specific (a recorded effect), not a regression on the pair.
- Follow-up: t499 page-raised layer names never count as a step's effect; t500 recovery takes the success edge when the
  result already holds, a repair never reverses a lasting state it did not set, a stalled repair round ends; t501 both
  readings on a double no, the receipt reports the latest accepted revision, supersession appended not rewritten;
  t502 a `fields` refusal names the read's columns and points to a fresh detection when the columns are stale.

### 2026-10-13 - t496 and t498 merged; round 16 prepared

- Agent: Claude senior supervisor; t496 and t498 workers.
- Changed: t496 a step's recorded effect leaves out names the page changed by itself (two captures of the same
  document, nothing sent between them, something appeared by itself); an effect that would become empty is kept;
  `run.ts` handle shaping moved to `node-run/handle-shape/` (800 to 756 lines). t498 an accepted submit carries its
  script, named current by revision and digest; a later refusal carries the current revision and is labelled
  refused and superseded; older submissions become `supersededBy` entries that change only when a new revision is
  accepted; `writeMode: replace` inside a repeat refused at completion and submit; the only-after refusal names its
  line and both fixes; trial reads say how paging ended. Supervisor choice: a refused script stays readable,
  labelled, until a newer revision is accepted, because its issues point at its lines.
- Validation: t496 domain llm-evidence, route-state and output-nodes "# pass 1286 / # fail 0", domain and extension
  tsc exit 0, audit exit 0 (the downstream finish first refused a Core worktree 2 commits behind Core dev; the
  supervisor moved it to dev; no Core change). t498 after the dev merge: Core flow-bootstrap, llm and candidate-trial
  "341 passed | 1 skipped" files, "3993 passed"; Core tsc and build exit 0; domain, extension and runner tsc exit 0;
  Core merge gated by `pnpm check`. Pushed Core `3ace826c`, downstream `87f85e72`.
- Outcome: Accepted.

### 2026-10-13 - t495 and t497 merged; t496 and t498 in progress

- Agent: Claude senior supervisor; t495-t498 workers.
- Changed: t495 the judge and result-check packet put the result summary (start view first) right after the policy
  gates and every per-trial id after it; "Testing revision N, which keeps" reads "Testing this version, which keeps".
  t497 a nearest column match whose names share a token while each keeps one the other does not answer is refused in
  conditions, record columns and fields (D round 15 rev 5, score 0.702), the refusal carrying `{code, field, valid}`
  through a new `extraction/slot-refusal.ts` built with `present()` (the supervisor moved it there: the audit refuses a
  conditional spread in the model's packet, and `resolve-plan-node.ts` is at its 800-line limit). Deferred: telling the
  model about a harmless accepted guess (Core change).
- Cause proved (t496): lane B's store step recorded a rotating hero-carousel button name as part of its effect; the
  click reloads the page to slide 0, so the effect check holds about one time in three on an unchanged page. Fix in
  progress: names that change between two captures with no act between them are left out of a recorded effect.
- Cause proved (t498): an accepted submit returns no script, and the only script left in context was the refused one,
  called "the script you just sent"; fix in progress (the accepted revision stays in context, a refused one is marked
  superseded; `writeMode: replace` in a repeat refused; the only-after refusal names the line; trials state how paging
  ended).
- Validation: t497 domain output-nodes and llm-evidence "# pass 1251 / # fail 0", domain tsc exit 0, audit exit 0;
  t495 Core llm and activity "226 passed (226)" files, "2214 passed", tsc exit 0, Core merge gated by `pnpm check`.
  Pushed Core `850f213e`, downstream `597540d3`.
- Outcome: Accepted (t495, t497).

### 2026-10-13 - Round 15: C, B and D all passed and replayed

- Agent: Claude senior supervisor; debug workers.
- Round 15 (pair Core b73717a8 / downstream dfbf6fa4, carrying t482-t494):
  - C qualification build 1 `run-mv6eq0m8-3fe9dc47` passed $0.0717 (13/13 in order, 52/52 fields, 0 unexpected);
    replay `replay-mv6f35nl-320c42de` passed (13/13, goal true, hash equal, all five zero).
  - B confirming build `run-mv6eq215-a986f1f3` passed $0.0756; replay `replay-mv6f0jyq-82829319` passed (goal true,
    hash equal, all five zero).
  - D confirming build `run-mv6ep5oy-05d5095c` passed $0.0709 under the stricter t492 oracle; replay
    `replay-mv6f1713-07253526` passed (4/4, goal true with the pending-request facts, hash equal, all five zero).
- Validation: spend-ledger finish lines; each run's `evaluation.json` verdict and oracle "passed" read by the
  supervisor (C extraction 13/13 by position, 52/52 fields); replay receipts quoted above.
- Debugs: C build 1 sound (13 oracle rows, no site band, each left-out row checked; a false yes in trial 2 blocked by
  the other judge and the naming guard); t489 live (page 2 called page 2, bare nextPage accepted). B pass confirmed (the
  single napkins product, 250 Count, for pickup; soap untouched); t491's close matches led the model off the 3-Pack
  decoy. D pass confirmed (9/9 final-state facts); no trial confirmed an unselected request, but exploration step 0027
  confirmed one (Tom Becker), which the Lab reset hid - a supervisor question for the user (exploration acts on items
  outside the request; touches the no-restrictions rule).
- C qualification build 2 `run-mv6ff44s-01def7f6` failed $0.0625: trial 1 unconfirmed, a later revision judged no,
  then three identical resubmits refused `flow_script.only_after_misplaced` ended on the repeat guard. C's count
  restarts. Debug dispatched.
- Outcome: Revised. B and D confirmed on the t482-t494 pair; C not yet qualified.
- Follow-up: t495 judge prefix (runId after the trial-identical startView) and "Testing, which keeps…" wording;
  t496 the satisfied-step effect check that flips no_match, no_match, holds on an unchanged page (every B round);
  t497 a loosely matched column name is refused or stated, never silently mapped (D rev 5).

### 2026-10-13 - t494 merged; round 15 launched

- Agent: Claude senior supervisor.
- Changed: t494 `lab replay` also checks a dataset-judged task's declared final state, as the created-Flow lane
  does (`saved-flow-replay/final-state-check.ts`); before it, D's replay reported goal null and would have passed an
  over-confirming Flow. The structure baseline was lowered where a violation was removed.
- Validation: runner tsc exit 0; `node --test` saved-flow-replay and guarded-browser "# pass 46 / # fail 0"; audit
  exit 0. Live: D's round-14 Flow replayed under the t492 oracle, before t494 `replay-mv6drba2-f7455fd6` (goal null)
  and after `replay-mv6emycm-5911a977` passed (4/4, goal true, hash equal, all five zero). Round-15 preflight on Core
  b73717a8: matrix `{"passed":14}`, B, C and D dry runs `ready` with 0 provider calls. Pushed downstream `dfbf6fa4`.
- Outcome: Accepted. Round 15 launched: C build 1 (qualification), B and D confirming builds.

### 2026-10-13 - t493 merged; round 15 prepared

- Agent: Claude senior supervisor; t493 worker.
- Changed: processing lists, per `where` condition of a saved answer, the rows it alone left out by label
  (`processing.conditions[].leftOutOnlyByThis`); the result summary, trial feedback, left-out guard and verdict
  treat them as a read's left-out rows, so a yes must name each one and why the request excludes it; the judge
  instruction says so (pins updated, no scenario words); a refuted Flow resubmitted with only its datasetId changed
  is answered `unchanged_after_no` (supervisor policy refining t485); `startView` serialises right after
  `schemaVersion`. Candidate builds do not reach the legacy build-test `stores.removed` path (left counts-only).
- Validation: supervisor after the dev merge: Core result-verification/service/flow-bootstrap/llm "506 passed |
  1 skipped" files, "5383 passed"; contracts record-sets "121 passed"; Core, domain, extension and runner
  typechecks exit 0; structure audit exit 0; Core merge gated by `pnpm check`. Pushed Core `b73717a8`, downstream
  `5ea7fc7a`.
- Outcome: Accepted.

### 2026-10-13 - t491 and t492 merged; t493 in progress

- Agent: Claude senior supervisor; t491-t493 workers.
- Changed: t491 the stall note says "submit" only when Core's acts record shows every act covered, else names
  untried routes (unused controls, other page-search words, back to a listing); `find_on_page` lists up to ten close
  matches after exact ones, each naming the query words it lacks. t492 run, subflow and node ids follow the
  instructions and policy gates in the judge/result-check packet; the confirm-requests oracle requires every
  unselected request still pending (server answers in non-rendered script elements, which the extension's page
  view, identity and extraction skip: `rendered-elements.ts:61`, `identity/record.ts:378`). Survey of oracles blind to
  an over-act: job-board apply-quillmark (and -check-first), company-website book-service and quote-request,
  everything-store buy-kettle, bigbox pickup-order (weak); photo-social moon-jar-price unclear.
- Validation: supervisor after dev merges: t491 Core llm "186 passed (186)" files, "1871 passed"; domain
  llm-evidence "# pass 1022"; t492 Core llm and recovery "238 passed (238)", "2459 passed"; social-network-feed
  scenario tests "# pass 28 / # fail 0"; typechecks exit 0; Core merges gated by `pnpm check`. Pushed Core
  `5d2e0652`, downstream `66ab0ae1`.
- Outcome: Accepted (t491, t492); t493 in progress.

### 2026-10-13 - Round 14: D passed and replayed; B stuck finding a product; C falsely accepted 10 of 13 rows

- Agent: Claude senior supervisor; debug workers.
- Preflight on pair Core b06a1d4b / downstream 3ddf7684: pre-t489 saved Flows still replay (B
  `replay-mv6atmam-424abbe6` passed, goal held; D `replay-mv6atlmu-c75e3ed9` passed 4/4; both hash equal, all five
  zero); B, C and D dry runs `ready` with 0 provider calls; matrix `{"passed":14}`.
- D confirming build `run-mv6bg8sv-99895ba1` passed $0.0388; replay `replay-mv6bn9k0-5b76077f` passed (4/4, hash
  equal, all five zero). Debug dispatched.
- B confirming build `run-mv6bg7ac-d24d91ce` failed $0.0523: the accepted revision's trial added the 3-Pack napkins
  for shipping; the model then repeated the same search from the same results page and the repeat guard refused it
  three times (`same_result`). Debug dispatched to test whether the page view showed the right product.
- C build 1 `run-mv6bg8d8-1a461436` failed $0.0716 as a false acceptance: Flow saved and the result check said
  passed, but the oracle got 10 of 13 rows (17 collected, 7 in order); the build used 537.9 s of 540 s. Debug
  dispatched.
- Validation: spend-ledger finish lines; replay receipts and C's `evaluation.json` extraction quoted above.
- Debugs (lane trees):
  - B: the page view showed the right napkins whole (a "100 Count | Options" tile with a "250 Count" size chip);
    the model chose a 3-Pack whose title held the exact name; Core's no-progress note said "submit" while the model
    still needed the right pack (`stall-redirect.ts:193`); `find_on_page` matched only literal substrings. Not
    element detection.
  - D: pass confirmed (4/4, 8/8, four Confirms each once, no undo); t485 learned an 8.1 s pace; t489 columns agreed;
    decisions 86.2% cached. Found: trial 1 confirmed all 8 requests and the oracle could not see it (D6); the judge's
    per-trial ids sat early in its request (36% of cost).
  - C: a `recordOutput.process.where` (name not contains "Charging Case") dropped 3 correct rows; judges saw only
    `filteredOut: 5`; the left-out guard read only the read's own conditions. Time played no part (build 281 s;
    537.9 s was the whole Lab run). A datasetId-only change gave a refuted Flow a second trial.
- Outcome: Revised. Fixes t491 (stall note, near matches), t492 (judge prefix, over-act oracle), t493 (processed-out rows).

### 2026-10-13 - t489 and t490 merged; the second sweep; round 14 prepared

- Agent: Claude senior supervisor; t489 and t490 workers.
- Changed: t489 one domain function (`output-nodes/extract-list/stored-columns.ts`) decides a record output's stored
  columns for submit and dispatch; a name no read column matches is refused at submit as
  `{code, field, valid}` (Core accepts `issues` on a refused plan-node answer: at most 16, identifier names, 64
  valid names); dispatch issues use the same shape; trial feedback passes a failed step's own issues; plan
  validation names the unknown field; the script guidance no longer invites narrowing with a site's controls first
  (the completion-schema ratchet raised 6,100 to 6,500 for the 328-byte corrected sentence, now cached since
  t484); checked rows match on full identity; each handle code has its own words. Supervisor sign-off: a refusal may
  name the model's field and the read's column keys, never cell values or page text. t490 the candidate facade
  test's second revision changes a step for real (t485 rightly answers a rename-only resubmit as unchanged).
- Validation: second sweep on Core 8ecf5ae6 / downstream 5ff78194: Core build 0, downstream check 0, build 0,
  downstream `pnpm test` exit 0 (extension "# pass 2932", runner "# pass 2255", domain "# pass 1884", scenario-lab
  "# pass 697"); Core `pnpm test` "Tests 4 failed | 10545 passed" (all four in candidate-generation.test.ts, fixed
  by t490: "Test Files 24 passed (24)", "125 passed"). t489 after dev merges: Core service/flow-bootstrap/
  result-verification/llm/activity "543 passed | 1 skipped" files, "5696 passed"; domain output-nodes and
  llm-evidence "# pass 1242 / # fail 0"; domain, extension and Core typechecks exit 0; Core merges gated by
  `pnpm check`. Pushed Core `b06a1d4b`, downstream `3ddf7684`.
- Outcome: Accepted.

### 2026-10-13 - Round 13: C passed build 1; B and D failed on t486 and t485 changes; t488 reverts t486's submit check

- Agent: Claude senior supervisor; debug workers.
- Round 13 (pair Core 32e8aa24 / downstream 3ed9a639; matrix `{"passed":14}`; B, C and D dry runs `ready` with
  0 provider calls, after the Lab refused stale Core builds in all four trees and each was rebuilt):
  - C build 1 `run-mv66s8yl-fbbfa221` passed $0.0501 (first C pass since t482; debug dispatched).
  - B confirming build `run-mv66samo-b5e6d5e8` failed $0.0187: submit refused step 12 "open the napkins product"
    as `bootstrap.handle.other_page`, a false positive of t486's submit check. Step 11 types a search with
    submit:true, which moves the browser to the results page that printed t1247, but the check took the page from
    both neighbours' handles (printed on the towels product page, the same location without its query) and
    assumed the step runs there. The repeat guard then refused the unchanged resubmits; no Flow.
  - D confirming build `run-mv66sc3c-c47e74b8` failed $0.0243 on a contract defect older than round 12, not
    t485 (the supervisor's first guess was wrong): submit checks `recordOutput` as written, while
    `extract-list/dispatch.ts` swaps its schema for the read's raw detector keys, so revisions 4, 7 and 8 passed
    submit, confirmed all 8 requests and failed the last read `process_unknown_field` (not retryable); trial feedback
    said only "The step names a node that cannot run"; raw keys were refused at submit; identical resubmits ended on
    the repeat guard. Round 12 passed only because that model wrote its columns inside `extractList.fields`. Debug
    in t275. Fix t489.
  - Debugs: B (t262) confirms the false positive (the pages differed in path, not query); cache hits 84.8% (58.4%
    in round 12), the per-token rate halved. C (t451) confirms 13/13 by position and 52/52 fields; the Flow pressed
    no site filter (all narrowing in the read's `where`), so t482's rule is unproven live. Found: page 2 read as
    "page 1"; Core guidance `flow-script-format.ts:190` invites narrowing with site controls first; a row check
    matching by name prefix (`request-rows/checked-rows.ts`); one wording for every handle code (`issue-words.ts`).
- Changed: t488 reverts the submit-time check (plan-parameter-resolution.ts, submission-refusal.ts and their tests
  restored to 1cf31ed3); the run-time refusal of a handle from another page stays.
- Validation: t488 Core harness-options/candidate/harness/step-loop "61 passed (61)" files, "478 passed", tsc exit
  0, Core merge gated by `pnpm check` passed; pushed Core `8ecf5ae6` (downstream unchanged at `4ecccbcb`).
- Outcome: In progress. Decision (supervisor): C's round-13 pass does not count toward qualification, because the
  pair changes with t488 and t489; round 14 restarts C's count on the next pair.
- Follow-up: t489 one domain function decides a record output's stored columns for both submit and dispatch,
  unknown names refused at submit with the read's columns listed, a read says which page it read, a bare
  `extraction.N` for `nextPage`; Core trial feedback carries the node's own issues, validation names the unknown
  field, guidance stops inviting site-control narrowing, row identity not by name prefix, true words per handle code.

### 2026-10-13 - t482-t487 merged; round 13 prepared

- Agent: Claude senior supervisor; t482-t487 workers.
- Changed:
  - t482 each read's result summary lists `narrowedBefore` (the steps that acted on the page before it), and the
    judge refuses a step whose words keep less than the request asks; the supervisor narrowed its category clause to
    "a category, option or value the request does not name that can leave out items the request asks for". Acted-on
    rows keep their content; plain read-condition and record-set wording.
  - t483 `lab replay` starts through `launchExtensionSession` (one-time relaunch, worker proofs, start trace), keeps
    start-failure details, probes the profile lock; a rejected trial records a verdict.
  - t484 the output schema leads the request and route state is only appended. A replaced page view's swap for a
    reference is deliberate (it removes ~3.9M characters for ~1.17M re-billed in 1,161 decision pairs) and stays.
  - t485 pace learned from refusals at each refusal's own time (no structured stated-limit source reaches Core);
    `candidate.trial_slow_down_unhandled` until a learned pace and a wait or way-out branch are saved; label-only
    resubmits answered unchanged (supervisor policy: `recordOutput.datasetId` is not a label).
  - t486 a node run refuses a handle from another page as `web.handle.stale`; submit refuses
    `bootstrap.handle.other_page` (candidate sentence quotes only handles; the plan-path code stays out of
    `AUTHORED_CODES`, because its message quotes locations); `handle_not_a_field` for type/clear into a non-field;
    dotted read fields read or refused; covers named; a step with its own recorded effect checks the page before a
    retry handler; a skipped step reaches the result check as `acted: false` with `satisfiedByState`.
  - t487 skipped-step cards, unchanged-resubmit narration, a step counter that never runs back, word-boundary wrap.
- Validation: supervisor after each dev merge into the task branch: t482 Core llm/result-verification/candidate-trial
  "254 passed (254)" files, "2490 passed"; t483 runner "# pass 43 / # fail 0" and creation "# pass 167"; live
  `replay-mv648lac-beafbfd2` through the new path passed (4/4, hash equal, all five zero, start trace written);
  matrix on t483 `{"passed":14}`; t484 "214 passed (214)", "2023 passed"; t485 "262 passed | 1 skipped",
  "3093 passed"; t487 Core "164 passed (164)", "1534 passed", extension "# pass 383 / # fail 0"; t486 Core
  "332 passed | 1 skipped", "3656 passed", domain "# pass 1010", extension "# pass 542"; every typecheck exit 0;
  each Core merge gated by `pnpm check` passed. Pushed Core `32e8aa24`, downstream `3ed9a639`.
- Outcome: Accepted.
- Open: the effect check answered "not on the page" twice on an unchanged page in B's playback (suspected rotating
  banner; playback keeps no routing reason or effect hashes); `overlays.ts:68-75` registers a pinned bar as a
  blocker covering 0 controls; Core has no submission advice for `web.handle.not_a_field`; the slow-down gate checks
  a wait branch's shape, not its duration; C's bare `nextPage` handle and page 2 re-read as "page 1";
  `decision-context/supersede.ts` re-bills ~200k characters; a label-derived datasetId still costs a trial.

### 2026-10-13 - Round 12: B and D passed both builds and every replay; C failed build 1; t482-t487

- Agent: Claude senior supervisor; t478-t481 workers; debug workers.
- Changed: t478-t480 as the round 11 follow-up says; t481 pinned the in-run repair test's clock to off-peak (the
  sweep's two Core failures were DeepSeek peak pricing, not product behaviour).
- Round 12 (pair downstream f2d100a6 / Core f2e6b076; matrix all 14 passed; B, C and D dry runs `ready` with 0
  provider calls):
  - B build 1 `run-mv62icw0-2be384b4` passed $0.1062; replay `replay-mv62t56y-c4714401` passed (goal held, hash
    equal, all five zero).
  - D build 1 `run-mv62icw0-070f88ad` passed $0.0783; replay `replay-mv62rwy7-fcb23be8` never ran the Flow: the
    extension's service worker did not appear within 30 s (`extension.worker`), and the receipt dropped the failure's
    details. A Lab defect is being traced (`reports/replay-worker-timeout.md`). The rerun with the lane's instance,
    `replay-mv62zkqz-aa2333d2`, passed (expected dataset 4/4 matched, hash equal, all five zero). A first rerun was
    a supervisor launch error (no `FLUXIQ_LAB_INSTANCE`, refused before any browser).
  - C build 1 `run-mv62icw3-9118516f` failed $0.1696 (debug in t451): for "under $50" the script added a
    "$25 to $50" site filter, so the two qualifying $22.99 rows never reached the read (11 of 13 stored), and both
    trial judges and the final check said yes while naming that filter. Same shape as round 10 build 2. A Core
    result-verification defect: a narrowing step that moved the page leaves no step-change record, and the judge
    instruction never rules on narrowing beyond the request. Fix t482.
  - B and D build 1 debugs: both passes clean (no pre-existing item touched, no undo, trials from the reset start).
    Waste and defects: a cross-page handle retried 25.5 s; typing into a span passed submit; a satisfied step
    retried 13.2 s; a 28.8k-character output schema placed after the evidence window (~50% of D's cost); a
    route-state entry inserted mid-window; a pace learned from one hinted wait; no wait/dismiss branch saved after a
    rate-limit refusal (the user's interruption rule); empty rowsActedOn rows; chat wording faults.
  - B build 2 `run-mv636xvb-e1426db1` passed $0.1446; replay `replay-mv63ibwy-54a01533` passed (goal held, hash
    equal, all five zero). D build 2 `run-mv636xyp-2e4fe54d` passed $0.0853; replay `replay-mv63ibwz-b6e01917`
    passed (4/4, hash equal, all five zero). Both lanes have two consecutive passing builds on one frozen pair, each
    followed by a passing model-free replay.
  - Build 2 debugs (lane trees, run-mv636xvb and run-mv636xyp) confirm both passes. B: all 5 oracle facts, the
    soap untouched in both trials, playback and the oracle, no undo, both trials from the reset start; caveat: the
    saved quantity step presses the napkins page's "+" handle on the towels page and works only because the "+"
    identity is positional (submit accepted a cross-page handle; t486). D: 4/4 records and 8/8 fields in order,
    `atLeast 5`, each Confirm effective once, no undo. New: label-only resubmits trialled as revisions (N1, t485);
    a "text is absent" condition wording the judges called fragile (N3, t482); an unnamed covering element (N5,
    t486); a false "it was refused" narration of an unchanged resubmission (t487); a rejected trial recorded with
    `verdict: null` by the Lab (t483).
  - **B and D qualified** on pair f2d100a6 / f2e6b076 (lane A qualified in round 3). C remains.
- Validation: `git rev-parse --short origin/dev` gives f2d100a6 here and f2e6b076 in Core; matrix receipt
  `{"passed":14}`; spend-ledger finish lines; replay receipts from the supervisor's logs.
- Outcome: B and D accepted as qualified; C in progress. Decision (supervisor): the fixes the round found were dispatched only after B's and D's
  second builds launched, and none merges until those builds' debugs close, so the pair stayed frozen.
- Follow-up: t482 judges refuse over-narrowing and get rowsActedOn content; t483 `lab replay` through
  `launchExtensionSession` with failure details kept; t484 byte-stable request prefix and appended route state;
  t485 pace from the stated limit and an interruption branch before "Complete now"; t486 cross-page handle refused,
  non-editable type refused at submit, dotted read fields, a satisfied step routed by state; t487 chat wording.
  Still open: C's bare `nextPage` handle and re-reading page 2 as "page 1" (10 decisions, $0.058).

### 2026-10-13 - Round 11: B and C passed build 1 and its replay; D's filter missed a row; t478-t480

- Agent: Claude senior supervisor; debug workers; t478-t480 workers.
- Round 11 (pair downstream bbffa860 / Core 0371884c; matrix all 14 passed; dry runs ready, fixture reset on):
  - B build 1 `run-mv5yaapd-ad19eaae` passed $0.0961 (first B pass since round 7); replay
    `replay-mv5yofwd-b23216e5` passed (goal held, hash equal, all five zero). Safety: the reset gate's undo still
    removed the pre-existing dish soap once (0066): two missing row tokens compared equal (`site-reset/ledger.ts:170`),
    and the gate asked although the start hook had reset the site; the fixture reset restored it.
  - C build 1 `run-mv5yaapy-8c34bf34` passed $0.0803 (13/13 rows in order, 365 s); replay `replay-mv5ypd5y-74061ea8`
    passed (13 records, all five zero). Waste: two page snapshots per web step (~25 s of each 58 s trial), t477's
    post-trial view breaks the provider cache once per trial, wording faults.
  - D build 1 `run-mv5yaapw-6d20d23d` failed $0.0487: the Flow filtered with a digit regex and left out "Aisha Khan and
    4 other mutual friends" (5); the `where` rules live only in the detect tool's description, withdrawn after repeated
    detects; three judges said yes with the row in front of them.
- Validation: replay receipts quoted above; full debugs in the lane trees (run-mv5yaapd, run-mv5yaapy, run-mv5yaapw).
- Outcome: Revised. Decision (supervisor, the user's rule: never launch with a known fix in flight): B's and C's
  second builds wait; B, C and D qualify together on the pair carrying t478-t480.
- Follow-up: t478 condition rules always offered with the script; a yes refused over a left-out row whose number the
  condition kept; t479 (safety) unasked removal only on a positive identity match, never missing == missing, and no
  undo request after the start hook reset; t480 one snapshot per web step, the post-trial view keeps the cache, true
  chat wording, the stray post-run run.

### 2026-10-12 - t475-t477 merged; round 11 prepared

- Agent: Claude senior supervisor; t475-t477 workers.
- Changed: t475 an undo acts only on its act's own row/dialog (hashed tokens) or an item the act provably created,
  anything else refused unpressed (`candidate.undo_wrong_target`); acts recorded only when their effect appeared;
  refused undos keep the act as `startedWith.cannotUndo` at once; the Lab start hook runs before the start check;
  focus and self-changing lines ignored; row-bound steps list the rows they acted on. t476 a woken press under a
  timed cover is pressed again once; a lasting step whose recorded effect never appeared fails
  `core.step.effect_not_seen` (not retried). t477 a candidate-build stall retests the latest revision instead of
  ending; refused looks go to the repeat guard; a stale-handle refusal carries the fresh page and handle; a fresh view
  after each trial; both readings of a split judgement reach the model.
- Validation: supervisor, each after merging dev: t476 Core "113 files, 993 tests", domain 129/129, extension
  275/275, headed press-answers 6 passed; t477 Core "504 files, 5328 tests", domain 376/376; t475 Core "418 files,
  4653 tests", domain 535/535; every typecheck exit 0; Core merges gated by `pnpm check`. Pushed: Core `0371884c`,
  downstream `bbffa860`.
- Outcome: Accepted.
- Open (product, not Lab): on a real site without a start hook, an add whose new item appears on another page (a cart
  line after a product-page Add to cart) cannot yet be proven to be the build's, so t475 keeps it as startedWith
  instead of removing it; the user's reset rule needs the build to record every page an act's effect lands on at the
  start, then remove only the line absent at start. Also: the stall retest checks only the call budget, not time or
  cost left; false `effect_not_seen` on looped steps or transient toasts unmeasured.

### 2026-10-12 - Round 10: C and D passed build 1 and its replay, then failed build 2; B failed; t475-t477

- Agent: Claude senior supervisor; debug workers; t475-t477 workers.
- Round 10 (pair downstream 4ed544f2 / Core 93949d68; matrix all 14 passed; dry runs ready, $0.25,
  `fixtureResetBetweenTrials:true`):
  - D build 1 `run-mv5tusge-1400ddf7` passed $0.0518 (4/4 records, 8/8 fields; no Confirm pressed twice; playback
    refused a look-alike in another dialog); replay `replay-mv5u87p9-9b71bec5` passed (hash equal, all five zero).
    D build 2 `run-mv5upw4g-2482be12` failed $0.0309: the reset gate (before the Lab's fixture reset) demanded undoing
    two confirms that cannot be reversed; the model pressed other requests' Delete under `undoes`; the gate refused;
    three repeat refusals ended the build.
  - C build 1 `run-mv5tusi6-0813f12a` passed $0.1077 (13/13 rows in order, 367 s of 540 s); replay
    `replay-mv5ua5x5-7b50c94d` passed (13 records, all five zero). C build 2 `run-mv5uu9g1-9d80deea` failed $0.0369:
    Core's look counter ended the build at 114 s while a correct revision had 2 retests and 7 minutes left (only the
    "no" of a split judgement reached the model, a stale handle's refusal named no fresh one).
  - B build 1 `run-mv5tusj4-b7ee0630` failed $0.1634: the site's first Add to cart only wakes the page and a timed
    support card covering the button was taken as the press's answer (click.ts:183-185). Safety: the build's reset
    removed the pre-existing dish soap twice without asking (ledger.ts:119, :195-201, :213-221); the Lab's fixture
    reset hid it.
- Validation: supervisor-read step indexes and core logs for each; replay receipts quoted above; full debugs in the
  lane trees (run-mv5tusge, run-mv5upw4g, run-mv5tusi6, run-mv5uu9g1, run-mv5tusj4).
- Outcome: Revised. No lane qualified on this pair; qualification restarts on the pair carrying t475-t477.
- Follow-up: t475 (safety first) undo only on the act's own item and only for an act whose effect appeared,
  irreversible acts kept as startedWith at the first refusal, focus/live noise ignored, Lab start hook before the
  start check, each step's own rows for the judge; t476 a woken press under a timed cover is pressed again, a step
  whose declared effect never appeared is not done; t477 a stall retests instead of ending, fresh handle and view after
  a trial, both readings of a split judgement. Later: C's cache misses from evidence rewrites (context-window.ts),
  chat wording ("Testing, which relaxes", "wasn't seen on the page"), the bare nextPage handle refusal.

Earlier entries, from 2026-10-11 to the t471-t474 merge (rounds four to ten) are in
[the ledger archive](./live-testing-handoff-audit-2026-10-11/archive/2026-10-13-ledger-rounds-4-to-10.md).

## Open Questions

- Supervisor: do B/C/D qualify on the integrated source pair? Fresh live identity/oracle/accounting/replay review remains required.
- Supervisor: what causes B's independent recording-persistence backlog? Measure the actual append/finalization path before adopting storage WIP.
- Supervisor: does D's proposed adaptation hold preserve mandatory saved interruption behavior? Review before implementation.
- User, later release phase: identify the unfamiliar user for final acceptance; no answer needed for immediate recovery.
