import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { memberBySlug } from "./data/index.js";
import { renderManagerPage, renderMyNetworkPage, sentFragment } from "./network/index.js";
import { adFrameDocument, feedBatch, renderFeedPage, renderProfilePage, renderSimplePage } from "./pages/index.js";
import { challengeFragment, peopleFragment, readPeopleQuery, renderAllResultsPage, renderPeoplePage, RETRY_AFTER_SECONDS, searchChallenged } from "./search/index.js";
import { shellKit } from "./shell/index.js";
import type { ProfessionalNetworkState } from "./types.js";

const JSON_HEADERS = { "content-type": "application/json; charset=utf-8" };
const PROFILE = /^in\/([a-z0-9-]+)\/$/u;

/** A page's id range, from its path, so the same control carries a different id on every page. */
function salt(subpath: string): number {
  let value = 7;
  for (let index = 0; index < subpath.length; index += 1) value = (value * 31 + subpath.charCodeAt(index)) % 9973;
  return value;
}

/** The start page, which is the feed. */
export function renderNetworkStart(state: ProfessionalNetworkState, context: RenderContext): string {
  return renderFeedPage(shellKit(state, context, 1));
}

/**
 * Every page under the site's root except the feed. Pages are HTML; the three
 * endpoints a page's script calls -- more feed, more sent invitations, and
 * people results -- answer JSON. The people results endpoint is the one that
 * rate-limits: it records every request it serves (`search-hit`) and answers
 * one that arrives too soon after the last few with the security check, a 429
 * carrying Retry-After, instead of results (`search-challenged`).
 */
export function routeNetwork(state: ProfessionalNetworkState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const { subpath, query } = request;
  const kit = shellKit(state, context, salt(subpath));
  if (subpath === "feed/fragment") {
    const offset = Number.parseInt(query.get("offset") ?? "0", 10);
    return { status: 200, headers: JSON_HEADERS, body: JSON.stringify(feedBatch(kit, Number.isSafeInteger(offset) && offset >= 0 ? offset : 0)) };
  }
  if (subpath === "search/results/people/fragment") {
    const people = readPeopleQuery(query);
    const now = Date.now();
    if (searchChallenged(state.searchHits, now)) {
      return { status: 429, headers: { ...JSON_HEADERS, "retry-after": String(RETRY_AFTER_SECONDS) }, body: JSON.stringify(challengeFragment(kit, people.page)), mutation: { operation: "search-challenged", payload: {} } };
    }
    return { status: 200, headers: JSON_HEADERS, body: JSON.stringify(peopleFragment(kit, people)), mutation: { operation: "search-hit", payload: { at: now } } };
  }
  if (subpath === "search/results/people/") return { status: 200, body: renderPeoplePage(kit, readPeopleQuery(query)) };
  if (subpath === "search/results/all/") return { status: 200, body: renderAllResultsPage(kit, (query.get("keywords") ?? "").trim()) };
  if (subpath === "mynetwork/") return { status: 200, body: renderMyNetworkPage(kit) };
  if (subpath === "mynetwork/invitation-manager/") return { status: 200, body: renderManagerPage(kit, "received", "") };
  if (subpath === "mynetwork/invitation-manager/sent/") return { status: 200, body: renderManagerPage(kit, "sent", query.get("invitationType") ?? "") };
  if (subpath === "mynetwork/invitation-manager/sent/fragment") {
    return { status: 200, headers: JSON_HEADERS, body: JSON.stringify(sentFragment(kit, query.get("invitationType") ?? "", query.get("after") ?? "")) };
  }
  if (subpath === "ad/") return { status: 200, body: adFrameDocument() };
  const simple = renderSimplePage(kit, subpath);
  if (simple !== undefined) return { status: 200, body: simple };
  const slug = PROFILE.exec(subpath)?.[1];
  const member = slug === undefined ? undefined : memberBySlug(slug);
  return member ? { status: 200, body: renderProfilePage(kit, member) } : undefined;
}
