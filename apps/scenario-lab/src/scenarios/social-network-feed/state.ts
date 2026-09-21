import { COMMUNITIES, FEED_AFTER_CAUGHT_UP, FEED_BEFORE_CAUGHT_UP, friendRequestById, OPEN_DAY_POST, PEOPLE_YOU_MAY_KNOW } from "./content/index.js";
import { feedModes, type Audience, type FeedMode, type FeedState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 60;
/** The longest post the composers accept, as the site's own limit. */
const TEXT_LIMIT = 5_000;
const AUDIENCES: readonly Audience[] = ["Public", "Friends", "Only me"];
const MEMBER_OF = new Set(["riverside-allotments", "harbourside-runners", "old-town-bakers"]);

/** The account as it stands before a run: every overlay unanswered, nothing posted, confirmed or deleted. The lab seed reaches none of it. */
export function createFeedState(mode: FeedMode = "baseline"): FeedState {
  return {
    mode,
    consent: "pending",
    notificationsPrompt: "pending",
    chat: "unopened",
    appPromo: "pending",
    pending: [],
    spam: 0,
    created: [],
    trashed: [],
    hidden: [],
    liked: [],
    shared: [],
    requests: {},
    friendRequestsSent: [],
    chatMessagesSent: 0,
    rateLimited: 0,
    activity: [],
  };
}

/**
 * Every change the page can report. A payload the page could not have sent,
 * or an operation it does not have, leaves the state exactly as it was.
 *
 * Two answers are deliberately silent. A composer submission whose hidden
 * trap field came back filled is counted as `spam` and goes nowhere -- the
 * server answers it exactly as it answers a real post, the way an anti-spam
 * filter does, so the page cannot tell the sender. And a friend request can be
 * confirmed or deleted only once.
 */
export function mutateFeedState(state: FeedState, operation: string, payload: unknown): FeedState {
  if (!isRecord(payload)) return state;
  switch (operation) {
    case "set-mode": {
      const mode = feedModes.find((candidate): candidate is FeedMode => candidate === payload.mode);
      return mode === undefined ? state : createFeedState(mode);
    }
    case "consent":
      return payload.choice === "all" || payload.choice === "essential" ? log({ ...state, consent: payload.choice }, `consent ${payload.choice}`) : state;
    case "notifications":
      return payload.choice === "dismissed" || payload.choice === "allowed" ? log({ ...state, notificationsPrompt: payload.choice }, `notifications ${payload.choice}`) : state;
    case "chat":
      return payload.state === "open" || payload.state === "closed" ? log({ ...state, chat: payload.state }, `chat ${payload.state}`) : state;
    case "chat-message":
      return typeof payload.text === "string" && payload.text.trim() !== "" ? log({ ...state, chatMessagesSent: state.chatMessagesSent + 1 }, "chat message sent") : state;
    case "app-promo":
      return payload.choice === "dismissed" ? log({ ...state, appPromo: "dismissed" }, "app promo dismissed") : state;
    case "group-post":
      return groupPost(state, payload);
    case "create-post":
      return createPost(state, payload);
    case "trash-post": {
      const { id } = payload;
      const own = id === OPEN_DAY_POST.id || state.created.some((created) => created.id === id);
      return typeof id === "string" && own && !state.trashed.includes(id) ? log({ ...state, trashed: [...state.trashed, id] }, `trashed ${id}`) : state;
    }
    case "hide-post": {
      const { id } = payload;
      const known = [...FEED_BEFORE_CAUGHT_UP, ...FEED_AFTER_CAUGHT_UP].some((unit) => unit.id === id);
      return typeof id === "string" && known && !state.hidden.includes(id) ? log({ ...state, hidden: [...state.hidden, id] }, `hid ${id}`) : state;
    }
    case "unhide-post": {
      const { id } = payload;
      return typeof id === "string" && state.hidden.includes(id) ? log({ ...state, hidden: state.hidden.filter((entry) => entry !== id) }, `unhid ${id}`) : state;
    }
    case "share-post": {
      const { id } = payload;
      return typeof id === "string" && /^[a-z]_[0-9a-f]{6}$/u.test(id) ? log({ ...state, shared: [...state.shared, id] }, `shared ${id}`) : state;
    }
    case "like": {
      const { id } = payload;
      if (typeof id !== "string" || !/^p_[0-9a-f]{6}$/u.test(id)) return state;
      const liked = state.liked.includes(id) ? state.liked.filter((entry) => entry !== id) : [...state.liked, id];
      return log({ ...state, liked }, `like ${id}`);
    }
    case "confirm-request":
    case "delete-request": {
      const { id } = payload;
      if (typeof id !== "string" || !friendRequestById(id) || state.requests[id] !== undefined) return state;
      const answer = operation === "confirm-request" ? "confirmed" : "deleted";
      return log({ ...state, requests: { ...state.requests, [id]: answer } }, `${answer} ${id}`);
    }
    case "add-friend": {
      const { person } = payload;
      const suggested = PEOPLE_YOU_MAY_KNOW.some((entry) => entry.person === person);
      return typeof person === "string" && suggested && !state.friendRequestsSent.includes(person) ? log({ ...state, friendRequestsSent: [...state.friendRequestsSent, person] }, `asked ${person}`) : state;
    }
    case "rate-limited":
      return log({ ...state, rateLimited: state.rateLimited + 1 }, "rate limited");
    default:
      return state;
  }
}

/** A post or poll for one of Maya's groups. It needs an admin's approval, so it waits in `pending`. */
function groupPost(state: FeedState, payload: Record<string, unknown>): FeedState {
  const { group, kind, text, website } = payload;
  if (typeof group !== "string" || !MEMBER_OF.has(group) || COMMUNITIES[group] === undefined) return state;
  if (kind !== "post" && kind !== "poll") return state;
  const body = readText(text);
  if (body === undefined) return state;
  if (trapped(website)) return log({ ...state, spam: state.spam + 1 }, "group post dropped");
  return log({ ...state, pending: [...state.pending, { group, kind, text: body }] }, `pending ${kind} in ${group}`);
}

/** A post on Maya's own profile, which goes straight into her feed. */
function createPost(state: FeedState, payload: Record<string, unknown>): FeedState {
  const { text, audience, website } = payload;
  const body = readText(text);
  const chosen = AUDIENCES.find((candidate) => candidate === audience);
  if (body === undefined || chosen === undefined) return state;
  if (trapped(website)) return log({ ...state, spam: state.spam + 1 }, "post dropped");
  const id = `p_${(0xf0a000 + (state.created.length + 1) * 0x1f3).toString(16)}`;
  return log({ ...state, created: [...state.created, { id, text: body, audience: chosen }] }, `posted ${id} to ${chosen}`);
}

/** The text a composer sent, with the editor's surrounding whitespace dropped, or `undefined` for nothing worth posting. */
function readText(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const text = value.trim();
  return text === "" || text.length > TEXT_LIMIT ? undefined : text;
}

/** Whether the composer's hidden trap field came back with anything in it. A person never sees it; a form-filler fills it. */
function trapped(value: unknown): boolean {
  return typeof value === "string" && value.trim() !== "";
}

function log(state: FeedState, entry: string): FeedState {
  return { ...state, activity: [...state.activity, entry].slice(-ACTIVITY_LIMIT) };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
