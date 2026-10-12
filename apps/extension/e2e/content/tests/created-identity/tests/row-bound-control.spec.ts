// A control repeated on every cart line is saved with, and resolved by, the
// line it belongs to (t463).
//
// Lane B round 8 (`run-mv5jnc62-01c3609a`, trial 1): the cart holds one "Qty"
// select per line, every line a plain `<div>`. The step "set the dinner napkins
// quantity to 1" was saved as `{ select, "Qty", class, positional selector }`
// and refused `web.target.ambiguous`; the step before it resolved through its
// positional selector to whichever line sat at that position. Now the select's
// saved identity carries its line's title (`content/identity/record.ts`), and
// the page accepts only a candidate in the line that title names.
//
// The row goes the whole way on bigbox-retail's cart: the content script's own
// snapshot read through the domain's evidence runtime, the model's handle
// resolved into the step's saved parameters, and each dispatch through Core's
// normalizer and the gateway mapping to the content script's resolver. The
// step is saved on the second line and replayed on a fresh load, after the
// lines are reordered, and once its line's words are gone from the page.

import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { Page } from "@playwright/test";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const SOAP = "ValueRidge Ultra Dish Soap, Lemon Scent, 24 fl oz";
const TOWELS = "ValueRidge Essentials Select-A-Size Paper Towels, 6 Double Rolls";
const BASE = { projectId: "project.t463", flowId: "flow.t463", maxEvidenceBytes: 64_000 } as const;
const SELECT_NODE = webAutomationOutputNodeId("web.dom.select");

const whyNot = (reply: BrowserActionResult): string => reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

/** Waits for a document to finish loading, the content script to announce itself, and the cart's lines to draw. */
async function cartReady(page: Page, lines: number): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000, message: "the content script announced itself in the new document" }).toBe(true);
  await expect(page.locator("main select:visible")).toHaveCount(lines, { timeout: 10_000 });
}

/** The quantity each line's select shows, by the line's title, in page order. */
async function quantities(page: Page): Promise<Array<[string, string]>> {
  return await page.evaluate(() => [...document.querySelectorAll("main select")].map((select) => {
    let line: Element | null = select;
    while (line && !line.querySelector("a[href]")) line = line.parentElement;
    return [line?.querySelector("a[href]")?.textContent?.trim() ?? "", (select as HTMLSelectElement).value] as [string, string];
  }));
}

/** The command a Flow node's dispatch hands the content script: Core's normalizer, the wire target, the gateway mapping. */
function dispatched(commandId: string, parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.select", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  if ("status" in command) throw new Error(`the command was refused: ${JSON.stringify(command)}`);
  return command as BrowserActionCommand;
}

/** Selects `value` with the saved step and answers the reply. */
async function selectWith(harness: ContentHarness, saved: JsonObject, commandId: string, value: string): Promise<BrowserActionResult> {
  return await harness.runAction(dispatched(commandId, { ...saved, value }));
}

/** Selects with the saved step on a cart that reloads after each change, and waits for the reloaded cart. */
async function selectAndReload(harness: ContentHarness, saved: JsonObject, commandId: string, value: string): Promise<BrowserActionResult> {
  const page = harness.page;
  const reloaded = page.waitForEvent("framenavigated", { predicate: (frame) => frame === page.mainFrame(), timeout: 15_000 });
  const reply = await selectWith(harness, saved, commandId, value);
  if (reply.status === "succeeded") {
    await reloaded;
    await cartReady(page, 2);
  }
  return reply;
}

test("bigbox cart: a Qty select saved on the second line resolves to that line on a fresh load and after the lines reorder, and is refused once the line is gone", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("bigbox-retail");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 });
  // The returning shopper's cart holds the dish soap; the towels go on a second pickup line.
  // The page's own client posts it, with the run token its module script carries.
  await page.evaluate(async () => {
    const source = [...document.querySelectorAll("script")].map((script) => script.textContent ?? "").join(" ");
    const runToken = /const runToken = "([^"]+)"/u.exec(source)?.[1];
    if (!runToken) throw new Error("the page carries no run token");
    const response = await fetch("/api/bigbox-retail/add-to-cart", {
      method: "POST",
      headers: { authorization: `Bearer ${runToken}`, "content-type": "application/json" },
      body: JSON.stringify({ productId: "418830127", sku: "5510201", qty: 1, fulfilment: "pickup" })
    });
    if (!response.ok) throw new Error(`add-to-cart failed: ${response.status}`);
  });
  const cartUrl = new URL("/scenarios/bigbox-retail/cart", harness.lab.origin).href;
  await page.goto(cartUrl);
  await cartReady(page, 2);
  expect(await quantities(page)).toEqual([[SOAP, "1"], [TOWELS, "1"]]);

  // The page names each line's select by the line's title.
  const captured = await harness.capture();
  const records = captured.interactiveElements.filter((element) => element.tagName === "select").map((element) => element.context?.record);
  expect(records).toEqual([{ text: SOAP }, { text: TOWELS }]);

  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t463"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t463.look.${++command}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  // The two selects as the model is shown them: each a handle in the page tree,
  // under its own line's title. The towels' is the second, after the towels' title.
  const view = (looked.evidence as { page?: string }).page ?? "";
  const viewLines = view.split("\n");
  const qtyAt = viewLines.flatMap((line, index) => /"Qty"/u.test(line) ? [index] : []);
  expect(qtyAt, view).toHaveLength(2);
  const towelsTitleAt = viewLines.findIndex((line) => line.includes(TOWELS));
  expect(towelsTitleAt > qtyAt[0]! && towelsTitleAt < qtyAt[1]!, view).toBe(true);
  const handle = /\b(t\d+)\b/u.exec(viewLines[qtyAt[1]!]!)?.[1];
  expect(handle).toBeDefined();

  // The step the build writes with that handle, as it is saved: the line's title rides in its context.
  const resolution = await runtime.resolvePlanNodeParameters({ ...BASE, nodeDefinitionId: SELECT_NODE, parameters: { selector: { handle: handle! }, value: "2" }, declaredConsequences: [] });
  expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
  const saved = resolution.status === "resolved" ? resolution.parameters : {};
  expect(saved.element).toMatchObject({ tagName: "select", accessibleName: "Qty", context: { record: { text: TOWELS } } });
  const savedSelector = String(saved.selector);
  expect(savedSelector, "addressed by its position, which is all the page offers").toMatch(/nth-of-type/u);

  // 1. A fresh load of the same cart: the towels' line is set, the soap's left alone.
  await page.goto(cartUrl);
  await cartReady(page, 2);
  const fresh = await selectAndReload(harness, saved, "t463.fresh", "2");
  expect(fresh.status, whyNot(fresh)).toBe("succeeded");
  expect(await quantities(page)).toEqual([[SOAP, "1"], [TOWELS, "2"]]);

  // 2. The lines reordered: the towels' line first, so the saved position now holds the soap's select.
  await page.evaluate(() => {
    const selects = [...document.querySelectorAll("main select")];
    const lineOf = (select: Element): Element => {
      let line: Element = select;
      while (line.parentElement && line.parentElement.querySelectorAll("select").length < 2) line = line.parentElement;
      return line;
    };
    const [soapLine, towelsLine] = selects.map(lineOf);
    soapLine!.parentElement!.insertBefore(towelsLine!, soapLine!);
  });
  expect((await quantities(page)).map(([title]) => title)).toEqual([TOWELS, SOAP]);
  expect(await page.locator(savedSelector).evaluate((select) => {
    let line: Element | null = select;
    while (line && !line.querySelector("a[href]")) line = line.parentElement;
    return line?.querySelector("a[href]")?.textContent?.trim();
  }), "the saved selector now reaches the soap's line").toBe(SOAP);
  const reordered = await selectAndReload(harness, saved, "t463.reordered", "3");
  expect(reordered.status, whyNot(reordered)).toBe("succeeded");
  expect(await quantities(page)).toEqual([[SOAP, "1"], [TOWELS, "3"]]);

  // 3. The towels' line's words are gone from the page: refused, and no line's quantity changed.
  await page.evaluate((title) => {
    const link = [...document.querySelectorAll("main a[href]")].find((element) => element.textContent?.trim() === title);
    if (!link) throw new Error("no towels link on the page");
    link.textContent = "ValueRidge Essentials Paper Towel Holder, Brushed Steel";
  }, TOWELS);
  const gone = await selectWith(harness, saved, "t463.gone", "4");
  expect(gone.status, whyNot(gone)).toBe("failed");
  expect(["web.target.not_found", "web.target.ambiguous"]).toContain(gone.failure?.code);
  expect(await quantities(page)).toEqual([[SOAP, "1"], ["ValueRidge Essentials Paper Towel Holder, Brushed Steel", "3"]]);

  // A unique control on the same page is unaffected: the search box carries no row.
  const search = view.split("\n").find((line) => /"Search"/u.test(line));
  const searchHandle = search ? /\b(t\d+)\b/u.exec(search)?.[1] : undefined;
  if (searchHandle) {
    const typed = await runtime.resolvePlanNodeParameters({ ...BASE, nodeDefinitionId: webAutomationOutputNodeId("web.dom.type"), parameters: { selector: { handle: searchHandle }, text: "napkins" }, declaredConsequences: [] });
    expect(typed.status, JSON.stringify(typed)).toBe("resolved");
    const element = (typed.status === "resolved" ? typed.parameters.element : undefined) as { context?: { record?: unknown } } | undefined;
    expect(element?.context?.record).toBeUndefined();
  }
});
