// A signature read off an untrusted value (a Flow parameter). Nothing is
// coerced: an unknown key, attribute or shape is no signature.

import type { WebToggleAttribute, WebToggleSignature } from "./signature";

const ATTRIBUTES: readonly unknown[] = ["aria-pressed", "aria-checked", "aria-selected", "checked"];

export function webToggleSignatureValue(value: unknown): WebToggleSignature | undefined {
  if (typeof value !== "object" || value === null || Array.isArray(value)) return undefined;
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record).sort().join(",");
  if (record.via === "attribute" && keys === "attribute,to,via" && ATTRIBUTES.includes(record.attribute) && typeof record.to === "boolean") {
    return { via: "attribute", attribute: record.attribute as WebToggleAttribute, to: record.to };
  }
  if (record.via === "name" && keys === "gains,loses,via" && words(record.gains) && words(record.loses)) {
    const gains = record.gains as string[];
    const loses = record.loses as string[];
    return gains.length + loses.length > 0 ? { via: "name", gains: [...gains], loses: [...loses] } : undefined;
  }
  if (record.via === "class" && keys === "gains,loses,via" && words(record.gains) && words(record.loses)) {
    const gains = record.gains as string[];
    const loses = record.loses as string[];
    return gains.length + loses.length > 0 ? { via: "class", gains: [...gains], loses: [...loses] } : undefined;
  }
  return undefined;
}

function words(value: unknown): boolean {
  return Array.isArray(value) && value.every((word) => typeof word === "string" && word !== "");
}
