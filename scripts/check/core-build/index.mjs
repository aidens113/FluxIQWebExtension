// Whether a downstream build, check or test may compile or bundle against
// FluxIQ Core's build: built, and not older than its source.

export { CORE_REBUILD_COMMAND, coreBuildFreshness } from "./freshness.mjs";
export { gateName } from "./gate-name.mjs";
