// The page view the model reads, built by the real domain evidence runtime from
// the real content-script bundle's capture of bigbox-retail's home page (T2).
//
// Lane B's bigbox run (2026-10-01) showed the user two defects in this view:
// words the page draws as separate stacked lines run together --
// `button "Pickup or delivery?Carden Falls Supercenter"`, `link "ReorderMy
// Items"`, `link "Sign InAccount"`, `link "🛒1$3.97"` -- and a tile's price
// printed three times, `"$10.47"`, `"$10"`, `"47"` (once for a screen reader,
// once drawn in pieces). The oracle is the page view's own lines.

import type { JsonObject } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";

/** The page view of the harness page, as the model is shown it after a look. */
async function pageView(harness: ContentHarness): Promise<string[]> {
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.live-browser"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `view.${++command}`, actionType: request.actionType, ...request.parameters } as Parameters<typeof harness.runAction>[0]);
      const payload: JsonObject = reply.snapshot === undefined ? {} : { snapshot: JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject };
      return { status: reply.status, payload };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const look = await runtime.executeTool({ projectId: "project.view", flowId: "flow.view", callId: "call.look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const view = String((look.evidence as JsonObject | undefined)?.page ?? "");
  return view.split("\n");
}

test("bigbox home: stacked words print apart, and a tile's price prints once", async ({ openHarness, page }) => {
  test.setTimeout(60_000);
  const harness = await openHarness("bigbox-retail");
  await page.getByRole("button", { name: "Accept all" }).click();
  await page.locator("a", { hasText: "No thanks" }).click({ timeout: 8_000 });
  const lines = await pageView(harness);
  const line = (pattern: RegExp): string | undefined => lines.find((candidate) => pattern.test(candidate));

  expect(line(/^t\d+ button "Pickup or delivery\? Carden Falls Supercenter"/u), lines.join("\n")).toBeDefined();
  expect(line(/^t\d+ link "Reorder My Items"/u)).toBeDefined();
  expect(line(/^t\d+ link "Sign In Account"/u)).toBeDefined();
  expect(lines.filter((candidate) => /"[^"]*\S\?[A-Z]|ReorderMy|Sign InAccount|🛒1\$/u.test(candidate)), "no words run together").toEqual([]);

  // The first tile's price: printed for a screen reader, then drawn in pieces.
  expect(line(/^t\d+ "\$10\.47"$/u)).toBeDefined();
  expect(lines.filter((candidate) => /^t\d+ "(\$10|47)"$/u.test(candidate)), "the pieces of a price already printed are not printed again").toEqual([]);
});
