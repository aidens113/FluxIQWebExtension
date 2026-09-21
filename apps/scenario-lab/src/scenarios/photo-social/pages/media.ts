import { escapeHtml } from "../../../html.js";
import { accountByHandle, longDate } from "../data/index.js";
import type { Post } from "../types.js";

function mix(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}

function svgUri(svg: string): string {
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** A photo: a gradient and a glazed form, coloured by the post and the slide, so no two look alike. */
export function photoSrc(post: Post, slide: number): string {
  const value = mix(`${post.code}:${slide}`);
  const hue = value % 360;
  const second = (hue + 40 + ((value >>> 9) % 80)) % 360;
  const radius = 18 + ((value >>> 3) % 16);
  return svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 100"><defs><linearGradient id="g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="hsl(${hue},45%,72%)"/><stop offset="1" stop-color="hsl(${second},40%,38%)"/></linearGradient></defs><rect width="100" height="100" fill="url(#g)"/><ellipse cx="50" cy="58" rx="${radius}" ry="${radius + 8}" fill="hsl(${second},30%,88%)" opacity=".85"/></svg>`);
}

/** The automatic alt text a photo gets: who posted it, when, and a guess at what it shows. */
export function photoAlt(post: Post): string {
  const name = accountByHandle(post.author)?.name ?? post.author;
  if (post.kind === "reel") return `Reel by ${name} on ${longDate(post.date)}.`;
  return `Photo by ${name} on ${longDate(post.date)}. May be an image of ${post.subject}.`;
}

/** A round avatar with the account's initials, as an image with the alt text profile pictures carry. */
export function avatar(handle: string, className: string): string {
  const account = accountByHandle(handle);
  const hue = account?.hue ?? mix(handle) % 360;
  const initials = (account?.name ?? handle).split(/\s+/u).map((word) => word[0] ?? "").join("").slice(0, 2).toUpperCase();
  const src = svgUri(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 40 40"><circle cx="20" cy="20" r="20" fill="hsl(${hue},55%,62%)"/><text x="20" y="25" font-size="14" text-anchor="middle" fill="#fff" font-family="sans-serif">${escapeHtml(initials)}</text></svg>`);
  return `<img class="${className}" alt="${escapeHtml(handle)}'s profile picture" src="${src}" draggable="false">`;
}
