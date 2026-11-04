// Deliberately broken Flows, made from one exploration's own commands, so the pure
// verdict can be tried against failures nobody has to wait for: an act dropped, an act
// repeated, another row, a changed read, two acts swapped, a page move dropped. Each is
// a defect the rule claims to catch, on a real recording. None may pass.
//
// A mutation that the recording offers no material for is not applied, and says so by
// its absence. An act with a receipt is never the one dropped: dropping it is correct.
// The same goes for a move that did not move the page or came after the result.

import { readClientGatewayTraceOperation, type ClientGatewayTraceStateDomain, type ClientGatewayTraceStateRecordedCall } from "fluxiq/client-gateway";
import type { MutationName } from "./types.js";

type Calls = readonly ClientGatewayTraceStateRecordedCall[];

export function traceStateMutations(calls: Calls, domain: ClientGatewayTraceStateDomain, receipted: ReadonlySet<number>, movedThePage: ReadonlySet<number>): readonly Readonly<{ mutation: MutationName; flow: Calls }>[] {
  const landed = (kind: "act" | "page_move"): number[] => calls.flatMap((call, index) => (domain.labelCall(call.operation) === kind && domain.readAnswer(call.answer).outcome === "succeeded" ? [index] : []));
  const acts = landed("act").filter((index) => !receipted.has(index));
  // A move to where the page already stood, or one after the result was read, breaks nothing by being dropped.
  const moves = landed("page_move").filter((index) => movedThePage.has(index));
  const mutations: { mutation: MutationName; flow: Calls }[] = [];
  const lastAct = acts.at(-1);
  // Every attempt at that act goes: a failed attempt left behind is still the same call, and the recording's success still answers it.
  if (lastAct !== undefined) {
    const dropped = domain.canonicalKey(calls[lastAct]!.operation);
    mutations.push({ mutation: "drop_last_act", flow: calls.filter((call) => domain.canonicalKey(call.operation) !== dropped) });
  }
  const firstAct = acts[0];
  if (firstAct !== undefined) mutations.push({ mutation: "repeat_act", flow: [...calls.slice(0, firstAct + 1), calls[firstAct]!, ...calls.slice(firstAct + 1)] });
  const rowBound = calls.findIndex((call) => domain.labelCall(call.operation) === "act" && hasRowIdentity(call));
  if (rowBound >= 0) mutations.push({ mutation: "other_row", flow: calls.map((call, index) => (index === rowBound ? withParameters(call, otherRow) : call)) });
  // A read that kept nothing is not changed by another filter that keeps nothing, so it would be no defect at all.
  const read = lastIndex(calls, (call) => call.operation.actionType === "web.dom.extract_list" && domain.readAnswer(call.answer).outcome === "succeeded" && (domain.readAnswer(call.answer).rows?.length ?? 0) > 0);
  if (read >= 0) mutations.push({ mutation: "changed_read", flow: calls.map((call, index) => (index === read ? withParameters(call, changedRead) : call)) });
  const swap = acts.findIndex((index, position) => position + 1 < acts.length && domain.siblingKey(calls[index]!.operation) !== domain.siblingKey(calls[acts[position + 1]!]!.operation));
  if (swap >= 0) {
    const first = acts[swap]!;
    const second = acts[swap + 1]!;
    mutations.push({ mutation: "swap_acts", flow: calls.map((call, index) => (index === first ? calls[second]! : index === second ? calls[first]! : call)) });
  }
  const lastMove = moves.at(-1);
  if (lastMove !== undefined) mutations.push({ mutation: "drop_last_move", flow: calls.filter((_, index) => index !== lastMove) });
  return mutations;
}

function hasRowIdentity(call: ClientGatewayTraceStateRecordedCall): boolean {
  const parameters = call.operation.compared.parameters as { readonly element?: { readonly context?: { readonly record?: unknown } } } | null;
  return parameters?.element?.context?.record !== undefined && parameters.element.context.record !== null;
}

function withParameters(call: ClientGatewayTraceStateRecordedCall, change: (parameters: Record<string, unknown>) => Record<string, unknown>): ClientGatewayTraceStateRecordedCall {
  const { actionType, target, parameters } = call.operation.compared;
  const changed = change({ ...(parameters as Record<string, unknown>) });
  return { ...call, operation: readClientGatewayTraceOperation({ actionType, target, parameters: changed }) };
}

function otherRow(parameters: Record<string, unknown>): Record<string, unknown> {
  const element = parameters.element as Record<string, unknown>;
  const context = element.context as Record<string, unknown>;
  return { ...parameters, element: { ...element, context: { ...context, record: "another row" } } };
}

function changedRead(parameters: Record<string, unknown>): Record<string, unknown> {
  const extractList = parameters.extractList as Record<string, unknown>;
  return { ...parameters, extractList: { ...extractList, where: [{ field: "a changed filter", equals: ["another value"] }] } };
}

function lastIndex(calls: Calls, holds: (call: ClientGatewayTraceStateRecordedCall) => boolean): number {
  for (let index = calls.length - 1; index >= 0; index -= 1) {
    if (holds(calls[index]!)) return index;
  }
  return -1;
}
