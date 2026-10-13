# Instruction-Led Automations And Supporting Recordings

Status: Active
Status detail: Contract and entry-point investigation before implementation.
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
