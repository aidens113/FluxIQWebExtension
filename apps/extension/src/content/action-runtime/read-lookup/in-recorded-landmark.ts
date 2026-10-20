import { elementContext } from "../../identity";
import type { DomElementContext } from "../../types";

/**
 * Whether the element sits in the landmark the recording named: its role, and
 * its name when one was recorded. A recording that named none admits every
 * element. Asked of a read's target only (`./index.ts`); a press keeps the
 * resolver's rules as they were.
 */
export function inRecordedLandmark(recorded: DomElementContext | undefined, element: Element): boolean {
  if (!recorded?.landmark) return true;
  const found = elementContext(element);
  if (found?.landmark !== recorded.landmark) return false;
  return !recorded.landmarkName || found?.landmarkName === recorded.landmarkName;
}
