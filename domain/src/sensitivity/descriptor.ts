// The same rule asked of a serialized element descriptor rather than of its
// named fields.
//
// Three call sites hold one of these -- the recording reducer, the LLM evidence
// sanitizer, and the extension's background worker -- and each was reaching
// into `inputType` and `attributes` its own way. The shape is the wire
// descriptor `apps/extension/src/content/describe-element.ts` produces, whose
// `attributes` carry every attribute the page wrote -- `type`, `autocomplete`,
// `data-sensitive`, `name`, `id`, `aria-label`, `placeholder` -- beside the
// computed `label` and `accessibleName`, which is everything the rule reads.
//
// The input is `unknown` on purpose: a descriptor arrives from a page, over a
// wire, or out of stored state, so nothing about its shape may be assumed. An
// unreadable field simply does not match, and a descriptor that is not an
// object is not a control.

import { isSensitiveFieldSignature, type SensitiveFieldSignature } from "./signature";

/**
 * The sensitivity signature of a serialized element descriptor. Exposed
 * separately from the predicate so a caller that also wants to report the
 * signature does not have to pull the fields out a second way.
 */
export function sensitiveFieldSignatureOfDescriptor(descriptor: unknown): SensitiveFieldSignature {
  if (!descriptor || typeof descriptor !== "object" || Array.isArray(descriptor)) return {};
  const record = descriptor as Record<string, unknown>;
  const attributes = record.attributes && typeof record.attributes === "object" && !Array.isArray(record.attributes)
    ? record.attributes as Record<string, unknown>
    : {};
  return {
    inputType: stringField(record.inputType),
    controlType: stringField(attributes.type),
    autocomplete: stringField(attributes.autocomplete),
    // The producer's own marker for a control sensitive through its group
    // (`DomElementDescriptor.sensitive`, t733) reads as the attribute would.
    dataSensitive: record.sensitive === true ? "true" : stringField(attributes["data-sensitive"]),
    names: stringFields([attributes.name, attributes.id, record.id]),
    labels: stringFields([record.label, record.accessibleName, attributes["aria-label"], attributes.placeholder])
  };
}

/** Whether a serialized element descriptor names a control that must never yield its value. */
export function isSensitiveElementDescriptor(descriptor: unknown): boolean {
  return isSensitiveFieldSignature(sensitiveFieldSignatureOfDescriptor(descriptor));
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

/** The strings among the values, in order; anything else a page sent is not read. */
function stringFields(values: readonly unknown[]): string[] {
  return values.filter((value): value is string => typeof value === "string");
}
