// The identifiers a selector that has already been written down is addressed
// through: each `#id` it quotes, and each `[attribute="value"]` whose attribute
// is one an author names an element by -- `id`, the test ids `element-anchors.ts`
// writes, and `name`.
//
// Read back out of the string, because by the time anyone asks the element the
// selector was built for is gone and the string is all there is. The question
// asked of them is the one `identity/score.ts` puts to a recorded selector: does
// any element on the page still carry this token? A selector addressed through
// a token nothing carries names nothing, whatever shape the token has, so it is
// no evidence about which candidate is the recorded control.
//
// Class names, tags and positions are not quoted identifiers. A class is shared
// by design and a step's position is structure; neither names one element, so
// neither going missing says the selector's element is gone.
//
// CSS escapes are undone, so the value is what the attribute holds: `#\31 23`
// is the id `123` and `#\:r1\:` is `:r1:`. It reads a string. It never reads the
// page.

/** One identifier a selector quotes: the attribute that carries it, and the value it must hold. */
export type QuotedAnchor = {
  attribute: string;
  value: string;
  /** How the selector wrote it, for a reader who has the selector in front of them. */
  written: string;
};

/** The attributes an author names one element by. */
const ANCHOR_ATTRIBUTES: ReadonlySet<string> = new Set(["id", "data-testid", "data-test", "data-cy", "name"]);

/** `#` and an identifier, escapes included: a backslash before anything, or a hex escape with its optional trailing space. */
const ID_SELECTOR = /#((?:\\[0-9a-fA-F]{1,6}[ \t\n\r\f]?|\\[^\n\r\f0-9a-fA-F]|[\w-]|[^\x00-\x7F])+)/gu;

/** `[attribute="value"]` or `[attribute='value']`, exact match only: `^=`, `*=` and the rest name a family, not an element. */
const ATTRIBUTE_SELECTOR = /\[\s*([A-Za-z_][\w-]*)\s*=\s*(?:"((?:\\.|[^"\\])*)"|'((?:\\.|[^'\\])*)')\s*(?:[iIsS]\s*)?\]/gu;

/** A CSS escape: a hex code point and the one whitespace that may end it, or any other escaped character. */
const CSS_ESCAPE = /\\([0-9a-fA-F]{1,6})[ \t\n\r\f]?|\\(.)/gsu;

/** Every identifier `selector` is addressed through: its attribute anchors, then its ids. */
export function quotedAnchors(selector: string): QuotedAnchor[] {
  const anchors: QuotedAnchor[] = [];
  // Quoted strings are removed before ids are looked for, so a `#` inside an
  // attribute value -- `[href="#top"]` -- is not read as an id selector.
  const unquoted = selector.replace(ATTRIBUTE_SELECTOR, (written, attribute: string, doubled?: string, single?: string) => {
    const name = attribute.toLowerCase();
    const value = unescapeCss(doubled ?? single ?? "");
    if (ANCHOR_ATTRIBUTES.has(name) && value) anchors.push({ attribute: name, value, written });
    return " ".repeat(written.length);
  });
  for (const match of unquoted.matchAll(ID_SELECTOR)) {
    const value = unescapeCss(match[1] ?? "");
    if (value) anchors.push({ attribute: "id", value, written: match[0] });
  }
  return anchors;
}

function unescapeCss(value: string): string {
  return value.replace(CSS_ESCAPE, (_escape, hex?: string, character?: string) => {
    if (hex === undefined) return character ?? "";
    const codePoint = Number.parseInt(hex, 16);
    return codePoint > 0 && codePoint <= 0x10ffff ? String.fromCodePoint(codePoint) : "\uFFFD";
  });
}
