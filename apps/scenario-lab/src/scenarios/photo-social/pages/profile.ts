import { escapeHtml } from "../../../html.js";
import { VIEWER, commentCount, gridFor } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Account, Post } from "../types.js";
import type { PageContext } from "./context.js";
import { avatar, photoAlt, photoSrc } from "./media.js";
import { sessionWallMarkup } from "./overlays.js";
import { photoDocument } from "./shell.js";
import { ROOT, compactCount, exactCount } from "./text.js";

type ProfileAccount = Account;

/** Grid cells a profile shows per screen, and how many screens load before the session check. */
export const GRID_BATCH = 12;
export const GRID_BEFORE_SESSION_CHECK = 24;

/**
 * One grid cell: a link to the post around its thumbnail. The type badges are
 * icons named by their labels. The like and comment counts are the hover
 * overlay's, compact and rounded down, and a reel shows its play count instead
 * of its likes.
 */
export function gridCell(ctx: PageContext, post: Post): string {
  const { cls } = ctx.look;
  const badge = post.pinned ? glyph("pin", cls.cellBadge, "Pinned post icon") : post.kind === "carousel" ? glyph("stack", cls.cellBadge, "Carousel") : post.kind === "reel" ? glyph("reels", cls.cellBadge, "Clip") : "";
  const first = post.kind === "reel"
    ? `<li>${glyph("play", cls.navIcon)}<span>${compactCount(post.plays)}</span></li>`
    : post.likes === null ? "" : `<li>${glyph("heart", cls.navIcon)}<span>${compactCount(post.likes)}</span></li>`;
  return `<a class="${cls.cell}" href="${ROOT}p/${post.code}/" role="link" tabindex="0"><img class="${cls.cellImg}" alt="${escapeHtml(photoAlt(post))}" src="${photoSrc(post, 0)}" draggable="false">${badge}<ul class="${cls.cellOverlay}">${first}<li>${glyph("comment", cls.navIcon)}<span>${compactCount(commentCount(post))}</span></li></ul></a>`;
}

/**
 * Grid cells from `offset` on, one screen of them, or the session check once
 * two screens have loaded and the session has not been confirmed; 204 past
 * the end.
 */
export function gridBatch(ctx: PageContext, handle: string, offset: number, reelsOnly: boolean): { status: number; body: string } {
  const posts = gridFor(handle).filter((post) => !reelsOnly || post.kind === "reel");
  if (offset >= posts.length) return { status: 204, body: "" };
  if (offset >= GRID_BEFORE_SESSION_CHECK && !ctx.state.sessionConfirmed) return { status: 401, body: sessionWallMarkup(ctx) };
  return { status: 200, body: posts.slice(offset, offset + GRID_BATCH).map((post) => gridCell(ctx, post)).join("") };
}

function headerMarkup(ctx: PageContext, account: ProfileAccount): string {
  const { cls } = ctx.look;
  const own = account.handle === VIEWER;
  const badge = account.verified ? glyph("badge", cls.verified, "Verified") : "";
  const following = ctx.state.following.includes(account.handle);
  const controls = own
    ? `<a class="${cls.secondary}" href="${ROOT}accounts/edit/">Edit profile</a> <a class="${cls.secondary}" href="${ROOT}${VIEWER}/saved/">Saved</a>`
    : `<div role="button" tabindex="0" class="${following ? cls.secondary : cls.primary}">${following ? `Following ${glyph("chevronDown", cls.navIcon)}` : "Follow"}</div> <div role="button" tabindex="0" class="${cls.secondary}">Message</div> <div role="button" tabindex="0" class="${cls.iconButton}">${glyph("more", cls.navIcon, "Options")}</div>`;
  const postCount = gridFor(account.handle).length;
  const link = account.link === "" ? "" : `<a class="${cls.linkButton}" href="${ROOT}l/?u=${encodeURIComponent(account.link)}" target="_blank" rel="noopener">${escapeHtml(account.link)}</a>`;
  return `<header class="${cls.profileHead}">
${avatar(account.handle, cls.avatarLarge)}
<section>
<div style="display:flex;align-items:center;gap:12px"><h2 style="font-size:20px;font-weight:400;margin:0">${escapeHtml(account.handle)}</h2>${badge} ${controls}</div>
<ul class="${cls.profileStats}"><li><span><span>${exactCount(postCount)}</span> posts</span></li><li><a href="${ROOT}${account.handle}/followers/"><span title="${exactCount(account.followers)}">${compactCount(account.followers)}</span> followers</a></li><li><a href="${ROOT}${account.handle}/following/"><span>${exactCount(account.following)}</span> following</a></li></ul>
<div><span style="font-weight:600">${escapeHtml(account.name)}</span>${account.category === "" ? "" : `<div class="${cls.meta}">${escapeHtml(account.category)}</div>`}<div class="${cls.bio}">${escapeHtml(account.bio)}</div>${link}</div>
</section>
</header>`;
}

/**
 * A profile: the header, the tabs, and the first screen of the grid. The rest
 * of the grid loads as the visitor scrolls, one screen at a time, and the third
 * screen waits behind the session check.
 */
export function profilePage(ctx: PageContext, account: ProfileAccount, tab: "posts" | "reels" | "tagged"): string {
  const { cls } = ctx.look;
  const posts = tab === "tagged" ? [] : gridFor(account.handle).filter((post) => tab === "posts" || post.kind === "reel");
  const cells = posts.slice(0, GRID_BATCH).map((post) => gridCell(ctx, post)).join("");
  const tabLink = (id: typeof tab, label: string, href: string) => `<a role="tab" class="${cls.tab}" aria-selected="${tab === id}" href="${href}">${label}</a>`;
  const empty = posts.length === 0 ? `<p class="${cls.meta}" style="text-align:center;padding:40px">${tab === "tagged" ? "Photos of you will appear here." : "No posts yet"}</p>` : "";
  const main = `<div class="${cls.profile}">
${headerMarkup(ctx, account)}
<div class="${cls.tabs}" role="tablist">${tabLink("posts", "Posts", `${ROOT}${account.handle}/`)}${tabLink("reels", "Reels", `${ROOT}${account.handle}/reels/`)}${tabLink("tagged", "Tagged", `${ROOT}${account.handle}/tagged/`)}</div>
<div class="${cls.grid}">${cells}</div>${empty}
<div aria-hidden="true" style="height:1px"></div>
</div>`;
  return photoDocument(ctx, {
    title: `${account.name} (@${account.handle}) • Framelight photos and videos`,
    main,
    modules: ["grid", "post"],
    page: { kind: "profile", handle: account.handle, tab, total: posts.length, loaded: Math.min(posts.length, GRID_BATCH) },
  });
}
