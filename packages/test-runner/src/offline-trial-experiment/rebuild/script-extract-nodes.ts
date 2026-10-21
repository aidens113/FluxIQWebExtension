// How many reads a submitted script's candidate has, as Core's own acceptor
// reads the script (`acceptAutomationStudioFlowBootstrapResult`, the reader
// every reply goes through), before any handle is resolved: the steps whose
// node is the web domain's list read.
//
// The oracle's judgement counts a Flow's extract nodes to tell "the Flow could
// not have read anything" from "it read and stored nothing"
// (`assertCreatedFlowDataset`). A trial that stopped before its read stored
// rows names no read node in its datasets, so the count comes from here.

import { webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/node";
import { acceptAutomationStudioFlowBootstrapResult } from "fluxiq/automation-studio";
import type { WebAuthoringSurroundings } from "./web-authoring-surroundings.js";

const EXTRACT_NODE = webAutomationOutputNodeId("web.dom.extract_list");

/** The script's read count, or null when Core's acceptor cannot read the script at all. */
export function scriptExtractNodes(script: string, surroundings: WebAuthoringSurroundings): number | null {
  const accepted = acceptAutomationStudioFlowBootstrapResult({ result: { flow: script }, registry: surroundings.registry, resolution: surroundings.resolution });
  if (!accepted.ok) return null;
  return accepted.plan.subflows.reduce((count, subflow) => count + subflow.nodes.filter((node) => node.definitionId === EXTRACT_NODE).length, 0);
}
