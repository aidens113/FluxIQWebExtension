import { isBreaching } from "./format.js";
import { recoveredSlaTickets, supportAgents, supportTickets } from "./tickets.js";
import { inView } from "./views.js";
import { UNASSIGNED, type SupportDeskMode, type SupportTicket } from "./types.js";

/** The queue a rendering shows. Only `recovered-sla` changes it, and only by how many tickets are past target. */
export function ticketsFor(mode: SupportDeskMode): readonly SupportTicket[] {
  return mode === "recovered-sla" ? recoveredSlaTickets : supportTickets;
}

/**
 * The queue after a run's own changes, so every count and every cell is what
 * the page would now show. Assigning writes the agent into the assignee cell;
 * resolving writes the status and stops the countdown, which is why a resolved
 * ticket can never be breaching.
 */
export function applyDeskChanges(
  tickets: readonly SupportTicket[],
  assignments: Readonly<Record<string, string>>,
  resolved: readonly string[],
): SupportTicket[] {
  const closed = new Set(resolved);
  return tickets.map((ticket) => {
    const assignee = assignments[ticket.reference] ?? ticket.assignee;
    const status = closed.has(ticket.reference) ? "Resolved" : ticket.status;
    return assignee === ticket.assignee && status === ticket.status ? ticket : { ...ticket, assignee, status };
  });
}

/** What the queue header counts: the desk, what is past target, what nobody owns, and what triage is waiting on. */
export function queueCounts(tickets: readonly SupportTicket[]): {
  ticketCount: number;
  breachingCount: number;
  unassignedCount: number;
  awaitingTriageCount: number;
} {
  return {
    ticketCount: tickets.length,
    breachingCount: tickets.filter((ticket) => isBreaching(ticket)).length,
    unassignedCount: tickets.filter((ticket) => ticket.assignee === UNASSIGNED).length,
    awaitingTriageCount: tickets.filter((ticket) => inView(ticket, "unassigned-priority")).length,
  };
}

/** The header stat line, which is also the oracle a final-state fact reads. */
export function queueSummaryText(tickets: readonly SupportTicket[]): string {
  const { ticketCount, breachingCount, unassignedCount } = queueCounts(tickets);
  return `${ticketCount} tickets \u00b7 ${breachingCount} breaching \u00b7 ${unassignedCount} unassigned`;
}

/**
 * The triage line under the header: how much of the backlog nobody owns and
 * cannot wait. It is the one oracle a triage run is judged on that says nothing
 * about *how* the tickets were assigned, only that none are left.
 */
export function triageSummaryText(tickets: readonly SupportTicket[]): string {
  const { awaitingTriageCount } = queueCounts(tickets);
  return awaitingTriageCount === 1
    ? "1 unassigned ticket is urgent or high priority"
    : `${awaitingTriageCount} unassigned tickets are urgent or high priority`;
}

/**
 * The workload strip: how many open tickets each agent is carrying, in the
 * order the assignment controls list them. A triage run moves work onto one
 * named agent, so this line says who received it -- assigning the same tickets
 * to somebody else clears the triage line and fails this one.
 */
export function workloadText(tickets: readonly SupportTicket[]): string {
  return supportAgents
    .map((agent) => `${agent} ${tickets.filter((ticket) => ticket.assignee === agent && ticket.status !== "Resolved").length}`)
    .join(" \u00b7 ");
}

export function resultCountText(shown: number, total: number): string {
  return `Showing ${shown} of ${total} tickets`;
}

/**
 * The ticket that has been past its response target the longest: the one an
 * escalation is raised against. Ties go to the earlier reference, so the answer
 * is a single ticket whatever order the queue happens to be sorted in.
 */
export function longestBreachingTicket(tickets: readonly SupportTicket[]): SupportTicket {
  const worst = tickets
    .filter((ticket) => isBreaching(ticket))
    .sort((left, right) => left.slaMinutes - right.slaMinutes || (left.reference < right.reference ? -1 : 1))[0];
  if (!worst) throw new Error("The support desk queue has no ticket past its response target");
  return worst;
}
