// The step resolutions the build gave, read off the candidate Core persisted.
//
// Core keeps one candidate per Flow (`candidate-draft`), its plan fully
// resolved. Its script survives in the step that submitted it. Compiling that
// script through Core's own path (`./rebuild-candidate.ts`) asks the domain to
// resolve each step in plan order -- each success-check target first, then each
// node -- so each question is paired, in that order, with what the persisted
// plan holds at the same place: a fact target with the target the success
// check holds, a node with the node of the same position and definition (the
// arrival step assembly adds is not asked about and is skipped). Two steps
// written alike at different places (two merges) are each paired with their
// own place; one resolution is kept for them, and pairing refuses if their
// places hold different resolutions.
//
// The harvest proves itself: the rebuild it runs must reproduce the persisted
// candidate's digests, subflow and whole, or its pairing is not the build's
// and nothing may be answered from it (`verified`).
//
// Only a one-subflow plan is paired; any other refuses, since its order across
// subflows is not one this has checked.

import { AUTOMATION_STUDIO_ARRIVAL_STEP_KEY } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import { jsonRecord } from "../json-record.js";
import { rebuildSubflowCandidate, type RebuildContext } from "./rebuild-candidate.js";
import type { CandidateRebuild, RecordedResolution } from "../types.js";

const FACT_TARGET_NODE = "fluxiq.fact.target";
const SUCCESS_CHECK_KEY = "fluxiq.successCheck";

export type RecordedResolutionHarvest = Readonly<{
  resolutions: readonly RecordedResolution[];
  /** The persisted candidate rebuilt from its own script through the pairing. */
  rebuild: CandidateRebuild;
  /** Both rebuilt digests equal the persisted candidate's (header). */
  verified: boolean;
  /** Why pairing broke, when it did: Core reports a binding that threw only as `bootstrap.parameter_resolution_failed`. */
  pairingFailure: string | null;
}>;

export async function harvestRecordedResolutions(context: RebuildContext, input: {
  briefId: string;
  /** The persisted revision's script and where it was submitted. */
  script: string;
  submitStep: number | null;
  recordedSubflow: Readonly<{ revision: number; digest: string }>;
  canonical: (value: unknown) => string;
}): Promise<RecordedResolutionHarvest> {
  const candidate = jsonRecord(context.draft.candidate);
  const plan = jsonRecord(jsonRecord(candidate?.buildPlan)?.plan);
  const subflows = Array.isArray(plan?.subflows) ? plan.subflows.map(jsonRecord) : [];
  const subflow = subflows[0];
  if (!candidate || subflows.length !== 1 || !subflow) throw new Error("Recorded resolutions are paired only on a persisted one-subflow plan");
  const facts = (Array.isArray(jsonRecord(subflow.metadata)?.[SUCCESS_CHECK_KEY]) ? jsonRecord(subflow.metadata)![SUCCESS_CHECK_KEY] as unknown[] : []).map((fact) => jsonRecord(jsonRecord(fact)?.target));
  const nodes = (Array.isArray(subflow.nodes) ? subflow.nodes : []).map(jsonRecord).filter((node) => node?.key !== AUTOMATION_STUDIO_ARRIVAL_STEP_KEY);
  const resolutions: RecordedResolution[] = [];
  const seen = new Map<string, JsonObject>();
  let factAt = 0;
  let nodeAt = 0;
  let pairingFailure: string | null = null;
  const pair = (request: { nodeDefinitionId: string; parameters: JsonObject }) => {
    const key = input.canonical({ node: request.nodeDefinitionId, written: request.parameters });
    const found = request.nodeDefinitionId === FACT_TARGET_NODE ? facts[factAt++] : pairedNode(nodes[nodeAt++], request.nodeDefinitionId);
    if (!found) throw new Error(`The persisted plan has no step for question ${factAt + nodeAt} Core asked (${request.nodeDefinitionId})`);
    const resolved = structuredClone(found) as JsonObject;
    const earlier = seen.get(key);
    if (earlier === undefined) {
      seen.set(key, resolved);
      resolutions.push(Object.freeze({ nodeDefinitionId: request.nodeDefinitionId, written: structuredClone(request.parameters), resolved }));
    } else if (input.canonical(earlier) !== input.canonical(resolved)) {
      throw new Error(`Pairing broke: two ${request.nodeDefinitionId} steps written alike hold different resolutions in the persisted plan`);
    }
    return input.canonical(resolved) === input.canonical(request.parameters) ? { status: "unchanged" as const } : { status: "resolved" as const, parameters: structuredClone(resolved) };
  };
  const binding = {
    runsNodes: context.surroundings.runsNodes,
    async resolvePlanNodeParameters(request: { nodeDefinitionId: string; parameters: JsonObject; writtenByModel?: boolean }) {
      if (request.writtenByModel !== true) return { status: "unchanged" as const };
      try {
        return pair(request);
      } catch (error) {
        pairingFailure ??= (error as Error).message;
        throw error;
      }
    },
  };
  const recordedWhole = { revision: candidate.revision as number, digest: candidate.digest as string };
  const rebuild = await rebuildSubflowCandidate(context, { briefId: input.briefId, script: input.script, submitStep: input.submitStep, recordedSubflow: input.recordedSubflow, recordedWhole, binding });
  return Object.freeze({ resolutions: Object.freeze(resolutions), rebuild, verified: pairingFailure === null && rebuild.subflow.matches === true && rebuild.whole.matches === true, pairingFailure });
}

/** The persisted node's parameters, when it is of the definition Core asked about at this position. */
function pairedNode(node: Record<string, unknown> | undefined, definitionId: string): Record<string, unknown> | undefined {
  if (!node) return undefined;
  if (node.definitionId !== definitionId) throw new Error(`Pairing broke: Core asked about ${definitionId} where the persisted plan holds ${String(node.definitionId)}`);
  return jsonRecord(node.parameters) ?? {};
}
