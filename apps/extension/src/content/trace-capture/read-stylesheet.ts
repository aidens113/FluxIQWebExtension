// A stylesheet as the CSSOM now holds it, and the stylesheets it imports.
//
// The text is what a `<style>` or an adopted stylesheet is written into the
// capture as: the rules the page has now, including any a script inserted
// after the markup was parsed (CSS-in-JS adds rules through `insertRule`, so
// the element's own text would miss them). The imports are what an `@import`
// rule makes the offline page request, which the capture carries beside the
// document: each one's address, absolute, and those it imports in turn.
//
// A stylesheet the page may not read -- another origin's, without its
// consent -- answers `null`: the browser refuses its rules with a
// `SecurityError` (Firefox: `InvalidAccessError` while it loads).

/** `CSSRule.IMPORT_RULE`, written out so the reader needs no `CSSRule` global. */
const IMPORT_RULE = 3;

/** How deep `@import` chains are followed; a page that imports past this is not one the capture can carry whole anyway. */
const IMPORT_DEPTH = 8;

/** The errors a browser throws for a stylesheet whose rules the page may not read. */
const UNREADABLE_SHEET_ERRORS = new Set(["SecurityError", "InvalidAccessError"]);

export function readStylesheet(sheet: CSSStyleSheet): { text: string; imports: string[] } | null {
  const rules = readableRules(sheet);
  if (!rules) return null;
  const imports: string[] = [];
  collectImports(rules, sheet.href, imports, 0);
  return { text: Array.from(rules, (rule) => rule.cssText).join("\n"), imports };
}

function readableRules(sheet: CSSStyleSheet): CSSRuleList | null {
  try {
    return sheet.cssRules;
  } catch (error) {
    if (error instanceof DOMException && UNREADABLE_SHEET_ERRORS.has(error.name)) return null;
    throw error;
  }
}

function collectImports(rules: CSSRuleList, base: string | null, into: string[], depth: number): void {
  if (depth >= IMPORT_DEPTH) return;
  for (const rule of Array.from(rules)) {
    if (rule.type !== IMPORT_RULE) continue;
    const imported = rule as CSSImportRule;
    const address = imported.styleSheet?.href ?? absoluteAddress(imported.href, base);
    if (address && !into.includes(address)) into.push(address);
    const nested = imported.styleSheet ? readableRules(imported.styleSheet) : null;
    if (nested) collectImports(nested, address, into, depth + 1);
  }
}

/** The import's address made absolute against the sheet that wrote it, or the address as written when there is no base to resolve it on. */
function absoluteAddress(address: string, base: string | null): string {
  if (!base) return address;
  try {
    return new URL(address, base).href;
  } catch (error) {
    if (error instanceof TypeError) return address;
    throw error;
  }
}
