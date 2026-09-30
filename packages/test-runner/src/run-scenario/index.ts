// The collaborators of `run-scenario.ts`.
//
// `runScenario` is the facility's spine: it opens one evidence bundle, drives
// one of four lanes against one fixture, and closes the bundle whatever
// happened. What lives here is everything that spine dispatches to but does not
// have to be read to follow it -- the browser session, the workflow and arming
// rules, the secrets and redaction inputs, the fixture's entry point, the Core
// round trip, and the two shapes of already-existing Flow a run can replay.
//
// The spine itself stays in `run-scenario.ts` on purpose: its failure handling
// is audited per file by the structure audit's `swallowed-failure` and
// `failure-as-empty` ratchets, and its call-site order is pinned at the source
// by four test files. Both are keyed to that path, so moving the spine would
// silently drop the guarantees rather than carry them.
export * from "./browser-session/index.js";
export * from "./clone-target/index.js";
export * from "./core-round-trip/index.js";
export * from "./decision-trace/index.js";
export * from "./persisted-flow-target/index.js";
export * from "./workflow/index.js";
export { configuredCredentials, type ConfiguredCredentials } from "./configured-credentials.js";
export { evidenceEvent, type EvidenceEventTrigger } from "./evidence-event.js";
export * from "./extension-start-trace/index.js";
export { extensionControlPage, extensionStartFailureDetails, openExtensionControlPage, type ExtensionControlPageOpen, type ExtensionControlPageOptions, type ExtensionControlPageReason } from "./extension-control-page.js";
export { keepsRunState } from "./keeps-run-state.js";
export { openScenarioStart } from "./open-scenario-start.js";
export { resolveRunSecrets, type RunSecrets, type RunSecretsInput } from "./resolve-run-secrets.js";
