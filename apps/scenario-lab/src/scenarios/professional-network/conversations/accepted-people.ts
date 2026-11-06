import { RECEIVED_INVITATIONS } from "../data/index.js";
import type { ProfessionalNetworkState, ReceivedInvitation } from "../types.js";

/**
 * The people whose connection invitation the viewer accepted, most recently
 * accepted first -- the order Connections lists them as recently added.
 * Accepting a page or newsletter invitation adds no connection.
 */
export function acceptedPeople(state: Pick<ProfessionalNetworkState, "accepted">): ReceivedInvitation[] {
  return [...state.accepted]
    .reverse()
    .flatMap((urn) => RECEIVED_INVITATIONS.filter((invitation) => invitation.urn === urn && invitation.kind === "person"));
}
