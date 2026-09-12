// The same rule asked of a serialized element descriptor rather than of three
// named fields.
//
// Three call sites hold one of these -- the recording reducer, the LLM evidence
// sanitizer, and the extension's background worker -- and each was reaching
// into `inputType` and `attributes` its own way. The shape is the wire
// descriptor `apps/extension/src/content/describe-element.ts` produces, whose
// attribute allowlist already carries `type`, `autocomplete` and
// `data-sensitive`, which is exactly what the rule needs.
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
    dataSensitive: stringField(attributes["data-sensitive"])
  };
}

/** Whether a serialized element descriptor names a control that must never yield its value. */
export function isSensitiveElementDescriptor(descriptor: unknown): boolean {
  return isSensitiveFieldSignature(sensitiveFieldSignatureOfDescriptor(descriptor));
}

function stringField(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}
