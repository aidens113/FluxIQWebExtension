import { parseAutomationStudioTargetActionabilityRecord } from "fluxiq/automation-studio/actionability";
import type { JsonObject } from "fluxiq/core";
import { webOwnDataProperty } from "./own-data";

/** Quarantine only the optional control in a local consumer copy after acceptance. */
export function webActionabilityPayloadCopy<T extends { payload?: JsonObject | undefined }>(result: T): T {
  const payload = webOwnDataProperty(result, "payload");
  if (payload.kind !== "data" || payload.value === null || typeof payload.value !== "object" || Array.isArray(payload.value)) return result;
  const property = webOwnDataProperty(payload.value, "actionability");
  if (property.kind === "absent") return result;
  const copiedPayload = Object.create(Object.getPrototypeOf(payload.value));
  for (const key of Reflect.ownKeys(payload.value)) {
    // Do not revisit an optional descriptor that already proved unreadable.
    if (key === "actionability") continue;
    const descriptor = Object.getOwnPropertyDescriptor(payload.value, key);
    if (descriptor !== undefined) Object.defineProperty(copiedPayload, key, descriptor);
  }
  const measured = property.kind === "data" ? parseAutomationStudioTargetActionabilityRecord(property.value) : undefined;
  if (measured !== undefined) Object.defineProperty(copiedPayload, "actionability", { value: measured, enumerable: true, configurable: true, writable: true });
  const descriptors = Object.getOwnPropertyDescriptors(result);
  Object.defineProperty(descriptors, "payload", { value: { ...descriptors.payload, value: copiedPayload }, enumerable: true });
  return Object.create(Object.getPrototypeOf(result), descriptors);
}
