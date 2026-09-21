import { EXISTING_THREADS, INITIAL_FOLLOWING, accountByHandle, initialCollections, initialSaved, instantReply, postByCode } from "./data/index.js";
import { relayFor } from "./relay.js";
import { photoModes, type Collection, type PhotoMode, type PhotoState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 60;
/** The longest collection name the dialog accepts. */
const NAME_LIMIT = 50;
/** The day every message the run sends is stamped with: the site's own "today". */
const TODAY = "2026-10-04";

/** The site as a visitor first meets it. The lab seed changes how the site is styled, never what it holds. */
export function createPhotoState(mode: PhotoMode = "baseline"): PhotoState {
  return withRelay({
    mode,
    consent: "pending",
    notificationsAnswered: false,
    dockMinimized: false,
    sessionConfirmed: false,
    upsellDismissed: false,
    saved: initialSaved(),
    collections: initialCollections(),
    liked: [],
    following: [...INITIAL_FOLLOWING],
    messages: [],
    blocked: false,
    activity: [],
  });
}

/**
 * Every change a visitor can make. A payload the page could not have sent, or
 * an operation on something that does not exist, leaves the state alone.
 * `set-mode` arms a rendering and, like every armed fixture here, starts it
 * from a fresh visit, so an armed run is never judged on the recording's
 * leftovers.
 */
export function mutatePhotoState(state: PhotoState, operation: string, payload: unknown): PhotoState {
  if (!isRecord(payload)) return state;
  const next = apply(state, operation, payload);
  if (next === state) return state;
  return withRelay({ ...next, activity: [...next.activity, operation].slice(-ACTIVITY_LIMIT) });
}

function apply(state: PhotoState, operation: string, payload: Record<string, unknown>): PhotoState {
  switch (operation) {
    case "set-mode": {
      const mode = photoModes.find((candidate) => candidate === payload.mode);
      return mode === undefined ? state : createPhotoState(mode);
    }
    case "consent":
      return payload.choice === "essential" || payload.choice === "all" ? { ...state, consent: payload.choice } : state;
    case "notifications":
      return { ...state, notificationsAnswered: true };
    case "dock":
      return typeof payload.minimized === "boolean" ? { ...state, dockMinimized: payload.minimized } : state;
    case "session":
      return { ...state, sessionConfirmed: true };
    case "upsell":
      return { ...state, upsellDismissed: true };
    case "save":
      return save(state, payload);
    case "collection-create":
      return createCollection(state, payload);
    case "collection-toggle":
      return toggleCollection(state, payload);
    case "collection-add":
      return addToCollection(state, payload);
    case "like": {
      const code = knownCode(payload.code);
      if (code === undefined || typeof payload.liked !== "boolean") return state;
      return { ...state, liked: payload.liked ? [...new Set([...state.liked, code])] : state.liked.filter((entry) => entry !== code) };
    }
    case "follow": {
      const handle = typeof payload.handle === "string" && accountByHandle(payload.handle) ? payload.handle : undefined;
      if (handle === undefined || typeof payload.following !== "boolean") return state;
      return { ...state, following: payload.following ? [...new Set([...state.following, handle])] : state.following.filter((entry) => entry !== handle) };
    }
    case "send-message":
      return sendMessage(state, payload);
    default:
      return state;
  }
}

/** Saving puts a post in "All posts"; unsaving takes it out of saved and out of every collection holding it. */
function save(state: PhotoState, payload: Record<string, unknown>): PhotoState {
  const code = knownCode(payload.code);
  if (code === undefined || typeof payload.saved !== "boolean") return state;
  if (payload.saved) return state.saved.includes(code) ? state : { ...state, saved: [...state.saved, code] };
  return {
    ...state,
    saved: state.saved.filter((entry) => entry !== code),
    collections: state.collections.map((collection) => ({ ...collection, codes: collection.codes.filter((entry) => entry !== code) })),
  };
}

/** A new collection holding the posts it was created with, each of which is saved as well. A name already in use is refused. */
function createCollection(state: PhotoState, payload: Record<string, unknown>): PhotoState {
  const name = typeof payload.name === "string" ? payload.name.trim().replace(/\s+/gu, " ") : "";
  const codes = readCodes(payload.codes);
  if (name === "" || name.length > NAME_LIMIT || codes.length === 0) return state;
  if (state.collections.some((collection) => collection.name.toLowerCase() === name.toLowerCase())) return state;
  const collection: Collection = { name, slug: slugFor(name, state.collections), codes };
  return { ...state, collections: [...state.collections, collection], saved: [...new Set([...state.saved, ...codes])] };
}

/** A collection row in the save dialog adds the post when it is not in the collection and removes it when it is. */
function toggleCollection(state: PhotoState, payload: Record<string, unknown>): PhotoState {
  const code = knownCode(payload.code);
  const target = state.collections.find((collection) => collection.slug === payload.slug);
  if (code === undefined || target === undefined) return state;
  const holds = target.codes.includes(code);
  return {
    ...state,
    saved: holds ? state.saved : [...new Set([...state.saved, code])],
    collections: state.collections.map((collection) => collection !== target ? collection : { ...collection, codes: holds ? collection.codes.filter((entry) => entry !== code) : [...collection.codes, code] }),
  };
}

/** "Add from saved" on a collection's page: only posts already saved can be picked, and a post already there is left alone. */
function addToCollection(state: PhotoState, payload: Record<string, unknown>): PhotoState {
  const target = state.collections.find((collection) => collection.slug === payload.slug);
  const codes = readCodes(payload.codes).filter((code) => state.saved.includes(code) && !target?.codes.includes(code));
  if (target === undefined || codes.length === 0) return state;
  return { ...state, collections: state.collections.map((collection) => collection !== target ? collection : { ...collection, codes: [...collection.codes, ...codes] }) };
}

/**
 * A direct message. The composer carries a field no person can see or reach;
 * a message that arrives with it filled was typed by something filling every
 * field it found, and the account is action-blocked from then on: that
 * message and every later one is refused. A message to the shop draws its
 * instant reply.
 */
function sendMessage(state: PhotoState, payload: Record<string, unknown>): PhotoState {
  const thread = typeof payload.thread === "string" ? payload.thread : "";
  const text = typeof payload.text === "string" ? payload.text.trim() : "";
  const known = EXISTING_THREADS.some((entry) => entry.thread === thread) || accountByHandle(thread) !== undefined;
  if (!known || text === "" || text.length > 1000) return state;
  if (state.blocked) return state;
  if (typeof payload.trap === "string" && payload.trap.trim() !== "") return { ...state, blocked: true };
  const sent = { thread, from: "me", date: TODAY, text };
  const reply = thread === "saltmarsh.goods" ? [{ thread, ...instantReply(text, TODAY) }] : [];
  return { ...state, messages: [...state.messages, sent, ...reply] };
}

function withRelay(state: Omit<PhotoState, "relay">): PhotoState {
  return { ...state, relay: relayFor(state) };
}

function knownCode(value: unknown): string | undefined {
  return typeof value === "string" && postByCode(value) !== undefined ? value : undefined;
}

function readCodes(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string" && postByCode(entry) !== undefined))] : [];
}

function slugFor(name: string, existing: readonly Collection[]): string {
  const base = name.toLowerCase().replace(/[^a-z0-9]+/gu, "-").replace(/^-|-$/gu, "") || "collection";
  let slug = base;
  for (let index = 2; existing.some((collection) => collection.slug === slug); index += 1) slug = `${base}-${index}`;
  return slug;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
