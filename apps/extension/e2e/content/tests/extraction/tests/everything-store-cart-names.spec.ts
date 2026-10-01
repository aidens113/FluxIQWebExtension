// The everything store's cart, read in the instruction's own column names
// (item, quantity, price), through the real domain evidence runtime -- the
// model's own tools -- over the real content-script bundle on the store's cart
// page (T2 harness: no background worker, no Core, no model).
//
// The cart is styled with hashed class names, so its detected columns are
// labelled by path, and until 2026-10-01 a read naming them as the instruction
// does was refused `column_not_in_detected_list` (lane A, cause #15,
// `t174-w34` F2). The detection does say what each column holds -- its labels
// end "(number)" and "(currency amount)", and the item's name is its link's
// text -- and the domain now reads a name that plainly means one of those kinds
// as the one column of that kind (`plan-resolution/extraction/column-match.ts`).
// The oracle is the task's own expected records.

import type { JsonObject } from "fluxiq/core";
import {
  createWebAutomationLlmEvidenceRuntime,
  WEB_LLM_DETECT_STRUCTURE_TOOL_ID,
  WEB_LLM_RUN_NODE_TOOL_ID,
  type WebLlmEvidenceGateway
} from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";
import { ADD_TO_CART_WORKFLOW } from "../../../../../../scenario-lab/src/scenarios/everything-store/workflows/index.js";

const SAGE = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;
const EXPECTED = ADD_TO_CART_WORKFLOW.expected.extracted?.[0]?.records ?? [];
const EXTRACT_LIST = "web.output.dom-extract_list";

/** One store operation, as the page's own scripts send it. */
async function storeCall(harness: ContentHarness, operation: string, payload: Record<string, unknown>): Promise<void> {
  const response = await fetch(`${harness.lab.origin}/api/everything-store/${operation}`, {
    method: "POST",
    headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" },
    body: JSON.stringify(payload)
  });
  expect(response.ok, `the store accepted ${operation}`).toBe(true);
}

/** The real domain evidence runtime, its gateway the content script; the records each read sent back are kept. */
function runtimeFor(harness: ContentHarness) {
  const records: unknown[] = [];
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    structureDetectionSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `cart.${++command}`, actionType: request.actionType, ...request.parameters } as Parameters<typeof harness.runAction>[0]);
      const payload: JsonObject = {};
      if (reply.snapshot !== undefined) payload.snapshot = JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject;
      if (reply.structure !== undefined) payload.structure = JSON.parse(JSON.stringify(reply.structure)) as JsonObject;
      if (reply.extracted !== undefined) {
        payload.records = JSON.parse(JSON.stringify(reply.extracted)) as JsonObject;
        records.push(reply.extracted);
      }
      const failure = reply.failure === undefined ? {} : { failure: JSON.parse(JSON.stringify(reply.failure)) as JsonObject };
      return { status: reply.status, payload, ...failure, ...(reply.status === "failed" && typeof reply.message === "string" ? { error: reply.message } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const base = { projectId: "project.cart-names", flowId: "flow.cart-names", maxEvidenceBytes: 400_000 } as const;
  let call = 0;
  return {
    records,
    detect: () => runtime.executeTool({ ...base, callId: `call.${++call}`, toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} }),
    read: (handle: string, fields: unknown) => runtime.executeTool({
      ...base,
      callId: `call.${++call}`,
      toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: EXTRACT_LIST, parameters: { extractList: { handle, fields, paginate: false } } as unknown as JsonObject, consequences: [] }
    })
  };
}

test("the cart read in the instruction's own names returns the task's records, as a map and as a list", async ({ openHarness }) => {
  test.setTimeout(120_000);
  const harness = await openHarness("everything-store");
  await storeCall(harness, "dismiss-nudge", { nudge: "notifications" });
  await storeCall(harness, "dismiss-nudge", { nudge: "app-banner" });
  await storeCall(harness, "consent", { choice: "decline" });
  await storeCall(harness, "chat", { state: "minimized" });
  // The task's cart: two Sage Green kettles added, the phone case saved for later (its first save fails by design).
  await storeCall(harness, "add-to-cart", { sku: SAGE.sku, quantity: 2 });
  await storeCall(harness, "save-for-later", { lineId: "L2" });
  await storeCall(harness, "save-for-later", { lineId: "L2" });
  await harness.page.goto(new URL(STORE_PATHS.cart, harness.lab.origin).href, { waitUntil: "load" });
  await expect(harness.page.locator('[data-name="Active Items"] [data-line]').first()).toBeVisible();

  const { detect, read, records } = runtimeFor(harness);
  const detected = await detect();
  const handle = (detected.evidence as { extraction?: string }).extraction;
  expect(handle, `a list was detected: ${detected.resultCode}`).toBeTruthy();

  for (const fields of [{ item: "item", quantity: "quantity", price: "price" }, ["item", "quantity", "price"]]) {
    const before = records.length;
    const ran = await read(handle!, fields);
    expect(ran.resultCode, `${JSON.stringify(fields)}: ${ran.resultReason ?? ""}`).toBe("web.inspect.succeeded");
    expect(records.length, "the read reached the page").toBe(before + 1);
    expect(records.at(-1)).toEqual(EXPECTED);
  }
});
