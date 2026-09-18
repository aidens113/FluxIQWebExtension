import { applyDeskChanges, queueCounts, ticketsFor } from "./queue.js";
import { supportAgents, ticketByReference } from "./tickets.js";
import { escalationSeverities, supportDeskModes, type EscalationSeverity, type SupportDeskState } from "./types.js";

/** Enough history to see what a run did, and a hard stop so a stuck page cannot grow the snapshot without bound. */
const ACTIVITY_LIMIT = 50;

/** The desk as the shift starts: nothing triaged, nothing resolved, no escalation raised, the queue unarmed. */
export function createSupportDeskState(): SupportDeskState {
  return withOracle({ mode: "baseline", assignments: {}, resolved: [], replies: [], escalations: [], activity: [] });
}

/**
 * `set-mode` arms a rendering and, like every armed fixture here, clears what
 * an earlier run did, so an armed run's oracle is its own and never a stale
 * success from the recording. The four change operations are what the page
 * reports as a person works: tickets assigned in bulk or one at a time, a
 * ticket resolved, a reply sent from a template, and an escalation raised
 * against a ticket the desk actually holds. Anything else, or a payload the
 * page could not have sent, leaves the state alone.
 */
export function mutateSupportDeskState(state: SupportDeskState, operation: string, payload: unknown): SupportDeskState {
  if (!isRecord(payload)) return state;
  if (operation === "set-mode") {
    const mode = supportDeskModes.find((candidate) => candidate === payload.mode);
    return mode === undefined ? state : withOracle({ mode, assignments: {}, resolved: [], replies: [], escalations: [], activity: [] });
  }
  if (operation === "assign-tickets") return assignTickets(state, payload);
  if (operation === "resolve-ticket") {
    const reference = knownReference(state, payload.reference);
    if (reference === undefined || state.resolved.includes(reference)) return state;
    return withOracle({ ...state, resolved: [...state.resolved, reference], activity: append(state.activity, `resolved ${reference}`) });
  }
  if (operation === "reply-ticket") {
    const reference = knownReference(state, payload.reference);
    if (reference === undefined || typeof payload.template !== "string") return state;
    return withOracle({ ...state, replies: [...state.replies, reference], activity: append(state.activity, `replied ${reference}`) });
  }
  if (operation === "raise-escalation") return raiseEscalation(state, payload);
  return state;
}

function assignTickets(state: SupportDeskState, payload: Record<string, unknown>): SupportDeskState {
  const agent = supportAgents.find((candidate) => candidate === payload.agent);
  const references = readReferences(payload.references).filter((reference) => knownReference(state, reference) !== undefined);
  if (agent === undefined || references.length === 0) return state;
  const assignments = { ...state.assignments };
  for (const reference of references) assignments[reference] = agent;
  return withOracle({ ...state, assignments, activity: append(state.activity, `assigned ${references.length} ${agent}`) });
}

function raiseEscalation(state: SupportDeskState, payload: Record<string, unknown>): SupportDeskState {
  const reference = knownReference(state, payload.reference);
  const severity = escalationSeverities.find((candidate): candidate is EscalationSeverity => candidate === payload.severity);
  if (reference === undefined || severity === undefined || state.escalations.some((entry) => entry.reference === reference)) return state;
  // The requester comes from the ticket the desk holds, never from the form: an
  // escalation raised against the wrong reference names the wrong person, which
  // is what makes the log judgeable.
  const ticket = ticketByReference(ticketsFor(state.mode), reference);
  if (!ticket) return state;
  return withOracle({
    ...state,
    escalations: [...state.escalations, { reference, severity, requester: ticket.requester }],
    activity: append(state.activity, `escalated ${reference} ${severity}`),
  });
}

/** The queue a rendering would now show, given the run's own changes. */
function withOracle(state: Omit<SupportDeskState, "oracle">): SupportDeskState {
  return { ...state, oracle: queueCounts(applyDeskChanges(ticketsFor(state.mode), state.assignments, state.resolved)) };
}

function knownReference(state: SupportDeskState, value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  return ticketByReference(ticketsFor(state.mode), value)?.reference;
}

function readReferences(value: unknown): string[] {
  return Array.isArray(value) ? [...new Set(value.filter((entry): entry is string => typeof entry === "string"))] : [];
}

function append(activity: readonly string[], entry: string): string[] {
  return [...activity, entry].slice(-ACTIVITY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
