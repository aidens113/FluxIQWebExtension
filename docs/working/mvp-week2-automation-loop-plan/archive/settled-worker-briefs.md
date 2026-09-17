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
