// Humanness (interface I1): the optional `humanness` setting on `FluxIQSettings`, 0-100, absent is 0.
export { createHumannessControl, type HumannessControl } from "./slider";
export { HUMANNESS_LIMITS } from "./limits";
export { normaliseHumanness } from "./normalise-humanness";
export { readHumanness } from "./read-humanness";
export { withHumanness } from "./with-humanness";
