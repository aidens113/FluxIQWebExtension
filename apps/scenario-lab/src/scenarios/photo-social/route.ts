import type { RenderContext, ScenarioRouteRequest, ScenarioRouteResponse } from "../../types.js";
import { EXISTING_THREADS, MOON_JAR_CARD, SHOP, VIEWER, accountByHandle, postByCode } from "./data/index.js";
import { photoLook } from "./look/index.js";
import {
  articleMarkup, collectionPage, discoverPage, feedBatch, gridBatch, homePage, inboxPage, laterComments, leavingPage, loginPage, messageMarkup,
  postPage, productPage, profilePage, repliesMarkup, savedPage, searchResults, subscribePage, threadPage, unavailablePage,
  type PageContext,
} from "./pages/index.js";
import type { PhotoState } from "./types.js";

const html = (body: string, status = 200): ScenarioRouteResponse => ({ status, body });

/** The page context a request renders with: the run's changes and the seed's styling. */
export function pageContext(state: PhotoState, context: RenderContext): PageContext {
  return { state, look: photoLook(context.seed), seed: context.seed, runToken: context.runToken };
}

/** The home feed, which is the scenario's start page. */
export function renderPhotoHome(state: PhotoState, context: RenderContext): string {
  return homePage(pageContext(state, context));
}

function offsetOf(query: URLSearchParams, name: string): number {
  const value = Number(query.get(name) ?? "0");
  return Number.isSafeInteger(value) && value >= 0 ? value : 0;
}

/**
 * Every Framelight address below the start page. Fragments the pages fetch --
 * feed screens, grid screens, comment batches, replies, search results, a
 * post for the modal, new messages -- are served here too, as a real app's
 * endpoints are. Anything the site does not have is a 404.
 */
export function routePhotoSocial(state: PhotoState, request: ScenarioRouteRequest, context: RenderContext): ScenarioRouteResponse | undefined {
  const ctx = pageContext(state, context);
  const path = request.subpath.endsWith("/") ? request.subpath.slice(0, -1) : request.subpath;
  const parts = path.split("/");
  const [first, second, third, fourth] = parts;
  if (path === "feed") return html(feedBatch(ctx, offsetOf(request.query, "page")));
  if (path === "explore/search") return html(searchResults(ctx, request.query.get("q") ?? ""));
  if (path === "explore") return html(discoverPage(ctx, false));
  if (path === "reels") return html(discoverPage(ctx, true));
  if (path === "l") return html(leavingPage(ctx, request.query.get("u") ?? ""));
  if (path === "accounts/login") return html(loginPage(ctx));
  if (path === "verified/subscribe") return html(subscribePage(ctx));
  if (path === "direct/inbox") return html(inboxPage(ctx));
  if (first === "p" && second !== undefined) return routePost(ctx, second, parts.slice(2), request);
  if (first === "direct" && second === "t" && third !== undefined && (EXISTING_THREADS.some(({ thread }) => thread === third) || accountByHandle(third))) {
    if (parts.length === 3) return html(threadPage(ctx, third));
    if (fourth === "messages" && parts.length === 4) {
      const fresh = state.messages.filter((message) => message.thread === third).slice(offsetOf(request.query, "from"));
      return { status: 200, headers: { "content-type": "application/json; charset=utf-8" }, body: JSON.stringify(fresh.map((message) => ({ mine: message.from === "me", html: messageMarkup(ctx, message) }))) };
    }
    return undefined;
  }
  const account = first === undefined ? undefined : accountByHandle(first);
  if (account === undefined) return ["explore", "accounts", "legal", "reels", "direct", "stories"].includes(first ?? "") ? html(unavailablePage(ctx), 404) : undefined;
  if (parts.length === 1) return html(profilePage(ctx, account, "posts"));
  if (second === "reels" && parts.length === 2) return html(profilePage(ctx, account, "reels"));
  if (second === "tagged" && parts.length === 2) return html(profilePage(ctx, account, "tagged"));
  if (second === "grid" && parts.length === 2) {
    const batch = gridBatch(ctx, account.handle, offsetOf(request.query, "offset"), request.query.get("tab") === "reels");
    return html(batch.body, batch.status);
  }
  if (second === "saved" && account.handle === VIEWER) {
    if (parts.length === 2) return html(savedPage(ctx));
    if (parts.length === 3 && third === "all-posts") return html(collectionPage(ctx, "all-posts", 0));
    const collection = state.collections.find((entry) => entry.slug === third);
    if (collection && parts.length === 3) return html(collectionPage(ctx, collection, offsetOf(request.query, "added")));
    return undefined;
  }
  if (account.handle === SHOP && second === "shop" && third === MOON_JAR_CARD.slug && parts.length === 3) return html(productPage(ctx));
  if ((second === "followers" || second === "following") && parts.length === 2) return html(unavailablePage(ctx), 404);
  return undefined;
}

/** A post's page, the modal's fragment of it, its comment batches, a comment's replies, and a comment's permalink. */
function routePost(ctx: PageContext, code: string, rest: readonly string[], request: ScenarioRouteRequest): ScenarioRouteResponse | undefined {
  const post = postByCode(code);
  if (!post) return undefined;
  if (rest.length === 0) return html(request.query.get("fragment") === "1" ? articleMarkup(ctx, post) : postPage(ctx, post));
  if (rest.length === 1 && rest[0] === "comments") return html(laterComments(ctx, post, offsetOf(request.query, "offset")));
  if (rest.length === 1 && rest[0] === "liked_by") return html(unavailablePage(ctx), 404);
  if (rest[0] === "c" && rest[1] !== undefined) {
    if (rest.length === 2) return html(postPage(ctx, post));
    if (rest.length === 3 && rest[2] === "replies") {
      const replies = repliesMarkup(ctx, post, rest[1]);
      return replies === undefined ? undefined : html(replies);
    }
  }
  return undefined;
}
