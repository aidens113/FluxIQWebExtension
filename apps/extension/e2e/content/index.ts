// The T2 content-script harness, as a spec imports it. harness.ts says what it
// runs and how faithful that is; fixture.ts, how a spec gets one.

export { expect, test } from "./fixture.js";
export { openContentHarness } from "./harness.js";
export type { ContentHarness, ContentHarnessOptions, HarnessRecordingSettings, SentMessage } from "./harness.js";
export type { HarnessDelivery } from "./runtime-stub.js";
