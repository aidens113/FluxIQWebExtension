import { escapeHtml } from "../../../html.js";
import { acceptedPeople } from "../conversations/index.js";
import { memberByUrn } from "../data/index.js";
import { initials, newsRail, profileHref, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import { connectionCount } from "./connection-count.js";

/**
 * Connections, recently added first. A person whose invitation the viewer
 * accepted this session is listed "Connected today", and, when their invitation
 * carried a note, links to the conversation that note started.
 */
export function renderConnectionsPage(kit: ShellKit): string {
  const c = kit.css;
  const rows = acceptedPeople(kit.state).map((invitation) => {
    const person = memberByUrn(invitation.memberUrn)!;
    const chat = invitation.message ? `<a class="${c.link}" href="${ROOT}messaging/">Message</a>` : "";
    return `<li class="${c.inviteRow}" data-connection-urn="${person.urn}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
<div class="${c.inviteText}"><div><strong><a href="${escapeHtml(profileHref(person))}">${escapeHtml(person.name)}</a></strong></div><div class="${c.muted} ${c.small}">${escapeHtml(person.headline)}</div><div class="${c.muted} ${c.small}">Connected today</div></div><div class="${c.inviteActions}">${chat}</div></li>`;
  }).join("\n");
  const main = `<section class="${c.card}"><div class="${c.sectionHead}"><h1 class="${c.cardTitle}" style="font-size:20px">${connectionCount(kit.state)} Connections</h1><span class="${c.muted} ${c.small}">Sort by: Recently added</span></div>
<ul class="${c.inviteList}">${rows}</ul>${rows ? "" : `<p class="${c.muted}" style="padding:0 16px 16px">Connections you add appear here, newest first.</p>`}</section>`;
  return renderShellPage(kit, { title: "Connections | Guildline", active: "network", layout: "layoutSearch", columns: [main, newsRail(kit)] });
}
