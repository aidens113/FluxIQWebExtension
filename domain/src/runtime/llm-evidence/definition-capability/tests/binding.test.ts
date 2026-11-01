import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { FluxIQ } from "fluxiq";
import { parseAutomationStudioFailureRecord, type AutomationStudioActionPermissionCheck } from "fluxiq/automation-studio";
import type { ClientGatewayActionCommand, ClientGatewayActionResult, ClientGatewayCapability } from "fluxiq/client-gateway";
import type { JsonObject } from "fluxiq/core";
import { WEB_AUTOMATION_DOMAIN_ID, WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID, WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID, WEB_AUTOMATION_FAILURE_CODES } from "../../../../client";
import { bindWebAutomationLlmEvidenceRuntime, WEB_LLM_DETECT_STRUCTURE_TOOL_ID, WEB_LLM_RUN_NODE_TOOL_ID } from "../..";

const FIELD = { kind: "text", definition: { term: "Edition", part: "value" } };
type ReadKind = "projected" | "predicate" | "ordinary";
type Binding = Parameters<FluxIQ["programs"]["automationStudio"]["bindLlmEvidenceRuntime"]>[0];
const permission: AutomationStudioActionPermissionCheck = async () => ({ permitted: true });
const STRUCTURE = { ok: true, proposal: {
  container: "ul", item: "ul > article", itemCount: 1, confidence: 1, fields: [
    { key: "edition", label: "Edition", spec: FIELD, coverage: 1 },
    { key: "edition_term", label: "Edition term", spec: { kind: "text", definition: { term: "Edition", part: "term" } }, coverage: 1 },
    { key: "title", label: "Title", spec: { kind: "text", selector: "h3" }, coverage: 1 },
    { key: "ordinary_edition", label: "Ordinary edition", spec: { kind: "text", selector: "dd" }, coverage: 1 }
  ]
} } satisfies JsonObject;

/** Narrow Core's JSON-or-execution union and reject malformed failure records. */
function execution(result: Awaited<ReturnType<Binding["executeTool"]>>) {
  assert.ok(result !== null && typeof result === "object" && !Array.isArray(result));
  assert.ok("kind" in result && result.kind === "llm_evidence_tool_execution");
  assert.ok("evidence" in result);
  const failure = "failure" in result ? parseAutomationStudioFailureRecord(result.failure) ?? undefined : undefined;
  if ("failure" in result && result.failure !== undefined) assert.ok(failure, "the public runtime returned a valid failure record");
  return {
    evidence: result.evidence,
    failure,
    resultCode: "resultCode" in result && typeof result.resultCode === "string" ? result.resultCode : undefined,
    resultReason: "resultReason" in result && typeof result.resultReason === "string" ? result.resultReason : undefined
  };
}

/** Real host and typed public program seams; no setup, SQLite, browser or provider is needed. */
async function productionRuntime(t: TestContext, version?: string | number) {
  const root = await mkdtemp(path.join(os.tmpdir(), "t838-definition-binding-"));
  const fluxiq = FluxIQ.create({ rootDir: root, domainId: WEB_AUTOMATION_DOMAIN_ID, loadEnv: false, modelProvidersEnabled: false });
  t.after(async () => {
    await fluxiq.close();
    const owned = path.resolve(root);
    if (path.dirname(owned) !== path.resolve(os.tmpdir()) || !path.basename(owned).startsWith("t838-definition-binding-")) throw new Error("nonowned cleanup");
    await rm(owned, { recursive: true, force: true, maxRetries: 10, retryDelay: 50 });
  });
  const gateway = fluxiq.programs.clientGateway;
  const connected = gateway.connect({ socket: { send: () => undefined } });
  const original = gateway.snapshot();
  const originalSession = original.sessions.find((session) => session.sessionId === connected.sessionId);
  assert.ok(originalSession);
  const capabilities: ClientGatewayCapability[] = [
    { id: "web.actions", kind: "action", actionTypes: ["web.dom.capture_snapshot", "web.dom.extract_list"] },
    { id: WEB_AUTOMATION_STRUCTURE_DETECTION_CAPABILITY_ID, kind: "snapshot" }
  ];
  if (version !== undefined) capabilities.push({ id: WEB_AUTOMATION_DEFINITION_FIELDS_CAPABILITY_ID, kind: "state", metadata: { version, domainId: WEB_AUTOMATION_DOMAIN_ID } });
  const selected: typeof originalSession = { ...originalSession, clientId: "synthetic.archive", status: "ready", clientType: "extension", capabilities };
  const snapshot: typeof original = { ...original, sessions: [selected] };
  const inspect: typeof gateway.snapshot = () => snapshot;
  t.mock.method(gateway, "snapshot", inspect);
  const program = fluxiq.programs.automationStudio;
  let bound: Binding | undefined;
  const bind: typeof program.bindLlmEvidenceRuntime = (runtime) => {
    bound = runtime;
    return program;
  };
  t.mock.method(program, "bindLlmEvidenceRuntime", bind);
  const sent: string[] = [];
  const execute = async (_sessionId: string, command: ClientGatewayActionCommand): Promise<ClientGatewayActionResult> => {
    sent.push(command.actionType);
    if (command.actionType === "web.dom.capture_snapshot") {
      const payload: JsonObject = { snapshot: {
        url: "https://archive.test/catalogue", title: "Archive catalogue", interactiveElements: [
          { tagName: "ul", selector: "ul" },
          { tagName: "article", selector: "ul > article", parent: 0 },
          { tagName: "h3", selector: "ul > article > h3", parent: 1, visibleText: "Archive record" },
          { tagName: "dl", selector: "ul > article > dl", parent: 1 },
          { tagName: "dt", selector: "ul > article > dl > dt", parent: 3, visibleText: "Edition" },
          { tagName: "dd", selector: "ul > article > dl > dd", parent: 3, visibleText: "Fourth" }
        ]
      } };
      if (command.parameters?.detectStructure !== undefined) payload.structure = STRUCTURE;
      return { commandId: "synthetic.capture", status: "succeeded", payload };
    }
    return { commandId: "synthetic.read", status: "succeeded", payload: {
      extracted: [{ edition: "Fourth" }],
      extraction: { recordCount: 1, pagesRead: 1, truncated: false, missingFields: [], fieldNames: ["edition"], itemsSeen: 1, emptyRecords: 0, listPresence: "present" }
    } };
  };
  t.mock.method(fluxiq.programs.automationStudioClientGateway, "executeAction", execute);
  bindWebAutomationLlmEvidenceRuntime(fluxiq);
  assert.ok(bound);
  return { sent, run: async (kind: ReadKind) => {
    assert.ok(bound);
    const detected = execution(await bound.executeTool({ projectId: "project.archive", flowId: "flow.archive", callId: "call.detect", toolId: WEB_LLM_DETECT_STRUCTURE_TOOL_ID, value: {}, permission }));
    assert.equal(detected.resultCode, "web.structure.detected");
    const evidence = detected.evidence;
    assert.ok(evidence !== null && typeof evidence === "object" && !Array.isArray(evidence));
    const handle = evidence.extraction;
    assert.ok(typeof handle === "string");
    const extractList: JsonObject = { handle, fields: kind === "predicate" ? { title: "title" } : { edition: kind === "ordinary" ? "ordinary_edition" : "edition" } };
    if (kind === "predicate") extractList.where = [{ field: "edition_term", is: "present" }];
    const parameters: JsonObject = { extractList };
    return execution(await bound.executeTool({
      projectId: "project.archive", flowId: "flow.archive", callId: "call.read", toolId: WEB_LLM_RUN_NODE_TOOL_ID,
      value: { node: "web.output.dom-extract_list", parameters, consequences: [] }, permission
    }));
  } };
}

test("the bound production evidence gateway refuses unsupported semantic reads before the extract dispatch", async (t) => {
  for (const kind of ["projected", "predicate"] as const) {
    for (const version of [undefined, "1", 0]) {
      const run = await productionRuntime(t, version);
      const result = await run.run(kind);
      assert.equal(result.failure?.code, WEB_AUTOMATION_FAILURE_CODES.NOT_IMPLEMENTED, `result=${result.resultCode}; reason=${result.resultReason}; sent=${run.sent.join(",")}`);
      assert.equal(result.failure?.retryable, false);
      assert.equal(run.sent.filter((action) => action === "web.dom.extract_list").length, 0);
      assert.ok(run.sent.every((action) => action === "web.dom.capture_snapshot"), "only the normal observation captures preceded capability admission");
    }
  }
});

test("the bound production evidence gateway sends one supported or ordinary read normally", async (t) => {
  for (const [version, kind] of [[1, "projected"], [undefined, "ordinary"]] as const) {
    const run = await productionRuntime(t, version);
    const result = await run.run(kind);
    assert.equal(result.failure, undefined);
    assert.equal(run.sent.filter((action) => action === "web.dom.extract_list").length, 1, `result=${result.resultCode}; reason=${result.resultReason}; sent=${run.sent.join(",")}`);
  }
});
