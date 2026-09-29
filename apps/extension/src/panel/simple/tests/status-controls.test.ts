// The status card table in the UI audit, section 4 ("1. Status card"), one
// assertion per row: the sentence and line (connectionCopy) together with the
// buttons and link this view puts under them (statusControls).

import assert from "node:assert/strict";
import test from "node:test";
import type { ExtensionStatus } from "../../../shared/protocol";
import { connectionCopy } from "../../copy";
import { statusControls } from "../status-controls";
import { statusWith } from "./status-fixture";

function row(status: ExtensionStatus) {
  const copy = connectionCopy(status);
  const controls = statusControls(status);
  return {
    dot: copy.dot,
    sentence: copy.sentence,
    line: copy.line,
    buttons: controls.buttons.map((button) => `${button.primary ? "*" : ""}${button.label}`),
    link: controls.addressLink,
    pairing: controls.pairing
  };
}

test("disconnected, never paired: Connect, keeping the Lab's exact name", () => {
  assert.deepEqual(row(statusWith()), {
    dot: "grey", sentence: "FluxIQ isn't connected", line: "Connect this browser so FluxIQ can work in it.",
    buttons: ["*Connect"], link: undefined, pairing: false
  });
  assert.equal(statusControls(statusWith()).buttons[0]?.action, "connect");
});

test("disconnected, paired before: Connect to pick up where you left off", () => {
  assert.deepEqual(row(statusWith({ paired: true })), {
    dot: "grey", sentence: "FluxIQ isn't connected", line: "Connect to pick up where you left off.",
    buttons: ["*Connect"], link: undefined, pairing: false
  });
});

test("connecting: Cancel, which disconnects", () => {
  assert.deepEqual(row(statusWith({ connectionState: "connecting" })), {
    dot: "amber", sentence: "Connecting to FluxIQ...", line: undefined, buttons: ["Cancel"], link: undefined, pairing: false
  });
  assert.equal(statusControls(statusWith({ connectionState: "connecting" })).buttons[0]?.action, "disconnect");
});

test("reconnecting: Try now", () => {
  assert.deepEqual(row(statusWith({ connectionState: "reconnecting", paired: true })), {
    dot: "amber", sentence: "Lost the connection. Trying again...", line: "FluxIQ reconnects on its own.",
    buttons: ["*Try now"], link: undefined, pairing: false
  });
});

test("error: Try again, and a link to check the connection address", () => {
  assert.deepEqual(row(statusWith({ connectionState: "error", lastError: "WebSocket connection failed." })), {
    dot: "red", sentence: "Can't reach FluxIQ", line: "Make sure FluxIQ is running on this computer, then try again.",
    buttons: ["*Try again"], link: "Check the connection address", pairing: false
  });
});

test("pairing: the pairing card with Open FluxIQ and Cancel", () => {
  assert.deepEqual(row(statusWith({ connectionState: "pairing", pairingReferenceCode: "482913" })), {
    dot: "amber", sentence: "Approve this browser in FluxIQ", line: "In FluxIQ, approve the request that shows this code.",
    buttons: ["*Open FluxIQ", "Cancel"], link: undefined, pairing: true
  });
  assert.deepEqual(statusControls(statusWith({ connectionState: "pairing" })).buttons.map((button) => button.action), ["openFluxIQ", "disconnect"]);
});

test("connected: no buttons, and the line names the page, the lack of one, or why not", () => {
  const connected = (overrides: Partial<ExtensionStatus>) => row(statusWith({ connectionState: "connected", paired: true, ...overrides }));
  assert.deepEqual(connected({ activeTabUrl: "https://shop.example.com/search?q=1" }), {
    dot: "green", sentence: "Connected to FluxIQ", line: "Working in: shop.example.com", buttons: [], link: undefined, pairing: false
  });
  assert.equal(connected({}).line, "Open a web page for FluxIQ to work on.");
  assert.equal(
    connected({ activeTabUrl: "chrome://extensions", unsupportedPage: { reason: "Browser pages can't be automated." } }).line,
    "FluxIQ can't work on this page. Browser pages can't be automated."
  );
  assert.equal(connected({}).buttons.length, 0);
});
