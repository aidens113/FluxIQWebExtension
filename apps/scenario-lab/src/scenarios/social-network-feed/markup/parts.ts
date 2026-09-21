import { escapeHtml } from "../../../html.js";

/** The site's root. Every link is written root-relative, so its text is the same on every run's port. */
export const SITE_ROOT = "/scenarios/social-network-feed/";

/**
 * A link the way the site writes one from inside the feed: with the click
 * tracking token a social network appends, derived from the seed and the unit
 * so it changes between builds and between posts, and names nothing.
 */
export function trackedHref(path: string, seed: number, salt: string): string {
  const token = `AZ${hash(`${seed}:${salt}:${path}`)}${hash(`${salt}:${seed}`)}`;
  return `${SITE_ROOT}${path}?__cft__[0]=${token}&__tn__=%2CO%2CP-R`;
}

/**
 * A profile picture: a coloured disc with a head-and-shoulders glyph, and no
 * text, so an avatar adds nothing to the text of the post around it.
 */
export function avatarGraphic(hue: number, size: number): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 40 40" aria-hidden="true"><circle cx="20" cy="20" r="20" fill="hsl(${hue} 45% 55%)"/><circle cx="20" cy="16" r="7" fill="hsl(${hue} 60% 85%)"/><path d="M7 35c3-8 9-11 13-11s10 3 13 11" fill="hsl(${hue} 60% 85%)"/></svg>`;
}

/** A photo as the site serves it: an image with the machine-written alt text a social network generates. */
export function photoSource(hue: number): string {
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 600 300"><defs><linearGradient id="g" x1="0" x2="1" y1="0" y2="1"><stop offset="0" stop-color="hsl(${hue},55%,62%)"/><stop offset="1" stop-color="hsl(${(hue + 40) % 360},45%,38%)"/></linearGradient></defs><rect width="600" height="300" fill="url(#g)"/><circle cx="470" cy="80" r="46" fill="hsla(${hue},80%,92%,.55)"/></svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

/** The glyphs the site draws. Every one is a path, hidden from the accessibility tree, and carries no text. */
export const GLYPHS = {
  dots: "M6 12a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4zm6 0a2 2 0 1 1 0-4 2 2 0 0 1 0 4z",
  cross: "M6 6l12 12M18 6L6 18",
  globe: "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM3 12h18M12 3c3 3 3 15 0 18M12 3c-3 3-3 15 0 18",
  people: "M8 11a3 3 0 1 0 0-6 3 3 0 0 0 0 6zm8 0a3 3 0 1 0 0-6 3 3 0 0 0 0 6zM2 20c1-4 4-6 6-6s5 2 6 6M12 20c1-4 3-6 5-6s4 2 5 6",
  like: "M7 10v10H4V10zm2 10h7.5a2 2 0 0 0 2-1.6l1.3-6A2 2 0 0 0 17.8 10H14l.6-3.4A1.8 1.8 0 0 0 11.3 5L9 10z",
  comment: "M4 5h16v10H9l-5 4z",
  share: "M14 5l6 6-6 6v-4c-5 0-8 1.5-10 5 1-5 4-9 10-10z",
  home: "M3 11l9-7 9 7v9h-6v-6H9v6H3z",
  bell: "M12 3a6 6 0 0 0-6 6v4l-2 3h16l-2-3V9a6 6 0 0 0-6-6zm-2 16a2 2 0 0 0 4 0",
  chat: "M12 3C7 3 3 6.6 3 11c0 2.4 1.1 4.5 3 6v4l3.6-2c.8.2 1.6.3 2.4.3 5 0 9-3.6 9-8.2S17 3 12 3z",
  grid: "M4 4h6v6H4zm10 0h6v6h-6zM4 14h6v6H4zm10 0h6v6h-6z",
  play: "M8 5v14l11-7z",
  send: "M3 20l18-8L3 4v6l12 2-12 2z",
  search: "M10 4a6 6 0 1 0 0 12 6 6 0 0 0 0-12zm9 15l-4.5-4.5",
  video: "M4 6h11v12H4zm11 4l5-3v10l-5-3z",
  photo: "M4 5h16v14H4zm3 10l3-4 3 3 2-2 3 3",
} as const;

export type GlyphName = keyof typeof GLYPHS;

export function glyph(name: GlyphName, size = 20): string {
  return `<svg width="${size}" height="${size}" viewBox="0 0 24 24" aria-hidden="true" focusable="false"><path d="${GLYPHS[name]}" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linejoin="round" stroke-linecap="round"/></svg>`;
}

/** The audience icon beside a timestamp. Its label is the only place the audience is named. */
export function audienceIcon(label: string): string {
  return `<svg width="12" height="12" viewBox="0 0 24 24" role="img" aria-label="${escapeHtml(label)}"><title>${escapeHtml(label.replace(/^Shared with /u, ""))}</title><path d="${GLYPHS.globe}" fill="none" stroke="currentColor" stroke-width="2"/></svg>`;
}

/**
 * The word "Sponsored", written the way large social networks write it to
 * defeat ad blockers: one letter to a span, with hidden decoy letters
 * scattered between them. A person sees "Sponsored"; the element's text, and
 * the accessible name that points at it, read as nonsense that changes with
 * every build.
 */
export function sponsoredLetters(seed: number, salt: string, decoyClass: string): string {
  const decoys = "qzxkvbjwyfhmtgu";
  return [..."Sponsored"].map((letter, index) => {
    const pick = fnv(`${seed}:${salt}:${index}`);
    const decoy = pick % 3 !== 0 ? `<span class="${decoyClass}">${decoys[pick % decoys.length] ?? "x"}</span>` : "";
    return `<span>${letter}</span>${decoy}`;
  }).join("");
}

/** Short and stable: the same inputs give the same token on every run of the same build. */
function hash(text: string): string {
  return fnv(text).toString(36);
}

function fnv(text: string): number {
  let value = 0x811c9dc5;
  for (let index = 0; index < text.length; index += 1) {
    value ^= text.charCodeAt(index);
    value = Math.imul(value, 0x01000193) >>> 0;
  }
  return value;
}
