// A build that has to reach its own page before it may do anything, and what
// that means for a call made from nowhere.
//
// **The problem this closes.** A Flow is assembled from the steps that ran
// (`AS/runtime/flow-bootstrap/authoring/assemble-draft.ts`), so a build that
// was handed its page never runs the step that reaches one and writes a Flow
// with no such step in it. Measured on 2026-09-23: a seven-node Flow for "search
// the store for wireless earbuds" held no navigation and no address anywhere,
// and its first action was a press on a page the harness had loaded a moment
// earlier. Replayed on its own it could not take a single step.
//
// **The shape of the fix.** Core now lets whoever asks for a build say where
// the Flow starts, and passes that value to this domain on every call
// (`AS/runtime/flow-bootstrap/start-location.ts`). Nothing is opened for such a
// build: it begins on the blank tab a browser opens on, where the extension
// refuses every action except a navigation, judged by its destination
// (`apps/extension/src/runtime/unsupported-page.ts`).
//
// **Enforcement is the world, not a rule.** There is no page to read, so the
// capture every call makes first comes back refused, and this module turns that
// into an answer the model can act on: *you are not there yet, and here is
// where "there" is*. The only call that gets past it is the move that goes
// there -- which is exactly the condition the finished Flow will meet the first
// time it runs on its own, so a build cannot succeed under a rule the Flow will
// not face. Nothing here enumerates what a build may do; it names the one thing
// it may do first, and the world refuses the rest.

import type { WebAutomationActionType } from "../../../actions/types";
import { rejectionDetail, type WebLlmToolRejectionDetail } from "../tool-rejection";
import type { WebRunnableNode } from "./catalog";

/**
 * The command that moves the page, which is the one act available from nowhere.
 *
 * Written once, because two rules depend on it: which call may run before the
 * Flow has reached its start location, and which call the origin scope check
 * applies to at all.
 */
export const WEB_NAVIGATION_ACTION: WebAutomationActionType = "web.browser.navigate";

/** Whether this call is the move that takes the page somewhere. */
export function webMovesThePage(node: WebRunnableNode): boolean {
  return node.actionType === WEB_NAVIGATION_ACTION;
}

/**
 * The refusal for a call made before the Flow has reached where it starts.
 *
 * It names the start location, which is the only thing that makes it
 * actionable, and nothing else: the value was declared by whoever asked for the
 * build and carried in by Core, so it is no more a word of the page than the
 * permission request id beside it (`../tool-rejection.ts`).
 */
export function webStartLocationRefusal(startLocation: string): WebLlmToolRejectionDetail {
  return rejectionDetail({ reason: "start_location_not_reached", startLocation });
}

/**
 * The place an origin check compares against: where the page is, or, for a
 * build that has not got anywhere yet, where its Flow starts.
 *
 * Exploration has always stayed on the origin it started on. A build told where
 * it starts has not started anywhere, so the origin it is held to is the start
 * location's -- which keeps the rule identical in words and in effect, and
 * means the first move can only be onto the site the Flow is for.
 */
export function webScopeAnchor(currentLocation: string | undefined, startLocation: string | undefined): string | undefined {
  return currentLocation ?? startLocation;
}
