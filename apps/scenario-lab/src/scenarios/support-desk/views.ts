import { isBreaching } from "./format.js";
import { supportAgents } from "./tickets.js";
import { UNASSIGNED, ticketPriorities, ticketStatuses, type QueueFilters, type SupportTicket } from "./types.js";

/** One option of a queue control: the value the control carries, and the label a person reads. */
export type QueueOption = { value: string; label: string };

/**
 * The saved views the desk ships with, as the view control offers them. A view
 * is a question about the queue rather than a setting of the three selects:
 * "Unassigned, urgent and high" spans two priorities at once, and "Breaching
 * SLA" asks about a countdown that no select exposes. That is on purpose --
 * a view a run could reach by setting the selects instead would test nothing
 * the selects do not already.
 */
export const SAVED_VIEWS: readonly QueueOption[] = [
  { value: "all", label: "All tickets" },
  { value: "unassigned-priority", label: "Unassigned, urgent and high" },
  { value: "breaching", label: "Breaching SLA" },
  { value: "waiting-on-us", label: "Waiting on us" },
  { value: "resolved", label: "Resolved" },
];

export const PRIORITY_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "Any priority" },
  ...ticketPriorities.map((priority) => ({ value: priority.toLowerCase(), label: priority })),
];

export const STATUS_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "Any status" },
  ...ticketStatuses.map((status) => ({ value: status.toLowerCase(), label: status })),
];

export const ASSIGNEE_OPTIONS: readonly QueueOption[] = [
  { value: "", label: "Anyone" },
  { value: "unassigned", label: UNASSIGNED },
  ...supportAgents.map((agent) => ({ value: slug(agent), label: agent })),
];

/** The filters the queue opens on: the whole desk, nothing narrowed. */
export function defaultQueueFilters(): QueueFilters {
  return { view: "all", search: "", priority: "", status: "", assignee: "" };
}

/** A person's name as a control value: `Priya Raman` becomes `priya-raman`. */
export function slug(name: string): string {
  return name.toLowerCase().replaceAll(" ", "-");
}

/** Whether a ticket belongs to a saved view. An unknown view is "all", as a stale saved link would be. */
export function inView(ticket: SupportTicket, view: string): boolean {
  // A resolved ticket is nobody's to pick up, however urgent it once was, so
  // it is not backlog. Without this the triage view would ask a run to assign
  // work that is already finished.
  if (view === "unassigned-priority") {
    return ticket.assignee === UNASSIGNED && ticket.status !== "Resolved" && (ticket.priority === "Urgent" || ticket.priority === "High");
  }
  if (view === "breaching") return isBreaching(ticket);
  if (view === "waiting-on-us") return ticket.status === "New" || ticket.status === "Open";
  if (view === "resolved") return ticket.status === "Resolved";
  return true;
}

/**
 * The rows a view and the three selects leave. Search matches a reference, a
 * requester's name, their address or the subject, the way a desk's own search
 * box does; each select matches its label exactly, and an empty one is "any".
 */
export function filterTickets(tickets: readonly SupportTicket[], filters: QueueFilters): SupportTicket[] {
  const needle = filters.search.trim().toLowerCase();
  const priority = labelFor(PRIORITY_OPTIONS, filters.priority);
  const status = labelFor(STATUS_OPTIONS, filters.status);
  const assignee = labelFor(ASSIGNEE_OPTIONS, filters.assignee);
  return tickets.filter((ticket) =>
    inView(ticket, filters.view)
    && (needle === "" || matchesSearch(ticket, needle))
    && (priority === undefined || ticket.priority === priority)
    && (status === undefined || ticket.status === status)
    && (assignee === undefined || ticket.assignee === assignee));
}

function matchesSearch(ticket: SupportTicket, needle: string): boolean {
  return [ticket.reference, ticket.requester, ticket.requesterEmail, ticket.subject]
    .some((field) => field.toLowerCase().includes(needle));
}

function labelFor(options: readonly QueueOption[], value: string): string | undefined {
  if (value === "") return undefined;
  return options.find((option) => option.value === value)?.label;
}
