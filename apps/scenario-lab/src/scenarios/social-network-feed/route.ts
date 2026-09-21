import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { COMMUNITIES, findPost, MAYA, PEOPLE } from "./content/index.js";
import {
  feedBatch, feedClasses, pendingBoxMarkup, renderAppStore, renderCommunityPage, renderEmbed, renderFriendsHome, renderGroupPage,
  renderLinkShim, renderNotFound, renderPersonPage, renderPostPage, renderRequestsPage, unitContextFor, unitMarkup,
} from "./markup/index.js";
import type { FeedState } from "./types.js";

/** A third-party player may be framed by the site's own origin and nothing else, and it is served from the lab's second one. */
const EMBED_CSP = "default-src 'self'; script-src 'unsafe-inline'; style-src 'unsafe-inline'; img-src 'self' data:; object-src 'none'; base-uri 'none'; frame-ancestors http://127.0.0.1:*";

type Page = (state: FeedState, context: RenderContext, match: RegExpExecArray, request: ScenarioRouteRequest) => ScenarioRouteResponse | undefined;

const html = (body: string, status = 200): ScenarioRouteResponse => ({ status, body });

/**
 * Every page the site has besides the home feed, and the two fragments and
 * one JSON document its scripts fetch. Anything else gets the site's own
 * "This content isn't available right now" page with a 404, as the real one
 * does, rather than a bare error.
 */
const ROUTES: ReadonlyArray<readonly [RegExp, Page]> = [
  [/^feed\/$/u, (state, context, _match, request) => {
    const cursor = Number(request.query.get("cursor") ?? "0");
    const batch = Number.isSafeInteger(cursor) && cursor >= 0 ? feedBatch(state, cursor, context) : undefined;
    return batch ? { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(batch) } : { status: 404, headers: { "content-type": "application/json; charset=utf-8" }, body: "{\"error\":\"no_such_batch\"}" };
  }],
  [/^unit\/([a-z0-9_]+)\/$/u, (state, context, match) => {
    const post = findPost(state, match[1] ?? "");
    return post && post.author === MAYA.slug ? html(unitMarkup({ unit: post, position: 1 }, unitContextFor(state, context))) : undefined;
  }],
  [/^groups\/([a-z0-9-]+)\/pending\/$/u, (state, context, match) => {
    const slug = match[1] ?? "";
    return COMMUNITIES[slug]?.kind === "group" ? html(pendingBoxMarkup(feedClasses(context.seed), state, slug)) : undefined;
  }],
  [/^groups\/([a-z0-9-]+)\/(?:[a-z]+\/)?$/u, (state, context, match) => {
    const slug = match[1] ?? "";
    if (slug === "feed") return html(renderGroupPage(state, context, "riverside-allotments") ?? "");
    const page = COMMUNITIES[slug] ? renderGroupPage(state, context, slug) : undefined;
    return page ? html(page) : undefined;
  }],
  [/^friends\/requests\/$/u, (state, context) => html(renderRequestsPage(state, context))],
  [/^friends\/(?:[a-z]+\/)?$/u, (state, context) => html(renderFriendsHome(state, context))],
  [/^posts\/([a-z0-9_]+)\/$/u, (state, context, match) => findPost(state, match[1] ?? "") ? html(renderPostPage(state, context, match[1] ?? "")) : undefined],
  [/^people\/([a-z0-9.-]+)\/$/u, (state, context, match) => PEOPLE[match[1] ?? ""] ? html(renderPersonPage(state, context, match[1] ?? "")) : undefined],
  [/^pages\/([a-z0-9-]+)\/$/u, (state, context, match) => COMMUNITIES[match[1] ?? ""]?.kind === "page" ? html(renderCommunityPage(state, context, match[1] ?? "")) : undefined],
  [/^l\/$/u, (_state, context, _match, request) => html(renderLinkShim(context, request.query))],
  [/^app-store\/$/u, (_state, context) => html(renderAppStore(context))],
  [/^embed\/([a-z0-9_]+)$/u, (state, _context, match) => {
    const post = findPost(state, match[1] ?? "");
    const title = post?.attachment?.kind === "video" ? post.attachment.title : undefined;
    return title ? { status: 200, headers: { "content-security-policy": EMBED_CSP }, body: renderEmbed(title) } : undefined;
  }],
];

export function routeFeed(state: FeedState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse {
  for (const [pattern, page] of ROUTES) {
    const match = pattern.exec(request.subpath);
    if (!match) continue;
    const response = page(state, context, match, request);
    if (response) return response;
    break;
  }
  return html(renderNotFound(state, context), 404);
}
