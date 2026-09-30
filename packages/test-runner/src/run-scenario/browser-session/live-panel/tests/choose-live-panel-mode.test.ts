import assert from "node:assert/strict";
import test from "node:test";
import { chooseLivePanelMode, type LivePanelAttempt } from "../choose-live-panel-mode.js";

function openers(sidePanel: () => Promise<LivePanelAttempt>, popup: () => Promise<LivePanelAttempt>) {
  const calls: string[] = [];
  return {
    calls,
    openers: {
      sidePanel: async () => { calls.push("side-panel"); return sidePanel(); },
      popup: async () => { calls.push("popup"); return popup(); },
    },
  };
}

const HEADED = { enabled: true, headless: false };

test("a side panel verified open is the mode, and no popup is opened", async () => {
  const fake = openers(async () => ({ ok: true }), async () => ({ ok: true }));
  assert.deepEqual(await chooseLivePanelMode(HEADED, fake.openers), { mode: "side-panel" });
  assert.deepEqual(fake.calls, ["side-panel"]);
});

test("a refused side panel falls back to the docked popup and keeps the refusal", async () => {
  const fake = openers(async () => ({ ok: false, reason: "chrome.sidePanel.open refused: `sidePanel.open()` may only be called in response to a user gesture." }), async () => ({ ok: true }));
  assert.deepEqual(await chooseLivePanelMode(HEADED, fake.openers), { mode: "popup", sidePanelRefusal: "chrome.sidePanel.open refused: `sidePanel.open()` may only be called in response to a user gesture." });
  assert.deepEqual(fake.calls, ["side-panel", "popup"]);
});

test("when both fail the mode is none, with both reasons, and nothing throws", async () => {
  const fake = openers(async () => ({ ok: false, reason: "no SIDE_PANEL context appeared" }), async () => { throw new Error("windows.create failed"); });
  assert.deepEqual(await chooseLivePanelMode(HEADED, fake.openers), { mode: "none", reason: "side panel: no SIDE_PANEL context appeared; popup: windows.create failed" });
});

test("an opener that throws is a refusal, not a failed run", async () => {
  const fake = openers(async () => { throw new Error("Target page, context or browser has been closed"); }, async () => ({ ok: true }));
  assert.deepEqual(await chooseLivePanelMode(HEADED, fake.openers), { mode: "popup", sidePanelRefusal: "Target page, context or browser has been closed" });
});

test("a headless browser tries nothing", async () => {
  const fake = openers(async () => ({ ok: true }), async () => ({ ok: true }));
  assert.deepEqual(await chooseLivePanelMode({ enabled: true, headless: true }, fake.openers), { mode: "skipped", reason: "headless" });
  assert.deepEqual(fake.calls, []);
});

test("--no-live-panel tries nothing, headed or not", async () => {
  const fake = openers(async () => ({ ok: true }), async () => ({ ok: true }));
  assert.deepEqual(await chooseLivePanelMode({ enabled: false, headless: false }, fake.openers), { mode: "skipped", reason: "--no-live-panel" });
  assert.deepEqual(await chooseLivePanelMode({ enabled: false, headless: true }, fake.openers), { mode: "skipped", reason: "--no-live-panel" });
  assert.deepEqual(fake.calls, []);
});
