# Instruction-Led Automations And Supporting Recordings

Status: Active
Status detail: Entry points mapped; paired t519 implementation of instruction gates and described supporting evidence.
Created: 2026-10-13
Last updated: 2026-10-13
Owner: Codex senior supervisor
Scope: Require explicit instructions for every automation, including existing automations before their next run; recordings are described supporting evidence and cannot independently define an automation.
Paired document: C:/Users/osrs_/FluxStuff/!FluxIQ/docs/working/instruction-led-automation-plan.md
Related: [adaptation and breadth](./adaptation-and-breadth-plan.md), [MVP](./mvp-final-month-plan.md)

## Current State

- User direction: instructions are mandatory and authoritative; recordings are purely supplemental. Every recording needs a description of what it demonstrates.
- User confirmed existing automations without written instructions must supply them before their next run. UI-only enforcement is insufficient; Core execution entry points must refuse before actions/model calls when instruction authority is missing.
- Reuse Core's existing durable FlowInstruction inventory, active instruction selection and build authority where possible. Do not create extension-local durable instruction/recording ownership.
- Empty draft scaffolds may exist so instructions can be entered; creation/build/activation/run paths cannot turn a recording alone into an executable automation. Direct recording-proposal approval paths need investigation and removal or redirection to instruction-led authoring.
- Recording descriptions are separate from automation instructions. Generated recording titles, inferred goals or copied trace labels do not satisfy explicit input. Preserve old recordings and allow descriptions to be added through the owning service.
- Existing recorded-only flows need a clear instructions/migration path. Investigate whether instruction attachment alone preserves the stated authority or whether their old recording-derived build must be regenerated; do not silently treat a trace as the task.
- Previous paired t518 is committed locally and unpushed. Store run-mv74jziz-abaeb09e passes with required filter/extraction execution and zero model calls. Social run-mv74jzv2-e55828db passes its page oracle but its recorded Flow fails; no terminal replay success is claimed. Its standalone recording path is being superseded by this requirement. Preserve all code/evidence; no further recorded-only relaunches.
- Main downstream unrelated .clinerules/fluxiq.md edit is preserved. Neither dev has been pushed.
- Paired task t519 lives at C:/Users/osrs_/FluxStuff/fxwork/t519/{!FluxIQWebExtension,!FluxIQ}, branch task/t519-instruction-led-automations. Base public libraries built narrowly; no full suite or panel launch.
- Discovery found ordinary generation already checks active instruction inventory, but deterministic persisted runs/resume and recording/policy proposal activation bypass it. A recording proposal's instructions metadata does not control its trace-derived graph.
- Migration: preserve existing legitimate written Flow-owned instructions; absence, blank/inactive/wrong-owner or known model-only suggestions cannot satisfy task authority. Do not require a new origin marker for all old legitimate written instructions. Existing graphs may be retained after actual instruction entry; do not claim this retroactively verifies an instruction-led build.
- New standalone recording/policy activation is retired with an actionable instruction-led authoring route. Empty drafts and recording diagnostics remain accessible. Lab's recorded-only executable lane is retired in favor of its existing explicit-task created-Flow lane, with no new hidden authoring engine.

## Worker Briefs

### Brief: instruction-contract-discovery
- Worker: replay_investigation; Core read-only. Read this Current State, Core index and applicable instruction/build/runtime documents only where used.
- Inspect existing FlowInstruction inventory/build authority, all persisted automation execution/resume/scheduling entry points, finalized recording proposal approval and durable recording description contracts.
- Own report: instruction-led-automation-plan/reports/core-contract-discovery.md in downstream. No shared docs, source edits, commits, builds or live/provider runs.
- Return exact files/API boundaries, bypasses, minimal reuse design, old-flow migration implications and narrow test plan. Identify file partitions for implementation; no browser concepts in Core.

### Brief: instruction-ui-discovery
- Worker: codex-t517; extension/Core web UI read-only. Read this Current State and narrowly relevant recording/build/run UI modules.
- Trace instruction-first creation, recording-only shortcuts, recording start/description editing, saved-flow run/resume controls and actionable missing-instruction messages in Chrome/Firefox shared UI and Core web UI.
- Own report: instruction-led-automation-plan/reports/ui-discovery.md. No shared docs, source edits, commits, builds, panel management or live/provider runs.
- Return precise file-owned implementation partitions and user flows that require explicit task text and described optional recordings. Existing data must remain accessible.

### Brief: instruction-lab-discovery
- Worker: codex-t516; downstream domain/Lab read-only. Read Current State; inspect existing instruction/recording context assembly and realistic Lab manifests/recorded-flow callers.
- Own report: instruction-led-automation-plan/reports/lab-domain-discovery.md. No source/shared docs/commits/builds/live/provider runs.
- Find how instructions and recording descriptions reach the model and how recorded-only fixture paths must change. Do not preserve a hidden test-only bypass or add scenario-shaped product guidance. Distinguish manually authored deterministic execution from model generation.

### Brief: instruction-core-implementation
- Repository: paired t519 FluxIQ Core.
- Task: enforce active nonempty Flow-owned explicit task instructions for build and persisted run/resume/repair before effects; retire recording-only executable activation; own described supplementary evidence.
- Required reads: Current State, own core-contract-discovery report, Core AGENTS and owning modules.
- Owns (may edit): Core packages/contracts/**, packages/fluxiq/**, packages/client-gateway-websocket/** and their adjacent tests. Core backend/API/gateway only; no apps/web files.
- Must not touch: Core apps/web/**, downstream source, shared working docs, t518, user data, commits/pushes.
- Contract: recording.description is optional in persisted legacy shape; new start/create and attach require nonblank description. Update existing description without losing events. Description never substitutes for FlowInstruction.
- Contract: reuse active instruction inventory; preserve valid existing written Flow-owned tasks; known model/recording inference cannot grant authority. General task-save endpoint supports legacy existing flows, not only blank generation targets.
- Contract: recording/policy proposals may remain diagnostic; direct executable approval refuses with closed actionable instruction-led-authoring error. No copying every trace act into instruction-led work.
- Contract: described linked recordings enter generation as untrusted supplementary evidence subordinate to explicit instructions; validate ownership/finalized/description before provider call.
- Coordinate wire/API signatures and closed errors with UI and Lab workers before changing consumers. Internal graph unit seams are not user automation bypasses; projectless public service execution must require explicit authority.
- Definition of done: narrow adjacent tests prove missing/blank/inactive/wrong-owner instruction refusal with zero dispatch/provider, legacy migration, valid no-model run, direct recording-only refusal and description integrity. Run narrow tests only; notify root before package-wide type/build gates.
- Report to: docs/working/instruction-led-automation-plan/reports/core-implementation.md downstream.

### Brief: instruction-ui-implementation
- Repository: paired t519 downstream extension and Core web UI.
- Task: instruction-first authoring and actionable legacy next-run recovery; require recording description at start/edit/attach; recordings remain optional evidence.
- Required reads: Current State, own ui-discovery report, owning Core web/extension UI modules.
- Owns (may edit): downstream apps/extension/** and adjacent tests; Core apps/web/** and adjacent tests only.
- Must not touch: Core packages/** backend/contracts, downstream domain/packages/test-runner/packages/test-contracts/apps/scenario-lab, shared working docs, t518, user data, commits/pushes.
- Remove recording-only generate/test/save/approval shortcut from runnable UI. Redirect to explicit Instructions authoring with described optional recording attachment; no task inferred from title/trace/description.
- Existing flow missing task instructions must expose actual Instructions editor before next run/resume; deterministic readiness checks must require the same authority. Surface closed backend errors/actionable recovery instead of generic retry.
- New recording/extraction auto-start and Core web client start must collect an explicit description; existing recordings can edit it independently of name/notes. Chrome/Firefox share the same requirement.
- Coordinate API/protocol shape and error codes with Core worker; server guards remain authoritative. Blank drafts stay editable; no extension-local durable authority store.
- Definition of done: adjacent tests cover task-required authoring/run/recovery, missing descriptions, separate fields, preserved legacy recording edits and shared browser panel. Narrow tests only; notify root before type/build gates.
- Report to: docs/working/instruction-led-automation-plan/reports/ui-implementation.md.

### Brief: instruction-lab-implementation
- Repository: paired t519 downstream domain/Lab.
- Task: retire recording-only executable lane, use existing explicit-task generation paths, require explicit fixture recording descriptions and respect persisted instruction refusal.
- Required reads: Current State, own lab-domain-discovery report, owning runner/task/fixture modules.
- Owns (may edit): packages/test-runner/**, packages/test-contracts/**, apps/scenario-lab/**, domain/** and their adjacent tests.
- Must not touch: apps/extension/**, Core source, shared working docs, t518, user data, commits/pushes.
- Retire direct recorded --flow activation with actionable existing created-Flow command; preserve read/mapping diagnostics. Do not build another authoring engine, silently attach fixture goals to saved/clone flows, or keep a hidden bypass.
- Provide explicit authored fixture demonstration descriptions at recording starts through public description contract; do not infer from title/trace or copy automation instruction into description. Coordinate wire shape with UI/Core workers.
- Domain generic model guidance establishes instruction precedence over optional untrusted demonstrations; never mirror realistic tasks, oracle values, selectors, products or names in product guidance.
- Existing explicit-task chat/build route remains normal generation. Separate generation/reuse metrics, with no manual execution counted as model generation. Missing instruction errors propagate without mutating old flows.
- Definition of done: narrow runner/request/recording/fixture/model-guidance tests prove early refusal/no hidden conversion and no oracle context leakage; no paid/live runs or full suites. Notify root before package type/build gates.
- Report to: docs/working/instruction-led-automation-plan/reports/lab-implementation.md.

## Implementation Phases

1. Map authoritative persisted instructions and recording descriptions; record all public creation/build/run bypasses and final migration contract.
2. Enforce instruction authority at Core build and persisted execution boundaries, with actionable closed errors and tests proving refusal before effects. Make described recordings supplementary context; remove standalone recording approval into executable automations.
3. Update extension and Core web UI for mandatory task instructions, required recording descriptions, optional recording attachment and missing-instruction recovery on existing flows. Keep browser UIs aligned.
4. Synchronize domain/context/protocol and Lab entry points; realistic tests provide explicit goals/described evidence and exercise production gates. Update authored architecture/MVP guidance to instruction-first semantics.
5. Supervisor independently runs touched-package types, changed-subject tests, audits and available realistic browser validation. Integrate and push both dev branches only as a coherent verified unit; prior t518 remains separately reviewable until resolved.

## Validation

- Missing, whitespace-only, deleted/inactive or wrong-owner instructions cannot build/run/resume an automation, including existing saved flows. Assert no dispatch/provider calls occur before refusal.
- Explicit valid instructions permit deterministic reuse; do not require a new model call on every ordinary execution.
- Recording alone, or only a recording description, cannot create/approve/run an executable automation. Instructions remain authoritative over extra recorded steps, retries and demonstrations.
- New recordings require descriptions; old recordings can be described without losing data and cannot be attached as unnamed supporting evidence.
- Test direct service/gateway/web routes in addition to disabled buttons; drafts and internal graph unit execution must not be confused with user-runnable automations.
- Narrow checks only; no full suites or new paid runs during contract investigation. No user panel management.

## Work Ledger

### 2026-10-13 - User establishes instruction authority

- Agent: Codex senior supervisor.
- Changed: new product direction recorded; user confirmed missing instructions block existing automations before their next run. Previous recording-only live controls sealed and preserved; no further launches.
- Validation: initial source inspection finds existing FlowInstruction inventory and candidate build authority, plus direct recording proposal generation/approval paths that require review. Prior t518 narrow validation and live limits remain in the paired adaptation document.
- Outcome: read-only discovery briefs prepared before implementation; no source changes or pushes for this requirement yet.

### 2026-10-13 - Bypasses mapped and paired implementation dispatched

- Agent: Codex senior supervisor; discovery workers replay_investigation, codex-t517 and codex-t516.
- Changed: accepted three source-backed discovery reports, established disjoint Core-package/UI/Lab implementation briefs and provisioned paired t519 through owning worktree helpers with offline install.
- Why: recording/policy activation compiles the trace independently of task metadata, deterministic run/resume lacks mandatory task admission, and recording starts have no owned description.
- Validation: independently inspected FlowInstruction model, API save defaults, generation-context gate and runRuntimeSession admission. `pnpm.cmd --filter @fluxiq/contracts build`, `--filter fluxiq build`, and `--filter @fluxiq/client-gateway-websocket build` passed for base public contract prerequisites; no full suite or live run.
- Outcome: Accepted discovery; source implementation in progress. Preserve existing legitimate written Flow instructions and old data; no inferred task migration or standalone recording replay launches.
