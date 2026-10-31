import type { WebLlmSnapshotBinding } from "../../llm-evidence";
import type { WebTargetCaptureProvenance } from "./provenance";

/** One fresh page plus claims about its coverage and prior-attempt correlation. */
export type WebTargetObservation = WebTargetCaptureProvenance & {
  page: WebLlmSnapshotBinding;
  samePlace: "yes" | "no" | "unknown";
};
