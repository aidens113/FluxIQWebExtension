import { escapeHtml } from "../../../html.js";
import { memberNamed } from "../data/index.js";
import { initials, profileHref, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import { pendingReceived, receivedRowMarkup } from "./rows.js";

const SUGGESTED = ["Rahul Verma", "Oskar Nilsson", "Lieke Postma", "Pavel Novák", "Omar Farouk", "Tobias Keller"];

/**
 * My Network: the first three invitations waiting for an answer, with a
 * "Manage" link to all of them -- one of two links on the page reading
 * "Manage" -- and people to connect with, each a real connection request.
 */
export function renderMyNetworkPage(kit: ShellKit): string {
  const c = kit.css;
  const received = pendingReceived(kit.state);
  const listId = kit.ids.next();
  const gridId = kit.ids.next();
  const cards = SUGGESTED.map((name) => {
    const person = memberNamed(name);
    return `<div class="${c.gridCard}" data-urn="${person.urn}"><div class="${c.avatar}" style="margin:0 auto">${escapeHtml(initials(person.name))}</div>
<a href="${escapeHtml(profileHref(person))}"><strong>${escapeHtml(person.name)}</strong></a><div class="${c.muted} ${c.small}">${escapeHtml(person.headline)}</div>
<div class="${c.muted} ${c.small}">${escapeHtml(person.mutual)}</div><button class="${c.actionBtn}" type="button" style="margin-top:8px">Connect</button></div>`;
  }).join("");
  const rail = `<section class="${c.card}"><div class="${c.sectionHead}"><h2 style="font-size:16px;margin:0">Manage my network</h2><a class="${c.link}" href="${ROOT}mynetwork/invitation-manager/sent/">Manage</a></div>
<ul style="list-style:none;margin:0;padding:8px 0">${[["Connections", "612"], ["Following & followers", ""], ["Groups", "4"], ["Events", "2"], ["Pages", "14"], ["Newsletters", "3"]].map(([label, count]) => `<li style="display:flex;justify-content:space-between;padding:8px 16px"><span>${escapeHtml(label!)}</span><span class="${c.muted}">${count}</span></li>`).join("")}</ul></section>`;
  const main = `<section class="${c.card}"><div class="${c.sectionHead}"><h2 style="font-size:16px;margin:0">Invitations (${received.length})</h2><a class="${c.link}" href="${ROOT}mynetwork/invitation-manager/">Show all</a></div>
<ul id="${listId}" class="${c.inviteList}">${received.slice(0, 3).map((invitation) => receivedRowMarkup(kit, invitation)).join("\n")}</ul></section>
<section class="${c.card}"><h2 class="${c.cardTitle}">People you may know from Northwick Analytics</h2><div id="${gridId}" class="${c.grid}">${cards}</div></section>`;
  const script = `const GL = window.GL;
const names = ${JSON.stringify(Object.fromEntries(SUGGESTED.map((name) => [memberNamed(name).urn, name])))};
document.getElementById(${JSON.stringify(gridId)}).addEventListener('click', (event) => {
  const button = event.target.closest('button');
  if (!button || button.textContent.trim() !== 'Connect') return;
  const urn = button.closest('[data-urn]').getAttribute('data-urn');
  GL.openConnect({ memberUrn: urn, name: names[urn], onSent: () => { button.textContent = 'Pending'; } });
});
document.getElementById(${JSON.stringify(listId)}).addEventListener('click', async (event) => {
  const button = event.target.closest('button');
  if (!button) return;
  const row = button.closest('li');
  const urn = row.getAttribute('data-entity-urn');
  const label = button.textContent.trim();
  if (label === 'Accept') { await GL.mutate('accept-invitation', { urn }); row.remove(); GL.toast('Invitation accepted'); }
  else if (label === 'Ignore') { await GL.mutate('ignore-invitation', { urn }); row.remove(); GL.toast('Invitation ignored'); }
});`;
  return renderShellPage(kit, { title: "My Network | Guildline", active: "network", layout: "layout2", columns: [rail, main], script });
}
