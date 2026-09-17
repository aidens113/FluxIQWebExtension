// What a scenario declares a correct repair of one of its variants to be, and
// the expectations a Flow-lane run is held to because of it.
//
// A variant's `expected` has one shape for every run, but what a live run can
// show depends on its grant. Under the Lab's `--llm-task adapt` grant
// (`diagnose_and_adapt`) Core only proposes a repair and never retries the
// action, so a run that repairs perfectly still ends with the action failed.
// `renamed-redesign` declared the repaired run's save, so every such run was
// "unexpected" (`run-mu4rpka7-845d919a`). A scenario that knows this declares
// it beside the fixture (`apps/scenario-lab/src/scenarios/<id>/repair.ts`):
// what a proposal-only run ends with, and the proposal that makes it correct.
//
// The scenario lab's contract has no field for it, so the declaration is its
// own module in the scenario lab build, loaded the way the live instruction
// catalog is (`creation/instruction-catalog.ts`), restated and checked here.

import { access } from "node:fs/promises";
import path from "node:path";
import { pathToFileURL } from "node:url";
import { validateWebScenario, type ResolvedScenarioWorkflow, type ScenarioExpected, type WebScenario } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../failure.js";

/** The patch kinds a declared repair may name. Core's proposal-only grant proposes only this one. */
export const FLOW_REPAIR_PATCH_KINDS = ["temporary_target_override"] as const;
/** The fingerprint fields a declared target may name, compared exactly with the proposal's. */
export const FLOW_REPAIR_TARGET_FIELDS = ["tagName", "accessibleName", "controlType"] as const;

export type FlowRepairTargetField = (typeof FLOW_REPAIR_TARGET_FIELDS)[number];

/** The repair a correct run proposes. */
export type FlowRepairExpectation = Readonly<{
  patchKind: (typeof FLOW_REPAIR_PATCH_KINDS)[number];
  target: Readonly<Partial<Record<FlowRepairTargetField, string>>>;
}>;

/** One declaration, as `SCENARIO_REPAIRS` holds it. */
export type DeclaredFlowRepair = Readonly<{
  variantId: string;
  proposalOnlyOutcome: Pick<ScenarioExpected, "actions" | "finalState" | "failure">;
  proposal: FlowRepairExpectation;
}>;

const REPAIR_MODULE = "repair.js";
const ENTRY_FIELDS: ReadonlySet<string> = new Set(["variantId", "proposalOnlyOutcome", "proposal"]);
const OUTCOME_FIELDS: ReadonlySet<string> = new Set(["actions", "finalState", "failure"]);
const PROPOSAL_FIELDS: ReadonlySet<string> = new Set(["patchKind", "target"]);
const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/u;
const MAX_TARGET_TEXT = 200;

/**
 * The workflow a Flow-lane run is held to, and the repair it is judged on.
 *
 * Only a Flow-lane run of a variant, under a grant that may only propose a
 * repair, of a variant the scenario declared a repair for, changes: its
 * `expected` takes the declaration's `proposalOnlyOutcome` over the variant's
 * own fields, and the declared proposal is returned to be judged. Every other
 * run is returned exactly as it came, with no repair. The held-to expectations
 * are validated as the scenario's own would be, so a declaration no run could
 * meet refuses before anything starts.
 */
export async function withDeclaredFlowRepair(
  workflow: ResolvedScenarioWorkflow,
  input: { scenario: WebScenario; scenarioLabDist: string; flowLane: boolean; proposalOnly: boolean },
): Promise<{ workflow: ResolvedScenarioWorkflow; repair: FlowRepairExpectation | undefined }> {
  const variant = workflow.variant;
  if (!input.flowLane || !input.proposalOnly || !variant) return { workflow, repair: undefined };
  const declared = (await loadDeclaredFlowRepairs(input.scenarioLabDist, input.scenario.id)).find((entry) => entry.variantId === variant.id);
  if (!declared) return { workflow, repair: undefined };
  const expected: ScenarioExpected = { ...workflow.expected, ...declared.proposalOnlyOutcome };
  assertHeldToIsValid(input.scenario, workflow.workflowId, variant.id, declared);
  return { workflow: { ...workflow, expected }, repair: declared.proposal };
}

/**
 * The scenario's `SCENARIO_REPAIRS`, checked, or none when it declares no
 * repair module. A module that exports something else is `fixture.invalid`,
 * because the fix is to the declaration.
 */
export async function loadDeclaredFlowRepairs(scenarioLabDist: string, scenarioId: string): Promise<DeclaredFlowRepair[]> {
  if (!KEBAB_ID.test(scenarioId)) throw invalid("scenarioId", "must be a kebab-case scenario id");
  const modulePath = path.join(scenarioLabDist, "scenarios", scenarioId, REPAIR_MODULE);
  try { await access(modulePath); }
  catch { return []; }
  const declared = await import(pathToFileURL(modulePath).href) as { SCENARIO_REPAIRS?: unknown };
  return parseDeclaredFlowRepairs(declared.SCENARIO_REPAIRS);
}

/**
 * Every declaration, checked field by field. A malformed one refuses the
 * whole module, naming the entry by position and field and never quoting a
 * declared value.
 */
export function parseDeclaredFlowRepairs(value: unknown): DeclaredFlowRepair[] {
  if (!Array.isArray(value)) throw invalid("SCENARIO_REPAIRS", "must be an array");
  const seen = new Set<string>();
  return value.map((entry, index) => {
    const at = `SCENARIO_REPAIRS[${index}]`;
    const record = closedRecord(entry, ENTRY_FIELDS, at);
    if (typeof record.variantId !== "string" || !KEBAB_ID.test(record.variantId)) throw invalid(`${at}.variantId`, "must be a kebab-case variant id");
    if (seen.has(record.variantId)) throw invalid(`${at}.variantId`, "repeats a variant");
    seen.add(record.variantId);
    const outcome = closedRecord(record.proposalOnlyOutcome, OUTCOME_FIELDS, `${at}.proposalOnlyOutcome`);
    if (Object.keys(outcome).length === 0) throw invalid(`${at}.proposalOnlyOutcome`, "must replace at least one expectation");
    return {
      variantId: record.variantId,
      // Shapes are the scenario contract's to judge, which `withDeclaredFlowRepair` asks it to.
      proposalOnlyOutcome: outcome as DeclaredFlowRepair["proposalOnlyOutcome"],
      proposal: parseProposal(record.proposal, `${at}.proposal`),
    };
  });
}

function parseProposal(value: unknown, at: string): FlowRepairExpectation {
  const record = closedRecord(value, PROPOSAL_FIELDS, at);
  if (!FLOW_REPAIR_PATCH_KINDS.includes(record.patchKind as never)) throw invalid(`${at}.patchKind`, `must be one of ${FLOW_REPAIR_PATCH_KINDS.join(", ")}`);
  const target = closedRecord(record.target, new Set(FLOW_REPAIR_TARGET_FIELDS), `${at}.target`);
  const fields = Object.entries(target);
  if (fields.length === 0) throw invalid(`${at}.target`, "must name at least one field");
  for (const [field, text] of fields) {
    if (typeof text !== "string" || text.length === 0 || text.length > MAX_TARGET_TEXT) throw invalid(`${at}.target.${field}`, `must be a string of 1 to ${MAX_TARGET_TEXT} characters`);
  }
  return { patchKind: record.patchKind as FlowRepairExpectation["patchKind"], target: Object.fromEntries(fields) as FlowRepairExpectation["target"] };
}

/** The scenario, with the one variant's expectations replaced, must still be a valid scenario. */
function assertHeldToIsValid(scenario: WebScenario, workflowId: string | undefined, variantId: string, declared: DeclaredFlowRepair): void {
  const heldTo = <T extends { variants?: WebScenario["variants"] }>(owner: T): T => owner.variants
    ? { ...owner, variants: owner.variants.map((variant) => variant.id === variantId ? { ...variant, expected: { ...variant.expected, ...declared.proposalOnlyOutcome } } : variant) }
    : owner;
  const candidate: WebScenario = workflowId === undefined
    ? heldTo(scenario)
    : scenario.workflows ? { ...scenario, workflows: scenario.workflows.map((workflow) => workflow.id === workflowId ? heldTo(workflow) : workflow) } : scenario;
  const checked = validateWebScenario(candidate);
  if (checked.valid) return;
  throw new RunnerFailure("fixture.invalid", `The declared repair of ${variantId} is not a valid expectation: ${checked.issues.map((issue) => `${issue.path}: ${issue.message}`).join("; ")}`, { details: { issuePaths: checked.issues.map((issue) => issue.path) } });
}

function closedRecord(value: unknown, fields: ReadonlySet<string>, at: string): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) throw invalid(at, "must be an object");
  const unknown = Object.keys(value).find((key) => !fields.has(key));
  if (unknown !== undefined) throw invalid(at, `has an unsupported field (${unknown.length <= 40 && /^[A-Za-z]+$/u.test(unknown) ? unknown : "unnamed"})`);
  return value as Record<string, unknown>;
}

function invalid(at: string, message: string): RunnerFailure {
  return new RunnerFailure("fixture.invalid", `The scenario's declared repair is invalid: ${at} ${message}`);
}
