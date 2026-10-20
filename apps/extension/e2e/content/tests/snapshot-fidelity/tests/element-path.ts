// Where an element sits, written so that a live page and its offline capture
// give the same answer for the same element: each step is a tag and its index
// among same-tag siblings, ignoring the elements a capture adds or drops
// (script, noscript, style, link, meta, base, template), with `#shadow` where
// the path crosses into an open shadow root. Runs through `page.evaluate`, so
// it is self-contained.
//
// `anchored` is the same path from the nearest landmark-like ancestor (an
// element with an id, or main, header, footer, nav, aside, form, dialog),
// written with that anchor's tag and id: one element inserted high in the
// tree -- a banner a script added after the capture -- shifts every full path
// below it, and the anchored one not at all.
//
// The element is found from a resolved descriptor's selector, inside the
// shadow-host chain it names when it has one. `null` when the selector names
// nothing, or more than one element, at that place.

export type ElementPath = { full: string; anchored: string };

export function elementPaths(targets: Array<{ selector: string; shadowHosts?: string[] | undefined }>): Array<ElementPath | null> {
  const ANCHORS = new Set(["main", "header", "footer", "nav", "aside", "form", "dialog"]);
  const IGNORED = new Set(["script", "noscript", "style", "link", "meta", "base", "template"]);
  const find = (selector: string, hosts: string[] | undefined): Element | null => {
    let scope: Document | ShadowRoot = document;
    for (const host of hosts ?? []) {
      const found: Element | null = scope.querySelector(host);
      if (!found?.shadowRoot) return null;
      scope = found.shadowRoot;
    }
    try {
      const matches = scope.querySelectorAll(selector);
      return matches.length === 1 ? matches[0]! : null;
    } catch {
      return null;
    }
  };
  const path = (element: Element): ElementPath => {
    const steps: string[] = [];
    let anchored: string | undefined;
    let current: Element | null = element;
    while (current) {
      if (anchored === undefined && current !== element && (current.id || ANCHORS.has(current.localName))) {
        anchored = [`${current.localName}#${current.id}`, ...steps].join("/");
      }
      const parent: Node | null = current.parentNode;
      const tag = current.localName;
      const siblings = parent ? Array.from(parent.childNodes).filter((node): node is Element => node.nodeType === Node.ELEMENT_NODE && (node as Element).localName === tag && !IGNORED.has(tag)) : [];
      steps.unshift(`${tag}:${Math.max(0, siblings.indexOf(current))}`);
      if (parent instanceof ShadowRoot) {
        steps.unshift("#shadow");
        current = parent.host;
      } else {
        current = parent instanceof Element ? parent : null;
      }
    }
    const full = steps.join("/");
    return { full, anchored: anchored ?? full };
  };
  return targets.map((target) => {
    const element = find(target.selector, target.shadowHosts);
    return element ? path(element) : null;
  });
}
