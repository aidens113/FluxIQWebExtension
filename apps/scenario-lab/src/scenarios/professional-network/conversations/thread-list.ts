import { memberByUrn, sentAtIso } from "../data/index.js";
import type { ProfessionalNetworkState, ThreadRow } from "../types.js";
import { acceptedPeople } from "./accepted-people.js";

const MONTHS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];
const day = (iso: string) => `${MONTHS[new Date(iso).getUTCMonth()]} ${new Date(iso).getUTCDate()}`;
const sep = (dayOfMonth: number, hour: number) => Date.UTC(2026, 8, dayOfMonth, hour);

const EARLIER: ThreadRow[] = [
  { name: "Priya Nair", line: "Hi Rafaela! Quick one — are you still hiring for the platform team?", date: "Sep 20", at: sep(20, 8), newConnection: false },
  { name: "Hendrik Mol", line: "Thanks, forwarded to our hiring lead.", date: "Sep 18", at: sep(18, 8), newConnection: false },
  { name: "Sophie Laurent", line: "Can we move the sync to Thursday?", date: "Sep 15", at: sep(15, 7), newConnection: false },
  { name: "Wouter de Boer", line: "Sounds good 👍", date: "Sep 9", at: sep(9, 8), newConnection: false },
];

/**
 * The conversation list, newest message first. Accepting a connection
 * invitation that carried a note starts a conversation whose first message
 * is that note exactly as written, dated the day the invitation was sent;
 * an invitation without a note starts none. Such a conversation is tagged
 * "New connection".
 */
export function threadRows(state: Pick<ProfessionalNetworkState, "accepted">): ThreadRow[] {
  const started = acceptedPeople(state)
    .filter((invitation) => invitation.message !== "")
    .map((invitation): ThreadRow => {
      const sent = sentAtIso(invitation.days);
      return { name: memberByUrn(invitation.memberUrn)!.name, line: invitation.message, date: day(sent), at: Date.parse(sent), newConnection: true };
    });
  return [...started, ...EARLIER].sort((left, right) => right.at - left.at);
}
