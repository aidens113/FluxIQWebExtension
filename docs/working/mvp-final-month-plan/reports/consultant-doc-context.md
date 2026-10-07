# Consultant audit: working-document context and revised ordering

Worker: audit-plan-context. Date: 2026-10-06 America/Los_Angeles.
Brief: `mvp-final-month-plan.md`, consultant audit briefs, task t295.
Scope: documentation review and planning only. No source edit, git mutation, build,
test, browser, panel, Lab, provider call, or private runtime-data inspection.

## Outcome

The consultant's central recommendation is sound: separate discovery from a
candidate, and separate execution facts from acceptance conclusions. Claude's
stopping-point plan does the opposite in two important places: its second stage
still defines a draft as successful exploration steps, and its sixth stage delays
explicit candidate authoring until after general script/request tools and another
live round. Reverse those dependencies. Introduce independent acceptance first,
then a small candidate submission interface using the existing Flow/runtime model.

Do not repeat the historical integration work. t262-t280 and t281-t294 are recorded
as landed in the final handoff; the remaining issue is live qualification of the
integrated product and a bounded structural change, not recovering the old dirty
lane trees. Several older documents still say these changes are unimplemented.

Every top-level working document and every nested final-month Markdown file was
included in the review inventory. Coverage was section-focused: Current State,
phase/acceptance requirements and unresolved questions for top-level plans;
outcome, remaining-work and contradiction sections for historical nested reports;
full substantive stopping-point, consultant, structural, gap, adaptation and recent
live sections. This is not a claim to have read every historical validation
transcript or every old implementation hunk. The inventory below distinguishes
that coverage. No nested Markdown file was completely omitted at inventory time.

## Which documents control the next work

| Document/evidence | Authority now | Implication |
| --- | --- | --- |
| `mvp-final-month-plan.md` Current State, Claude handoff at 2026-10-07 05:10 UTC | Latest cross-repository handoff; that timestamp is October 6 locally | Start here. Four failed round-4 runs; round 5 cancelled; lane rebuilds interrupted; no lane with two consecutive accepted builds. |
| `structural-agent-plan.md` Current State and user decisions | Current design direction, implementation not started | Requests OFF by default; no debugger for JS; JS only after about three typed-node failures and scored partial. Its older stage order and defaults need revision. |
| `node-catalog-plan.md` Current State | Explicit user-requested full catalog audit | Interaction/reading reports exist; navigation/gaps stopped. Finish the audit, but fixing every node and adding many more nodes should not block the first trustworthy loop. |
| `first-class-data-extraction-plan.md`, October 7 update | Current extraction contract | One-page read, explicit Next page, do-while repeat, per-read collection, run-end processing; S1-S6 landed; C live proof and S7 remain. |
| `reports/week-review/report.md` | Retrospective causal evidence | Useful ranking; its ready/in-progress/open statuses predate the later landings and round 4. Not a fresh backlog. |
| `reports/week-review/numbers.md` | Bounded historical accounting with stated gaps | Roughly $17 and 190 paid launches, but early totals are archival; 78 ledger-period launches; stale background discovery limits current-build inference. |
| `archive/2026-10-06-pre-consultant-ledger.md` | Integration/validation history | Reconcile each old Partial report against supervisor integration rather than resurrecting its missing wiring. |
| `reports/mvp-gap-map.md`, `adaptation-loop-audit.md`, `ux-mvp-design.md` | Dated October 5 audits | Acceptance baseline and architectural findings; superseded implementation status must be reconciled with t267/t268/t273. |
| 30-day MVP plan and `MVP_AGENT_INSTRUCTIONS.md` | Product acceptance and prioritization | Create/run/adapt/learn/reuse comes before feature expansion; 26-item acceptance and clean-profile user journey still required. |
| `AGENTS.md` | Current operations | Narrow merge checks; at most two full sweeps daily; four isolated live slots; no panel management unless authorized; supervisor alone integrates. |

## Reconciled workstream and dependency map

"Landed" below means the latest supervisor ledger records verified integration.
This worker did not independently verify commits or source; the supervisor and
the two code-audit workers must confirm those claims before executing the plan.

| Workstream | Already landed/history | Actually pending | Dependency/acceptance |
| --- | --- | --- | --- |
| Lane consolidation | t262 integrated October 5; lane port chain t263-t266/t273 and older lane snapshots reconciled/retired | Verify current paired heads and lane worktree identity, rebuild active lanes; lifecycle cleanup only after evidence retained | No launch from an interrupted or stale build; no new bulk reintegration of t174/t193/t194/t195. |
| General authoring | t252 row/input authoring; t269 saved-row reconstruction; t270 plus t273 `$step` wiring; D route states and enforcement | Preserve these contracts in candidate submission and execute via normal runtime | `$row`, `$input`, earlier outputs, optional routes, loops, selected subflow and parent topology all need candidate validation. |
| Instruction interpretation | t264 shared instruction authority; t285 pickup/earliest-choice parsing; t273 route wiring | Original-source outcome requirements; materially ambiguous choices; independently check omitted qualifiers | Page possibilities do not determine user intent. Spain seller location must not stand in for shipping origin. |
| False acceptance/acts | t285 claimed acts receive own-step evidence and immediate refusal; round-4 no-visible-change/opener/clearing fixes | Stop claiming requirement completion from a label, generic page change, or other step's proof; separate create versus ensure | Fence all entry points, including held amendments; no browser-specific commerce ontology in Core. |
| Judges | t264/t274 rows/end-page/change evidence, t286 startView/current-run evidence and no-change ending, t280 definitions | Trusted facts with provenance; requirement satisfied/unsatisfied/unknown; concrete contradiction wins; calibrate semantic review | More summaries and two agreeing models are not independent proof. Missing/withheld evidence cannot count as automatic pass. |
| Read-list redesign | S1-S6 collection, do-while, explicit Next page, judges consuming final answer; provider-free five-page proof: 17 collected, 13 answer | C current-worker live proof, legacy read-internal-paging retirement S7; D zero-kept-row leakage and completeness defects | Preserve read once per page and custom-between-page logic; zero rows is valid data when it answers intent, not proof of all-result coverage. |
| Typed browser actions | Existing click/type/check/etc., t281 swatch targeting, t289 large-page capture improvement | Ranked shared fixes from full catalog audit: checkbox desired state, type/date/number behavior, native dialogs, in-place Next page, all-match asserts/waits, scroll containers | Prove capability on real browser; repeated synthetic events do not become trusted input. |
| General computation/script/request | Stage-1 design cancelled before report; older JS task t029 is historical held work | Feasibility and packaging design, pure serialized-data computation first, bounded domain capability only for genuine gaps | User's requests toggle and no-debugger rule stand. Approval/permission classification must precede writes, not infer authorization after effects. |
| Adaptation/promotion | t267 product caller, fully-adaptive Lab playback, goal-only repair replay, awaiting-judged-run target override, held reauthor; t273 chat Run it and learning words | One candidate lifecycle; eliminate apply-before-judge topology exception; crash/restart settlement; full realistic-site live chain | Accepted saved Flow unchanged until revision-scoped run verifies; failed/unknown candidate cannot replace it. |
| Cheap recovery/control/budget | Refusal ways out, frame-stable digest, three same-kind refusal stop, shared purse/call admission and Lab-only .10 default | Bound material-progress cycles, preserve verification/one repair reserve, expose command uncertainty and scope retries | Existing parser/refusal failures count as spent model decisions, not executed Flow attempts. Do not raise .10 or 48 by consultant inference. |
| Decision replay | Saved Flow replays already zero-call; replaying AI decisions is only a plan | Controller recorded-decision replay, divergence handling, model checkpoints separately | A controller replay cannot prove a new prompt/tool interface is understood. |
| Activity/chat/UI | t265-t288 extensive chat/overlay/plain wording; t273 learned message; t268 extraction caret/table/feedback and deep links | Stop run/build; pause/takeover/handback extension surface; onboarding; actual live review and Firefox popup | Stop handler without reachable UI is not delivered control. Build spending must be cancellable before broad paid rounds. |
| Release/hardening | Packaging/icon/build-stamp foundation; historical Week 1 foundation accepted | Unknown-write reconnect, browser/Core restart, tab loss, install/update clean profile, CI, diagnostics/privacy, performance and RC | Build alone does not certify Chrome/Edge or Firefox. Keep 26 acceptance items mapped to observed evidence. |
| Reusable context/cache | Older llm-production plan has protected-context foundation gated OFF | Re-audit only if needed for MVP; do not turn caching into new critical-path subsystem | Cheap reuse is saved deterministic behavior, not requiring historical-context retrieval each run. |
| Agent/process tooling | Task/worktree/prune tooling present; narrow gates and off-peak guard later supersede old process rules | Remove conflicting old operative instructions via pointers; preserve run evidence before retiring worktrees | Reports still say uncommitted because written before supervisor landing; that is historical, not pending. |

## Open lane defects at the actual stopping point

| Lane | Remaining evidence from Current State / round-4 reports | What must prove the fix |
| --- | --- | --- |
| A, crossborder hub-to-cart | C1b choice claim judged when made; generic choice/add attribution; prior reversal/target defects now landed | All four exact runtime facts on two consecutive creation builds; zero-call fresh-state replays; wrong-choice decoy rejected. |
| B, bigbox pickup cart | 1b chooser opener counts as store set; lasting-step rerun only checks and says changed nothing; shipped-only lookalike | Five exact cart/store/fulfillment facts, both requested items correct; remembered-store and fresh-store start variants. |
| C, earbuds list | R4-1 stale worker fixed; R4-2 repair adds Next page through amendment; R4-3 Plus-badge misread | Current-worker explicit read/Next/repeat path, 13 ordered records and 52 fields over all five pages, no legacy internal pagination dependence. |
| D, confirm requests | D4-2b repeat attached to interruption Close chat; D4-3 no redetect after first confirm; D4-4 correct filter blamed; D4-5 rejected rows returned when keep none | Every eligible requested row acted on, no ineligible action, four exact records; loop after interruptions and no fabricated post-withheld-action success. |
| UI all lanes | R4-U-1..4 and lane-local round-4 wording/progress failures | Inspect actual headed panel/overlay, not prose emitted by unit fixtures; do not credit stale-worker background UI changes. |

This list is an intake, not a prescription for seven more exceptions. For each
item first ask whether the new candidate/verification boundary removes it; fix
the browser/domain cause only where it remains independently broken.

## Consultant critique and additions

### 1. Exploration versus candidate submission: adopt early, keep existing runtime

Agree with the consultant. Clause B8 in the structural plan should precede new
authoring grammar, expensive general tools, and the next structural live round.
The proposed "steps that ran and worked" draft still treats exploratory history
as a program. Smaller remove/redo/move/optional/repeat vocabulary reduces wording
but leaves the trust and retention problem.

Start with one complete candidate submission behind a project/build flag. Reuse
the existing plan/graph schemas, registration, normalization and executor. Core
assigns revision/digest and validates node schemas, bindings, references, graph
termination, routes and permission requirements, returning one diagnostic report.
Subflow replacement can follow only when measured candidate sizes justify it.
The same model may inspect, submit, inspect again and resubmit; no new multi-agent
build pipeline is required. Recorded actions remain evidence beside instructions.

Add explicit migration gates: old saved Flows remain executable; new-path labels
cannot grant acceptance; topology updates are revision-bound; candidate count/size
are bounded; nested/selected-subflow behavior is not silently flattened.

### 2. Independent acceptance: stronger than page-change attribution

Agree, with a small vocabulary instead of a universal ontology. Requirements
keep exact original instruction references and distinguish outcome, constraints,
create/ensure semantics, required coverage and consequential effects. Core owns
generic trusted predicates and revision/run evidence identity. The web domain
supplies observed facts, provenance and completeness.

Add temporal/source scope: snapshot/page generation, row/record identity, frame,
time of action and before/after evidence. "Cart count rose" alone cannot establish
the correct product, quantity, color, shipping origin and fulfillment mode. A
page change indicates execution evidence, not automatically requirement proof.
Submitted scripts/predicates or model-origin rows never authenticate their own
facts. An independent semantic judge uses the original requirement and observed
evidence; agreement/confidence cannot override a concrete mismatch or missing
field. Unknown stays draft/unverified and remains visible to the user.

Ensure legitimate no-op desired-state success remains possible. A setting already
enabled can satisfy ensure; creating a new record needs evidence of a new effect
attributable to this run. The round-4 blanket unchanged-press refusal should not
become a universal ban on idempotent actions.

### 3. Declared start state: required before live acceptance, careful outside Lab

Agree. The current read-based build test can check the environment discovery
left behind, and lasting actions are intentionally not replayed there. That
check is useful preflight, but cannot establish execution of the saved candidate.
Use isolated resettable Lab state and normal runtime to test the candidate.

Make start-state declarations concrete: page/route, relevant stored site settings,
cart/record state, variant-arm timing, fixture reset identity, candidate digest and
compatible build pair. Record whether each verification run used declared fresh
state or intentional remembered state. Test both when the requirement is ensure.
On real accounts use reversible discovery and supervised first execution; a
withheld money/send/delete action is explicitly untested, not automatically
successful. Never repeat external writes to obtain a cleaner run.

### 4. Browser primitives and fallback: preserve user policy, narrow the dependency

Agree with desired-state check/type and durable target descriptions resolved afresh
from role/name/context/attributes/frame. Handles are efficient snapshot references,
not an architectural defect by themselves. Queryable bounded observations should
name completeness/continuation and be available by region/row/field rather than
replacing the current page contract with another whole-page dump.

The consultant's suggestion to defer a comprehensive catalog audit conflicts
with the user's explicit audit request. Finish all four read-only audit families
and keep the complete ranked list. Defer wide catalog expansion from the critical
path; implement only shared primitives blocking the selected task families first.

Move pure computation over serialized data ahead of unrestricted in-page JS.
General scripts require a browser-channel/CSP/MV3/store feasibility decision,
pre-execution authority, logging, time/size limits, row sensitivity handling and
replay semantics. Post-execution page/network change cannot retroactively make
an unauthorized effect permissible; method alone cannot tell whether a request
is safe. Requests stay OFF by default in config and settings; JS remains last
resort after about three failed typed attempts and partial-success scoring.
Trusted-input-only sites may remain explicitly unsupported under the no-debugger
policy; do not pretend extra synthetic events or JS solve `isTrusted` restrictions.

### 5. Unified candidate lifecycle and budgets: reuse existing work, close exceptions

Agree. Bootstrap, target repair, reauthor and temporary recovery may propose
different candidates but should share validation/execution/verification/promotion.
Temporary recovery getting the live session unstuck is not a reusable saved repair.
Evidence is scoped to candidate revision AND run; edits invalidate old verdicts.
Candidate promotion needs current accepted-revision concurrency checks and durable
settlement on crash/cancel/disconnect. `No change` is a legitimate result.

Do not reimplement t267 held/judged machinery; extend it. Its report explicitly
retains an `appliedBeforeJudged` fallback for topologies that cannot run alone,
and reports pending held edits surviving a process death. These are priority
exceptions to audit, not evidence the whole lifecycle is absent.

Prefer global hard limit plus protected verification/one bounded repair reserve
and flexible discovery/authoring allocation. Phase budgets must be controller
accounting, not another model grammar. However the user's Lab .10/48 and model
constraints are current decisions. Consultant flexibility is not authorization
to raise them. Keep per-build ceiling and total learning spend distinct: the
week report records seven runs above .10 total despite every build below it.

### 6. Prompt, replay and module boundaries: make cheap checks early

Agree with smaller high-signal context and two or three representative worked
examples. Measure before/after bytes, tokens, cache-prefix stability, calls and
cost per correctly verified reusable Flow. Delete rules only after their owner
is obsolete and a negative regression case proves the invariant still holds.
Do not truncate source evidence silently to hit a prompt-size target.

Recorded-decision replay exercises deterministic controller transitions. Stop at
changed observation/tool-schema/candidate divergence or branch explicitly; do not
replay an impossible continuation as an agent pass. Model checkpoint evaluations
are different and need paid calls under current policy. Full live runs prove the
complete system. Saved Flow replay proves execution without AI, a third mechanism.

Extract touched authoring, validation, evidence verification, controller and
promotion seams by responsibility, with one owner of `service.ts` integration.
No wholesale rewrite, repository migration, giant coordinator or multi-agent
authoring architecture is needed for this MVP.

## Recommended implementation and live order

| Phase | Required work | Exit before moving on |
| --- | --- | --- |
| 0. Trust the test environment and user control | Confirm source/build pair, current running-worker identity guard, isolated reset state, explicit run/command identity; deliver reachable run Stop and build cancellation; reconcile node-audit navigation/gaps | Provider-free freshness mismatch and cancellation/unknown-write negatives pass. Existing data/profiles preserved. No paid round on an unidentifiable worker. |
| 1. Fence false acceptance | Requirement source/tri-state check contract, same-revision/run evidence, unknown/withheld/empty execution blockers, concrete contradiction precedence, topology promotion exception | Negative fixtures reject plausible wrong Flow, skipped action, only one configured item, wrong origin, invented script success, stale revision and missing evidence. Existing correct ensure-no-op is accepted on observed state. |
| 2. Small candidate path | Separate discovery notebook from submitted full Flow, reuse runtime schema/executor, revision digest/consolidated diagnostics, feature flag and migration | Provider-free representative multi-node and row/list candidate compiles/runs without legacy editing conversation; discovery transcript never silently edits candidate. |
| 3. Candidate test and shared promotion | Declared start conditions, normal-runtime execution, deterministic/semantic checks, held candidate for every topology, crash/cancel/no-change settlement; flexible verification reserve | Saved accepted Flow remains byte/topology-identical for failed/unknown/stale candidate; candidate verified from declared state promotes once. |
| Alongside 1-3 | Selected typed-node blockers, observation/locator completeness, computation feasibility, controller replay and touched-module extraction | Shared capabilities work in affected browsers; no file overlap during edits/validation. General JS/request implementation is not a universal prerequisite. |
| 4. One current-build A-D measurement round | Freeze rebuilt pair and worker stamp; predeclare exact oracles and costs; headed real extension chat; off-peak supervised one start per lane | Each run fully debugged. Correct-but-refuted and wrong-but-accepted recorded separately. No immediate unchanged-source failure rerun. |
| 5. A-D qualification | Fix structural residuals, rerun only changed affected source; two consecutive accepted creation runs per lane, then saved zero-call replays from declared state | Exact A/B facts, C 13 ordered rows/52 fields/all pages, D exact eligible actions/four records; no JS counted as full typed-node pass. S7 waits for C live proof. |
| 6. Adaptation thesis | Target drift, inserted/reordered step, extraction/loop repair on three realistic sites; product Run/chat entry included | Same run recovers/continues; candidate verified before apply; persisted repair displayed; repeated learned execution zero-call including restart. Two qualifying chains per site. |
| 7. Breadth and recording evidence | All ten sites with at least one creation and repair family; Phase 1b instruction+recording after A-D only; mistaken/detour recording tests | Bounded qualification matrix and cost per success; recording cannot override intent or persist accidents. |
| 8. UX, hardening, packaging and RC | Onboarding, pause/takeover, live activity, Firefox/Chrome/Edge parity, diagnostics/privacy, interrupted operations, performance, clean install/update, thirteen-step RC and 26 acceptance items | Nontechnical fresh-profile user succeeds with no developer intervention; unsupported families and partial verification explicitly disclosed. Main/store actions still need explicit approval. |

The October 29 freeze and November 10 deadline remain planning targets. Use
behavioral gates rather than claiming the original October 7 consolidation and
October 12/13 structural dates are guaranteed. The first trustworthy end-to-end
candidate is the risk-reduction milestone; scripts, catalog expansion, and broad
corpus sweeps cannot consume all time before adaptation gets live proof.

For phases 4-6, retain four-lane isolation, headed extension chat, realistic ten
sites, off-peak guard, actual spend ledger, full debug before another launch and
supervisor observation. Builds/checks do not constitute live success. Full suites
remain at most twice per day; touched package types/owning tests/structure are the
integration gates. No panel process is started by this audit.

## Acceptance gaps and exact plan edits to carry forward

1. Replace old Phase 0 integration instructions with completed-history pointer;
   keep environment rebuild/freshness and safe lifecycle cleanup as pending.
2. Replace P5/B7/C4/D-phase-1 implementation backlog with their landed state and
   current regression/live proof obligations. Move C1 paginate:true history under
   legacy migration because it is superseded by explicit Next/read/repeat.
3. Update extraction caret/table/feedback and adaptation deep link to implemented,
   unproven live. Do not resume them as t224 unimplemented source tasks.
4. Add universal topology candidate isolation and held-edit crash settlement to
   Phase 1 structural work, rather than defer them as release-only polish.
5. Add visible Stop and build cancellation before paid structural rounds. Existing
   run-control APIs are reused for pause/takeover, with extension permission/relay/
   activity/UI wiring and browser proof; no duplicate parking-based takeover.
6. Keep source-derived learned wording/applied-only counts as implemented and require
   live proof in the repair chain. Suggested or held adaptations must not say learned.
7. Replace the recorded-Flow `crossborder-marketplace-repair-basket-redesign` with
   the instruction-built basket-redesign-after-creation task added by t267 when
   choosing Phase 2 creation/repair proof. Keep original task only as explicit
   recorded-Flow coverage outside language-only metrics.
8. Distinguish three replays in the plan: saved Flow deterministic replay, recorded
   decision controller replay, paid checkpoint model evaluation. Each has a different
   acceptance claim.
9. Add coverage/completeness to extraction checks: partial result cannot prove all
   records/cheapest item. Optional missing fields must not silently disarm intent.
10. Add uncertainty reconciliation after potentially completed writes; missing ACK
    is unknown, never automatic replay. Test same command after reconnect against
    observed state without duplicate money/send/create/delete effects.
11. Preserve production versus Lab budget separation and per-build versus total
    learning-spend measurement. Record false acceptance rate beside cost/pass rate.
12. Release checks include actual product Run, approval/continue, browser/runtime
    restart, Firefox popup lifetime, no-key onboarding, Stop during build and run,
    sensitivity in rows/export/trace, and clean-profile update/installation.

## Contradictory or superseded statements

| Location | Stale/conflicting claim | Resolution |
| --- | --- | --- |
| Structural Open Questions | Default debugger on Chrome/Edge; requests to any origin | Current State explicitly forbids debugger for JS and keeps requests OFF. Old defaults must not authorize implementation. |
| Structural stage 2 versus stage 6 | Draft remains successful exploration steps before discovery split | Consultant-driven edit moves explicit candidate separation before another editing grammar/live round. |
| Final-month old schedule | Land t262; implement B7/C4/P5/D phase 1; resume held caret/table/feedback | Supervisor October 5 ledger says landed; retained only as history. |
| Old week report | t279 ready; t281 in progress; read redesign/open off-peak/killed-spend | Latest handoff says all those units landed; new round-4 defects are the pending set. |
| Gap map/Week 2 exit | Recovery unable to press/type/nav; forced manual mode; Resume absent | October 5 adaptation audit disproves those claims; t267 implements blockers. Live complete chain still unproven. |
| t267 heading/blocker table | All reauthors held until judged; chat Run it still undone | Detailed S4 includes apply-first topology exception; t273 later wires chat. Preserve nuanced status. |
| UX gap map | Stop implemented | UX design shows handler without UI sender since Simple Mode deletion; builds lack cancellation. Source audit confirms current truth. |
| General authoring Current State | `$step` returns step_binding_not_yet | t270+t273 later implement/wire it; carry live proof obligation. |
| Conversation/production/runtime plans | No implementation dispatched; old call grants/12 KB/40 controls; F: Core paths | Historical. Current conversation, evidence, policy and C: sibling path are authoritative. Do not restart old grant/caching designs. |
| Module-size-governance Current State | Extension has no unit runner; zero unit tests | Facility audit and later UI reports record thousands of extension tests. Treat as old split-era limitations, not current infrastructure. |
| Lab/old loop prose | One slot, memory floor, faulty-RAM explanation, per-run command approval | Current AGENTS/final handoff supersede: four isolated slots, trace product/Lab defect, existing authorization rules. |
| Recording Open Question | Unsure demonstrate scope; one smoke default | Latest user Phase 1b says recording evidence + mandatory instructions after A-D, including deliberate mistakes. Use that explicit decision. |
| Week-review numbers/report | Round-3 .46 versus numbers .3521, some Lab pass versus product terminal failure | Different accounting cutoffs/buckets; do not combine without definition. Report historical estimate and its coverage, not exact causal savings. |

## Validation and limits

Only PowerShell/Get-Content/rg reads and this authored report write were performed.
No code defect is independently confirmed by this documentation worker. Historical
test results are quoted as supervisor/worker evidence, not re-run here. Code audit
claims, current git ancestry, live worker/build equality, prompt execution-channel
feasibility and current Stop control require supervisor integration with the other
audit reports. No external consultant source links were independently verified;
its product/architectural recommendations are assessed against repository docs.

No nested report was omitted wholesale; report-body coverage is section-focused,
and archived validation transcripts are not line-by-line re-read. Nested documents
created by other audit workers after the review started are not prior Claude work
and are outside this inventory. The list below is generated from the observed tree
and records each top-level/nested path, rather than guessing from links.

## Read inventory

Top-level entries: Current State where present, phase/acceptance and unresolved
question sections reviewed; latest relevant ledger/implementation sections traced
through the final handoff. Nested entries: outcome/current-status and unresolved/
not-verified sections reviewed; recent lane/UX/adaptation/gap and stopping-point
evidence read more deeply. All are documentation reads only.

Top-level working documents: 32.

- `docs/working/action-visual-entity-target-plan.md`
- `docs/working/agent-git-workflow-plan.md`
- `docs/working/agent-token-efficiency-plan.md`
- `docs/working/agent-working-doc-protocol.md`
- `docs/working/automated-testing-facility-plan.md`
- `docs/working/bootstrap-no-proposal-investigation.md`
- `docs/working/claude-work-handoff-2026-10-03.md`
- `docs/working/codex-tasks-2026-09-30.md`
- `docs/working/codex-ui-ux-review-2026-09-30.md`
- `docs/working/extension-runtime-capabilities-plan.md`
- `docs/working/extension-ui-rebuild-plan.md`
- `docs/working/first-class-data-extraction-plan.md`
- `docs/working/flow-authoring-and-defensive-runtime-plan.md`
- `docs/working/flow-build-quality-and-lab-budget-plan.md`
- `docs/working/fluxiq-conversations-plan.md`
- `docs/working/general-flow-authoring-plan.md`
- `docs/working/lab-port-allocation-plan.md`
- `docs/working/language-driven-flow-loop-plan.md`
- `docs/working/live-activity-chat-plan.md`
- `docs/working/llm-production-automation-plan.md`
- `docs/working/manual-panel-test-findings.md`
- `docs/working/module-size-governance-plan.md`
- `docs/working/mvp-final-month-plan.md`
- `docs/working/mvp-live-continuation-2026-10-03.md`
- `docs/working/mvp-today-plan.md`
- `docs/working/mvp-week1-web-automation-reliability-plan.md`
- `docs/working/mvp-week2-automation-loop-plan.md`
- `docs/working/node-catalog-plan.md`
- `docs/working/README.md`
- `docs/working/repository-state-audit.md`
- `docs/working/structural-agent-plan.md`
- `docs/working/week2-exit-plan.md`

Nested final-month Markdown files: 136.

- `docs/working/mvp-final-month-plan/archive/2026-10-06-pre-consultant-ledger.md`
- `docs/working/mvp-final-month-plan/archive/2026-10-06-pre-consultant-schedule-and-briefs.md`
- `docs/working/mvp-final-month-plan/reports/adaptation-loop-audit.md`
- `docs/working/mvp-final-month-plan/reports/fix-act-claims.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges-a.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges-b.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges-c.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges-d.md`
- `docs/working/mvp-final-month-plan/reports/fix-judges-e.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/a-peak-and-stop.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/c-start-thread.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/e-mut4fvkm-terminal.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/f-timeouts-and-stale-builds.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/g-described-nodes-cache.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/h-authored-graph.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/i-content-specs.md`
- `docs/working/mvp-final-month-plan/reports/fix-lab-process/j-large-page-capture.md`
- `docs/working/mvp-final-month-plan/reports/fix-refusal-churn.md`
- `docs/working/mvp-final-month-plan/reports/fix-ui.md`
- `docs/working/mvp-final-month-plan/reports/lane-tree-reconcile.md`
- `docs/working/mvp-final-month-plan/reports/live-a.md`
- `docs/working/mvp-final-month-plan/reports/live-a-r2-fix-rerun-node.md`
- `docs/working/mvp-final-month-plan/reports/live-a-r3-f1.md`
- `docs/working/mvp-final-month-plan/reports/live-b.md`
- `docs/working/mvp-final-month-plan/reports/live-b-fix-1.md`
- `docs/working/mvp-final-month-plan/reports/live-b-fix-2.md`
- `docs/working/mvp-final-month-plan/reports/live-b-fix-r4.md`
- `docs/working/mvp-final-month-plan/reports/live-C.md`
- `docs/working/mvp-final-month-plan/reports/live-C-r2-ui-review.md`
- `docs/working/mvp-final-month-plan/reports/live-C-r3-ui-review.md`
- `docs/working/mvp-final-month-plan/reports/live-C-r4-next-page.md`
- `docs/working/mvp-final-month-plan/reports/live-C-r4-ui-review.md`
- `docs/working/mvp-final-month-plan/reports/live-C-ui-review.md`
- `docs/working/mvp-final-month-plan/reports/live-d.md`
- `docs/working/mvp-final-month-plan/reports/mvp-gap-map.md`
- `docs/working/mvp-final-month-plan/reports/r3-a-loop.md`
- `docs/working/mvp-final-month-plan/reports/r3-c-paging.md`
- `docs/working/mvp-final-month-plan/reports/r3-c-tested-label.md`
- `docs/working/mvp-final-month-plan/reports/r3-d3-2-read-after-act.md`
- `docs/working/mvp-final-month-plan/reports/r3-d3-5-judge-pair.md`
- `docs/working/mvp-final-month-plan/reports/r3-d-reach.md`
- `docs/working/mvp-final-month-plan/reports/r3-frame-digest.md`
- `docs/working/mvp-final-month-plan/reports/r4-d4-1-read-rerun.md`
- `docs/working/mvp-final-month-plan/reports/r4-d4-2-clearing-press-claim.md`
- `docs/working/mvp-final-month-plan/reports/r4-d-ui-review.md`
- `docs/working/mvp-final-month-plan/reports/sweep-2026-10-05.md`
- `docs/working/mvp-final-month-plan/reports/sweep-2026-10-07.md`
- `docs/working/mvp-final-month-plan/reports/t262-audit.md`
- `docs/working/mvp-final-month-plan/reports/t262-gate.md`
- `docs/working/mvp-final-month-plan/reports/t263-core.md`
- `docs/working/mvp-final-month-plan/reports/t263-domain.md`
- `docs/working/mvp-final-month-plan/reports/t263-tabs-assert.md`
- `docs/working/mvp-final-month-plan/reports/t264-core-chain.md`
- `docs/working/mvp-final-month-plan/reports/t264-docs-last.md`
- `docs/working/mvp-final-month-plan/reports/t264-s1-instruction-authority.md`
- `docs/working/mvp-final-month-plan/reports/t264-s2-w1-refusal-cards.md`
- `docs/working/mvp-final-month-plan/reports/t264-s2-w2-core-wording.md`
- `docs/working/mvp-final-month-plan/reports/t264-s2-w3-completion-check-run-ending.md`
- `docs/working/mvp-final-month-plan/reports/t264-s2-w4-wiring-and-tried-words.md`
- `docs/working/mvp-final-month-plan/reports/t264-s3-w5-judge-evidence.md`
- `docs/working/mvp-final-month-plan/reports/t264-s3-w6-stopped-round-and-finishing-verdict.md`
- `docs/working/mvp-final-month-plan/reports/t264-s3-w7-ending-wording.md`
- `docs/working/mvp-final-month-plan/reports/t264-s4-w10-routing-words-and-optional-only.md`
- `docs/working/mvp-final-month-plan/reports/t264-s4-w11-repeat-guard-and-brief-advice.md`
- `docs/working/mvp-final-month-plan/reports/t264-s4-w12-leftovers.md`
- `docs/working/mvp-final-month-plan/reports/t264-s4-w8-amendment-answers.md`
- `docs/working/mvp-final-month-plan/reports/t264-s4-w9-rerun-numbers-and-repeats.md`
- `docs/working/mvp-final-month-plan/reports/t265/background.md`
- `docs/working/mvp-final-month-plan/reports/t265/overlay.md`
- `docs/working/mvp-final-month-plan/reports/t265/panel-chat.md`
- `docs/working/mvp-final-month-plan/reports/t265-extension-ui.md`
- `docs/working/mvp-final-month-plan/reports/t266-suite-fallout.md`
- `docs/working/mvp-final-month-plan/reports/t267/c2-result-check-payer.md`
- `docs/working/mvp-final-month-plan/reports/t267/s1-catalog.md`
- `docs/working/mvp-final-month-plan/reports/t267/s1-playback-mode.md`
- `docs/working/mvp-final-month-plan/reports/t267/s1-repair-lane.md`
- `docs/working/mvp-final-month-plan/reports/t267/s2-judged-run-evidence.md`
- `docs/working/mvp-final-month-plan/reports/t267/s3-core.md`
- `docs/working/mvp-final-month-plan/reports/t267/s3-extension.md`
- `docs/working/mvp-final-month-plan/reports/t267/s4-judged-reauthor.md`
- `docs/working/mvp-final-month-plan/reports/t267/s5-creation.md`
- `docs/working/mvp-final-month-plan/reports/t267/s5-playback-ui.md`
- `docs/working/mvp-final-month-plan/reports/t267/s5-records.md`
- `docs/working/mvp-final-month-plan/reports/t267-adaptation-unblock.md`
- `docs/working/mvp-final-month-plan/reports/t268-deep-link.md`
- `docs/working/mvp-final-month-plan/reports/t268-extraction-ui.md`
- `docs/working/mvp-final-month-plan/reports/t269-c4-row-repair.md`
- `docs/working/mvp-final-month-plan/reports/t270-p5-step-binding.md`
- `docs/working/mvp-final-month-plan/reports/t271-d-route-states.md`
- `docs/working/mvp-final-month-plan/reports/t272-c1-pagination.md`
- `docs/working/mvp-final-month-plan/reports/t273-creation-wiring.md`
- `docs/working/mvp-final-month-plan/reports/t273-s2-w1-draft-grammar.md`
- `docs/working/mvp-final-month-plan/reports/t273-s2-w2-decision-grammar-and-wording.md`
- `docs/working/mvp-final-month-plan/reports/t273-s2-w3-route-wiring-and-completion.md`
- `docs/working/mvp-final-month-plan/reports/t273-s3-w4-step-decision-path.md`
- `docs/working/mvp-final-month-plan/reports/t273-s3-w5-step-draft-path.md`
- `docs/working/mvp-final-month-plan/reports/t273-s3-w6-run-it-and-learned.md`
- `docs/working/mvp-final-month-plan/reports/t274-c25b-checked-to-repair.md`
- `docs/working/mvp-final-month-plan/reports/t274-c25-judge-rows.md`
- `docs/working/mvp-final-month-plan/reports/t274-c3-build-test-stores.md`
- `docs/working/mvp-final-month-plan/reports/t274-c4b-carried-followups.md`
- `docs/working/mvp-final-month-plan/reports/t274-c4-carried-steps.md`
- `docs/working/mvp-final-month-plan/reports/t275-d-c1-worker.md`
- `docs/working/mvp-final-month-plan/reports/t276-core-cards.md`
- `docs/working/mvp-final-month-plan/reports/t276-core-ending.md`
- `docs/working/mvp-final-month-plan/reports/t276-ext.md`
- `docs/working/mvp-final-month-plan/reports/t276-live-ui-fixes.md`
- `docs/working/mvp-final-month-plan/reports/t277-core.md`
- `docs/working/mvp-final-month-plan/reports/t277-ext.md`
- `docs/working/mvp-final-month-plan/reports/t277-r3-ui.md`
- `docs/working/mvp-final-month-plan/reports/t279-r3-ui-ending.md`
- `docs/working/mvp-final-month-plan/reports/t280-node-definitions.md`
- `docs/working/mvp-final-month-plan/reports/t281-c1a-reversal.md`
- `docs/working/mvp-final-month-plan/reports/t281-c2-c3.md`
- `docs/working/mvp-final-month-plan/reports/t281-f1-replay.md`
- `docs/working/mvp-final-month-plan/reports/t281-f1-resolver.md`
- `docs/working/mvp-final-month-plan/reports/t281-w15-core.md`
- `docs/working/mvp-final-month-plan/reports/t281-w15-domain.md`
- `docs/working/mvp-final-month-plan/reports/t285/c-claim-refusal.md`
- `docs/working/mvp-final-month-plan/reports/t285/e-change-evidence.md`
- `docs/working/mvp-final-month-plan/reports/t285/fixtures-fulfilment.md`
- `docs/working/mvp-final-month-plan/reports/t285/p-page-change.md`
- `docs/working/mvp-final-month-plan/reports/t285/w13-instruction-choices.md`
- `docs/working/mvp-final-month-plan/reports/t285/w1-act-evidence.md`
- `docs/working/mvp-final-month-plan/reports/t287-refusal-next.md`
- `docs/working/mvp-final-month-plan/reports/t287-rerun-merge.md`
- `docs/working/mvp-final-month-plan/reports/t292-small-gaps.md`
- `docs/working/mvp-final-month-plan/reports/t294-lane-a-r4-fixes.md`
- `docs/working/mvp-final-month-plan/reports/ux-mvp-design.md`
- `docs/working/mvp-final-month-plan/reports/week-review/causes-early.md`
- `docs/working/mvp-final-month-plan/reports/week-review/causes-late.md`
- `docs/working/mvp-final-month-plan/reports/week-review/friction.md`
- `docs/working/mvp-final-month-plan/reports/week-review/numbers.md`
- `docs/working/mvp-final-month-plan/reports/week-review/report.md`
