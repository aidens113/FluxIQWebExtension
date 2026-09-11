// T1 coverage of the live input filter (audit-recording Finding 2): the hub
// must deliver a user-recorded action, whose domainId the extension sends at
// the top level of the recording event, as well as a runtime confirmation,
// which carries it in metadata.

import assert from "node:assert/strict";
import type { ClientGatewayEvent, FluxIQ, IoEnvelope } from "fluxiq";
import type { JsonObject } from "fluxiq/core";
import { createWebAutomationRecordingEvent, createWebAutomationStateUpdate } from "../../client";
import { WEB_AUTOMATION_DOMAIN_ID } from "../../constants";
import { GatewayInputHub } from "../gateway-input-hub";
import { WEB_AUTOMATION_INPUT_IDS } from "../input-model";

let emit: (event: ClientGatewayEvent) => void = () => {
  throw new Error("GatewayInputHub did not subscribe to client gateway events.");
};
const fluxiq = {
  programs: {
    clientGateway: {
      onEvent(listener: (event: ClientGatewayEvent) => void) {
        emit = listener;
        return () => undefined;
      }
    }
  }
} as unknown as FluxIQ;

const hub = new GatewayInputHub(fluxiq);
const session = { sessionId: "session.1", clientId: "client.1" };
let messageSequence = 0;

function gatewayMessage(type: "client.recording_event" | "client.state_update" | "client.snapshot", payload: unknown): ClientGatewayEvent {
  messageSequence += 1;
  return { type, session, message: { id: `message.${messageSequence}`, type, timestamp: 1_000 + messageSequence, payload } } as unknown as ClientGatewayEvent;
}

const clicked: Array<IoEnvelope<JsonObject>> = [];
const unsubscribeClicked = hub.subscribe(WEB_AUTOMATION_INPUT_IDS.elementClicked, (event) => clicked.push(event));
const browserState: Array<IoEnvelope<JsonObject>> = [];
hub.subscribe(WEB_AUTOMATION_INPUT_IDS.browserState, (event) => browserState.push(event));

// A user click exactly as the extension sends it: domainId at the top level, only inputId in metadata.
const userClick = createWebAutomationRecordingEvent({
  kind: "dom.click",
  sequence: 7,
  url: "https://example.test/form",
  title: "Form",
  eventTimestampMs: 10,
  element: { selector: "#save", tagName: "button", text: "Save" },
  metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
});
assert.equal(userClick.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(userClick.metadata?.domainId, undefined, "the recorded event names its domain only at the top level");
emit(gatewayMessage("client.recording_event", userClick));
assert.equal(clicked.length, 1, "a user-recorded action reaches its input subscribers");
assert.equal(clicked[0]?.ioId, WEB_AUTOMATION_INPUT_IDS.elementClicked);
assert.equal(clicked[0]?.domainId, WEB_AUTOMATION_DOMAIN_ID);
assert.equal(clicked[0]?.sequence, 7);
assert.equal((clicked[0]?.payload.element as JsonObject | undefined)?.selector, "#save");
assert.equal(clicked[0]?.metadata?.sessionId, "session.1");
assert.equal(clicked[0]?.metadata?.clientId, "client.1");
assert.equal(clicked[0]?.metadata?.inputId, WEB_AUTOMATION_INPUT_IDS.elementClicked);

// A runtime confirmation: no top-level domainId, domainId and inputId in metadata.
emit(gatewayMessage("client.recording_event", {
  eventType: "web.element.clicked",
  payload: { sequence: 8, element: { selector: "#save" } },
  metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
}));
assert.equal(clicked.length, 2, "a runtime confirmation reaches its input subscribers");
assert.equal(clicked[1]?.sequence, 8);

// The top-level domainId wins over metadata, as in Core's gateway bridge.
emit(gatewayMessage("client.recording_event", {
  domainId: "another-domain",
  eventType: "web.element.clicked",
  payload: { sequence: 9 },
  metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked }
}));
emit(gatewayMessage("client.recording_event", { eventType: "web.element.clicked", payload: { sequence: 10 }, metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked } }));
emit(gatewayMessage("client.recording_event", { domainId: WEB_AUTOMATION_DOMAIN_ID, eventType: "web.dom.mutated", payload: { sequence: 11 }, metadata: {} }));
emit(gatewayMessage("client.recording_event", undefined));
emit(gatewayMessage("client.snapshot", { domainId: WEB_AUTOMATION_DOMAIN_ID, metadata: { domainId: WEB_AUTOMATION_DOMAIN_ID, inputId: WEB_AUTOMATION_INPUT_IDS.elementClicked } }));
assert.equal(clicked.length, 2, "another domain, no domain, no input id, no payload, and other message types are not delivered");

// State updates carry domainId in metadata and deliver their state.
emit(gatewayMessage("client.state_update", createWebAutomationStateUpdate({
  state: { sequence: 12, url: "https://example.test/form" },
  metadata: { inputId: WEB_AUTOMATION_INPUT_IDS.browserState }
})));
assert.equal(browserState.length, 1);
assert.equal(browserState[0]?.payload.url, "https://example.test/form");
assert.equal(browserState[0]?.sequence, 12);
assert.equal(clicked.length, 2, "an envelope reaches only the subscribers of its own input");

unsubscribeClicked();
emit(gatewayMessage("client.recording_event", userClick));
assert.equal(clicked.length, 2, "an unsubscribed handler receives nothing");

console.log("Gateway input hub tests passed.");
