# Worker briefs, dispatched and settled

Moved out of `mvp-week2-automation-loop-plan.md` on 2026-09-17 under the
800-line compaction rule. Every brief here was dispatched, its worker
reported, and the result is recorded in the Work Ledger or its report under
`../reports/`. Kept for the wording of each brief, not as pending work.

## Worker Briefs

Recorded at dispatch on 2026-09-15. All three are **investigations that change
no source file**, because the user will review the proposals before anything is
built.

### Brief: w2-a-defect-fixes
- Repository: FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: propose a fix for each of the **five defects** listed in this document's
  Current State. For each one give, in this order: the failing test that
  demonstrates the defect, the fix, the exact files and functions it touches,
  what could regress, and how confident you are that you have the real cause
  rather than a symptom. Reproduce each defect rather than restating it — read
  the code paths and say plainly which of the five you actually proved and which
  you only reasoned about. Where a test would prove it, write the test **in a
  scratch copy outside both repositories** and report the observed failure.
- All five share a shape — the system reports success when nothing succeeded —
  so also say whether one underlying cause explains several of them, and whether
  fixing them in a particular order avoids rework.
- Required reads: `AGENTS.md`; this document's Current State and decisions
  L5, L7, L12; `AS/runtime/live-patch.ts`; `AS/runtime/service.ts` around the
  lines the defects name; `AS/storage/project/adaptation-store.ts`;
  `AS/runtime/service/adaptations/patches.ts`; `AS/runtime/adaptive-orchestrator.ts`
- Owns (may edit): only its report file
- Must not touch: **every source file in both repositories**. This is design for
  the user's review, not implementation
- Validation: none to run beyond scratch-copy reproduction; do not run repository
  gates
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-a-defect-fixes.md`

### Brief: w2-b-flow-authoring-surface
- Repository: FluxIQ Core (`F:\!FluxIQ`), read-only
- Task: L13 says the loop may propose anything a person can do to a flow.
  Establish what that surface actually **is**, and how much of it is reachable
  programmatically today. Enumerate the operations a user performs on a flow
  through the web panel — nodes, wiring, parameter values, subflows, routers,
  instructions, expected state, ports, variables — and for each say whether a
  caller inside Core can already perform it, whether it exists only as a UI
  path, and whether it is covered by the graph-operations or mutation record so
  a change can be reviewed, applied, and rolled back.
- Then answer the design question: what would a single "proposed flow change"
  object have to contain to express any of those operations, be shown to a
  person for approval, be applied atomically, and be reverted? Say whether
  Core's existing adaptation and graph-operation records can carry it or whether
  a new contract is needed, and give the reasoning either way.
- Required reads: `AGENTS.md`; `docs/architecture/code-structure.md`; this
  document's L12 and L13; Core's automation-studio service, `model/`,
  `storage/project/schema/` (especially graph operations and mutation records),
  and the web panel's flow-editor feature directory
- Owns (may edit): only its report file
- Must not touch: every source file in both repositories
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-b-flow-authoring-surface.md`

### Brief: w2-c-harness-options-and-instructions
- Repository: FluxIQ Core (`F:\!FluxIQ`) and this repository, read-only
- Task: L14 and L15 make exploration a Core capability that an imported domain
  extends. Establish how a domain extends Core **today** — the importer SDK,
  registered capabilities, runtime adapters, output actions, and whatever else
  a domain package contributes — and how Core's **instruction system** works,
  including scopes, bindings, and the effective-instruction cache.
- Then propose the design for two things. First, a **harness-option registry**:
  how Core declares the domain-neutral information-gathering actions the loop
  may take, how an imported domain registers more, how the two sets combine, and
  how the loop is stopped from calling one that the current domain or policy
  does not allow. Second, **stage instructions**: how a domain adds to or wholly
  overrides the instructions for a single stage while Core keeps ownership of
  the stage **order**, and where that lands in the existing instruction tables.
- Say explicitly what would have to be true for a non-browser domain — one with
  no DOM, no page, no selectors — to use the identical loop, and name anything
  in the current design that would leak a browser concept into Core.
- Required reads: `AGENTS.md`; `docs/architecture/code-structure.md`;
  `docs/architecture/package-boundaries.md`; this document's L14 and L15; Core's
  `AS/nodes/importer-sdk.ts`, instruction storage and runtime, and LLM task
  contracts; downstream `domain/src/runtime/` for how the web domain plugs in
- Owns (may edit): only its report file
- Must not touch: every source file in both repositories
- Report to: `F:\!FluxIQWebExtension\docs\working\mvp-week2-automation-loop-plan\reports\w2-c-harness-options-and-instructions.md`

### Dispatched 2026-09-16 — applying the four written-up next steps

Partitioned by file across Core. Concurrency held at five per the recorded
resource limit. The supervisor kept two edits it already understood from the
reports rather than dispatching them, and holds the live provider run until
Core is green, because `pnpm lab` builds Core's web panel from the sibling
checkout and would otherwise build a half-edited Core.

**Supervisor, done before dispatch (not delegated).**
`AS/runtime/llm/harness-options/binding.ts` gained `harnessOptions?` and
`classifyRefusal?` on `AutomationStudioLlmEvidenceRuntimeBinding`, the declared
bundle merges in `automationStudioHarnessOptionBundleFromBinding` with its two
throws, and `automationStudioHarnessOptionRegistry` now registers a binding
carrying options but no bare tools — hunk 1 of `w2-3-bounded-exploration`.
Downstream, hunk 2: `domain/src/runtime/llm-evidence/tools.ts` declares
`harnessOptions` (`same_scope`) and `classifyRefusal`, and its
`WebAutomationLlmEvidenceRuntime` type carries both. Core and domain
`tsc --noEmit` exit 0; `node scripts/structure-audit.mjs` passes.
`deniedEvidenceKeys` was deliberately left optional here so one worker owns the
breaking moment end to end rather than leaving Core red for the others.

**Structural decision taken, not asked.** The ~11 lines the exploration wiring
needs land in `service.ts`, which sits at exactly its frozen 6757-line
baseline. Of the report's two options — raise the baseline, or R0 the method
out — R0 was taken. Raising a frozen baseline to fit eleven lines is the
deferral this repository's standards forbid.

### Brief: w2-r0-service-exploration
- Repository: Core
- Task: move `maybeAnnotateRunDetailWithRuntimeLlm` (`service.ts` ~2872-3185)
  into its own module under `AS/runtime/recovery/` with no behaviour change and
  re-baseline downward; then apply hunk 3 — recovery deadline started once per
  recovery, `runAutomationStudioRuntimeExploration` where
  `plan.explorationRequested`, `exploration` into the recovery trace, and the
  `decide` helper modelled on the Flow-bootstrap path at `service.ts:1917`
- Owns: `AS/runtime/service.ts`, new modules under `AS/runtime/recovery/`,
  `recovery/index.ts`, their tests, Core `.structure-baseline.json`
- Must not touch: `harness-options/**`, `recovery/structured-diagnosis.ts`,
  `llm/harness/intervention.ts`, `llm/context-packet.ts`, this repository
- Report to: `.../reports/w2-r0-service-exploration.md`

### Brief: w2-denied-evidence-keys
- Repository: Core
- Task: make `deniedEvidenceKeys` required on the binding, make
  `context-packet.ts:81` fail closed instead of defaulting to deny-nothing, and
  update all 8 call sites (7 under `AS/runtime/tests/**`) in one work unit so
  the tree is never left red
- Owns: `harness-options/binding.ts`, `llm/context-packet.ts`, the listed call
  sites, new fail-closed tests
- Must not touch: `service.ts`, `recovery/**`, `llm/harness/intervention.ts`,
  `domain/src/runtime/llm-evidence/tools.ts`
- Report to: `.../reports/w2-denied-evidence-keys.md`

### Brief: w2-diagnosis-channel
- Repository: Core
- Task: point `recovery/structured-diagnosis.ts:131` at the named diagnosis
  channel Phase 2.2 added instead of scraping `response.metadata`, and stop a
  metadata-only diagnosis passing as validated
- Owns: `recovery/structured-diagnosis.ts` and its tests
- Must not touch: any other `recovery/` file including `index.ts`,
  `service.ts`, `harness-options/**`, `llm/harness/intervention.ts`,
  `llm/context-packet.ts`
- Report to: `.../reports/w2-diagnosis-channel.md`

### Brief: w2-import-cycle
- Repository: Core
- Task: break the `llm/harness/intervention.ts` -> `AS/runtime/recovery/` value
  import that has caused two run-time defects under a clean type check, by
  moving the shared values to a neutral module outside `recovery/`; then forbid
  it mechanically with an `importBoundaries` rule in
  `scripts/structure-audit/config.mjs`, proven by reintroducing the cycle once
  and observing the audit fail
- Owns: `llm/harness/intervention.ts`, the new neutral module and its barrel,
  `scripts/structure-audit/config.mjs`
- Must not touch: `service.ts`, `recovery/**`, `harness-options/**`,
  `llm/context-packet.ts`, `.structure-baseline.json`, this repository
- Report to: `.../reports/w2-import-cycle.md`

## Delivered 2026-09-20 (t011 and t024 briefs, archived 2026-09-21)

### Brief: w2-t011-core-permission-seams
- Repository: FluxIQ Core, read-only
- Task: trace the existing instruction-derived permission comparison and the
  plan-node handle parser to identify the smallest domain-neutral changes for
  consequence reconciliation and Flow-step declarations. Do not implement,
  build, or test while the live baseline is still running.
- Required reads: downstream Current State and `reports/{w2-permission-request,w2-reveal-not-commit}.md`;
  Core `runtime/action-permissions/`; `runtime/llm/harness-options/plan-node-handles.ts`;
  the immediate callers that consume parsed plan handles
- Owns (may edit): only
  `reports/w2-t011-core-permission-seams.md` in the t011 extension worktree
- Must not touch: any Core source, any other report, either working document,
  test files, commits or pushes
- Definition of done: exact data-flow and file:line evidence; proposed minimal
  compatibility behavior; risks and one focused live proof for each seam
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-core-permission-seams.md`

### Brief: w2-open-branch-live-audit
- Repository: this repository; paired Core branches read-only where present
- Task: audit every open task branch against current `dev`, its existing report,
  and current landed code. Identify which unmerged changes are still needed for
  live Week 2 testing, which are already superseded, and which must remain held.
- Required reads: this document's Current State; `pnpm task list`; each open
  branch's commits/diff stat; only the report directly associated with that task
- Owns (may edit): only
  `reports/w2-open-branch-live-audit.md` in the shared `dev` checkout
- Must not touch: source, tests, other reports or working documents, task
  branches/worktrees, Core source, commits or pushes
- Definition of done: one evidence-backed row per open branch with disposition
  `integrate-live`, `superseded/close`, or `hold`, dependencies, overlap risks,
  and the narrow first live proof; explicitly assess t021 batching
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-open-branch-live-audit.md`

### Brief: w2-t011-created-run-timeout
- Repository: this repository and FluxIQ Core, read-only
- Task: diagnose why live run `run-mua7yzln-7c8d0a9d` still exhausted the
  granted-run read-back window despite t022's `newRunId` path. Inspect the run
  bundle call-by-call and the current request/read-back implementation; do not
  expose page data or secrets and do not implement yet.
- Required reads: this document's Current State; `reports/w2-run-timeout.md`;
  the run's `evaluation.json`, `snapshots/live-llm.json`, and bounded lifecycle
  events; `flow-lane/{persisted-flow-run,creation/lane}.ts`; Core requested-run
  id and runtime-session/result-verification paths
- Owns (may edit): only `reports/w2-t011-created-run-timeout.md` in the t011
  extension worktree
- Must not touch: source, tests, other reports/working docs, commits or pushes
- Definition of done: exact failed stage and timeline, whether the named run
  exists and its terminal/verdict state, root cause with file:line evidence,
  smallest fix location, and one focused live rerun command
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-created-run-timeout.md`

### Brief: w2-t011-missing-result-verification
- Repository: this repository and FluxIQ Core, read-only
- Task: diagnose live run `run-mua8g4li-6a746736`, whose named playback is
  durably `succeeded` with 9/9 actions but no result-verification record while
  the runner waits. Determine why the verification call was skipped or stuck.
- Required reads: the bounded run bundle/project status; t012/t022 reports;
  current execution-grant issuance, `result-verification/`, runtime-session
  completion, and downstream settlement/read-back paths
- Owns (may edit): only `reports/w2-t011-missing-result-verification.md` in the
  t011 extension worktree
- Must not touch: source, tests, other reports/working docs, commits or pushes
- Definition of done: exact gate/call state with file:line evidence, smallest
  coherent fix, and the same single-scenario live proof; no secret/page output
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t011-missing-result-verification.md`

### Brief: w2-t024-project-database-lifetime
- Repository: paired task t024, FluxIQ Core implementation with downstream live proof
- Task: make the smallest coherent project-database pool lifetime change that
  prevents a durable run-detail save from stalling during close/reopen races;
  then rerun only `social-scheduler-schedule-post` live. Do not begin with tests.
- Required reads: this document's Current State;
  `reports/w2-t011-missing-result-verification.md`; Core
  `storage/project/database.ts`, its direct pool users, and only its focused test
- Owns (may edit): Core `packages/fluxiq/src/programs/automation-studio/storage/project/database.ts`,
  temporary env-gated stage markers in Core `runtime/service.ts` and
  `runtime/result-verification/run-outcome.ts` (removed before handoff), its
  directly owned focused test if live behavior succeeds, and downstream
  `reports/w2-t024-project-database-lifetime.md`
- Must not touch: other Core/extension source, existing reports/working docs,
  task t011, commits or pushes; no corpus or full suite
- Definition of done: fix pool lifetime; same live scenario reaches terminal
  playback plus durable `resultVerification.status: no_result` and fixture
  oracle, or records the next precise blocker; only then run the narrowest
  pool/type check
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t024-project-database-lifetime.md`

### Brief: w2-t024-post-success-await-trace
- Repository: paired task t024, both sides read-only
- Task: while the current t024 schedule-post run remains live, trace the exact
  unresolved await after its 9/9 successful playback. Distinguish run-detail
  save, store release, session write, dataset listing, and verification entry
  using closed lifecycle/SQLite/process evidence; reassess the pool hypothesis.
- Required reads: Current State; t024 pool brief and t011 missing-verification
  report; Core service post-success path, typed run-detail writer/repository,
  database pool, result-verification ports; bounded live run state
- Owns (may edit): only `reports/w2-t024-post-success-await-trace.md` in the
  t024 extension worktree
- Must not touch: source, tests, other reports/working docs, processes, commits
  or pushes; no page data, secrets, build, unit suite, or new live run
- Definition of done: name the exact unresolved promise or narrow it to the
  smallest instrumentable boundary, explain why the first fix failed, and give
  the next one-change live experiment
- Report to: `docs/working/mvp-week2-automation-loop-plan/reports/w2-t024-post-success-await-trace.md`
