import type { WebNodeRun } from "../context";

/**
 * The words the packet store keeps beside the identity of the control
 * the supplied handle names, resolved bare as the call's words are
 * (`../tools.ts`, `describeCall`); nothing for a call that names no handle.
 */
export function webNodeShownControlWords(run: Pick<WebNodeRun, "stores" | "request">, handle: string | undefined): string | undefined {
  if (handle === undefined) return undefined;
  const resolution = run.stores.targets.resolve({ projectId: run.request.projectId, flowId: run.request.flowId }, handle, undefined);
  return resolution.ok ? resolution.words : undefined;
}
