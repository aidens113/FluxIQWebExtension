// The panel's words, pinned to the tables in the UI audit, section 4
// (docs/working/manual-panel-test-findings/reports/ext-ui-audit.md): the status
// card, the step sentences and the error sentences, one assertion per row.

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus, RuntimeCommandStatus } from "../../../shared/protocol";
import { connectionCopy, errorSentence, EXTENSION_RESTARTED, pageHostname, stepSentence } from "..";

function status(overrides: Partial<ExtensionStatus> & { paired?: boolean } = {}): ExtensionStatus {
  return {
    connectionState: "disconnected",
    recordingState: "idle",
    gatewayUrl: "ws://127.0.0.1:4777/client",
    clientId: "client-1",
    queueSize: 0,
    eventCount: 0,
    recentActivities: [],
    ...overrides
  } as ExtensionStatus;
}

test("status card: disconnected distinguishes never paired from paired before", () => {
  assert.deepEqual(connectionCopy(status()), {
    dot: "grey", sentence: "FluxIQ isn't connected", line: "Connect this browser so FluxIQ can work in it."
  });
  assert.deepEqual(connectionCopy(status({ paired: true })), {
    dot: "grey", sentence: "FluxIQ isn't connected", line: "Connect to pick up where you left off."
  });
});

test("status card: connecting, reconnecting, error and pairing", () => {
  assert.deepEqual(connectionCopy(status({ connectionState: "connecting" })), { dot: "amber", sentence: "Connecting to FluxIQ..." });
  assert.deepEqual(connectionCopy(status({ connectionState: "reconnecting" })), {
    dot: "amber", sentence: "Lost the connection. Trying again...", line: "FluxIQ reconnects on its own."
  });
  assert.deepEqual(connectionCopy(status({ connectionState: "error", lastError: "WebSocket connection failed." })), {
    dot: "red", sentence: "Can't reach FluxIQ", line: "Make sure FluxIQ is running on this computer, then try again."
  });
  assert.deepEqual(connectionCopy(status({ connectionState: "pairing", pairingReferenceCode: "ABC123" })), {
    dot: "amber", sentence: "Approve this browser in FluxIQ", line: "In FluxIQ, approve the request that shows this code."
  });
});

test("status card: connected names the page by hostname only, or says why it cannot work there", () => {
  assert.deepEqual(connectionCopy(status({ connectionState: "connected", activeTabUrl: "https://shop.example.com/cart?id=9" })), {
    dot: "green", sentence: "Connected to FluxIQ", line: "Working in: shop.example.com"
  });
  assert.equal(connectionCopy(status({ connectionState: "connected" })).line, "Open a web page for FluxIQ to work on.");
  assert.equal(
    connectionCopy(status({ connectionState: "connected", activeTabUrl: "chrome://extensions", unsupportedPage: { reason: "Browser pages cannot be recorded." } })).line,
    "FluxIQ can't work on this page. Browser pages cannot be recorded."
  );
});

test("status card: recording never turns the dot red", () => {
  assert.equal(connectionCopy(status({ connectionState: "connected", recordingState: "recording", activeTabUrl: "https://a.test/" })).dot, "green");
});

function step(actionType: RuntimeCommandStatus["actionType"], extra: Record<string, unknown> = {}): RuntimeCommandStatus {
  return { state: "running", actionType, ...extra } as RuntimeCommandStatus;
}

test("step sentences: a named element is quoted, an unnamed one lets the verb stand alone", () => {
  assert.equal(stepSentence(step("web.dom.click", { targetName: "Search" }), "present"), "Clicking \"Search\"");
  assert.equal(stepSentence(step("web.dom.click", { targetName: "Search" }), "past"), "Clicked \"Search\"");
  assert.equal(stepSentence(step("web.dom.click"), "present"), "Clicking a button");
  assert.equal(stepSentence(step("web.dom.type", { targetName: "Email" }), "past"), "Typed into \"Email\"");
  assert.equal(stepSentence(step("web.dom.type"), "present"), "Typing into a field");
  assert.equal(stepSentence(step("web.dom.clear", { targetName: "Email" }), "present"), "Clearing \"Email\"");
  assert.equal(stepSentence(step("web.dom.select", { targetName: "Size" }), "present"), "Choosing an option in \"Size\"");
  assert.equal(stepSentence(step("web.dom.select", { targetName: "Size" }), "past"), "Chose an option in \"Size\"");
  assert.equal(stepSentence(step("web.dom.check", { targetName: "Remember me" }), "past"), "Ticked \"Remember me\"");
  assert.equal(stepSentence(step("web.dom.click", { targetName: "  Add \n to   cart " }), "present"), "Clicking \"Add to cart\"");
});

test("step sentences: a selector in `target` is never shown", () => {
  assert.equal(stepSentence(step("web.dom.click", { target: "#main > div:nth-child(3) button" }), "present"), "Clicking a button");
});

test("step sentences: navigate names the hostname; fixed verbs for the rest", () => {
  assert.equal(stepSentence(step("web.browser.navigate", { url: "https://shop.example.com/search?q=x" }), "present"), "Opening shop.example.com");
  assert.equal(stepSentence(step("web.browser.navigate", { url: "https://shop.example.com/" }), "past"), "Opened shop.example.com");
  assert.equal(stepSentence(step("web.browser.navigate"), "present"), "Opening a page");
  // t193: a capture said "Looking at the page" wherever it ran; it names the site when the run knows it.
  assert.equal(stepSentence(step("web.dom.capture_snapshot", { url: "https://shop.example.com/cart" }), "present"), "Looking over shop.example.com");
  assert.equal(stepSentence(step("web.dom.capture_snapshot", { url: "https://shop.example.com/cart" }), "past"), "Looked over shop.example.com");
  const table: Array<[RuntimeCommandStatus["actionType"], string, string]> = [
    ["web.dom.keypress", "Pressing a key", "Pressed a key"],
    ["web.dom.scroll", "Scrolling the page", "Scrolled the page"],
    ["web.dom.wait_for_selector", "Waiting for the page", "Page was ready"],
    ["web.dom.wait_for_text", "Waiting for the page", "Page was ready"],
    ["web.dom.extract", "Reading data from the page", "Read data from the page"],
    ["web.dom.extract_list", "Reading data from the page", "Read data from the page"],
    ["web.dom.capture_snapshot", "Looking over the whole page", "Looked over the whole page"],
    ["web.dom.assert", "Checking the page", "Checked the page"],
    ["web.dom.upload", "Attaching files", "Attached files"],
    ["web.dom.dialog", "Answering a pop-up", "Answered a pop-up"],
    ["web.browser.tab", "Switching tabs", "Switched tabs"],
    ["web.browser.download", "Waiting for a download", "Download finished"]
  ];
  for (const [actionType, present, past] of table) {
    assert.equal(stepSentence(step(actionType), "present"), present, `${actionType} present`);
    assert.equal(stepSentence(step(actionType), "past"), past, `${actionType} past`);
  }
});

test("step sentences: an unknown or missing action type is a generic sentence", () => {
  assert.equal(stepSentence(step(undefined), "present"), "Running a step");
  assert.equal(stepSentence(step(undefined), "past"), "Finished a step");
  assert.equal(stepSentence(step("web.dom.teleport" as RuntimeCommandStatus["actionType"]), "past"), "Finished a step");
});

test("error sentences: transport and API failures become plain sentences", () => {
  assert.equal(errorSentence("WebSocket connection failed."), "Can't reach FluxIQ. Make sure it is running on this computer.");
  assert.equal(errorSentence(undefined), EXTENSION_RESTARTED);
  assert.equal(errorSentence("Could not establish connection. Receiving end does not exist."), EXTENSION_RESTARTED);
  assert.equal(errorSentence("FluxIQ recordings API returned 401."), "FluxIQ didn't accept this browser. Connect again to re-approve it.");
  assert.equal(errorSentence("FluxIQ recordings API returned 500."), "Couldn't load recordings from FluxIQ.");
});

test("error sentences: plain background sentences are kept, anything else is generic", () => {
  assert.equal(errorSentence("Connect to FluxIQ before recording."), "Connect to FluxIQ before recording.");
  assert.equal(errorSentence("Open a FluxIQ project before recording."), "Open a FluxIQ project before recording.");
  assert.equal(errorSentence("Cannot read properties of undefined (reading 'ok')"), "Something went wrong.");
  assert.equal(errorSentence("server.error: E_TOKEN_EXPIRED"), "Something went wrong.");
});

test("pageHostname returns a hostname or nothing, never a URL", () => {
  assert.equal(pageHostname("https://shop.example.com:8443/a?b=c"), "shop.example.com");
  assert.equal(pageHostname("about:blank"), undefined);
  assert.equal(pageHostname("not a url"), undefined);
  assert.equal(pageHostname(undefined), undefined);
});
