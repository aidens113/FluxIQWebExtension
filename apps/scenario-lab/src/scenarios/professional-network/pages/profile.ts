import { escapeHtml } from "../../../html.js";
import { MEMBERS } from "../data/index.js";
import { cardAction } from "../search/index.js";
import { initials, profileHref, renderShellPage, ROOT, type ShellKit } from "../shell/index.js";
import type { Member } from "../types.js";

const DEGREE: Record<Member["degree"], string> = { F: "1st", S: "2nd", O: "3rd+" };

/**
 * A member's profile. The Experience section is a component rendered into a
 * declarative shadow root, so its words are not in the light DOM. A member
 * whose main action is Follow keeps Connect under More, as the real thing
 * does, and contact details are for first connections only.
 */
export function renderProfilePage(kit: ShellKit, member: Member): string {
  const c = kit.css;
  const action = cardAction(kit, member);
  const moreId = kit.ids.next();
  const menuId = kit.ids.next();
  const primaryId = kit.ids.next();
  const contactId = kit.ids.next();
  const contactScrim = kit.ids.next();
  const contactClose = kit.ids.next();
  const hiddenConnect = action.label === "Follow";
  const experience = `<gl-profile-section><template shadowrootmode="open"><style>h2{font:600 20px system-ui;margin:0 0 8px}li{margin:8px 0}</style><h2>Experience</h2><ul>
<li><strong>${escapeHtml(member.headline.split(/ at | @ | bij /u)[0] ?? member.headline)}</strong><br>${escapeHtml(member.company || "Self-employed")} · Full-time<br><span>Jan 2022 – Present · 3 yrs 9 mos</span><br>${escapeHtml(member.location)}</li>
<li><strong>Engineer</strong><br>Previous company · Full-time<br><span>2018 – 2021 · 3 yrs</span></li></ul></template></gl-profile-section>`;
  const others = MEMBERS.filter((other) => !other.hidden && other.urn !== member.urn && other.city === member.city).slice(0, 5)
    .map((other) => `<li style="display:flex;gap:8px;padding:8px 16px"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(other.name))}</div><div><a href="${escapeHtml(profileHref(other))}"><strong>${escapeHtml(other.name)}</strong></a> <span class="${c.muted}">· ${DEGREE[other.degree]}</span><div class="${c.muted} ${c.small}">${escapeHtml(other.headline)}</div></div></li>`).join("");
  const main = `<section class="${c.card}"><div style="height:200px;background:linear-gradient(120deg,#6d8a96,#a0b4b7);border-radius:8px 8px 0 0"></div>
<div class="${c.profileHeader}"><div class="${c.avatarLarge}"></div>
<h1 class="${c.profileName}">${escapeHtml(member.name)}${member.pronouns ? ` <span class="${c.muted}" style="font-size:14px;font-weight:400">${escapeHtml(member.pronouns)}</span>` : ""} <span class="${c.muted}" style="font-size:14px;font-weight:400">· ${DEGREE[member.degree]}</span></h1>
<div>${escapeHtml(member.headline)}</div><div class="${c.muted} ${c.small}">${escapeHtml(member.location)} · <button id="${contactId}" class="${c.textBtn}" type="button" style="color:#0a66c2;padding:0">Contact info</button></div>
<div class="${c.small}"><span class="${c.link}">500+ connections</span></div><div class="${c.muted} ${c.small}">${escapeHtml(member.mutual)}</div>
<div style="display:flex;gap:8px;margin-top:12px;position:relative"><button id="${primaryId}" class="${c.primaryBtn}" type="button">${action.label}</button><button class="${c.secondaryBtn}" type="button">Message</button>
<button id="${moreId}" class="${c.secondaryBtn}" type="button" style="color:#666;border-color:#666">More</button>
<div id="${menuId}" class="${c.meMenu}" style="left:200px;right:auto;top:40px" hidden><a class="${c.searchMenuItem}" href="#">Send profile in a message</a><a class="${c.searchMenuItem}" href="#">Save to PDF</a>${hiddenConnect ? `<div class="${c.searchMenuItem}" tabindex="0">Connect</div>` : ""}<a class="${c.searchMenuItem}" href="#">Report / Block</a></div></div></div></section>
<section class="${c.card}"><div class="${c.profileSection}"><h2 style="font-size:20px">About</h2><p>${escapeHtml(member.name.split(" ")[0] ?? member.name)} works on data in ${escapeHtml(member.location.split(",")[0] ?? member.location)}. ${escapeHtml(member.headline)}.</p></div></section>
<section class="${c.card}"><div class="${c.profileSection}">${experience}</div></section>`;
  const right = `<section class="${c.card}"><h2 class="${c.cardTitle}">People also viewed</h2><ul style="list-style:none;margin:0;padding:0 0 8px">${others}</ul></section>`;
  const contact = `<div id="${contactScrim}" class="${c.scrim}" hidden><div class="${c.modal}" role="dialog" aria-modal="true" aria-label="Contact info"><div class="${c.modalHead}"><h2>${escapeHtml(member.name)}</h2><button id="${contactClose}" class="${c.iconButton}" type="button">✕</button></div>
<div class="${c.modalBody}"><p><strong>${escapeHtml(member.name)}’s Profile</strong><br>guildline.example${escapeHtml(profileHref(member).replace(ROOT, "/"))}</p>${member.degree === "F" ? `<p><strong>Email</strong><br>${escapeHtml(member.name.split(" ")[0]!.toLowerCase())}@example.com</p>` : `<p class="${c.muted}">Connect with ${escapeHtml(member.name.split(" ")[0] ?? member.name)} to see their contact info.</p>`}</div></div></div>`;
  const script = `const GL = window.GL;
const byId = (id) => document.getElementById(id);
const card = ${JSON.stringify(action)};
const primary = byId(${JSON.stringify(primaryId)});
const connect = () => GL.openConnect({ memberUrn: card.memberUrn, name: card.name, onSent: () => { primary.textContent = 'Pending'; } });
primary.addEventListener('click', () => {
  const label = primary.textContent.trim();
  if (label === 'Connect') connect();
  else if (label === 'Pending') GL.openWithdraw({ urn: card.sentUrn, text: 'If you withdraw now, you won’t be able to resend to ' + card.name + ' for up to 3 weeks.', onDone: () => { primary.textContent = 'Connect'; } });
  else if (label === 'Follow' || label === 'Following') primary.textContent = label === 'Follow' ? 'Following' : 'Follow';
  else if (label === 'Accept') GL.mutate('accept-invitation', { urn: card.receivedUrn }).then(() => { primary.textContent = 'Message'; });
  else if (label === 'Message') location.assign(GL.root + 'messaging/');
});
byId(${JSON.stringify(moreId)}).addEventListener('click', () => { const menu = byId(${JSON.stringify(menuId)}); menu.hidden = !menu.hidden; });
byId(${JSON.stringify(menuId)}).addEventListener('click', (event) => { if (event.target.textContent.trim() === 'Connect') { byId(${JSON.stringify(menuId)}).hidden = true; connect(); } });
byId(${JSON.stringify(contactId)}).addEventListener('click', () => { byId(${JSON.stringify(contactScrim)}).hidden = false; });
byId(${JSON.stringify(contactClose)}).addEventListener('click', () => { byId(${JSON.stringify(contactScrim)}).hidden = true; });`;
  return renderShellPage(kit, { title: `${member.name} | Guildline`, active: "none", layout: "layoutSearch", columns: [main, right], script, modals: contact });
}
