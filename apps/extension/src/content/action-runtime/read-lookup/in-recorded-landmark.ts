import { recordedPlaceRefusal } from "../../identity";
import type { DomElementContext } from "../../types";

/**
 * Whether the element sits in the landmark the recording named: its role, and
 * its name when one was recorded. A recording that named none admits every
 * element. Reads and acts share the identity owner's landmark rule.
 */
export function inRecordedLandmark(recorded: DomElementContext | undefined, element: Element): boolean {
  return recordedPlaceRefusal({ landmark: recorded?.landmark, landmarkName: recorded?.landmarkName }, element) === undefined;
}
