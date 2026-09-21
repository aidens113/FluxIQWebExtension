import { escapeHtml } from "../../../html.js";
import { accountByHandle, commentsFor, shortAge, tooltipDate } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Comment, Post } from "../types.js";
import type { PageContext } from "./context.js";
import { avatar } from "./media.js";
import { ROOT, linkified } from "./text.js";

/** Comments a post shows before "Load more comments", and how many each press adds. */
export const COMMENT_BATCH = 12;

function verifiedBadge(ctx: PageContext, handle: string): string {
  return accountByHandle(handle)?.verified ? glyph("badge", ctx.look.cls.verified, "Verified") : "";
}

/**
 * One comment. The author's row is the item's first child and holds its
 * permalink, whose `<time>` carries the day and a tooltip; the reply toggle and
 * the replies come after it, so nothing of a reply sits inside the row. Replies
 * are not in the page until they are opened.
 */
export function commentItem(ctx: PageContext, post: Post, comment: Comment): string {
  const { cls } = ctx.look;
  const profile = `${ROOT}${comment.author}/`;
  const likes = comment.likes === 0 ? "" : `<span>${comment.likes === 1 ? "1 like" : `${comment.likes} likes`}</span>`;
  const pinned = comment.pinned ? `<span>${glyph("pin", cls.navIcon)}Pinned</span>` : "";
  const toggle = comment.replies.length === 0 ? "" : `<div role="button" tabindex="0" class="${cls.repliesToggle}">View replies (${comment.replies.length})</div><ul class="${cls.replies}"></ul>`;
  return `<li class="${cls.comment}"><div class="${cls.commentBody}"><a href="${profile}" tabindex="-1">${avatar(comment.author, cls.avatar)}</a><div><h3><a href="${profile}">${escapeHtml(comment.author)}</a>${verifiedBadge(ctx, comment.author)}</h3><span dir="auto">${linkified(comment.text)}</span><div class="${cls.commentMeta}"><a href="${ROOT}p/${post.code}/c/${comment.id}/"><time datetime="${comment.date}" title="${tooltipDate(comment.date)}">${shortAge(comment.date)}</time></a>${likes}${pinned}<div role="button" tabindex="0">Reply</div></div></div><div role="button" tabindex="0" class="${cls.iconButton}">${glyph("heart", cls.navIcon, "Like")}</div></div>${toggle}</li>`;
}

/** The "Load more comments" control: a circled plus whose only name is its icon's label. */
function loadMore(ctx: PageContext): string {
  const { cls } = ctx.look;
  return `<li><div role="button" tabindex="0" class="${cls.loadMore}">${glyph("plus", cls.navIcon, "Load more comments")}</div></li>`;
}

/**
 * A post's first screen of comments. The pinned comment leads and does not
 * count against the batch, so the first press of "Load more comments" always
 * brings the thirteenth ordinary comment.
 */
export function firstComments(ctx: PageContext, post: Post): string {
  const comments = commentsFor(post);
  const pinned = comments.filter((comment) => comment.pinned);
  const rest = comments.filter((comment) => !comment.pinned);
  const shown = rest.slice(0, COMMENT_BATCH).map((comment) => commentItem(ctx, post, comment)).join("");
  return `${pinned.map((comment) => commentItem(ctx, post, comment)).join("")}${shown}${rest.length > COMMENT_BATCH ? loadMore(ctx) : ""}`;
}

/** A later batch, counted among the ordinary comments. */
export function laterComments(ctx: PageContext, post: Post, offset: number): string {
  const rest = commentsFor(post).filter((comment) => !comment.pinned);
  const batch = rest.slice(offset, offset + COMMENT_BATCH).map((comment) => commentItem(ctx, post, comment)).join("");
  return `${batch}${offset + COMMENT_BATCH < rest.length ? loadMore(ctx) : ""}`;
}

/** The replies under one comment, oldest first, or `undefined` for a comment the post does not have. */
export function repliesMarkup(ctx: PageContext, post: Post, commentId: string): string | undefined {
  const parent = commentsFor(post).find((comment) => comment.id === commentId);
  return parent?.replies.map((reply) => commentItem(ctx, post, reply)).join("");
}
