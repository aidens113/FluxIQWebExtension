// Each named set of options a page shows, as data (t655).
//
// **Why.** A8 frozen pair 5 towels (`run-mva6mlo8-f519063c`): a step chose one
// option of a named group before a list read, and the rows the other options
// held never reached the read. The page view says the group only as a token
// inside each control's line (`group="…"`, `../page-view/element/group-token.ts`)
// and an option's count only inside its words ("Hardcover (40)"), so Core,
// which interprets no line of the view, could not say what such a step left
// out. So a state snapshot's summary carries, beside the view, each group as
// structured data (`../../host-runtime.ts`): its words, and each option's words,
// the count the page shows beside it, and whether it is chosen.
//
// **What the page shows, nothing more.** The group is the one the view names
// (`../page-view/group-names.ts`), the option words are the words its line
// prints (`../page-view/element/words.ts`), and the count is a whole number the
// page writes in parentheses at the end of them, which is taken off the words.
// An option is chosen where its line says so: checked, selected, pressed,
// current or marked (`../page-view/element/state-tokens.ts`). Only visible
// controls, and each option once per group, chosen if any copy of it is. The
// packet is already screened (`../sanitize.ts`), so nothing here is more than
// the view says.

import type { WebLlmEvidenceElement } from "../elements";
import { attributeValue, webLlmElementWords, webLlmGroupNames, webLlmPageTree, webLlmViewTraits } from "../page-view";
import { present } from "../present";
import type { WebLlmPageEvidence } from "../sanitize";

/** One named set of options, as a snapshot summary carries it. */
export type WebLlmPageOptionGroup = { name: string; options: Array<{ words: string; count?: number; chosen: boolean }> };

/** A whole number in parentheses ending an option's words: the count the page shows beside it. */
const TRAILING_COUNT = /^(.*\S)\s*\((\d{1,3}(?:,\d{3})+|\d+)\)$/u;

/** Every named group of visible controls on the page, in the order its first option appears. */
export function webLlmPageOptionGroups(evidence: WebLlmPageEvidence): WebLlmPageOptionGroup[] {
  const tree = webLlmPageTree(evidence.elements);
  const names = webLlmGroupNames(evidence.elements, tree);
  const groups = new Map<string, WebLlmPageOptionGroup>();
  for (const element of evidence.elements) {
    const traits = webLlmViewTraits(element);
    if (!traits.visible || traits.lineRole !== "control") continue;
    const name = names.groupOf(element);
    const printed = webLlmElementWords(element);
    if (name === undefined || printed === undefined) continue;
    const counted = TRAILING_COUNT.exec(printed);
    const words = counted ? counted[1]! : printed;
    const count = counted ? Number(counted[2]!.replace(/,/gu, "")) : undefined;
    const group = groups.get(name) ?? { name, options: [] };
    groups.set(name, group);
    const known = group.options.find((option) => option.words === words);
    if (known) {
      known.chosen ||= chosen(element);
      continue;
    }
    group.options.push(present<WebLlmPageOptionGroup["options"][number]>({ words, count: count !== undefined && Number.isSafeInteger(count) ? count : undefined, chosen: chosen(element) }));
  }
  return [...groups.values()];
}

/** Whether the element's line says it is chosen (header). */
function chosen(element: WebLlmEvidenceElement): boolean {
  if ((element.checked ?? ariaTrue(attributeValue(element, "aria-checked"))) === true) return true;
  if (ariaTrue(attributeValue(element, "aria-selected")) || ariaTrue(attributeValue(element, "aria-pressed"))) return true;
  const current = attributeValue(element, "aria-current")?.trim().toLowerCase();
  return (current !== undefined && current !== "" && current !== "false") || element.marked === true;
}

function ariaTrue(value: string | undefined): boolean | undefined {
  const said = value?.trim().toLowerCase();
  return said === "true" ? true : said === "false" ? false : undefined;
}
