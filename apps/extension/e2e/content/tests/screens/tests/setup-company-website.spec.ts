// Headed, provider-free look at setup on the company-website scenario: disconnected, waiting for approval,
// connected with the model key missing, locked and ready, and a failed connection, in a 360 px panel, by mouse
// and by keyboard. The panel is the real one (`mountPanel`) over a scripted background; its model key comes from
// a scripted setup port, so nothing reaches FluxIQ, a provider or a key. Pictures go to the run's output folder.
import { expect, test } from "../../../index.js";
import type { Frame } from "@playwright/test";
import { bundlePanel, mountPanelFrame, type PanelBundle } from "../panel-frame.js";

type Win = { __show(name: string): void; __key: string; __sent: Array<{ type: string; purpose?: string }> };

const ENTRY = (surface: string, start: string) => `
  import { startScriptedPanel } from "./e2e/content/tests/screens/scripted-panel";
  import { defaultSettings } from "./src/shared/browser";
  const scope = window as unknown as { __key: string; __sent: unknown[] };
  scope.__key = "missing";
  scope.__sent = [];
  const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
  const base = { recordingState: "idle", gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, eventCount: 0, recentActivities: [], settings };
  const keys = () => scope.__key === "missing" ? [] : [{ kind: "llm", provider: "scripted", enabled: true, ...(scope.__key === "locked" ? { unlocked: false, lockedBecause: "signed_out" } : {}) }];
  startScriptedPanel({
    surface: "${surface}",
    start: "${start}",
    screens: {
      error: { ...base, connectionState: "error", paired: false },
      pairing: { ...base, connectionState: "pairing", paired: false, pairingReferenceCode: "482913" }
    },
    answer: (message) => {
      if (message.type === "fluxiq.panel.modelReadiness") return Promise.resolve({ ok: true, payload: { keys: keys() } });
      if (message.type === "fluxiq.panel.openFluxIQ" || message.type === "fluxiq.connect") {
        scope.__sent.push({ type: message.type, purpose: (message as { purpose?: string }).purpose });
        return Promise.resolve({ ok: true });
      }
      return undefined;
    },
    ports: { setup: { readModelKey: async () => scope.__key === "missing" ? "missing" : scope.__key === "locked" ? "locked" : "ready" } }
  });
`;

let bundle: PanelBundle;
let popupBundle: PanelBundle;
test.beforeAll(async () => {
  bundle = await bundlePanel(ENTRY("sidepanel", "disconnected"));
  popupBundle = await bundlePanel(ENTRY("popup", "connected"));
});

const moveTo = (child: Frame, name: string, key?: string) =>
  child.evaluate(({ name, key }) => {
    const win = window as unknown as Win;
    if (key !== undefined) win.__key = key;
    win.__show(name);
  }, { name, key });

test("company-website: setup by mouse, every state, drawn and looked at at 360 px", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 720 });
  const shot = (name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });

  // Disconnected: every step in order, nothing ticked, how to start FluxIQ in words, no address, no "three steps".
  await expect(frame.locator(".start-step:not([hidden])")).toHaveCount(5);
  await expect(frame.locator(".start-step[data-state=done]")).toHaveCount(0);
  await expect(frame.locator(".start-screen")).toContainText("pnpm dev");
  await expect(frame.locator(".start-screen")).toContainText("sign in");
  await expect(frame.locator(".start-screen")).not.toContainText(/ws:\/\/|three steps/iu);
  await expect(frame.getByRole("button", { name: "Connect", exact: true })).toBeVisible();
  await shot("1-disconnected");
  await frame.getByRole("button", { name: "Connect", exact: true }).click();
  expect((await child.evaluate(() => (window as unknown as Win).__sent)).map((sent) => sent.type)).toContain("fluxiq.connect");

  // Waiting for approval: connected and running ticked, approval under way with its code.
  await moveTo(child, "pairing");
  await expect(frame.locator("#pairingReferenceCode")).toHaveText("482913");
  await expect(frame.locator(".start-step[data-state=waiting]")).toContainText("Approve this browser");
  await shot("2-waiting-for-approval");

  // Failed connection: a problem in words, Try again, the address behind a link.
  await moveTo(child, "error");
  await expect(frame.getByRole("button", { name: "Try again", exact: true })).toBeVisible();
  await expect(frame.locator(".start-step[data-state=problem]")).toContainText("isn't answering");
  await expect(frame.locator(".start-screen")).not.toContainText(/ws:\/\//u);
  await expect(frame.getByRole("button", { name: "Check the connection address" })).toBeVisible();
  await shot("3-failed-connection");

  // Connected, no model key: the chat stays reachable, the card says the one step, the chat's own line is not told too.
  await moveTo(child, "connected", "missing");
  const card = frame.locator(".setup-card");
  await expect(card).toBeVisible();
  await expect(card).toContainText("Add a model key");
  await expect(card).toContainText("connected and approved");
  await expect(frame.locator("#conversationInput")).toBeVisible();
  await expect(frame.locator("text=/needs a model key/i >> visible=true")).toHaveCount(1);
  await shot("4-connected-key-missing");
  await card.getByRole("button", { name: "Open FluxIQ" }).click();
  expect((await child.evaluate(() => (window as unknown as Win).__sent)).at(-1)).toEqual({ type: "fluxiq.panel.openFluxIQ", purpose: "model-key" });

  // Locked: the key is ticked, unlocking this browser once is the step.
  await moveTo(child, "connected", "locked");
  await child.evaluate(() => window.dispatchEvent(new Event("focus")));
  await expect(card).toContainText("Unlock this browser once");
  await expect(card).toContainText("password once");
  await shot("5-connected-key-locked");

  // Ready: it moves to the chat by itself on the next read, nobody presses anything.
  await moveTo(child, "connected", "ready");
  await expect(card).toBeHidden({ timeout: 8_000 });
  await expect(frame.locator("#conversationInput")).toBeVisible();
  await shot("6-connected-key-ready");
});

test("company-website: setup by keyboard, and Not now hands the reminder to the chat", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 720 });
  const focusName = () => child.evaluate(() => {
    const active = document.activeElement as HTMLElement | null;
    const name = active ? (active.getAttribute("aria-label") ?? active.textContent ?? active.id).trim() : "";
    return name.length > 40 ? `${name.slice(0, 40)}...` : name;
  });
  await frame.locator("#panelTab-chat").focus();
  // Tab until the Connect button has focus; the controls before it are the top bar and the sign-in step's Open FluxIQ.
  const seen: string[] = [];
  for (let step = 0; step < 14 && !seen.includes("Connect"); step++) {
    await page.keyboard.press("Tab");
    seen.push(await focusName());
  }
  expect(seen, `Tab order ${seen.join(" > ")}`).toContain("Connect");
  expect(seen.indexOf("Open FluxIQ"), "the sign-in step's Open FluxIQ comes before Connect").toBeLessThan(seen.indexOf("Connect"));
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-1-connect-focused.png") });
  await page.keyboard.press("Enter");
  expect((await child.evaluate(() => (window as unknown as Win).__sent)).map((sent) => sent.type)).toContain("fluxiq.connect");

  await moveTo(child, "connected", "missing");
  const card = frame.locator(".setup-card");
  await expect(card).toBeVisible();
  await card.getByRole("button", { name: "Open FluxIQ" }).focus();
  await page.keyboard.press("Enter");
  expect((await child.evaluate(() => (window as unknown as Win).__sent)).at(-1)?.purpose).toBe("model-key");
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-2-card-open-focused.png") });
  await page.keyboard.press("Tab");
  expect(await focusName()).toBe("Not now");
  await page.keyboard.press("Enter");
  await expect(card).toBeHidden();
  // The chat's own key line now carries the reminder, once, and the composer is unaffected.
  await expect(frame.locator("text=/needs a model key/i >> visible=true")).toHaveCount(1);
  await expect(frame.locator("#conversationInput")).toBeVisible();
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-3-not-now.png") });
});

test("company-website: a popup that closed and opened again lands on the same step", async ({ openHarness, page }, testInfo) => {
  await openHarness("company-website");
  const first = await mountPanelFrame(page, popupBundle, { width: 360, height: 720 });
  await moveTo(first.child, "connected", "missing");
  await expect(first.frame.locator(".setup-card")).toContainText("Add a model key");
  // The popup closes when Open FluxIQ is pressed; a new popup mounts with the key still missing.
  await page.evaluate(() => document.getElementById("panel-frame")?.remove());
  const again = await mountPanelFrame(page, popupBundle, { width: 360, height: 720 });
  await moveTo(again.child, "connected", "missing");
  await expect(again.frame.locator(".setup-card")).toContainText("Add a model key");
  await again.frame.locator("#app").screenshot({ path: testInfo.outputPath("popup-reopened.png") });
});
