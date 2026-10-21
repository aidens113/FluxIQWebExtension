// The verb a node's act is told in: to the person when the act asks for
// permission, and to Core's site-reset ledger, which repeats it when the build
// undoes the act.
//
// A node's label names it, and for most nodes that is also what it does. The
// check node is the exception: its label is "Set Checked" whichever way it
// goes, so clearing a box was told as "set checked" and read back as the box
// having been switched on (t753). It says which way it goes instead, from the
// state the call asked for, defaulting to set as the command does
// (`apps/extension/src/content/actions/check.ts`).

import type { JsonObject } from "fluxiq/core";
import type { WebRunnableNode } from "../catalog";

/** The check node's command, the one node whose label does not say what it did. */
const CHECK_ACTION = "web.dom.check";

/** The plain verb for running `node` with `parameters`. */
export function webNodeActVerb(node: Pick<WebRunnableNode, "actionType" | "definition">, parameters: JsonObject | undefined): string {
  if (node.actionType === CHECK_ACTION) return parameters?.checked === false ? "untick" : "tick";
  return node.definition.label.toLowerCase();
}
