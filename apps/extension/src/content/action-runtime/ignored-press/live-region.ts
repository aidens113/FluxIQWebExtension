// Whether an element is one of the page's own notice regions: where a page
// announces what happened, by the semantics assistive technology reads, never
// by its words (t743).
//
// A notice region is an element marked `role="alert"` or `role="status"` --
// ARIA's alert and status message, a notice by definition -- or
// `aria-live="assertive"`, which is what `role="alert"` implies. A bare
// `aria-live="polite"` is left out on purpose: pages put it on content that
// updates itself -- a results list, a feed, a cart total -- and a press that
// refreshed such content did something, so reading it as a notice would fail a
// press that worked. An `<output>` is left out unless it says so itself: its
// implicit status role holds a result the press computed, which is the act,
// not a notice about it. Nothing here reads what the region says; the settled
// look (`settled-look.ts`) only asks whether its words changed.

/** The roles whose element announces what the page did. */
const ANNOUNCING_ROLES: ReadonlySet<string> = new Set(["alert", "status"]);

/** True where `node` is an element that is itself a notice region. Anything that cannot be read so is not one. */
export function isLiveRegion(node: unknown): boolean {
  const element = node as { getAttribute?: (name: string) => string | null } | null | undefined;
  if (!element || typeof element.getAttribute !== "function") return false;
  // The first role token is the one a reader uses; later ones are fallbacks.
  const role = String(element.getAttribute("role") ?? "").trim().toLowerCase().split(/\s+/u)[0] ?? "";
  if (ANNOUNCING_ROLES.has(role)) return true;
  return String(element.getAttribute("aria-live") ?? "").trim().toLowerCase() === "assertive";
}
