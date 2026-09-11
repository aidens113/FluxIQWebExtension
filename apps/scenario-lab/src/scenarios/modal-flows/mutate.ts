import { pageLogic } from "./page-logic.js";
import type { ModalFlowsState } from "./state.js";

const MAX_INVITES = 20;
const MAX_SECTIONS = 50;
/** Variant arms the harness applies between recording and the run; an open offer never blocks them. */
const ARM_OPERATIONS = new Set(["remove-consent-banner", "arm-interstitial"]);

/**
 * Applies one page or harness operation. While the interstitial is open,
 * every page operation except `close-interstitial` is a no-op: the offer
 * blocks the page until it is closed.
 */
export function mutateModalFlows(state: ModalFlowsState, operation: string, payload: unknown): ModalFlowsState {
  if (state.interstitial === "open" && operation !== "close-interstitial" && !ARM_OPERATIONS.has(operation)) return state;
  switch (operation) {
    case "send-invite": return sendInvite(state, payload);
    case "cancel-invite": return { ...state, inviteCancellations: state.inviteCancellations + 1 };
    case "accept-cookies": return state.consent === "pending" ? { ...state, consent: "accepted" } : state;
    case "reject-cookies": return state.consent === "pending" ? { ...state, consent: "essential-only" } : state;
    case "publish": return { ...state, publishCount: state.publishCount + 1 };
    case "add-section": return addSection(state);
    case "close-interstitial": return state.interstitial === "open" ? { ...state, interstitial: "closed" } : state;
    case "delete-draft": return answerDeletePrompt(state, payload);
    case "remove-consent-banner": return { ...state, consent: "absent" };
    case "arm-interstitial": return { ...state, interstitial: "armed" };
    default: return state;
  }
}

function sendInvite(state: ModalFlowsState, payload: unknown): ModalFlowsState {
  if (!isRecord(payload)) return state;
  const { email, role } = payload;
  if (typeof email !== "string" || !pageLogic.isInviteEmail(email) || (role !== "viewer" && role !== "editor")) return state;
  const invites: ModalFlowsState["invites"] = [...state.invites, { email, role }];
  return { ...state, invites: invites.slice(-MAX_INVITES) };
}

/** An armed offer opens on the first add after arming; that add still lands. */
function addSection(state: ModalFlowsState): ModalFlowsState {
  if (state.sectionCount >= MAX_SECTIONS) return state;
  return { ...state, sectionCount: state.sectionCount + 1, interstitial: state.interstitial === "armed" ? "open" : state.interstitial };
}

/** `confirmed` is the native confirm() answer; a deleted draft ignores further prompts. */
function answerDeletePrompt(state: ModalFlowsState, payload: unknown): ModalFlowsState {
  if (state.draft === "deleted" || !isRecord(payload) || typeof payload.confirmed !== "boolean") return state;
  const { accepted, dismissed } = state.deletePrompts;
  return payload.confirmed
    ? { ...state, draft: "deleted", deletePrompts: { accepted: accepted + 1, dismissed } }
    : { ...state, deletePrompts: { accepted, dismissed: dismissed + 1 } };
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
