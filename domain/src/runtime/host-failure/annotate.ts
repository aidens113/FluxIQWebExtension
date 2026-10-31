import type { AutomationStudioFailureRecord } from "fluxiq/automation-studio";
import { WEB_AUTOMATION_FAILURE_CODES } from "../failure";
import { readWebHostFailure } from "./read";

/** Host-only temporary facts. Shared browser constructors must not emit this. */
export function webHostFailure(value: unknown): AutomationStudioFailureRecord | undefined {
  const original = readWebHostFailure(value);
  if (original === undefined) return undefined;
  if (original.code !== WEB_AUTOMATION_FAILURE_CODES.RATE_LIMITED && original.code !== WEB_AUTOMATION_FAILURE_CODES.TRANSPORT_TRANSIENT) return original;
  const annotated = readWebHostFailure(original);
  if (annotated === undefined) return original;
  annotated.transient = true;
  return readWebHostFailure(annotated) ?? original;
}
