# Run 2 Through Run 3 Launch-Gate Worker Briefs

This archive preserves the complete settled t219–t311 coordination sequence moved from the active
[MVP Today plan](../../mvp-today-plan.md). Earlier coordination is in the
[pre-run and run-1 archive](./2026-09-26-pre-run-and-run1-coordination.md). The pre-cut file was
read once through a Windows PowerShell 5.1 output path that was not UTF-8-safe, so exact byte-for-
byte fidelity to that unavailable snapshot is not claimed. T330 verified all 76 brief blocks,
endpoints, fields, order, clean UTF-8, and semantic/structural completeness. The recovered payload
between the markers is 688 LF-normalized lines, 54,297 UTF-8 bytes, SHA-256
`bde4b6c65df45e7a762df17edb24533adac2b668c5a77937584627771af672d1`.

<!-- BEGIN RECOVERED t219-t311 -->
### Brief: t219-run2-preflight-delta
- Repository: this repository and read-only Core build state
- Task: define post-t217 rebuild, freshness, readiness, credential, and serial-run gates
- Required reads: t178, t197, t213, t216, t217, and the live command implementation
- Owns (may edit): `mvp-today-plan/reports/t219-run2-preflight-delta.md`
- Must not touch: product source, shared docs, build/run artifacts, browser/provider state
- Definition of done: default-profile GO/NO-GO procedure with no 27-call substitution
- Report to: `docs/working/mvp-today-plan/reports/t219-run2-preflight-delta.md`

### Briefs: t220–t223
- Repository: this repository
- Tasks: audit run-2 acceptance; map compaction; draft no-hindsight Stage 1; map sanitized artifacts
- Required reads: only the scenario/assertion, protocol, debug, and artifact files named in each dispatch
- Owns (may edit): uniquely named reports `t220` through `t223` under `mvp-today-plan/reports/`
- Must not touch: shared docs, product source, test-runs, provider/browser state
- Definition of done: exact acceptance, preserved compaction, pre-run expectations, and safe evidence map
- Report to: the matching uniquely named report

### Briefs: t225–t227
- Repository: this repository
- Tasks: record safe run health; analyze sanitized build/exploration evidence; analyze sanitized runtime/judge/repair evidence
- Required reads: t223 artifact map and only the typed run-2 artifacts assigned in each dispatch
- Owns (may edit): uniquely named reports `t225` through `t227` under `mvp-today-plan/reports/`
- Must not touch: shared docs, source, raw logs/events/screenshots/provider text/page data, browser/provider state
- Definition of done: evidence-backed health and stage findings with explicit absent/unmeasured fields
- Report to: the matching uniquely named report

### Brief: t228-run2-integrity-and-accounting
- Repository: this repository
- Task: independently verify run-2 bundle integrity/redaction and sanitized budget accounting
- Required reads: t223 and indexed marker/run/evaluation/live-llm artifacts only
- Owns (may edit): `mvp-today-plan/reports/t228-run2-integrity-and-accounting.md`
- Must not touch: shared docs, source, raw logs/events/provider text/page data, browser/provider state
- Definition of done: hash/byte/redaction gates and disjoint call/token/cost/budget summary
- Report to: `docs/working/mvp-today-plan/reports/t228-run2-integrity-and-accounting.md`

### Briefs: t229–t231
- Repository: Core for t229; this repository for t230–t231
- Tasks: trace the reauthor failure; synthesize the run debug; draft working-document state/ledger updates
- Required reads: t226–t228 and only the directly owning source/debug/working-doc sections named in dispatch
- Owns (may edit): uniquely named reports `t229` through `t231` under `mvp-today-plan/reports/`
- Must not touch: product/shared docs, run artifacts beyond permitted typed evidence, provider/browser state
- Definition of done: smallest evidence-backed source cause, copy-ready complete debug, and truthful doc updates
- Report to: the matching uniquely named report

### Brief: t232-reauthor-failure-test-gap
- Repository: FluxIQ Core
- Task: audit focused tests around wrong-answer reauthor generation failure after one or more evidence-loop calls
- Required reads: t226–t229 plus only directly relevant reauthor/service/bootstrap failure tests
- Owns (may edit): `mvp-today-plan/reports/t232-reauthor-failure-test-gap.md`
- Must not touch: Core/downstream source, shared docs, run artifacts, provider/browser state
- Definition of done: exact missing regression case and smallest focused command/file set
- Report to: `docs/working/mvp-today-plan/reports/t232-reauthor-failure-test-gap.md`

### Brief: t233-narrow-reauthor-request-boundary
- Repository: FluxIQ Core
- Task: make reauthor generation classify setup versus actual provider invocation truthfully, without blind retry
- Required reads: t229/t232 and Core `runtime/service.ts`, generation-failure helpers, and directly relevant service tests
- Owns (may edit): Core `runtime/service.ts` and narrowly placed reauthor/bootstrap tests; unique t233 report
- Must not touch: downstream source/shared docs, unrelated Core modules, grants/budgets/retry policy, run artifacts
- Definition of done: exact invocation boundary, safe closed diagnostics, real-grant regression tests, focused tests/check/build pass
- Report to: `docs/working/mvp-today-plan/reports/t233-narrow-reauthor-request-boundary.md`

### Brief: t234-reauthor-boundary-review
- Repository: FluxIQ Core, read-only
- Task: independently review t229's proposed boundary against Core failure semantics and define acceptance cases
- Required reads: t229 and directly relevant generation-failure/service/provider contracts and tests
- Owns (may edit): `mvp-today-plan/reports/t234-reauthor-boundary-review.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: prove or refute the boundary design and list invariant-preserving tests
- Report to: `docs/working/mvp-today-plan/reports/t234-reauthor-boundary-review.md`

### Brief: t235-run2-document-consistency
- Repository: this repository
- Task: audit run-2 debug and both active plans for factual/protocol consistency
- Required reads: run-2 debug, both Current State sections, t226–t231, working-doc protocol rules
- Owns (may edit): `mvp-today-plan/reports/t235-run2-document-consistency.md`
- Must not touch: shared docs, source, run artifacts, provider/browser state
- Definition of done: contradictions, line-limit/status/ledger findings, and copy-ready corrections only
- Report to: `docs/working/mvp-today-plan/reports/t235-run2-document-consistency.md`

### Brief: t236-provider-invocation-provenance
- Repository: FluxIQ Core, read-only
- Task: locate the lowest boundary that can truthfully prove provider invocation versus pre-call setup
- Required reads: t234 and only provider/harness/retry/request-construction call-chain files and tests
- Owns (may edit): `mvp-today-plan/reports/t236-provider-invocation-provenance.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: concrete call chain, provenance states, and minimal safe ownership recommendation
- Report to: `docs/working/mvp-today-plan/reports/t236-provider-invocation-provenance.md`

### Brief: t237-provenance-fix-file-plan
- Repository: FluxIQ Core, read-only
- Task: turn t236 into an exact minimal edit/test file plan without changing source
- Required reads: t236 and the immediate DeepSeek fetch, retry, harness-failure projection, and tests
- Owns (may edit): `mvp-today-plan/reports/t237-provenance-fix-file-plan.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: file-by-file changes, invariants, compatibility risk, focused commands
- Report to: `docs/working/mvp-today-plan/reports/t237-provenance-fix-file-plan.md`

### Brief: t238-invocation-provenance-compatibility
- Repository: FluxIQ Core, read-only
- Task: audit compatibility impact of preserving exact provider invocation/response provenance
- Required reads: t234/t236 and public/internal failure contracts, serializers, parsers, consumers, tests
- Owns (may edit): `mvp-today-plan/reports/t238-invocation-provenance-compatibility.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: closed-union/serialization consumers, breaking-risk verdict, migration/test requirements
- Report to: `docs/working/mvp-today-plan/reports/t238-invocation-provenance-compatibility.md`

### Briefs: t239–t241
- Repository: FluxIQ Core
- Tasks: implement three-state Flow Bootstrap provenance; add real-grant reauthor composition test; independently review t233
- Required reads: t233–t237 and only directly owning production/test files named in dispatch
- Owns (may edit): disjoint Core flow-bootstrap files/tests for t239; one new reauthor-service test for t240; unique reports
- Must not touch: downstream source/shared docs, run artifacts, provider/browser state, budgets/retry/grants outside owned seam
- Definition of done: truthful compatible provenance, real service composition proof, and independent t233 review with focused gates
- Report to: matching `mvp-today-plan/reports/t239...t241` file

**t239 ownership amendment.** The widened durable diagnostic exposed one exact downstream closed
union: Core `runtime/recovery/refuted-result/reauthor.ts` and its focused `reauthor.test.ts`. T239
may update only that type/projection and the minimal focused assertions to preserve `unknown`
without a cast. T240 continues to own only its new composition-test file, so edits remain disjoint.

### Brief: t242-untyped-harness-provenance-plan
- Repository: FluxIQ Core, read-only
- Task: resolve t241's concern that an untyped top-level harness escape proves uncertainty, not `not_attempted`
- Required reads: t239 in-progress diff, t241, service catch, diagnostic constructors/parsers/tests
- Owns (may edit): `mvp-today-plan/reports/t242-untyped-harness-provenance-plan.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: smallest post-t239 truthful representation and exact regression cases
- Report to: `docs/working/mvp-today-plan/reports/t242-untyped-harness-provenance-plan.md`

### Brief: t243-untyped-harness-provenance
- Repository: FluxIQ Core
- Task: implement t242's local harness wrapper after t239's three-state contract
- Required reads: t239 current diff, t242, Core service generation path and accounting tests
- Owns (may edit): Core `runtime/service.ts`, `runtime/tests/service-bootstrap/tests/accounting.test.ts`, unique t243 report
- Must not touch: t239/t240 files, provider/retry, budgets/grants/permissions, downstream shared docs
- Definition of done: setup stays not-attempted, untyped harness escapes become provider-request unknown, structured failures remain exact; focused/root gates pass after t239 integration
- Report to: `docs/working/mvp-today-plan/reports/t243-untyped-harness-provenance.md`

### Brief: t244-integrated-provenance-review
- Repository: FluxIQ Core, read-only
- Task: review integrated t233/t239/t243 provenance and grant-purpose changes
- Required reads: reports t233/t239/t241/t242 and exact changed Core hunks/tests
- Owns (may edit): `mvp-today-plan/reports/t244-integrated-provenance-review.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: invariant audit, remaining gaps, and live-rerun GO/NO-GO recommendation
- Report to: `docs/working/mvp-today-plan/reports/t244-integrated-provenance-review.md`

### Brief: t245-post-reauthor-replay-root-cause
- Repository: FluxIQ Core, read-only
- Task: trace why the real service composition applies reauthoring but emits no post-apply verification/replay call
- Required reads: failed t240 test, result-verification repair orchestration, rerunRepairedFlow callback, service run path, nearest tests
- Owns (may edit): `mvp-today-plan/reports/t245-post-reauthor-replay-root-cause.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: exact control-flow cause, whether test or product expectation is wrong, smallest fix/test ownership
- Report to: `docs/working/mvp-today-plan/reports/t245-post-reauthor-replay-root-cause.md`

### Briefs: t246–t248
- Repository: FluxIQ Core
- Tasks: implement subflow-preserving repair replay after t243; audit rerun-port consumers; audit compatibility/test surface
- Required reads: t240/t245 and only rerun port, service callback, repair-rerun, and directly relevant tests/consumers
- Owns (may edit): t246 owns `run-outcome.ts`, `service.ts`, focused tests including t240; t247/t248 own unique read-only reports
- Must not touch: provenance files, provider/retry, budgets/grants/permissions, downstream shared docs, run artifacts
- Definition of done: selected subflow reaches repair rerun and post-apply verification; consumers remain compatible; focused/root gates pass
- Report to: matching `mvp-today-plan/reports/t246...t248` file

### Brief: t249-run3-preflight-delta
- Repository: both checkouts, read-only
- Task: define the minimum post-t239/t243/t246 rebuild/freshness/readiness gates for the next default-profile run
- Required reads: t219, t239–t248 outcomes, exact changed-file ownership, existing live command
- Owns (may edit): `mvp-today-plan/reports/t249-run3-preflight-delta.md`
- Must not touch: source/shared docs, builds/run artifacts, provider/browser state
- Definition of done: serial GO/NO-GO procedure; pass would start streak at one; no budget override
- Report to: `docs/working/mvp-today-plan/reports/t249-run3-preflight-delta.md`

### Brief: t250-post-run2-fix-ledger-draft
- Repository: this repository, read-only source state
- Task: draft Current State/ledger updates for t233/t239/t243 and pending t246 without claiming live success
- Required reads: both active plans' Current State/ledger and reports t233/t239/t243/t245/t246 when available
- Owns (may edit): `mvp-today-plan/reports/t250-post-run2-fix-ledger-draft.md`
- Must not touch: shared docs, source, run artifacts, provider/browser state
- Definition of done: copy-ready accepted implementation entries, exact validation, remaining live proof gaps
- Report to: `docs/working/mvp-today-plan/reports/t250-post-run2-fix-ledger-draft.md`

### Briefs: t251–t252
- Repository: FluxIQ Core, read-only
- Tasks: trace stale grant after applied repair; independently audit safe authority/lifecycle design
- Required reads: t246 evidence and only grant issue/resolve/revoke, verification resolver, reauthor generation, binding refresh, nearest tests
- Owns (may edit): unique reports `t251` and `t252` under `mvp-today-plan/reports/`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: exact stale/revoked cause, smallest authority-preserving fix, tests and file ownership
- Report to: matching report file

### Brief: t253-post-repair-grant-test-gap
- Repository: FluxIQ Core, read-only
- Task: map existing grant lifecycle/binding tests against the t246 post-repair invalidation
- Required reads: t246 and only grant/service/result-verification tests touching revoke, binding refresh, and recursive verification
- Owns (may edit): `mvp-today-plan/reports/t253-post-repair-grant-test-gap.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: exact covered/missing cases and smallest focused validation set for the eventual fix
- Report to: `docs/working/mvp-today-plan/reports/t253-post-repair-grant-test-gap.md`

### Brief: t254-grant-continuation-api-audit
- Repository: FluxIQ Core, read-only
- Task: locate any existing authority-preserving grant continuation/rebind API or prove one is absent
- Required reads: grant service/contracts/storage, binding checks, adaptation apply transaction, runtime service wiring
- Owns (may edit): `mvp-today-plan/reports/t254-grant-continuation-api-audit.md`
- Must not touch: source/shared docs, run artifacts, provider/browser state
- Definition of done: minimal owner/API design, atomicity requirements, security invariants, exact files/tests
- Report to: `docs/working/mvp-today-plan/reports/t254-grant-continuation-api-audit.md`

### Briefs: t255–t257
- Repository: FluxIQ Core
- Tasks: implement grant-store continuation; audit its security/state transition; prepare exact runtime wiring plan
- Required reads: t251–t254 and only grant execution/service wiring/apply/replay owners named in dispatch
- Owns (may edit): t255 grant execution files/tests; t256/t257 unique read-only reports
- Must not touch: service/apply wiring until t255 settles, provider/retry, downstream shared docs, run artifacts
- Definition of done: same-grant binding-only CAS with refusal invariants and tests; reviewed wiring plan for t258
- Report to: matching `mvp-today-plan/reports/t255...t257` file

### Briefs: t258–t260
- Repository: FluxIQ Core for implementation/review; this repository for ledger draft
- Tasks: wire continuation into repair apply/replay; independently security-review integrated change; draft post-fix state
- Required reads: t255–t257 and only exact host/service/apply/replay/test owners named in dispatch
- Owns (may edit): t258 Core service/runtime/run-outcome/t240 files; t259/t260 unique reports only
- Must not touch: grant-store t255 files, provider/retry, budgets/permissions, run artifacts, shared docs
- Definition of done: durable apply → continuation → zero-provider subflow replay → fourth judge, final revoke, green focused/root gates
- Report to: matching `mvp-today-plan/reports/t258...t260` file

### Brief: t261-run3-machine-readiness-snapshot
- Repository: both checkouts, read-only
- Task: independently snapshot current run-3 machine readiness while t258 gates finish
- Required reads: t249 and t260 reports, current process/lock/build-output state, exact unchanged live command
- Owns (may edit): `mvp-today-plan/reports/t261-run3-machine-readiness-snapshot.md`
- Must not touch: source/shared docs, generated builds, run artifacts, provider/browser state; do not start a Lab or provider call
- Definition of done: timestamped GO/NO-GO inventory for single-Lab availability, required output presence/freshness, pending-debug readiness, and exact remaining serial gates
- Report to: `docs/working/mvp-today-plan/reports/t261-run3-machine-readiness-snapshot.md`

### Brief: t262-run3-no-hindsight-stage1-draft
- Repository: this repository, report-only
- Task: prepare copy-ready Stage 1 text and evidence checklist for the run-3 pending debug without assuming success
- Required reads: t249, t260, t261, the run-2 debug structure, and the pending-debug template only
- Owns (may edit): `mvp-today-plan/reports/t262-run3-no-hindsight-stage1-draft.md`
- Must not touch: shared plans, source, generated outputs, pending debug/run artifacts, provider/browser/Lab state
- Definition of done: concise Stage 1 draft naming the exact change under measurement, invariants, expected sequence, and failure evidence to collect
- Report to: `docs/working/mvp-today-plan/reports/t262-run3-no-hindsight-stage1-draft.md`

### Brief: t263-run3-command-and-freshness-audit
- Repository: both checkouts, read-only
- Task: audit t249/t261's exact serial preflight commands and freshness ownership against current package scripts and t255/t258 files
- Required reads: t249, t261, relevant package scripts, exact changed-file/output ownership only
- Owns (may edit): `mvp-today-plan/reports/t263-run3-command-and-freshness-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; run no builds or live commands
- Definition of done: corrected copy-ready command order, freshness inputs/outputs, and any GO/NO-GO discrepancy
- Report to: `docs/working/mvp-today-plan/reports/t263-run3-command-and-freshness-audit.md`

### Brief: t264-post-gate-doc-integration-audit
- Repository: this repository, report-only
- Task: audit the two active plans and t260/t261/t262 drafts for the smallest accurate post-t258 integration edit
- Required reads: both active plans' Current State/Next/Blockers/ledger plus t258 when available and reports t260–t262
- Owns (may edit): `mvp-today-plan/reports/t264-post-gate-doc-integration-audit.md`
- Must not touch: shared plans, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact insert/replace map, line-budget check, contradictions/duplication to avoid, and conditional wording if t258 is not final
- Report to: `docs/working/mvp-today-plan/reports/t264-post-gate-doc-integration-audit.md`

### Brief: t265-post-extraction-runtime-review
- Repository: FluxIQ Core, read-only source review
- Task: review the final t258 extraction from `service.ts` for semantic equivalence and structure/security regressions
- Required reads: t258 report when present, t259, and only final changed service/runtime-adaptation/run-outcome/test hunks
- Owns (may edit): downstream `mvp-today-plan/reports/t265-post-extraction-runtime-review.md`
- Must not touch: Core/downstream source or shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: GO/NO-GO on operation-scoped retention, durable apply/continuation ordering, closed failure, zero-provider replay, terminal revoke, and file-structure ownership
- Report to: `docs/working/mvp-today-plan/reports/t265-post-extraction-runtime-review.md`

### Brief: t266-run3-artifact-capture-audit
- Repository: this repository, read-only
- Task: verify the exact pending-debug creation, run-id rename, sanitized CLI capture, inspect, and bundle-integrity sequence for run 3
- Required reads: t219/t249/t262, run-2 debug/evidence workflow, runner CLI help/scripts only
- Owns (may edit): `mvp-today-plan/reports/t266-run3-artifact-capture-audit.md`
- Must not touch: source/shared docs, pending debug/run artifacts, generated outputs, provider/browser/Lab state; do not execute the live or dry-run command
- Definition of done: copy-ready serial artifact procedure that prevents hindsight and secret/raw-provider leakage
- Report to: `docs/working/mvp-today-plan/reports/t266-run3-artifact-capture-audit.md`

### Brief: t267-t265-remediation-test-audit
- Repository: FluxIQ Core, read-only
- Task: define the smallest regression matrix for t265's two blockers and audit the current fix as it lands
- Required reads: t265 and only affected service/runtime-adaptation/reauthor composition files and tests
- Owns (may edit): downstream `mvp-today-plan/reports/t267-t265-remediation-test-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: required assertions for non-public retention and post-apply binding-read closed failure, plus current-tree GO/NO-GO
- Report to: `docs/working/mvp-today-plan/reports/t267-t265-remediation-test-audit.md`

### Brief: t268-service-retention-boundary-audit
- Repository: FluxIQ Core, read-only
- Task: independently enumerate all callers of the generation service and prove whether grant retention is selectable outside the exact runtime-owned reauthor operation
- Required reads: current service signature/callers, shared runtime facade, reauthor path, nearest tests
- Owns (may edit): downstream `mvp-today-plan/reports/t268-service-retention-boundary-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: caller map, public-boundary verdict, smallest safe seam if still exposed, and compatibility impact
- Report to: `docs/working/mvp-today-plan/reports/t268-service-retention-boundary-audit.md`

### Brief: t269-invocation-local-retention-review
- Repository: FluxIQ Core, read-only
- Task: review the t268 remediation as it lands for invocation-locality and concurrent same-grant isolation
- Required reads: t268 and only current service private/public generation seams, reauthor caller, nearest tests
- Owns (may edit): downstream `mvp-today-plan/reports/t269-invocation-local-retention-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: GO/NO-GO with explicit proof no purpose-wide, caller-selectable, or ambient retention remains
- Report to: `docs/working/mvp-today-plan/reports/t269-invocation-local-retention-review.md`

### Brief: t270-post-remediation-gate-manifest
- Repository: both checkouts, report-only
- Task: consolidate the exact settled-tree validation/rebuild/freshness/live-readiness gates after t265–t269
- Required reads: t258 when available and t263/t265/t267/t268/t269 reports
- Owns (may edit): `mvp-today-plan/reports/t270-post-remediation-gate-manifest.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; execute no gates
- Definition of done: one deduplicated serial gate list, required evidence/results slots, and hard live GO conditions
- Report to: `docs/working/mvp-today-plan/reports/t270-post-remediation-gate-manifest.md`

### Brief: t271-retention-concurrency-test-design
- Repository: FluxIQ Core, read-only
- Task: specify the smallest deterministic tests proving public direct revocation and concurrent same-grant/non-reauthor isolation for the final private seam
- Required reads: t268/t269 and only final service generation seam plus nearest grant lifecycle tests
- Owns (may edit): downstream `mvp-today-plan/reports/t271-retention-concurrency-test-design.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: executable fixture design, exact assertions, race scheduling points, and whether existing tests already cover each invariant
- Report to: `docs/working/mvp-today-plan/reports/t271-retention-concurrency-test-design.md`

### Brief: t272-final-t258-diff-review
- Repository: FluxIQ Core, read-only
- Task: review the settled t258/t265–t269 diff for correctness, structure budgets, and unintended public/API changes
- Required reads: final changed Core hunks, t258/t265/t268/t269 reports, nearest package exports only
- Owns (may edit): downstream `mvp-today-plan/reports/t272-final-t258-diff-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: final-tree GO/NO-GO, exact residual findings, and verification gaps without rerunning gates
- Report to: `docs/working/mvp-today-plan/reports/t272-final-t258-diff-review.md`

### Brief: t273-final-retention-regression-review
- Repository: FluxIQ Core, read-only
- Task: inspect the final new retention regressions for determinism and coverage of t267/t269/t271 blockers
- Required reads: t267/t269/t271 and only newly changed tests plus seam under test
- Owns (may edit): downstream `mvp-today-plan/reports/t273-final-retention-regression-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: test-by-test coverage map, flake/race assessment, and final proof GO/NO-GO
- Report to: `docs/working/mvp-today-plan/reports/t273-final-retention-regression-review.md`

### Brief: t274-legacy-harness-seam-review
- Repository: FluxIQ Core, read-only
- Task: review the restored `runFlowBootstrapLlmHarness` seam and extracted target validation for behavior/API/structure regressions
- Required reads: current service hunks, accounting tests that patch the seam, extracted validator, nearest callers/tests
- Owns (may edit): downstream `mvp-today-plan/reports/t274-legacy-harness-seam-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: compatibility and encapsulation GO/NO-GO, exact missing tests, and structure-budget impact
- Report to: `docs/working/mvp-today-plan/reports/t274-legacy-harness-seam-review.md`

### Brief: t275-final-structure-and-export-review
- Repository: FluxIQ Core, read-only
- Task: inspect the settled t258 module/barrel/import layout after t274's finding and audit public export surface
- Required reads: t274, current service/runtime-adaptation/flow-bootstrap barrels and package export diff only
- Owns (may edit): downstream `mvp-today-plan/reports/t275-final-structure-and-export-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact structure/import/export GO/NO-GO and any residual violation; do not rely solely on worker report
- Report to: `docs/working/mvp-today-plan/reports/t275-final-structure-and-export-review.md`

### Brief: t276-final-continuation-failure-privacy-review
- Repository: FluxIQ Core, read-only
- Task: verify final post-apply binding/continuation failure carriage exposes only typed sanitized provenance while preserving truthful applied state
- Required reads: final continuation coordinator, run-outcome carriage, service composition failure tests, t267/t273
- Owns (may edit): downstream `mvp-today-plan/reports/t276-final-continuation-failure-privacy-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: field-by-field privacy/truthfulness GO/NO-GO and any untested disclosure path
- Report to: `docs/working/mvp-today-plan/reports/t276-final-continuation-failure-privacy-review.md`

### Brief: t277-secret-error-regression-design
- Repository: FluxIQ Core, read-only
- Task: design the smallest deterministic regression proving arbitrary secret-bearing continuation errors reduce to fixed typed public provenance
- Required reads: t276, continuation coordinator catch, service composition failure tests only
- Owns (may edit): downstream `mvp-today-plan/reports/t277-secret-error-regression-design.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact fixture/assertions, placement, focused command, and whether the gap is release-blocking
- Report to: `docs/working/mvp-today-plan/reports/t277-secret-error-regression-design.md`

### Brief: t278-post-move-public-surface-review
- Repository: FluxIQ Core, read-only
- Task: verify the final bootstrap-target move is internal to service ownership and absent from package-root exports
- Required reads: t274/t275 and final moved helper/barrels/service import/package export chain only
- Owns (may edit): downstream `mvp-today-plan/reports/t278-post-move-public-surface-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: file/import/barrel/export-chain GO/NO-GO after t181 lands the exact move
- Report to: `docs/working/mvp-today-plan/reports/t278-post-move-public-surface-review.md`

### Brief: t279-final-t258-evidence-audit
- Repository: both checkouts, report-only
- Task: audit t258's eventual final report against required focused/check/build/diff evidence and all t265–t278 findings
- Required reads: t258 final report when present, t265–t278 conclusions, exact reported command outputs only
- Owns (may edit): `mvp-today-plan/reports/t279-final-t258-evidence-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; execute no gates
- Definition of done: evidence completeness GO/NO-GO, contradictions, and exact remaining pre-live blockers
- Report to: `docs/working/mvp-today-plan/reports/t279-final-t258-evidence-audit.md`

### Brief: t280-post-build-run3-readiness
- Repository: both checkouts, read-only
- Task: after t258 final Core build, snapshot Core/downstream output freshness, one-Lab state, and exact remaining run-3 serial gates
- Required reads: t258 final when present, t263/t270, current process/lock and output/input timestamps only
- Owns (may edit): `mvp-today-plan/reports/t280-post-build-run3-readiness.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; do not build or run provider/dry-run commands
- Definition of done: timestamped readiness GO/NO-GO and exact downstream rebuild/freshness work remaining
- Report to: `docs/working/mvp-today-plan/reports/t280-post-build-run3-readiness.md`

### Brief: t281-downstream-rebuild-closure
- Repository: this repository
- Task: execute t263/t270's serial downstream rebuild closure against the final Core build and report exact results
- Required reads: t258, t263, t270, repository layout commands, relevant package scripts only
- Owns (may edit): generated outputs through owning build commands and `mvp-today-plan/reports/t281-downstream-rebuild-closure.md`
- Must not touch: authored source/shared docs, run artifacts, provider/browser/Lab live state; do not start a live Lab or provider call
- Definition of done: domain → test-contracts → test-evidence → extension → Scenario Lab → runner built serially, downstream check/freshness results recorded, failures stopped and classified
- Report to: `docs/working/mvp-today-plan/reports/t281-downstream-rebuild-closure.md`

### Brief: t282-final-core-test-gap-audit
- Repository: FluxIQ Core, read-only
- Task: compare t258's executed 10-file focused set against t270's 15-file matrix and root test requirement
- Required reads: t258/t270/t280 reports, exact relevant test scripts and file lists only
- Owns (may edit): downstream `mvp-today-plan/reports/t282-final-core-test-gap-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; execute no tests/builds
- Definition of done: exact missing/redundant commands, whether root `pnpm test` subsumes them, and minimum settled-tree Core gate remaining
- Report to: `docs/working/mvp-today-plan/reports/t282-final-core-test-gap-audit.md`

### Brief: t283-settled-tree-identity-snapshot
- Repository: both checkouts, read-only
- Task: record exact branch, HEAD, dirty-path scope, and final t258 production/test owner timestamps without exposing secrets or generated data
- Required reads: git metadata/status and t258-owned file list only
- Owns (may edit): `mvp-today-plan/reports/t283-settled-tree-identity-snapshot.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: reproducible identity snapshot tying subsequent validation to the same settled source tree
- Report to: `docs/working/mvp-today-plan/reports/t283-settled-tree-identity-snapshot.md`

### Brief: t284-downstream-equivalent-gates-and-freshness
- Repository: this repository
- Task: close t281's known machine-only root-check failure with the documented equivalent package/structure checks, then verify rebuilt-output freshness
- Required reads: t281, t263/t270, repository layout commands, root check script and task-fixture boundary only
- Owns (may edit): generated check outputs only and `mvp-today-plan/reports/t284-downstream-equivalent-gates-and-freshness.md`
- Must not touch: authored source/shared docs, run artifacts, provider/browser/Lab live state; do not rerun the known failing task-fixture or start a live/dry run
- Definition of done: all non-fixture check components and owned package checks run, six-output freshness proven or exact stale owner named, machine limitation kept separate from product status
- Report to: `docs/working/mvp-today-plan/reports/t284-downstream-equivalent-gates-and-freshness.md`

### Brief: t285-final-plan-update-draft
- Repository: this repository, report-only
- Task: produce final copy-ready updates for both active plans after t258/t279/t281–t284 without overstating live evidence
- Required reads: both plans' Current State/Next/Blockers/ledger plus t258/t279/t281–t284 conclusions
- Owns (may edit): `mvp-today-plan/reports/t285-final-plan-update-draft.md`
- Must not touch: shared plans, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact compact insert/replace/ledger text within Current State line budgets, separating implementation validation from pending live proof
- Report to: `docs/working/mvp-today-plan/reports/t285-final-plan-update-draft.md`

### Brief: t286-root-suite-permission-failure-diagnosis
- Repository: FluxIQ Core, read-only
- Task: diagnose the failing annotation recovery-permission test from final root `pnpm test`
- Required reads: failing test `runtime/recovery/annotation/tests/patches.test.ts`, directly called permission/patch code, final binding-rule changes, exact failure output
- Owns (may edit): downstream `mvp-today-plan/reports/t286-root-suite-permission-failure-diagnosis.md`
- Must not touch: Core/downstream source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: whether product or stale expectation, exact control-flow cause, smallest source/test fix, affected invariants and focused command
- Report to: `docs/working/mvp-today-plan/reports/t286-root-suite-permission-failure-diagnosis.md`

### Brief: t287-downstream-freshness-order-fix
- Repository: this repository, read-only
- Task: derive the dependency-correct minimal rebuild order after Scenario Lab rebuilt test-contracts and staled test-evidence
- Required reads: t263/t281/t284, package dependency/build scripts, exact output/input ownership only
- Owns (may edit): `mvp-today-plan/reports/t287-downstream-freshness-order-fix.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; run no builds
- Definition of done: dependency DAG, minimal serial rebuild commands, freshness assertions, and whether original t263 order was wrong
- Report to: `docs/working/mvp-today-plan/reports/t287-downstream-freshness-order-fix.md`

### Brief: t288-permission-test-invariant-review
- Repository: FluxIQ Core, read-only
- Task: independently determine whether the failing make/send recovery test expectation conflicts with the risk-only grant boundary
- Required reads: exact failing test, declared/instructed/destructive permission rules, patch application return contract, closest passing permission tests
- Owns (may edit): downstream `mvp-today-plan/reports/t288-permission-test-invariant-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: invariant verdict, stale-test versus product-bug classification, smallest safe fix and regression scope
- Report to: `docs/working/mvp-today-plan/reports/t288-permission-test-invariant-review.md`

### Brief: t289-downstream-freshness-recovery
- Repository: this repository
- Task: execute t287's minimal recovery rebuild and all six freshness assertions
- Required reads: t284/t287, exact package build scripts and freshness checks only
- Owns (may edit): generated outputs via owning build commands and `mvp-today-plan/reports/t289-downstream-freshness-recovery.md`
- Must not touch: authored source/shared docs, run artifacts, provider/browser/Lab live state; do not run dry/live provider commands
- Definition of done: rebuild test-evidence then test-runner, prove all six outputs fresh against final inputs/dependencies, or stop/classify exact failure
- Report to: `docs/working/mvp-today-plan/reports/t289-downstream-freshness-recovery.md`

### Brief: t290-permission-test-reconciliation
- Repository: FluxIQ Core
- Task: reconcile the stale mixed-consequence recovery permission test without changing production behavior
- Required reads: t286/t288 and exact failing test plus nearest create-only/send tests
- Owns (may edit): `runtime/recovery/annotation/tests/patches.test.ts` and downstream `mvp-today-plan/reports/t290-permission-test-reconciliation.md`
- Must not touch: production source, other tests/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: mixed create+send case asserts precise held request/no execution; adjacent create-only case proves ungated execution; focused narrow matrix passes
- Report to: `docs/working/mvp-today-plan/reports/t290-permission-test-reconciliation.md`

### Brief: t291-deadline-retry-failure-diagnosis
- Repository: FluxIQ Core, read-only
- Task: diagnose the final root-suite deadline exploration failure classified as unknown provider transport
- Required reads: failing deepseek-bootstrap-exploration test, t233/t239/t243 provenance changes, deadline/retry/harness boundary code, nearest passing deadline tests
- Owns (may edit): downstream `mvp-today-plan/reports/t291-deadline-retry-failure-diagnosis.md`
- Must not touch: Core/downstream source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: product versus flaky/stale-test classification, exact timing/control-flow cause, smallest fix, and focused deterministic validation
- Report to: `docs/working/mvp-today-plan/reports/t291-deadline-retry-failure-diagnosis.md`

### Brief: t292-deadline-failure-focused-reproduction
- Repository: FluxIQ Core, validation-only
- Task: reproduce the deepseek bootstrap deadline failure in isolation and under a small relevant file set without editing source
- Required reads: t291 brief, failing test command/script, nearest deadline/retry tests only
- Owns (may edit): downstream `mvp-today-plan/reports/t292-deadline-failure-focused-reproduction.md`
- Must not touch: Core/downstream source/shared docs, generated production outputs, run artifacts, provider/browser/Lab state
- Definition of done: repeated isolated result, relevant combined-set result, timing, exact failure shape, and flaky versus deterministic evidence
- Report to: `docs/working/mvp-today-plan/reports/t292-deadline-failure-focused-reproduction.md`

### Brief: t293-deadline-fixture-determinism-fix
- Repository: FluxIQ Core
- Task: replace the flaky wall-clock deadline fixture with deterministic typed post-entry timeout injection
- Required reads: t291 and exact failing deepseek-bootstrap-exploration fixture plus nearest deterministic deadline tests
- Owns (may edit): `runtime/tests/deepseek-bootstrap-exploration.test.ts` and downstream `mvp-today-plan/reports/t293-deadline-fixture-determinism-fix.md`
- Must not touch: production source, other tests/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: endpoint-entered typed timeout drives look/complete on same grant; focused four-file matrix passes; no raised wall-clock timeout
- Report to: `docs/working/mvp-today-plan/reports/t293-deadline-fixture-determinism-fix.md`

### Brief: t294-root-failure-fix-review
- Repository: FluxIQ Core, read-only
- Task: independently review final t290/t293 test-only edits against t286/t288/t291 invariants
- Required reads: those reports and exact two edited test diffs only
- Owns (may edit): downstream `mvp-today-plan/reports/t294-root-failure-fix-review.md`
- Must not touch: Core/downstream source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: test-design/determinism GO/NO-GO and exact remaining validation commands
- Report to: `docs/working/mvp-today-plan/reports/t294-root-failure-fix-review.md`

### Brief: t295-post-freshness-readiness-delta
- Repository: both checkouts, read-only
- Task: snapshot one-Lab/process/lock state and downstream freshness after t289 while Core root rerun remains pending
- Required reads: t280/t289, current process/lock and exact output/input timestamps only
- Owns (may edit): `mvp-today-plan/reports/t295-post-freshness-readiness-delta.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; do not run dry/live commands
- Definition of done: timestamped current GO/NO-GO delta and exact remaining gates, preserving Core test blocker
- Report to: `docs/working/mvp-today-plan/reports/t295-post-freshness-readiness-delta.md`

### Brief: t296-final-test-edit-identity
- Repository: FluxIQ Core, read-only
- Task: after t293 settles, fingerprint the two test-only reconciliations and confirm no production-owner drift since t283
- Required reads: t283, exact t290/t293 diffs and Core git metadata/status only
- Owns (may edit): downstream `mvp-today-plan/reports/t296-final-test-edit-identity.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact test-diff fingerprint, production-scope unchanged verdict, branch/HEAD/status identity for final root validation
- Report to: `docs/working/mvp-today-plan/reports/t296-final-test-edit-identity.md`

### Brief: t297-final-plan-draft-refresh
- Repository: this repository, report-only
- Task: refresh t285's copy-ready plan text for t289 freshness GO and t290/t293 focused closure while root test remains pending
- Required reads: t285/t289/t290/t293/t295 and both active plan Current State/ledger blocks
- Owns (may edit): `mvp-today-plan/reports/t297-final-plan-draft-refresh.md`
- Must not touch: shared plans, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: compact corrected replacements/ledger entries with conditional slot for final root test/dry-run, within line budgets
- Report to: `docs/working/mvp-today-plan/reports/t297-final-plan-draft-refresh.md`

### Brief: t298-post-root-suite-core-check
- Repository: FluxIQ Core, validation-only
- Task: after supervisor's final root test passes, rerun settled-tree root check and scoped diff-check after the two test-only edits
- Required reads: t294 and supervisor root-test result only
- Owns (may edit): generated check outputs and downstream `mvp-today-plan/reports/t298-post-root-suite-core-check.md`
- Must not touch: authored source/shared docs, run artifacts, provider/browser/Lab state
- Definition of done: Core root check and diff-check exact results on same settled test-edit tree, or classified failure
- Report to: `docs/working/mvp-today-plan/reports/t298-post-root-suite-core-check.md`

### Brief: t299-final-run3-stage1-validity-review
- Repository: this repository, report-only
- Task: verify t262/t266's no-hindsight Stage 1 and capture procedure remain accurate after t258/t290/t293 closure
- Required reads: t262/t266/t297 and exact final change-under-measurement summaries only
- Owns (may edit): `mvp-today-plan/reports/t299-final-run3-stage1-validity-review.md`
- Must not touch: shared plans, source, pending debug/run artifacts, generated outputs, provider/browser/Lab state
- Definition of done: copy-ready corrections if needed and final GO/NO-GO for creating pending debug after dry-run
- Report to: `docs/working/mvp-today-plan/reports/t299-final-run3-stage1-validity-review.md`

### Brief: t300-plan-line-budget-and-index-audit
- Repository: this repository, read-only
- Task: check both active plans' current-state line budgets and generated working index assumptions before supervisor applies t297
- Required reads: t297, both plan headers/Current State, working-doc rule/index only
- Owns (may edit): `mvp-today-plan/reports/t300-plan-line-budget-and-index-audit.md`
- Must not touch: shared plans/index, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: current/projected line counts, exact compaction needs, and post-edit regeneration command
- Report to: `docs/working/mvp-today-plan/reports/t300-plan-line-budget-and-index-audit.md`

### Brief: t301-web-permission-test-failure-diagnosis
- Repository: FluxIQ Core, read-only
- Task: diagnose four final root web-suite failures in `run-permission-request.test.tsx`
- Required reads: exact failures, request fixture, Runtime Debug permission rendering/grant continuation, risk-only permission contracts
- Owns (may edit): downstream `mvp-today-plan/reports/t301-web-permission-test-failure-diagnosis.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: stale-test versus product/UI bug classification per assertion, exact safe fix, and focused matrix
- Report to: `docs/working/mvp-today-plan/reports/t301-web-permission-test-failure-diagnosis.md`

### Brief: t302-web-missing-consequence-contract-review
- Repository: FluxIQ Core, read-only
- Task: independently audit that UI displays and grants only `request.missing`, while preserving already-allowed/full declared consequence context correctly
- Required reads: failing test, request component/continuation command, Core request contract and nearest UI tests
- Owns (may edit): downstream `mvp-today-plan/reports/t302-web-missing-consequence-contract-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: field-by-field contract verdict, security impact, smallest test or production fix
- Report to: `docs/working/mvp-today-plan/reports/t302-web-missing-consequence-contract-review.md`

### Brief: t303-web-permission-fixture-audit
- Repository: FluxIQ Core, read-only
- Task: map the shared test request fixture's declared/missing/already-allowed consequences to all four failed assertions
- Required reads: failing test file and its helpers/fixtures only
- Owns (may edit): downstream `mvp-today-plan/reports/t303-web-permission-fixture-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: assertion-by-assertion corrected expectation map and any missing invariant coverage
- Report to: `docs/working/mvp-today-plan/reports/t303-web-permission-fixture-audit.md`

### Brief: t304-web-permission-test-reconciliation
- Repository: FluxIQ Core
- Task: reconcile the one stale web permission test file with exact missing-only approval/grant semantics
- Required reads: t301–t303 and exact failing file
- Owns (may edit): `apps/web/src/features/automation-studio/runtime/tests/run-permission-request.test.tsx` and downstream `mvp-today-plan/reports/t304-web-permission-test-reconciliation.md`
- Must not touch: production source, other tests/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: full declaration context remains asserted; UI list/onAllow and ordinary/high-token/cut-short grants assert singleton send; focused file/matrix passes
- Report to: `docs/working/mvp-today-plan/reports/t304-web-permission-test-reconciliation.md`

### Brief: t305-web-permission-final-review
- Repository: FluxIQ Core, read-only
- Task: review final t304 test diff for complete contract coverage and no weakened UI/security assertion
- Required reads: t301–t304 and exact edited diff only
- Owns (may edit): downstream `mvp-today-plan/reports/t305-web-permission-final-review.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: assertion map GO/NO-GO and exact remaining validation gate
- Report to: `docs/working/mvp-today-plan/reports/t305-web-permission-final-review.md`

### Brief: t306-plan-compaction-cut-map
- Repository: this repository, report-only
- Task: give the supervisor an exact safe archive/cut map for t300's required MVP-plan compaction before t297 integration
- Required reads: t300, current MVP plan line ranges/headings, existing archive naming/protocol
- Owns (may edit): `mvp-today-plan/reports/t306-plan-compaction-cut-map.md`
- Must not touch: shared plans/archive/index, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: exact headings/ranges to archive, retained active skeleton, cross-links and validation commands without data loss
- Report to: `docs/working/mvp-today-plan/reports/t306-plan-compaction-cut-map.md`

### Brief: t307-final-validation-ledger-template
- Repository: this repository, report-only
- Task: prepare the exact final validation ledger block for t290/t293/t304 and pending root/check/dry-run results
- Required reads: t297, t290/t293, t304 when available, current ledger format
- Owns (may edit): `mvp-today-plan/reports/t307-final-validation-ledger-template.md`
- Must not touch: shared plans/archive/index, source, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: copy-ready accepted/partial ledger text with explicit result placeholders and no live overclaim
- Report to: `docs/working/mvp-today-plan/reports/t307-final-validation-ledger-template.md`

### Brief: t308-final-root-test-evidence-audit
- Repository: both checkouts, report-only
- Task: after supervisor root test completes, audit exact package/file/test/skip totals and failure-free completion for ledger use
- Required reads: supervisor command result and t307 only
- Owns (may edit): `mvp-today-plan/reports/t308-final-root-test-evidence-audit.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; run no tests
- Definition of done: exact result summary, evidence gaps, and GO/NO-GO to Core check
- Report to: `docs/working/mvp-today-plan/reports/t308-final-root-test-evidence-audit.md`

### Brief: t309-post-root-final-identity
- Repository: both checkouts, read-only
- Task: after final root test and Core check, record validation-relevant identity/freshness drift before dry-run
- Required reads: t296/t298 and git metadata/status plus exact tracked output timestamps only
- Owns (may edit): `mvp-today-plan/reports/t309-post-root-final-identity.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state
- Definition of done: final source/test identity, production drift verdict, downstream freshness impact, and dry-run GO/NO-GO
- Report to: `docs/working/mvp-today-plan/reports/t309-post-root-final-identity.md`

### Brief: t310-provider-free-dry-run-evidence-audit
- Repository: this repository, report-only
- Task: after supervisor runs the exact provider-free dry-run, audit parsed readiness facts and zero-call evidence against t249/t299
- Required reads: t249/t299 and supervisor sanitized dry-run result only
- Owns (may edit): `mvp-today-plan/reports/t310-provider-free-dry-run-evidence-audit.md`
- Must not touch: source/shared docs, generated outputs, pending debug/run artifacts, provider/browser/Lab state; do not run the dry/live command
- Definition of done: fact-by-fact GO/NO-GO and exact mismatch if any, without exposing raw result content
- Report to: `docs/working/mvp-today-plan/reports/t310-provider-free-dry-run-evidence-audit.md`

### Brief: t311-immediate-pre-dry-run-machine-gate
- Repository: both checkouts, read-only
- Task: take the immediate process/lock/output-presence gate before supervisor's provider-free dry-run
- Required reads: t295/t298 and current process/lock/required output state only
- Owns (may edit): `mvp-today-plan/reports/t311-immediate-pre-dry-run-machine-gate.md`
- Must not touch: source/shared docs, generated outputs, run artifacts, provider/browser/Lab state; do not run dry/live commands
- Definition of done: timestamped one-Lab/process/lock/output GO/NO-GO with exact blocker if any
- Report to: `docs/working/mvp-today-plan/reports/t311-immediate-pre-dry-run-machine-gate.md`
<!-- END RECOVERED t219-t311 -->
