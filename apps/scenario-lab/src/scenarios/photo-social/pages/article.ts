import { escapeHtml } from "../../../html.js";
import { accountByHandle, gridFor, postDateLabel, postInstant, shortAge, tooltipDate } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Post } from "../types.js";
import { firstComments } from "./comments.js";
import type { PageContext } from "./context.js";
import { avatar, photoAlt, photoSrc } from "./media.js";
import { gridCell } from "./profile.js";
import { photoDocument } from "./shell.js";
import { ROOT, exactCount, linkified } from "./text.js";

/** The images of a post, one showing at a time, with the carousel's own Next and Go back arrows when there is more than one. */
export function mediaMarkup(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const slides = Array.from({ length: post.slides }, (_, index) => `<li${index === 0 ? "" : " hidden"}><img class="${cls.mediaImg}" alt="${escapeHtml(photoAlt(post))}" src="${photoSrc(post, index)}" draggable="false"></li>`).join("");
  const arrows = post.slides < 2 ? "" : `<div role="button" tabindex="0" class="${cls.carouselArrow}" style="left:8px" hidden>${glyph("back", cls.navIcon, "Go back")}</div><div role="button" tabindex="0" class="${cls.carouselArrow}" style="right:8px">${glyph("next", cls.navIcon, "Next")}</div><div class="${cls.dots}">${Array.from({ length: post.slides }, () => `<span class="${cls.dot}"></span>`).join("")}</div>`;
  const play = post.kind === "reel" ? `<span class="${cls.cellBadge}" style="top:50%;left:50%;right:auto">${glyph("play", cls.navIcon, "Play")}</span>` : "";
  return `<ul>${slides}</ul>${arrows}${play}`;
}

/** Like, Comment, Share and Save: four div-buttons named only by their icons, Save pushed to the far right. */
export function actionsMarkup(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const liked = ctx.state.liked.includes(post.code);
  const saved = ctx.state.saved.includes(post.code);
  return `<section class="${cls.actions}"><div role="button" tabindex="0" class="${cls.iconButton}">${glyph("heart", cls.navIcon, liked ? "Unlike" : "Like")}</div><div role="button" tabindex="0" class="${cls.iconButton}">${glyph("comment", cls.navIcon, "Comment")}</div><div role="button" tabindex="0" class="${cls.iconButton}">${glyph("share", cls.navIcon, "Share Post")}</div><div role="button" tabindex="0" class="${cls.iconButton}" style="margin-left:auto">${glyph("bookmark", cls.navIcon, saved ? "Remove" : "Save")}</div></section>`;
}

/** "1,249 likes", or, where the author hides the count, who liked it and "others". */
export function likesMarkup(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  if (post.likes === null) return `<section class="${cls.likes}">Liked by <a href="${ROOT}kiln.theory/">kiln.theory</a> and <a href="${ROOT}p/${post.code}/liked_by/">others</a></section>`;
  return `<section class="${cls.likes}"><a href="${ROOT}p/${post.code}/liked_by/"><span>${exactCount(post.likes)}</span> likes</a></section>`;
}

function followControl(ctx: PageContext, handle: string): string {
  const { cls } = ctx.look;
  if (ctx.state.following.includes(handle)) return `<div role="button" tabindex="0" class="${cls.linkButton}" style="color:#0f1419">Following</div>`;
  return `<div role="button" tabindex="0" class="${cls.linkButton}">Follow</div>`;
}

/**
 * A post as its own page shows it and as the grid's modal shows it: media on
 * the left; on the right the author, the caption, the comments, the actions,
 * the like count, the date and a comment box.
 */
export function articleMarkup(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const author = accountByHandle(post.author);
  const profile = `${ROOT}${post.author}/`;
  const badge = author?.verified ? glyph("badge", cls.verified, "Verified") : "";
  const location = post.location === "" ? "" : `<div class="${cls.meta}"><a href="${ROOT}explore/locations/${encodeURIComponent(post.location.toLowerCase().replace(/[^a-z0-9]+/gu, "-"))}/">${escapeHtml(post.location)}</a></div>`;
  return `<article class="${cls.article}">
<div class="${cls.articleMedia}">${mediaMarkup(ctx, post)}</div>
<div class="${cls.articleSide}">
<header class="${cls.cardHead}" style="padding:10px 16px;border-bottom:1px solid #efefef"><a href="${profile}" tabindex="-1">${avatar(post.author, cls.avatar)}</a><div><div><a class="${cls.handle}" href="${profile}">${escapeHtml(post.author)}</a>${badge} <span class="${cls.meta}">•</span> ${followControl(ctx, post.author)}</div>${location}</div><div role="button" tabindex="0" class="${cls.iconButton}" style="margin-left:auto">${glyph("more", cls.navIcon, "More options")}</div></header>
<div class="${cls.thread}">
<div class="${cls.comment}"><div class="${cls.commentBody}"><a href="${profile}" tabindex="-1">${avatar(post.author, cls.avatar)}</a><div><h3><a href="${profile}">${escapeHtml(post.author)}</a>${badge}</h3><h1 dir="auto" class="${cls.caption}" style="display:inline;font:inherit">${linkified(post.caption)}</h1><div class="${cls.commentMeta}"><time datetime="${postInstant(post.date)}" title="${tooltipDate(post.date)}">${shortAge(post.date)}</time></div></div></div></div>
<ul>${firstComments(ctx, post)}</ul>
</div>
<div style="padding:0 16px">${actionsMarkup(ctx, post)}${likesMarkup(ctx, post)}<div class="${cls.meta}" style="padding:4px 0 10px"><a href="${ROOT}p/${post.code}/"><time datetime="${postInstant(post.date)}" title="${tooltipDate(post.date)}">${postDateLabel(post.date)}</time></a></div></div>
<form class="${cls.composer}"><textarea class="${cls.composerInput}" aria-label="Add a comment…" placeholder="Add a comment…" autocomplete="off"></textarea><div role="button" tabindex="0" class="${cls.postButton}" aria-disabled="true">Post</div></form>
</div>
</article>`;
}

/** A post's own page: the article, then more of the author's posts. */
export function postPage(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const more = gridFor(post.author).filter((other) => other.code !== post.code).slice(0, 6).map((other) => gridCell(ctx, other)).join("");
  const author = accountByHandle(post.author);
  const main = `${articleMarkup(ctx, post)}<section class="${cls.profile}" style="padding-top:0"><h2 class="${cls.meta}">More posts from <a href="${ROOT}${post.author}/">${escapeHtml(post.author)}</a></h2><div class="${cls.grid}">${more}</div></section>`;
  return photoDocument(ctx, {
    title: `${author?.name ?? post.author} on Framelight: "${post.caption.slice(0, 60)}"`,
    main,
    modules: ["post"],
    page: { kind: "post", code: post.code, author: post.author },
  });
}
