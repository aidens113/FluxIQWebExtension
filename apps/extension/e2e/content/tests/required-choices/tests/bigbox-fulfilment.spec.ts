// A saved add that requires the fulfilment option it was built with (t1030), on
// bigbox-retail's own store chooser, the shape of paid run
// `run-mwuxd2v9-33928ea3`: the chooser showed Pickup chosen, closed, and the add
// ran with Pickup out of view. The chooser is a flyout inside the header's open
// shadow root, `hidden` when closed, its Pickup and Delivery tabs drawn apart
// only by a class.
//
// The build's half goes the whole way a build goes: the content script's
// snapshots read through the domain's evidence runtime, the chooser opened and
// closed by handle, and the add pressed by handle, whose draft statement says
// Pickup stood chosen and where it is found again (`at`). The playback half is
// that add as Core saves it: its resolved parameters with `requiresChosen`, sent
// through Core's normalizer and the gateway mapping to the content script, on a
// fresh document where the chooser was never opened (a later attempt's replay),
// and then with Delivery chosen and the chooser closed again. The oracle is the
// Scenario Lab's own cart, never the reply alone.

import type { Page } from "@playwright/test";
import type { JsonObject } from "fluxiq/core";
import { normalizeWebElementTarget as normalizeAutomationStudioElementTarget } from "@fluxiq-web-extension/domain";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const BASE = { projectId: "project.t1030", flowId: "flow.t1030", maxEvidenceBytes: 64_000 } as const;
const CLICK = "web.output.dom-click";

const whyNot = (reply: BrowserActionResult): string => reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

/** Waits for a document to finish loading and the content script to announce itself in it. */
async function contentReady(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000, message: "the content script announced itself in the new document" }).toBe(true);
}

/** The handle of the first view line worded as `pattern` matches. */
function handleOf(view: string, pattern: RegExp): string {
  const line = view.split("\n").find((each) => pattern.test(each));
  const handle = line ? /^(t\d+)\b/u.exec(line)?.[1] : undefined;
  if (!handle) throw new Error(`no line matching ${pattern} in:\n${view}`);
  return handle;
}

/** The handle of the "+ Add" of the tile titled `title`: the first "+ Add" line after the title's line. */
function addAfter(view: string, title: string): string {
  const lines = view.split("\n");
  const at = lines.findIndex((line) => line.includes(title));
  const add = at < 0 ? undefined : lines.slice(at).find((line) => /button "\+ Add"/u.test(line));
  const handle = add ? /^(t\d+)\b/u.exec(add)?.[1] : undefined;
  if (!handle) throw new Error(`no "+ Add" after "${title}" in:\n${view}`);
  return handle;
}

/** The command a saved click's dispatch hands the content script: Core's normalizer, the wire target, the gateway mapping. */
function dispatched(commandId: string, parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.click", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  if ("status" in command) throw new Error(`the command was refused: ${JSON.stringify(command)}`);
  return command as BrowserActionCommand;
}

/**
 * The site's own hydration done: its first press on a "+ Add" only wakes the page
 * (`window.vr.wake`), which a browser's real page world shows as a fresh binding
 * and this harness, with no page world, does not. Not what this test is about, so
 * the page is woken as a shopper's earlier press would have woken it.
 */
async function awake(page: Page): Promise<void> {
  await page.evaluate(() => { (window as unknown as { vr: { awake: boolean } }).vr.awake = true; });
}

/** How many items the shopper's cart holds, by the Scenario Lab's own state. */
async function cartCount(harness: ContentHarness): Promise<number> {
  const state = (await harness.finalState()).state as unknown as { cart: Array<{ qty?: number; quantity?: number }> };
  return state.cart.reduce((sum, line) => sum + (line.qty ?? line.quantity ?? 1), 0);
}

test("bigbox: an add saved with Pickup standing in the closed chooser runs on a fresh page where Pickup is chosen, and is refused unrun with Delivery chosen", async ({ openHarness, page }) => {
  test.setTimeout(180_000);
  const harness = await openHarness("bigbox-retail");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 }).catch(() => undefined);
  await contentReady(page);

  // The build: a look, the chooser opened, Pickup shown chosen, the chooser closed by its own ×.
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t1030"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t1030.${++command}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const press = async (callId: string, handle: string, consequences: string[] = []) =>
    await runtime.executeTool({ ...BASE, callId, toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: CLICK, parameters: { target: { handle } }, consequences } });
  const looked = await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const first = (looked.evidence as { page?: string }).page ?? "";
  const opened = await press("call.open", handleOf(first, /button "Pickup or delivery\?/u));
  const openView = (opened.evidence as { page?: string }).page ?? "";
  expect(openView, "the open chooser shows Pickup chosen by its drawing").toMatch(/clickable "Pickup" marked/u);
  const pickup = handleOf(openView, /clickable "Pickup" marked/u);
  const closed = await press("call.close", handleOf(openView, /clickable "×"/u));
  const closedView = (closed.evidence as { page?: string }).page ?? "";
  expect(closedView, "the closed chooser's Pickup is out of view").not.toMatch(/"Pickup" marked/u);
  await expect(page.locator("vr-fulfillment-picker").getByText("Pickup", { exact: true }), "the closed flyout stays in the document, hidden").toBeHidden();

  const before = await cartCount(harness);
  await awake(page);
  const added = await press("call.add", addAfter(closedView, "ValueRidge Essentials Paper Towels Value Pack, 15 Rolls"), ["create_new"]);
  expect(added.effectApplied, JSON.stringify(added.evidence).slice(0, 400)).toBe(true);
  const chosen = added.draft?.chosen ?? [];
  console.log(`build: the add's statement chosen = ${JSON.stringify(chosen)}`);
  const stood = chosen.find((option) => option.key === pickup);
  expect(stood?.words, "the add states Pickup standing, out of view").toBe("Pickup");
  expect(stood?.at, "and where it is found again").toBeDefined();
  await page.waitForTimeout(1_500);
  console.log(`build: the add's outcome = ${JSON.stringify((added.evidence as { outcome?: unknown }).outcome ?? {}).slice(0, 600)}; cart ${before} -> ${await cartCount(harness)}; cart lines ${JSON.stringify(((await harness.finalState()).state as { cart?: unknown }).cart)}`);
  const beforePlayback = await cartCount(harness);

  // Playback: the add as Core saves it, requiring Pickup chosen, on a fresh document.
  const ranWith = added.draft?.ranWith as { parameters?: JsonObject } | undefined;
  const saved: JsonObject = { ...(ranWith?.parameters ?? {}), requiresChosen: [{ at: stood!.at!, words: stood!.words }] };
  await page.reload();
  await contentReady(page);
  await awake(page);
  const replayed = await harness.runAction(dispatched("replay.pickup", saved));
  console.log(`playback with Pickup chosen: ${replayed.status} ${replayed.failure?.code ?? ""} ${whyNot(replayed)}`);
  expect(replayed.failure?.code, whyNot(replayed)).not.toBe("web.precondition.option_not_chosen");
  expect(replayed.status, whyNot(replayed)).toBe("succeeded");
  await expect.poll(() => cartCount(harness), { timeout: 8_000 }).toBe(beforePlayback + 1);

  // Delivery chosen in the chooser, which then closes as the site closes it.
  const picker = page.locator("vr-fulfillment-picker");
  await picker.getByRole("button", { name: /Pickup or delivery\?/u }).click();
  await picker.getByText("Delivery", { exact: true }).click();
  await picker.getByText("×", { exact: true }).click();
  await expect(picker.getByText("Delivery", { exact: true })).toBeHidden();
  const refused = await harness.runAction(dispatched("replay.delivery", saved));
  console.log(`playback with Delivery chosen: ${refused.status} ${refused.failure?.code ?? ""} ${whyNot(refused)}`);
  expect(refused.status).toBe("failed");
  expect(refused.failure).toMatchObject({ code: "web.precondition.option_not_chosen", category: "target_not_found", effect: "unacted", retryable: false });
  await page.waitForTimeout(1_500);
  expect(await cartCount(harness), "nothing was added").toBe(beforePlayback + 1);
});
