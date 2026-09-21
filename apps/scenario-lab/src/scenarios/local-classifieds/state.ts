import { listingById, listingByKey } from "./catalog/index.js";
import { contactAllowed } from "./limits.js";
import { classifiedsModes, type ClassifiedsMode, type ClassifiedsState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const LOG_LIMIT = 50;
const CLOCK_LIMIT = 20;

/** The two listings the account had saved before this session: the armchair first, then the lamp. */
export const PRIOR_SAVED_KEYS = ["rattan-armchair", "desk-lamp"] as const;

/** The conversations the account already had going, which is why Buying reads 2 before anything is sent. */
export const PRIOR_CONVERSATION_KEYS = ["road-52-alex", "floor-lamp"] as const;

/** The session as a person arrives: nothing answered, nothing sent, the two old saves in place. The lab seed reaches none of it. */
export function createClassifiedsState(mode: ClassifiedsMode = "baseline"): ClassifiedsState {
  return {
    mode,
    consent: "pending",
    notificationPrompt: "pending",
    locationCheck: "pending",
    chat: "unopened",
    saved: PRIOR_SAVED_KEYS.map((key) => listingByKey(key).id),
    hidden: [],
    offers: [],
    messages: [],
    contactLog: [],
    refusedContacts: 0,
    feedLog: [],
    failedBatches: [],
    views: [],
    activity: [],
  };
}

/**
 * Every change the page can report. `set-mode` arms a rendering and, like
 * every armed fixture here, starts the session over, so an armed run's oracle
 * is its own. Anything else, or a payload the page could not have sent,
 * leaves the state alone. `now` is the server's clock; the scenario passes
 * `Date.now()` and a test passes whatever it needs.
 */
export function mutateClassifiedsState(state: ClassifiedsState, operation: string, payload: unknown, now: number): ClassifiedsState {
  if (!isRecord(payload)) return state;
  switch (operation) {
    case "set-mode": {
      const mode = classifiedsModes.find((candidate) => candidate === payload.mode);
      return mode === undefined ? state : createClassifiedsState(mode);
    }
    case "consent":
      return payload.choice === "all" || payload.choice === "essential" ? log({ ...state, consent: payload.choice }, `consent ${payload.choice}`) : state;
    case "notifications":
      if (payload.choice === "not-now") return log({ ...state, notificationPrompt: "dismissed" }, "notifications dismissed");
      return payload.choice === "turn-on" ? log({ ...state, notificationPrompt: "enabled" }, "notifications on") : state;
    case "location-check":
      return payload.choice === "confirm" || payload.choice === "change" ? log({ ...state, locationCheck: "answered" }, `location ${payload.choice}`) : state;
    case "chat":
      return payload.state === "open" || payload.state === "minimised" || payload.state === "closed" ? { ...state, chat: payload.state } : state;
    case "save": return save(state, payload);
    case "hide": {
      const listing = typeof payload.listingId === "string" ? listingById(payload.listingId) : undefined;
      if (!listing || state.hidden.includes(listing.id)) return state;
      return log({ ...state, hidden: [...state.hidden, listing.id], saved: state.saved.filter((id) => id !== listing.id) }, `hid ${listing.key}`);
    }
    case "send-offer": return sendOffer(state, payload, now);
    case "send-message": return sendMessage(state, payload, now);
    case "pass-check": return log({ ...state, feedLog: [] }, "passed check");
    case "feed-request":
      return typeof payload.at === "number" && Number.isFinite(payload.at) ? { ...state, feedLog: [...state.feedLog, payload.at].slice(-CLOCK_LIMIT) } : state;
    case "batch-failed":
      return typeof payload.key === "string" && !state.failedBatches.includes(payload.key) ? { ...state, failedBatches: [...state.failedBatches, payload.key].slice(-LOG_LIMIT) } : state;
    case "view": {
      const listing = typeof payload.id === "string" ? listingById(payload.id) : undefined;
      return listing ? { ...state, views: [...state.views, listing.id].slice(-LOG_LIMIT) } : state;
    }
    default:
      return state;
  }
}

/** Save or unsave a listing. The button toggles, so the page says which it wants, and pressing it twice undoes the first press. */
function save(state: ClassifiedsState, payload: Record<string, unknown>): ClassifiedsState {
  const listing = typeof payload.listingId === "string" ? listingById(payload.listingId) : undefined;
  if (!listing || typeof payload.saved !== "boolean") return state;
  if (!payload.saved) {
    return state.saved.includes(listing.id) ? log({ ...state, saved: state.saved.filter((id) => id !== listing.id) }, `unsaved ${listing.key}`) : state;
  }
  if (state.saved.includes(listing.id)) return state;
  return log({ ...state, saved: [...state.saved, listing.id] }, `saved ${listing.key}`);
}

/**
 * An offer the page sent. The amount must be whole pounds from 1 to twice the
 * asking price, which is what the dialog enforces too. A contact inside the
 * rate limit's interval is refused and counted, which is how the page learns
 * its offer did not go. `website` is the honeypot: a field the page hides from
 * people, so only something filling in every field it can find fills it, and
 * the marketplace then accepts the offer and quietly never delivers it.
 */
function sendOffer(state: ClassifiedsState, payload: Record<string, unknown>, now: number): ClassifiedsState {
  const listing = typeof payload.listingId === "string" ? listingById(payload.listingId) : undefined;
  const amount = payload.amount;
  if (!listing || listing.sold || listing.price === 0) return state;
  if (typeof amount !== "number" || !Number.isInteger(amount) || amount < 1 || amount > listing.price * 2) return state;
  if (!contactAllowed(state.contactLog, now)) return log({ ...state, refusedContacts: state.refusedContacts + 1 }, `offer refused ${listing.key}`);
  const note = typeof payload.note === "string" ? payload.note.slice(0, 500) : "";
  const delivered = !(typeof payload.website === "string" && payload.website.trim() !== "");
  const offers = [...state.offers, { listingId: listing.id, amount, note, delivered }];
  return log({ ...state, offers, contactLog: [...state.contactLog, now].slice(-CLOCK_LIMIT) }, `offer ${amount} ${listing.key}${delivered ? "" : " (held)"}`);
}

function sendMessage(state: ClassifiedsState, payload: Record<string, unknown>, now: number): ClassifiedsState {
  const listing = typeof payload.listingId === "string" ? listingById(payload.listingId) : undefined;
  const text = typeof payload.text === "string" ? payload.text.trim().slice(0, 1_000) : "";
  if (!listing || listing.sold || text === "") return state;
  if (!contactAllowed(state.contactLog, now)) return log({ ...state, refusedContacts: state.refusedContacts + 1 }, `message refused ${listing.key}`);
  const delivered = !(typeof payload.website === "string" && payload.website.trim() !== "");
  const messages = [...state.messages, { listingId: listing.id, text, delivered }];
  return log({ ...state, messages, contactLog: [...state.contactLog, now].slice(-CLOCK_LIMIT) }, `message ${listing.key}${delivered ? "" : " (held)"}`);
}

function log(state: ClassifiedsState, entry: string): ClassifiedsState {
  return { ...state, activity: [...state.activity, entry].slice(-LOG_LIMIT) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
