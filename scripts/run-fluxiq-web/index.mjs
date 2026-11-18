// Barrel for the launcher's preparation (`scripts/run-fluxiq-web.mjs`):
// dependencies, FluxIQ Core's libraries and the panel host, each brought up to
// date before the host is set up, so a person never meets a stale-state error.
// The task tool's shared Core is only checked, never changed.
export { coreKind } from "./core-kind.mjs";
export { CORE_LIBRARY_STEPS, summarizeBuildCache } from "./core-libraries.mjs";
export { installSummary, PANEL_HOST_STEP, prepareWorkspace, taskToolCoreChecks } from "./prepare-workspace.mjs";
export { runCaptured } from "./run-captured.mjs";
