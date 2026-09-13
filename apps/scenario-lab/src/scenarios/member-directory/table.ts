import { escapeHtml } from "../../html.js";
import { ROLE_OPTIONS, STATUS_OPTIONS, type FilterOption } from "./options.js";
import type { DirectoryClasses } from "./styles.js";
import type { DirectoryMember, DirectoryMode } from "./types.js";

/** The design system's two glyphs used in the table: a settings bar stack, and the overflow dots every row carries. */
const SETTINGS_GLYPH = `<path d="M2 4h12M2 8h12M2 12h12" fill="none" stroke="currentColor" stroke-width="1.4"/>`;
const OVERFLOW_GLYPH = `<path d="M4 8h.01M8 8h.01M12 8h.01" fill="none" stroke="currentColor" stroke-width="2.4" stroke-linecap="round"/>`;

/**
 * The members table: 240 rows, each one a person, and one action button per
 * row that is identical to the other 239.
 *
 * The accessibility of the controls in here is deliberately uneven, because
 * that is how a shipped table is. A row's checkbox carries the member's name,
 * so it can be told from the other 239. The row's action button carries the
 * constant label the design system passes -- "Row actions", on every row -- so
 * it cannot: the only thing separating one from another is the row it is in.
 * The last header cell names its column for a screen reader and shows nothing.
 */
export function memberTableMarkup(css: DirectoryClasses, members: readonly DirectoryMember[], mode: DirectoryMode): string {
  const sortedColumn = mode === "sorted-by-activity" ? "activity" : "name";
  return `<table class="${css.table}">
<thead><tr>
<th class="${css.headCell} ${css.checkCell}" scope="col"><input type="checkbox" aria-label="Select all members"></th>
${sortableHeader(css, "Member", "name", sortedColumn)}
<th class="${css.headCell}" scope="col">Role</th>
<th class="${css.headCell}" scope="col">Team</th>
<th class="${css.headCell}" scope="col">Status</th>
${sortableHeader(css, "Last active", "activity", sortedColumn)}
<th class="${css.headCell} ${css.actionCell}" scope="col"><span class="${css.srOnly}">Actions</span></th>
</tr></thead>
<tbody data-testid="member-rows">${members.map((member) => memberRow(css, member)).join("")}</tbody>
</table>`;
}

/** The filter toolbar. The search field's label is "Search" -- the same accessible name the top bar's own search input has. */
export function toolbarMarkup(css: DirectoryClasses): string {
  return `<div class="${css.toolbar}">
<label class="${css.srOnly}" for="member-search">Search</label>
<input class="${css.input}" id="member-search" data-testid="member-search" type="search" name="q" autocomplete="off" placeholder="Search members">
<span class="${css.field}"><label class="${css.fieldLabel}" for="role-filter">Role</label>${select(css, "role-filter", "role", ROLE_OPTIONS)}</span>
<span class="${css.field}"><label class="${css.fieldLabel}" for="status-filter">Status</label>${select(css, "status-filter", "status", STATUS_OPTIONS)}</span>
<button class="${css.button}" type="button" data-action="save-view">Save view</button>
<button class="${css.iconButton}" type="button" title="Table settings" data-action="table-settings"><svg class="${css.navIcon}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${SETTINGS_GLYPH}</svg></button>
</div>`;
}

/** A select the toolbar owns. Its `id` is hashed by the design system; its `name` is the stable thing about it. */
function select(css: DirectoryClasses, id: string, name: string, options: readonly FilterOption[]): string {
  const rendered = options.map((option) => `<option value="${option.value}">${escapeHtml(option.label)}</option>`).join("");
  return `<select class="${css.select}" id="${id}" data-testid="${id}" name="${name}">${rendered}</select>`;
}

function sortableHeader(css: DirectoryClasses, label: string, column: string, sortedColumn: string): string {
  const sorted = column === sortedColumn ? ` aria-sort="ascending"` : "";
  return `<th class="${css.headCell}" scope="col"${sorted}><button class="${css.sortButton}" type="button" data-sort="${column}">${escapeHtml(label)}</button></th>`;
}

/**
 * One row. The line breaks inside the person cell are load-bearing: a column
 * read of that cell is its whole text with whitespace collapsed, so without
 * them the avatar initials, the name and the address would run together into
 * one word. With them, a reader gets what a person sees -- initials included,
 * because an initials avatar is text like any other.
 */
function memberRow(css: DirectoryClasses, member: DirectoryMember): string {
  return `<tr class="${css.row}" data-member-id="${member.id}">
<td class="${css.cell} ${css.checkCell}"><input type="checkbox" value="${member.id}" aria-label="Select ${escapeHtml(member.name)}"></td>
<td class="${css.cell}"><span class="${css.person}"><span class="${css.avatar}" aria-hidden="true">${escapeHtml(member.initials)}</span>
<span><span class="${css.personName}">${escapeHtml(member.name)}</span>
<span class="${css.personEmail}">${escapeHtml(member.email)}</span></span></span></td>
<td class="${css.cell}">${escapeHtml(member.role)}</td>
<td class="${css.cell}">${escapeHtml(member.team)}</td>
<td class="${css.cell}"><span class="${css.badge} ${statusClass(css, member.status)}">${member.status}</span></td>
<td class="${css.cell}" data-minutes="${member.activeMinutes}">${escapeHtml(member.lastActive)}</td>
<td class="${css.cell} ${css.actionCell}"><button class="${css.iconButton}" type="button" aria-label="Row actions" aria-haspopup="menu" aria-expanded="false"><svg class="${css.navIcon}" viewBox="0 0 16 16" aria-hidden="true" focusable="false">${OVERFLOW_GLYPH}</svg></button></td>
</tr>`;
}

function statusClass(css: DirectoryClasses, status: DirectoryMember["status"]): string {
  if (status === "Invited") return css.badgeInvited;
  return status === "Suspended" ? css.badgeSuspended : css.badgeActive;
}
