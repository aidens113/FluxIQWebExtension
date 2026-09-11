// The page-side half of action execution. `actions/` decides what each action
// type does; this directory supplies the capabilities it needs -- finding the
// target, waiting, reading values, and shaping the result the background worker
// receives.

export { captureSnapshotForResponse } from "./capture-snapshot-for-response";
export { executeAction } from "./execute-action";
export { actionFailure } from "./results";
