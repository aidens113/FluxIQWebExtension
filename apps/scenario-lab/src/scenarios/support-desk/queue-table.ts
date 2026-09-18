import { escapeHtml } from "../../html.js";
import { isBreaching, slaLabel } from "./format.js";
import { listedSubject } from "./tickets.js";
import { ASSIGNEE_OPTIONS, PRIORITY_OPTIONS, SAVED_VIEWS, STATUS_OPTIONS, type QueueOption } from "./views.js";
import { DESK_GLYPHS, deskIcon, type DeskClasses } from "./styles.js";
import type { SupportTicket } from "./types.js";

/**
 * The queue's filter toolbar. Its search field is labelled "Search", which is
 * also the accessible name of the top bar's own search input: two controls on
 * the page, one name, and nothing but their surroundings to tell them apart.
 */
export function queueToolbarMarkup(css: DeskClasses): string {
  return `<div class="${css.toolbar}">
<span class="${css.field}"><label class="${css.fieldLabel}" for="saved-view">Saved view</label>${select(css, "saved-view", "view", SAVED_VIEWS)}</span>
<label class="${css.srOnly}" for="ticket-search">Search</label>
<input class="${css.input}" id="ticket-search" data-testid="ticket-search" type="search" name="q" autocomplete="off" placeholder="Search tickets">
<span class="${css.field}"><label class="${css.fieldLabel}" for="priority-filter">Priority</label>${select(css, "priority-filter", "priority", PRIORITY_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="status-filter">Status</label>${select(css, "status-filter", "status", STATUS_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="assignee-filter">Assignee</label>${select(css, "assignee-filter", "assignee", ASSIGNEE_OPTIONS)}</span>
<button class="${css.button}" type="button" data-action="save-view">Save view</button>
<button class="${css.iconButton}" type="button" title="Table settings" data-action="table-settings">${deskIcon(css.navIcon, DESK_GLYPHS.sliders)}</button>
</div>`;
}

/**
 * The queue table: one row per ticket, and one action button per row identical
 * to the other 319.
 *
 * The accessibility of the controls in here is deliberately uneven, because a
 * shipped queue is. The header checkbox names the whole view, so it can be told
 * from everything else; a row's own checkbox carries the design system's
 * constant label, "Select ticket", on every row, and the row's overflow button
 * carries "More actions" on every row, so neither can be told from the other
 * 319 by name. What separates one from another is the row it sits in.
 *
 * The subject button is the way into a ticket, and every one of them declares
 * the same `aria-controls`, because they all open the one detail region.
 */
export function queueTableMarkup(css: DeskClasses, tickets: readonly SupportTicket[]): string {
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell} ${css.checkCell}" scope="col"><input type="checkbox" aria-label="Select every ticket in this view"></th>
<th class="${css.headCell}" scope="col">Ticket</th>
<th class="${css.headCell}" scope="col">Requester</th>
<th class="${css.headCell}" scope="col">Subject</th>
<th class="${css.headCell}" scope="col">Priority</th>
<th class="${css.headCell}" scope="col">Status</th>
<th class="${css.headCell}" scope="col">Assignee</th>
${sortableHeader(css, "Age", "age")}
${sortableHeader(css, "SLA", "sla")}
<th class="${css.headCell} ${css.actionCell}" scope="col"><span class="${css.srOnly}">Actions</span></th>
</tr></thead>
<tbody data-testid="ticket-rows">${tickets.map((ticket) => ticketRow(css, ticket)).join("")}</tbody>
</table>`;
}

/** The row the table shows when a view and its filters leave nothing. */
export function emptyQueueRowMarkup(css: DeskClasses): string {
  return `<tr><td class="${css.empty}" colspan="10">No tickets match this view.</td></tr>`;
}

/**
 * One row. The line break inside the requester cell is load-bearing: a column
 * read of that cell is its whole text with whitespace collapsed, so without it
 * the name and the address would run together into one word.
 */
function ticketRow(css: DeskClasses, ticket: SupportTicket): string {
  return `<tr class="${css.row}" data-ticket-ref="${ticket.reference}">
<td class="${css.cell} ${css.checkCell}"><input type="checkbox" value="${ticket.reference}" aria-label="Select ticket"></td>
<td class="${css.cell}">${ticket.reference}</td>
<td class="${css.cell}"><span class="${css.requesterName}">${escapeHtml(ticket.requester)}</span>
<span class="${css.requesterEmail}">${escapeHtml(ticket.requesterEmail)}</span></td>
<td class="${css.cell}"><button class="${css.subjectButton}" type="button" aria-controls="ticket-detail" title="${escapeHtml(ticket.subject)}">${escapeHtml(listedSubject(ticket))}</button></td>
<td class="${css.cell}"><span class="${css.badge} ${priorityClass(css, ticket)}">${ticket.priority}</span></td>
<td class="${css.cell}"><span class="${css.badge} ${css.badgeStatus}">${ticket.status}</span></td>
<td class="${css.cell}">${escapeHtml(ticket.assignee)}</td>
<td class="${css.cell}" data-minutes="${ticket.ageMinutes}">${escapeHtml(ticket.age)}</td>
<td class="${css.cell}"><span class="${isBreaching(ticket) ? css.slaBreached : css.slaDue}">${escapeHtml(slaLabel(ticket))}</span></td>
<td class="${css.cell} ${css.actionCell}"><button class="${css.iconButton}" type="button" aria-label="More actions" aria-haspopup="menu" aria-expanded="false">${deskIcon(css.navIcon, DESK_GLYPHS.overflow)}</button></td>
</tr>`;
}

function priorityClass(css: DeskClasses, ticket: SupportTicket): string {
  if (ticket.priority === "Urgent") return css.badgeUrgent;
  if (ticket.priority === "High") return css.badgeHigh;
  return ticket.priority === "Low" ? css.badgeLow : css.badgeNormal;
}

function sortableHeader(css: DeskClasses, label: string, column: string): string {
  return `<th class="${css.headCell}" scope="col"><button class="${css.sortButton}" type="button" data-sort="${column}">${label}</button></th>`;
}

/** A select the toolbar owns. Its `id` is what the label points at; its `name` is the stable thing about it. */
function select(css: DeskClasses, id: string, name: string, options: readonly QueueOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<select class="${css.select}" id="${id}" data-testid="${id}" name="${name}">${rendered}</select>`;
}
