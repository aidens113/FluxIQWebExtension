// The automation FluxIQ generated from a recording, as the review shows it.
//
// `generateFromRecording` passes Core's `generate-recording-proposal` result
// through untouched (`{ payload: { result } }`), and this lane does not own
// that shape, so it is read defensively: every field is looked for under the
// spellings a proposal and its Flow may use, and anything missing or of the
// wrong type is left out rather than trusted. Step lines are node labels or
// titles; one that looks like a selector or an id is skipped. The proposal's
// and Flow's ids are kept only to send back with Test and Save, never shown.

import { payloadFields } from "../payload-fields";
import { plainWords } from "../plain-words";

/** A generated automation as the review shows it. */
export type GeneratedPreview = {
  readonly name: string;
  /** At most `PREVIEW_STEP_LIMIT` step lines, in order. */
  readonly steps: readonly string[];
  /** Readable steps beyond the ones listed. */
  readonly more: number;
  readonly proposalId?: string | undefined;
  readonly flowId?: string | undefined;
};

const PREVIEW_STEP_LIMIT = 8;
const UNNAMED = "Your new automation";

function firstId(...values: unknown[]): string | undefined {
  return values.find((value): value is string => typeof value === "string" && value.trim() !== "");
}

function nodesOf(flow: Record<string, unknown> | undefined, proposal: Record<string, unknown>): unknown[] {
  const found = flow?.nodes ?? flow?.steps ?? proposal.steps ?? proposal.nodes;
  if (Array.isArray(found)) return found;
  const map = payloadFields(found);
  return map === undefined ? [] : Object.values(map);
}

function stepLine(node: unknown): string | undefined {
  const entry = payloadFields(node);
  if (entry === undefined) return undefined;
  const data = payloadFields(entry.data);
  for (const candidate of [entry.label, entry.title, entry.name, data?.label, data?.title]) {
    const words = plainWords(candidate, 80);
    if (words !== undefined) return words;
  }
  return undefined;
}

/** The preview in a `generateFromRecording` reply, or undefined when it carries no proposal or Flow to show. */
export function generatedPreview(reply: unknown): GeneratedPreview | undefined {
  const result = payloadFields(payloadFields(payloadFields(reply)?.payload)?.result);
  if (result === undefined) return undefined;
  const proposal = payloadFields(result.proposal) ?? result;
  const flow = payloadFields(result.flow) ?? payloadFields(proposal.flow) ?? payloadFields(result.proposedFlow) ?? payloadFields(proposal.proposedFlow);
  const names = [flow?.name, flow?.title, proposal.title, proposal.name, result.name, result.title];
  const named = names.map((name) => plainWords(name, 80)).find((name) => name !== undefined);
  const lines = nodesOf(flow, proposal).map(stepLine).filter((line): line is string => line !== undefined);
  if (flow === undefined && named === undefined && lines.length === 0) return undefined;
  return {
    name: named ?? UNNAMED,
    steps: lines.slice(0, PREVIEW_STEP_LIMIT),
    more: Math.max(0, lines.length - PREVIEW_STEP_LIMIT),
    proposalId: firstId(proposal.id, result.proposalId, proposal.proposalId),
    flowId: firstId(flow?.id, result.flowId, proposal.flowId)
  };
}
