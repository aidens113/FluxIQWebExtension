// What a control shows when it has no words: a stable digest of its own
// pictorial content (lane 4, t567).
//
// A pressable `<span>` holding an unlabelled `<svg>` has no text, no name, no
// id and one hashed class, so its saved identity was a tag and a lone class --
// which the save-time floor rightly counts as one signal
// (`domain/src/element-fingerprint/signals.ts`, t442 F5) and refuses. What a
// person tells such a control apart by is the picture, so the picture is the
// signal: the same icon drawn twice gives the same digest, a different icon a
// different one.
//
// **What it reads**, in document order, from the element and everything under
// it (open shadow roots included, as a person sees them drawn):
//
// - an `<svg>`'s `viewBox`;
// - each shape's geometry and nothing else: a path's `d`, a circle's, ellipse's,
//   rect's and line's coordinates and radii, a polygon's or polyline's points.
//   Numbers are re-written one way (`1.50` and `1.5` are one number) and
//   separators collapsed, so two copies of one icon written by different
//   templates still agree;
// - the symbol a `<use>` draws (`href` or `xlink:href`, without a query);
// - the source of an `<img>`, an `<input type="image">` or an svg `<image>`:
//   its path, without the query or fragment a CDN or a cache-buster adds;
// - a CSS `background-image` url on the element itself, by the same rule.
//
// **What it never reads** is how the picture is painted: `fill`, `stroke`,
// `class`, `style`, `opacity`, `transform`. A filled and an unfilled heart are
// one control in two states, and a step must find it in either (the domain's
// builder leaves state out of identity, `element-fingerprint/build.ts`).
// `<title>`, `<desc>`, `<style>` and `<script>` inside an svg are words or
// paint, not shapes, and are skipped.
//
// **Only a wordless element has a drawing.** An element with visible text is
// named by its words, which every reader already compares; a picture beside
// them adds nothing a person would say, and a product photo beside a title
// changes from row to row. So any visible text under the element (an svg's
// `<title>` is not visible) means no drawing. So does an element with nothing
// pictorial under it, and one so large that it is a region of pictures rather
// than a control drawn as one: more than `MAX_WALKED` elements or `MAX_PARTS`
// shapes. The walk stops at the first of those it meets, which is what keeps it
// cheap enough to run on every element a snapshot describes.
//
// The digest is a 53-bit string hash of the canonical reading, versioned
// (`d1.`), so a reader can tell a drawing from any other token and a later rule
// can change the reading without two versions comparing equal. It is not a
// secret and holds none: it is computed from the page's own markup.

/** Shape tags and the attributes that are their geometry. */
const SHAPE_GEOMETRY: Readonly<Record<string, readonly string[]>> = {
  path: ["d"],
  circle: ["cx", "cy", "r"],
  ellipse: ["cx", "cy", "rx", "ry"],
  rect: ["x", "y", "width", "height", "rx", "ry"],
  line: ["x1", "y1", "x2", "y2"],
  polygon: ["points"],
  polyline: ["points"]
};

/** Inside an svg, elements that are words or paint rather than shapes: skipped with what they hold. */
const NOT_DRAWN_TAGS: ReadonlySet<string> = new Set(["title", "desc", "style", "script", "metadata", "noscript", "template"]);

/** Elements walked before the element is a region rather than one control. */
const MAX_WALKED = 256;

/** Parts read before the element is a region of pictures rather than one picture. */
const MAX_PARTS = 64;

/** The version prefix every drawing carries. */
const DRAWING_VERSION = "d1.";

/** The digest of what `element` draws, or `undefined` when it has words, draws nothing, or is too large to be one picture. */
export function elementDrawing(element: Element): string | undefined {
  const parts: string[] = [];
  if (!readParts(element, parts, { walked: 0 })) return undefined;
  // Asked last: the computed style is the one costly read, and an element with
  // words has already been turned away.
  const background = backgroundSource(element);
  if (background !== undefined) parts.unshift(`bg:${background}`);
  return parts.length === 0 ? undefined : `${DRAWING_VERSION}${hash(parts.join("\n"))}`;
}

/**
 * Appends what `element` and its insides draw to `parts`, in document order.
 * `false` when the element turned out to have words or to be too large, which
 * means it has no drawing at all.
 */
function readParts(element: Element, parts: string[], walk: { walked: number }): boolean {
  walk.walked += 1;
  if (walk.walked > MAX_WALKED) return false;
  const tag = tagOf(element);
  if (NOT_DRAWN_TAGS.has(tag)) return true;
  const part = ownPart(element, tag);
  if (part !== undefined) {
    parts.push(part);
    if (parts.length > MAX_PARTS) return false;
  }
  const shadow = (element as Element & { shadowRoot?: ShadowRoot | null }).shadowRoot;
  for (const node of [...childNodesOf(shadow), ...childNodesOf(element)]) {
    if (isText(node)) {
      if ((node.nodeValue ?? "").trim() !== "") return false;
      continue;
    }
    if (isElement(node) && !readParts(node, parts, walk)) return false;
  }
  return true;
}

/** The one part an element contributes by itself, or nothing. */
function ownPart(element: Element, tag: string): string | undefined {
  if (tag === "svg") {
    const viewBox = element.getAttribute("viewBox") ?? element.getAttribute("viewbox");
    return viewBox === null ? undefined : `svg:${numbers(viewBox)}`;
  }
  const geometry = SHAPE_GEOMETRY[tag];
  if (geometry !== undefined) {
    const values = geometry.map((name) => `${name}=${numbers(element.getAttribute(name) ?? "")}`);
    return `${tag}:${values.join(";")}`;
  }
  if (tag === "use") {
    const reference = element.getAttribute("href") ?? element.getAttribute("xlink:href");
    return reference === null || reference.trim() === "" ? undefined : `use:${withoutQuery(reference.trim())}`;
  }
  if (tag === "img" || tag === "image" || (tag === "input" && element.getAttribute("type")?.trim().toLowerCase() === "image")) {
    const source = element.getAttribute("src") ?? element.getAttribute("href") ?? element.getAttribute("xlink:href");
    const path = source === null ? undefined : sourcePath(source);
    return path === undefined ? undefined : `src:${path}`;
  }
  return undefined;
}

/** The url of a CSS `background-image` the element paints itself, as a source path; nothing for a gradient or none. */
function backgroundSource(element: Element): string | undefined {
  const view = element.ownerDocument?.defaultView ?? (typeof window === "undefined" ? undefined : window);
  // Nothing computes styles on a unit test's hand-built page, so nothing is painted there.
  if (typeof view?.getComputedStyle !== "function") return undefined;
  const image: unknown = view.getComputedStyle(element).backgroundImage;
  if (typeof image !== "string" || image === "" || image === "none") return undefined;
  const urls = [...image.matchAll(/url\(\s*(?:"([^"]*)"|'([^']*)'|([^)]*?))\s*\)/gu)]
    .map((match) => sourcePath(match[1] ?? match[2] ?? match[3] ?? ""))
    .filter((path): path is string => path !== undefined);
  return urls.length === 0 ? undefined : urls.join(" ");
}

/**
 * A source as a path: without its query and fragment, and for an absolute URL
 * without its origin, since a CDN serves one file from several hosts. A
 * relative source is kept as written, less the same two parts.
 */
function sourcePath(source: string): string | undefined {
  const trimmed = source.trim();
  if (trimmed === "") return undefined;
  if (/^data:/iu.test(trimmed)) return trimmed;
  // The query and fragment off, then a scheme and host (`https://cdn1.x`, `//cdn1.x`) off the front.
  const path = trimmed.replace(/[?#].*$/su, "").replace(/^(?:[a-z][a-z0-9+.-]*:)?\/\/[^/]*/iu, "");
  return path === "" ? undefined : path;
}

/** A reference without its query; the fragment is the symbol it names and stays. */
function withoutQuery(reference: string): string {
  const fragment = reference.indexOf("#");
  const head = fragment < 0 ? reference : reference.slice(0, fragment);
  const tail = fragment < 0 ? "" : reference.slice(fragment);
  return `${head.replace(/\?.*$/su, "")}${tail}`;
}

/**
 * Geometry as one canonical string: each command letter and each number as a
 * token, numbers written the one way JavaScript writes them, single spaces
 * between. `M12,21.35l-1.45-1.32` and `M 12 21.35 l -1.45 -1.320` agree.
 */
function numbers(value: string): string {
  const tokens = value.match(/[a-z]|[-+]?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/giu) ?? [];
  return tokens.map((token) => (/^[a-z]$/iu.test(token) ? token : String(Number(token)))).join(" ");
}

/** A 53-bit string hash (cyrb53), in base 36: stable across runs and browsers, and short. */
function hash(text: string): string {
  let first = 0xdeadbeef;
  let second = 0x41c6ce57;
  for (let index = 0; index < text.length; index += 1) {
    const code = text.charCodeAt(index);
    first = Math.imul(first ^ code, 2654435761);
    second = Math.imul(second ^ code, 1597334677);
  }
  first = Math.imul(first ^ (first >>> 16), 2246822507) ^ Math.imul(second ^ (second >>> 13), 3266489909);
  second = Math.imul(second ^ (second >>> 16), 2246822507) ^ Math.imul(first ^ (first >>> 13), 3266489909);
  return (4294967296 * (2097151 & second) + (first >>> 0)).toString(36);
}

function tagOf(element: Element): string {
  return (element.localName || element.tagName || "").toLowerCase();
}

function childNodesOf(node: Node | null | undefined): Node[] {
  return node?.childNodes ? Array.from(node.childNodes) : [];
}

function isText(node: Node): boolean {
  return node.nodeType === 3;
}

function isElement(node: Node): node is Element {
  return node.nodeType === 1;
}
