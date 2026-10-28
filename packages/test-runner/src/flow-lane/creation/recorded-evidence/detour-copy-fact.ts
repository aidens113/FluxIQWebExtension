import type { ScenarioDemonstrationDetour } from "@fluxiq-web-extension/test-contracts";
import { RunnerFailure } from "../../../failure.js";
import { copiedDetourActs } from "../detour/index.js";
import type { readCreatedFlowGraph } from "../graph-read.js";

/**
 * The fact "detour.copied": the demonstration showed side trips the task never asked for, and a
 * built Flow that carries one of them out copied the demonstration instead of reading the
 * instruction. Any node `copiedDetourActs` finds fails the run, naming the nodes and what each
 * matched on, never the page.
 */
export function assertNoDetourCopied(graph: Awaited<ReturnType<typeof readCreatedFlowGraph>>, detours: readonly ScenarioDemonstrationDetour[]): void {
  const copied = copiedDetourActs(graph, detours);
  if (copied.length === 0) return;
  throw new RunnerFailure("runtime.behavior", `detour.copied: the built Flow carries out ${copied.length} act(s) of the demonstration's ${detours.length} detour(s) that the instruction never asked for`, {
    details: { fact: "detour.copied", nodes: copied.map((hit) => ({ nodeId: hit.nodeId, ...(hit.graphId === undefined ? {} : { graphId: hit.graphId }), matchedOn: hit.matchedOn })) },
  });
}
