import { fnv, type CategorySlug } from "../catalog/index.js";

/**
 * A listing photo as an inline SVG, which is the only kind of image the lab's
 * content policy lets a page carry. The picture is chosen by the title, not
 * the listing, so two listings with the same title -- a repost, or a
 * reseller's copy -- carry the same photo, as they do on a real marketplace.
 */
export function photoFor(title: string, category: CategorySlug | "advert"): string {
  const hue = fnv(title) % 360;
  const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200"><rect width="200" height="200" fill="hsl(${hue},32%,82%)"/>${glyph(category, hue)}</svg>`;
  return `data:image/svg+xml,${encodeURIComponent(svg)}`;
}

function glyph(category: CategorySlug | "advert", hue: number): string {
  const ink = `hsl(${hue},40%,28%)`;
  if (category === "bicycles") {
    return `<g fill="none" stroke="${ink}" stroke-width="6"><circle cx="55" cy="125" r="32"/><circle cx="145" cy="125" r="32"/><path d="M55 125 L90 75 L130 75 L145 125 M90 75 L100 125 L55 125 M125 60 L140 60"/></g>`;
  }
  if (category === "furniture") {
    return `<g fill="${ink}"><rect x="30" y="80" width="140" height="14" rx="3"/><rect x="42" y="94" width="10" height="60"/><rect x="148" y="94" width="10" height="60"/></g>`;
  }
  if (category === "home-goods") {
    return `<g fill="${ink}"><path d="M70 60 L130 60 L145 105 L55 105 Z"/><rect x="96" y="105" width="8" height="45"/><rect x="72" y="150" width="56" height="10" rx="3"/></g>`;
  }
  if (category === "electronics") {
    return `<g fill="${ink}"><rect x="40" y="55" width="120" height="80" rx="6"/><rect x="90" y="135" width="20" height="18"/><rect x="70" y="153" width="60" height="8" rx="3"/></g>`;
  }
  if (category === "advert") {
    return `<g fill="${ink}"><circle cx="100" cy="100" r="46"/><text x="100" y="112" font-size="34" text-anchor="middle" fill="#fff" font-family="sans-serif">NEW</text></g>`;
  }
  return `<g fill="${ink}"><rect x="55" y="55" width="90" height="90" rx="10"/></g>`;
}
