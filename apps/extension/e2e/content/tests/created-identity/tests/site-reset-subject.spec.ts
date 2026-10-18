// The actual content bundle on a realistic store: a new line's subject reaches
// the passive reset witness and disappears when only that new line is removed.
import type { JsonObject } from "fluxiq/core";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import { createWebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";

const SAGE = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;

test("a cross-page add exposes a new subject and deleting only that line preserves every baseline line and quantity", async ({ openHarness }) => {
  test.setTimeout(90_000);
  const harness = await openHarness("everything-store");
  await harness.page.getByRole("dialog", { name: "Never miss a deal" }).waitFor({ timeout: 15_000 });
  await harness.page.getByRole("button", { name: "Not now", exact: true }).click();
  await harness.page.getByRole("button", { name: "Decline", exact: true }).click();
  const cart = new URL("/scenarios/everything-store/cart", harness.lab.origin).href;
  await harness.page.goto(cart, { waitUntil: "load" });
  const lines = () => harness.page.locator("[data-line]").evaluateAll((rows) => rows.map((row) => ({ sku: row.getAttribute("data-sku"), text: row.textContent?.replace(/\s+/gu, " ").trim() })));
  const baseline = await lines();
  let command = 0;
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["reset.browser"],
    executeAction: async (_session, request) => {
      const reply = await harness.runAction({ commandId: `reset.${++command}`, actionType: request.actionType, ...request.parameters } as Parameters<typeof harness.runAction>[0]);
      return { status: reply.status, payload: { sourceId: "tab:1:frame:0", ...(reply.snapshot ? { snapshot: JSON.parse(JSON.stringify(reply.snapshot)) as JsonObject } : {}) } };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const request = { projectId: "reset", flowId: "reset", callId: "baseline", permission: automationStudioActionPermissionDenied };
  const before = await runtime.startState!(request);
  expect(before?.scope).toBeTruthy();
  expect(before?.subjects?.length).toBeGreaterThan(0);
  expect(before?.collections?.length).toBeGreaterThan(0);
  await harness.page.goto(new URL(STORE_PATHS.product(SAGE), harness.lab.origin).href, { waitUntil: "load" });
  await harness.page.getByTitle("Close", { exact: true }).click();
  await harness.page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
  await harness.page.getByRole("button", { name: "Minimize chat", exact: true }).click();
  const detail = await runtime.startState!({ ...request, callId: "detail" });
  await harness.page.getByLabel("Quantity:").selectOption("2");
  await harness.page.getByRole("button", { name: "Add to Cart", exact: true }).click();
  await harness.page.getByRole("dialog", { name: "Added to cart" }).getByRole("link", { name: "Go to Cart", exact: true }).click();
  const added = await runtime.startState!({ ...request, callId: "added" });
  expect(added?.scope).toBe(before?.scope);
  const beforeScopes = new Map(before!.collections!.map((collection) => [collection.scope, new Set(collection.subjects)]));
  const changedCollection = added!.collections!.find((collection) => collection.subjects.some((subject) => !beforeScopes.get(collection.scope)?.has(subject)));
  expect(changedCollection).toBeTruthy();
  const newSubjects = changedCollection!.subjects.filter((subject) => !beforeScopes.get(changedCollection!.scope)?.has(subject));
  expect(newSubjects.length).toBeGreaterThan(0);
  expect(newSubjects.some((subject) => detail!.subjects!.includes(subject))).toBe(true);
  const ownLine = harness.page.locator(`[data-line][data-sku="${SAGE.sku}"]`);
  await expect(ownLine).toHaveCount(1);
  await ownLine.locator('[data-action="delete"]').click();
  await expect(ownLine).toHaveCount(0);
  const undone = await runtime.startState!({ ...request, callId: "undone" });
  expect(undone?.scope).toBe(before?.scope);
  expect(newSubjects.every((subject) => !undone!.collections!.find((collection) => collection.scope === changedCollection!.scope)?.subjects.includes(subject))).toBe(true);
  for (const original of before!.collections!) {
    const restored = undone!.collections!.find((collection) => collection.scope === original.scope);
    expect(restored?.group).toBe(original.group);
    expect(restored?.subjects).toEqual(original.subjects);
    expect(restored?.states).toEqual(original.states);
  }
  expect(await lines()).toEqual(baseline);
});
