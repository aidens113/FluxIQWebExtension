import type { SubflowDetail } from "@fluxiq/ui-components";

/** The detail with each automation that uses it named, where the list knew it. One it did not know stays unnamed. */
export function nameCallers(detail: SubflowDetail, names: ReadonlyMap<string, string>): SubflowDetail {
  return {
    ...detail,
    callers: detail.callers.map((caller) => {
      if (caller.kind !== "flow" || caller.flowId === undefined) return caller;
      const name = names.get(caller.flowId);
      return name === undefined ? caller : { ...caller, name };
    })
  };
}
