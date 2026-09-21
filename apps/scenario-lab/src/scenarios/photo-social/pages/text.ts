import { escapeHtml } from "../../../html.js";

/** Where every Framelight address starts. */
export const ROOT = "/scenarios/photo-social/";

const TOKEN = /(@[a-z0-9._]+[a-z0-9_]|#[a-z0-9_]+)/giu;

/** Text with every mention and hashtag made a link, the way a caption or a comment renders one. */
export function linkified(text: string): string {
  return text.split(TOKEN).map((part, index) => {
    if (index % 2 === 0) return escapeHtml(part);
    if (part.startsWith("@")) return `<a href="${ROOT}${escapeHtml(part.slice(1))}/">${escapeHtml(part)}</a>`;
    return `<a href="${ROOT}explore/tags/${escapeHtml(part.slice(1).toLowerCase())}/">${escapeHtml(part)}</a>`;
  }).join("");
}

/** "1,249": the exact count a post's own page shows. */
export function exactCount(value: number): string {
  return value.toLocaleString("en-US");
}

/**
 * "1.2K": the compact count the grid and the profile header show, rounded
 * down to one decimal, so 1,207 and 1,249 read the same.
 */
export function compactCount(value: number): string {
  if (value < 1000) return String(value);
  const [divisor, suffix] = value < 1_000_000 ? [1000, "K"] : [1_000_000, "M"];
  const tenths = Math.floor((value / divisor) * 10) / 10;
  return `${Number.isInteger(tenths) ? tenths.toFixed(0) : tenths.toFixed(1)}${suffix}`;
}

/** "1 post", "3 posts". */
export function posts(count: number): string {
  return count === 1 ? "1 post" : `${count} posts`;
}
