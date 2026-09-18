import type { SupportTicket } from "./types.js";

/** The queue's own page. Links are written root-relative, so their text is the same on every run's port. */
export const SUPPORT_DESK_ROOT = "/scenarios/support-desk/";

/** The escalations screen, a document of its own served by the `route` hook. */
export const ESCALATIONS_PATH = `${SUPPORT_DESK_ROOT}escalations`;

/**
 * How many characters of a subject the queue shows before it clips. A real
 * queue clips in CSS, which leaves the whole subject in the DOM and makes the
 * truncation invisible to a reader; this one clips in the markup, which is the
 * harder and more honest case: what the column holds is what a person sees,
 * ellipsis included, and the full subject is only on the ticket itself.
 */
const SUBJECT_WIDTH = 44;

/** The subject as the queue column shows it: clipped on a word boundary, with an ellipsis. */
export function truncateSubject(subject: string): string {
  if (subject.length <= SUBJECT_WIDTH) return subject;
  const clipped = subject.slice(0, SUBJECT_WIDTH);
  const lastSpace = clipped.lastIndexOf(" ");
  return `${(lastSpace > SUBJECT_WIDTH - 12 ? clipped.slice(0, lastSpace) : clipped).trimEnd()}\u2026`;
}

/** `3h 20m`, `45m`, `2d 4h`: the desk's own way of writing a span of time. */
export function durationLabel(minutes: number): string {
  const total = Math.max(0, Math.round(minutes));
  if (total < 60) return `${total}m`;
  if (total < 1_440) {
    const hours = Math.floor(total / 60);
    const rest = total % 60;
    return rest === 0 ? `${hours}h` : `${hours}h ${rest}m`;
  }
  const days = Math.floor(total / 1_440);
  const hours = Math.floor((total % 1_440) / 60);
  return hours === 0 ? `${days}d` : `${days}d ${hours}h`;
}

/**
 * The SLA column's text for a ticket. A resolved ticket has no countdown left
 * to run, so it reads "Met" rather than a negative one; everything else is
 * either time remaining or time already lost. Callers pass the ticket as the
 * run has left it, so resolving one changes this text without changing the
 * authored queue.
 */
export function slaLabel(ticket: SupportTicket): string {
  if (ticket.status === "Resolved") return "Met";
  return ticket.slaMinutes < 0 ? `Breached ${durationLabel(-ticket.slaMinutes)} ago` : `Due in ${durationLabel(ticket.slaMinutes)}`;
}

/** Whether a ticket is past its response target: never a resolved one, whose countdown has stopped. */
export function isBreaching(ticket: SupportTicket): boolean {
  return ticket.status !== "Resolved" && ticket.slaMinutes < 0;
}
