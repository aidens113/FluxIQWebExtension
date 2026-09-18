import { isBreaching, truncateSubject } from "./format.js";
import { UNASSIGNED, type SupportTicket, type TicketPriority, type TicketStatus } from "./types.js";

/** How many tickets the queue holds. Large enough that the table, not the shell, is the page. */
export const QUEUE_SIZE = 320;

/** The agents the desk can assign to, in the order the assignment controls offer them. */
export const supportAgents = ["Priya Raman", "Marcus Hale", "Ines Okonjo", "Toby Wren", "Sara Lindqvist", "Dmitri Novak"] as const;

/** The agent the triage workflow hands the unassigned backlog to. */
export const TRIAGE_AGENT = "Priya Raman";

// Twenty given names and sixteen family names, both in alphabetical order, so
// the queue is exactly 320 people and no two requesters share a name. Nothing
// here depends on the lab seed: a manifest's expected records are literal text,
// so the queue must read the same on every run. Every address is fictional and
// ends in `.test`, which can never resolve.
const GIVEN_NAMES = [
  "Alina", "Bruno", "Cato", "Dalia", "Esme", "Ferran", "Greta", "Hugo", "Imani", "Jonas",
  "Kira", "Lorcan", "Mira", "Nils", "Odette", "Pavel", "Rosa", "Stefan", "Tamsin", "Ulric",
] as const;
const FAMILY_NAMES = [
  "Abbott", "Beaumont", "Calloway", "Dunmore", "Eriksen", "Fairbairn", "Gallardo", "Hartnell",
  "Ibarra", "Jessop", "Kowalski", "Lamontagne", "Mortimer", "Nazari", "Ostrand", "Pemberton",
] as const;
const COMPANIES = [
  "brambling-foods", "calder-rail", "dovetail-timber", "ellery-optics",
  "fenwick-press", "glasshouse-tea", "harlow-cycles", "ilkeston-linen",
] as const;

/**
 * Sixteen subjects a desk of this kind actually receives. Several run past the
 * column's width, so the queue shows them clipped; several repeat across the
 * queue, because real subjects do, which is what makes a subject a poor way to
 * tell one row from another.
 */
const SUBJECTS = [
  "Cannot sign in after the weekend maintenance window",
  "Duplicate charge on this month invoice",
  "Delivery marked as arrived but the box was empty",
  "Export keeps timing out on the reporting screen",
  "Please move our renewal date to the end of the quarter",
  "Two seats were removed from our plan without notice",
  "The weekly digest stopped arriving on Monday",
  "Request to add a second billing contact",
  "Order arrived with the wrong finish on the panels",
  "Cannot upload a purchase order during checkout",
  "Password reset mail never arrives for shared inboxes",
  "Reporting totals disagree with the downloaded sheet",
  "Courier left the parcel with a neighbour",
  "Need copies of last quarter invoices for our auditor",
  "Sandbox signs users out after a few minutes",
  "Asking about bulk pricing for a forty seat renewal",
] as const;

/** Mostly Normal, with the odd Urgent: two of every thirteen tickets. */
const PRIORITY_CYCLE: readonly TicketPriority[] = [
  "Normal", "Normal", "High", "Normal", "Low", "Normal", "Urgent",
  "Normal", "High", "Normal", "Normal", "Low", "Urgent",
];
const STATUS_CYCLE: readonly TicketStatus[] = ["Open", "New", "Open", "Pending", "Open", "Resolved", "New"];
const AGE_CYCLE = [
  { minutes: 7, label: "7 minutes ago" },
  { minutes: 26, label: "26 minutes ago" },
  { minutes: 55, label: "55 minutes ago" },
  { minutes: 180, label: "3 hours ago" },
  { minutes: 420, label: "7 hours ago" },
  { minutes: 1_500, label: "Yesterday" },
  { minutes: 2_900, label: "2 days ago" },
  { minutes: 5_760, label: "4 days ago" },
  { minutes: 11_520, label: "8 days ago" },
] as const;
/**
 * Minutes a breached ticket is past its target, and minutes a healthy one has
 * left. A breach adds the ticket's own position to the figure, so no two late
 * tickets are late by the same amount: "the one that has been late longest" is
 * then a single ticket rather than a tie, which is what makes it a thing a
 * person can ask for.
 */
const BREACH_MINUTES = [45, 130, 260, 415, 620, 900, 1_285] as const;
const DUE_MINUTES = [35, 95, 155, 240, 330, 470, 610, 790, 1_010, 1_260, 1_540] as const;

/** One ticket in every `BREACH_EVERY` is past its response target on the desk as it stands. */
const BREACH_EVERY = 23;
/** After the night shift worked the backlog down, one in `RECOVERED_BREACH_EVERY` is. */
const RECOVERED_BREACH_EVERY = 97;

/** The queue as it stands, newest reference last. */
export const supportTickets: readonly SupportTicket[] = buildQueue(BREACH_EVERY);

/** The same queue after the backlog was worked down: the same tickets, far fewer of them past target. */
export const recoveredSlaTickets: readonly SupportTicket[] = buildQueue(RECOVERED_BREACH_EVERY);

export function ticketByReference(tickets: readonly SupportTicket[], reference: string): SupportTicket | undefined {
  return tickets.find((ticket) => ticket.reference === reference);
}

/**
 * The ticket the reply workflow answers and closes: waiting on the desk, owned
 * by somebody, already past its response target, and raised by a requester
 * whose name appears nowhere else in the queue, so searching for that person
 * leaves exactly one row. Late on purpose -- resolving it stops its countdown,
 * so the queue's own breach count moves, and the run is judged on a number
 * that could not have moved by itself.
 */
export const REPLY_TICKET: SupportTicket = firstOrThrow(
  supportTickets.filter((ticket) => ticket.status === "Pending" && ticket.assignee !== UNASSIGNED && isBreaching(ticket)),
  "no late ticket is waiting on the desk with an owner",
);

function firstOrThrow(tickets: readonly SupportTicket[], reason: string): SupportTicket {
  const [first] = tickets;
  if (!first) throw new Error(`The support desk queue is wrong: ${reason}`);
  return first;
}

function buildQueue(breachEvery: number): readonly SupportTicket[] {
  return Array.from({ length: QUEUE_SIZE }, (_unused, index) => ticket(index, breachEvery));
}

function ticket(index: number, breachEvery: number): SupportTicket {
  const given = cycle(GIVEN_NAMES, index);
  const family = FAMILY_NAMES[Math.floor(index / GIVEN_NAMES.length) % FAMILY_NAMES.length] ?? "Abbott";
  const status = cycle(STATUS_CYCLE, index);
  const age = cycle(AGE_CYCLE, index);
  return {
    reference: `TCK-${2_100 + index * 7}`,
    requester: `${given} ${family}`,
    requesterEmail: `${given.toLowerCase()}.${family.toLowerCase()}@${cycle(COMPANIES, index)}.test`,
    account: `ACC-${3_100 + index * 11}`,
    subject: cycle(SUBJECTS, index),
    priority: cycle(PRIORITY_CYCLE, index),
    status,
    assignee: index % 17 === 3 ? UNASSIGNED : cycle(supportAgents, index),
    ageMinutes: age.minutes,
    age: age.label,
    slaMinutes: index % breachEvery === 5 ? -(cycle(BREACH_MINUTES, index) + index) : cycle(DUE_MINUTES, index),
  };
}

/** The subject exactly as the queue column shows it, which is what a column read of that cell returns. */
export function listedSubject(ticket: SupportTicket): string {
  return truncateSubject(ticket.subject);
}

function cycle<TValue>(values: readonly TValue[], index: number): TValue {
  const value = values[index % values.length];
  if (value === undefined) throw new Error("A ticket cycle must not be empty");
  return value;
}
