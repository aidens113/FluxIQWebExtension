import { escapeHtml } from "../../../html.js";
import { ALL_POSTS, INITIAL_FOLLOWING, VIEWER, accountByHandle, commentCount, postInstant, shortAge, tooltipDate } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Post } from "../types.js";
import { actionsMarkup, likesMarkup, mediaMarkup } from "./article.js";
import type { PageContext } from "./context.js";
import { avatar } from "./media.js";
import { photoDocument } from "./shell.js";
import { ROOT, compactCount, linkified } from "./text.js";

/** Cards per screen of the feed. */
export const FEED_BATCH = 4;
/** Where the three ads sit among the organic posts, counted from zero. */
const AD_SLOTS = [2, 7, 12] as const;
/** The card after which the "Suggested for you" strip appears. */
const SUGGESTED_AFTER = 5;

/**
 * The home feed: posts from accounts the visitor followed when the fixture
 * starts, newest first, with three ads laid in. One of the ads is the
 * impersonator's copy of the studio's giveaway, labelled Sponsored and
 * otherwise identical to the real post that appears further down.
 */
export function feedPosts(): Post[] {
  const organic = ALL_POSTS.filter((post) => !post.sponsored && INITIAL_FOLLOWING.includes(post.author) && post.date >= "2026-09-01").sort((a, b) => b.date.localeCompare(a.date) || a.author.localeCompare(b.author));
  const ads = ALL_POSTS.filter((post) => post.sponsored);
  const feed = [...organic];
  AD_SLOTS.forEach((slot, index) => { const ad = ads[index]; if (ad) feed.splice(slot, 0, ad); });
  return feed;
}

function suggestedStrip(ctx: PageContext): string {
  const { cls } = ctx.look;
  const suggestions = ["harbourlight.studios", "harbour.light.studio", "glazelab.supply", "harbourlightstudio_official"];
  const cards = suggestions.map((handle) => {
    const account = accountByHandle(handle);
    return `<div class="${cls.tile}" style="width:120px;text-align:center">${avatar(handle, cls.avatar)}<a class="${cls.handle}" href="${ROOT}${handle}/">${escapeHtml(handle)}</a><span class="${cls.meta}">${escapeHtml(account?.name ?? "")}</span><button type="button" class="${cls.primary}">Follow</button></div>`;
  }).join("");
  return `<section class="${cls.suggested}"><div class="${cls.railHead}"><span>Suggested for you</span><a class="${cls.linkButton}" href="${ROOT}explore/people/">See all</a></div><div style="display:flex;gap:10px;overflow:hidden">${cards}</div></section>`;
}

/**
 * One feed card. The caption is cut at 70 characters behind "more", which is a
 * span that expands it in place; the comment count links to the post.
 */
export function feedCard(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const profile = `${ROOT}${post.author}/`;
  const account = accountByHandle(post.author);
  const badge = account?.verified ? glyph("badge", cls.verified, "Verified") : "";
  const sub = post.sponsored ? `<span class="${cls.sponsored}">Sponsored</span>` : post.location === "" ? "" : `<span class="${cls.meta}">${escapeHtml(post.location)}</span>`;
  const cut = post.caption.length > 70;
  const caption = cut
    ? `<span>${linkified(post.caption.slice(0, 70))}</span><span hidden>${linkified(post.caption.slice(70))}</span>… <span role="button" tabindex="0" class="${cls.more}">more</span>`
    : `<span>${linkified(post.caption)}</span>`;
  const comments = commentCount(post);
  const learnMore = post.sponsored ? `<a class="${cls.secondary}" style="display:block;margin:6px 0" href="${ROOT}l/?u=${encodeURIComponent(`${post.author.replace(/\W+/gu, "")}.example`)}" target="_blank" rel="noopener">Learn more</a>` : "";
  return `<article class="${cls.card}">
<div class="${cls.cardHead}"><a href="${profile}" tabindex="-1">${avatar(post.author, cls.avatar)}</a><div><div><a class="${cls.handle}" href="${profile}">${escapeHtml(post.author)}</a>${badge} <span class="${cls.meta}">• <a href="${ROOT}p/${post.code}/"><time datetime="${postInstant(post.date)}" title="${tooltipDate(post.date)}">${shortAge(post.date)}</time></a></span></div>${sub}</div><div role="button" tabindex="0" class="${cls.iconButton}" style="margin-left:auto">${glyph("more", cls.navIcon, "More options")}</div></div>
<div class="${cls.media}">${mediaMarkup(ctx, post)}</div>
${learnMore}${actionsMarkup(ctx, post)}${likesMarkup(ctx, post)}
<div class="${cls.caption}"><a class="${cls.handle}" href="${profile}">${escapeHtml(post.author)}</a> ${caption}</div>
${comments === 0 ? "" : `<a class="${cls.commentsLink}" href="${ROOT}p/${post.code}/">View all ${compactCount(comments)} comments</a>`}
<form class="${cls.composer}" style="padding:6px 0;border:0"><textarea class="${cls.composerInput}" aria-label="Add a comment…" placeholder="Add a comment…" autocomplete="off"></textarea><div role="button" tabindex="0" class="${cls.postButton}" aria-disabled="true">Post</div></form>
</article>`;
}

/** Screen `page` of the feed (the first is 0), with the suggestions strip where it falls; empty past the end. */
export function feedBatch(ctx: PageContext, page: number): string {
  const posts = feedPosts();
  const start = page * FEED_BATCH;
  return posts.slice(start, start + FEED_BATCH).map((post, index) => `${feedCard(ctx, post)}${start + index === SUGGESTED_AFTER - 1 ? suggestedStrip(ctx) : ""}`).join("");
}

function storiesMarkup(ctx: PageContext): string {
  const { cls } = ctx.look;
  const handles = ["harbourlight.studio", "lena.moss", "kiln.theory", "saltmarsh.goods", "priya.nair", "theo.marchetti", "kofi.ade", "harbourlight.studios"];
  return `<div class="${cls.stories}">${handles.map((handle) => `<div role="button" tabindex="0" class="${cls.story}" aria-label="Story by ${escapeHtml(handle)}, not seen"><span class="${cls.storyRing}">${avatar(handle, cls.avatar).replace(`class="${cls.avatar}"`, `class="${cls.avatar}" style="width:54px;height:54px"`)}</span><span>${escapeHtml(handle.length > 10 ? `${handle.slice(0, 9)}…` : handle)}</span></div>`).join("")}</div>`;
}

function railMarkup(ctx: PageContext): string {
  const { cls } = ctx.look;
  const viewer = accountByHandle(VIEWER);
  const suggestions = ["harbourlight.studios", "harbourlightstudio_official", "harbour.light.studio", "kilnworks.shop", "glazelab.supply"];
  const rows = suggestions.map((handle) => `<div class="${cls.railRow}">${avatar(handle, cls.avatar)}<div><a class="${cls.handle}" href="${ROOT}${handle}/">${escapeHtml(handle)}</a><div class="${cls.meta}">Suggested for you</div></div><div role="button" tabindex="0" class="${cls.follow}">Follow</div></div>`).join("");
  return `<aside class="${cls.rail}">
<div class="${cls.railRow}">${avatar(VIEWER, cls.avatar)}<div><a class="${cls.handle}" href="${ROOT}${VIEWER}/">${VIEWER}</a><div class="${cls.meta}">${escapeHtml(viewer?.name ?? "")}</div></div><div role="button" tabindex="0" class="${cls.follow}">Switch</div></div>
<div class="${cls.railHead}"><span>Suggested for you</span><a href="${ROOT}explore/people/">See all</a></div>
${rows}
<p class="${cls.footer}">About · Help · Press · API · Jobs · Privacy · Terms · Locations · Language<br><br>© 2026 FRAMELIGHT</p>
</aside>`;
}

/** The home page: stories, the first screen of the feed, and the rail. Later screens load as the visitor scrolls. */
export function homePage(ctx: PageContext): string {
  const { cls } = ctx.look;
  const main = `<div class="${cls.feed}"><section>${storiesMarkup(ctx)}<div>${feedBatch(ctx, 0)}</div><div aria-hidden="true" style="height:1px"></div></section>${railMarkup(ctx)}</div>`;
  return photoDocument(ctx, {
    title: "Framelight",
    main,
    modules: ["feed", "post"],
    page: { kind: "home", pages: Math.ceil(feedPosts().length / FEED_BATCH) },
    appBanner: true,
  });
}
