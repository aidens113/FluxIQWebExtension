/**
 * The support desk's vocabulary: what a ticket is, what the queue can be
 * filtered to, what a run leaves behind, and the renderings the fixture can be
 * armed into.
 *
 * `baseline` is the desk as it ships. The two armed renderings are each one
 * thing a real deployment does between a recording and a run:
 *
 * - `relabelled-triage` -- the queue header's triage shortcut was redesigned.
 *   It keeps its place and its job, and loses everything a recording wrote
 *   down about it: its test id, its class and its label, which becomes "Work
 *   the backlog". Import and New ticket stay beside it as the pressable wrong
 *   answers, so re-pointing the click is a judgement rather than a guess at
 *   the only button left.
 * - `recovered-sla` -- the night shift worked through the backlog, so far
 *   fewer tickets are past their response target. Nothing about the page moves;
 *   only the rows a service-level read returns.
 */
export const supportDeskModes = ["baseline", "relabelled-triage", "recovered-sla"] as const;

export type SupportDeskMode = (typeof supportDeskModes)[number];

/** Every priority the desk grants, worst first, spelled as the table and the filters spell them. */
export const ticketPriorities = ["Urgent", "High", "Normal", "Low"] as const;

export type TicketPriority = (typeof ticketPriorities)[number];

/** Every status a ticket passes through. "Pending" is waiting on the requester. */
export const ticketStatuses = ["New", "Open", "Pending", "Resolved"] as const;

export type TicketStatus = (typeof ticketStatuses)[number];

/** The severities the escalation form offers, least to most severe. */
export const escalationSeverities = ["Normal", "Serious", "Critical"] as const;

export type EscalationSeverity = (typeof escalationSeverities)[number];

/** The assignee cell of a ticket nobody has picked up. It is text in the cell like any name. */
export const UNASSIGNED = "Unassigned";

/**
 * One row of the queue. `slaMinutes` is the signed countdown the SLA column is
 * written from: positive is time left, negative is time past the target, and a
 * resolved ticket is neither.
 */
export type SupportTicket = {
  reference: string;
  requester: string;
  requesterEmail: string;
  /** The requester's account, shown on the ticket rather than in the queue. */
  account: string;
  subject: string;
  priority: TicketPriority;
  status: TicketStatus;
  assignee: string;
  ageMinutes: number;
  age: string;
  slaMinutes: number;
};

/** What the toolbar is asking for. An empty string is "any", as each select's first option is. */
export type QueueFilters = { view: string; search: string; priority: string; status: string; assignee: string };

/** One raised escalation, as the escalation log lists it. The requester is resolved from the ticket, never typed. */
export type Escalation = { reference: string; severity: EscalationSeverity; requester: string };

/**
 * What the run left behind. `assignments`, `resolved` and `replies` are the
 * changes the page reported through `mutate`; `oracle` is the queue those
 * changes produce, so a run's final state can be checked without replaying the
 * page's arithmetic.
 */
export type SupportDeskState = {
  mode: SupportDeskMode;
  /** Ticket reference to the agent it was assigned to. */
  assignments: Record<string, string>;
  /** References resolved during the run, oldest first. */
  resolved: string[];
  /** References replied to during the run, oldest first. */
  replies: string[];
  escalations: Escalation[];
  /** Operations the page reported, oldest first, capped. */
  activity: string[];
  oracle: { ticketCount: number; breachingCount: number; unassignedCount: number; awaitingTriageCount: number };
};
