// What an attempt says about how its transition compared with the recorded one.

/** The shape of Core's comparison status names: lowercase words joined by underscores. */
const COMPARISON_STATUS_NAME = /^[a-z]+(?:_[a-z]+)*$/u;

/**
 * Core's `comparisonStatus`, kept only when it has the shape of one of Core's
 * names, at most 64 characters. The run detail types it as any string (Core
 * `model/flow-adaptation.ts`) and Core's union is not a public export, so the
 * shape is what keeps a value that is not a name, which could carry page text,
 * out of the bundle.
 */
export function comparisonStatusOf(attempt: Record<string, unknown>): string | undefined {
  const status = attempt.comparisonStatus;
  return typeof status === "string" && status.length <= 64 && COMPARISON_STATUS_NAME.test(status) ? status : undefined;
}
