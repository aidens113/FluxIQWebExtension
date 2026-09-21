import { applyCartOperation } from "./cart-ops.js";
import { applyCheckoutOperation } from "./checkout-ops.js";
import { createStoreState } from "./create.js";
import { applyGuardOperation } from "./guard-ops.js";
import { robotCheckActive } from "./robot-active.js";
import { storeModes, type StoreMode, type StoreState } from "./types.js";

/** What the store still accepts while its robot check stands: an answer, a new image, and its own router's bookkeeping. */
const WHILE_CHALLENGED: ReadonlySet<string> = new Set(["solve-robot-check", "new-robot-image", "search-request", "throttled"]);

/**
 * Applies one operation. `set-mode` arms a rendering and, as every armed
 * fixture here does, starts the account over, so an armed run's oracle is its
 * own and never a stale result from the recording. While the robot check
 * stands nothing a page sends gets through except an answer to it. Anything
 * else unknown, or a payload the page could not have sent, leaves the state
 * alone.
 */
export function mutateStoreState(state: StoreState, operation: string, payload: unknown): StoreState {
  if (typeof payload !== "object" || payload === null || Array.isArray(payload)) return state;
  const fields = payload as Record<string, unknown>;
  if (operation === "set-mode") {
    const mode = storeModes.find((candidate): candidate is StoreMode => candidate === fields.mode);
    return mode === undefined ? state : createStoreState(state.challengeSeed, mode);
  }
  if (robotCheckActive(state) && !WHILE_CHALLENGED.has(operation)) return state;
  return applyGuardOperation(state, operation, fields)
    ?? applyCartOperation(state, operation, fields)
    ?? applyCheckoutOperation(state, operation, fields)
    ?? state;
}
