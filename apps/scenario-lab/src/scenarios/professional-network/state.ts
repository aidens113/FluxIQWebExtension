import { MEMBERS, RECEIVED_INVITATIONS, SENT_INVITATIONS, memberByUrn } from "./data/index.js";
import { invitationStore, runInvitationUrn } from "./store.js";
import { networkModes, type NetworkMode, type ProfessionalNetworkState } from "./types.js";

const ACTIVITY_LIMIT = 60;
const HIT_LIMIT = 8;
/** What the connection-note box accepts, as its counter says. */
export const NOTE_LIMIT = 300;
const MESSAGE_LIMIT = 2000;

type RunState = Omit<ProfessionalNetworkState, "store">;

function fresh(mode: NetworkMode): RunState {
  return {
    mode, consent: "unset", appPromptDismissed: false, chatBubbleSeen: false, upsellDismissed: false,
    withdrawn: [], accepted: [], ignored: [], sentByRun: [], messages: [], searchHits: [], challenges: 0, activity: [],
  };
}

/** The site as a new session meets it: no consent given, nothing withdrawn or answered, unarmed. The lab seed reaches none of it. */
export function createNetworkState(): ProfessionalNetworkState {
  return withStore(fresh("baseline"));
}

/**
 * Every change a page can report. `set-mode` arms a rendering and, as every
 * armed fixture here does, starts the session over, so an armed run's final
 * state is its own. A payload the page could not have sent -- an unknown
 * invitation, a second withdrawal of the same one, a request to a first-degree
 * connection -- leaves the state alone, which is what the real service would
 * answer with an error.
 */
export function mutateNetworkState(state: ProfessionalNetworkState, operation: string, payload: unknown): ProfessionalNetworkState {
  if (!isRecord(payload)) return state;
  const run: RunState = { ...state };
  switch (operation) {
    case "set-mode": {
      const mode = networkModes.find((candidate) => candidate === payload.mode);
      return mode === undefined ? state : withStore(fresh(mode));
    }
    case "set-consent":
      if (payload.choice !== "accepted" && payload.choice !== "rejected") return state;
      return withStore({ ...run, consent: payload.choice, activity: log(run, `consent ${payload.choice}`) });
    case "dismiss-app-prompt":
      return withStore({ ...run, appPromptDismissed: true });
    case "chat-bubble-seen":
      return withStore({ ...run, chatBubbleSeen: true });
    case "dismiss-upsell":
      return withStore({ ...run, upsellDismissed: true, activity: log(run, "upsell dismissed") });
    case "withdraw-invitation": {
      const urn = payload.urn;
      if (typeof urn !== "string" || !invitationStore(run).sent.includes(urn)) return state;
      return withStore({ ...run, withdrawn: [...run.withdrawn, urn], activity: log(run, `withdrew ${urn}`) });
    }
    case "accept-invitation":
    case "ignore-invitation": {
      const urn = payload.urn;
      if (typeof urn !== "string" || !RECEIVED_INVITATIONS.some((invitation) => invitation.urn === urn)) return state;
      if (run.accepted.includes(urn) || run.ignored.includes(urn)) return state;
      const accepted = operation === "accept-invitation";
      return withStore({
        ...run,
        accepted: accepted ? [...run.accepted, urn] : run.accepted,
        ignored: accepted ? run.ignored : [...run.ignored, urn],
        activity: log(run, `${accepted ? "accepted" : "ignored"} ${urn}`),
      });
    }
    case "send-invitation":
      return sendInvitation(state, run, payload);
    case "send-message": {
      const { thread, text } = payload;
      if (typeof thread !== "string" || typeof text !== "string" || !text.trim() || text.length > MESSAGE_LIMIT) return state;
      if (memberByUrn(thread)?.degree !== "F") return state;
      return withStore({ ...run, messages: [...run.messages, { thread, text }], activity: log(run, `messaged ${thread}`) });
    }
    case "search-hit":
      if (typeof payload.at !== "number" || !Number.isFinite(payload.at)) return state;
      return withStore({ ...run, searchHits: [...run.searchHits, payload.at].slice(-HIT_LIMIT) });
    case "search-challenged":
      return withStore({ ...run, challenges: run.challenges + 1, activity: log(run, "search challenged") });
    default:
      return state;
  }
}

/**
 * A connection request. The note is optional and at most `NOTE_LIMIT`
 * characters. The form carries a field no person can see; a submission that
 * filled it is acknowledged exactly like a real one and stored as flagged,
 * which is to say not stored as an invitation at all.
 */
function sendInvitation(state: ProfessionalNetworkState, run: RunState, payload: Record<string, unknown>): ProfessionalNetworkState {
  const { memberUrn, note, website } = payload;
  if (typeof memberUrn !== "string" || typeof note !== "string" || note.length > NOTE_LIMIT) return state;
  const member = MEMBERS.find((candidate) => candidate.urn === memberUrn);
  if (!member || member.hidden || member.degree === "F") return state;
  // A person with a request pending, or one withdrawn this session, cannot be invited again: the withdraw dialog says so.
  const earlier = [...SENT_INVITATIONS.filter((invitation) => invitation.kind === "person" && invitation.memberUrn === memberUrn).map((invitation) => invitation.urn), runInvitationUrn({ memberUrn })];
  const pending = invitationStore(run).sent;
  if (earlier.some((urn) => pending.includes(urn) || run.withdrawn.includes(urn))) return state;
  const flagged = typeof website === "string" && website.trim() !== "";
  return withStore({ ...run, sentByRun: [...run.sentByRun, { memberUrn, note, flagged }], activity: log(run, `${flagged ? "discarded" : "invited"} ${memberUrn}`) });
}

function withStore(run: RunState): ProfessionalNetworkState {
  return { ...run, store: invitationStore(run) };
}

function log(run: RunState, entry: string): string[] {
  return [...run.activity, entry].slice(-ACTIVITY_LIMIT);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
