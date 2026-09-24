import { isVolatileIdentifier, type LookupRoot } from "./selector";

export type ElementFingerprint = {
  selector?: string;
  xpath?: string;
  id?: string;
  classNames?: string[];
  visibleText?: string;
  tagName?: string;
  name?: string;
  attributes?: Record<string, string>;
};

/**
 * Resolves the most stable available part of an element fingerprint, looking
 * in `root`: the document, or the shadow root a recorded target's host chain
 * reached (`selector/shadow/scope.ts`). A recorded xpath is written from the
 * top of the element's own tree, so it is evaluated only against a document --
 * the xpath of an element inside a shadow root names nothing XPath can walk to.
 */
export function findClosestFingerprint(fingerprint: ElementFingerprint, root: LookupRoot = document): Element | null {
  const bySelector = query(root, fingerprint.selector);
  if (bySelector) return bySelector;
  // Checked before it is handed over, because an expression XPath cannot parse
  // makes `document.evaluate` *throw* rather than match nothing -- and a throw
  // here leaves `resolveTarget` altogether and fails the step, where a strategy
  // that found nothing would have let the ones below it run.
  if (fingerprint.xpath && !isShadowRoot(root) && isReadableXpath(fingerprint.xpath)) {
    const result = document.evaluate(fingerprint.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (result instanceof Element) return result;
  }
  if (fingerprint.id) {
    const byId = root.getElementById(fingerprint.id);
    if (byId) return byId;
  }
  const tag = fingerprint.tagName || "*";
  const testId = fingerprint.attributes?.["data-testid"];
  if (testId) {
    const byTestId = query(root, `[data-testid="${cssString(testId)}"]`);
    if (byTestId) return byTestId;
  }
  if (fingerprint.name) {
    const byName = query(root, `${tag}[aria-label="${cssString(fingerprint.name)}"], ${tag}[name="${cssString(fingerprint.name)}"]`);
    if (byName) return byName;
  }
  if (fingerprint.classNames?.length) {
    const byClass = query(root, `${tag}${fingerprint.classNames.map((className) => `.${CSS.escape(className)}`).join("")}`);
    if (byClass) return byClass;
  }
  if (fingerprint.visibleText) {
    const normalized = normalizeText(fingerprint.visibleText);
    return [...root.querySelectorAll(tag)].find((element) => normalizeText(element.textContent ?? "") === normalized) ?? null;
  }
  return null;
}

/**
 * A path that resolves to `element` on a later load of the same page.
 *
 * The walk stops at the first id it meets, because an id is unique and the
 * steps above one only add ways to stop matching. That anchor is a *descendant*
 * step, `//*[@id="x"]`: written with one slash it is an absolute step instead,
 * which XPath reads as "the document element, if its id is x", so every path
 * anchored that way resolved to nothing and `findClosestFingerprint`'s xpath
 * fallback silently never answered for an element carrying an id or sitting
 * under one. With no id anywhere the path is absolute from the root, and there
 * the single slash is correct.
 *
 * An id a rendering generated is walked past rather than anchored on, by the
 * same rule `element-anchors.ts` applies and for the same reason: a path
 * anchored on `:r13b8o:` names nothing on the next rendering, and the steps it
 * skipped were the only part of it that would still have been true.
 */
export function xpathFor(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  let anchored = false;
  while (current) {
    if (current.id && !isVolatileIdentifier(current.id)) {
      parts.unshift(`*[@id=${xpathString(current.id)}]`);
      anchored = true;
      break;
    }
    const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current!.tagName) : [];
    parts.unshift(`${current.tagName.toLowerCase()}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
    current = current.parentElement;
  }
  return `${anchored ? "//" : "/"}${parts.join("/")}`;
}

/**
 * Whether a stored xpath is one XPath can read at all.
 *
 * Until the fix above, `xpathString` escaped a quote inside a string literal as
 * `\"`. XPath 1.0 literals have no escape sequence, so that is not a mis-quoted
 * string but a syntax error, and recordings made before the fix still carry it:
 * an id with a double quote in it was stored as `/*[@id="say\"hi"]`. Handing one
 * of those to `document.evaluate` throws, and the throw propagates out of this
 * function, out of `resolveTarget`, and fails the action -- strictly worse than
 * the strategy finding nothing, because the id, test id, name and class-set
 * lookups below never get their turn. Recognising the shape here turns it back
 * into "this strategy has nothing to offer".
 *
 * It is not a validator. It answers one question -- does a literal try to escape
 * its own delimiter -- by walking the expression the way XPath lexes one: a
 * literal runs from a quote to the next matching quote, with no escape
 * processing in between. That matters because a backslash is an ordinary
 * character in an id: the writer above emits `//*[@id='a\"b']` for an id
 * holding both, and a cruder test for `\"` anywhere would refuse that perfectly
 * readable path.
 */
function isReadableXpath(xpath: string): boolean {
  let delimiter: string | undefined;
  for (let index = 0; index < xpath.length; index += 1) {
    const character = xpath[index];
    if (delimiter === undefined) {
      if (character === `"` || character === `'`) delimiter = character;
      continue;
    }
    if (character === "\\" && xpath[index + 1] === delimiter) return false;
    if (character === delimiter) delimiter = undefined;
  }
  // A literal left open is the same defect seen from the other end: the escape's
  // closing quote was read as the opening one of a literal that never ends.
  return delimiter === undefined;
}

function query(root: LookupRoot, selector: string | undefined): Element | null {
  if (!selector) return null;
  try { return root.querySelector(selector); } catch { return null; }
}

/** A shadow root, told apart by its host: a document has none. */
function isShadowRoot(root: LookupRoot): root is ShadowRoot {
  return "host" in root;
}

function normalizeText(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function cssString(value: string): string { return CSS.escape(value).replace(/"/g, '\\"'); }
/**
 * `value` as an XPath 1.0 string literal.
 *
 * XPath 1.0 literals have no escape sequence at all, so a quote is carried by
 * choosing the delimiter the value does not contain, and by `concat()` when it
 * contains both. Escaping it as `\"` produced a syntax error rather than a
 * mis-quoted string, and `document.evaluate` throws on one of those.
 */
function xpathString(value: string): string {
  if (!value.includes(`"`)) return `"${value}"`;
  if (!value.includes(`'`)) return `'${value}'`;
  // Split on the double quotes: no fragment can then contain one, so each is
  // double-quoted, and the separators are contributed as single-quoted literals.
  return `concat(${value.split(`"`).map((fragment) => `"${fragment}"`).join(`, '"', `)})`;
}
