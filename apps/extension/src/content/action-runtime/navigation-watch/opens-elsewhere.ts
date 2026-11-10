// Whether pressing a control may load its page in another browsing context,
// where its own document sees nothing of the navigation (task speed S10,
// `./watch.ts`).

/** The browsing-context names that are this document's own. */
const OWN_CONTEXT = new Set(["", "_self"]);

/** Whether pressing `target` may load its page in another browsing context, where this document sees nothing of it. */
export function opensElsewhere(target: Element, document: Document | undefined): boolean {
  const named = (value: string | null | undefined): boolean => typeof value === "string" && !OWN_CONTEXT.has(value.trim().toLowerCase());
  const link = typeof target.closest === "function" ? target.closest("a[href], area[href]") : null;
  const form = (target as Partial<HTMLButtonElement>).form ?? (typeof target.closest === "function" ? target.closest("form") : null);
  const base = document?.querySelector?.("base[target]") ?? null;
  return named(link?.getAttribute("target")) || named(form?.getAttribute("target")) || named(target.getAttribute?.("formtarget")) || named(base?.getAttribute("target"));
}
