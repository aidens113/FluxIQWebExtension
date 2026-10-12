# Live Testing Handoff Audit — 2026-10-11

Status: Active
Status detail: A historically qualified; B round5 first creation/replay passed; round6 B/C/D failed, t458 processing help preparing, t454 recording compatibility gates underway.
Created: 2026-10-11
Last updated: 2026-10-11
Owner: Codex senior supervisor
Scope: Reconcile Claude's live testing, saved run verdicts, lane worktrees and working notes, and provide an executable continuation plan.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/mvp-final-month-plan.md
Related: [MVP plan](./mvp-final-month-plan.md), [recovery plan](./state-aware-recovery-plan.md), [working index](./README.md)

## Current State

**Resume from this execution document.** The MVP and recovery summaries have now been reconciled; recovered
lane evidence and C/B source changes are committed. All dates here use Los Angeles;
the latest runs' October 12 UTC timestamps are October 11 locally.

**Execution now authorized (user: "ok go").** A-review, B-debug and C-validation assigned below on existing lane
branches/worktrees. Supervisor handles D diagnosis, independently verifies results and integrates coherent units.
Prior audit limits below describe audit-only work; subsequent execution validation is recorded in the ledger.

**Latest budget authorization (user, October 11): $0.25 per test instead of $0.10.** Subsequent live tests set
`FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25` in the launch process environment and verify the whole-Flow purse in
the ready preflight. CLI cost flags alone cannot raise the configured Core ceiling. Historical runs and earlier
briefs below retain their actual $0.10 amounts; the new authorization supersedes their future-launch ceiling.
No provider output cap, guard override or ordinary user-product default change is implied.

**New evidence during execution:** A's gate is now supervisor-verified: both creation passes and separate
replays `replay-mv4kt6g0-4e4900a8` / `replay-mv4kv3z1-2cfab70c` passed, exact stored Flow hashes unchanged,
all model/provider/intervention/harness counters zero, model wiring disabled and independent goal held.
Candidate-default task t450 is integrated. B never tested an accepted revision and ran out of cost budget;
the last-decision wrap-up offered no tools. D trials 2-4 ran all displayed steps successfully but Core ended
failed because its terminal node left unvisited graph nodes; trial feedback omitted this graph-level reason.
C/B finishing changes are integrated as t274. D fix t449 and candidate-default t450 are independently
verified and integrated downstream first/Core second. t452 feedback/category/UI and t453 generic judge
guidance are now independently verified and integrated: Core 3291fb25/downstream 2fa74682 before notes.
Round-five used that frozen product pair with rebuilt running identities. All attempts now ended;
the outcomes below supersede launch preparation. Scoped source repairs stay isolated until supervisor gates.

**Storage follow-up:** t381 introduces a competing connection owner and does not directly fix recording
append; its WIP remains unmerged in Core. A dist-backed probe now finds a distinct recording defect: model
timeline sequence starts at zero, typed event storage requires positive sequence, first append falls back to
file while later appends go to SQL, finalize does not backfill a nonempty SQL stream, restart reads only the
stale fallback. Supervisor independently reproduced the 31 SQL / 1 file / 1 reopened entry loss. t454 owns
the focused sequence/read-owner repair and legacy split-state tests, without adopting the pool WIP.
t380's narrow fixture
checks are supervisor-verified: 45/45 including actual-built process probes, current typecheck/build/audit and
baseline refresh lowering only two counts. Integrated downstream first/Core second after all active runs ended;
t380's integration and earlier notes are pushed; later t452/t453 heads are listed above.

**Audit intake snapshot (historical).** Downstream dev `6e07993f`, Core dev `01621c94`; both equalled their locally stored
`origin/dev` refs (no remote fetch performed). Core main checkout clean; downstream has a pre-existing edit to
`.clinerules/fluxiq.md`, preserved. No matching FluxIQ/fxwork/fxlab node process found in the process query.
Slot ownership files exist; ownership files alone do not mean a run is alive. No processes were stopped.

**Verified from saved bundles, not fresh browser tests:**

| Proof | Saved verdict | Cost | Interpretation |
| --- | --- | --- | --- |
| R4a `run-mv4dcf2j-cb68009a` | passed | $0.03652 | Creation and fresh-page replay passed |
| R4b `run-mv4itxkr-163e04a8` | passed | $0.02885 | In-run repair and deterministic repair replay passed |
| A round 3 #1 `run-mv4jihmm-af72a1e1` | passed | $0.03038 | Chat/candidate, runtime succeeded, oracle passed, 0 replay harness activations |
| A round 3 #2 `run-mv4jvo7k-612f0bbb` | passed | $0.04783 | Same saved success fields; report still incorrectly says running |
| B round 3 `run-mv4jqkko-bc9a05c6` | failed | $0.09192 | Stopped at build, `lab.chat_build_failed`; root cause not yet established by this audit |
| D round 3 `run-mv4jjsvj-25b4dc2a` | failed | $0.09410 | Stopped at build, `lab.chat_build_failed`; root cause not yet established by this audit |

Evidence root: `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/<run-id>/`.
Each listed verdict agrees across `entry.json`, `summary.json` and `evaluation.json`.
A's `snapshots/flow-lane.json` confirms chat entry, candidate mode, successful runtime, oracle and no harness.
Its lead report states the same product fingerprint for both runs. Treat A as a **qualification candidate**:
finish run #2's full debug and inspect running identities/provider accounting before signing the gate.

**Unfinished work:** C has 2 modified downstream files and 7 changed/untracked Core files, plus reports;
B, D and A have untracked reports/debugs. t380 and t381 remain unmerged. Many other retained task branches
have zero commits ahead of dev and are not unfinished implementation merely because their worktrees exist.
The UI review and production-integrity tasks t334/t335/t337 remain parked, not part of immediate lane recovery.

The preceding dirty-file inventory is the audit intake: C is now integrated, A/B notes preserved and merged,
while their lane workspaces remain intact for further live work. No profiles or run evidence were reclaimed.

**Next:** t456 numeric tool accuracy, t455 guarded browser recovery and t457 handler feedback are integrated.
Round-six ran all three lanes on Core190d7bda/downstream921f0296; all attempts ended and the freeze is released.
Startup completed with all four running identities verified for each. B failed its saved quantity/cart oracle
($0.044999439); two trial adds had confirmations, but saved first add had no effect and final judge invented
its confirmation. C/D stopped at48build calls plus initialchat1 ($0.09098706/$0.068919444), not the cash ceiling;
six C/five D trials remained negative or unconfirmed. Total round-six cost$0.204905943, no balance failure.
No second creations/replays or unchanged relaunches. C full86step and D full88step audits are complete;
B full62step audit and provider-free first-click/no-effect fixture probe are complete. Fresh terminal captures
are not stale caches: current hidden cart facts are omitted by default rendered-only observation.
Gate t458 supported record-processing help; assess optional passive result-observation seam from B report.
Resolve t454 no-packet undo compatibility before accepting its measured durable recording index. Then qualify B/C/D on a newly frozen
pair with the verified $0.25 test ceiling. Do not advance dev during a live streak. Round-four source was Core
b27c0d64/downstream d1e516e6 (lane documentation commits differed); all three attempts failed their end-to-end
gates. Each creation requires full debug and separate zero-model replay before another launch; failure requires
changed source. t380 is now integrated; recording-persistence measurement, three-site adaptation, breadth/UX
and release work remain after qualification.

Round-five outcome: all ready preflights independently inspected (calls0, unchanged tasks, candidate/reset true, both ceilings0.25). B first run-mv4p5ly4-d02b5ca9 passed exact oracle at$0.120890772 and separate replay-mv4pl732-186afe0a passed unchanged hash/all5counters0; supervisor verified both. Second B run-mv4pp84i-66db9b20 failed build at$0.110844924, full worker debug underway, so no B qualification. D run-mv4p5hjj-1ef25535 failed exact cohort3of4 at$0.080175204 despite runtime/three judges yes; all57steps debugged, numeric parser itself correct but author chose regex. C run-mv4p3qri-4c59c2ff failed extension.worker before chat/calls (cost0); full available debug/screenshot reviewed. CDP saw a live worker while Playwright readiness saw0; no crash. All attempts ended; the Core3291fb25/downstream e836e611 streak is over. No unchanged paid relaunch. Startup t455 and recording t454 remain isolated; recording-index refinement measures and removes per-append history rereads without pool WIP.

**Audit-only limits (historical):** initial intake made no source edits/provider calls or panel changes.
Subsequent authorized source checks/builds/live results are recorded above and in the execution ledger.

## Audit Findings

### Worker brief: supported record-output processing help

- B-debug, paired task t458 (`fxwork/t458/!FluxIQWebExtension` and `!FluxIQ`), after completed C audit.
- Read own C round-six analysis and Core plan/record-output-contract.ts plus contracts/record-sets/parse-output.ts
  and process/parse-processing.ts and direct helper types. Core authoring help omits supported process entirely.
- Own Core record-output-contract.ts, its plan/tests/record-output-contract.test.ts (new if absent) and one
  focused early-refusal delivery test in the owning llm/harness-options/tests folder if required. Own only
  downstream reports/record-output-help.md; supervisor owns architecture/shared docs.
- Fail first on full+condensed published format and actual early rejection feedback omitting supported process.
  Synchronize help with actual parser-supported dedupe/where/sort/limit/columns/minRows, including dedupe.by.
  Invalid unique/unknown processing keys still refuse; no parser, accepted schema or runtime change.
- Use neutral fields/domain examples unrelated to any realistic fixture task or answer. Do not expose page
  bodies, copy scenario predicates/counts, enlarge provider output, or add prompt-only claims of passing semantics.
- If current delivered system-prompt pins change, expand only to their owning generation script/affected fixtures
  and adjacent pin test; report exact changes and verify unrelated fixtures unchanged. Never hand-edit generated pins.
- Validate owner tests, initial/static refusal delivery, cache-free Core types, fresh owner build and audits/
  whitespace. No whole suite, baseline increase, paid/browser launches, user panel, commits/merges/pushes.
- Report exact source paths and neutral fail-first/current results; existing source failures stay rejected.

### Worker brief: judge evidence freshness

- A-review, after B full debug/probe; bounded read-only t262 Core/downstream source investigation.
- Own new reports/judge-evidence-freshness.md only. Read B round-six debug/probe and actual three judge
  request artifacts; identify where trial/final verification evidence is collected, refreshed and bounded.
- Trace generic Core result-verification through the downstream runtime/evidence adapter; partition source
  responsibility accurately. Do not teach scenario names/counts or copy page bodies into the report.
- Prove why accepted judge requests held stale totals; distinguish stale recorded pre-action state, stale tool
  cache, intentionally selected evidence, model inference error and unavailable browser state.
- Assess whether fresh terminal state already exists but is omitted, versus an absent registered fresh-read
  seam. Propose the narrow owner repair and neutral fail-first probe, if evidence supports one.
- Do not blindly repeat lasting acts, alter fixture/oracle, assume click hit-test proves effect, invent independent
  deterministic goal understanding, change product/source/shared docs, launch paid/browser/Core/panel tasks,
  commit or push. Return exact owners, compatibility effects and what remains unproven.

### Worker brief: C round-six build debug

- B-debug after completing D round-six report; read-only current t451 paired lane and external run
  run-mv4rny8v-dde7ddf8. Root owns C live report/per-run debug; worker owns only reports/c-round6-debug-analysis.md.
- Read every86saved step/call/result/decision/judge and UI metadata; use screenshot viewing where needed.
- Trace six trials and their exact revisions/digests, full goal evidence and raw matcher/processor choices;
  distinguish omitted/misread records from unsupported keys/static feedback, truncation and stale evidence.
- Reconcile49observedcalls (initialchat plus48build), $0.09098706 actual cost, original task/oracle and all4identities.
  Root already inspected actual receipts and ending failure-panel image; no promotion/runtime/replay exists.
- Establish terminal evidence_iteration_limit from actual sealed records and whether final corrected candidate
  still failed judgement. No causal claim that merely increasing cash or call count would have passed.
- Identify generic owner root causes supported by actual artifacts, with precise source paths/neutral probes;
  no scenario teaching/examples, page-body exposure, source/shared-doc edits, provider/browser launches,
  user-panel management, commits or pushes. Record limitations honestly and return when finished.

### Worker brief: B click effect observation

- A-review, existing t262 paired lane, after full round-six failed-run debug.
- Read own full round-six debug and built bigbox shell/product/add-to-lines owners only.
- Own new reports/click-effect-observation.md and ignored probe/evidence; no product/shared-document edits.
- Reproduce compiled realistic fixture first-two-click quantity/count effects with an isolated owned browser;
  report whether first click is ineffective. Prefer actual extension control if available without changing guards.
- Provider0, no Core/user-panel management, no source/dev change, no repeated paid launch. Preserve originals.
- Distinguish fixture mechanism proof from extension action cause, hit-test success from observed lasting effect,
  and stale judge evidence from model misjudgement of correctly supplied quantity evidence.
- Record browser/build/page provenance, exact safe deltas, limits, failure and original run links; no page bodies,
  secrets, scenario teaching, weaker assertions, fixture/oracle edits, commits or pushes.

### Round-six live briefs: frozen candidate pair, recording repair isolated

- Supervisor freezes the integrated t455/t456/t457 product pair; t454 stays isolated and cannot advance dev
  until all active lane streaks end. Source-equivalent documentation merges do not change qualification.
- A-review owns lane B in existing paired t262 trees, slot3/instance t262-slot-3/workspace t262-b; same original
  bigbox-retail task/oracle, own new live-b-round6.md, lane-b-round6.md and per-run debug files only.
- B-debug owns lane D in existing paired t275 trees, slot4/instance t275-slot-4/workspace t275-d; same original
  social-network-feed task/oracle, own new live-d-round6.md, lane-d-round6.md and per-run debug files only.
- Supervisor owns C in paired t451 trees, slot1/instance t451-slot-1/workspace t451-c; unchanged everything-store
  task, structured loop and independent13record/52field oracle; own live-c-round6.md and per-run debugs.
- Each lane merges current dev in both idle repositories, rebuilds owning Core libraries, sets launch-process
  FLUXIQ_LLM_RUN_COST_CEILING_USD=0.25, and runs zero-call ready preflight. Send actual ceiling/candidate/reset/
  task digest/source pair and expected-identity validation evidence for supervisor review BEFORE paid launch.
- Root explicitly clears one original headed extension-chat creation after ready review. Existing automatic
  four running-identity gates precede model dispatch; immediately send all four actual receipts to root.
- Full every-step/call/result/UI/oracle/accounting debug follows each attempt; no truncated-result success.
  Separate disabled-provider replay must preserve exact project/Flow/hash and all5counters0 before second.
- Second creation requires root independent first creation/replay verification. Same frozen source required.
  Stop on failure until full debug and changed relevant source; balance error stops all paid lanes immediately.
- No new scenario teaching/oracle edits, direct API shortcuts, source changes, profile reset, guard override,
  user panel management, commits or pushes by workers. Record cost and limits honestly; D outcome success
  alone does not prove persisted interruption adaptation. Retain all original profiles and run evidence.

**t454 independent review gate (October 11, pending reproduction):** Source review identified late append after
typed finalization, delayed counter publication overwriting a newer header, cached-prefix resurrection after
external removal, and same-service removal retry after a late metadata failure. These are source-supported
risks, not observed failures yet. Do not integrate the recording repair until bounded fail-first probes establish
the results and any required repairs pass current owner tests and fresh-process restart checks.

### Worker brief: recording concurrency and removal recovery

- Owner: C-validation; task t454, paired worktrees under `fxwork/t454/`.
- Begin only after A-review returns its read-only report; owner files then belong exclusively to this worker.
- Read `reports/recording-index-review.md`, current recording repair report and this Current State.
- Own the existing t454 recording-stream store/projection/schema and runtime recording store/service paths,
  their owner tests, and only `reports/recording-stream-owner.md` downstream. No shared working-document edits.
- Reproduce the four reported interleavings using actual typed storage/service boundaries and controlled gates;
  preserve failing assertions before changing code. Include competing append cursor ownership if the same
  asynchronous write boundary permits overlapping cursor claims.
- Fix proven failures at the owning durable boundary. Finalization must exclude late writes, counters cannot
  regress, removed cached entries cannot republish, and late removal publication failure must recover/retry.
- No global connection pool/cache, scenario-specific logic, timeout increase, weaker assertions, public sequence
  change, copied page bodies, or baseline increase. Keep indexed append cost and normal service behavior.
- Validate affected owner tests, fresh Core build and cache-free types, actual separate-process restart cases,
  original 32-entry measurement, structure audit and whitespace. Report exact limitations and changes.
- Never commit, merge, push, modify live lane trees, launch paid calls or manage the user's panel.

1. **Main handoff stale.** `mvp-final-month-plan.md` Current State is dated October 9 and still prioritizes
   round-2 fixes. Its t383 is already merged. The recovery plan's Current State is newer (through t448), but
   its header still says paid proofs await relaunch. Neither captures final round-3 A/B/D results.
2. **A already finished twice.** `fxwork/t342/!FluxIQWebExtension/docs/working/mvp-final-month-plan/reports/lane-a-round3.md`
   records run #1 and leaves #2 running. Its pending run-2 debug contains expectations only.
   Saved run #2 finished at 18:07 local with a passed verdict. Qualification needs evidence review, not a third launch.
3. **B report stops before its paid result.** `fxwork/t262/.../reports/lane-b-round3.md` ends at preflight.
   The provider-free recording practice still hit `recording.persistence` after about 91 seconds while entries
   were appending. This is separate from the paid candidate build failure: do not assume one cause explains both.
4. **C fixes survive only in dirty trees.** At `fxwork/t274`, Core changes completion feedback/endings and
   look-withdrawal tool availability; downstream changes Lists exploration guidance (`web-6`). Worker reports
   record focused passes, but the gated domain check was refused because Core output predates edits.
   A report also questions cached typecheck reuse. Rebuild Core and observe narrow checks yourself before acceptance.
5. **D has a design, not implementation.** `fxwork/t275/.../reports/lane-d-r3-w1-adapt-design.md` proposes
   trial slow-down feedback, handler guidance and a generic `web.dom.dismiss_layer` action. No source changes
   exist there. It predates the newly failed round-3 run and does not establish that run's cause.
   Its proposed one-time completion hold followed by acceptance of an unchanged Flow needs review against the
   user's requirement that an encountered interruption becomes saved recovery behavior; do not silently adopt it.
6. **Older storage/testing tasks remain real.** t380 has an unmerged Core test-fix commit; t381 has Core WIP
   connection reuse `08eafd1a`. The newer t435 session-scoped optimization does not establish that recording
   persistence is fixed. Review overlap and validate lifecycle/authority before merging t381.
7. **IDE file is historical.** The open October 3 step index is older evidence, not the current handoff.
   Newest bundle timestamps and uncommitted lane reports establish where Claude actually stopped.

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

### Brief: recording-index-review
- Repository: paired t454, supervisor synced dev1a7e47c6/b16ad470; implementation worker finished, source frozen.
- Task: independent read-only review of recording repair/index and focused test adequacy before supervisor integration. Report concrete defects with owner paths/reproductions, not a completion claim.
- Required reads: this Current State + recording-stream-owner.md; git changed/untracked Core paths for this unit only, named below. Do not read other MVP planning/history.
- Owns: new downstream reports/recording-index-review.md only. Read Core recording-stream/{entry,projection,store}.ts; schema/recording-stream.ts + administration/table-names wiring; runtime-stream recording methods; recordings/store/load-timeline and service recording-only wiring; changed owning adapter/schema/retry/restart/storage tests. No source edits, builds/merges/commits/providers/browser/full suites.
- Definition of done: evaluate generation/cursor invalidation, concurrent append/control catch-up, transactional rollback, exact ID/public sequence/body-digest proof and generated-time retry scope, explicit recording-delete reference unlink versus unrelated refs/content retention, legacy file+SQL/conflict and late durable finalization recovery. Check index linearity versus full-history scans, schema migration compatibility, owner close/disposal. Identify unsupported ack-loss or general authority claims separately; preserve established API identity/public sequence semantics. Recommend narrow meaningful supervisor cases; do not treat worker test counts alone as correctness.
- Report to: t454 docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-index-review.md.

### Brief: worker-start-recovery
- Repository: t455-worker-start-observation downstream task; Core shared3291fb25 read-only.
- Task: finish supervisor's isolated browser observation-gap recovery; keep actual worker readiness and network containment strict.
- Required reads: this Current State, worker-start-observation brief/probe results; t455 existing root-authored chrome-worker-target.ts/tests and launch-extension-session.ts prototype; original run-scenario browser setup, readiness/control/guard owners and four source-order identity/containment tests.
- Owns: t455 new helper/probe helpers and owning tests, browser-session/index.ts, run-scenario.ts narrow wiring, directly affected source-order tests only; own worker-start-observation.md report. Supervisor transferred unfinished prototype, no concurrent source edits.
- Must not touch: Core/source defaults/model/scenarios/oracles/existing profiles/.env/shared docs, commits/merges/full suites; no CDP-target-only acceptance or timeout/guard relaxation. Probe only actual extension/allowed everything-store in isolated/copied profiles, model disabled.
- Further approved ownership: browser-session/session-observers.ts + tests/session-observers.test.ts keep capture/watch registration single and dispose/rebind console watcher when context replaces, preserving spine budget and context/guard evidence ownership. Directly affected guarded-browser launch-containment, run-evaluation runner-wiring and Core/host/server identity source-order tests may follow extraction, without weakening dispatch/containment order.
- Definition of done: on first proved Chrome-present/Playwright-absent worker timeout, normal-close owned context and relaunch same profile once within attempt; second failure/missing/ambiguous target refuses. Fresh strict worker readiness and awaited canary proofs before returning control session; all actual identity/pairing gates still precede dispatch. Preserve screenshot/trace/console/perturbation ownership, single capture watcher, and terminal-failure cleanup. Unit fail-first plus injected actual-browser recovery with current stamps; owning test-runner build/type and affected tests/audit. Report natural16start probes allpassed (race not naturally reproduced), injected reproduction honestly; no live semantic qualification.
- Report to: t455 docs/working/live-testing-handoff-audit-2026-10-11/reports/worker-start-observation.md.

### Brief: handler-scope-feedback
- Repository: new paired task, supervisor provisioned current dev; unit stays isolated until reviewed.
- Task: preserve actionable trusted handler-scope static refusal explanation lost before candidate trial in B second run.
- Required reads: this Current State, B round5 report/full second debug/actual dist probe; Core bootstrap-completion.ts issue-feedback path, flow-bootstrap issue-feedback owner, authored script handler assembler and owning tests.
- Owns: initially named issue-feedback + bootstrap-completion owner/tests and own report; identify exact additional extraction path before editing if needed for structure budgets. No broad parser/graph changes.
- Supervisor provisioned paired t457 and approved exact Core flow-bootstrap/plan/issue-feedback.ts + plan/tests/issue-feedback.test.ts + llm/harness-options/tests/bootstrap-completion.test.ts + llm/repeat-guard/tests/candidate-feedback.test.ts (test-only latter). Existing routing carries messages when owner emits them; single trusted handler_invalid allowlist change, no parser relaxation or bootstrap-completion.ts edit.
- Approved new neutral harness regression in llm/harness-options/tests/handler-scope-feedback.test.ts after existing file would exceed800lines; preserve all existing tests and no baseline expansion.
- Must not touch: numeric domain/source peers, scenarios/oracles/user instruction, .env/user data/shared docs, model output cap or generic raw DOM/provider-message copying; no worker commits/merges/full suites/browser/paid calls.
- Definition of done: fail-first valid compiler refusal with missing explicit handler target label; actual next model feedback retains safe actionable explanation from trusted authored-statement/static issues. Preserve exact candidate receipt/revision/digest flow and existing privacy/code/path contracts; no realistic task-shaped examples or relaxing invalid handler acceptance. Narrow owner tests/type/fresh built-owner validation/audits; report limits and implementation paths. Supervisor owns architecture/integration.
- Report to: new task downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/handler-scope-feedback.md.

### Supervisor unit: numeric-tool-contract
- Repository: t456-numeric-tool-contract, shared Core3291fb25 read-only.
- Task: correct registered tool prose that promises first-number parsing although deterministic numeric bounds already recognize complete composite counts; guide quantities toward numeric bounds, keep text matches lexical. Existing D raw-text regex failure is not a parser bug and changed prose is not live proof.
- Owns: domain/src/runtime/llm-evidence/tools.ts, build-loop architecture and own report. Preserve parser/action/wire/oracle semantics and description cap; remove existing realistic-task-shaped accessory example in the same tool prose, use generic status exclusion instead. No source consumer/schema invented, no model-answer injection. Run existing owning tool/condition tests and current domain typecheck/build/audit.

### Brief: worker-start-observation
- Repository: new isolated downstream task worktree; current Core3291fb25 read-only, no live-lane source edits.
- Task: reproduce C run-mv4p3qri-4c59c2ff startup mismatch before choosing a fix. Supervisor owns initial investigation; delegate if additional discovery exceeds bounded owners.
- Required reads: C round-five full debug and screened startup trace, run-lifecycle/extension-readiness.ts, extension-control-page.ts, launch-browser.ts and extension-start-trace.ts plus their owning tests.
- Owns: ignored isolated probe/evidence and own report initially; any source fix requires supervisor narrowed file assignment after reproduction.
- Supervisor narrowed recovery scope after16actual provider-free starts (all pass; intermittent original fault not naturally reproduced): extension-control-page.ts, focused browser-session Chrome worker target lookup plus barrel/owning tests, existing extension-control-page tests and testing-facility architecture. Inject the saved observation split (Chrome target present, Playwright observer absent) to fail first; recover only from a bounded extension.worker readiness failure using an unambiguous Chrome service-worker target. Control-page/pairing and all actual identity guards still follow before model dispatch. Missing/ambiguous/failed Chrome discovery preserves refusal; no timeout expansion or claims that target existence proves execution.
- Containment review revised that recovery before integration: a Chrome descriptor cannot replace Playwright's attached worker, because the network canary proof depends on that attachment. Keep original worker readiness strict. Supervisor owns browser-session/launch-extension-session.ts and its owning tests, Chrome target lookup/tests/barrel, run-scenario.ts narrow wiring and architecture. Only a proven Chrome-present/Playwright-absent readiness timeout restarts the isolated browser once inside the same attempt; close previous owner normally, preserve profile data and perform fresh strict readiness, awaited worker containment proofs and unchanged identity/pairing gates. No outer relaunch, target-only acceptance, timeout increase or containment relaxation.
- Must not touch: existing profiles/user data, Core, scenario/oracle/instruction, live-lane branches, model/provider, source-freeze heads, generic timeout or guard overrides. No worker commits/merges/full suites.
- Definition of done: provider-free actual current extension on allowed everything-store fixture; copied or new isolated profile, Chrome target versus Playwright worker exposure and diagnostic attachment timing compared. Trace actual fault with no load/memory attribution or synthetic browser fixture. Prove correction against actual browser and owning tests before changed-source C relaunch. Report limits honestly; never count CDP existence alone as extension identity or successful chat.
- Report to: isolated task downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/worker-start-observation.md.

Round-five launch preparation: coherent fixes and notes pushed to downstream e836e611/Core3291fb25; all three paired lane trees synced clean before workers started. B and D workers own their lane preflights, supervisor owns C. Ready dry-runs do not start topology, so a human pause before running-identity receipts is unavailable. Supervisor inspected the real awaited identity guards in run-scenario.ts (Core/host/server adapter before browser setup, extension before chat). Those guards refuse mismatch before provider dispatch. Supervisor reviews ready plan/intended artifacts before launch and independently reads all four actual receipts as soon as the topology writes them; no new gate or extra paid launch.

### Brief: live-b-round5
- Repository: existing paired t262 lane trees, supervisor synced to integrated t452/t453 pair.
- Task: original bigbox-retail-pickup-cart-store-remembered-after-creation, two consecutive candidate creations with separate disabled-model replays on frozen Core3291fb25.
- Required reads: this Current State; live-b-round4.md/full debug, t452 feedback report; current original task/oracles and live/replay guard rules.
- Owns (may edit): new lane-b-round5.md, live-b-round5.md and new run-id debugs; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports/.env/user data/profiles; no commits/merges/pushes/full suites/guard overrides or user panel management. No reply-output cap or automatic relaunch.
- Definition of done: slot3/instance t262-slot-3/workspace t262-b; current owning library/build outputs and ready preflight proving zero calls, candidate/reset trial and whole-Flow $0.25 via process environment. Four actual identities match before provider, headed real chat, one attempt. First success fully debugged/independent exact oracles/separate unchanged-hash zero-provider/intervention/harness replay before second creation. Failure fully debugged then stops pending changed source; first balance failure stops all paid work. Report UI/costs honestly.
- Report to: t262 downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round5.md.

### Brief: live-d-round5
- Repository: existing paired t275 lane trees, supervisor synced to integrated t452/t453 pair.
- Task: original social-network-feed-confirm-requests, same two-creation/zero-model replay qualification, frozen Core3291fb25.
- Required reads: this Current State; live-d-round4.md/full false-acceptance debug, t453 report; original task/oracles and current live/replay/guard rules.
- Owns (may edit): new lane-d-round5.md, live-d-round5.md and new run-id debugs; runtime evidence through owning Lab only.
- Must not touch: same source/docs/profile/permission boundaries as B; no test-shaped guidance or expected-count injection.
- Definition of done: slot4/instance t275-slot-4/workspace t275-d; same current builds/$0.25 zero-call preflight/four identity/headed chat/single launch/full-debug/replay gates as B. Inspect all rows, duplicate acts, excluded witnesses, independent oracle and any encountered rate-limit recovery; a judge yes alone or automatic retry does not prove saved adaptation. Failure/balance stops as B; no unchanged relaunch.
- Report to: t275 downstream docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round5.md.

### Supervisor lane: live-c-round5
- Repository: existing paired t451; slot1/instance t451-slot-1/workspace t451-c.
- Task: unchanged everything-store-plus-earbuds-under-50, same frozen Core3291fb25 and $0.25 environment/preflight/identity/debug/replay gates as B/D.
- Supervisor owns new lane-c-round5.md/live-c-round5.md/new run debugs. Recording worker stays in isolated t454.
- Preserve five-page exact dataset oracle and structured paging loop; no oracle/task alteration, output cap, source edit or unchanged failure relaunch. Only successful/debugged first creation and separate zero-model replay permit second.

### Brief: recording-stream-owner
- Repository: paired t454 trees under `C:/Users/osrs_/FluxStuff/fxwork/t454/`, separate from live lane/source tasks.
- Task: repair the actual recording sequence/write/read ownership chain established by the provider-free dist probe; preserve existing projects and recordings, never merge t381 pool WIP wholesale.
- Required reads: this Current State; t381 recording-persistence-measurement.md and sanitized reproduction/private probe; model recording-framework sequence assignment; actual recording store, runtime-stream/event-chunk recording helpers, summaries/store fallback and owning tests; Core instructions/code structure.
- Owns (may edit): Core runtime/service/recordings/store.ts, recordings/load-timeline.ts and tests/storage-restart.test.ts/process-probe.mjs; storage/project/runtime-stream-store.ts, recording-stream/{store.ts,index.ts,tests/store.test.ts} and project/index.ts; runtime/service.ts pool injection/recording-only writes/removal wire and service/summaries/store.ts recording-only strict helper; owning recording/removal tests; own report. Supervisor approved exact helpers and narrow wiring after source trace; generic fallback unchanged.
- Must not touch: public model sequence semantics, global connection pools/t435, t452/t453 source or live lanes, oracle/scenarios, shared docs/.env/user data; no commits/pushes/merges/full suites/browser/providers. Runtime data only through owning APIs in isolated test roots.
- Retry refinement authorized: exact durable retries are idempotent; preserve original omitted timestamp/offset proof and return landed originals for mirror publication within recording-only owners. Cover post-typed metadata failure, conflicting contents and removed IDs; never guess packet identity or expand the gateway/model contract.
- Performance refinement authorized after measurements: recording-owned durable identity/projection metadata with exact cursor/generation catch-up, not connection caches. Additional Core owners: project/schema/recording-stream.ts, schema/index.ts and table-names.ts, existing migration registration, schema owning tests; focused helpers/tests inside approved recording-stream directory. Foreign keys and explicit delete/recreate/reopen/raw-chunk append/removal catch-up must invalidate derived state; no overwrite of historical chunks/public sequence. Append/read counters and conflict proof remain exact under partial write failure. Measure old/new chunk/SQL counts and 32/40-entry close/restart phases; unchanged15s child bounds and no baseline/schema-guard bypass.
- Finalization refinement authorized within existing owners: after typed endedAt commits but later metadata fails, retry/reopen adopts the proven durable end time and complete verified timeline. Direct typed conflicting put refuses; preserve public service repeat-finish returning its original end time even when repeated with a different value. Append/removal cannot reopen completed state. Add fail-first late metadata/finalize/reopen proof; no cross-filesystem atomic rollback claim. Supersede earlier gates after source change, rerun affected owners/fresh processes.
- Definition of done: fail-first real-owner zero-sequence append/batch and mixed fallback+SQL restart; positive storage cursor separate from unchanged public timeline identity/order. Exact endedAt/count/order survive rebuilt-process reopen and >32 chunks; mirror changes only after durable success. Explicit removal may append validated private control records under existing lock, never rewrite old content; controls stay out of public entries, fold after legacy merge and cannot resurrect removed IDs. Cover finalized/stale/conflicting/spoofed/duplicate removal, SQL/file modes and legacy ambiguous sequences without guessing/overwriting. No silent recording error, generic fallback change, authority bypass, timeout/baseline expansion or destructive history rewrite. Own narrow tests/current package types/audit pass after fresh build.
- Report to: t454 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-stream-owner.md`.

### Brief: recording-persistence-measurement
- Repository: t381 downstream report/probe workspace; subject read-only built Core `C:/Users/osrs_/FluxStuff/fxwork/t380/!FluxIQ` (77604650, actual rebuilt library verified by supervisor). Never load t381's conflicting Core WIP.
- Task: provider-free phase/queue measurements of actual recording append and finalization, before choosing a storage optimization.
- Required reads: this Current State; committed storage-reuse-review.md; named Core service.ts append/finalize/storage helpers, service/object-documents.ts, service/locks.ts, service-recordings/tests/storage.test.ts, _shared/performance-metrics.ts and current actual-built process-probe import order. Supervisor approved bounded read-only extension to actual service/recordings/store.ts, storage/project/runtime-stream-store.ts and referenced recording/event-chunk helper to classify restart mismatch.
- Owns (may edit): t381 downstream own report and ignored `test-runs/recording-persistence-measurement/` private probe/evidence only. Subject Core source/dist read-only; no source edits/builds/merges/commits/shared docs, full suites, browser/provider/user-panel operations.
- Definition of done: actual dist-backed service/canonical SQLite owners on isolated mkdtemp data, framework-first imports; measure lock queue/wait/drain, normalization/dehydration, global get/put, typed project append/index/summary and finalization spans. Preserve real call ordering and method behavior; no external models. Compare small and moderate synthetic state payloads/batch sizes using unit-only data, not recorded page content. Assert exact persisted count/order and endedAt after queued appends, no later mutation, normal close. Report medians/tails/counts and source/artifact identity; do not extrapolate a probe pass to browser backlog resolution. Explain any missing representative payload/process boundary.
- Report to: t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/recording-persistence-measurement.md`.

### Brief: result-cohort-judgement
- Repository: paired t453 trees under `C:/Users/osrs_/FluxStuff/fxwork/t453/`; supervisor will sync integrated t452 before final validation.
- Task: strengthen generic result-verification instruction for complete quantity interpretation and included/excluded cohort checking, based on D's false acceptance with full evidence already present.
- Required reads: this Current State; t275 live-d-round4.md and full run debug; Core runtime/llm/diagnosis-instructions.ts and owning instruction/request/verdict tests; Core instructions/code structure.
- Owns (may edit): Core packages/fluxiq/src/programs/automation-studio/runtime/llm/diagnosis-instructions.ts; llm/tests/diagnosis-channel.test.ts and deepseek/tests/system-prompt.test.ts; generated deepseek/tests/system-prompt-pins.json (regenerate only two verification entries through actual builder, never hand-edit); own report only.
- Must not touch: t452 files, judge schemas/coverage protocols, numeric condition semantics, oracle/scenario/fixture, shared docs, .env or user data; no commits/pushes/merges/provider/browser calls/full suites. No expected-count injection or scenario-shaped examples.
- Definition of done: generic verification requires interpreting all quantitative components and comparing relevant left-out witnesses against original requirements independently of the authored predicate, with uncertainty refusing acceptance. Distinguish before/after aggregate counts from distinct cohort size. Owning tests prove instruction delivery and preserve judgement/gate contracts; actual affected typecheck/audit pass. Do not claim wording/naming coverage proves deterministic arithmetic or completeness.
- Report to: t453 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/result-cohort-judgement.md`.

### Brief: candidate-recovery-feedback-b
- Repository: paired t452 trees under `C:/Users/osrs_/FluxStuff/fxwork/t452/`, synced to integrated dev by supervisor.
- Task: fix B's proven generic cached-response/stall guidance mismatch in candidate mode and unsafe wrong-control correction advice; preserve guards and exact trial requirement.
- Required reads: this Current State; t262 live-b-round4.md and full run debug; named Core source and owning tests; Core instructions/code structure.
- Owns (may edit): Core runtime/llm/evidence-loop.ts; runtime/llm/candidate-receipt/{receipt.ts,index.ts,tests/receipt.test.ts}; evidence-loop/answered-request.ts and decision-handlers/answered-request.ts with own tests/barrels; runtime/llm/evidence-progress/{stall-redirect.ts,redirect-facts.ts,index.ts} and owning tests; runtime/flow-bootstrap/candidate/submission-refusal.ts and owning tests; own report only. Supervisor approved bounded receipt/answered-request/facts extraction and receipt relocation up one level to preserve directory, depth and coordinator budgets.
- Must not touch: C-owned domain instructions/Core UI files, D owners, shared docs/other reports, .env or user data; no commits/pushes/merges/provider/browser calls/full suites.
- Definition of done: fail-first generic regressions: discovery-only cached accepted submission directs exact trial path without nonexistent draft/amendments; legacy notes unchanged; wrong-control diagnostics distinguish control validity from intended purpose and offer valid alternatives without assuming keep-handle. No test-shaped examples, forced semantic acceptance, trial bypass or spend guard relaxation. Owning tests, actual Core typecheck/audit pass.
- Report to: t452 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-recovery-feedback-b.md`.

### Brief: candidate-recovery-feedback-c
- Repository: same paired t452 trees; files partitioned from B worker.
- Task: generic semantic category filtering guidance and truthful failed-check UI finding text from C's trace.
- Required reads: this Current State; t451 live-c-round4.md/full debug; named source/tests; Core instructions/code structure.
- Owns (may edit): downstream domain/src/runtime/llm-evidence/system-instructions/instructions.ts and tests/instructions.test.ts; Core packages/fluxiq/src/ui/activity-action/check-why.ts and tests/action-of.test.ts; own report only.
- Must not touch: B-owned runtime modules/tests, condition semantics/compiler/catalog contracts, shared docs/other reports/.env/user data; no commits/pushes/merges/provider/browser calls/full suites.
- Definition of done: fail-first generic count-only finding rejected or replaced without false opposing counts; domain guidance distinguishes actual type/category from incidental text mentions using no scenario-shaped example and remains <=3200 characters. Existing filters unchanged. Owning UI/domain tests, affected actual typechecks and audits pass against current library build where needed.
- Report to: t452 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-recovery-feedback-c.md`.

### Brief: a-review
- Repository: downstream lane tree `C:/Users/osrs_/FluxStuff/fxwork/t342/!FluxIQWebExtension` (existing task branch).
- Task: fully debug A round-3 run 2 and assess both runs' qualification, including identity/oracles/replay accounting and UI evidence.
- Required reads: this Current State; lane tree `docs/working/mvp-final-month-plan/reports/lane-a-round3.md`; both A bundles under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/`; run-1 debug and run-2 pending debug.
- Owns (may edit): lane tree `docs/working/mvp-final-month-plan/reports/lane-a-round3.md`, `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jvo7k-612f0bbb.md`, `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-review.md`.
- Must not touch: source, Core, shared working documents, pending debug, other reports; no commits/pushes/merges/builds/launches.
- Definition of done: every step inspected; exact evidence for gate or gaps; saved run identities/provider accounting checked; report and run-2 debug saved without secrets or captured page contents.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-review.md`.

### Brief: b-debug
- Repository: downstream lane tree `C:/Users/osrs_/FluxStuff/fxwork/t262/!FluxIQWebExtension` (existing task branch); paired Core read-only.
- Task: trace `run-mv4jqkko-bc9a05c6` build failure to root cause, inspecting every step and relevant source; distinguish recording-practice failure.
- Required reads: this Current State; lane-b-round3.md; run bundle under `C:/Users/osrs_/FluxStuff/lab-runs/2026-10-11/`; paired Core Repository Boundary.
- Owns (may edit): lane tree `docs/working/mvp-final-month-plan/reports/lane-b-round3.md`, `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jqkko-bc9a05c6.md`, `docs/working/live-testing-handoff-audit-2026-10-11/reports/b-debug.md`.
- Must not touch: any code or other docs; no commits/pushes/merges/builds/tests/launches.
- Definition of done: concrete cause with file/line and failed sequence, smallest regression/fix proposal, full debug saved; clearly mark hypotheses; no secrets/page captures in report.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/b-debug.md`.

### Brief: c-validation
- Repository: paired trees `C:/Users/osrs_/FluxStuff/fxwork/t274/!FluxIQWebExtension` and sibling `!FluxIQ` (existing task branches).
- Task: inspect surviving C diffs and three lane-c-r3-fix reports; rebuild affected Core libraries and verify narrow owning tests/typechecks/audits; additionally fix B's confirmed completion-only last-decision defect and accepted-submission test-next guidance without weakening trial/purse gates.
- Required reads: this Current State; three reports in lane tree `docs/working/mvp-final-month-plan/reports/lane-c-r3-fix-{a,b,c}.md`; Core Repository Boundary and code structure; dirty source/test diffs.
- Owns (may edit): the existing dirty Core authoring-loop.ts/tests, progress.ts/candidate-endings.test.ts, loop-budget.ts and tests/loop-budget.test.ts, look-withdrawal.ts and its new finishing-tools test; downstream system-instructions/instructions.ts and tests/instructions.test.ts; own report.
- Must not touch: shared docs, other sources/reports; no commits/pushes/merges/provider/browser launches; no full suites. Generated output only through owning builds.
- Definition of done: fail-first candidate last-decision regression, exact accepted revision test-next guidance; focused candidate/endings/withdrawal/budget/state-digest/instructions tests pass, actual affected typechecks against rebuilt Core pass, both structure audits inspected; report cache concern with evidence, not assumption.
- Report to: downstream lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/c-validation.md`.

### Brief: d-trial-feedback
- Repository: new paired task `C:/Users/osrs_/FluxStuff/fxwork/t449/!FluxIQWebExtension` and sibling `!FluxIQ`.
- Task: diagnose D's false-looking terminal failure and fix the underlying graph/compiler bug if confirmed, plus actionable safe graph-level trial feedback.
- Required reads: this Current State; D run bundle and lane `fxwork/t275` evidence; Core Repository Boundary/code structure; `runtime/flow-bootstrap/verification/detached-execution.ts`, `executor/graph-navigation.ts`, `executor/graph-run.ts`, `service/candidate-trial/feedback.ts` and their tests.
- Owns (may edit): Core executor graph-navigation.ts, graph-navigation/edge.ts and barrel (new), step-skip/optional-step.ts and owning imports, step-skip/tests/guarded-group-run.test.ts and graph-navigation tests; candidate-trial feedback source/tests and safe terminal-code producer; matching architecture docs; downstream D debug and own report in t449. Compiler changes require another ownership review.
- Must not touch: C's authoring-loop/progress/loop-budget/look-withdrawal/instructions files, other task trees, shared docs; no commits/pushes/merges, full suites, paid calls or browser launches.
- Definition of done: fail-first regression from D's optional/only-after/repeat shape, no weakening of missing/disconnected-node protection; graph-level failure reported safely without page/selector details; focused tests, affected Core typecheck and audits pass. Report exact source ownership before expanding beyond named modules.
- Report to: t449 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/d-trial-feedback.md` and `docs/working/language-driven-flow-loop-plan/debugs/run-mv4jjsvj-25b4dc2a.md`.

### Brief: a-zero-call-replays
- Repository: existing `C:/Users/osrs_/FluxStuff/fxwork/t342/!FluxIQWebExtension` and paired Core, both source frozen at original round-3 pair.
- Task: run the two missing separate provider-free replays of A's accepted saved Flows using exact templates/IDs/hashes in a-review.md; verify full replay gate.
- Required reads: this Current State; a-review.md; testing-facility.md separate replay contract; lane-a-round3.md.
- Owns (may edit): lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-zero-call-replays.md`, lane-a-round3.md; runtime evidence via owning Lab only.
- Must not touch: source/Core/shared docs/other reports, original profiles or stored Flows; no commits/pushes/merges, provider calls, full suites or user panel management. Do not sync/rebuild from newer source and silently claim the same pair.
- Definition of done: both exact stored hashes unchanged, provider/intervention/harness counts all zero, independent task oracle holds; IDs/build identity recorded; supervised headed replay through isolated Lab topology. If source or artifact unavailable, report blocker without recreating the Flow.
- Report to: lane tree `docs/working/live-testing-handoff-audit-2026-10-11/reports/a-zero-call-replays.md`.

### Brief: candidate-default
- Repository: paired new task `C:/Users/osrs_/FluxStuff/fxwork/t450/!FluxIQWebExtension` and sibling `!FluxIQ`.
- Task: after A's proven gate, change the Core product authoring default to candidate; retain explicit legacy opt-out and raw omitted-mode API compatibility.
- Required reads: this Current State; Core Repository Boundary; `model/authoring-mode/authoring-mode.ts` and tests, affected API handlers/configured-mode tests and conversation command mode resolver; architecture section is reference only.
- Owns (may edit): Core `model/authoring-mode/authoring-mode.ts`, its tests and affected configured-mode API/conversation tests if required; source comments describing the default; own report.
- Must not touch: runtime candidate/LLM/executor modules owned by C/D, architecture/working shared docs (supervisor owns), .env files, user data, Lab defaults; no commits/pushes/merges/full suites/launches.
- Definition of done: unset/blank configured product mode uses candidate, explicit legacy/candidate preserved, invalid values refuse; raw API omitted-mode compatibility retained; fail-first owning/configured API tests and affected package typecheck/audit pass; no build/push claims without observed checks.
- Report to: t450 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/candidate-default.md`.

### Brief: storage-reuse-review
- Repository: existing paired t381 trees under `C:/Users/osrs_/FluxStuff/fxwork/t381/`; current Core dev read-only for comparison.
- Task: assess t381 WIP connection reuse against current t435 implementation and B's separate recording persistence failure; identify exact remaining lifecycle/process validation and any merge/ownership defects.
- Required reads: this Current State; t381 report; six files from Core commit 08eafd1a; current database-manager storage owners and t435 runtime-session connection lifetime; saved B provider-free recording failure summary.
- Owns (may edit): only t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/storage-reuse-review.md`.
- Must not touch: source/tests/shared docs, other reports, generated or runtime data; no commits/pushes/merges/builds/tests/browser/provider launches.
- Definition of done: precise distinction between global database pool, project pool and recording path; compatibility/lifecycle/durability risks; actionable narrow validation/fix plan, including actual dist-backed process probes; hypotheses clearly identified.
- Report to: t381 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/storage-reuse-review.md`.

### Brief: test-fixture-verification
- Repository: existing paired t380 trees under `C:/Users/osrs_/FluxStuff/fxwork/t380/`, just integrated current dev by supervisor.
- Task: verify t380's four committed test-fixture changes on current source; correct narrow fixture defects only if reproduced. Keep ready for integration without advancing dev during live qualification streaks.
- Required reads: this Current State; t380 report; Core diff for ebc3a1b3 and current four changed files.
- Owns (may edit): Core `runtime/service/flows/tests/creation.test.ts`, `runtime/tests/service-adaptation/tests/recovery-trace.test.ts`, `storage/canonical-authority/tests/whole-fixture.ts`, `storage/canonical-authority/tests/whole-sql.test.ts`; own report.
- Must not touch: product source/shared docs/other tests/reports, no commits/pushes/merges/full suites/provider/browser calls. No timeout increases; generated output only via owning library build.
- Definition of done: fresh owning Core library build when needed; changed tests plus existing whole-operation/whole-process consumers pass with actual built current code; owning package typecheck and audits pass; lifecycle/copy/WAL isolation inspected; precise results in report, no whole-suite requirement.
- Report to: t380 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/test-fixture-verification.md`.

### Brief: live-b-round4
- Repository: existing paired t262 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `bigbox-retail-pickup-cart-store-remembered-after-creation`, two consecutive candidate creations on one frozen source pair, each followed by separate zero-model replay.
- Required reads: this Current State; lane-b-round3.md and b-debug.md; current testing-facility live/replay/waste-guard rules; original lane-b-candidate task/oracles.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-b-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges, full suites, guard overrides or paid automatic relaunches. Core/extension own builds required; no model output cap.
- Definition of done: slot 3, instance t262-slot-3, workspace t262-b; build current Core libraries through owning package scripts, zero-call dry-run ready and four running identities proven before first provider call; headed real extension chat, $0.10 whole-Flow ceiling, one attempt per launch; every run fully debugged/UI reviewed before next. On failure report cause and await changed-source task; on balance error stop all further paid work and alert supervisor. Second paid creation allowed only after first passed and complete debug. Measure independent oracles/unchanged saved hash/zero counters for separate replays.
- Report to: t262 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-b-round4.md`.

### Brief: live-c-round4
- Repository: new paired t451 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `everything-store-plus-earbuds-under-50` with two consecutive candidate creations and separate zero-model replays on the frozen pair.
- Required reads: this Current State; original lane-c-candidate reports/task/oracles and C verification report; testing-facility live/replay/waste-guard rules.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-c-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-c-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges/full suites/guard overrides/automatic paid relaunches. Rebuild only through owners; no model output cap.
- Definition of done: slot 1, instance t451-slot-1, workspace t451-c; same preflight/identities/headed chat/$0.10/single launch/full-debug/zero-model gates as B. Preserve original task, five-page dataset oracle and structured loop requirement. On failure report cause and await changed source; balance error stops all paid work. Only a passing debugged first creation permits second on unchanged pair.
- Report to: t451 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-c-round4.md`.

### Brief: live-d-round4
- Repository: existing paired t275 lane trees; source synced by supervisor to current dev with t274/t449/t450.
- Task: qualify `social-network-feed-confirm-requests` with two consecutive candidate creations and separate zero-model replays; check saved interruption behavior honestly.
- Required reads: this Current State; original lane-d-candidate task/oracles, latest D run debug and t449 report; current testing-facility live/replay/waste-guard rules; unimplemented D adaptation design is reference only.
- Owns (may edit): lane `docs/working/mvp-final-month-plan/reports/lane-d-round4.md`, new run-id debugs, own `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round4.md`; runtime evidence through owning Lab scripts only.
- Must not touch: source/shared docs/old reports, .env, user panel/data/profiles; no commits/pushes/merges/full suites/guard overrides/automatic paid relaunches. No model output cap; never adopt accept-unchanged-after-one-hold design.
- Definition of done: slot 4, instance t275-slot-4, workspace t275-d; same preflight/identities/headed chat/$0.10/single launch/full-debug/zero-model gates as B. Inspect row completeness/no duplicate acts, rate-limit retries/pacing and persisted recovery structure; distinguish passing outcome from adaptation proof. Failure awaits changed-source task; balance error stops all paid work. Only a passed/debugged first creation permits second on unchanged pair.
- Report to: t275 downstream `docs/working/live-testing-handoff-audit-2026-10-11/reports/live-d-round4.md`.

## Work Ledger

- October 11: Round-six Core190d7bda/downstream921f0296 ended allthreefailed. Supervisor independently inspected
  zero-call ready ceilings0.25/original tasks and all12actual identity receipts. C startup passed; sealed C
  build48calls/36decisions/12judges ends evidence_iteration_limit, six trialsno, latestrev16; total49calls0.09098706.
  D build48calls/38decisions/10judges same limit, five no/unconfirmed trials, total49calls0.068919444. B savedoracle
 4of10factsunheld despite runtimesucceeded/finaljudgeyes,25calls0.044999439. Trial yes correctness not disproved:
  two trial add confirmations differ from saved first no-effect. Budget ceiling remains0.25; future ready plans
  may use existing64call upper bound after relevant source repair, without raising financial/output limits.
- October 11: Root t454 synced both idletrees to integrated dev190/921; actual fresh owning build64.854s/7250outputs,
  cache-free currenttypes and independent48tests/6owner files passed. New compatibility comparison proves supported
  fresh no-packet-ID append after captured undo still regresses; acceptance withheld pending private capture proof.
  Existing six fresh-process cases/32state measurement remain worker claims until final source independent rerun.
- October 11: t458 paired provision started for exact Core record-output-contract help omission; no parser changes.
  A read-only freshness report identifies domain result observation coverage, not Core cache/timing; optional opaque
  passive result-view proposal needs neutral fail-first validation and preserves legacy fallback/hidden-control rules.

- October 11: Supervisor accepted t455 after current owner build, cache-free types, independent36test lifecycle/
  containment/wiring pass, actual injected browser proof (fresh strict worker/guard identity, forbidden traffic0,
  provider0), final audit and baseline31to28 only. Normal task integration audit passed; merge9c62a57a. Original
  natural race remains unreproduced. Owning task cleanup reclaimed disposable probe worktree; stdout proof and
  gate logs remain outside it under fxwork/t455-supervisor-*.log; original C live profile/run evidence untouched.
- October 11: t457 supervisor22tests plus actual compiled refusal/privacy/repeat proof, fresh Core build/cache-free
  types and current domain19.896s check passed. Both audits passed. Downstream normal finish then Core own
  finish used --skip-checks only to avoid its legacy full-suite wrapper after observed narrow gates; see retained
  reports and finish logs. Exact trusted handler_invalid messages admitted, invalid scripts still refused; no
  arbitrary page/provider feedback admitted. New source pair needs fresh live qualification, not yet claimed.
- October 11: Independent t454 source review completed all21owner paths. Four concrete cached-removal,
  removal-retry, finalize/append and delayed-counter interleavings remain unverified; worker now owns bounded
  fail-first reproduction/fixes. Repair remains isolated/unmerged despite earlier sequential restart passes.

### 2026-10-11 — Combined feedback/judge pair integrated; recording failure supervisor-verified
- Agent: Codex senior supervisor; feedback/judgement/recording workers.
- Changed: t452 integrated Core135da138/downstreambec8639b; t453 integrated Core3291fb25/downstream2fa74682; all unit reports/architecture preserved. Recording repair brief expanded to exact adapter/load/strict-write/removal owners without touching pool WIP.
- Why: restore consistent candidate guidance and reject semantic counterexamples before new paid tests; preserve actual recording histories across restart.
- Validation: root t453 delivery/pins52/52, cache-free Core typecheck exit0, actual domain freshness/typecheck22.221s and both audits pass; worker four subjects111/111/fresh47.392s build. Core finish whole-suite bypass only after real narrow gates. Root reran configured32-entry probe: exit1 at reopen, typed31/file1/reopen1. User$0.25 accepted by actual zero-call budget resolver; next actual ready preflight still required.
- Outcome: Accepted combined product pair, live proof pending. Recording loss independently confirmed; t454 has fail-first reproduction and begins scoped repair.
- Follow-up: sync/rebuild headed B/C/D, freeze Core3291fb25 during qualification, full debug plus separate zero-model replays; t454 integration after streaks. No unchanged relaunch or model output cap.

### 2026-10-11 — Feedback unit passes; recording restart defect reproduced
- Agent: Codex senior supervisor; B/C feedback and recording-measurement workers.
- Changed: t452 source and architecture committed in both task branches, integration underway. t453 generic judge prose and delivery/pin tests ready for t452 sync. Recording source remains untouched.
- Why: complete current-output gates and investigate provider-free recording backlog without adopting conflicting storage WIP.
- Validation: root actual final Core build passed 45.249 s/7218 outputs; cache-free Core typecheck exit 0, actual downstream freshness/source/test check 9.577 s, both audits pass. Root runtime 50 + final wiring/receipt 17, UI 114, domain 15; final worker source tests 107/8 pass. t381 probe worker reproduced unique-identity 32-entry timeline: in-process 32, typed SQL 31, fallback file 1, restart loader returns 1; only first append fell back to file, later appends used SQL. Root reproduction review still owed.
- Outcome: Feedback unit accepted for integration. Recording has a persistence/read-owner split hypothesis supported by source and counts, not merely slow connections; no browser backlog resolution claimed.
- Follow-up: finish t452, sync t453 and independently gate; preserve measured restart evidence, write bounded recording-owner fix brief. Next paid tests retain $0.25 preflight and unchanged task/oracle gates.

### 2026-10-11 — Supervisor confirms D's visible false success
- Agent: Codex senior supervisor.
- Changed: t453 generic verification brief and t452 modularity ownership; no new paid run.
- Why: D's real ending panel says Passed although its independent oracle failed; shared feedback source must obey existing depth/directory/file budgets.
- Validation: root visually inspected D ending and mid-build actual side-panel images. Ending states six rows passed (aggregate before/after) and Run finished; saved flow-lane independently says candidate revision 4 yes/two judge calls, runtime succeeded/reported passed/oracle failed. Mid-build repeats a Read list card and exposes a camelCase field key in its prose; tracked UX follow-up. Root t452 runtime four owning files 50/50 passed in addition to UI 114/114/domain 15/15; fresh combined build/domain check passed before final receipt-path relocation, so final relocated build/check/audit still owed.
- Outcome: False-positive UI is confirmed from pixels, not just metadata. D prompt-only fix tests delivery and does not establish deterministic quantity interpretation.
- Follow-up: final current-source package gates; t453 inclusion/exclusion/quantity prompt, regenerated owning pins; changed-source $0.25 live proof. Defer unrelated UI labels/cards to planned UX phase.

### 2026-10-11 — Generic fixes underway; D false acceptance evidenced
- Agent: Codex senior supervisor; t452 B/C workers and D-debug worker.
- Changed: C's domain web-7 category/type evidence sentence and Core bare-count failure-card fallback; B fail-first candidate cache/stall/wrong-control regressions. Full B/C reports/debugs committed and merged with retained workspaces; both source/evidence devs pushed.
- Why: repeated accepted submissions received conflicting legacy advice; wrong-control advice assumed semantic intent; C failure card displayed identical counts as a contradiction.
- Validation: supervisor independently reviewed C diffs and ran UI 114/114 plus domain instructions 15/15; full combined source checks pending stable B edits. D worker inspected actual three judge requests: original instruction, omitted row and exclusion accounts present; both candidate judges and runtime judge still answered yes. No evidence omission/confirmation leakage established; supervisor request-level review owed.
- Outcome: Partial feedback unit; generic semantic judge follow-up must not embed task/oracle answers. No new paid launch.
- Follow-up: actual combined typechecks/build/audits and root owning tests; D generic acceptance proposal; ready preflight must show configured $0.25 before changed-source runs.

### 2026-10-11 — User raises future testing purse; round four ends
- Agent: Codex senior supervisor.
- Changed: future per-test ceiling authorized at $0.25 via launch environment; historical $0.10 run evidence unchanged. t380 verified fixture task integrated downstream/Core after all active runs ended.
- Why: user saw near-passes and authorized more room for correction/judging. Semantic and playback failures still require diagnosis and fixes.
- Validation: B sealed entry/summary/evaluation independently failed, $0.096883188, 27 calls, no Flow; D independently failed $0.088619448/29 calls, flowCreated true but oracle failed. A remains fully qualified; no round-four B/C/D end-to-end pass. Budget owner code accepts configured test environment 0.25 and threads test scope to isolated Core; dry-run confirmation required at next launch. t380 finish downstream audit passed; Core finish used --skip-checks only after actual supervisor 45 tests/typecheck/build/audit under newer narrow-gate rule.
- Outcome: No active paid streak; no unchanged relaunch. New paired t452 prepared for bounded generic feedback fixes.
- Follow-up: finish B/C/D full debugs; t452 feedback work, sync/rebuild and verify $0.25 preflight before changed-source qualification.

### 2026-10-11 — B/C first attempts failed; no unchanged relaunch
- Agent: Codex senior supervisor; live-b/live-c workers.
- Changed: lane-owned failure debugs in progress; source pair remains frozen for D.
- Why: qualify actual build behavior, not compilation or accepted submission alone.
- Validation: C sealed bundle entry/summary/evaluation independently agree failed, cost $0.088334076, flowCreated false, no oracle verdict. Worker observed 17 calls and accepted revision 2 trial. B worker reports failed $0.096883188/27 calls: revision 3 reset trial executed successfully but not_judged and no promotion after purse stop; supervisor full receipt review owed. No balance error reported.
- Outcome: B/C do not qualify; no separate replay or second paid creation is authorized on unchanged failed source. D remains active.
- Follow-up: complete every-step/UI debugs, isolate generic feedback/unchanged-resubmission/purse cause; prepare bounded fail-first fixes and requalify on changed source after active D streak ends. Do not cap provider reply length or alter tasks/oracles/purse.

### 2026-10-11 — Fixture task independently verified; all live identities confirmed
- Agent: Codex senior supervisor.
- Changed: t380 supervisor report and baseline regenerated through owning command, lowering only two counts; live source unchanged.
- Why: independently validate recovered test-fixture work without invalidating active paid streaks.
- Validation: t380 merged current Core dev; actual fresh owner library build (181.800 s), cache-free typecheck exit 0, structure audit exit 0; 45/45 tests in five owner/consumer files (115.26 s), including 16 rebuilt child-process race/crash probes. B/D four running identity receipts independently read: all verified true and observed payloads equal expected, as already confirmed for C.
- Outcome: Fixture unit ready for local commit/integration after streaks. Live run outcomes still pending; no balance stop observed.
- Follow-up: preserve frozen live pair; inspect each completed run and separate replay before signing a gate.

### 2026-10-11 — Round-four attempts admitted
- Agent: Codex senior supervisor; live-b/live-c/live-d workers.
- Changed: lane-owned expectations, preflight reports and new run debugs; runtime evidence through owning Lab.
- Why: verify integrated fixes in real headed extension chat against unchanged tasks/oracles.
- Validation: all three owning build/dry-run preflights exited ready with zero calls. Single launches: C run-mv4mhz5r-7ad281b1, B run-mv4mj8ef-1d0b141f, D run-mv4mjpig-fa4a3f4f. Supervisor independently inspected C's four running identity receipts: actual Core/host/server and extension background/content match expected, all verified true.
- Outcome: Partial; live outcomes and separate replay gates pending. No source changes, overrides or user-panel management.
- Follow-up: debug before another launch; failure requires changed source, balance error stops all paid work. t380 supervisor fresh build/typecheck/audit pass; 45 owning fixture/process tests running in isolated tree, integration held.

### 2026-10-11 — D completion/default integrated; live pair frozen
- Agent: Codex senior supervisor; b-debug/a-review/c-validation workers.
- Changed: t449 optional-path accounting and safe terminal feedback; t450 configured candidate default; preserved explicit legacy and omitted-mode raw API compatibility. Both dev branches pushed: downstream d1e516e6, Core b27c0d64. Slot 1 transferred from inactive t274 to t451/C after confirming no old process.
- Why: D's legitimate conditional bypass falsely failed completion; A's signed qualification enabled the planned default change.
- Validation: supervisor D owning tests 110/110, then 47/47 after integration; default tests 96/96, then combined owner checks 26/26; actual fresh Core typechecks/library builds, downstream freshness/typecheck and both structure audits passed. No full-suite merge gate run.
- Outcome: Accepted source pair; B/C/D isolated headed runs preparing with current library builds and zero-call preflights. Core dev remains frozen during their streaks.
- Follow-up: independently inspect live identity/oracle/accounting/replay receipts. t380 worker checks pass but supervisor verification/integration waits; t381 conflicting storage WIP remains unmerged.

### 2026-10-11 — A qualified; recovered C/B source integrated
- Agent: Codex senior supervisor; a-review/c-validation/b-debug workers.
- Changed: recovered A/B lane evidence merged with task boundaries and retained workspaces; t274 source integrated in both repositories; stale main/recovery Current State reconciled, 64 prior MVP ledger entries archived.
- Why: A lacked two separate replays and C's existing fixes were still dirty; B's final counted turn wrongly withdrew trial tools.
- Validation: supervisor Core six owning files 80/80, nonincremental Core typecheck exit 0, domain instructions 14/14, domain freshness/check matching successful stamp; final Core audit exit 0 and downstream task-finish audit passed. Both A replay receipts independently passed exact unchanged hashes, disabled model wiring, five zero counters and independent goal. Core finish's whole-suite invocation bypassed only after actual narrow checks under the current user rule.
- Outcome: Accepted bounded source/evidence unit; fixed-source B/C/D live behavior still owed.
- Follow-up: finish t449/t450 verification/integration, then live qualification; t380/t381 remain tracked follow-ups.

### 2026-10-11 — Continuation started and failures traced
- Agent: Codex senior supervisor; workers a-review, b-debug, c-validation.
- Changed: execution briefs and Current State; t449 paired worktree provisioned; owned lane reports/debugs recovered.
- Why: user authorized execution; qualification requires missing replays and fixes for actual failed build paths.
- Validation: supervisor read both A running identity receipt sets (`verified: true`) and 4/4 held task facts; inspected D trial results/run-summary metadata: trials 2-4 failed at a terminal node with unvisited nodes and all displayed steps successful. `pnpm.cmd task start trial-completion-feedback --worktree --core` -> t449 created successfully.
- Outcome: Partial; A replays and narrow C/B/D fixes in flight.
- Follow-up: independently verify workers' source/test results, integrate downstream before Core, then requalify failed lanes.

### 2026-10-11 — Saved evidence and unfinished lane work reconciled
- Agent: Codex senior supervisor.
- Changed: this audit and the generated working index.
- Why: recover Claude's actual stopping point and order continuation without repeating passing proofs.
- Validation: `git status --short`, `git rev-list --left-right --count origin/dev...dev` -> dev refs 0/0 in both repos; PowerShell saved JSON projections -> R4a/R4b/A1/A2 passed, B/D failed at build; FluxIQ-related node process query -> none; `node scripts/structure-audit.mjs` -> passed (184 warnings, 646 baselined); `git diff --check` -> exit 0.
- Outcome: Accepted audit; implementation and live qualification review remain future work.
- Follow-up: Phase 0, then A qualification review and C integration; debug B/D before paid reruns.

## Open Questions

- Supervisor: do B/C/D qualify on the integrated source pair? Fresh live identity/oracle/accounting/replay review remains required.
- Supervisor: what causes B's independent recording-persistence backlog? Measure the actual append/finalization path before adopting storage WIP.
- Supervisor: does D's proposed adaptation hold preserve mandatory saved interruption behavior? Review before implementation.
- User, later release phase: identify the unfamiliar user for final acceptance; no answer needed for immediate recovery.
