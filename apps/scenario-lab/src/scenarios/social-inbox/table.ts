import { escapeHtml } from "../../html.js";
import { inboxAccountById } from "./accounts.js";
import { ageText, assigneeCellText, conversationPath, messageExcerpt, receivedText } from "./format.js";
import { INBOX_ACCOUNT_OPTIONS, INBOX_AGE_OPTIONS, INBOX_KIND_OPTIONS, INBOX_STATUS_OPTIONS, type InboxOption } from "./options.js";
import type { InboxClasses } from "./styles.js";
import type { Conversation, ConversationStatus } from "./types.js";

/** The design system's glyph for the toolbar's saved-view control. */
const VIEWS_GLYPH = `<path d="M2 4h12M4 8h8M6 12h4" fill="none" stroke="currentColor" stroke-width="1.4"/>`;

/** The columns, by the header text a person reads. The cells follow this order and nothing else decides it. */
const COLUMNS = ["From", "Account", "Kind", "Age", "Status", "Assigned", "Message"] as const;

/**
 * The conversations table: whatever is loaded, and three controls on every row
 * that are identical to the three on every other row.
 *
 * The accessibility of the controls in here is deliberately uneven, because
 * that is how a shipped inbox is. A row's checkbox names the person it came
 * from -- which narrows it to that person's three or four conversations and no
 * further, because people write more than once. The row's Reply, Mark handled
 * and Assign carry the constant labels the design system passes, so on a
 * screen of twenty-five rows there are twenty-five controls called "Reply" and
 * only the row tells them apart. The last header cell names its column for a
 * screen reader and shows nothing.
 */
export function inboxTableMarkup(css: InboxClasses, conversations: readonly Conversation[]): string {
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell} ${css.checkCell}" scope="col"><input type="checkbox" aria-label="Select everything loaded"></th>
${COLUMNS.map((column) => `<th class="${css.headCell}" scope="col">${column}</th>`).join("")}
<th class="${css.headCell} ${css.actionCell}" scope="col"><span class="${css.srOnly}">Actions</span></th>
</tr></thead>
<tbody data-testid="inbox-rows">${inboxRowsMarkup(css, conversations)}</tbody>
</table>`;
}

/**
 * Just the rows, which is what the `items` route serves. Loading older
 * conversations appends what comes back, so every row already on screen keeps
 * the element it had and a read takes each conversation exactly once.
 */
export function inboxRowsMarkup(css: InboxClasses, conversations: readonly Conversation[]): string {
  if (conversations.length === 0) return emptyRowMarkup(css);
  return conversations.map((conversation) => conversationRow(css, conversation)).join("");
}

/** The control that brings the next page. It is removed, not disabled, once there is nothing older. */
export function loadControlMarkup(css: InboxClasses): string {
  return `<button class="${css.loadMore}" type="button" data-testid="load-older">Load older conversations</button>`;
}

/** The empty state, which an inbox reaches often: a filter that nothing is waiting behind. */
export function emptyRowMarkup(css: InboxClasses): string {
  return `<tr><td class="${css.empty}" colspan="${COLUMNS.length + 2}">Nothing here. Everything matching these filters has been dealt with.</td></tr>`;
}

/**
 * The filter toolbar. The search field's label is "Search" -- the same
 * accessible name the top bar's own search input has, so neither can be told
 * from the other by its name alone.
 */
export function inboxToolbarMarkup(css: InboxClasses): string {
  return `<div class="${css.toolbar}">
<label class="${css.srOnly}" for="inbox-search">Search</label>
<input class="${css.input}" id="inbox-search" data-testid="inbox-search" type="search" name="q" autocomplete="off" placeholder="Search people and messages">
<span class="${css.field}"><label class="${css.fieldLabel}" for="account-filter">Account</label>${select(css, "account-filter", "account", INBOX_ACCOUNT_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="kind-filter">Kind</label>${select(css, "kind-filter", "kind", INBOX_KIND_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="status-filter">Status</label>${select(css, "status-filter", "status", INBOX_STATUS_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="age-filter">Age</label>${select(css, "age-filter", "age", INBOX_AGE_OPTIONS)}</span>
<button class="${css.iconButton}" type="button" title="Saved views" data-action="views"><svg class="${css.navIcon}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${VIEWS_GLYPH}</svg></button>
</div>`;
}

/** A select the toolbar owns. Its `id` is hashed by the design system; its `name` is the stable thing about it. */
function select(css: InboxClasses, id: string, name: string, options: readonly InboxOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<select class="${css.select}" id="${id}" data-testid="${id}" name="${name}">${rendered}</select>`;
}

/**
 * One row. The line breaks inside a cell are load-bearing: a column read is
 * the cell's whole text with whitespace collapsed, so without them the avatar
 * letters, the name and the handle would run together into one word. With
 * them, a reader gets what a person sees -- initials included, because an
 * initials avatar is text like any other.
 */
function conversationRow(css: InboxClasses, conversation: Conversation): string {
  const account = inboxAccountById(conversation.accountId);
  const path = conversationPath(conversation.id);
  return `<tr class="${css.row}" data-conversation-id="${conversation.id}" data-account="${account.slug}" data-age="${conversation.ageMinutes}">
<td class="${css.cell} ${css.checkCell}"><input type="checkbox" value="${conversation.id}" aria-label="Select the message from ${escapeHtml(conversation.author.name)}"></td>
<td class="${css.cell}"><span class="${css.person}"><span class="${css.avatar}" aria-hidden="true">${escapeHtml(conversation.author.initials)}</span>
<span><a class="${css.personName}" href="${path}">${escapeHtml(conversation.author.name)}</a>
<span class="${css.personHandle}">${escapeHtml(conversation.author.handle)}</span></span></span></td>
<td class="${css.cell}"><span class="${css.accountName}">${escapeHtml(account.display)}</span>
<span class="${css.accountHandle}">${escapeHtml(account.network)} · ${escapeHtml(account.handle)}</span></td>
<td class="${css.cell}"><span class="${css.kindTag}">${conversation.kind}</span></td>
<td class="${css.cell}" title="${escapeHtml(receivedText(conversation.ageMinutes))}">${ageText(conversation.ageMinutes)}</td>
<td class="${css.cell}"><span class="${css.badge} ${statusClass(css, conversation.status)}">${conversation.status}</span></td>
<td class="${css.cell}">${escapeHtml(assigneeCellText(conversation))}</td>
<td class="${css.cell} ${css.messageCell}"><a class="${css.messageText}" href="${path}" title="${escapeHtml(conversation.message)}">${escapeHtml(messageExcerpt(conversation.message))}</a></td>
<td class="${css.cell} ${css.actionCell}"><button class="${css.rowAction}" type="button" aria-haspopup="dialog" data-action="reply">Reply</button><button class="${css.rowAction}" type="button" data-action="handle">Mark handled</button><button class="${css.rowAction}" type="button" aria-haspopup="menu" aria-expanded="false" data-action="assign">Assign</button></td>
</tr>`;
}

function statusClass(css: InboxClasses, status: ConversationStatus): string {
  if (status === "Handled") return css.badgeHandled;
  return status === "Assigned" ? css.badgeAssigned : css.badgeUnanswered;
}
