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
//     other consumer derives from, read through `actions/effect.ts`: a `review`
//     output acts, a `safe` one only reads or waits. That answer is also what
//     Core is told on the permission declaration, which is what keeps a read
//     out of the gate's reach (`../permission.ts`).
//   - **Whether it belongs in the Flow.** Everything except the domain's own
//     look. A snapshot is how the model sees where it is; it is a node, it runs
//     like a node, and a Flow full of snapshots would be a Flow that does
//     nothing.
//
// **A name is resolved, not looked up.** The fourth question -- which node did
// this call mean -- used to be a bare `Map.get`, and a model that wrote the
// separator wrong got `node_not_runnable_here`: a paid provider call spent
// telling it that it mistyped. The ids invite exactly that mistake, because
// `web.dom.extract_list` becomes `web.output.dom-extract_list` -- dots turned
// into hyphens, underscores left alone (`output-nodes/definitions.ts`) -- so
// the kebab-case form a model naturally writes,
// `web.output.dom-extract-list`, names nothing. Live run
// `run-mug776kx-0214b287` was refused that way fourteen times in a row and
// never corrected itself. So a miss now falls through to Core's name matcher
// over these same ids, and only a name nothing plausible was written for is
// still unknown. The matcher is Core's rather than a second one written here
// because the same correction has to hold for the Flow the model goes on to
// propose, which Core resolves (`AS/nodes/name-match/`).
//
// **What comes back is the catalog's node, never the model's spelling.** The
// caller runs `actionType` and records `definitionId`, so a corrected call
// dispatches the real command and appends a draft step under the real id. The
// written form survives only inside the step's opaque `input`/`ranWith` JSON,
// which Core carries without reading and hands back here for a replay -- where
// it is resolved through this same function, and so corrected again.

import { automationStudioMatchName, type AutomationStudioNodeDefinition } from "fluxiq/automation-studio/nodes";
import { webAutomationActionEffect } from "../../../actions/effect";
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
let cachedCandidates: { id: string }[] | undefined;

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
      effect: webAutomationActionEffect(actionType),
      proposes: actionType !== WEB_LLM_OBSERVATION_NODE_ACTION
    } as WebRunnableNode]];
  })
  );
  return cached;
}

/**
 * The runnable ids as the matcher wants them.
 *
 * No `accepts`: a node id is not a slot with a value shape, so there is
 * nothing here for the matcher's tie-break to read, and saying so would be
 * inventing information rather than withholding it.
 */
function runnableCandidates(): { id: string }[] {
  cachedCandidates ??= [...runnableNodes().keys()].map((id) => ({ id }));
  return cachedCandidates;
}

/**
 * The node a call named, when this domain can run it against a page.
 *
 * Exactly, then by nearest name. `undefined` still means the call named
 * nothing plausible -- `node_not_runnable_here` stays reachable for a name
 * that is genuinely nothing, because a correction nobody wrote a near version
 * of would be noise rather than help.
 */
export function webRunnableNode(definitionId: unknown): WebRunnableNode | undefined {
  if (typeof definitionId !== "string") return undefined;
  const nodes = runnableNodes();
  // The common path, and free: a call that wrote the id correctly is never
  // scored against the whole catalog.
  const exact = nodes.get(definitionId);
  if (exact) return exact;
  const matched = automationStudioMatchName(definitionId, runnableCandidates());
  return matched ? nodes.get(matched.id) : undefined;
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
