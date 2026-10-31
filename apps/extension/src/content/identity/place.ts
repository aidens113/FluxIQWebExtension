import { elementContext } from "./context";
import { agreesWithRecordedDialog } from "./dialog";
import { agreesWithRecordedRecord, type RecordIdentity } from "./record";

/** Captured surroundings are admission constraints, never matcher weights. */
export type RecordedPlace = {
  record?: RecordIdentity | undefined;
  dialog?: string | undefined;
  landmark?: string | undefined;
  landmarkName?: string | undefined;
};

export type TargetPlaceRefusal = "other-record" | "other-dialog" | "other-landmark";

/** A control in another recorded place cannot become the target at any score. */
export function recordedPlaceRefusal(recorded: RecordedPlace | undefined, element: Element): TargetPlaceRefusal | undefined {
  if (!agreesWithRecordedRecord(recorded?.record, element)) return "other-record";
  if (!agreesWithRecordedDialog(recorded?.dialog, element)) return "other-dialog";
  if (!agreesWithRecordedLandmark(recorded, element)) return "other-landmark";
  return undefined;
}

/** No recorded landmark imposes no new constraint; a recorded role/name must still be present. */
function agreesWithRecordedLandmark(recorded: Pick<RecordedPlace, "landmark" | "landmarkName"> | undefined, element: Element): boolean {
  if (!recorded?.landmark) return true;
  const found = elementContext(element);
  if (found?.landmark !== recorded.landmark) return false;
  return !recorded.landmarkName || found?.landmarkName === recorded.landmarkName;
}
