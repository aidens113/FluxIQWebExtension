import { escapeHtml } from "../../html.js";
import { ESCALATIONS_PATH, slaLabel } from "./format.js";
import { DESK_GLYPHS, deskIcon, type DeskClasses } from "./styles.js";
import type { SupportTicket } from "./types.js";

/**
 * The ticket detail pane, docked down the right-hand edge of the queue.
 *
 * Two things about it are the point of the fixture. The pane carries facts the
 * queue does not -- the requester's account, the full untruncated subject and
 * the conversation -- and it is fetched from the desk when a ticket is opened,
 * so those facts are not sitting in the queue's markup waiting to be read.
 * Anything that needs them has to open a ticket. And its Send reply control is
 * disabled until the reply has something in it, so a run that presses Send
 * without composing anything presses a control that cannot fire.
 */

/** One canned reply the desk offers, as the template control lists them. */
export type ReplyTemplate = { value: string; label: string; body: string };

/**
 * The reply templates. `closing-summary` is the one the recorded reply
 * workflow sends, because it is the reply a person sends just before resolving.
 */
export const REPLY_TEMPLATES: readonly ReplyTemplate[] = [
  { value: "holding-reply", label: "Holding reply", body: "Thanks for getting in touch. We have your ticket and someone from the team is looking at it now." },
  { value: "account-access", label: "Account access", body: "We have reset the sign-in for your account. Please try again from a fresh browser window and tell us how you get on." },
  { value: "delivery-chase", label: "Delivery chase", body: "We have asked the carrier to trace this delivery and we will come back to you as soon as they answer." },
  { value: "refund-confirmation", label: "Refund confirmation", body: "The refund has been approved and will show on your statement within five working days." },
  { value: "closing-summary", label: "Closing summary", body: "Here is a summary of what we changed and why. We are closing the ticket now, and replying to this message reopens it." },
];

/** The opening, agent and follow-up lines a thread is built from, chosen by the ticket's own reference. */
const OPENING_LINES = [
  "This started on Friday afternoon and three people here can reproduce it.",
  "We have tried this from two different offices with the same result.",
  "Our finance team needs this sorted before the month closes.",
  "Nothing has changed at our end as far as we can tell.",
] as const;
const AGENT_LINES = [
  "Thanks for the detail. I have reproduced it here and raised it with the team that owns this area.",
  "I can see the same thing on your account. Leaving this with me while I check the logs.",
  "Apologies for the trouble. I have put a temporary workaround in place for you today.",
] as const;
const FOLLOW_UP_LINES = [
  "Any news on this? We are getting asked about it daily.",
  "That workaround helps, thank you. Still keen to have the real fix.",
  "Adding our operations lead to this thread so they can see the answer.",
] as const;

/** The whole pane for one ticket, as the `tickets/<reference>` route serves it. */
export function ticketPaneMarkup(css: DeskClasses, ticket: SupportTicket): string {
  return `<section class="${css.pane}" id="ticket-detail" data-testid="ticket-detail" aria-labelledby="ticket-detail-heading" data-ticket-ref="${ticket.reference}">
<div class="${css.paneHead}">
<h2 id="ticket-detail-heading">${escapeHtml(ticket.subject)}</h2>
<button class="${css.iconButton}" type="button" aria-label="Close ticket">${deskIcon(css.navIcon, DESK_GLYPHS.cross)}</button>
</div>
<div class="${css.paneBody}">
<dl class="${css.definitions}">
${definition("Reference", "reference", ticket.reference)}
${definition("Requester", "requester", `${ticket.requester} (${ticket.requesterEmail})`)}
${definition("Account", "account", ticket.account)}
${definition("Priority", "priority", ticket.priority)}
${definition("Status", "status", ticket.status)}
${definition("Assignee", "assignee", ticket.assignee)}
${definition("Response target", "sla", slaLabel(ticket))}
</dl>
${threadMarkup(css, ticket)}
${composerMarkup(css)}
</div>
<div class="${css.paneFoot}">
<button class="${css.button}" type="button" data-testid="reassign-ticket">Reassign</button>
<button class="${css.button}" type="button" data-testid="tag-ticket">Add tag</button>
<a class="${css.button}" href="${ESCALATIONS_PATH}" data-testid="escalate-ticket">Escalate</a>
<button class="${css.button} ${css.buttonDanger}" type="button" data-testid="resolve-ticket">Resolve</button>
</div>
</section>`;
}

/**
 * The status cell inside the pane is the one detail field with a test id, so a
 * scenario fact can read what a run left the ticket at. Every other field is
 * reachable only the way a person reads it: by the label beside it.
 */
function definition(label: string, field: string, value: string): string {
  const testId = field === "status" ? ` data-testid="detail-status"` : "";
  return `<dt>${escapeHtml(label)}</dt><dd data-field="${field}"${testId}>${escapeHtml(value)}</dd>`;
}

function threadMarkup(css: DeskClasses, ticket: SupportTicket): string {
  const agent = ticket.assignee === "Unassigned" ? "Halo Support" : ticket.assignee;
  const messages = [
    message(css, ticket.requester, ticket.age, `${ticket.subject}. ${pick(OPENING_LINES, ticket.reference)}`),
    message(css, agent, "A little after that", pick(AGENT_LINES, ticket.reference)),
    message(css, ticket.requester, "Most recently", pick(FOLLOW_UP_LINES, ticket.reference)),
  ];
  return `<ul class="${css.thread}" data-testid="ticket-thread" aria-label="Conversation">${messages.join("")}</ul>`;
}

function message(css: DeskClasses, author: string, when: string, body: string): string {
  return `<li class="${css.message}"><p class="${css.messageMeta}">${escapeHtml(author)} · ${escapeHtml(when)}</p>`
    + `<p class="${css.messageBody}">${escapeHtml(body)}</p></li>`;
}

function composerMarkup(css: DeskClasses): string {
  // Each option carries its own body, the way a template picker ships it, so
  // inserting a template needs no second request and the composer's text is
  // exactly what the desk wrote.
  const options = REPLY_TEMPLATES
    .map((template) => `<option value="${template.value}" data-body="${escapeHtml(template.body)}">${escapeHtml(template.label)}</option>`)
    .join("");
  return `<div class="${css.composer}">
<label class="${css.fieldLabel}" for="reply-template">Reply template</label>
<select class="${css.select}" id="reply-template" data-testid="reply-template" name="template"><option value="">Choose a template</option>${options}</select>
<button class="${css.button}" type="button" data-testid="insert-template">Insert template</button>
<label class="${css.fieldLabel}" for="reply-body">Reply</label>
<textarea class="${css.textarea}" id="reply-body" data-testid="reply-body" name="reply"></textarea>
<p class="${css.hint}">Send reply stays off until the reply has something in it.</p>
<button class="${css.button} ${css.buttonPrimary}" type="button" data-testid="send-reply" disabled>Send reply</button>
</div>`;
}

/** Which of a line pool a ticket gets: fixed by its own reference, so a thread reads the same on every run. */
function pick(lines: readonly string[], reference: string): string {
  const digits = Number(reference.replace(/\D/gu, "")) || 0;
  return lines[digits % lines.length] ?? lines[0] ?? "";
}
