import { escapeHtml } from "../../html.js";
import { accountById } from "./accounts.js";
import { accountPath, excerptOf, postPath, relativeText, slotText } from "./format.js";
import { ACCOUNT_OPTIONS, RANGE_OPTIONS, STATUS_OPTIONS, type QueueOption } from "./options.js";
import type { SchedulerClasses } from "./styles.js";
import type { PostStatus, QueuedPost, SchedulerMode } from "./types.js";

/** The design system's two glyphs used in the queue: a download tray, and the overflow dots every row carries. */
const EXPORT_GLYPH = `<path d="M8 2v8m0 0L5 7m3 3l3-3M3 13h10" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
const OVERFLOW_GLYPH = `<path d="M4 8h.01M8 8h.01M12 8h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;

/** The one sort the queue offers, named in the table footer under the last row. */
export const SORT_STATUS_TEXT = "Sorted by Scheduled time";

/**
 * The queue's columns, by the header text a person reads. The console shipped
 * a column reorder once, which is what `reordered-columns` renders: the same
 * four columns, the same cells, in a different order. A read that follows the
 * header survives it; a read that counts cells does not.
 */
const COLUMN_ORDER: Readonly<Record<"baseline" | "reordered", readonly ColumnKey[]>> = {
  baseline: ["Post", "Account", "Scheduled", "Status"],
  reordered: ["Status", "Account", "Post", "Scheduled"],
};

type ColumnKey = "Post" | "Account" | "Scheduled" | "Status";

/**
 * The publishing queue: 280 rows, each one a post, and one action button per
 * row that is identical to the other 279.
 *
 * The accessibility of the controls in here is deliberately uneven, because
 * that is how a shipped table is. A row's checkbox names the slot it is for,
 * so it can be told from the other 279. The row's action button carries the
 * constant label the design system passes -- "Post actions", on every row --
 * so it cannot: the only thing separating one from another is the row it is
 * in. The last header cell names its column for a screen reader and shows
 * nothing.
 */
export function queueTableMarkup(css: SchedulerClasses, posts: readonly QueuedPost[], mode: SchedulerMode): string {
  const columns = columnsFor(mode);
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell} ${css.checkCell}" scope="col"><input type="checkbox" aria-label="Select all posts"></th>
${columns.map((column) => `<th class="${css.headCell}" scope="col">${column}</th>`).join("")}
<th class="${css.headCell} ${css.actionCell}" scope="col"><span class="${css.srOnly}">Actions</span></th>
</tr></thead>
<tbody data-testid="queue-rows">${posts.map((post) => queueRow(css, post, columns)).join("")}</tbody>
</table>`;
}

/**
 * One row on its own, which the `rows/<id>` route serves after the composer
 * schedules a post. The page inserts what the server rendered rather than
 * building a row of its own, so a row added during a run is the same markup as
 * a row that was there when the page loaded.
 */
export function queueRowMarkup(css: SchedulerClasses, post: QueuedPost, mode: SchedulerMode): string {
  return queueRow(css, post, columnsFor(mode));
}

function columnsFor(mode: SchedulerMode): readonly ColumnKey[] {
  return COLUMN_ORDER[mode === "reordered-columns" ? "reordered" : "baseline"];
}

/**
 * The filter toolbar. The search field's label is "Search" -- the same
 * accessible name the top bar's own search input has, so neither can be told
 * from the other by its name alone.
 */
export function toolbarMarkup(css: SchedulerClasses): string {
  return `<div class="${css.toolbar}">
<label class="${css.srOnly}" for="queue-search">Search</label>
<input class="${css.input}" id="queue-search" data-testid="queue-search" type="search" name="q" autocomplete="off" placeholder="Search posts and accounts">
<span class="${css.field}"><label class="${css.fieldLabel}" for="account-filter">Account</label>${select(css, "account-filter", "account", ACCOUNT_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="status-filter">Status</label>${select(css, "status-filter", "status", STATUS_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="range-filter">When</label>${select(css, "range-filter", "range", RANGE_OPTIONS)}</span>
<button class="${css.iconButton}" type="button" title="Export queue" data-action="export"><svg class="${css.navIcon}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${EXPORT_GLYPH}</svg></button>
</div>`;
}

/** A select the toolbar owns. Its `id` is hashed by the design system; its `name` is the stable thing about it. */
function select(css: SchedulerClasses, id: string, name: string, options: readonly QueueOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<select class="${css.select}" id="${id}" data-testid="${id}" name="${name}">${rendered}</select>`;
}

/**
 * One row. The line breaks inside a cell are load-bearing: a column read is
 * the cell's whole text with whitespace collapsed, so without them the avatar
 * letters, the account name and the handle would run together into one word.
 * With them, a reader gets what a person sees -- initials included, because an
 * initials avatar is text like any other.
 */
function queueRow(css: SchedulerClasses, post: QueuedPost, columns: readonly ColumnKey[]): string {
  const slot = slotText(post.offsetMinutes);
  return `<tr class="${css.row}" data-post-id="${post.id}" data-account="${accountById(post.accountId).slug}" data-offset="${post.offsetMinutes}">
<td class="${css.cell} ${css.checkCell}"><input type="checkbox" value="${post.id}" aria-label="Select the post for ${escapeHtml(slot)}"></td>
${columns.map((column) => cell(css, post, column)).join("")}
<td class="${css.cell} ${css.actionCell}"><button class="${css.iconButton}" type="button" aria-label="Post actions" aria-haspopup="menu" aria-expanded="false"><svg class="${css.navIcon}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${OVERFLOW_GLYPH}</svg></button></td>
</tr>`;
}

function cell(css: SchedulerClasses, post: QueuedPost, column: ColumnKey): string {
  if (column === "Post") return postCellMarkup(css, post);
  if (column === "Account") return accountCellMarkup(css, post);
  if (column === "Scheduled") return scheduledCellMarkup(css, post);
  return `<td class="${css.cell}"><span class="${css.badge} ${statusClass(css, post.status)}">${post.status}</span></td>`;
}

/**
 * The post cell: the first words of the post, cut at a word boundary, linking
 * to the post's own page, and a chip for the link it carries. The whole post
 * is in the `title`, exactly as a shipped console keeps it.
 */
function postCellMarkup(css: SchedulerClasses, post: QueuedPost): string {
  const chip = post.link === "" ? "" : `\n<span class="${css.linkChip}">${escapeHtml(post.link)}</span>`;
  return `<td class="${css.cell} ${css.postCell}"><a class="${css.postExcerpt}" href="${postPath(post)}" title="${escapeHtml(post.body)}">${escapeHtml(excerptOf(post.body))}</a>${chip}</td>`;
}

function accountCellMarkup(css: SchedulerClasses, post: QueuedPost): string {
  const account = accountById(post.accountId);
  return `<td class="${css.cell}"><span class="${css.accountCell}"><span class="${css.avatar}" aria-hidden="true">${escapeHtml(account.initials)}</span>
<span><span class="${css.accountName}">${escapeHtml(account.display)}</span>
<a class="${css.accountHandle}" href="${accountPath(account)}">${escapeHtml(account.network)} · ${escapeHtml(account.handle)}</a></span></span></td>`;
}

function scheduledCellMarkup(css: SchedulerClasses, post: QueuedPost): string {
  return `<td class="${css.cell}"><span class="${css.slotPrimary}">${escapeHtml(relativeText(post.offsetMinutes))}</span>
<span class="${css.slotSecondary}">${escapeHtml(slotText(post.offsetMinutes))}</span></td>`;
}

function statusClass(css: SchedulerClasses, status: PostStatus): string {
  if (status === "Draft") return css.badgeDraft;
  if (status === "Published") return css.badgePublished;
  if (status === "Failed") return css.badgeFailed;
  return status === "Queued" ? css.badgeQueued : css.badgeScheduled;
}
