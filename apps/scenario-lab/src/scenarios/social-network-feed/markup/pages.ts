import { escapeHtml as esc } from "../../../html.js";
import type { RenderContext } from "../../../types.js";
import { clientScript } from "../client/index.js";
import { COMMUNITIES, createdPostUnit, FEED_BEFORE_CAUGHT_UP, findPost, PEOPLE, type FeedPost } from "../content/index.js";
import type { FeedState } from "../types.js";
import { unitContextFor } from "./home.js";
import { avatarGraphic, SITE_ROOT } from "./parts.js";
import { baseConfig, shellContext, sitePage } from "./shell.js";
import { postBody } from "./unit.js";

/**
 * A post on its own page, whole: no "See more", because the page exists to
 * show all of it. Anything the site has no post for -- a share, an advert, a
 * post Maya moved to her trash -- gets the not-found page instead.
 */
export function renderPostPage(state: FeedState, context: RenderContext, id: string): string {
  const post = findPost(state, id);
  if (!post) return renderNotFound(state, context);
  const shell = shellContext(state, context, "none");
  const { css } = shell;
  const unit = `<div class="${css.unit}" role="article" data-lb="${id}-p-t">${postBody(post, unitContextFor(state, context), `${id}-p`, true)}</div>`;
  const main = `<div class="${css.pageBody}">${unit}<div class="${css.card}" style="padding:12px 16px"><p class="${css.muted}" style="margin:0">Most relevant comments are shown first. Some comments may have been filtered out.</p></div></div>`;
  return sitePage(shell, `${post.text.slice(0, 40)} | Circleway`, main, clientScript(context.runToken, baseConfig(shell, "post")));
}

/** A person's profile: who they are, and their posts that appear in Maya's feed, whole. */
export function renderPersonPage(state: FeedState, context: RenderContext, slug: string): string {
  const person = PEOPLE[slug];
  if (!person) return renderNotFound(state, context);
  const shell = shellContext(state, context, "none");
  const { css } = shell;
  const unitContext = unitContextFor(state, context);
  const own = [...state.created.map(createdPostUnit), ...FEED_BEFORE_CAUGHT_UP]
    .filter((unit): unit is FeedPost => unit.kind === "post" && unit.author === slug && !state.trashed.includes(unit.id));
  const posts = own.map((post) => `<div class="${css.unit}" role="article" data-lb="${post.id}-q-t">${postBody(post, unitContext, `${post.id}-q`, true)}</div>`).join("");
  const main = `<div class="${css.pageBody}"><div class="${css.card}" style="padding:16px;display:flex;gap:16px;align-items:center">${avatarGraphic(person.hue, 96)}<div><h1 class="${css.heading}" style="font-size:28px">${esc(person.name)}</h1><p class="${css.muted}" style="margin:4px 0 0">${slug.includes(".") ? "12 friends" : "Lives in Harbourside"}</p></div></div>${posts || `<p class="${css.muted}">No posts to show.</p>`}</div>`;
  return sitePage(shell, `${person.name} | Circleway`, main, clientScript(context.runToken, baseConfig(shell, "other")));
}

/** A brand's page: its name, what it is, and a Follow button. */
export function renderCommunityPage(state: FeedState, context: RenderContext, slug: string): string {
  const community = COMMUNITIES[slug];
  if (!community || community.kind !== "page") return renderNotFound(state, context);
  const shell = shellContext(state, context, "none");
  const { css } = shell;
  const main = `<div class="${css.pageBody}"><div class="${css.card}" style="padding:16px;display:flex;gap:16px;align-items:center">${avatarGraphic(community.hue, 96)}<div><h1 class="${css.heading}" style="font-size:28px">${esc(community.name)}</h1><p class="${css.muted}" style="margin:4px 0 8px">${esc(community.about)}</p><div class="${css.primaryButton}" role="button" tabindex="0">Follow</div></div></div></div>`;
  return sitePage(shell, `${community.name} | Circleway`, main, clientScript(context.runToken, baseConfig(shell, "other")));
}

/** What the site shows for anything it does not have, in its own words, with the shell still around it. */
export function renderNotFound(state: FeedState, context: RenderContext): string {
  const shell = shellContext(state, context, "none");
  const { css } = shell;
  const main = `<div class="${css.pageBody}"><div class="${css.card}" style="padding:32px;text-align:center;display:grid;gap:12px"><h1 class="${css.heading}">This content isn't available right now</h1><p class="${css.muted}" style="margin:0">When this happens, it's usually because the owner only shared it with a small group of people, changed who can see it or it's been deleted.</p><a class="${css.primaryButton}" href="${SITE_ROOT}" style="justify-self:center">Go to Feed</a></div></div>`;
  return sitePage(shell, "Circleway", main, clientScript(context.runToken, baseConfig(shell, "other")));
}
