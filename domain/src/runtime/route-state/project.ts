// The route state for one sanitized evidence packet.
//
// The packet is already the only page data a model may see: origin-checked,
// secret-screened, credential-shaped controls dropped. The route state is a
// projection of it and adds nothing, so a Router can decide on nothing a model
// could not be shown, and what the model is shown while it builds a Flow is
// exactly what the Router will test when the Flow runs.
//
// Nothing in it is cut (t200). Until 2026-09-30 the controls list was cut to
// 2,000 characters and only the first dialog was named; every dialog, every
// blocker and every control's name are now there.
//
// Each field is written by name and left out when the packet says nothing
// about it, because "absent" is itself a state a route tests: `state.page.dialog
// is missing` must hold on a page with no dialog.

import type { JsonObject } from "fluxiq/core";
import { actionableEvidenceElement, type WebLlmPageEvidence } from "../llm-evidence";

const LIST_SEPARATOR = " | ";

export function webAutomationRouteState(evidence: WebLlmPageEvidence): JsonObject {
  const page: JsonObject = {};
  const location = evidence.location;
  page.location = location;
  const path = pathOf(location);
  if (path !== undefined) page.path = path;
  if (evidence.title) page.title = evidence.title;
  const dialogs = joinedNames((evidence.dialogs ?? []).map((dialog) => dialog.name ?? dialog.role ?? "dialog"));
  if (dialogs) page.dialog = dialogs;
  const blockers = joinedNames((evidence.blockedBy ?? []).map((blocker) => blocker.name ?? blocker.role ?? "overlay"));
  if (blockers) page.blockedBy = blockers;
  const controls = joinedNames(evidence.elements.filter(actionableEvidenceElement).map((element) => element.name ?? element.text ?? ""));
  if (controls) page.controls = controls;
  return { page };
}

function pathOf(location: string): string | undefined {
  try {
    return new URL(location).pathname;
  } catch (error) {
    // The packet's location is a URL by construction; a value that is not one
    // leaves `state.page.path` absent rather than guessed.
    if (error instanceof TypeError) return undefined;
    throw error;
  }
}

/**
 * Each distinct name once, in the packet's order, joined. A set rather than a
 * list search, because a page is now every element it has and a list search
 * over twelve thousand names took half a second.
 */
function joinedNames(values: readonly string[]): string {
  const names = new Set<string>();
  for (const value of values) {
    const name = value.replace(/\s+/gu, " ").trim();
    if (name) names.add(name);
  }
  return [...names].join(LIST_SEPARATOR);
}
