# Shared screening export and initialization investigation

Status: Active; readonly source findings, service callee diagnosis pending.
Owner: resume-ab
Scope: bounded loop-limits classifier/repair compatibility and failed-decision helper dependencies; no service/activity/build-judge reads or mutations.

## Confirmed source

The single classifier implementation is runtime/loop-limits/secret-named-key.ts. It has no imports. Its only runtime top-level value is SECRET_KEY_WORDS, a module-local Set; the exported function reads it when invoked. No top-level call to the classifier occurs in this leaf.

Repair compatibility runtime/recovery/repair-context/secret-named-key.ts reexports that classifier through ../../loop-limits/index.ts. That barrel exports evidence-loop.ts, the classifier, flow-bootstrap-rounds.ts, and flow-bootstrap-evidence-loop.ts. Its explicit comment acknowledges an import cycle with ../llm and attempts to initialize an export before the module returning into llm. Source order alone is not evidence of a missing service callee or a reliable dependency correction.

repair-context/parameter-screen.ts consumes the compatibility reexport and existing llm/harness screening exports. It invokes classifier inside parameter/object and URL screening functions, not during its own module initialization. The compatibility barrel also reexports authored-state-screen/flow-graph/parameter-screen/step-parameters; these were not read in this bounded task.

The newly extracted llm/failed-decision/feedback.ts reads the feedback tool ID through ../index.ts and the superseding function through ../decision-context/index.ts. llm/failed-decision/usage.ts reads the error class through ../index.ts. The main evidence-loop.ts imports the new failed-decision owning barrel; the llm barrel reexports that main loop. These are return edges into a barrel which exposes the caller. Both helpers read these runtime imports only when their exported functions are called; neither has a static runtime initializer invoking another module. Type-only imports (Json values, usage summary, evidence entry) do not create runtime dependency edges.

## Limits and requested next evidence

Eight initial files read exactly as briefed. Requested four loop-limits/llm export-owner reads plus exact existing unusable-decision value-definition lines to trace static initialization. No source graph alone establishes the actual TypeError, missing callee, module cache behavior or service failure cause. The service/activity/build-judge worker owns that diagnosis. No tests, builds, runtime/provider actions, state changes or source edits performed.

A dependency-safe correction, if the failing callee is proven to be on one of these cycles, must separate leaf shared policy from barrels that return to its consumers, retain one classifier implementation and preserve old repair consumers. Do not reorder exports as a guessed workaround, duplicate secret policy, weaken screening or alter error accounting. Exact implementation partition depends on the confirmed callee and approved owning barrel.

## Exact callee evidence from independently owning worker

resume_live_prep reported source-level temporary typeof probing at the actual service round invocation: buildJudge.roundStarted is function; observeAutomationStudioEvidenceLoop is function; runAutomationStudioLlmEvidenceLoop is undefined. The undefined value is imported by service.ts from ./llm/index.ts. Qualified failure is pre_provider_validation_failed/pre_provider_validation, thrown.TypeError at runtime.service.ts:1572 with zero notes. The owner restored its diagnostic-only fixture/probe immediately and reproduced standalone service fixture failure. This report did not read or edit those owners and does not substitute that worker claim for supervisor verification.

Thus the actual missing callee is the public loop export, not a demonstrated call to the shared classifier. New helper return imports traverse the same public llm barrel that exports their caller; this is a concrete circular graph candidate. Initial source shows no top-level helper invocation, so a causal module-loader/export-snapshot claim still requires the exact export graph and supervisor observation. No source edits authorized/performed here.

## Expanded source confirmation and minimal proposal

Five additional reads explicitly approved: loop-limits/evidence-loop.ts and flow-bootstrap-rounds.ts have only literal static ceilings; flow-bootstrap-evidence-loop.ts reads harness values and ../llm/index.ts runtime values. llm/index.ts reexports the main evidence loop at line63. unusable-decision.ts owns both the authoritative feedback tool ID and error class, with existing narrower provider/failure/reply dependencies. Its exports already feed the main loop through the preexisting direct sibling seam.

The new helper imports create main evidence-loop -> failed-decision -> full llm barrel -> main evidence-loop. This concrete newly introduced return edge is avoidable without changing public export order or duplicating constants. Presence of the edge and an independently observed missing main loop export support investigating it; neither proves the exact module-loader snapshot mechanism by itself.

Proposed exact three-owner change (pending release): usage.ts accepts an already narrowed typed unusable error or undefined, importing only its type; coordinator retains existing instanceof/enabled filtering before selecting usage. feedback.ts accepts toolId supplied from the coordinator's existing authoritative constant, then uses it for supersede and feedback entry identity; removes its full llm barrel runtime import. Coordinator invokes both helper seams with the same values as before. Helpers keep their cohesive owning barrel and all accounting/field/proof/permission behavior. No duplicated constant, fixture order workaround, policy relocation or broad barrel redesign. Validate affected72tests and supervisor-owned actual service regression; only then claim the observed missing export corrected.

## Released implementation and validation

Supervisor released the exact three-source proposal after source review. Both failed-decision helpers now have no runtime import from the full llm public barrel: usage imports only types and accepts coordinator-narrowed error|undefined; feedback receives the authoritative toolId constant from coordinator. Both caller sites preserve enabled/instance filtering, usage precedence and feedback identity. No other source, export order or fixture order changed. Coordinator remains798physical lines. Owning diff check passes.

Owning72test rerun after source freeze: exit0,2files/72passed,7.24seconds through heavy.sh. Exact owner command remains the unusable-decision/unreadable-replies union recorded in b4-cost-accounting report. Retained worker separately runs actual service1 causal fixture (service-authoring/tests/retained-rerun-feedback.test.ts), avoiding duplicate execution; actual restoration still pending its observed result. Root owns final type/audit/union verification. No fullsuite/build/live/provider/runtime/state operations performed by this worker.

Actual causal result received from independently owning retained worker: service-authoring/tests/retained-rerun-feedback.test.ts passed1/1, exit0,15.13seconds after these exact three-source edits. Existing deliberate transport_unknown ending, actual safe next-model note, omitted host-private field and no topology change expectations remained intact; no fixture/source/import-order workaround. The previously missing loop callee is restored on this observed service path. This establishes the helper return imports as the cause corrected by this unit on the reproduced path; does not claim all other loader entry orders or live behavior verified. Supervisor independent final gates remain pending. Source frozen; report complete.
