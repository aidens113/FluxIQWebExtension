// Text from the recording log or from a generated Flow, as words a person can
// read, or undefined when it is not words.
//
// Both sources can carry machine text: a recorded step's detail falls back to
// the element's CSS selector when it has no name, and a Flow node may be
// labelled with its id. Simple Mode never shows a selector, an XPath, an id or
// a URL, so anything that looks like one is dropped rather than shown.

const TECHNICAL: readonly RegExp[] = [
  /^[#.[/>~*@]/, // starts like a selector, an XPath or an attribute
  /[[\]{}<>=]/, // attribute selectors, markup, key=value
  /::|\/\/|:(?:has|not|nth-[a-z-]+)\(|nth-(?:child|of-type)/i,
  /^[a-z][a-z0-9]*[.#][\w-]/i, // tag.class or tag#id
  /^[a-z][\w-]*(?:\s*>\s*|\s+[.#])[\w.#-]/i, // descendant or child combinators
  /^\w+(?:\.\w+){2,}$/, // dotted ids such as dom.click.1727000000
  /^[0-9a-f]{8,}(?:-[0-9a-f]+)*$/i // hex and uuid ids
];

// A single token with no space is a name only if it reads like a word: an
// underscore, or hyphens between lowercase parts ("add-to-cart"), or digits
// mixed into letters ("btn42") make it an id.
function looksLikeIdToken(text: string): boolean {
  if (/\s/.test(text)) return false;
  return text.includes("_") || /^[a-z0-9]+(?:-[a-z0-9]+)+$/.test(text) || (/\d/.test(text) && /[a-z]/i.test(text) && text.length >= 6);
}

/** `raw` with its whitespace collapsed and cut to `max` characters, or undefined when it is empty, not text, or looks technical. */
export function plainWords(raw: unknown, max = 60): string | undefined {
  if (typeof raw !== "string") return undefined;
  const text = raw.replace(/\s+/g, " ").trim();
  if (text === "" || looksLikeIdToken(text) || TECHNICAL.some((pattern) => pattern.test(text))) return undefined;
  return text.length > max ? `${text.slice(0, max - 3).trimEnd()}...` : text;
}
