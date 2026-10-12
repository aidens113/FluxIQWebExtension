// An element of the evidence packet, made into the saved identity of a step
// that aims at it. This is the one place a packet element becomes a
// fingerprint: a build's step (`../plan-resolution/element-identity.ts`, through
// the handle the model named) and a runtime repair (`../target/override.ts`)
// both come here, and here goes through the one builder every save path uses,
// the recording's included (`domain/src/element-fingerprint/`).
//
// Two builders used to do this (t422's and t425's), each with its own list of
// attributes to keep and its own secret and withheld screens, so the same
// control saved by a build and by a repair could carry different identities.
// The split now is by what each side knows:
//
// - **this file knows the packet**: its field names, the attribute pairs it
//   publishes (`../attributes.ts`), the marker its secret screen writes in place
//   of a string (`../withheld.ts`), and where it placed the element -- its form,
//   landmark, list and table position, record, and the shadow hosts its
//   handle's binding kept;
// - **the builder knows the identity**: which attributes say which control this
//   is, what a field holds and so never names it, and what a secret control
//   keeps (`element-fingerprint/build.ts`).
//
// Nothing the model is shown changes: the model names an element only by its
// handle, and every string read here is one the packet already published.

import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../../actions/types";
import { webElementFingerprint } from "../../../element-fingerprint";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import { attributeRecord } from "../attributes";
import type { WebLlmEvidenceElement } from "../elements";
import { present } from "../present";
import { isWithheldText } from "../withheld";

type PacketContext = Pick<WebAutomationElementContext, "formId" | "landmark" | "listPosition" | "tablePosition" | "shadowHosts" | "record">;

/**
 * The saved identity of one packet element: addressed by `selector` where the
 * caller holds the binding that issued its handle, and inside `shadowHosts`
 * where the binding kept a host chain beside it -- the key a recorded node
 * carries as `context.shadowHosts`, so a created node's click and wait are
 * scoped to the widget's root as a recorded one's are.
 */
export function webPacketElementFingerprint(
  element: WebLlmEvidenceElement,
  input: { selector?: string | undefined; shadowHosts?: readonly string[] | undefined } = {}
): WebAutomationElementFingerprint {
  const attributes = screenedAttributes(element.attributes);
  return webElementFingerprint({
    tagName: element.tag,
    selector: input.selector,
    role: whole(element.role),
    implicitRole: whole(element.implicitRole),
    accessibleName: whole(element.name),
    label: whole(element.label),
    visibleText: whole(element.text),
    inputType: element.inputType,
    // A link's destination is where it goes, which a page changes per session and per row; it is no identity.
    href: undefined,
    attributes,
    context: contextOf(element, input.shadowHosts),
    secret: isSensitiveFieldSignature({
      inputType: element.inputType,
      controlType: element.controlType,
      autocomplete: attributes?.autocomplete,
      dataSensitive: attributes?.["data-sensitive"]
    })
  });
}

/** The attributes by name, first of a repeated name winning as in a browser, less any value the packet withheld; nothing when none is left. */
function screenedAttributes(pairs: ReadonlyArray<[string, string]> | undefined): Record<string, string> | undefined {
  const byName = attributeRecord(pairs ?? []);
  const kept = Object.fromEntries(Object.entries(byName).filter(([, value]) => whole(value) !== undefined));
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/**
 * Where the element sat, in the recorded context's field names: its form, its
 * landmark, its list and table position, the shadow hosts its handle's binding
 * kept, and its record. Nothing when the packet placed it nowhere.
 */
function contextOf(element: WebLlmEvidenceElement, shadowHosts: readonly string[] | undefined): WebAutomationElementContext | undefined {
  const context = present<PacketContext>({
    formId: whole(element.form),
    landmark: element.landmark,
    listPosition: element.item === undefined ? undefined : { index: element.item.index, total: element.item.total },
    tablePosition: element.cell === undefined ? undefined : present<NonNullable<PacketContext["tablePosition"]>>({ row: element.cell.row, column: element.cell.column, columnHeader: whole(element.cell.header) }),
    shadowHosts: shadowHosts === undefined || shadowHosts.length === 0 ? undefined : [...shadowHosts],
    record: recordOf(element)
  });
  return Object.keys(context).length > 0 ? context : undefined;
}

/**
 * The record the packet named the element's row or card by, when it named one
 * whole: the record's words, less its controls' (`../elements.ts` `recordWords`),
 * published on exactly the elements a record tells apart. A record the page
 * keyed (`data-id`) publishes no words; its key lives in the binding's
 * `records`, which only `plan-resolution/target-packets.ts` holds.
 */
function recordOf(element: WebLlmEvidenceElement): PacketContext["record"] {
  const text = whole(element.within);
  return text === undefined ? undefined : { text };
}

/** A packet string that is the element's own and says something, rather than blank or the marker the secret screen put in its place. */
function whole(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" || isWithheldText(value) ? undefined : value;
}
