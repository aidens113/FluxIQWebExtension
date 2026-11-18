// The getting-started screen: numbered steps that replace the chat until the browser is connected and approved.
// `start/` decides and draws the steps, `reachability/` finds the FluxIQ the person configured, and `setup-port.ts`
// is the one seam the AI key is read through (the key itself is drawn by the shared key card, in the chat and in Settings).
export { APPROVED_EARLIER_LINE, createStartView, MAY_HAVE_BEEN_REMOVED_LINE, startGuide, type StartConnect, type StartGuide, type StartStep, type StartStepKey, type StartStepState, type StartView } from "./start";
export type { ModelKeyReading } from "./model-key-reading";
export type { SetupPort } from "./setup-port";
export { extensionSetupPort } from "./extension-setup-port";
export { createReachabilityReader, discoveryProbe, REACHABILITY_BEAT_MS, type DiscoveryAnswer, type ReachabilityHost, type ReachabilityProbe, type ReachabilityReader, type ServerFinding } from "./reachability";
