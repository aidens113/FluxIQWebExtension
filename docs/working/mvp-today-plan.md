# MVP Today

Status: Superseded
Status detail: Superseded 2026-10-07 by [mvp-final-month-plan.md](./mvp-final-month-plan.md). Its "no provider call is authorized" and expired-GitHub notes are historical, not current rules.
Created: 2026-09-26
Last updated: 2026-10-07
Owner: Senior supervisor agent
Scope: Close the MVP loop in which an instruction becomes a Flow, runs deterministically, repairs itself when judged wrong, and judges its own answer. This plan owns the binding rules and live exit criteria; operating history remains in `language-driven-flow-loop-plan.md`.
Paired document: none
Related: [language-driven-flow-loop-plan.md](./language-driven-flow-loop-plan.md), [archived coordination](./mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md), [worker reports](./mvp-today-plan/reports/)

---

## Current State

**Purpose.** Apply three binding rules: every node executes defensively by default; only move-money,
delete, and send/publish consequences require a separate grant; and a judge's refutation carries
screened, actionable repair direction.

| MVP criterion | Current evidence | Still required |
| --- | --- | --- |
| Created from language | Run 2 built and reviewed a five-node Flow; runs 3 and 4 stopped before proposal after 26 build calls each. | A faithful Flow that returns the exact expected dataset under the default profile. |
| Runs deterministically | Run 2 executed through extraction and judgement; runs 3 and 4 produced no runtime or replay evidence. | Provider-free replay with the exact expected dataset. |
| Repairs itself | Run 2 routed wrong-answer recovery but failed before adaptation; runs 3 and 4 never reached repair. | A created, applied, persisted repair proven by deterministic replay. |
| Judges its own answer | Run 2 correctly refuted a 12-of-13 result; runs 3 and 4 never reached judgement. | Preserve the refutation through successful directed repair and post-replay judgement. |

**Implemented.** Defensive Core/browser execution, bounded provider retry, the risk-only permission
boundary, screened judge directives, and extraction/recovery changes are complete. After run 2,
Core also gained truthful three-state request provenance; exact held-grant continuation across the
authorized binding update; durable repair apply plus authoritative binding read; selected-Subflow
zero-provider replay; recursive judgement; enclosing terminal revoke; and fail-closed post-apply
provenance. These changes are locally validated but have not completed the live path.

**Pre-packing validation baseline.** The earlier Core root suite passed 3,994 tests with one intentional skip, and
Core `pnpm check` passed. Focused reconciliations passed t290 81/81, t293 51/51, and t304 web 11/11
plus Core 30/30. Downstream builds, equivalent package/structure checks, source identity, and all
six output-freshness comparisons passed. The exact provider-free command returned `ready`, the
intended isolated created-Flow request, default 26 calls, and zero provider calls. This is local/
readiness evidence that predates the current packing correction, not validation of the current tree
or live proof. The root task-fixture check remains machine-limited by inability to spawn `git worktree add`.

**Live run 1.** `run-muj2kzx1-8f9f8271` reached Stage 2 exploration and stopped before proposal.
All 26 provider calls were build calls: 360,775 input plus 5,435 output tokens, 366,210 total,
estimated USD 0.0573657. No runtime run id, dataset, judgement, repair, persistence, or replay was
produced. The last completion failed `bootstrap.cannot_answer_instruction`; the old loop exit then
misreported generic iteration-limit.

**Live run 2.** `run-muj39xl6-f6a5d4e5` is an accepted measurement with a failed product verdict.
It reached Stage 6: a reviewed five-node Flow ran, the oracle measured 12 observed records against 13
expected, and the model-backed judge refuted the answer. Recovery and result reauthoring routed, but
the stored failure was `flow_bootstrap.unexpected_error` under the service's broad `provider_request`
classification window before an adaptation, persistence result, or replay was published. T229 found
that this window begins before the actual harness call, so the record does not independently prove a
provider request was sent. The consecutive-pass streak remains 0.

**Run-2 accounting.** Evaluation records 21 calls. Build/main observation is one 19-call bucket
(239,801 input, 3,705 output, 243,506 total tokens, USD 0.03085158); two calls lack per-call records.
Repair observation and verification are the same two-call representation (5,930 input, 733 output,
6,663 total tokens, USD 0.0017178). These representations are not double-counted, and no combined
token/cost roll-up is published. Typed accounting reports zero breaches and zero pending calls.

**t217 correction.** Core preserves a final unusable issue through Flow Bootstrap's stalled
callback; ordinary usable non-completion still reports iteration-limit. Run 3 now validates this
live: exhaustion ended `flow_bootstrap.evidence_unusable_decision` with
`bootstrap.cannot_answer_instruction`. No budget, answerability, draft, or convergence rule changed.

**Run-2 evidence status.** Marker, index, and bounded structured artifacts passed byte, digest, and
redaction verification. This is a product failure, not a facility failure. It proves creation,
runtime, exact comparison, judgement, and recovery routing; not repair application, persistence, or
deterministic replay.

**Live run 3.** `run-mujd550n-e8fbe7aa` is an integrity-valid, redaction-verified failed product
measurement. It reached Stage 2 and stopped before proposal with
`flow_bootstrap.evidence_unusable_decision` at `provider_output_validation` and issue
`bootstrap.cannot_answer_instruction`. No Flow, runtime, oracle comparison, judgement, repair,
persistence, or replay was produced. The consecutive-pass streak remains 0.

**Run-3 accounting and evidence status.** Build and observed are one 26-call representation:
362,468 input plus 5,999 output tokens, 368,467 total, estimated USD 0.057534336; 25 calls are
itemized and one is unrecorded. There is no repair/verification bucket to add. The bounded artifacts
publish no terminal grant lifecycle property. The run proves truthful classification and a live
creation-reliability deficiency, not a deterministic leaf-code fault or the repair chain.

**Live run 4.** `run-muje0grk-4d8d2d3f` is an independently accepted, integrity-valid failed product
measurement. It again used all 26 build decisions and stopped at Stage 2 with
`flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`: 22 tool calls,
33 screened steps, 57,868 step-level evidence bytes, and 70,126 total summary evidence bytes. No
proposal or later-stage evidence exists. This fires the predeclared no-run-5 unchanged-retry rule.

**Run-4 accounting.** Build and observed are the same representation: 370,882 input plus 3,642
output tokens, 374,524 total, estimated USD 0.049289784. All 26 calls are itemized, with zero
unrecorded or pending calls and zero typed budget breaches. The two evidence-byte projections and
the two accounting projections are retained separately and are not added.

**Next.** Final candidate, staged-path, privacy, report-chain, and working-document gates are green,
and t170 is merged locally into `dev` in Core and downstream with clean trees. Both real finish gates
ran full `pnpm check` successfully; downstream task fixtures passed 120/120 under a process-local
`GIT_EXEC_PATH` correction for the machine's zero-byte internal Git executable. Remote refresh found
zero inbound divergence, but the Core-first push stopped because GitHub authentication is expired;
downstream was therefore not pushed. After authentication is restored, push Core then downstream.
For the next measurement, freeze the integrated identities, provider-free dry-run, no-hindsight
Stage 1, 13-record oracle, evidence/debug contract, and one-Lab machine predicate. Panel management
requires current-session user authorization; only then may the supervisor issue one fresh, explicit,
command-specific live authorization. No provider call is authorized now.

**Fix-first local evidence.** The deterministic Core service fixture now reproduces 26 decisions,
22 tool calls, repeated unchanged answerability, exact accounting, no persistence, and one revoke;
its same-prefix branch reaches its fixture-defined completion at decision 11 and persists a
registered record-producing node. Core publishes bounded, content-free progress fields by contract
and owns their non-content-derived identity provenance; downstream applies closed-shape and bounded-
syntax screening, which does not by itself prove provenance. Earlier focused loop tests passed
394/394 and the service pair passed 2/2. T367 reported 49/49 for the downstream progress-projection
sanitizer/privacy/accounting work, and the read-only t371 follow-up recorded in t366 returned GO; that
does not yet close the later packing integration.

The provider-free discriminator ruled out lost feedback, decision grammar, catalog visibility, and
answerability handling, then measured its sole failed signal: the 4,000-byte draft projection
withheld 4, 10, 15, and 21 bounded inputs at decisions 23-26. A complete fitting draft retains the
ordinary object shape. When an all-bounded-input draft no longer fits, Core tries lossless,
self-describing `step_rows_v1` candidates before withholding oldest input. A draft containing an
input over the unchanged 512-byte bound stays in object form and retains `inputTooLarge: true`.
Focused results are t375 14/14 measurement tests, t377 20/20 entry tests plus Core check, and t378
three selected discriminator/service tests plus Core check. The unchanged-budget fixture retains all
7-22 bounded inputs through decision 26; the same-prefix branch reaches its fixture-defined decision-
11 completion. This does not establish provider convergence. T370/t374 separately set the exact
represented-draft ceiling to 129, reject 130, and leave the 128-revision and 64-amendment ceilings
unchanged. Provider-free Core/downstream command gates and corrected-order output freshness are green,
subject to the documented downstream worktree-fixture environment block; final candidate review and
integration remain. This does not establish provider convergence.

**Blockers.** Flow creation remains unreliable, and runs 3 and 4 leave runtime, exact answer,
judgement, repair persistence, zero-provider replay, recursive post-replay judgement, and terminal
revocation unmeasured. The draft-loss correction is locally integrated but not live-proven. Remote
delivery waits on GitHub re-authentication; a fresh command-specific authorization and current-session
panel permission still precede any provider call.

---

## The Binding Rules

### 1. Defensive execution is the default

Every core or custom node enters the same bounded defensive envelope. Recoverable late-page, target,
transport, timeout, 429, and 5xx faults are absorbed and recorded when retrying is safe. Deterministic
permission/refusal failures remain terminal. A side-effecting action is never blindly repeated after
dispatch, and a no-op is never reported as success.

### 2. The instruction is the grant

Only consequences independently requiring human authority are gated: moving money, deleting, and
sending or publishing. Exploration, extraction, judgement, repair, re-authoring, rollback, ordinary
creation/modification, persistence, and replay are not permission events. An unmapped state input
still cannot become executable authority.

### 3. The judge says what to fix

The judge receives screened evaluation context and returns a structured, actionable repair directive,
not only a label. Repair uses screened parameters, changes and persists the relevant Flow definition,
and proves the correction by provider-free replay.

### 4. Existing safety boundaries remain

Secrets, raw prompts/responses, recorded page content, selectors, browser state, and tokens never
enter tracked evidence. Recovery remains bounded; redaction and grant enforcement are not weakened.
Exact dataset comparison—not a plausible table or matching count—decides the hard scenario.

---

## Current Runtime And Judge Contracts

- Core bases recovery on side-effect class and structured failure rather than a broad stage proxy.
- The extension re-resolves targets in a bounded envelope and distinguishes transient transport from
  deterministic browser permission refusal.
- List extraction supports strict predicates, bounded continuation, partial retention, identity-based
  de-duplication, stable order, and explicit recovery accounting.
- Provider faults retry only within configured bounds and grant accounting.
- Final unusable build decisions retain their actionable diagnosis at literal iteration exhaustion.
- Judgement and repair use screened directives; deterministic replay must make zero provider calls.

The detailed audit, integration narrative, and t170–t218 briefs are preserved in the
[archive snapshot](./mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md).

---

## Live Validation Contract

The qualifying command uses the isolated `everything-store` created-Flow lane, DeepSeek
`mvp-hard-scenario`, task `everything-store-plus-earbuds-under-50`, one replay, and no budget override.
Only one Lab run may exist at a time.

A pass requires a finalized, integrity-valid bundle proving all of these:

1. The authored Flow implements the complete instruction: exact predicates, organic-only extraction,
   all-page traversal, stable order, and identity-based de-duplication.
2. Runtime reaches its own page; each action produces its intended effect/output or records a bounded,
   correctly classified recovery or terminal failure.
3. The dataset exactly matches all 13 expected ordered records across `name`, `price`, `rating`, and
   `url`; count-only comparison cannot pass.
4. Core judges the result. If wrong, a screened directive triggers an applied, persisted repair.
5. The persisted Flow replays successfully with zero provider calls.
6. No secret/redaction, integrity, unexpected permission, budget, or concurrency failure occurs.

The exit condition is two consecutive independent passes under the unchanged default profile. A
failure resets the streak and is fully debugged before a measured fix or another provider call.

---

## Active Order Of Work

1. Reconcile run 4's independent evidence and preserve the hard no-provider stop in both plans.
2. Add a deterministic Core service fixture for the 26-decision exhaustion and a companion success branch.
3. Add privacy-safe stable draft/step identity, answerability state, and semantic progress projection through Core and downstream snapshots.
4. Use the deterministic evidence to select and implement a measured convergence correction; do not raise limits or weaken answerability.
5. Run focused failure/success tests, then full Core/downstream check, test, build, identity, and freshness closure.
6. Freeze a new no-hindsight authorization and repeat provider-free readiness and one-Lab gates before any next provider call.
7. After the first complete live pass, obtain one further independent consecutive pass; then validate the remaining nine lanes serially.
8. Reconcile final docs, manifests, sensitive-path scan, commits, task branches, and paired push.

---

## Worker Briefs

Completed t170–t218 briefs are in the [archive](./mvp-today-plan/archive/2026-09-26-pre-run-and-run1-coordination.md).
Each worker owns only its uniquely named report and never commits.

Completed t219–t311 briefs are in the [run-2 through run-3 launch-gate archive](./mvp-today-plan/archive/2026-09-26-run2-through-run3-launch-gate-briefs.md).

---

## Work Ledger

### 2026-09-26 — Opened and integrated the MVP closeout plan
- Agent: supervisor with t163–t203
- Changed: Core runtime/judge/permission code, downstream runtime/extraction/runner code, tests, docs, and this plan
- Why: Apply the three binding rules and make the hard scenario measurable end to end.
- Validation: Core 3,964 tests with one skip plus check/build; downstream 3,920 tests plus build/package checks -> passed; task-fixture worktree spawn remains environment-limited.
- Outcome: Accepted
- Follow-up: run the provider-backed hard scenario.

### 2026-09-26 — Run 1 produced a valid failure measurement
- Agent: supervisor with t210–t216
- Changed: `language-driven-flow-loop-plan/debugs/run-muj2kzx1-8f9f8271.md` and t210–t216 reports
- Why: Measure the four MVP criteria on one provider-backed hard scenario and requested replay.
- Validation: finalized evidence -> 26 build calls, 366,210 tokens, estimated USD 0.0573657, Stage 2 failure before proposal/runtime.
- Outcome: Accepted
- Follow-up: preserve the final unusable diagnosis and repeat the default-profile scenario.

### 2026-09-26 — Final build refusal now survives iteration exhaustion
- Agent: supervisor with t213, t215, and t217
- Changed: Core evidence-loop exhaustion handling and focused tests
- Why: Preserve `bootstrap.cannot_answer_instruction` instead of replacing it with iteration-limit.
- Validation: focused Vitest -> 57/57 passed; Core `pnpm check` and root `pnpm build` -> passed.
- Outcome: Accepted
- Follow-up: no MVP criterion receives pass credit until live evidence reaches it.

### 2026-09-26 — Compacted completed pre-run and run-1 coordination history
- Agent: supervisor with t221
- Changed: this plan and archive `2026-09-26-pre-run-and-run1-coordination.md`
- Why: The active document exceeded 800 lines and completed briefs obscured current run-2 state.
- Validation: archived predecessor retained intact; active Current State and document are below limits.
- Outcome: Accepted
- Follow-up: execute t219's default-profile run-2 procedure.

### 2026-09-26 — Run 2 reached judgement and failed before repair application
- Agent: supervisor with t225–t231
- Changed: run-2 debug/evidence reports and both active plans' Current State
- Why: Measure all four MVP criteria on the same default-profile hard scenario after run 1.
- Validation: `node packages/test-runner/dist/cli.js inspect run-muj39xl6-f6a5d4e5` -> exit 0; independent marker/index and selected-artifact byte, SHA-256, and redaction checks -> all matched, with run redaction verified. Stage 6 reached with a failed product verdict and zero pass streak.
- Outcome: Accepted
- Follow-up: diagnose and fix `flow_bootstrap.unexpected_error`, then repeat the default-profile scenario; t217 terminal exhaustion remains unmeasured live.

### 2026-09-27 — Run-2 repair and grant-continuation path completed locally
- Agent: supervisor with t233–t304
- Changed: Core request provenance, grant continuation, refuted-result repair/replay, focused tests, and downstream permission expectations
- Why: Carry run 2's refutation through durable repair and provider-free replay without minting or widening authority.
- Validation: production-focused set 135/135; t290 81/81; t293 51/51; t304 web 11/11 plus Core 30/30; independent security/export/privacy reviews -> GO.
- Outcome: Accepted as local implementation evidence; no live repair/replay credit.
- Follow-up: measure the complete path under the unchanged hard scenario.

### 2026-09-27 — Final validation and provider-free launch readiness passed
- Agent: supervisor with t297–t316
- Changed: final-tree validation evidence, downstream freshness/identity, zero-provider request audit, and frozen Stage-1 record
- Why: Prove the exact settled source/build/request state before a provider-backed measurement.
- Validation: Core root 3,994 passed with one skip and Core check passed; downstream builds/freshness/identity passed; exact dry-run -> ready, zero provider calls, default 26-call request; Stage 1 -> 39-line exact match.
- Outcome: Accepted as readiness evidence; pass streak remained 0.
- Follow-up: execute one live run under the frozen command and fully debug it.

### 2026-09-27 — Run 3 failed truthfully before Flow proposal
- Agent: supervisor with t325–t329
- Changed: `language-driven-flow-loop-plan/debugs/run-mujd550n-e8fbe7aa.md`, evidence/disposition reports, and both active plans
- Why: Measure creation, deterministic execution, self-repair, and judgement after the post-run-2 correction chain.
- Validation: `inspect run-mujd550n-e8fbe7aa` passed integrity/identity/redaction; bounded evidence -> Stage 2, 26 build calls, terminal `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`, no Flow or later-stage evidence.
- Outcome: Accepted failed product measurement; consecutive-pass streak 0.
- Follow-up: allow one unchanged controlled retry; repeated identical exhaustion requires fix-first investigation.

### 2026-09-27 — Compacted run-2 through run-3 launch-gate worker briefs
- Agent: supervisor with t306, t319, and t330
- Changed: this plan and `mvp-today-plan/archive/2026-09-26-run2-through-run3-launch-gate-briefs.md`
- Why: The active plan exceeded 800 lines and settled briefs obscured current run state.
- Validation: recovered archive -> 76 complete briefs, 688 normalized lines, 54,297 UTF-8 bytes, SHA-256 `bde4b6c65df45e7a762df17edb24533adac2b668c5a77937584627771af672d1`; endpoints/order/fields/encoding/diff-check -> passed. Exact pre-cut byte fidelity is unavailable and explicitly not claimed.
- Outcome: Accepted semantic/structural compaction with the t330 fidelity limitation recorded.
- Follow-up: execute only the Current State's run-4 gate; reports retain detailed evidence.

### 2026-09-27 — Run 4 repeated Stage-2 exhaustion and fired the fix-first stop
- Agent: supervisor with t331–t348
- Changed: run-4 debug/evidence reports and both active plans
- Why: Execute the single authorized unchanged reliability retry under a frozen no-hindsight contract.
- Validation: finalized bundle identity/integrity/redaction passed; independent t347 audit accepted Stage 2 with 26 build decisions, 22 tool calls, terminal `flow_bootstrap.evidence_unusable_decision` / `bootstrap.cannot_answer_instruction`, and no proposal or later-stage evidence.
- Outcome: Accepted failed product measurement; consecutive-pass streak 0; unchanged run 5 forbidden.
- Follow-up: deterministic service reproduction plus privacy-safe stable progress evidence, a measured source fix, and full closure before new live authorization.

### 2026-09-27 — Run-4 packing correction reached provider-free closure
- Agent: supervisor with [t385](./mvp-today-plan/reports/t385-downstream-post-core-validation.md), [t395](./mvp-today-plan/reports/t395-core-timeout-stability-review.md), [t397](./mvp-today-plan/reports/t397-generated-reference-re-review.md), [t405](./mvp-today-plan/reports/t405-updated-docs-privacy-scan.md), [t406](./mvp-today-plan/reports/t406-core-baseline-final-audit.md), [t409](./mvp-today-plan/reports/t409-post-supervisor-build-freshness.md), and [t410](./mvp-today-plan/reports/t410-final-closure-synthesis.md)
- Changed: Lossless `step_rows_v1` packing, ownership-correct tests and local timeout budgets, generated references, and corrected-order downstream outputs.
- Why: Remove run 4's measured bounded-input loss without changing the 4,000-byte reservation or provider budgets, then prove the provider-free cross-repository correction before another live decision.
- Validation: Supervisor observed Core `pnpm check` and downstream `pnpm -r check`, `pnpm test`, and `pnpm build` exit 0 (847/847 domain, 832/832 extension, 571/571 Scenario Lab, 1,470/1,470 test-runner); linked workers observed Core root test 5,437 passed / 1 skip, root build/docs/structure green, and corrected-order freshness 6/6 with markers 12/12.
- Exception: Downstream root `pnpm check` exited 1 only at `pnpm task:test`: 89/120 passed and 31 `git worktree add` cases failed with `cannot spawn git: Exec format error`; all non-worktree gates passed.
- Outcome: Partial
- Follow-up: Complete final candidate/staged-path sensitive-data and inclusion review, reconcile/freeze identity, and decide integration; no provider call before a fresh no-hindsight command-specific authorization.

---

## Open Questions

- None.
