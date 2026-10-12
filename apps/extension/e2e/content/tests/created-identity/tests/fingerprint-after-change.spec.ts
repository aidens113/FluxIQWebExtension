// A step built from a handle is found by its fingerprint when one of its
// signals changes, and honestly not found when all of them have (t422).
//
// R4a (`run-mv2pgqkj-f3552c70`): crossborder's quantity box has no accessible
// name and an id the item page mints again on every load. The build saved its
// type step as `{ tagName: "input", selector: "#fb1l6ufkg" }`; the trial's page
// drew a new id, the page set the absent one aside (t419), nothing was left to
// score, and the step failed `web.target.not_found` with the box in plain view.
// A step built from a handle now carries the whole fingerprint a recorded step
// carries (`domain/src/runtime/llm-evidence/plan-resolution/element-identity.ts`;
// user, 2026-10-10: never one attribute, so a changed id, class or text does
// not break a Flow while its other signals hold).
//
// The row goes the whole way on the real fixture: the content script's own
// snapshot is read through the domain's evidence runtime, the model's handle is
// resolved into the step's parameters, and each dispatch goes through Core's
// normalizer and the gateway mapping to the content script, whose resolver
// (`content/identity/`) decides. Between dispatches the page changes the box:
// its label's words, a new load (a new id), its class, and finally all three.
// R4a's address-only identity is dispatched once on the new load and must fail
// as it did live, so the row shows the other signals are what find the box.

import type { JsonObject } from "fluxiq/core";
import { normalizeAutomationStudioElementTarget } from "fluxiq/automation-studio";
import type { Page } from "@playwright/test";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand, webAutomationOutputNodeId } from "@fluxiq-web-extension/domain/client";
import { marketClasses } from "../../../../../../scenario-lab/src/scenarios/crossborder-marketplace/styles/index.js";
import type { BrowserActionCommand, BrowserActionResult } from "../../../../../src/shared/protocol.js";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

const OFFICIAL = "1005008123450";
const market = marketClasses(7342, "baseline");
const BASE = { projectId: "project.t422", flowId: "flow.t422", maxEvidenceBytes: 64_000 } as const;
const TYPE_NODE = webAutomationOutputNodeId("web.dom.type");
const BOX = `.${market.qtyInput}`;

const whyNot = (reply: BrowserActionResult): string => reply.failure?.actual ?? (reply.validation.status === "none" ? "" : reply.validation.actual);

/** Waits for a document to finish loading and the content script to announce itself in it. */
async function contentReady(page: Page): Promise<void> {
  await page.waitForLoadState("load");
  await expect.poll(async () => await page.evaluate(() => {
    const stub = (window as unknown as Record<string, { sent: Array<{ type?: string }> } | undefined>).__fluxiqContentHarness;
    return stub?.sent.some((message) => message.type === "fluxiq.contentReady") ?? false;
  }).catch(() => false), { timeout: 15_000, message: "the content script announced itself in the new document" }).toBe(true);
}

/** The command a Flow node's dispatch hands the content script: Core's normalizer, the wire target, the gateway mapping. */
function dispatched(commandId: string, parameters: JsonObject): BrowserActionCommand {
  const prepared: JsonObject = Object.assign({}, parameters);
  const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
  if (target) prepared.target = target as unknown as JsonObject;
  const command = webAutomationActionFromGatewayCommand({ commandId, actionType: "web.dom.type", parameters: prepared, target: outputTargetFromPayload(prepared) ?? {} });
  if ("status" in command) throw new Error(`the command was refused: ${JSON.stringify(command)}`);
  return command as BrowserActionCommand;
}

/** Types `text` with the saved step and answers the reply. */
async function typeWith(harness: ContentHarness, saved: JsonObject, commandId: string, text: string): Promise<BrowserActionResult> {
  return await harness.runAction(dispatched(commandId, { ...saved, text }));
}

/** The page renames the box's label, as a site that rewords its form does. */
async function relabel(page: Page, words: string): Promise<void> {
  await page.evaluate(([labelClass, next]) => {
    const label = [...document.querySelectorAll(`.${labelClass}`)].find((element) => element.textContent?.trim() === "Quantity");
    if (!label) throw new Error("no Quantity label on the page");
    label.textContent = next;
  }, [market.skuLabel, words] as const);
}

test("crossborder: a step built from the quantity box's handle is found after its label, its id or its class changes, and not found once all have", async ({ openHarness, page }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("crossborder-marketplace");
  const itemUrl = new URL(`/scenarios/crossborder-marketplace/item/${OFFICIAL}`, harness.lab.origin).href;
  await page.goto(itemUrl);
  await contentReady(page);

  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.t422"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `t422.look.${++command}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      const snapshot = reply.snapshot === undefined ? undefined : JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      return { status: reply.status, ...(snapshot ? { payload: { snapshot } } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const looked = await runtime.executeTool({ ...BASE, callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });

  // The box as the model is shown it: a handle and its label's words, nothing of its fingerprint.
  const view = (looked.evidence as { page?: string }).page ?? "";
  const boxes = [...view.matchAll(/^(t\d+) field "Quantity"/gmu)].map((match) => match[1]!);
  expect(boxes, "the page view prints one field named Quantity").toHaveLength(1);
  const firstId = await page.locator(BOX).getAttribute("id");
  expect(firstId).toMatch(/^fb[0-9a-z]+$/u);
  expect(view, "the box's id is not in the page view").not.toContain(firstId!);
  expect(view, "nor its class").not.toContain(market.qtyInput);

  // The step the build writes with that handle, as it is saved: the whole fingerprint.
  const resolution = await runtime.resolvePlanNodeParameters({ ...BASE, nodeDefinitionId: TYPE_NODE, parameters: { selector: { handle: boxes[0]! }, text: "1" }, declaredConsequences: [] });
  expect(resolution.status, JSON.stringify(resolution)).toBe("resolved");
  const saved = resolution.status === "resolved" ? resolution.parameters : {};
  expect(saved.selector, "addressed by the per-load id, as R4a's step was").toBe(`#${firstId}`);
  expect(saved.element).toMatchObject({ tagName: "input", implicitRole: "textbox", label: "Quantity", id: firstId, classNames: [market.qtyInput], selector: `#${firstId}` });

  // 1. The label's words change; its id and class still name it.
  await relabel(page, "Qty");
  const relabelled = await typeWith(harness, saved, "t422.relabelled", "2");
  expect(relabelled.status, whyNot(relabelled)).toBe("succeeded");
  await expect(page.locator(BOX)).toHaveValue("2");

  // The trial's page: loaded again, the box carries a new id and the saved one names nothing.
  await page.goto(itemUrl);
  await contentReady(page);
  await expect(page.locator(BOX)).toHaveCount(1);
  await expect(page.locator(`#${firstId}`), "the saved id is on no element").toHaveCount(0);

  // R4a's identity -- the address alone -- fails as it did live, with nothing scored.
  const addressOnly = await harness.runAction(dispatched("t422.address-only", { ...saved, text: "9", element: { tagName: "input", selector: `#${firstId}` } }));
  expect(addressOnly.status, whyNot(addressOnly)).toBe("failed");
  expect(addressOnly.failure?.code).toBe("web.target.not_found");
  expect(whyNot(addressOnly)).toMatch(/^nothing matched; 3 control\(s\) of the same family are on the page/u);
  expect(whyNot(addressOnly), "nothing was left to score").not.toMatch(/best scored/u);
  expect(addressOnly.resolution?.bestScore).toBeUndefined();

  // 2. The id changed: the class and the label find the box (the page's first lookup by class, its veto by the label).
  const reloaded = await typeWith(harness, saved, "t422.new-id", "3");
  expect(reloaded.status, whyNot(reloaded)).toBe("succeeded");
  await expect(page.locator(BOX)).toHaveValue("3");

  // 3. The class changes too: the label alone still finds it.
  await page.locator(BOX).evaluate((element) => { element.setAttribute("class", "rebuilt-qty-field"); });
  const reclassed = await typeWith(harness, saved, "t422.new-class", "4");
  expect(reclassed.status, whyNot(reclassed)).toBe("succeeded");
  expect(reclassed.resolution, "scored among the same three, by the label").toMatchObject({ strategy: "scored-candidate", candidateCount: 3 });
  await expect(page.locator(".rebuilt-qty-field")).toHaveValue("4");

  // 4. Every signal that said which control it was has changed: honestly not found, and nothing typed anywhere.
  await relabel(page, "Qty");
  const gone = await typeWith(harness, saved, "t422.all-changed", "5");
  expect(gone.status, whyNot(gone)).toBe("failed");
  expect(gone.failure?.code).toBe("web.target.not_found");
  await expect(page.locator(".rebuilt-qty-field")).toHaveValue("4");
});
