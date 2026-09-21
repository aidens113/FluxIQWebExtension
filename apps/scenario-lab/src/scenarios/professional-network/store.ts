import { RECEIVED_INVITATIONS, SENT_INVITATIONS } from "./data/index.js";
import type { InvitationStore, ProfessionalNetworkState, RunInvitation } from "./types.js";

/** The urn a connection request the run sent is stored under. */
export function runInvitationUrn(invitation: Pick<RunInvitation, "memberUrn">): string {
  return `urn:gl:invitation:new-${invitation.memberUrn.slice(invitation.memberUrn.lastIndexOf(":") + 1)}`;
}

/**
 * Every invitation still pending in each direction, given what the run did:
 * the seeded ones it has not withdrawn, accepted or ignored, plus the
 * connection requests it sent and the site kept. A submission that filled the
 * honeypot was acknowledged on screen and never stored, so it is not here.
 */
export function invitationStore(state: Pick<ProfessionalNetworkState, "withdrawn" | "accepted" | "ignored" | "sentByRun">): InvitationStore {
  const handled = new Set([...state.accepted, ...state.ignored]);
  const withdrawn = new Set(state.withdrawn);
  return {
    received: RECEIVED_INVITATIONS.filter((invitation) => !handled.has(invitation.urn)).map((invitation) => invitation.urn).sort(),
    sent: [
      ...SENT_INVITATIONS.filter((invitation) => !withdrawn.has(invitation.urn)).map((invitation) => invitation.urn),
      ...state.sentByRun.filter((invitation) => !invitation.flagged).map(runInvitationUrn).filter((urn) => !withdrawn.has(urn)),
    ].sort(),
  };
}

/** The store as the page embeds it and the oracle compares it: compact JSON, received first. */
export function invitationStoreText(store: InvitationStore): string {
  return JSON.stringify({ received: store.received, sent: store.sent });
}
