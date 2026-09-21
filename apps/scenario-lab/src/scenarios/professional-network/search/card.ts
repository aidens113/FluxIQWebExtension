import { escapeHtml } from "../../../html.js";
import { RECEIVED_INVITATIONS, SENT_INVITATIONS } from "../data/index.js";
import { runInvitationUrn } from "../store.js";
import { initials, profileHref, ROOT, type ShellKit } from "../shell/index.js";
import type { Degree, Member } from "../types.js";
import type { ResultEntry } from "./results.js";

const DEGREE_LABEL: Record<Degree, string> = { F: "1st", S: "2nd", O: "3rd+" };

/** What a card's button does for this viewer, and what the page needs to do it. */
export type CardAction = { memberUrn: string; name: string; label: string; receivedUrn: string; sentUrn: string };

/**
 * The card's one button, from the session's own state: a member who invited
 * the viewer offers Accept, a member the viewer already invited shows Pending
 * (which opens the withdraw dialog, as it does on the real thing), a first
 * connection offers Message, and everyone else the member's own action.
 */
export function cardAction(kit: ShellKit, member: Member): CardAction {
  const pendingSent = new Set(kit.state.store.sent);
  const pendingReceived = new Set(kit.state.store.received);
  const received = RECEIVED_INVITATIONS.find((invitation) => invitation.kind === "person" && invitation.memberUrn === member.urn && pendingReceived.has(invitation.urn));
  const seeded = SENT_INVITATIONS.find((invitation) => invitation.kind === "person" && invitation.memberUrn === member.urn && pendingSent.has(invitation.urn));
  const runUrn = runInvitationUrn({ memberUrn: member.urn });
  const run = pendingSent.has(runUrn) ? runUrn : "";
  const sentUrn = seeded?.urn ?? run;
  const label = received ? "Accept" : sentUrn ? "Pending" : member.degree === "F" ? "Message" : member.action;
  return { memberUrn: member.urn, name: member.name, label, receivedUrn: received?.urn ?? "", sentUrn };
}

/**
 * One entry of the results list. A member's name is a link holding two
 * spans: the name, hidden from assistive technology, and "View <name>'s
 * profile", hidden from the eye, so the link's text is neither. The degree
 * badge does the same with "• 2nd" and "2nd degree connection". A promoted
 * profile is the same card with a "Promoted" line above the name. Nothing on
 * a card carries a hook of its own; the entry's urn is on the list item, as
 * the site's own tracking reads it.
 */
export function resultEntryMarkup(kit: ShellKit, entry: ResultEntry, actions: Map<string, CardAction>): string {
  const c = kit.css;
  if (entry.kind === "ad") {
    return `<li class="${c.resultItem}" data-urn="urn:gl:sponsored:88121"><div class="${c.avatar}" aria-hidden="true">GR</div>
<div class="${c.resultBody}"><div class="${c.resultName}">Guildline Recruiter</div><div class="${c.resultTitle}">Find data engineers who are open to work, before anyone else does.</div><div class="${c.resultSub}">Promoted</div></div>
<div><a class="${c.actionBtn}" href="${ROOT}premium/">Learn more</a></div></li>`;
  }
  if (entry.kind === "suggestions") {
    return `<li class="${c.resultItem}"><div class="${c.resultBody}"><div class="${c.resultName}">People also searched</div>
<div class="${c.resultSub}"><a class="${c.pill}" href="${ROOT}search/results/all/?keywords=data%20engineer%20jobs&amp;origin=SUGGESTION">data engineer jobs</a> <a class="${c.pill}" href="${ROOT}search/results/all/?keywords=data%20analyst&amp;origin=SUGGESTION">data analyst</a> <a class="${c.pill}" href="${ROOT}search/results/all/?keywords=analytics%20engineer&amp;origin=SUGGESTION">analytics engineer</a></div></div></li>`;
  }
  const member = entry.member;
  const action = cardAction(kit, member);
  actions.set(member.urn, action);
  const position = entry.kind === "organic" ? entry.position : 0;
  const tracking = entry.kind === "organic" ? { origin: "srp", position } : { origin: "srp-ad", position: 0 };
  const nameSpans = `<span dir="ltr"><span aria-hidden="true">${escapeHtml(member.name)}</span><span class="${c.vh}">View ${escapeHtml(member.name)}’s profile</span></span>`;
  const name = member.hidden ? nameSpans : `<a href="${escapeHtml(profileHref(member, tracking))}">${nameSpans}</a>`;
  const pronouns = member.pronouns ? ` <span class="${c.muted} ${c.small}">(${escapeHtml(member.pronouns)})</span>` : "";
  const degree = `<span class="${c.degreeTag}"><span aria-hidden="true"> • ${DEGREE_LABEL[member.degree]}</span><span class="${c.vh}">${DEGREE_LABEL[member.degree]} degree connection</span></span>`;
  const promoted = entry.kind === "promoted" ? `<div class="${c.promotedTag}">Promoted</div>` : "";
  const current = member.current ? `<p class="${c.resultInsight}">${escapeHtml(member.current)}</p>` : "";
  const mutual = member.mutual ? `<div class="${c.resultMeta}">${escapeHtml(member.mutual)}</div>` : "";
  const slot = entry.kind === "promoted" ? ` data-ad-slot="${entry.slot}"` : "";
  const avatar = member.hidden ? `<div class="${c.avatar}" aria-hidden="true"></div>` : `<a href="${escapeHtml(profileHref(member, tracking))}" aria-hidden="true" tabindex="-1"><div class="${c.avatar}">${escapeHtml(initials(member.name))}</div></a>`;
  return `<li class="${c.resultItem}" data-urn="${member.urn}"${slot}>${avatar}
<div class="${c.resultBody}">${promoted}<div class="${c.resultName}">${name}${pronouns}${degree}</div>
<div class="${c.resultTitle}">${escapeHtml(member.headline)}</div>
<div class="${c.resultSub}">${escapeHtml(member.location)}</div>${current}${mutual}</div>
<div><button class="${c.actionBtn}" type="button">${action.label}</button></div></li>`;
}
