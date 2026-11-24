// Shared read holds on Core's build-cache locks for the lifetime of one Lab
// invocation: runs share one Core, and a Core build waits for them.
export { acquireCoreBuildLease } from "./lease.mjs";
