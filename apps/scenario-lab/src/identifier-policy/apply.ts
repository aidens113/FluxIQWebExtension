import type { IdentifierPolicy } from "./policies.js";

/**
 * The attributes a recorder treats as a test id, and what each becomes.
 *
 * `describe-element.ts` puts the first of these it finds on the wire as
 * `testId`, and its `attributes` allowlist carries all three, so all three
 * have to go.
 *
 * They are **renamed rather than deleted**, and that distinction is the whole
 * honesty of this transform. A fixture's client script finds its own controls
 * with `document.querySelector('[data-testid="…"]')` because a fixture has no
 * framework to hold a ref for it; a real application holds the node itself and
 * needs no attribute at all. Deleting the attribute would therefore not model
 * a production build -- it would break the page. Renaming models it exactly:
 * the page's own wiring survives, and the DOM carries no attribute any
 * recorder, selector builder or fingerprint in this repository can see.
 * Nothing reads the new names -- `selectorFor` prefers `#id`, then
 * `[data-testid]`, then `[name]`, then a positional chain, and the
 * descriptor's attribute allowlist does not include them.
 *
 * Each source attribute gets a name of its own, so an element carrying two of
 * them does not come out of the transform with one attribute written twice.
 */
const APPLICATION_HOOKS: Readonly<Record<string, string>> = {
  "data-testid": "data-fx-node",
  "data-test": "data-fx-alt",
  "data-cy": "data-fx-ref",
};

/**
 * Attributes whose value is an id, or a space-separated list of them. Rewritten
 * alongside the ids they point at, so the accessibility tree an identifier-less
 * rendering exposes is the same one the authored rendering does -- which is
 * what keeps `accessibleName` in the comparison and the measurement about
 * identifiers alone.
 */
const ID_REFERENCE_ATTRIBUTES = [
  "for", "form", "list", "headers", "aria-labelledby", "aria-describedby",
  "aria-controls", "aria-owns", "aria-activedescendant", "aria-details",
  "aria-errormessage", "aria-flowto",
] as const;

/** An id this transform can rewrite: a literal, not a fragment of a template the browser will finish. */
const LITERAL_ID = /^[A-Za-z][\w.:-]*$/u;

/**
 * Renders `document` under `policy`.
 *
 * It runs over the whole served document, markup and inline script together,
 * on purpose: a fixture's client script builds rows and panels from strings
 * that carry the same attributes the served markup does, and a transform that
 * saw only the markup would leave every client-rendered control labelled.
 *
 * **What it cannot reach**: an id a client script composes at runtime
 * (`id="' + memberId + '"`). Those are skipped, along with every reference to
 * them, so the page stays self-consistent -- but a rendering whose recorded
 * targets carry client-composed ids is not fully identifier-less, and a fixture
 * relying on that must say so.
 */
export function applyIdentifierPolicy(document: string, policy: IdentifierPolicy): string {
  if (policy === "as-authored") return document;
  const withoutTestIds = removeTestIds(document);
  return policy === "no-identifiers" ? generateIds(withoutTestIds) : withoutTestIds;
}

/** Every test id attribute becomes the application's own node handle, in markup and in script alike. */
function removeTestIds(document: string): string {
  let out = document;
  for (const [attribute, hook] of Object.entries(APPLICATION_HOOKS)) {
    out = out.replaceAll(new RegExp(`\\b${attribute}\\b`, "gu"), hook);
  }
  return out;
}

/**
 * Replaces every author-stable id with a generated one and rewrites everything
 * that points at it. The tokens are React's `useId` shape and are assigned in
 * document order, so they are stable across runs of the same rendering and
 * carry no trace of the name the author chose.
 */
function generateIds(document: string): string {
  const generated = new Map<string, string>();
  for (const [, id] of document.matchAll(/\sid="([^"]*)"/gu)) {
    if (id !== undefined && LITERAL_ID.test(id) && !generated.has(id)) generated.set(id, `:r${generated.size}:`);
  }
  if (generated.size === 0) return document;

  const references = ID_REFERENCE_ATTRIBUTES.join("|");
  return document
    .replaceAll(new RegExp(`(\\s(?:${references})=")([^"]*)(")`, "gu"), (match, open: string, value: string, close: string) =>
      `${open}${value.split(/\s+/u).map((token) => generated.get(token) ?? token).join(" ")}${close}`)
    .replaceAll(/(\shref="#)([^"]*)(")/gu, (match, open: string, value: string, close: string) =>
      `${open}${generated.get(value) ?? value}${close}`)
    .replaceAll(/(\sid=")([^"]*)(")/gu, (match, open: string, value: string, close: string) =>
      `${open}${generated.get(value) ?? value}${close}`);
}
