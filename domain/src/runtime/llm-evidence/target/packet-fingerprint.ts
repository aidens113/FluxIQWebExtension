// An element of the evidence packet, made into the saved identity of the step
// that will aim at it -- through the one builder every save path uses
// (`domain/src/element-fingerprint/`).
//
// A runtime repair names its control by a packet handle, and so does a build's
// step. Until t425 a repair saved four of the packet's signals -- the tag, the
// role, the accessible name and the visible text -- and the packet carried the
// rest without anyone reading them: every attribute the page wrote, so the id,
// the `name`, the class list, a test id, a placeholder and an `aria-label`
// (`../attributes.ts`), and the label a page lays beside a field without a
// `<label for>` (`apps/extension/src/content/identity/label.ts`). A repaired
// step therefore came back weaker than the step it repaired, which was recorded
// with all of them.
//
// What is read here, and what is not:
//
// - the words the packet published for the element: its accessible name, its
//   label and its text. A string the packet withheld as shaped like a secret
//   (`../withheld.ts`) is not the element's own and is left out rather than
//   compared as though it were;
// - the attributes that describe the control, as the page wrote them: its id,
//   `name`, class, type, role, placeholder, `aria-label`, title, alt and a test
//   id. The rest of the page's attributes -- a framework's state, a data blob, a
//   style -- describe nothing a later page can be held to, and the saved target
//   has a size bound (Core's `AUTOMATION_STUDIO_RUNTIME_TARGET_MAX_SERIALIZED_LENGTH`);
// - never a value: the packet carries a text field's contents as `value`, and
//   the builder leaves a field's text out (`../../../element-fingerprint/build.ts`).
//
// Where the control sat is the caller's to give, because only the caller knows
// whether it may: a build names the record its handle's control sat in, while a
// repair keeps the record the recording named (`output-nodes/targets/targets.ts`
// `withRecordedRecord`).

import type { WebAutomationElementContext, WebAutomationElementFingerprint } from "../../../actions/types";
import { webElementFingerprint } from "../../../element-fingerprint";
import { isSensitiveFieldSignature } from "../../../sensitivity";
import type { WebLlmEvidenceElement } from "../elements";
import { isWithheldText } from "../withheld";

/** The attributes that describe a control rather than its state or its data. */
const DESCRIBING_ATTRIBUTES: ReadonlySet<string> = new Set([
  "id", "name", "class", "type", "role", "placeholder", "aria-label", "title", "alt",
  "data-testid", "data-test", "data-cy", "data-qa"
]);

/** The saved identity of one packet element, addressed by `selector` where the caller still holds the binding that issued its handle. */
export function webPacketElementFingerprint(
  element: WebLlmEvidenceElement,
  input: { selector?: string | undefined; context?: WebAutomationElementContext | undefined } = {}
): WebAutomationElementFingerprint {
  return webElementFingerprint({
    tagName: element.tag,
    selector: input.selector,
    role: whole(element.role),
    implicitRole: whole(element.implicitRole),
    accessibleName: whole(element.name),
    label: whole(element.label),
    visibleText: whole(element.text),
    inputType: element.inputType,
    href: whole(element.href),
    attributes: describingAttributes(element.attributes),
    context: input.context,
    secret: isSensitiveFieldSignature({ inputType: element.inputType, controlType: element.controlType })
  });
}

/** The describing attributes, by name, first of a repeated name winning as in a browser; nothing when none is left. */
function describingAttributes(pairs: ReadonlyArray<[string, string]> | undefined): Record<string, string> | undefined {
  const kept: Record<string, string> = {};
  for (const [name, value] of pairs ?? []) {
    const key = name.toLowerCase();
    if (!DESCRIBING_ATTRIBUTES.has(key) || Object.hasOwn(kept, key) || whole(value) === undefined) continue;
    kept[key] = value;
  }
  return Object.keys(kept).length > 0 ? kept : undefined;
}

/** A packet string that is the element's own, rather than the marker the secret screen put in its place. */
function whole(value: string | undefined): string | undefined {
  return value === undefined || value.trim() === "" || isWithheldText(value) ? undefined : value;
}
