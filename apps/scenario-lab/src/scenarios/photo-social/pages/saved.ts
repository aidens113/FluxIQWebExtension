import { escapeHtml } from "../../../html.js";
import { VIEWER, postByCode } from "../data/index.js";
import { glyph } from "../look/index.js";
import type { Collection, Post } from "../types.js";
import type { PageContext } from "./context.js";
import { photoSrc } from "./media.js";
import { gridCell } from "./profile.js";
import { photoDocument } from "./shell.js";
import { ROOT, posts } from "./text.js";

const known = (codes: readonly string[]): Post[] => codes.map((code) => postByCode(code)).filter((post): post is Post => post !== undefined);

function tile(ctx: PageContext, name: string, href: string, codes: readonly string[]): string {
  const { cls } = ctx.look;
  const covers = known(codes).slice(0, 4).map((post) => `<img alt="" src="${photoSrc(post, 0)}" style="width:50%;aspect-ratio:1;object-fit:cover;display:block;float:left">`).join("");
  return `<a class="${cls.tile}" href="${href}"><div style="overflow:hidden;border-radius:8px;background:#efefef;aspect-ratio:1">${covers}</div><span class="${cls.handle}">${escapeHtml(name)}</span><span class="${cls.meta}">${posts(codes.length)}</span></a>`;
}

/**
 * The visitor's saved posts: "All posts" and one tile per collection, with
 * counts that are current, unlike the save dialog's. "New collection" names a
 * collection and then picks what goes in it from saved posts.
 */
export function savedPage(ctx: PageContext): string {
  const { cls } = ctx.look;
  const tiles = [tile(ctx, "All posts", `${ROOT}${VIEWER}/saved/all-posts/`, [...ctx.state.saved].reverse()), ...ctx.state.collections.map((collection) => tile(ctx, collection.name, `${ROOT}${VIEWER}/saved/${collection.slug}/`, collection.codes))].join("");
  const main = `<div class="${cls.saved}"><div style="display:flex;align-items:center;justify-content:space-between"><h1 style="font-size:20px">Saved</h1><div role="button" tabindex="0" class="${cls.linkButton}">${glyph("plus", cls.navIcon)} New collection</div></div><p class="${cls.meta}">Only you can see what you've saved</p><div style="display:grid;grid-template-columns:repeat(3,1fr);gap:20px">${tiles}</div></div>`;
  return photoDocument(ctx, { title: "Saved • Framelight", main, modules: ["saved"], page: { kind: "saved" } });
}

/**
 * One collection's posts. "Add from saved" picks further posts from what is
 * already saved; after it the page reloads and says how many were added.
 */
export function collectionPage(ctx: PageContext, collection: Collection | "all-posts", added: number): string {
  const { cls } = ctx.look;
  const name = collection === "all-posts" ? "All posts" : collection.name;
  const codes = collection === "all-posts" ? [...ctx.state.saved].reverse() : collection.codes;
  const cells = known(codes).map((post) => gridCell(ctx, post)).join("");
  const add = collection === "all-posts" ? "" : `<div role="button" tabindex="0" class="${cls.linkButton}">Add from saved</div>`;
  const toast = added > 0 && collection !== "all-posts" ? `<div class="${cls.toast}" role="status">${added === 1 ? `Added to ${escapeHtml(name)}` : `${added} posts added to ${escapeHtml(name)}`}</div>` : "";
  const main = `<div class="${cls.saved}"><a class="${cls.meta}" href="${ROOT}${VIEWER}/saved/">${glyph("back", cls.navIcon)} Saved</a><div style="display:flex;align-items:center;justify-content:space-between"><h1 style="font-size:20px">${escapeHtml(name)}</h1>${add}</div><div class="${cls.grid}">${cells}</div>${codes.length === 0 ? `<p class="${cls.meta}">Nothing saved here yet.</p>` : ""}</div>${toast}`;
  return photoDocument(ctx, { title: `${name} • Saved`, main, modules: ["saved"], page: { kind: "collection", slug: collection === "all-posts" ? "all-posts" : collection.slug, name } });
}
