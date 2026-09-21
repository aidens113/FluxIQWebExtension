import { escapeHtml } from "../../../html.js";
import { memberByUrn, RECEIVED_INVITATIONS, SENT_INVITATIONS, sentAtIso } from "../data/index.js";
import { runInvitationUrn } from "../store.js";
import { initials, profileHref, type ShellKit } from "../shell/index.js";
import type { InvitationKind, Member, ProfessionalNetworkState, ReceivedInvitation, SentInvitation } from "../types.js";

/** The Sent filter pills, by the value the address carries. */
export const SENT_TYPES = [
  { value: "", label: "All", kinds: ["person", "page", "newsletter"] },
  { value: "CONNECTION", label: "People", kinds: ["person"] },
  { value: "ORGANIZATION", label: "Pages", kinds: ["page"] },
  { value: "NEWSLETTER", label: "Newsletters", kinds: ["newsletter"] },
] as const satisfies ReadonlyArray<{ value: string; label: string; kinds: readonly InvitationKind[] }>;

export const INVITATION_PAGE_SIZE = 10;

/** What a row's Withdraw needs: the invitation, and the sentence the dialog shows for it. */
export type SentRowData = { urn: string; text: string };

/**
 * The sent invitations the manager lists for a filter, newest first: the
 * requests this session sent on top, then the seeded ones it has not
 * withdrawn.
 */
export function pendingSent(state: ProfessionalNetworkState, type: string): SentInvitation[] {
  const kinds: readonly InvitationKind[] = SENT_TYPES.find((entry) => entry.value === type)?.kinds ?? SENT_TYPES[0].kinds;
  const pending = new Set(state.store.sent);
  const fromRun: SentInvitation[] = state.sentByRun
    .filter((invitation) => !invitation.flagged && pending.has(runInvitationUrn(invitation)))
    .map((invitation) => ({ urn: runInvitationUrn(invitation), kind: "person", memberUrn: invitation.memberUrn, subject: "", days: 0 }));
  return [...fromRun.reverse(), ...SENT_INVITATIONS.filter((invitation) => pending.has(invitation.urn))].filter((invitation) => kinds.includes(invitation.kind));
}

export function pendingReceived(state: ProfessionalNetworkState): ReceivedInvitation[] {
  const pending = new Set(state.store.received);
  return RECEIVED_INVITATIONS.filter((invitation) => pending.has(invitation.urn));
}

function member(urn: string): Member {
  const found = memberByUrn(urn);
  if (!found) throw new Error(`professional-network: no member ${urn}`);
  return found;
}

function nameLink(kit: ShellKit, person: Member): string {
  return `<a href="${escapeHtml(profileHref(person))}"><span aria-hidden="true">${escapeHtml(person.name)}</span><span class="${kit.css.vh}">View ${escapeHtml(person.name)}’s profile</span></a>`;
}

function dialogText(state: ProfessionalNetworkState, invitation: SentInvitation): string {
  const person = member(invitation.memberUrn);
  if (invitation.kind === "page") return `${person.name} won’t be able to accept your invitation to follow ${invitation.subject}.`;
  if (invitation.kind === "newsletter") return `${person.name} won’t be able to accept your invitation to subscribe to ${invitation.subject}.`;
  return state.mode === "redesigned-withdraw-dialog"
    ? `${person.name} won’t be notified. You can’t invite them again for 3 weeks.`
    : `If you withdraw now, you won’t be able to resend to ${person.name.split(" ")[0]} for up to 3 weeks.`;
}

/**
 * One sent invitation. A connection request names the person, their headline
 * and when it went out; a page or newsletter invitation is a sentence about
 * who was invited to follow what. The age is a `gl-time-ago` element whose
 * words exist only in its shadow root. A request's Withdraw is a button; a
 * page's or newsletter's is a styled block with a click handler.
 */
export function sentRowMarkup(kit: ShellKit, invitation: SentInvitation, rows: Map<string, SentRowData>): string {
  const c = kit.css;
  const person = member(invitation.memberUrn);
  rows.set(invitation.urn, { urn: invitation.urn, text: dialogText(kit.state, invitation) });
  const age = `<gl-time-ago class="${c.muted} ${c.small}" datetime="${sentAtIso(invitation.days)}" format="sent"></gl-time-ago>`;
  if (invitation.kind === "person") {
    return `<li class="${c.inviteRow}" data-entity-urn="${invitation.urn}"><a href="${escapeHtml(profileHref(person))}" aria-hidden="true" tabindex="-1"><div class="${c.avatar}">${escapeHtml(initials(person.name))}</div></a>
<div class="${c.inviteText}"><div><strong>${nameLink(kit, person)}</strong></div><div class="${c.muted} ${c.small}">${escapeHtml(person.headline)}</div>${age}</div>
<div class="${c.inviteActions}"><button class="${c.textBtn}" type="button">Withdraw</button></div></li>`;
  }
  const verb = invitation.kind === "page" ? "follow" : "subscribe to";
  return `<li class="${c.inviteRow}" data-entity-urn="${invitation.urn}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(invitation.subject))}</div>
<div class="${c.inviteText}"><div>You invited ${nameLink(kit, person)} to ${verb} <strong>${escapeHtml(invitation.subject)}</strong></div>${age}</div>
<div class="${c.inviteActions}"><div class="${c.textBtn}">Withdraw</div></div></li>`;
}

/** One invitation waiting for the viewer: who, what for, any message, and Ignore beside Accept. */
export function receivedRowMarkup(kit: ShellKit, invitation: ReceivedInvitation): string {
  const c = kit.css;
  const person = member(invitation.memberUrn);
  const what = invitation.kind === "person"
    ? `<div><strong>${nameLink(kit, person)}</strong></div><div class="${c.muted} ${c.small}">${escapeHtml(person.headline)}</div>`
    : `<div>${nameLink(kit, person)} invited you to ${invitation.kind === "page" ? "follow" : "subscribe to"} <strong>${escapeHtml(invitation.subject)}</strong></div>`;
  const message = invitation.message ? `<blockquote style="margin:8px 0;padding:8px 12px;background:#f4f2ee;border-radius:8px">${escapeHtml(invitation.message)}</blockquote>` : "";
  return `<li class="${c.inviteRow}" data-entity-urn="${invitation.urn}"><div class="${c.avatar}" aria-hidden="true">${escapeHtml(initials(person.name))}</div>
<div class="${c.inviteText}">${what}${message}<gl-time-ago class="${c.muted} ${c.small}" datetime="${sentAtIso(invitation.days)}"></gl-time-ago></div>
<div class="${c.inviteActions}"><button class="${c.textBtn}" type="button">Ignore</button><button class="${c.secondaryBtn}" type="button">Accept</button></div></li>`;
}
