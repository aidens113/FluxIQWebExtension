// Coverage of chat-page.ts: which page the chat names as the one the person is
// on, when the panel is the real side panel or popup (not a tab), a tab of its
// own, a docked popup window, or sits beside FluxIQ's own web panel.

import assert from "node:assert/strict";
import test from "node:test";

import { chatPageLocation } from "../chat-page";

const OWN = ["http://127.0.0.1:3000", "ws://127.0.0.1:3001/client"];

function deps(tabs: Array<{ url?: string }>, own: string[] = OWN) {
  return { activeTabs: async () => tabs, ownOrigins: () => own };
}

test("the real side panel or popup: the focused window's active tab is the page", async () => {
  assert.equal(await chatPageLocation(deps([{ url: "https://shop.example/kettles?q=blue" }])), "https://shop.example/kettles?q=blue");
});

test("the panel as a tab, or docked in its own window: the extension page is passed over for the page in another window", async () => {
  const tabs = [{ url: "chrome-extension://abc/sidepanel/index.html" }, { url: "chrome-extension://abc/sidepanel/index.html" }, { url: "https://shop.example/kettles" }];
  assert.equal(await chatPageLocation(deps(tabs)), "https://shop.example/kettles");
  assert.equal(await chatPageLocation(deps([{ url: "moz-extension://abc/popup/index.html" }, { url: "https://jobs.example/search" }])), "https://jobs.example/search");
});

test("FluxIQ's own web panel and gateway host are never the page, whatever the port's scheme", async () => {
  const tabs = [{ url: "http://127.0.0.1:3000/automation-studio" }, { url: "http://127.0.0.1:3001/" }, { url: "https://shop.example/" }];
  assert.equal(await chatPageLocation(deps(tabs)), "https://shop.example/");
});

test("no web page open anywhere is no page, and a failed query rejects", async () => {
  assert.equal(await chatPageLocation(deps([{ url: "about:blank" }, {}, { url: "file:///C:/x.html" }])), undefined);
  assert.equal(await chatPageLocation(deps([{ url: "https://shop.example/" }], ["not a url", ""])), "https://shop.example/");
  await assert.rejects(chatPageLocation({ activeTabs: async () => { throw new Error("tabs unavailable"); }, ownOrigins: () => OWN }), /tabs unavailable/u);
});
