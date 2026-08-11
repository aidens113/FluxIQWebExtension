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

/** Resolves the most stable available part of an element fingerprint. */
export function findClosestFingerprint(fingerprint: ElementFingerprint): Element | null {
  const bySelector = query(fingerprint.selector);
  if (bySelector) return bySelector;
  if (fingerprint.xpath) {
    const result = document.evaluate(fingerprint.xpath, document, null, XPathResult.FIRST_ORDERED_NODE_TYPE, null).singleNodeValue;
    if (result instanceof Element) return result;
  }
  if (fingerprint.id) {
    const byId = document.getElementById(fingerprint.id);
    if (byId) return byId;
  }
  const tag = fingerprint.tagName || "*";
  const testId = fingerprint.attributes?.["data-testid"];
  if (testId) {
    const byTestId = query(`[data-testid="${cssString(testId)}"]`);
    if (byTestId) return byTestId;
  }
  if (fingerprint.name) {
    const byName = query(`${tag}[aria-label="${cssString(fingerprint.name)}"], ${tag}[name="${cssString(fingerprint.name)}"]`);
    if (byName) return byName;
  }
  if (fingerprint.classNames?.length) {
    const byClass = query(`${tag}${fingerprint.classNames.map((className) => `.${CSS.escape(className)}`).join("")}`);
    if (byClass) return byClass;
  }
  if (fingerprint.visibleText) {
    const normalized = normalizeText(fingerprint.visibleText);
    return [...document.querySelectorAll(tag)].find((element) => normalizeText(element.textContent ?? "") === normalized) ?? null;
  }
  return null;
}

export function xpathFor(element: Element): string {
  const parts: string[] = [];
  let current: Element | null = element;
  while (current) {
    if (current.id) {
      parts.unshift(`*[@id=${xpathString(current.id)}]`);
      break;
    }
    const siblings = current.parentElement ? [...current.parentElement.children].filter((sibling) => sibling.tagName === current!.tagName) : [];
    parts.unshift(`${current.tagName.toLowerCase()}[${Math.max(1, siblings.indexOf(current) + 1)}]`);
    current = current.parentElement;
  }
  return `/${parts.join("/")}`;
}

function query(selector: string | undefined): Element | null {
  if (!selector) return null;
  try { return document.querySelector(selector); } catch { return null; }
}

function normalizeText(value: string): string { return value.replace(/\s+/g, " ").trim(); }
function cssString(value: string): string { return CSS.escape(value).replace(/"/g, '\\"'); }
function xpathString(value: string): string { return `"${value.replace(/"/g, '\\"')}"`; }
