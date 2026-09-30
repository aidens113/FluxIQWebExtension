// Every element the activity overlay creates comes from here, so none of them
// can take input: each is `pointer-events: none` and unselectable, whatever
// else it is styled as (decision D5).
//
// Styles are set through the CSSOM, as `picker/overlay.ts` explains: a page's
// `style-src` policy blocks a `style` attribute or a `<style>` element but not
// `style.setProperty`. Every declaration is `!important`. Inside the shadow
// root that changes nothing -- no page rule reaches there -- but the host lives
// in the page's own tree, where a rule such as `* { all: unset !important }`
// would otherwise win.

type Styles = Readonly<Record<string, string>>;

const SVG_NAMESPACE = "http://www.w3.org/2000/svg";

/** The declarations every overlay element carries, before its own. */
const INERT: Styles = Object.freeze({ "pointer-events": "none", "user-select": "none", "-webkit-user-select": "none" });

/**
 * An HTML element of the overlay, inert, styled with `styles` (CSS property
 * names). An `all` reset is applied first whatever its place in `styles`: set
 * after the inert declarations, the shorthand would reset `pointer-events`.
 */
export function inertElement(tag: string, styles: Styles = {}, text?: string): HTMLElement {
  const element = document.createElement(tag);
  const { all, ...rest } = styles;
  applyImportantStyles(element, { ...(all === undefined ? {} : { all }), ...INERT, ...rest });
  if (text !== undefined) element.textContent = text;
  return element;
}

/** An SVG element of the overlay, inert, with its attributes and styles. */
export function inertSvgElement(tag: string, attributes: Readonly<Record<string, string>>, styles: Styles = {}): SVGElement {
  const element = document.createElementNS(SVG_NAMESPACE, tag) as SVGElement;
  for (const [name, value] of Object.entries(attributes)) element.setAttribute(name, value);
  applyImportantStyles(element, { ...INERT, ...styles });
  return element;
}

/** Sets each declaration with `!important`, in order, so a later one overrides an earlier shorthand. */
function applyImportantStyles(element: HTMLElement | SVGElement, styles: Styles): void {
  for (const [property, value] of Object.entries(styles)) element.style.setProperty(property, value, "important");
}
