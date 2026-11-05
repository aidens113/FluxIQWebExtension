import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import path from "node:path";
import test from "node:test";
import { refusedOutsideControlPage } from "../control-page";
import { RUNTIME_MESSAGES } from "../../shared/constants";

// A compromised content script must not be able to send the stored credential to its own
// server, read it from storage, or end this browser's trust.

const EXTENSION_ID = "extension-under-test";

function withChrome(run: () => void): void {
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { runtime: { id: EXTENSION_ID, getURL: (file: string) => `chrome-extension://${EXTENSION_ID}/${file}` } } });
  try {
    run();
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous);
    else delete (globalThis as { chrome?: unknown }).chrome;
  }
}

const panel = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/sidepanel/index.html` } as chrome.runtime.MessageSender;
const popup = { id: EXTENSION_ID, url: `chrome-extension://${EXTENSION_ID}/popup/index.html` } as chrome.runtime.MessageSender;
const contentScript = { id: EXTENSION_ID, url: "https://shop.example/page", tab: { id: 1 } } as unknown as chrome.runtime.MessageSender;
const otherExtension = { id: "another-extension", url: `chrome-extension://another-extension/sidepanel/index.html` } as chrome.runtime.MessageSender;

for (const type of [RUNTIME_MESSAGES.connect, RUNTIME_MESSAGES.resetSession]) {
  test(`${type} is refused from a content script and another extension, and allowed from the panel`, () => withChrome(() => {
    assert.equal(refusedOutsideControlPage(type, contentScript), true);
    assert.equal(refusedOutsideControlPage(type, otherExtension), true);
    assert.equal(refusedOutsideControlPage(type, panel), false);
    assert.equal(refusedOutsideControlPage(type, popup), false);
  }));
}

test("other messages are not this gate's to refuse", () => withChrome(() => {
  assert.equal(refusedOutsideControlPage(RUNTIME_MESSAGES.getStatus, contentScript), false);
}));

test("the background applies the gate before it acts, and closes its storage to content scripts", () => {
  const source = readFileSync(path.join(process.cwd(), "src/background/index.ts"), "utf8");
  const gate = source.indexOf("refusedOutsideControlPage(typed.type, sender)");
  assert.ok(gate > 0, "the gate is applied");
  assert.ok(gate < source.indexOf("if (typed.type === RUNTIME_MESSAGES.connect) {"), "before connect");
  assert.ok(gate < source.indexOf("if (typed.type === RUNTIME_MESSAGES.resetSession) {"), "before resetSession");
  assert.match(source, /storage\.local\.setAccessLevel\?\.\(\{ accessLevel: "TRUSTED_CONTEXTS" \}\)/u);
});
