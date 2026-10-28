// Every shown value of a read, by its own place (t772 value witness, FluxIQ Core
// `flow-bootstrap/reset-settlement/value-witness.ts`): what a person sees the
// page say -- an element's words, a field's value, a select's chosen option --
// named by where it sits, so a value a press replaced (a choice confirmed by a
// button that reloads the page to the same address) can be seen set back.
//
// **The place** is the trusted source and the page's address, the element's
// frame and the selector that addresses it (the same parts a list's scope is
// made of, `./collection.ts`), as one opaque token. A value's words change with
// the value, so they are no part of its place; they are its state. Two reads of
// one page at one address agree on the place of every element both show.
//
// **The state** is a digest of the words the page view prints for the element
// (`webLlmElementWords`), its field value and its chosen option: what a person
// would read there.
//
// **What is left out.** A stateful control is read by its state at its own
// place (`./states.ts`), never here. A hidden element is nothing a person sees.
// A dialog, or a layer in front of the page and everything under it, is an
// interruption, not the page's state (`../start-state/page-state.ts`): a room
// chooser open over the page is gone after its confirming press reloads it, and
// none of its lines is a value the press replaced. An element with no words and
// no value shows nothing. A place two elements would share says nothing of
// either and is dropped. A page with more places than Core reads answers none.

import type { WebLlmEvidenceElement } from "../elements";
import { webIsLayer } from "../node-run/layer";
import { webLlmElementWords } from "../page-view";
import type { WebLlmSnapshotBinding } from "../sanitize";
import { isWebStatefulControl } from "./stateful";
import { webControlSpotToken } from "./token";

type Page = Partial<Pick<WebLlmSnapshotBinding, "evidence" | "selectors" | "dialogNames" | "resetResource">>;

/** Core's bound on a read's places (`site-reset/start-check.ts`), as for controls: a read with more is none it takes. */
const MAX_PLACES = 2_000;
/** Far past any page's nesting; a guard on the walk up, not a bound on what is read. */
const MAX_DEPTH = 256;

/** The state token of each shown value of `page` by its place (header); empty where the page has none, no trusted source, or more places than Core reads. */
export function webValueStates(page: Page): Record<string, string> {
  const { evidence, selectors, resetResource } = page;
  if (!resetResource || !evidence || !selectors) return {};
  const byHandle = new Map(evidence.elements.map((element) => [element.target, element]));
  const values = new Map<string, string>();
  const shared = new Set<string>();
  for (const element of evidence.elements) {
    const selector = selectors.get(element.target);
    if (selector === undefined || !shown(element, byHandle, page.dialogNames)) continue;
    const state = valueState(element);
    if (state === undefined) continue;
    const place = webControlSpotToken("scope", `${resetResource}\0${evidence.location}\0value\0${element.frameId ?? 0}\0${selector}`);
    if (values.has(place)) shared.add(place);
    values.set(place, state);
  }
  for (const place of shared) values.delete(place);
  return values.size > MAX_PLACES ? {} : Object.fromEntries(values);
}

/** Whether a person sees `element` as part of the page itself (header): visible, no control, in no dialog or layer. */
function shown(element: WebLlmEvidenceElement, byHandle: ReadonlyMap<string, WebLlmEvidenceElement>, dialogNames: ReadonlyMap<string, string> | undefined): boolean {
  if (element.hidden === true || isWebStatefulControl(element) || element.inDialog !== undefined || dialogNames?.has(element.target) || webIsLayer(element)) return false;
  let depth = 0;
  for (let at = element.parent === undefined ? undefined : byHandle.get(element.parent); at !== undefined && depth < MAX_DEPTH; at = at.parent === undefined ? undefined : byHandle.get(at.parent), depth += 1) {
    if (webIsLayer(at) || at.inDialog !== undefined || dialogNames?.has(at.target)) return false;
  }
  return true;
}

/** The value a person reads at `element` (header), or none where it shows no words and holds no value. */
function valueState(element: WebLlmEvidenceElement): string | undefined {
  const words = webLlmElementWords(element) ?? null;
  const value = element.value ?? null;
  const chosen = element.selectedValue ?? null;
  if (words === null && value === null && chosen === null) return undefined;
  return webControlSpotToken("scope", `value\0${JSON.stringify([words, value, chosen])}`);
}
