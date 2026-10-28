import type { DemonstrationDetourAct } from "@fluxiq-web-extension/test-contracts";

/** A node of the built Flow that performs one act of a demonstration's detour. */
export type CopiedDetourAct = {
  nodeId: string;
  /** The Subflow graph the node sat in, when the read recorded one. */
  graphId?: string;
  act: DemonstrationDetourAct;
  /** What matched: `operation`, `target` and, when the act names a value, `value`. */
  matchedOn: string[];
};
