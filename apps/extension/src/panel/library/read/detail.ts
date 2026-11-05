import type { SubflowCallNode, SubflowDetail, SubflowReading } from "@fluxiq/ui-components";
import { readCard } from "./card";
import { readClasses } from "./classes";
import { readNewer } from "./newer";
import { count, list, record, text } from "./values";

/** What a subflow calls, with what that calls in turn. Past a sane depth, or a call that cannot be read, it stops. */
function readCalls(value: unknown, depth = 0): SubflowCallNode[] {
  if (depth > 12) return [];
  return list(value).flatMap((item) => {
    const call = record(item);
    const partId = text(call?.partId);
    const name = text(call?.name);
    const version = count(call?.version);
    return partId === undefined || name === undefined || version === undefined ? [] : [{ partId, version, name, calls: readCalls(call?.calls, depth + 1) }];
  });
}

function readCallers(value: unknown): SubflowDetail["callers"] {
  return list(value).flatMap((item): SubflowDetail["callers"] => {
    const caller = record(item);
    if (caller?.kind === "flow") {
      const flowId = text(caller.flowId);
      const newer = readNewer(caller.newer);
      return [{ kind: "flow" as const, ...(flowId === undefined ? {} : { flowId }), ...(newer === undefined ? {} : { newer }) }];
    }
    const partId = text(caller?.partId);
    return caller?.kind === "part" && partId !== undefined ? [{ kind: "part" as const, partId }] : [];
  });
}

/** One subflow opened: its card with its steps, what it calls and who calls it. The version history stays behind: a person never reads it. */
export function readDetail(value: unknown): SubflowReading | undefined {
  const answer = record(value);
  const card = readCard(answer?.card);
  if (answer === undefined || card === undefined) return undefined;
  const steps = list(answer.steps).flatMap((item) => {
    const step = record(item);
    const label = text(step?.label);
    return label === undefined ? [] : [{ label, lastingClasses: readClasses(step?.lastingClasses) }];
  });
  return { refused: false, detail: { card, steps, calls: readCalls(answer.calls), callers: readCallers(answer.callers) } };
}
