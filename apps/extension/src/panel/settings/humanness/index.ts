// Humanness (interface I1): the optional `humanness` setting, 0-100, absent is 0. One small
// binding so the swap to @fluxiq/contracts' bounds and protocol.ts's field is one file.
export { createHumannessControl, type HumannessControl } from "./slider";
export { HUMANNESS_LIMITS } from "./limits";
export type { HumannessSettings } from "./settings";
export { normaliseHumanness } from "./normalise-humanness";
export { readHumanness } from "./read-humanness";
export { withHumanness } from "./with-humanness";
