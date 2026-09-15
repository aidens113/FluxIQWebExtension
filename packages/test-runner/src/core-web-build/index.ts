// The production build of Core's web panel that isolated Lab runs and the
// persistent demo serve with `next start`: keyed by every input it depends
// on, built once per key under a create-only lock, published atomically, and
// served read-only by every run that shares a runs directory.

export { collectCoreWebBuildInputs, type CollectedCoreWebBuildInputs } from "./inputs.js";
export { coreWebBuildKey } from "./key.js";
export { prepareCoreWebBuild, type CoreWebBuildDependencies, type CoreWebBuildOptions } from "./prepare.js";
export { coreWebServerProcessSpec, type CoreWebServerProcessInput } from "./server-process.js";
export type { CoreWebBuild, CoreWebBuildInputs } from "./types.js";
