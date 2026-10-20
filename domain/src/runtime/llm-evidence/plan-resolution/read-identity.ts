// A read's target keeps its words, marked as the value the step reads (t743, D2 then D2b).
//
// Office rerun round 4 (`run-mvgvyaip-d856e135`, 0052-0055): revision 3 chose
// "deliver to the office address" and then read the delivery address from a
// paragraph captured while it still showed the home address. The read's identity
// carried those words, the page's identity veto (`apps/extension/src/content/identity/veto.ts`)
// found the paragraph showing the office address instead, and the read failed
// `web.target.not_found` four times. Revision 1 had failed the same way on an
// order total a gift card changed. So a Flow could never read a value one of its
// own steps changes -- a total after a discount, a chosen option, a date after a
// delivery choice -- and nothing about that is particular to one site.
//
// **The words stay; they stop being a veto.** D2 saved a read's target without
// its words. That broke the save-time guard (`identity-guard.ts`, two
// independent signals besides the address): a bare `<p>` or `<span>` read target
// with only its tag, its selector and its words -- office's address line -- was
// refused `web.handle.unidentifiable`, with no move left to the model. The words
// are a true description of the element as captured, so they are saved and the
// guard counts them as it always has. What changes is how the page uses them:
// the identity carries `readsWords: true`, and for such a target the extension
// never vetoes or penalises a candidate because its words differ; the words only
// break a tie among candidates that otherwise match equally, and the selector,
// record, dialog, label and kind still decide
// (`apps/extension/src/content/identity/read-words.ts`).
//
// Which words are the value read is the page's rule, beside the comparison: the
// visible text, and an accessible name that says the same as it. The packet drops
// an element's text where it equals its name (`../elements.ts`), so a name that
// arrives with no text beside it may be the words themselves and is treated as
// them; a name shown beside different words (an `aria-label`, a title) is the
// element's own and still has to agree. A press's target is not marked: its
// words say which control it is.
//
// The nodes that read text: `web.dom.extract` in text, value or html mode (the
// structured `extract`, else the legacy `options.mode`; an attribute read reads
// no words, so its target is not marked), and `web.dom.assert` with
// `kind: "text"`.

import type { JsonObject } from "fluxiq/core";
import { webAutomationOutputNodeId } from "../../../output-nodes";
import { isJsonRecord } from "../untrusted-json";

const EXTRACT_NODE_ID = webAutomationOutputNodeId("web.dom.extract");
const ASSERT_NODE_ID = webAutomationOutputNodeId("web.dom.assert");
/** The one extract mode that reads no words of the element. */
const ATTRIBUTE_MODE = "attribute";

/** `identity` as a node of `nodeDefinitionId` with `parameters` saves it: marked `readsWords` when the node reads its words (header). */
export function webPlanReadIdentity(nodeDefinitionId: string, parameters: JsonObject, identity: JsonObject | undefined): JsonObject | undefined {
  if (identity === undefined || !readsText(nodeDefinitionId, parameters)) return identity;
  return { ...identity, readsWords: true };
}

/** Whether a node of `nodeDefinitionId` with `parameters` reads its element's text (header). */
function readsText(nodeDefinitionId: string, parameters: JsonObject): boolean {
  if (nodeDefinitionId === ASSERT_NODE_ID) return isJsonRecord(parameters.assert) && parameters.assert.kind === "text";
  if (nodeDefinitionId !== EXTRACT_NODE_ID) return false;
  const structured = isJsonRecord(parameters.extract) ? parameters.extract.mode : undefined;
  const legacy = isJsonRecord(parameters.options) ? parameters.options.mode : undefined;
  return (structured ?? legacy) !== ATTRIBUTE_MODE;
}
