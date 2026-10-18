import type { ShellKit } from "../shell/index.js";
import { pendingSent } from "./rows.js";

/**
 * How many unanswered connection requests the site lets stand before it says
 * the weekly limit is reached. The session starts with 28; withdrawing the
 * twelve a month or more old leaves 16, under it, and withdrawing fewer than
 * nine of them leaves the notice up. Page and newsletter invitations are not
 * connection requests and do not count.
 */
const PENDING_REQUEST_LIMIT = 20;

/**
 * The notice the invitation-allowance task's person read: shown on My Network
 * and on Sent invitations while the session's pending connection requests are
 * at the limit, rendered from the session's state so a page loaded after the
 * withdrawals no longer carries it. It explains the limit and prescribes
 * nothing; sending stays possible, as the connection-request task needs.
 */
export function invitationLimitNotice(kit: ShellKit): string {
  if (pendingSent(kit.state, "CONNECTION").length < PENDING_REQUEST_LIMIT) return "";
  const c = kit.css;
  return `<section class="${c.card}" role="status"><div style="padding:12px 16px;border-left:4px solid #b24020"><strong>You’ve reached the weekly invitation limit</strong>
<div class="${c.muted} ${c.small}">Connection requests you sent that are still waiting for an answer count toward it.</div></div></section>`;
}
