import { escapeHtml } from "../../../html.js";
import { renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import { managerClientScript } from "./manager-client.js";
import { INVITATION_PAGE_SIZE, pendingReceived, pendingSent, receivedRowMarkup, SENT_TYPES, sentRowMarkup, type SentRowData } from "./rows.js";

/** What the Show more endpoint answers: further rows after `after`, and whether any remain. */
export type SentFragment = { html: string; rows: Record<string, SentRowData>; done: boolean };

/** The sent rows that come after `after` in the filter's order, one load's worth. */
export function sentFragment(kit: ShellKit, type: string, after: string): SentFragment {
  const all = pendingSent(kit.state, type);
  const start = after ? all.findIndex((invitation) => invitation.urn === after) + 1 : 0;
  const slice = start <= 0 && after ? [] : all.slice(start, start + INVITATION_PAGE_SIZE);
  const rows = new Map<string, SentRowData>();
  const html = slice.map((invitation) => sentRowMarkup(kit, invitation, rows)).join("\n");
  return { html, rows: Object.fromEntries(rows), done: start + slice.length >= all.length };
}

function leftRail(kit: ShellKit): string {
  const c = kit.css;
  const entries = [["Connections", "612"], ["Contacts", "1,048"], ["Following & followers", ""], ["Groups", "4"], ["Events", "2"], ["Pages", "14"], ["Newsletters", "3"]]
    .map(([label, count]) => `<li style="display:flex;justify-content:space-between;padding:8px 16px"><a href="${ROOT}mynetwork/">${escapeHtml(label!)}</a><span class="${c.muted}">${count}</span></li>`).join("");
  return `<section class="${c.card}"><h2 class="${c.cardTitle}">Manage my network</h2><ul style="list-style:none;margin:0;padding:0 0 8px">${entries}</ul></section>`;
}

/**
 * The invitation manager, Received or Sent. Sent opens on All -- connection
 * requests, page invitations and a newsletter invitation together -- with a
 * count on every filter pill that is right when the page is rendered and never
 * again: a withdrawal removes its row and leaves every count where it was.
 * Ten rows load at first and ten more on each "Show more".
 */
export function renderManagerPage(kit: ShellKit, tab: "received" | "sent", type: string): string {
  const c = kit.css;
  const received = pendingReceived(kit.state);
  const listId = kit.ids.next();
  const moreId = kit.ids.next();
  const tabs = `<nav class="${c.tabs}" aria-label="Invitations"><a class="${c.tab}${tab === "received" ? ` ${c.tabOn}` : ""}" href="${ROOT}mynetwork/invitation-manager/"${tab === "received" ? ' aria-current="page"' : ""}>Received</a><a class="${c.tab}${tab === "sent" ? ` ${c.tabOn}` : ""}" href="${ROOT}mynetwork/invitation-manager/sent/"${tab === "sent" ? ' aria-current="page"' : ""}>Sent</a></nav>`;
  let body: string;
  let rows: Record<string, SentRowData> = {};
  if (tab === "sent") {
    const pills = SENT_TYPES.map((entry) => {
      const count = pendingSent(kit.state, entry.value).length;
      const on = entry.value === type;
      return `<button class="${c.pill}${on ? ` ${c.pillOn}` : ""}" type="button"${on ? ' aria-pressed="true"' : ""} value="${entry.value}">${entry.label} (${count})</button>`;
    }).join("");
    const first = sentFragment(kit, type, "");
    rows = first.rows;
    body = `<div class="${c.pillBar}" style="position:static">${pills}</div><ul id="${listId}" class="${c.inviteList}">${first.html}</ul>${first.done ? "" : `<button id="${moreId}" class="${c.showMore}" type="button">Show more</button>`}`;
  } else {
    const kinds = [["All", received.length], ["People", received.filter((entry) => entry.kind === "person").length], ["Pages", received.filter((entry) => entry.kind === "page").length], ["Newsletters", received.filter((entry) => entry.kind === "newsletter").length]];
    const pills = kinds.map(([label, count], index) => `<button class="${c.pill}${index === 0 ? ` ${c.pillOn}` : ""}" type="button">${label} (${count})</button>`).join("");
    body = `<div class="${c.pillBar}" style="position:static">${pills}</div><ul id="${listId}" class="${c.inviteList}">${received.map((invitation) => receivedRowMarkup(kit, invitation)).join("\n")}</ul>`;
  }
  const main = `<section class="${c.card}"><div class="${c.sectionHead}"><h1 style="font-size:20px;margin:0">Manage invitations</h1><a class="${c.link}" href="#">Preferences</a></div>${tabs}${body}</section>`;
  return renderShellPage(kit, {
    title: `${tab === "sent" ? "Sent" : "Received"} invitations | Guildline`,
    active: "network",
    layout: "layout2",
    columns: [leftRail(kit), main],
    script: managerClientScript(kit, { tab, type, listId, moreId, rows }),
  });
}
