// Which of this domain's nodes a call named, and what running it means here.
//
// The library the model is offered is Core's node registry -- its built-ins,
// this domain's nodes, and whatever a host registered afterwards -- and Core
// enumerates it. What Core cannot know is which of those nodes this domain can
// actually run against a page, and what one of them does when it runs. That is
// answered here, and it is answered from the domain's own node definitions
// rather than from a list written by hand: a web output added to
// `actions/schemas.ts` becomes runnable with nothing here to edit.
//
// Three questions, and each has one source:
//
//   - **Which command runs it.** The node's own `outputAction.fixedOutputId`,
//     which is the same field Core's dispatcher reads when the finished Flow
//     runs it (`io/gateway-output-dispatcher.ts`). A node that declares none is
//     not a web output and is not runnable here.
//   - **Whether it changes the page.** The one safety classification every
//     other consumer derives from, `actions/safety.ts`: a `review` output acts,
//     a `safe` one only reads or waits.
//   - **Whether it belongs in the Flow.** Everything except the domain's own
//     look. A snapshot is how the model sees where it is; it is a node, it runs
//     like a node, and a Flow full of snapshots would be a Flow that does
//     nothing.

import type { AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { WEB_AUTOMATION_ACTION_SAFETY } from "../../../actions/safety";
import type { WebAutomationActionType } from "../../../actions/types";
import { webAutomationOutputNodeDefinitions } from "../../../output-nodes";

/**
 * The node the model runs to see where it is: the free first look the loop
 * takes before any paid decision, and the one node a successful run does not
 * put into the Flow.
 */
export const WEB_LLM_OBSERVATION_NODE_ACTION: WebAutomationActionType = "web.dom.capture_snapshot";

export type WebRunnableNode = {
  /** The node as the catalog names it, which is what the call wrote. */
  definitionId: string;
  /** The gateway command that runs it, the same one the built Flow dispatches. */
  actionType: WebAutomationActionType;
  /** What the model may write for it, for a refusal that names the shape. */
  definition: AutomationStudioNodeDefinition;
  /** Whether running it changes the page, from the domain's one safety table. */
  effect: "observe" | "mutate";
  /** Whether a successful run is a step the Flow should contain. */
  proposes: boolean;
};

// Built on first use rather than at module scope. The definitions are built
// from the action schemas, and a module-evaluation-order cycle would leave this
// map empty with a clean type check -- the exact failure mode this repository's
// structure rules exist to prevent, and one that would silently make every node
// unrunnable.
let cached: Map<string, WebRunnableNode> | undefined;

function runnableNodes(): Map<string, WebRunnableNode> {
  if (cached) return cached;
  cached = new Map<string, WebRunnableNode>(
  webAutomationOutputNodeDefinitions.flatMap((definition) => {
    const actionType = definition.outputAction?.fixedOutputId as WebAutomationActionType | undefined;
    if (!actionType || !(actionType in WEB_AUTOMATION_ACTION_SAFETY)) return [];
    return [[definition.id, {
      definitionId: definition.id,
      actionType,
      definition,
      effect: WEB_AUTOMATION_ACTION_SAFETY[actionType] === "review" ? "mutate" : "observe",
      proposes: actionType !== WEB_LLM_OBSERVATION_NODE_ACTION
    } as WebRunnableNode]];
  })
  );
  return cached;
}

/** The node a call named, when this domain can run it against a page. */
export function webRunnableNode(definitionId: unknown): WebRunnableNode | undefined {
  return typeof definitionId === "string" ? runnableNodes().get(definitionId) : undefined;
}

/** Every node this domain can run, by catalog id, for a refusal that says what it could have named. */
export function webRunnableNodeIds(): string[] {
  return [...runnableNodes().keys()].sort();
}

/** The catalog id of the node the free first look runs. */
export function webObservationNodeId(): string | undefined {
  for (const node of runnableNodes().values()) {
    if (node.actionType === WEB_LLM_OBSERVATION_NODE_ACTION) return node.definitionId;
  }
  return undefined;
}
