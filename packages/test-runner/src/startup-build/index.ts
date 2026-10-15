// The one-off builds a Lab run or the demo performs before starting Core,
// each bounded by progress rather than a fixed limit (`runBoundedBuildStep`).

export { domainSetupStep, type DomainSetupInput } from "./domain-setup.js";
export { hostBuildStep, type HostBuildInput } from "./host-build.js";
