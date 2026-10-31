import type { WebTargetScope } from "./scope";

/** Private claims retained before the public page projection loses capture detail. */
export type WebTargetCaptureProvenance = {
  scope: WebTargetScope;
  /** Complete means this intended scope was explicitly observed whole and settled. */
  coverage: "complete" | "partial" | "unknown";
  /** True only with positive supported-producer proof; false makes no hidden-absence claim. */
  includesHidden: boolean;
};
