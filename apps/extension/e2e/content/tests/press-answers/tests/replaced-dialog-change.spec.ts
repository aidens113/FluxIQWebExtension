// What a press changed, when the press closed one dialog and another opened where it stood (t897), on
// social-network-feed's group page through the real content-script bundle and the real domain evidence
// runtime (T2 harness: no background worker, no Core, no model).
//
// Live run `run-mwb5cnxg-003415b4`: the press on the group's "Write something..." first closed
// "Turn on notifications?", which covered it, and the composer's dialog opened where that one had
// stood. The domain gave the composer the closed dialog's handles, its change walk read one dialog
// that now reads "Create post", and Core took that as a press that changed something that stays: the
// composer's prompt was held as done on every later attempt. A layer's handle now names that layer only
// (`domain/.../stable-handles.ts`, by each element's `nodeToken`). A dialog that retitles itself, by
// contrast, is the same dialog, and its new words are still stated as reading otherwise.

import type { JsonObject } from "fluxiq/core";
import type { Page } from "@playwright/test";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import type { BrowserActionCommand } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const GROUP = "/scenarios/social-network-feed/groups/riverside-allotments/";
const NOTICE = "Turn on notifications?";
const base = { projectId: "project.t897", flowId: "flow.t897", maxEvidenceBytes: 64_000 } as const;

type Change = { words: string; how: string };

/** The domain's evidence runtime over this harness, as the extension's background would hand it captures and presses. */
function runtimeOver(harness: ContentHarness) {
  let n = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t897"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t897.${++n}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  return async (callId: string, node: string, parameters: JsonObject) => await runtime.executeTool({ ...base, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node, parameters, consequences: [] } });
}

/** The group page with the cookie choice made and the notifications prompt up, as attempt 1 met it. */
async function promptUp(harness: ContentHarness, page: Page): Promise<void> {
  await page.goto(new URL(GROUP, harness.lab.origin).href);
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
  await page.getByRole("button", { name: "Decline optional cookies" }).click({ timeout: 15_000 });
  await expect(page.getByText(NOTICE)).toBeVisible({ timeout: 15_000 });
}

function handleOf(view: string, pattern: RegExp): string {
  const line = view.split("\n").find((each) => pattern.test(each));
  if (!line) throw new Error(`no line ${pattern} in the view`);
  return line.split(" ")[0]!;
}

test("a press that closed one dialog and opened another where it stood says the new dialog's lines appeared, and no line reads otherwise", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("social-network-feed");
  await promptUp(harness, page);
  const run = runtimeOver(harness);
  const looked = await run("look", "web.output.dom-capture_snapshot", {});
  const prompt = handleOf((looked.evidence as { page?: string }).page ?? "", /^t\d+ button "Write something\.\.\."/u);
  const pressed = await run("press", "web.output.dom-click", { target: { handle: prompt } });
  await expect(page.getByRole("dialog", { name: "Create post" })).toBeVisible();
  const changed = (pressed.draft?.changed ?? []) as Change[];
  expect((pressed.evidence as JsonObject).pageChanged, "the press did something").toBe(true);
  expect(changed.filter((line) => line.how === "reads" || line.how === "rose"), JSON.stringify(changed)).toEqual([]);
  expect(changed.some((line) => line.how === "appeared" && line.words.includes("Add to your post")), JSON.stringify(changed)).toBe(true);
});

test("a press after which the open dialog retitles itself is still stated as reading otherwise", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("social-network-feed");
  await promptUp(harness, page);
  // The same dialog, retitled in place by its own Turn on: what a confirmation that stays open does.
  await page.evaluate((notice) => {
    const dialog = Array.from(document.querySelectorAll('[role="dialog"]')).find((each) => (each.textContent ?? "").includes(notice))!;
    const turnOn = Array.from(dialog.querySelectorAll('[role="button"]')).find((each) => (each.textContent ?? "").trim() === "Turn on")!;
    turnOn.addEventListener("click", (event) => {
      event.stopImmediatePropagation();
      const title = dialog.querySelector("h2")!;
      title.textContent = "Notifications are on";
    }, { capture: true });
  }, NOTICE);
  const run = runtimeOver(harness);
  const looked = await run("look", "web.output.dom-capture_snapshot", {});
  const turnOn = handleOf((looked.evidence as { page?: string }).page ?? "", /^t\d+ button "Turn on"$/u);
  const pressed = await run("press", "web.output.dom-click", { target: { handle: turnOn } });
  const changed = (pressed.draft?.changed ?? []) as Change[];
  expect(changed.some((line) => line.how === "reads" && line.words.includes("Notifications are on")), JSON.stringify(changed)).toBe(true);
});
