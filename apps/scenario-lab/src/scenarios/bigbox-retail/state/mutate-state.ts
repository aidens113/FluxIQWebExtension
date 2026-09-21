import { STORES } from "../catalog/index.js";
import { addToLines, changeLine, requestedLine } from "./cart-operations.js";
import { CHECKOUT_ERRORS, placeOrder } from "./checkout-operations.js";
import { createBigboxState } from "./initial-state.js";
import { text } from "./payload-fields.js";
import { ROBOT_CHECK_AT_LOAD } from "./robot-check.js";
import { bigboxModes, type BigboxState } from "../types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;

/**
 * Every change the site can report. Page operations arrive from the browser
 * through `/api/bigbox-retail/<operation>`; `search-view`, `slots-fetch` and
 * `clear-express` are recorded by the routes that serve those documents.
 * `set-mode` arms a rendering and, like every armed fixture here, starts the
 * shopper over, so an armed run's oracle is its own. Anything else, or a
 * payload the page could not have sent, leaves the state as it was.
 */
export function mutateBigboxState(state: BigboxState, operation: string, payload: unknown): BigboxState {
  const fields = isRecord(payload) ? payload : {};
  const next = apply(state, operation, fields);
  if (next === undefined || next === state) return state;
  // An armed rendering starts from nothing, its activity included.
  return operation === "set-mode" ? next : { ...next, activity: [...state.activity, operation].slice(-ACTIVITY_LIMIT) };
}

function apply(state: BigboxState, operation: string, payload: Record<string, unknown>): BigboxState | undefined {
  switch (operation) {
    case "set-mode": {
      const mode = bigboxModes.find((candidate) => candidate === payload.mode);
      return mode === undefined ? undefined : createBigboxState(mode);
    }
    case "consent": {
      const choice = text(payload, "choice");
      return state.consent === "pending" && (choice === "accept" || choice === "reject") ? { ...state, consent: choice === "accept" ? "accepted" : "rejected" } : undefined;
    }
    case "dismiss-promo": return state.promo === "pending" ? { ...state, promo: "dismissed" } : undefined;
    case "newsletter-signup": {
      if (state.promo !== "pending") return undefined;
      // The hidden field is filled only by something that fills every field; it is thanked all the same.
      if (text(payload, "website") !== "") return { ...state, promo: "dismissed", flaggedSignups: state.flaggedSignups + 1 };
      return /^[^@\s]+@[^@\s]+\.[^@\s]+$/u.test(text(payload, "email")) ? { ...state, promo: "signed-up" } : undefined;
    }
    case "dismiss-chat-card": return state.chatCard === "pending" ? { ...state, chatCard: "dismissed" } : undefined;
    case "set-store": {
      const storeId = text(payload, "storeId");
      return STORES.some((store) => store.id === storeId) && storeId !== state.storeId ? { ...state, storeId } : undefined;
    }
    case "add-to-cart": {
      const added = requestedLine(state, payload);
      if (!added) return undefined;
      const { lines, nextLine } = addToLines(state, state.cart, added);
      return { ...state, cart: lines, nextLine };
    }
    case "buy-now": {
      const added = requestedLine(state, payload);
      return added ? { ...state, express: { lineId: "X1", ...added }, checkoutError: "" } : undefined;
    }
    case "clear-express": return state.express ? { ...state, express: null } : undefined;
    case "update-qty":
    case "remove-line":
    case "save-for-later":
    case "move-to-cart": return changeLine(state, operation, payload);
    case "search-view": {
      if (state.robot.status === "challenged") return undefined;
      const searchLoads = state.robot.searchLoads + 1;
      const status = state.robot.status === "idle" && searchLoads === ROBOT_CHECK_AT_LOAD ? "challenged" : state.robot.status;
      return { ...state, robot: { ...state.robot, searchLoads, status } };
    }
    case "clear-robot-check": {
      const how = text(payload, "how");
      return state.robot.status === "challenged" && (how === "held" || how === "waited") ? { ...state, robot: { ...state.robot, status: "cleared", clearedBy: how } } : undefined;
    }
    case "slots-fetch": return { ...state, slotFetches: state.slotFetches + 1 };
    case "start-guest-checkout": return { ...state, checkout: "guest", checkoutError: "" };
    case "sign-in": return { ...state, checkoutError: CHECKOUT_ERRORS.noAccount };
    case "place-order": return placeOrder(state, payload);
    default: return undefined;
  }
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
