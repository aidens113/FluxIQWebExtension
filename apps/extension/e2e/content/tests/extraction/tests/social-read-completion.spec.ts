// Real content-script proof on the realistic feed. No model, background
// worker or provider. The ordering proof uses Core's real loop executor.
import { expect, test } from "../../../index.js";
import type { ContentHarness } from "../../../index.js";
import { acceptAutomationStudioFlowBootstrapResult, AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY, AutomationStudioNodeRegistry, normalizeAutomationStudioElementTarget, runAutomationStudioGraph, type AutomationStudioFlowDocument } from "fluxiq/automation-studio";
import type { AutomationStudioNativeNodeContext } from "fluxiq/automation-studio/nodes";
import type { JsonObject, JsonValue } from "fluxiq/core";
import { createWebAutomationLlmEvidenceRuntime, createWebAutomationOutputNodeImplementationBundle, webAutomationOutputNodeDefinitions, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID, type WebLlmEvidenceGateway } from "@fluxiq-web-extension/domain";
import { outputTargetFromPayload, webAutomationActionFromGatewayCommand } from "@fluxiq-web-extension/domain/client";
import { gatewayActionResultFromBrowserResult } from "../../../../../src/runtime/index.js";
import type { BrowserActionCommand } from "../../../../../src/shared/protocol.js";

function wirePayload(reply: Awaited<ReturnType<ContentHarness["runAction"]>>): JsonObject {
  return gatewayActionResultFromBrowserResult(reply).payload ?? {};
}

async function prepare(harness: ContentHarness): Promise<void> {
  for (const [operation, payload] of [["consent", { choice: "all" }], ["notifications", { choice: "dismissed" }], ["chat", { state: "closed" }]] as const) {
    const response = await fetch(`${harness.lab.origin}/api/${harness.scenarioId}/${operation}`, {
      method: "POST", headers: { authorization: `Bearer ${harness.lab.runToken}`, "content-type": "application/json" }, body: JSON.stringify(payload)
    });
    expect(response.ok).toBe(true);
  }
  await harness.page.reload();
  await expect(harness.page.locator('[data-ad-comet-preview="message"]').first()).toBeVisible();
  await expect.poll(async () => (await harness.messages()).some((message) => message.type === "fluxiq.contentReady")).toBe(true);
}

test("partial feed text refuses without expansion; an explicit row-bound registered click makes the same field readable", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  const partial = page.locator('[data-ad-comet-preview="message"]').filter({ has: page.getByRole("button", { name: "See more", exact: true }) }).first();
  await expect(partial).toBeVisible();
  const key = await partial.evaluate((element) => element.closest('[role="article"]')?.getAttribute("aria-posinset"));
  expect(key).toBeTruthy();
  const item = `[role="article"][aria-posinset="${key}"]`;
  const text = '[data-ad-comet-preview="message"]';
  const selected = page.locator(`${item} ${text}`);
  const read = { item, fields: { description: { kind: "text" as const, selector: text } } };
  const beforeLength = (await selected.innerText()).length;
  const detected = await harness.runAction({ commandId: "detect-collapsed", actionType: "web.dom.capture_snapshot", detectStructure: {} });
  expect(detected.status).toBe("succeeded");
  expect(detected.structure?.ok).toBe(true);
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toBeVisible();
  const refused = await harness.runAction({ commandId: "read-partial", actionType: "web.dom.extract_list", extractList: read });
  expect(refused.status).toBe("failed");
  expect(refused.failure?.code).toBe("web.validation.output_not_observed");
  expect(refused.failure?.actual).toMatch(/incomplete_text.*registered row-bound click/u);
  expect(refused.extracted).toBeUndefined();
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toBeVisible();
  expect((await selected.innerText()).length).toBe(beforeLength);
  const selector = `${item} ${text} [role="button"]`;
  const pressed = await harness.runAction({ commandId: "expand-selected-row", actionType: "web.dom.click", selector, element: { selector } });
  expect(pressed.status).toBe("succeeded");
  await expect(selected.getByRole("button", { name: "See more", exact: true })).toHaveCount(0);
  const complete = await harness.runAction({ commandId: "read-complete", actionType: "web.dom.extract_list", extractList: read });
  expect(complete.status, JSON.stringify({ failure: complete.failure, validation: complete.validation })).toBe("succeeded");
  expect(complete.validation.status).toBe("passed");
  const records = complete.extracted as Array<{ description: string }>;
  expect(records).toHaveLength(1);
  expect(records[0]!.description.length).toBeGreaterThan(beforeLength);
  expect(records[0]!.description).toBe((await selected.innerText()).replace(/\s+/gu, " ").trim());
});

test("repeated post renderings share an opted-in helper identity while requested raw links retain tracking", async ({ openHarness, page }) => {
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  for (let batch = 0; batch < 4; batch += 1) {
    await page.evaluate(() => window.scrollTo(0, document.documentElement.scrollHeight));
    await page.waitForTimeout(650);
  }
  const reply = await harness.runAction({ commandId: "read-identities", actionType: "web.dom.extract_list", extractList: {
    item: '[role="article"] a[href*="/posts/"]', fields: { url: { kind: "link" }, identity: { kind: "link", identity: "tracking-free" } }
  } });
  expect(reply.status).toBe("succeeded");
  const rows = reply.extracted as Array<{ url: string; identity: string }>;
  expect(rows.length).toBeGreaterThan(0);
  for (const row of rows) {
    const raw = new URL(row.url);
    const normalized = new URL(row.identity);
    expect(raw.searchParams.has("__tn__")).toBe(true);
    expect(normalized.searchParams.has("__tn__")).toBe(false);
    expect(normalized.pathname).toBe(raw.pathname);
    expect(normalized.hash).toBe(raw.hash);
  }
  expect(new Set(rows.map((row) => row.url)).size).toBeGreaterThan(new Set(rows.map((row) => row.identity)).size);
});

test("normally authored optional For Each expands helper rows before a full feed read and truthful Next end", async ({ openHarness, page }) => {
  test.setTimeout(180_000);
  const harness = await openHarness("social-network-feed");
  await prepare(harness);
  const item = '[role="article"]:has(a[href*="/posts/"])';
  const message = '[data-ad-comet-preview="message"]';
  const partial = page.locator(`${item} ${message}`).filter({ has: page.getByRole("button", { name: "See more", exact: true }) }).first();
  await expect(partial).toBeVisible();
  let detectedFields: Array<{ key: string; spec: { kind: string; selector?: string | undefined } }> = [];
  const gateway: WebLlmEvidenceGateway = {
    eligibleSessionIds: () => ["session.disclosure"], structureDetectionSessionIds: () => ["session.disclosure"],
    executeAction: async (_sessionId, request) => {
      const reply = await harness.runAction({ commandId: `author-${Date.now()}`, actionType: request.actionType, ...request.parameters } as BrowserActionCommand);
      if (reply.structure?.ok) detectedFields = reply.structure.proposal.fields;
      return { status: reply.status, payload: wirePayload(reply), ...(reply.failure ? { failure: reply.failure } : {}) };
    }
  };
  const runtime = createWebAutomationLlmEvidenceRuntime(gateway);
  const base = { projectId: "project.disclosure", flowId: "flow.disclosure" };
  const detection = await runtime.executeTool({ ...base, callId: "detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {} });
  expect(detection.resultCode).toBe("web.structure.detected");
  const packet = detection.evidence as unknown as { extraction: string; fields: Array<{ key: string }> };
  const columnKeys = await page.evaluate(({ fields, item, message }) => {
    const row = document.querySelector(item)!;
    const body = row.querySelector(message)!;
    const selected = (field: { spec: { selector?: string | undefined } }) => field.spec.selector ? row.querySelector(field.spec.selector) : row;
    return {
      identity: fields.find((field) => field.spec.kind === "link" && selected(field)?.getAttribute("href")?.includes("/posts/"))?.key,
      description: fields.find((field) => field.spec.kind === "text" && selected(field) === body)?.key
    };
  }, { fields: detectedFields, item, message });
  expect(columnKeys.identity).toBeTruthy();
  expect(columnKeys.description).toBeTruthy();
  for (const key of Object.values(columnKeys)) expect(packet.fields.some((field) => field.key === key)).toBe(true);
  const resolve = async (nodeDefinitionId: string, parameters: JsonObject) => {
    const resolved = await runtime.resolvePlanNodeParameters({ ...base, nodeDefinitionId, parameters, declaredConsequences: [] });
    expect(resolved.status).toBe("resolved");
    if (resolved.status !== "resolved") throw new Error("normal authoring refused the route");
    return resolved.parameters;
  };
  const where = [{ field: "identity", is: "present" }];
  const helperParameters = await resolve("web.output.dom-extract_list", { extractList: { handle: packet.extraction, fields: { identity: columnKeys.identity! }, where }, recordOutput: { datasetId: "helper", writeMode: "replace" } });
  const fullParameters = await resolve("web.output.dom-extract_list", { extractList: { handle: packet.extraction, fields: { identity: columnKeys.identity!, description: columnKeys.description! }, where }, recordOutput: { datasetId: "answer", writeMode: "append" } });
  const nextParameters = await resolve("web.output.dom-next_page", { nextPage: { list: packet.extraction } });
  const looked = await runtime.executeTool({ ...base, callId: "look", toolId: WEB_LLM_RUN_NODE_TOOL_ID, value: { node: "web.output.dom-capture_snapshot", parameters: {}, consequences: [] } });
  const published = looked.evidence as { page?: string | { page?: string } };
  const view = typeof published.page === "string" ? published.page : published.page?.page;
  const controlHandle = view?.split("\n").find((line) => /button "See more"(?: |$)/u.test(line))?.match(/^t\d+/u)?.[0];
  expect(controlHandle).toBeTruthy();
  const registry = new AutomationStudioNodeRegistry();
  for (const definition of webAutomationOutputNodeDefinitions) registry.register(definition);
  const accepted = acceptAutomationStudioFlowBootstrapResult({
    result: { flow: ["flow: Disclose before reading", "step: disclose this row when needed", "  node: web.dom.click", `  target: ${JSON.stringify({ handle: controlHandle })}`, "  timeoutMs: 2000", "  consequences: none", "  optional: yes", "step: observe", "  node: web.dom.capture_snapshot"].join("\n") },
    registry, resolution: { scope: { kind: "domain", domainId: "web-automation" }, runtimeCapabilities: ["web.actions"], permissions: ["web-automation.action"] }
  });
  expect(accepted.issues.filter((issue) => issue.severity === "error")).toEqual([]);
  if (!accepted.ok) throw new Error("the real script compiler refused optional disclosure");
  const authored = accepted.plan.subflows[0]!;
  const optional = authored.nodes.find((node) => node.definitionId === "web.output.dom-click")!;
  const join = authored.nodes.find((node) => node.definitionId === "builtin.control.merge")!;
  expect(authored.edges.filter((edge) => edge.source.nodeKey === optional.key).map((edge) => [edge.source.portId, edge.target.nodeKey, edge.target.portId]).sort()).toEqual([["failed", join.key, "in"], ["success", join.key, "branches"]]);
  const clickParameters = await resolve(optional.definitionId, optional.parameters ?? {});
  expect(clickParameters.element).toBeTruthy();
  const optionalMetadata = { ...(optional.metadata ?? {}), [AUTOMATION_STUDIO_DECLARED_CONSEQUENCES_METADATA_KEY]: optional.consequences ?? [] };
  const optionalEdges = authored.edges.filter((edge) => edge.source.nodeKey === optional.key).map((edge) => ({
    id: edge.key, sourceNodeId: "expand", sourcePortId: edge.source.portId, targetNodeId: "join", targetPortId: edge.target.portId
  }));
  // The real failed content read must reach the builder through the actual
  // domain composition seam, not merely retain feedback in a direct reply.
  const refused = await runtime.executeTool({ ...base, callId: "read-collapsed", toolId: WEB_LLM_RUN_NODE_TOOL_ID, permission: async () => ({ permitted: true }),
    value: { node: "web.output.dom-extract_list", parameters: { extractList: { handle: packet.extraction, fields: { identity: columnKeys.identity!, description: columnKeys.description! }, where } }, consequences: [] } });
  expect(refused.effectApplied).toBe(false);
  const refusedEvidence = refused.evidence as JsonObject;
  expect(refusedEvidence.code).toBe("output_not_observed");
  const detail = refusedEvidence.detail as JsonObject;
  expect(detail.reason).toBe("incomplete_text");
  expect(detail.next).toMatch(/nonempty.*row-context.*without.*For Each.*optional.*registered row-bound click.*Next page/u);
  expect(JSON.stringify(detail)).not.toMatch(/field description|unexpanded text/u);
  await expect(partial.getByRole("button", { name: "See more", exact: true })).toBeVisible();
  const edge = (from: string, port: string, to: string, input = "in") => ({ id: `${from}.${port}.${to}.${input}`, sourceNodeId: from, sourcePortId: port, targetNodeId: to, targetPortId: input });
  const flow: AutomationStudioFlowDocument = {
    schemaVersion: "0.1", flowId: "flow.disclosure-order", ownerKind: "task", ownerId: "task.disclosure-order", name: "Complete list text", createdAt: 1, updatedAt: 1,
    nodes: [
      { id: "start", definitionId: "builtin.control.start" },
      { id: "pages", definitionId: "builtin.control.repeat", parameterValues: { most: 2 } },
      { id: "helper", definitionId: "web.output.dom-extract_list", parameterValues: helperParameters },
      { id: "each", definitionId: "builtin.control.for-each" },
      { id: "expand", definitionId: optional.definitionId, parameterValues: clickParameters, metadata: optionalMetadata },
      { id: "join", definitionId: join.definitionId, ...(join.parameters ? { parameterValues: join.parameters } : {}), ...(join.metadata ? { metadata: join.metadata } : {}) },
      { id: "full", definitionId: "web.output.dom-extract_list", parameterValues: fullParameters },
      { id: "next", definitionId: "web.output.dom-next_page", parameterValues: nextParameters },
      { id: "end", definitionId: "builtin.control.end" }
    ],
    edges: [
      edge("start", "success", "pages"),
      edge("pages", "body", "helper"), edge("helper", "success", "each"), edge("helper", "records", "each", "items"),
      edge("each", "body", "expand"), edge("each", "item", "expand", "item"), ...optionalEdges, edge("join", "success", "each"),
      edge("each", "done", "full"), edge("full", "success", "next"), edge("next", "success", "pages"), edge("next", "ended", "end"), edge("pages", "done", "end")
    ]
  };
  const bundle = createWebAutomationOutputNodeImplementationBundle();
  const actionIds: Record<string, "web.dom.extract_list" | "web.dom.click" | "web.dom.next_page"> = {
    "web.output.dom-extract_list": "web.dom.extract_list", "web.output.dom-click": "web.dom.click", "web.output.dom-next_page": "web.dom.next_page"
  };
  const helperCounts: number[] = [];
  const fullCounts: number[] = [];
  const afterMoveCollapsed: number[] = [];
  const scopedRows: Array<JsonValue | undefined> = [];
  const clickOutcomes: Array<{ status: string; code?: string; category?: string }> = [];
  const proofIssues: string[] = [];
  let commandId = 0;
  const trace = await runAutomationStudioGraph(flow, {
    nativeNodeExecutor: async ({ node, inputs }) => {
      const id = actionIds[node.definitionId];
      if (!id) return undefined;
      const definition = webAutomationOutputNodeDefinitions.find((candidate) => candidate.id === node.definitionId);
      if (!definition) throw new Error("the native node has no registered definition");
      if (id === "web.dom.click") scopedRows.push(inputs.item);
      return {
        result: await bundle.implementations[id]!({ inputs, parameters: node.parameterValues ?? {}, log: () => undefined } as unknown as AutomationStudioNativeNodeContext),
        declaredOutputs: definition.outputs
      };
    },
    effectDispatcher: async (effect) => {
      if (effect.type !== "policy.output.dispatch") return undefined;
      const payload = effect.payload as JsonObject;
      const parameters = { ...payload.parameters as JsonObject };
      const target = normalizeAutomationStudioElementTarget(parameters, { source: "runtime" });
      if (target) parameters.target = target as unknown as JsonObject;
      const command = webAutomationActionFromGatewayCommand({ commandId: `disclosure-route-${++commandId}`, actionType: payload.outputId as string, parameters, target: outputTargetFromPayload(parameters) ?? {} });
      if ("status" in command) throw new Error("registered command mapping refused the authored route");
      const reply = await harness.runAction(command as BrowserActionCommand);
      const succeeded = reply.status === "succeeded";
      if (payload.outputId === "web.dom.click") clickOutcomes.push({ status: reply.status, ...(reply.failure ? { code: reply.failure.code, category: reply.failure.category } : {}) });
      if (payload.outputId === "web.dom.extract_list" && succeeded) {
        const rows = reply.extracted as Array<Record<string, string>>;
        const output = payload.recordOutput as JsonObject;
        if (output.datasetId === "helper") {
          if (output.writeMode !== "replace") proofIssues.push("helper.writeMode");
          if (rows.some((row) => Object.keys(row).join(",") !== "identity")) proofIssues.push("helper.columns");
          if (rows.some((row) => typeof row.identity !== "string" || row.identity.length === 0)) proofIssues.push("helper.missing_identity");
          helperCounts.push(rows.length);
        } else {
          if (output.datasetId !== "answer") proofIssues.push("full.dataset");
          if (reply.validation.status !== "passed") proofIssues.push("full.validation");
          if (await page.locator(`${item} ${message} [role="button"]`).count() !== 0) proofIssues.push("full.collapsed_control");
          fullCounts.push(rows.length);
        }
      }
      if (payload.outputId === "web.dom.next_page" && succeeded) afterMoveCollapsed.push(await page.locator(`${item} ${message} [role="button"]`).count());
      const result = wirePayload(reply);
      return {
        status: succeeded ? "success" : "failed", route: (result as JsonObject).route === "ended" ? "ended" : succeeded ? "success" : "failed",
        outputs: { ok: succeeded, result: { status: reply.status, result: result as JsonValue } },
        ...(reply.failure ? { failure: reply.failure } : {})
      };
    }
  });
  // Assertions run outside the dispatcher: the executor catches a thrown
  // dispatch error and an optional failed edge must never hide test failures.
  const expansions = trace.attempts.filter((attempt) => attempt.nodeId === "expand");
  const structural = JSON.stringify({ proofIssues, clickOutcomes, expansions: expansions.map((attempt) => ({ status: attempt.status, route: attempt.route, code: attempt.failure?.code, category: attempt.failure?.category, skipped: attempt.skipped })) });
  expect(clickOutcomes.filter((outcome) => outcome.status !== "succeeded" && outcome.code !== "web.target.not_found"), structural).toEqual([]);
  expect(proofIssues, structural).toEqual([]);
  expect(trace.status, JSON.stringify({ message: trace.message, attempts: trace.attempts.map((attempt) => ({ node: attempt.nodeId, status: attempt.status, code: attempt.failure?.code })) })).toBe("succeeded");
  expect(expansions.every((attempt) => attempt.status === "succeeded" && ["success", "skipped"].includes(attempt.route ?? "")), structural).toBe(true);
  expect(expansions.some((attempt) => attempt.route === "success"), "at least one disclosure must actually expand").toBe(true);
  expect(expansions.some((attempt) => attempt.skipped?.reason === "target_absent" && attempt.skipped.code === "web.target.not_found"), "at least one genuinely absent optional control must be proved").toBe(true);
  expect(helperCounts).toHaveLength(1);
  expect(helperCounts.every((count) => count > 0)).toBe(true);
  expect(scopedRows.length).toBe(helperCounts.reduce((sum, count) => sum + count, 0));
  expect(scopedRows.every((row) => row !== undefined && Object.keys(row as object).join(",") === "identity")).toBe(true);
  expect(scopedRows.every((row) => typeof (row as JsonObject)?.identity === "string" && String((row as JsonObject).identity).length > 0)).toBe(true);
  expect(fullCounts).toHaveLength(1);
  expect(fullCounts[0]!).toBeGreaterThanOrEqual(helperCounts[0]!);
  expect(afterMoveCollapsed).toEqual([0]);
  expect(trace.attempts.find((attempt) => attempt.nodeId === "next")?.route).toBe("ended");
  // This fixture's current-page read reveals its full home feed; no genuine
  // subsequent page with collapsed text remains, so no two-page proof is claimed.
});
