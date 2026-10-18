// The actual content bundle on a realistic store: a new line's subject reaches
// the passive reset witness and disappears when only that new line is removed.
import type { JsonObject } from "fluxiq/core";
import { automationStudioActionPermissionDenied } from "fluxiq/automation-studio";
import { createWebAutomationLlmEvidenceRuntime, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { expect, test } from "../../../index.js";
import { STORE_PATHS, TIDEWELL_KETTLES } from "../../../../../../scenario-lab/src/scenarios/everything-store/catalog/index.js";

const SAGE = TIDEWELL_KETTLES.find((child) => child.variant?.colour === "Sage Green" && child.variant.capacity === "1.7 L")!;

test("new-line removal and an existing-line transfer restore every baseline value and original order", async ({ openHarness }) => {
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
  // Node-side private test seams exercise the same ledger/permission/placement
  // route as a builder. No private Core export or browser contract is added.
  const core = import.meta.resolve("fluxiq/automation-studio");
  const { AutomationStudioSiteResetLedger } = await import(new URL("runtime/flow-bootstrap/site-reset/ledger.js", core).href);
  const { automationStudioSiteResetPlacedCall } = await import(new URL("runtime/flow-bootstrap/site-reset/act-places.js", core).href);
  const { automationStudioFlowBootstrapActionPermissions } = await import(new URL("runtime/flow-bootstrap/action-permissions.js", core).href);
  const ledger = new AutomationStudioSiteResetLedger();
  const permissions = automationStudioFlowBootstrapActionPermissions({
    permittedConsequences: ["create_new", "modify_existing"], instructionIds: [], siteReset: ledger,
    executeTool: (call: Parameters<typeof runtime.executeTool>[0]) => runtime.executeTool({ ...call, projectId: request.projectId, flowId: request.flowId })
  });
  const read = async (start?: JsonObject) => {
    const result = await runtime.startState!({ ...request, ...(start === undefined ? {} : { start }) });
    if (!result) throw new Error("real browser reset evidence unavailable");
    return result;
  };
  const press = async (name: string, consequences: string[], undoes?: string) => {
    const shown = await runtime.executeTool({ ...request, callId: `look.${++command}`, toolId: "core.run_node", value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
    const line = String((shown.evidence as JsonObject).page).split("\n").find((line) => /^t\d+ /u.test(line) && line.includes(JSON.stringify(name)));
    expect(line, `observed control ${name}`).toBeTruthy();
    const handle = line!.split(" ")[0]!;
    const call = { callId: `press.${++command}`, toolId: "core.run_node", value: { node: "web.output.dom-click", parameters: { target: { handle } }, consequences, ...(undoes ? { undoes } : {}) } };
    const result = await automationStudioSiteResetPlacedCall({ call, ledger, reader: { read, settled: read }, run: () => permissions.executeTool(call) });
    // Assert outside gateway/permission dispatchers, which return failures.
    expect(result.evidence.ok, JSON.stringify({ code: result.evidence.code })).toBe(true);
    return ledger.actOf(call.callId) as string | undefined;
  };
  const before = await runtime.startState!(request);
  expect(before?.scope).toBeTruthy();
  expect(before?.subjects?.length).toBeGreaterThan(0);
  expect(before?.collections?.length).toBeGreaterThan(0);
  ledger.observed(before);
  await harness.page.goto(new URL(STORE_PATHS.product(SAGE), harness.lab.origin).href, { waitUntil: "load" });
  await harness.page.getByTitle("Close", { exact: true }).click();
  await harness.page.getByRole("dialog", { name: "Brightaisle Assistant" }).waitFor({ timeout: 9000 });
  await harness.page.getByRole("button", { name: "Minimize chat", exact: true }).click();
  const detail = await runtime.startState!({ ...request, callId: "detail" });
  await harness.page.getByLabel("Quantity:").selectOption("2");
  const addAct = await press("Add to Cart", ["create_new"]);
  expect(addAct).toBeTruthy();
  await harness.page.getByRole("dialog", { name: "Added to cart" }).getByRole("link", { name: "Go to Cart", exact: true }).click();
  const added = await runtime.startState!({ ...request, callId: "added" });
  ledger.observed(added);
  expect((await ledger.beforeTrial({ compare: async () => ({ moved: false, differs: [] }), compareAt: async () => ({ moved: false, differs: [], lines: { gone: [], added: [] } }) })).kind).toBe("refuse");
  expect(ledger.inPlace().map((act: { act: string }) => act.act)).toContain(addAct);
  expect(added?.scope).toBe(before?.scope);
  const beforeScopes = new Map(before!.collections!.map((collection) => [collection.scope, new Set(collection.subjects)]));
  const changedCollection = added!.collections!.find((collection) => collection.subjects.some((subject) => !beforeScopes.get(collection.scope)?.has(subject)));
  expect(changedCollection).toBeTruthy();
  const newSubjects = changedCollection!.subjects.filter((subject) => !beforeScopes.get(changedCollection!.scope)?.has(subject));
  expect(newSubjects.length).toBeGreaterThan(0);
  expect(newSubjects.some((subject) => detail!.subjects!.includes(subject))).toBe(true);
  const ownLine = harness.page.locator(`[data-line][data-sku="${SAGE.sku}"]`);
  await expect(ownLine).toHaveCount(1);
  await press("Delete", ["delete"], addAct);
  await expect(ownLine).toHaveCount(0);
  const undone = await runtime.startState!({ ...request, callId: "undone" });
  ledger.observed(undone);
  expect(await ledger.beforeTrial(async () => ({ moved: false, differs: [] }))).toEqual({ kind: "admit" });
  expect(undone?.scope).toBe(before?.scope);
  expect(newSubjects.every((subject) => !undone!.collections!.find((collection) => collection.scope === changedCollection!.scope)?.subjects.includes(subject))).toBe(true);
  for (const original of before!.collections!) {
    const restored = undone!.collections!.find((collection) => collection.scope === original.scope);
    expect(restored?.group).toBe(original.group);
    expect(restored?.subjects).toEqual(original.subjects);
    expect(restored?.states).toEqual(original.states);
  }
  expect(await lines()).toEqual(baseline);

  // The install task also moves the existing first line to a sibling collection.
  // Use only its own controls, including the site's recoverable first-save failure.
  const ownExistingLine = harness.page.locator('[data-line="L2"]');
  const failedAct = await press("Save for later", ["modify_existing"]);
  await ownExistingLine.getByText("Try again", { exact: true }).waitFor({ timeout: 15_000 });
  const retryAct = await press("Try again", ["modify_existing"]);
  expect(failedAct).toBeTruthy();
  expect(retryAct).toBeTruthy();
  await expect(ownExistingLine.locator('[data-action="move-to-cart"]')).toHaveCount(1);
  const transferred = await runtime.startState!({ ...request, callId: "transferred" });
  ledger.observed(transferred);
  expect((await ledger.beforeTrial(async () => ({ moved: false, differs: [] }))).kind).toBe("refuse");
  const origin = before!.collections!.find((original) => original.subjects.some((subject) => !transferred!.collections!.find((current) => current.scope === original.scope)?.subjects.includes(subject)));
  expect(origin).toBeTruthy();
  const movedSubjects = origin!.subjects.filter((subject) => !transferred!.collections!.find((current) => current.scope === origin!.scope)?.subjects.includes(subject));
  expect(movedSubjects).toHaveLength(1);
  const destination = transferred!.collections!.find((current) => current.scope !== origin!.scope && current.subjects.includes(movedSubjects[0]!));
  expect(destination?.group).toBe(origin!.group);
  expect(before!.collections!.find((current) => current.scope === destination!.scope)!.subjects).not.toContain(movedSubjects[0]);
  expect(destination!.states[movedSubjects[0]!]).toBeTruthy();
  await press("Move to cart", ["modify_existing"], retryAct);
  await expect(ownExistingLine.locator('[data-action="save-for-later"]')).toHaveCount(1);
  const restored = await runtime.startState!({ ...request, callId: "restored" });
  ledger.observed(restored);
  expect(await ledger.beforeTrial(async () => ({ moved: false, differs: [] }))).toEqual({ kind: "admit" });
  expect(ledger.inPlace()).toEqual([]);
  expect(restored!.collections).toEqual(before!.collections);
  expect(await lines()).toEqual(baseline);
});
