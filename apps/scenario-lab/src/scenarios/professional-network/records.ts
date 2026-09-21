import { SENT_INVITATIONS } from "./data/index.js";
import { peopleMatches, type PeopleQuery } from "./search/index.js";
import { invitationStore, invitationStoreText } from "./store.js";
import type { SentInvitation } from "./types.js";

/** Rotterdam in South Holland, the filter's own id for it. */
export const ROTTERDAM_NL = "106169143";

/** The search the extraction task describes: "data engineer", second degree, Rotterdam in the Netherlands. */
export const ROTTERDAM_ENGINEERS: PeopleQuery = { keywords: "data engineer", network: ["S"], geo: [ROTTERDAM_NL], company: [], page: 1 };

/**
 * What a person copying those results into a table writes down: each person
 * once, in the order the search first showed them, and nobody the page marked
 * as promoted. That is the search's own match list: the repeat at the top of
 * page 3 and the promoted cards are exactly what it leaves out.
 */
export function peopleRecords(query: PeopleQuery): Array<Record<string, string>> {
  return peopleMatches(query).map((member) => ({ name: member.name, headline: member.headline, location: member.location }));
}

/** The connection requests sent a month or more ago: thirty-three days and older. Page and newsletter invitations are not connection requests. */
export function staleConnectionRequests(): SentInvitation[] {
  return SENT_INVITATIONS.filter((invitation) => invitation.kind === "person" && invitation.days >= 30);
}

/** The embedded store as a session starts. */
export const STORE_AT_START = invitationStoreText(invitationStore({ withdrawn: [], accepted: [], ignored: [], sentByRun: [] }));

/** The embedded store once exactly the month-old connection requests are withdrawn and nothing else has changed. */
export const STORE_AFTER_WITHDRAWAL = invitationStoreText(invitationStore({ withdrawn: staleConnectionRequests().map((invitation) => invitation.urn), accepted: [], ignored: [], sentByRun: [] }));
