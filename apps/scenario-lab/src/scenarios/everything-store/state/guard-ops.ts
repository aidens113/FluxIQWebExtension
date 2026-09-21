import { robotCode } from "./robot-code.js";
import { STORE_THROTTLE } from "./throttle.js";
import { withActivity } from "./activity.js";
import type { StoreState } from "./types.js";

/** How many recent request times the rate limiter keeps; more than its window can ever hold. */
const LOAD_HISTORY = 20;

function flag(state: StoreState, reason: "honeypot" | "rate-limit"): StoreState {
  return withActivity({ ...state, guard: { ...state.guard, flagged: reason, robot: { ...state.guard.robot, solved: false } } }, `flagged ${reason}`);
}

/**
 * The operations that belong to the store's shell and its defences: consent,
 * the nudges, the chat, and everything the bot defences count. Returns
 * `undefined` for an operation that is not one of these, so the dispatcher can
 * try the next owner.
 *
 * `search-request` and `throttled` come from the store's own router, never
 * from a page: the router stamps each results-page request with the time it
 * arrived and whether the search form's hidden field came back filled.
 */
export function applyGuardOperation(state: StoreState, operation: string, payload: Record<string, unknown>): StoreState | undefined {
  switch (operation) {
    case "consent":
      if (payload.choice !== "accept" && payload.choice !== "decline") return state;
      return withActivity({ ...state, consent: payload.choice === "accept" ? "accepted" : "declined" }, `consent ${payload.choice}`);
    case "dismiss-nudge": {
      const key = payload.nudge === "app-banner" ? "appBanner" : payload.nudge === "notifications" ? "notifications" : payload.nudge === "deal-wheel" ? "dealWheel" : undefined;
      return key === undefined ? state : withActivity({ ...state, nudges: { ...state.nudges, [key]: "dismissed" } }, `dismissed ${String(payload.nudge)}`);
    }
    case "chat":
      if (payload.state !== "open" && payload.state !== "minimized") return state;
      return { ...state, nudges: { ...state.nudges, chat: payload.state } };
    case "search-request": {
      if (typeof payload.at !== "number" || !Number.isFinite(payload.at)) return state;
      const next = { ...state, guard: { ...state.guard, searchLoads: [...state.guard.searchLoads, payload.at].slice(-LOAD_HISTORY) } };
      return payload.honeypot === true ? flag(next, "honeypot") : next;
    }
    case "throttled": {
      const throttled = state.guard.throttled + 1;
      const next = withActivity({ ...state, guard: { ...state.guard, throttled } }, "throttled");
      return throttled >= STORE_THROTTLE.refusalsBeforeFlag ? flag(next, "rate-limit") : next;
    }
    case "pass-soft-check":
      return state.guard.softCheck === "passed" ? state : withActivity({ ...state, guard: { ...state.guard, softCheck: "passed" } }, "passed soft check");
    case "solve-robot-check": {
      if (typeof payload.answer !== "string") return state;
      const { robot } = state.guard;
      const correct = payload.answer.trim().toUpperCase() === robotCode(state.challengeSeed, robot.image);
      const next = correct ? { ...robot, solved: true } : { image: robot.image + 1, wrong: robot.wrong + 1, solved: false };
      return withActivity({ ...state, guard: { ...state.guard, robot: next } }, correct ? "robot check passed" : "robot check failed");
    }
    case "new-robot-image":
      return { ...state, guard: { ...state.guard, robot: { ...state.guard.robot, image: state.guard.robot.image + 1 } } };
    case "subscribe": {
      if (typeof payload.website === "string" && payload.website.trim() !== "") return flag(state, "honeypot");
      if (typeof payload.email !== "string" || !/^[^@\s]+@[^@\s]+\.[a-z]{2,}$/iu.test(payload.email.trim())) return state;
      return withActivity({ ...state, newsletter: "subscribed" }, "subscribed");
    }
    default:
      return undefined;
  }
}
