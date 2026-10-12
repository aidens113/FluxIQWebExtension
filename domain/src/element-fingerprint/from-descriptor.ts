// A recorded element, as the recorder put it on the wire, made into the saved
// control identity of the step it became.
//
// The recorder already captures every signal (`apps/extension/src/content/
// describe-element.ts`, projected whole by `background/connection/
// gateway-payloads.ts`), and `elementFingerprint` reads it off the wire with a
// closed vocabulary. What this adds is the builder's rules: a recorded text
// field no longer saves what was typed into it as its identity, and no control
// saves the state it was left in.

import type { WebAutomationElementFingerprint } from "../actions/types";
import { elementFingerprint } from "../output-nodes/targets";
import { isSensitiveElementDescriptor } from "../sensitivity";
import { webElementFingerprint } from "./build";

/** The saved identity of a recorded element, or nothing when the wire value is no element. */
export function webElementFingerprintFromDescriptor(descriptor: unknown): WebAutomationElementFingerprint | undefined {
  const read = elementFingerprint(descriptor);
  if (read === undefined || typeof read.tagName !== "string") return read;
  return webElementFingerprint({
    tagName: read.tagName,
    selector: read.selector,
    xpath: read.xpath,
    role: read.role,
    implicitRole: read.implicitRole,
    accessibleName: read.accessibleName,
    label: read.label,
    visibleText: read.visibleText,
    text: read.text,
    value: read.value,
    inputType: read.inputType,
    href: read.href,
    id: read.id,
    name: read.name,
    classNames: read.classNames,
    testId: read.testId,
    attributes: read.attributes,
    context: read.context,
    secret: isSensitiveElementDescriptor(descriptor)
  });
}
