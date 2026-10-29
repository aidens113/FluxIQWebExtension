// How a covering layer's own controls are worded for a refusal: its buttons,
// icon-only ones included, before the links inside it.
//
// **Why.** A press refused as covered by a dock listed "Lena Moss…",
// "Saltmarsh Goods…" -- message threads, the dock's content -- as "its
// controls", while the icon button in the dock's header that collapses it had
// no words and was skipped (`run-mvswfjbq-d0a95f6e`). So a layer's controls
// are the things a person presses to operate the layer: buttons and the like,
// the header's first. A link inside a layer is its content, said apart from the
// controls and after them, and a control with no words is described by where it
// is, with its accessible name when the page gave it one (`aria-label`, `title`).
// This module only words what `covering-layer.ts` read; it reads no page.

/** What `covering-layer.ts` read of one pressable element on the layer. */
export type LayerControlRead = {
  /** The accessible name or, failing it, the element's words; absent when it has none. */
  name: string | undefined;
  /** Its visible content has no letter or digit: an icon, a glyph, nothing. */
  iconOnly: boolean;
  /** It sits in the top band of the layer, where a layer keeps its close or collapse control. */
  inHeader: boolean;
  /** An anchor or a link role: content of the layer, not a control of it. */
  link: boolean;
};

export type LayerControlWords = {
  controls: string[];
  links: string[];
  moreControls: number;
  moreLinks: number;
};

const MAX_CONTROLS = 5;
const MAX_LINKS = 3;

/** The controls and the links of a layer, worded; header controls first, each group in page order. */
export function layerControlWords(reads: readonly LayerControlRead[]): LayerControlWords {
  const seen = new Set<string>();
  const unique = reads.filter((read) => {
    if (!read.name) return true;
    const key = `${read.link}:${read.name}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
  const controls = unique.filter((read) => !read.link && (read.name !== undefined || read.iconOnly));
  const ordered = [...controls.filter((read) => read.inHeader), ...controls.filter((read) => !read.inHeader)];
  const links = unique.filter((read) => read.link && read.name !== undefined);
  return {
    controls: ordered.slice(0, MAX_CONTROLS).map(describeControl),
    links: links.slice(0, MAX_LINKS).map((read) => `"${read.name}"`),
    moreControls: Math.max(0, ordered.length - MAX_CONTROLS),
    moreLinks: Math.max(0, links.length - MAX_LINKS)
  };
}

function describeControl(read: LayerControlRead): string {
  if (!read.iconOnly) return `"${read.name}"`;
  const where = read.inHeader ? "a control with no words in the layer's header" : "a control with no words";
  return read.name ? `${where}, named "${read.name}"` : where;
}
