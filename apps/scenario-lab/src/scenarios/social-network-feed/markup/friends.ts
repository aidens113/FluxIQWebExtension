import { escapeHtml as esc } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { clientScript } from "../client/index.js";
import { CONFIRM_RATE_LIMIT, FRIEND_REQUESTS, PEOPLE_YOU_MAY_KNOW, personBySlug, REQUESTS_ON_FRIENDS_HOME, type FriendRequest } from "../content/index.js";
import type { FeedState } from "../types.js";
import type { FeedClasses } from "./classes.js";
import { avatarGraphic, SITE_ROOT } from "./parts.js";
import { baseConfig, shellContext, sitePage, type ShellContext } from "./shell.js";

/**
 * The Friends home: the first four requests with a "See all" link, then
 * people Maya may know. The top bar's badge says 4, and four cards are shown,
 * which agree with each other and not with the eight requests there are.
 */
export function renderFriendsHome(state: FeedState, context: RenderContext): string {
  const shell = shellContext(state, context, "friends");
  const { css } = shell;
  const requests = FRIEND_REQUESTS.slice(0, REQUESTS_ON_FRIENDS_HOME).map((request) => requestCard(css, state, request)).join("");
  const suggestions = PEOPLE_YOU_MAY_KNOW.map((entry) => {
    const person = personBySlug(entry.person);
    const href = `${SITE_ROOT}people/${person.slug}/`;
    return `<div class="${css.requestCard}" role="listitem"><a class="${css.requestPhoto}" href="${href}" aria-hidden="true" tabindex="-1">${avatarGraphic(person.hue, 170)}</a><div class="${css.requestActions}"><a class="${css.requestName}" href="${href}">${esc(person.name)}</a><div class="${css.requestMutual}">${esc(entry.mutualLine)}</div><div class="${css.secondaryButton}" role="button" tabindex="0" aria-label="Add friend">Add friend</div><div class="${css.secondaryButton}" role="button" tabindex="0" aria-label="Remove">Remove</div></div></div>`;
  }).join("");
  const main = `<div class="${css.sectionHead}"><h2 class="${css.heading}">Friend requests</h2><a href="${SITE_ROOT}friends/requests/">See all</a></div><div class="${css.friendsGrid}" role="list">${requests}</div><div class="${css.sectionHead}" style="margin-top:24px"><h2 class="${css.heading}">People you may know</h2><a href="${SITE_ROOT}friends/suggestions/">See all</a></div><div class="${css.friendsGrid}" role="list">${suggestions}</div>`;
  return friendsPage(shell, context, "Friends | Circleway", main);
}

/**
 * Every friend request. The heading counts what is still waiting, which is
 * the one honest count on the site.
 */
export function renderRequestsPage(state: FeedState, context: RenderContext): string {
  const shell = shellContext(state, context, "friends");
  const { css } = shell;
  const waiting = FRIEND_REQUESTS.filter((request) => state.requests[request.id] === undefined).length;
  const cards = FRIEND_REQUESTS.map((request) => requestCard(css, state, request)).join("");
  const main = `<div class="${css.sectionHead}"><div><h2 class="${css.heading}">Friend requests</h2><p class="${css.muted}" style="margin:4px 0 0">${waiting} friend request${waiting === 1 ? "" : "s"}</p></div><a href="${SITE_ROOT}friends/requests/sent/">View sent requests</a></div><div class="${css.friendsGrid}" role="list">${cards}</div>`;
  return friendsPage(shell, context, "Friend requests | Circleway", main);
}

function friendsPage(shell: ShellContext, context: RenderContext, title: string, main: string): string {
  const { css } = shell;
  const nav = [["Home", "friends/"], ["Friend requests", "friends/requests/"], ["Suggestions", "friends/suggestions/"], ["All friends", "friends/list/"], ["Birthdays", "friends/birthdays/"], ["Custom lists", "friends/lists/"]]
    .map(([label, href]) => `<li><a class="${css.railItem}" href="${SITE_ROOT}${href ?? ""}">${esc(label ?? "")}</a></li>`).join("");
  const body = `<div class="${css.layout}" style="grid-template-columns:320px minmax(0,1fr)"><nav class="${css.leftRail}" aria-label="Friends"><h1 class="${css.heading}" style="padding:0 8px 8px">Friends</h1><ul style="margin:0;padding:0">${nav}</ul></nav><div class="${css.center}" role="main">${main}</div></div>`;
  const requests = Object.fromEntries(FRIEND_REQUESTS.map((request) => [request.person, request.id]));
  const config = { ...baseConfig(shell, "friends"), requests, rate: { ...CONFIRM_RATE_LIMIT } };
  return sitePage(shell, title, body, clientScript(context.runToken, config));
}

/**
 * One request as its card shows it. A confirmed request keeps its card and
 * its mutual-friends line, with "Request accepted" and a Message link where
 * the buttons were; a deleted one says "Request removed".
 */
function requestCard(css: FeedClasses, state: FeedState, request: FriendRequest): string {
  const person = personBySlug(request.person);
  const href = `${SITE_ROOT}people/${person.slug}/`;
  const answer = state.requests[request.id];
  const controls = answer === "confirmed" ? `<div class="${css.requestStatus}">Request accepted</div><a class="${css.secondaryButton}" href="${SITE_ROOT}messages/t/${person.slug}/">Message</a>`
    : answer === "deleted" ? `<div class="${css.requestStatus}">Request removed</div>`
    : `<div class="${css.primaryButton}" role="button" tabindex="0" aria-label="Confirm">Confirm</div><div class="${css.secondaryButton}" role="button" tabindex="0" aria-label="Delete">Delete</div>`;
  return `<div class="${css.requestCard}" role="listitem"><a class="${css.requestPhoto}" href="${href}" aria-hidden="true" tabindex="-1">${avatarGraphic(person.hue, 170)}</a><div class="${css.requestActions}"><a class="${css.requestName}" href="${href}">${esc(person.name)}</a><div class="${css.requestMutual}">${esc(request.mutualLine ?? "")}</div><span class="${css.muted}" style="font-size:12px">${esc(request.sent)}</span>${controls}</div></div>`;
}
