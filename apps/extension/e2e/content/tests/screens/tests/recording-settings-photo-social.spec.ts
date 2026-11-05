// Headed, provider-free look at recording and settings on the photo-social scenario, in a 360 px panel (and
// Firefox's 380 x 580 popup), by mouse and by keyboard: "Show me how" in the composer, the recording bar, the
// recording that ends as a chip on the next message (removed, re-attached, sent), and settings read top down with
// the technical things under Advanced, connected and not. The panel is the real one (`mountPanel`) over a scripted
// background: the recording it starts, stops and lists is written in the entry below, so nothing reaches FluxIQ,
// a provider or a key. Pictures go to the run's output folder.
import { expect, test } from "../../../index.js";
import type { Frame } from "@playwright/test";
import { bundlePanel, mountPanelFrame, type PanelBundle } from "../panel-frame.js";

type Win = { __show(name: string): void; __sent: Array<{ type: string } & Record<string, unknown>> };

const DESCRIPTION = "Open a profile and follow it";

const ENTRY = (surface: string, start: string) => `
  import { startScriptedPanel } from "./e2e/content/tests/screens/scripted-panel";
  import { defaultSettings } from "./src/shared/browser";
  type Store = { description: string; stopped: boolean; lists: number; mem: Record<string, unknown> };
  const scope = window as unknown as { __show(name: string): void; __sent: unknown[]; chrome: { storage: { local: Record<string, unknown> } } };
  // What a recording and the browser's storage hold lives on the page that holds the frame, so a popup that closes and
  // opens again finds what the first one left (the frame's own window is gone when it closes).
  const host = window.parent as unknown as { __rec?: Store };
  const store = (host.__rec ??= { description: "", stopped: false, lists: 0, mem: {} });
  scope.__sent = [];
  const settings = { ...defaultSettings(), coreApiUrl: "http://127.0.0.1:3000" };
  const base = { gatewayUrl: "ws://127.0.0.1:4777/client", clientId: "client-1", queueSize: 0, recentActivities: [], settings, connectionState: "connected", paired: true, projectId: "project-1" };
  startScriptedPanel({
    surface: "${surface}",
    start: "${start}",
    screens: {
      idle: { ...base, recordingState: "idle", eventCount: 0 },
      recording: { ...base, recordingState: "recording", eventCount: 3 },
      unpaired: { ...base, connectionState: "disconnected", paired: false, recordingState: "idle", eventCount: 0 }
    },
    answer: (message) => {
      if (message.type === "fluxiq.startRecording") {
        store.description = String((message as { description?: string }).description);
        store.stopped = false;
        setTimeout(() => scope.__show("recording"), 30);
        return Promise.resolve({ ok: true });
      }
      if (message.type === "fluxiq.stopRecording") {
        store.stopped = true;
        store.lists = 0;
        setTimeout(() => scope.__show("idle"), 30);
        return Promise.resolve({ ok: true });
      }
      if (message.type === "fluxiq.listRecordings") {
        store.lists += 1;
        const earlier = { id: "rec-1", description: "Something recorded before", status: "completed", projectId: "project-1", startedAt: 1, endedAt: 2 };
        // FluxIQ saves a recording a moment after Stop: it shows up on the third read.
        const fresh = store.stopped && store.lists >= 3 ? [{ id: "rec-9", description: store.description, status: "completed", projectId: "project-1", startedAt: 5, endedAt: 9 }] : [];
        return Promise.resolve({ ok: true, recordings: { items: [...fresh, earlier] } });
      }
      if (message.type === "fluxiq.panel.conversationSend") scope.__sent.push(message);
      return undefined;
    },
    ports: { setup: { readModelKey: async () => "ready" } }
  });
  // Storage that outlives the frame, with the remove the scripted one lacks. Patched before the first status arrives.
  const local = scope.chrome.storage.local;
  local.get = (_keys: unknown, done?: (items: Record<string, unknown>) => void) => done?.({ ...store.mem });
  local.set = (values: Record<string, unknown>, done?: () => void) => { Object.assign(store.mem, values); done?.(); };
  local.remove = (key: string, done?: () => void) => { delete store.mem[key]; done?.(); };
`;

let bundle: PanelBundle;
let popupBundle: PanelBundle;
let recordingPopupBundle: PanelBundle;
test.beforeAll(async () => {
  bundle = await bundlePanel(ENTRY("sidepanel", "connected"));
  popupBundle = await bundlePanel(ENTRY("popup", "connected"));
  recordingPopupBundle = await bundlePanel(ENTRY("popup", "recording"));
});

const show = (child: Frame, name: string) => child.evaluate((screen) => (window as unknown as Win).__show(screen), name);
const active = (child: Frame) => child.evaluate(() => {
  const element = document.activeElement as HTMLElement | null;
  return element === null ? "" : (element.getAttribute("aria-label") || element.textContent || element.id || "").trim();
});

test("photo-social: show me how by mouse, from the composer to a sent message", async ({ openHarness, page }, testInfo) => {
  await openHarness("photo-social");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 720 });
  const shot = (name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await show(child, "idle");

  // Idle: one control named "Start recording" beside "+", in the composer; nothing in the top bar for it.
  const start = frame.getByRole("button", { name: "Start recording" });
  await expect(start).toHaveCount(1);
  await expect(start).toBeVisible();
  await expect(start).toContainText("Show me how");
  await expect(frame.locator(".top-bar").getByRole("button", { name: "Start recording" })).toHaveCount(0);
  const named = await frame.locator(".top-bar").evaluate((bar) => Array.from(bar.querySelectorAll("button, [role=img]")).map((node) => (node.getAttribute("aria-label") ?? node.textContent ?? "").trim()));
  expect(named.every((name) => name !== ""), `every top bar control has a name: ${named.join(" | ")}`).toBe(true);
  expect(named, `what remains in the top bar at 360 px: ${named.join(" | ")}`).toHaveLength(5);
  const field = await frame.locator(".composer-field").boundingBox();
  const send = await frame.locator("#conversationSendButton").boundingBox();
  expect(field && send && send.x + send.width <= field.x + field.width + 1, "Send stays inside the composer").toBe(true);
  await shot("1-composer-idle");

  // One press: it asks what FluxIQ should learn, in plain words, and the chat is still the screen behind it.
  await start.click();
  await expect(frame.getByRole("heading", { name: "What should FluxIQ learn from this?" })).toBeVisible();
  await expect(frame.locator("dialog")).not.toContainText(/supporting evidence|screenshot|picture/iu);
  await shot("2-what-should-fluxiq-learn");
  await frame.getByLabel("Recording description").fill(DESCRIPTION);
  await frame.getByRole("button", { name: "Start described recording" }).click();

  // Recording: the bar with Stop, the chat still on screen, still the Chat tab.
  await expect(frame.locator("#stopRecordingButton")).toBeVisible();
  await expect(frame.locator(".recording-bar")).toContainText("Recording this tab");
  await expect(frame.locator("#conversationInput")).toBeVisible();
  await expect(frame.locator("#panelTab-chat")).toHaveAttribute("aria-selected", "true");
  await expect(frame.locator("#recordButton")).toBeHidden();
  await shot("3-recording-running");

  // Stop: it says it is saving, then the chip is on the composer, removable, with the caret in the box, and the panel did not move.
  await frame.locator("#stopRecordingButton").click();
  await expect(frame.locator(".composer-chip")).toBeVisible({ timeout: 15_000 });
  await expect(frame.locator(".composer-chip")).toContainText(`Recording: ${DESCRIPTION}`);
  await expect(frame.locator("#panelTab-chat")).toHaveAttribute("aria-selected", "true");
  await expect(frame.locator("#conversationInput")).toBeFocused();
  await expect(frame.locator(".recording-bar")).toBeHidden();
  await expect(frame.locator("#recordButton")).toBeVisible();
  await shot("4-ended-with-chip");

  // Removed.
  await frame.getByRole("button", { name: "Remove attached recording" }).click();
  await expect(frame.locator(".composer-chip")).toBeHidden();
  await shot("5-chip-removed");

  // Attached again from "+", then sent with the message: the recording travels with it and the chip clears.
  await frame.getByRole("button", { name: "Attach a recording" }).click();
  await frame.getByRole("group", { name: "Attach a recording" }).getByRole("button", { name: DESCRIPTION, exact: true }).click();
  await expect(frame.locator(".composer-chip")).toContainText(DESCRIPTION);
  await frame.locator("#conversationInput").fill("Follow the accounts this recording follows");
  await frame.locator("#conversationInput").press("Enter");
  await expect(frame.locator(".composer-chip")).toBeHidden();
  const sent = await child.evaluate(() => JSON.stringify((window as unknown as Win).__sent));
  expect(sent).toContain("rec-9");
  await expect(frame.locator("#app")).toContainText("Follow the accounts this recording follows");
  await shot("6-sent-with-attachment");
});

test("photo-social: show me how by keyboard, Tab order, Enter, focus and the caret afterwards", async ({ openHarness, page }, testInfo) => {
  await openHarness("photo-social");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 720 });
  await show(child, "idle");
  await frame.locator("#conversationInput").focus();
  await page.keyboard.press("Tab");
  expect(await active(child)).toBe("Attach a recording");
  await page.keyboard.press("Tab");
  expect(await active(child)).toBe("Start recording");
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-1-show-me-how-focused.png") });
  await page.keyboard.press("Enter");
  await expect(frame.getByLabel("Recording description")).toBeFocused();
  await page.keyboard.type(DESCRIPTION);
  await page.keyboard.press("Tab");
  expect(await active(child)).toBe("Start described recording");
  await page.keyboard.press("Enter");
  await expect(frame.locator("#stopRecordingButton")).toBeVisible();
  await frame.locator("#stopRecordingButton").focus();
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-2-stop-focused.png") });
  await page.keyboard.press("Enter");
  await expect(frame.locator(".composer-chip")).toContainText(DESCRIPTION, { timeout: 15_000 });
  await expect(frame.locator("#conversationInput")).toBeFocused();
  await page.keyboard.type("Go");
  await expect(frame.locator("#conversationInput")).toHaveValue("Go");
  await frame.locator("#app").screenshot({ path: testInfo.outputPath("keyboard-3-chip-and-caret.png") });
});

test("photo-social: settings read top down, Advanced holds the technical things, connected and not", async ({ openHarness, page }, testInfo) => {
  await openHarness("photo-social");
  const { frame, child } = await mountPanelFrame(page, bundle, { width: 360, height: 720 });
  const shot = (name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await show(child, "idle");
  await frame.getByRole("button", { name: "Settings" }).click();
  const order = await frame.locator(".settings-screen .settings-group").evaluateAll((groups) => groups.map((group) => group.getAttribute("aria-label")));
  expect(order).toEqual(["Connection", "Project", "Model key", "Status on the page", "Help", "Advanced"]);
  await expect(frame.locator(".settings-screen")).toContainText("Connected to FluxIQ");
  await expect(frame.locator(".settings-screen")).toContainText("FluxIQ approved this browser.");
  await expect(frame.locator(".settings-screen")).toContainText("Your model key is ready.");
  await expect(frame.locator(".settings-screen")).not.toContainText(/project-1|spend|budget/iu);
  await shot("settings-1-top-connected");
  // Advanced starts closed: a person reads what they care about first.
  await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeHidden();
  await frame.locator(".settings-advanced > summary").click();
  await frame.locator(".settings-advanced").scrollIntoViewIfNeeded();
  await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeVisible();
  await expect(frame.getByLabel("Record what I type", { exact: true })).toBeVisible();
  await expect(frame.getByRole("button", { name: "Save", exact: true })).toBeVisible();
  await expect(frame.getByRole("button", { name: "Forget this pairing", exact: true })).toBeVisible();
  await frame.locator(".settings-screen").evaluate((screen) => screen.scrollTo(0, screen.scrollHeight));
  await shot("settings-2-advanced-open");
  // Closing Advanced hides the technical things and Settings still reads cleanly; it is remembered for this viewer.
  await frame.locator(".settings-advanced > summary").click();
  await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeHidden();
  await frame.locator(".settings-screen").evaluate((screen) => screen.scrollTo(0, 0));
  await shot("settings-3-advanced-closed");
  await frame.locator(".settings-advanced > summary").click();
  // Keyboard: the summary is reachable and opens with Enter.
  await frame.locator(".settings-advanced > summary").focus();
  await page.keyboard.press("Enter");
  await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeHidden();
  await page.keyboard.press("Enter");
  await expect(frame.getByLabel("FluxIQ connection address", { exact: true })).toBeVisible();
  // Not connected: the same order, the approval in words, nothing hidden from a person fixing the address.
  await show(child, "unpaired");
  await expect(frame.locator(".settings-screen")).toContainText("isn't approved yet");
  await expect(frame.locator(".settings-screen")).toContainText("Connect to FluxIQ to see which project");
  await expect(frame.getByLabel("FluxIQ web address", { exact: true })).toBeVisible();
  await frame.locator(".settings-screen").evaluate((screen) => screen.scrollTo(0, 0));
  await shot("settings-4-disconnected");
});

test("photo-social: in Firefox's popup the words say recording goes on when the page is clicked", async ({ openHarness, page }, testInfo) => {
  await openHarness("photo-social");
  const { frame, child } = await mountPanelFrame(page, popupBundle, { width: 380, height: 580 });
  const shot = (name: string) => frame.locator("#app").screenshot({ path: testInfo.outputPath(`${name}.png`) });
  await show(child, "idle");
  await frame.getByRole("button", { name: "Start recording" }).click();
  await expect(frame.locator("dialog")).toContainText("Clicking the page closes this window, and recording goes on.");
  await shot("popup-1-question");
  await frame.getByLabel("Recording description").fill(DESCRIPTION);
  await frame.getByRole("button", { name: "Start described recording" }).click();
  await expect(frame.locator(".recording-bar")).toContainText("Clicking the page closes this window, but recording goes on.");
  await expect(frame.locator(".recording-bar")).not.toContainText(/screenshot|picture/iu);
  await shot("popup-2-recording");
  // The popup closes and opens again: the bar is there, and after Stop the chip is.
  await page.evaluate(() => document.getElementById("panel-frame")?.remove());
  const again = await mountPanelFrame(page, recordingPopupBundle, { width: 380, height: 580 });
  await expect(again.frame.locator("#stopRecordingButton")).toBeVisible();
  await again.frame.locator("#stopRecordingButton").click();
  await expect(again.frame.locator(".composer-chip")).toContainText(DESCRIPTION, { timeout: 15_000 });
  await again.frame.locator("#app").screenshot({ path: testInfo.outputPath("popup-3-reopened-after-stop.png") });
  await again.frame.getByRole("button", { name: "Settings" }).click();
  await again.frame.locator("#app").screenshot({ path: testInfo.outputPath("popup-4-settings.png") });
});
