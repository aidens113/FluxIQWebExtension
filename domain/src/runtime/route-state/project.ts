// The route state for one sanitized evidence packet.
//
// The packet is already the only page data a model may see: origin-checked,
// value-free, credential-shaped controls dropped, bounded. The route state is
// a projection of it and adds nothing, so a Router can decide on nothing a
// model could not be shown, and what the model is shown while it builds a
// Flow is exactly what the Router will test when the Flow runs.
//
// Each field is written by name and left out when the packet says nothing
// about it, because "absent" is itself a state a route tests: `state.page.dialog
// is missing` must hold on a page with no dialog.

import type { JsonObject } from "fluxiq/core";
import type { WebLlmPageEvidence } from "../llm-evidence";

/** How much of the controls list a route may read. The packet already bounds the elements. */
const MAX_CONTROLS_LENGTH = 2_000;
const CONTROL_SEPARATOR = " | ";

export function webAutomationRouteState(evidence: WebLlmPageEvidence): JsonObject {
  const page: JsonObject = {};
  const location = evidence.location;
  page.location = location;
  const path = pathOf(location);
  if (path !== undefined) page.path = path;
  if (evidence.title) page.title = evidence.title;
  const dialog = evidence.dialogs?.[0];
  if (dialog) page.dialog = dialog.name ?? dialog.role ?? "dialog";
  if (evidence.blockedBy) page.blockedBy = evidence.blockedBy.name ?? evidence.blockedBy.role ?? "overlay";
  const controls = controlNames(evidence);
  if (controls) page.controls = controls;
  return { page };
}

function pathOf(location: string): string | undefined {
  try {
    return new URL(location).pathname;
  } catch (error) {
    // The packet's location is origin and path by construction; a value that
    // is not a URL leaves `state.page.path` absent rather than guessed.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

function controlNames(evidence: WebLlmPageEvidence): string {
  const names: string[] = [];
  for (const element of evidence.elements) {
    const name = (element.name ?? element.text ?? "").replace(/\s+/gu, " ").trim();
    if (name && !names.includes(name)) names.push(name);
  }
  const joined = names.join(CONTROL_SEPARATOR);
  return joined.length > MAX_CONTROLS_LENGTH ? joined.slice(0, MAX_CONTROLS_LENGTH) : joined;
}
