// Core's own authoring path, reached where the package does not export it.
//
// When a builder submits a subflow, the build runs three pieces of Core that
// `fluxiq/automation-studio` does not export: the brief's scope
// (`project-agents/dispatch/scope.ts`), the scoped submission controller that
// reads the script and makes the proposal and its digest
// (`flow-bootstrap/subflow-candidate/scoped-submission.ts`), and the assembly
// that joins the proposal into the whole candidate the trial runs, through the
// whole candidate's controller (`project-agents/single-subflow/assemble-latest.ts`).
// A rebuilt candidate must come from exactly that code, never from a copy of
// it, so this loads those modules from the Core build the package resolves to,
// beside its public entry. The domain's reading of a read's `where` clause
// (`plan-resolution/extraction/conditions.ts`) is loaded the same way from the
// domain's build.
//
// The types below are the narrow shapes this experiment reads, written here
// because the package's declarations do not reach these modules. A Core change
// to them fails the rebuild's digest check, which is the point of checking it.

import type { AutomationStudioFlowCandidate } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";

export type CoreSubflowScope = { buildId: string; briefId: string; planDigest: string; subflowKey: string; predecessors: readonly string[] } & Record<string, unknown>;

export type CoreSubflowProposal = { scope: Record<string, unknown>; revision: number; digest: string; subflows: unknown[]; changedPaths: string[] } & Record<string, unknown>;

export type CoreScopedSubmission =
  | { ok: true; proposal: CoreSubflowProposal }
  | { ok: false; revision: number; check: { issueCodes: string[]; feedback: JsonObject } };

export type CoreScopedController = { submit(result: JsonObject): Promise<CoreScopedSubmission> };

export type CoreAssembled =
  | { ok: true; candidate: AutomationStudioFlowCandidate; again: boolean }
  | { ok: false; kind: "assembly"; issues: Array<{ code: string }> }
  | { ok: false; kind: "composed"; code: string; feedback: JsonObject; issueCodes: string[] };

export type CoreAssembleInput = {
  structure: unknown;
  from: ReadonlyArray<{ subflowKey: string; briefId: string; revision: number; digest: string; predecessors: readonly string[] }>;
  ports: { proposals: (ref: unknown) => Promise<undefined>; submission: object };
  kept: ReadonlyMap<string, string>;
  controller: object;
  gate: { standing: () => undefined; refuted: () => undefined };
  summary?: string;
  inHand?: CoreSubflowProposal;
};

export type ExtractionConditionsReading = { ok: true; where: unknown[] } | { ok: false; issue: string; path: unknown[] };

export type CoreAuthoring = Readonly<{
  dispatchScope(record: unknown, brief: unknown): { scope: CoreSubflowScope; siblings: string[]; subflowName: string };
  scopedController(input: { scope: CoreSubflowScope; siblings: readonly string[]; submission: object; revisionsAfter?: number }): CoreScopedController;
  assembleLatest(input: CoreAssembleInput): Promise<CoreAssembled>;
  extractionConditions(where: unknown, columns: { detected: Record<string, unknown>; kept: Record<string, unknown> }, path: Array<string | number>): ExtractionConditionsReading;
}>;

type ScopedControllerClass = new (input: { scope: CoreSubflowScope; siblings: readonly string[]; submission: object; revisionsAfter?: number }) => CoreScopedController;

export async function loadCoreAuthoring(): Promise<CoreAuthoring> {
  const core = new URL("./", import.meta.resolve("fluxiq/automation-studio"));
  const domain = new URL("./", import.meta.resolve("@fluxiq-web-extension/domain/node"));
  const scope = await import(new URL("runtime/project-agents/dispatch/scope.js", core).href) as { automationStudioProjectDispatchScope: CoreAuthoring["dispatchScope"] };
  const scoped = await import(new URL("runtime/flow-bootstrap/subflow-candidate/scoped-submission.js", core).href) as { AutomationStudioSubflowScopedSubmissionController: ScopedControllerClass };
  const assembly = await import(new URL("runtime/project-agents/single-subflow/assemble-latest.js", core).href) as { automationStudioProjectAssembleLatest: CoreAuthoring["assembleLatest"] };
  const conditions = await import(new URL("runtime/llm-evidence/plan-resolution/extraction/conditions.js", domain).href) as { keptWebExtractionConditions: CoreAuthoring["extractionConditions"] };
  for (const [name, value] of [["automationStudioProjectDispatchScope", scope.automationStudioProjectDispatchScope], ["AutomationStudioSubflowScopedSubmissionController", scoped.AutomationStudioSubflowScopedSubmissionController], ["automationStudioProjectAssembleLatest", assembly.automationStudioProjectAssembleLatest], ["keptWebExtractionConditions", conditions.keptWebExtractionConditions]] as const) {
    if (typeof value !== "function") throw new Error(`The resolved Core or domain build no longer provides ${name}`);
  }
  const Controller = scoped.AutomationStudioSubflowScopedSubmissionController;
  return Object.freeze({
    dispatchScope: (record, brief) => scope.automationStudioProjectDispatchScope(record, brief),
    scopedController: (input) => new Controller(input),
    assembleLatest: (input) => assembly.automationStudioProjectAssembleLatest(input),
    extractionConditions: (where, columns, path) => conditions.keptWebExtractionConditions(where, columns, path),
  });
}
