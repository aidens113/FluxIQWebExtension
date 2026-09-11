// T1 coverage of recording-manifest.ts: the wire-visible source and channel
// ids a recording opens with. recordingEnvironment reads chrome.runtime and
// navigator, which this Node runner does not provide, so it is not covered here.

import assert from "node:assert/strict";
import { test } from "node:test";
import { WEB_AUTOMATION_ACTION_TYPES, WEB_AUTOMATION_DOMAIN_ID } from "@fluxiq-web-extension/domain/client";
import { browserExtensionCapabilities } from "../../../shared/protocol";
import { eventSourceId, observationSourceId, recordingActionChannels, recordingSources, stateSourceId, tabSourceId } from "../recording-manifest";

test("source ids are keyed by the client id", () => {
  assert.equal(eventSourceId("c-1"), "client.c-1.events");
  assert.equal(observationSourceId("c-1"), "client.c-1.observations");
  assert.equal(stateSourceId("c-1"), "client.c-1.state");
});

test("a tab source id names the frame only when one is given, frame 0 included", () => {
  assert.equal(tabSourceId(4), "tab:4");
  assert.equal(tabSourceId(4, 0), "tab:4:frame:0");
  assert.equal(tabSourceId(4, 2), "tab:4:frame:2");
});

test("a recording declares one event, one observation and one state source", () => {
  assert.deepEqual(recordingSources("c-1"), [
    { id: "client.c-1.events", label: "Browser events", kind: "event", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: "c-1" } },
    { id: "client.c-1.observations", label: "Browser observations", kind: "observation", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: "c-1" } },
    { id: "client.c-1.state", label: "Browser state", kind: "state", schemaId: WEB_AUTOMATION_DOMAIN_ID, metadata: { clientId: "c-1" } }
  ]);
});

test("the one action channel accepts every web automation action type", () => {
  const channels = recordingActionChannels("c-1");
  assert.equal(channels.length, 1);
  assert.deepEqual(channels[0], {
    id: "client.c-1.actions",
    label: "Browser action channel",
    actionTypes: [...WEB_AUTOMATION_ACTION_TYPES],
    capabilities: browserExtensionCapabilities.map((capability) => capability.id),
    metadata: { clientId: "c-1" }
  });
});
