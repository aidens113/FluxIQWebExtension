// What a layer the page raised by itself shows on the page an act left (t499):
// the control names, as the hashes a step's effect is made of, that the capture
// after the act places only inside such a layer -- a help or chat bubble, a
// promotion, a cookie or notice bar. An act's effect leaves them out
// (`../act-effect.ts`, `../../../route-state/effect/sign.ts`), so a later run that
// finds the act's result on a page where that layer is closed sees it hold.
//
// **Why.** In `run-mv6i28zl-a53d36db` a "Set as my store" press reloaded the
// page, and the reloaded page put its chat card up by itself. The card's control
// was kept beside the store chip, and the playback that found the store already
// chosen had closed the card two steps earlier, so the effect never held. t496's
// memory of what a page changes by itself (`./names.ts`) could not see it: the
// card was already up in the first capture of the new document.
//
// **The layers are the capture's own** (`../../layers.ts` marks them): every
// element the page evidence names as covering the page (`blockedBy`, `covers`)
// or as an open dialog (`dialogs`, `isDialog`) -- what the page view prints as
// `COVERING` and `DIALOG`. What sits in one is the layer's element, everything
// the packet's tree (`parent`) puts under it, and everything marked `inDialog`
// of it.
//
// **Which layers the page raised, and which the act opened.** A layer is the
// page's own, and its controls are left out, when either is true:
//
//   - the capture recognised what kind of layer it is (`kind`: a consent wall, a
//     rate limit, a robot check, a promotion, an assistant). Each is something a
//     page puts up on its own account, never the answer a press asked for;
//   - the act left a new document (`navigation.timeOrigin` differs, both known):
//     every layer of the page a reload or a navigation brought came up with that
//     page, not with the press.
//
// Any other layer -- one of no recognised kind that came up on the document the
// act was made on -- is the act's: the dialog a "Change servings" opens, the
// panel that answers an add. Its controls stay required, so an add whose panel
// never came still reads as not seen (`../../../route-state/effect/seen.ts`). And
// when every control the act added sits in the page's layers, the act opened
// that layer (an "Open chat"), and the signer keeps them after all.
//
// Controls are named as the route state names them
// (`../../../route-state/project.ts`: rendered, actionable, by their readable
// words), so the hashes are those of the route state's own controls. That rule
// is restated here rather than imported, because the route state's projection
// reads this package's barrel, which leads back here.

import type { WebLlmEvidenceElement } from "../../elements";
import { actionableEvidenceElement } from "../../elements";
import { webLlmPageTree, webLlmReadableWords } from "../../page-view";
import type { WebLlmPageEvidence } from "../../sanitize";
import { webAutomationRouteLayerOnlyHashes } from "../../../route-state/effect";

const NONE: ReadonlySet<string> = new Set();

/** The hashes of the control names `after` shows only inside a layer the page raised by itself, the act having been made on `before`. */
export function webLlmPageRaisedNames(before: WebLlmPageEvidence | undefined, after: WebLlmPageEvidence): ReadonlySet<string> {
  const from = documentOf(before);
  const to = documentOf(after);
  const newDocument = from !== undefined && to !== undefined && from !== to;
  const roots = new Set([...layersOf(after)].flatMap(([handle, recognised]) => (newDocument || recognised ? [handle] : [])));
  if (roots.size === 0) return NONE;
  const tree = webLlmPageTree(after.elements);
  const rootElements = after.elements.filter((element) => roots.has(element.target));
  const inLayer = (element: WebLlmEvidenceElement): boolean =>
    roots.has(element.target) || (element.inDialog !== undefined && roots.has(element.inDialog)) || rootElements.some((root) => tree.isUnder(element, root));
  const layer: string[] = [];
  const elsewhere: string[] = [];
  for (const element of after.elements) {
    const name = controlName(element);
    if (name !== undefined) (inLayer(element) ? layer : elsewhere).push(name);
  }
  return webAutomationRouteLayerOnlyHashes(layer, elsewhere);
}

/** Every layer of the capture by its element's handle, with whether the capture recognised what kind it is. */
function layersOf(evidence: WebLlmPageEvidence): Map<string, boolean> {
  const found = new Map<string, boolean>();
  const add = (handle: string | undefined, kind: unknown): void => {
    if (handle !== undefined) found.set(handle, found.get(handle) === true || kind !== undefined);
  };
  for (const blocker of evidence.blockedBy ?? []) add(blocker.target, blocker.kind);
  for (const dialog of evidence.dialogs ?? []) add(dialog.target, dialog.kind);
  for (const element of evidence.elements) {
    if (element.covers !== undefined || element.coversCount !== undefined) add(element.target, element.kind);
    if (element.isDialog !== undefined) add(element.target, element.isDialog.kind ?? element.kind);
  }
  return found;
}

/** The control's name as the route state's controls list names it, or nothing for an element that is not listed there (header). */
function controlName(element: WebLlmEvidenceElement): string | undefined {
  if (element.hidden === true || !actionableEvidenceElement(element)) return undefined;
  return webLlmReadableWords(element, element.name ?? element.text) ?? "";
}

/** Which document a capture is of, where it says. */
function documentOf(evidence: WebLlmPageEvidence | undefined): number | undefined {
  const origin = evidence?.navigation?.timeOrigin;
  return typeof origin === "number" ? origin : undefined;
}
