# Codex Handoff Briefs - Historical Dispatches

Status: Archived
Status detail: Completed dispatch history; current work is owned by the parent document.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Codex senior supervisor
Scope: Preserve original t516/t517/t518 implementation and investigation briefs.
Paired document: none
Related: [parent working document](../../adaptation-and-breadth-plan.md)

## Current State

Historical briefs only. See the parent Current State and current briefs for execution. Worker reports retain measured results and limitations.

## Worker Briefs — Codex continuation (2026-10-13)

### Brief: codex-t517
- Repository: paired t517 trees at `C:/Users/osrs_/FluxStuff/fxwork/t517/`.
- Task: review uncommitted t517, fix dead lasting actions reporting graph success, add meaningful failure feedback and document the new failure field.
- Required reads: this Current State; original t517 report; Core AGENTS.md boundary and code-structure; t517 diffs and tests.
- Owns (may edit): t517's existing changed source/tests; Core executor graph/step-loop/defensive failure finalization and adjacent tests; downstream `domain/src/runtime/llm-evidence/tool-rejection.ts`, `action-failure/refusal.ts`, `rejection-next/next-sentence.ts` and adjacent tests; both repositories' relevant architecture docs.
- Must not touch: shared working documents, any other task tree, lifecycle scripts, generated/runtime data. No commits, merges, pushes or full suites.
- Definition of done: exhausted dead lasting action is a failed run; exactly one certain-no-effect re-press; focused tests, touched-package typechecks and audits pass. Preserve explicit failure handlers/branches.
- Report to: t517 downstream `docs/working/adaptation-and-breadth-plan/reports/codex-t517.md`.

### Brief: codex-t516
- Repository: paired t516 trees at `C:/Users/osrs_/FluxStuff/fxwork/t516/`.
- Task: review uncommitted t516 against report; verify handler learning, judged-only application and actual robot-check diagnosis; fix defects found within owned paths.
- Required reads: this Current State; original t516 report; Core AGENTS.md boundary and code-structure; t516 diffs and tests; store soft-check source.
- Owns (may edit): t516's existing changed source/tests; Core `runtime/service/runtime-session/` interruption learning and adjacent tests; downstream architecture docs for cleared-layer/handler contract; Core architecture doc already changed.
- Must not touch: shared working documents, any other task tree, lifecycle scripts, generated/runtime data. No commits, merges, pushes, paid/browser Lab runs or full suites.
- Definition of done: focused tests, touched-package typechecks and audits pass; model-free learning stays on when adaptations are kept; detail remaining integration/live risks honestly.
- Report to: t516 downstream `docs/working/adaptation-and-breadth-plan/reports/codex-t516.md`.

### Brief: codex-replay-investigation
- Repository: read-only main checkout plus t262/t516 run evidence.
- Task: identify whether unchanged-site replay failures share a recording-to-Flow cause; pinpoint failed nodes and their lifecycle, and propose the smallest fix with regression cases.
- Required reads: this Current State; runner recorded-Flow lane; recording proposals; store and crossborder workflow sources; sanitized diagnostics for run-mv6xaosc-1c145c22 and run-mv6y2t42-222ea4f9.
- Owns (may edit): only `docs/working/adaptation-and-breadth-plan/reports/codex-replay-investigation.md` in t262 downstream tree (existing task branch).
- Must not touch: source, shared docs, generated/runtime data. No commits, merges, pushes or test/browser/provider runs. Never print recorded page content or secrets.
- Definition of done: evidence-backed shared-cause conclusion or explicit separation, exact code pointers and actionable implementation/test brief.
- Report to: the owned report path in t262.

Codex supervisor has dispatched these independent briefs. Worker claims remain unverified until reviewed and rechecked here. Integration is serial, downstream before Core, with narrow gates only.

### Brief: codex-t518
- Repository: paired t518 trees at `C:/Users/osrs_/FluxStuff/fxwork/t518/` (task/t518-recorded-recovery-state-routing).
- Task: connect recorded actions to existing positive-evidence state routing, fixing recorded manual recovery steps that playback already completed; correct state-linker producer/ingestion clock mixing.
- Required reads: this Current State; `reports/codex-replay-investigation.md`; Core boundary/code structure; existing recording proposal generation/candidates, host runtime route-state callbacks and state-linker; downstream host route-state projection and inferred waits.
- Owns (may edit), Core: `runtime/state-linker.ts`, `runtime/host-runtime.ts`, `runtime/recording-flow-proposal.ts`, `runtime/io-bridge.ts` and adjacent tests for recognized capture-phase propagation; `nodes/importer-sdk.ts` recording candidate types if needed; `runtime/service/recordings/`, `runtime/service/recording-state-index/`, adjacent owning tests; minimal service wiring in `runtime/service.ts` only if needed and within its existing budget. All paths under `packages/fluxiq/src/programs/automation-studio/`.
- Owns (may edit), downstream: `domain/src/runtime/host-runtime.ts`, historical projection under `domain/src/runtime/route-state/` and tests/barrels; `domain/src/recording/proposals/late-target-wait.ts` and tests; `domain/src/tests/domain.test.ts` and `web-panel-host.test.ts`; route-state signature/compare/effect-sign modules/tests; `domain/src/recording/web-state/{state-values,types,action-target}.ts`, `element/{kind,selection}.ts` and tests for live/historical identity parity; present-wait classification/tests only if needed. Use new `docs/architecture/recorded-replay-state.md` in each repository for authored documentation.
- Must not touch: t516/t517 trees or owned executor/learning files; shared working documents; fixtures, model prompts/guidance, oracles, runtime data. No commits, merges, pushes, paid/browser Lab runs or full suites.
- Design: optional host-owned historical snapshot projection; Core loads indexed durable snapshots, chooses strict producer-time at-action/pre-state and next-action-boundary after-state with explicit provenance; rejects ambiguous/missing/truncated captures; signs with existing host callbacks and persists hashes-only routeSignatures onto candidates/nodes.
- Safety: no generic missing-control skip, timeout bypass, or invented terminal state. Existing effect_holds/forward routing owns skip decisions. Only inferred present-target waits may receive narrowly classified missing-target readiness; all ordinary waits retain their semantics. Missing evidence retains existing failure behavior.
- Definition of done: generic regression for automatic recovery followed by recorded manual retry, transient check cleared before its recorded control, delayed ingestion, ambiguous/missing/truncated snapshots and dead lasting controls; focused tests, touched-package typechecks and audits pass. Report actual sample projection coverage without page data.
- Report to: t518 downstream `docs/working/adaptation-and-breadth-plan/reports/codex-t518.md`.

### Brief: codex-t518-capture
- Repository: t518 downstream tree at `C:/Users/osrs_/FluxStuff/fxwork/t518/!FluxIQWebExtension`.
- Task: preserve explicit evidence that a capture found no dialog/blocker, so missing historical evidence is not mistaken for absence.
- Required reads: this Current State; extension `content/evidence/dialogs.ts`, `overlays.ts`, snapshot assembly and owning tests; domain `recording/web-state/evidence/project.ts` (read-only) zero-count projection.
- Owns (may edit): `apps/extension/src/content/evidence/dialogs.ts`, `overlays.ts`, adjacent tests; `content/activity-overlay/tests/cover-detection.test.ts` consumer assertion; comment-only `content/evidence/page.ts` correction. No functional assembler change.
- Must not touch: all domain/Core files, model guidance, fixtures/oracles, shared docs, other task trees. No commits/merges/pushes/provider/browser runs/full suites.
- Design: existing producers return explicit empty evidence after their real scans, with correct tested/blocked counts. Do not invent absence after errors, partial scans, or missing APIs. Keep existing positive-dialog/blocker semantics and sensitive-data filtering. Domain already persists openCount/blockedCount from explicit producers and may omit empty collection blobs.
- Definition of done: fail-first real-producer unit checks for known-empty versus failed/unknown evidence, positive evidence unaffected; extension source/test typechecks and owning tests pass. Report any required source path expansion.
- Report to: t518 downstream `docs/working/adaptation-and-breadth-plan/reports/codex-t518-capture.md`.

### Brief: codex-t518-live-debug
- Repository: paired t518 trees; read-only investigation of fresh provider-free failures.
- Task: identify the exact shared facility.contract rejection after successful fixture recording and before Flow replay; propose the smallest source fix and owning regression.
- Required reads: Current State; run-mv70bldo-0be720fd in test-runs/instances/codex-t518-slot-3 and run-mv70cdt5-f129f5ab in codex-t518-slot-1; recording stop/proposal/approval orchestration and corresponding Core contract only as needed.
- Owns (may edit): own report only, docs/working/adaptation-and-breadth-plan/reports/codex-t518-live-debug.md in t518 downstream.
- Must not touch: source, shared documents, fixtures/oracles, generated/runtime data; no commits/pushes/browser runs/full suites.
- Safety: inspect private artifacts locally; never return raw page data, credentials, tokens, raw logs or response bodies. Report static contract fields, source locations and sanitized failure metadata only.
- Definition of done: exact rejecting endpoint/code path, caller/callee mismatch, relation to t518 changes, bounded fix paths and regression command. Both final fixture checkpoints succeeded; evaluations say facility.contract/unclassified and zero model calls; flow-lane snapshot absent.
- Report to: own report above and supervisor.

### Brief: codex-t518-store-replay-debug
- Repository: paired t518 source, read-only store run-mv70yr2e-cebae56b in test-runs/instances/codex-t518-slot-1; crossborder passing run-mv70yrj2-bc7f032a in slot 3 as comparison.
- Task: trace store's four web.dom.wait_for_selector timeouts after approval succeeds. Determine exact inferred versus authored wait, capture completeness/provenance/signature coverage, live matching reason and minimal safe fix.
- Required reads: Current State; own t518 report; flow-lane/runtime/evidence artifacts privately; owning historical projector, recorded-routing signer and existing Core routing only as needed.
- Owns (may edit): own report only, docs/working/adaptation-and-breadth-plan/reports/codex-t518-store-replay-debug.md in t518 downstream.
- Must not touch: source, fixtures/oracles/model guidance/shared docs/original runtime data; no commits/pushes/browser/provider/full-suite runs.
- Safety: no raw page values, selectors, state hashes, credentials/tokens or log/response bodies in report. Return static failure/output codes, evidence completeness counts, source locations and fix paths. No generic timeout/absent-control success.
- Definition of done: explain why positive state routing failed, prove proposed fix with bounded generic regression design, distinguish missing producer evidence from routing defect. Crossborder oracle passed, zero calls/harness activations, an obsolete click was skipped; store extraction never ran.
- Report to: own report above and supervisor.

### Brief: codex-t518-live-capture-coverage
- Repository: paired t518 source; read-only fresh store/crossborder retained recordings named in store-debug brief.
- Task: measure real historical capture projection/provenance coverage, especially store transient-check actions and next extraction; identify exact declining evidence fields or phase/timestamp gaps.
- Required reads: Current State, capture report, domain historical projector and extension capture producers; retained private recording/state indexes and snapshots only as needed.
- Owns (may edit): own report only, docs/working/adaptation-and-breadth-plan/reports/codex-t518-live-capture-coverage.md in t518 downstream.
- Must not touch: source/shared docs/fixtures/oracles/original state; no commits/pushes/provider/browser/full-suite runs.
- Safety: report counts, boolean completeness, known schema/phase field names and source locations only; no raw page values, selectors, hashes, state bodies, credentials or tokens.
- Definition of done: actual projector acceptance counts; capture timing agreement; specific missing evidence and safe owning producer change if required. Other debug worker owns executor routing/failure lifecycle; relay findings to it to avoid duplicate investigation.
- Report to: own report and supervisor/replay_investigation.

### Brief: codex-t518-extraction-provenance
- Repository: t518 downstream tree, same task branch.
- Task: preserve explicit before-action provenance on the existing extraction-definition recording capture so recorded recovery can route to the later required read.
- Required reads: Current State; live-capture report; content/picker/recorded-event.ts and background/extraction/confirm.ts; recorder.basePayload and existing recorder/picker/extraction tests.
- Owns (may edit): apps/extension/src/content/picker/recorded-event.ts and adjacent owning tests; background/extraction/tests/ confirmation ordering regression if needed (confirm.ts read-only unless a genuine ordering defect is demonstrated). Update own live-capture report with change/checks.
- Must not touch: human type/scroll producers, after-execution confirmations, Core/domain signer/projector/routing, fixtures/oracles/shared docs; no commits/pushes/browser/provider/full suites.
- Design: confirmExtraction awaits recordDefinition before dispatching extract_list; recordExtraction emits data.extract and synchronous basePayload captures before returning. Stamp only this genuinely before-execution event with existing captureTiming before-action metadata. Preserve ordering and failure propagation; never relabel human type/scroll or result.finishedAt snapshots.
- Definition of done: fail-first emitted metadata regression plus confirmation record-before-dispatch check; owning tests and extension source/test check pass. Explain limits: human type/scroll captures remain after/unknown and unsigned; extraction supplies a safe future read boundary, not invented completion.
- Report to: docs/working/adaptation-and-breadth-plan/reports/codex-t518-live-capture-coverage.md and supervisor.

### Brief: codex-t518-social-replay-debug
- Repository: paired t518 source; read-only social run-mv71jipp-fa66f988 in test-runs/instances/codex-t518-slot-4.
- Task: identify the timed-out recorded wait after automatic Post recovery; trace required readiness, route/effect evidence and whether genuine terminal after-state evidence exists.
- Required reads: Current State, t517/t518 reports, private runtime/recording artifacts; owning signer/state-routing and recorder flush/stop boundary as needed.
- Owns (may edit): own report only, docs/working/adaptation-and-breadth-plan/reports/codex-t518-social-replay-debug.md in t518 downstream.
- Must not touch: source/shared docs/fixtures/oracles/original state; no commits/pushes/provider/browser/full suites.
- Safety: report static codes, phase/field names/counts, source locations only. No raw page values/selectors/hashes/state/log bodies or secrets.
- Definition of done: explain why site oracle passes but Flow fails; distinguish obsolete wait/click from essential step. Identify a safe producer-boundary fix if existing evidence is insufficient. Never infer action causality or capture phase solely from timestamp or blindly skip terminal waits.
- Report to: own report and supervisor; capture worker owns store mismatch investigation.

### Brief: codex-t518-terminal-recovery-design
- Repository: paired t518 source, read-only design/probes following social replay-debug report.
- Task: specify the smallest safe settled terminal recording capture and generic terminal state-routing seam for obsolete manual recovery after runtime success.
- Required reads: Current State/social report; recorder/background stop/flush, IO bridge/state index, recorded-routing signer, executor state-routing guards/result/graph integration.
- Owns (may edit): own report only, docs/working/adaptation-and-breadth-plan/reports/codex-t518-terminal-recovery-design.md. Private synthetic non-browser probes allowed.
- Must not touch: source/shared docs/fixtures/oracles/original state; no commits/pushes/provider/browser/full suites.
- Design requirements: producer asserts actual settled end boundary, links exact last executable observation, rejects intervening acts/busy/incomplete capture; preserve through owning generic contracts/index. Core must not infer phase from clock alone. Completion requires positive effect evidence, existing skipped-output/checkpoint/lasting-repeat guards, no remaining required read and no blanket wait skip.
- Definition of done: exact file partitions for producer/contract/signer/terminal routing, proposed generic regressions/negative rows, compatibility and minimum proof requirements. Show how a future terminal effect can settle an inferred readiness wait safely; no completion from controls disappearing or goal oracle alone.
- Report to: own report and supervisor; store comparison worker owns historical-control parity investigation.

