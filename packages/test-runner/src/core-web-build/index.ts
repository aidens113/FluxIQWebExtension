// The production build of Core's web panel that isolated Lab runs and the
// persistent demo serve with `next start`. Core builds it
// (`<core>/scripts/web-build/`: keyed by Core's `web:build` fingerprint, built
// once per key under a create-only lock, published atomically, served
// read-only by every run that shares that Core). This directory keeps what is
// the Lab's own: the scrubbed build environment, the supervised and bounded
// build children, and the `next start` process that serves a build.

export { coreWebBuildEnvironment } from "./build-environment.js";
export { runBoundedBuildStep, type BuildStepBound } from "./build-step.js";
export { loadCoreWebBuildSeam } from "./core-seam.js";
export { inspectCoreWebBuild, type CoreWebBuildDecision } from "./decision.js";
export { prepareCoreWebBuild, type CoreWebBuildDependencies, type CoreWebBuildOptions } from "./prepare.js";
export { coreWebServerProcessSpec, type CoreWebServerProcessInput } from "./server-process.js";
export type { CoreWebBuild, CoreWebBuildCommand, CoreWebBuildSeam } from "./types.js";
