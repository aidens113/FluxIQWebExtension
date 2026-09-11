import assert from "node:assert/strict";
import { mkdtemp, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import type { CloneTargetConfiguration } from "../target-config.js";
import { ClonePackageCache } from "../clone-cache.js";
import { exportClonePackage } from "../clone-source-exporter.js";

const target: CloneTargetConfiguration = {
  mode: "clone",
  source: {
    baseUrl: "https://source.example.test",
    projectId: "project.source",
    flowId: "flow.source",
    credentials: { username: "runner", password: "password-value", totp: "123456" },
  },
};

function json(payload: unknown, status = 200, headers?: HeadersInit): Response {
  return new Response(JSON.stringify(payload), { status, headers: { "content-type": "application/json", ...headers } });
}

test("exports and packages an exact source Flow using authenticated read endpoints only", async (t) => {
  const cacheRoot = await mkdtemp(path.join(os.tmpdir(), "fluxiq-clone-export-"));
  t.after(async () => { await rm(cacheRoot, { recursive: true, force: true }); });
  const originalFetch = globalThis.fetch;
  const requests: Array<{ path: string; endpoint?: string }> = [];
  let definitionReads = 0;
  const flow = {
    schemaVersion: "0.1", projectId: "project.source", flowId: "flow.source", name: "Source", scope: { kind: "domain", domainId: "web-automation" },
    interface: { inputs: [], outputs: [] }, errors: [], variables: [], nodes: [{ id: "node.start", definitionId: "builtin.control.start" }, { id: "node.one", definitionId: "web.dom.type" }], edges: [],
    publication: { status: "published", version: "1.0.0" }, createdAt: 1, updatedAt: 2,
  };
  globalThis.fetch = async (input, init = {}) => {
    const url = new URL(String(input));
    const endpoint = url.pathname.startsWith("/api/programs/automation-studio/") ? url.pathname.split("/").at(-1) : undefined;
    requests.push({ path: url.pathname, ...(endpoint ? { endpoint } : {}) });
    if (url.pathname === "/api/auth/login") {
      assert.equal(String(init.body).includes("password-value"), true);
      return json({ ok: true }, 200, { "set-cookie": "fluxiq_session=opaque; Max-Age=3600" });
    }
    if (url.pathname === "/api/auth/session") return json({ ok: true, payload: { user: { username: "runner" } } });
    if (endpoint === "projects") return json({ ok: true, payload: { projects: [{ id: "project.source", name: "Source", description: "", domainId: "web-automation", createdAt: 1, updatedAt: 2 }] } });
    if (endpoint === "list-flow-summaries") return json({ ok: true, payload: { flows: [{ flowId: "flow.source", name: "Source", sourceMode: "visual", nodeCount: 2, edgeCount: 0, updatedAt: 2 }] } });
    if (endpoint === "get-flow") return json({ ok: true, payload: { flow } });
    if (endpoint === "inspect-flow-dependencies") return json({ ok: true, payload: { dependencies: [], usedBy: [], availableUpgrades: [] } });
    if (endpoint === "list-native-node-definitions") {
      definitionReads += 1;
      return json({ ok: true, payload: { nodes: definitionReads === 1 ? [
        { id: "builtin.control.start", version: "1.0.0", source: { kind: "builtin", implementationKey: "start" }, capabilities: { executable: true } },
        { id: "web.dom.type", version: "1.0.0", source: { kind: "importer", domainId: "web-automation", implementationKey: "web.dom.type" }, capabilities: { executable: true } },
      ] : [] } });
    }
    throw new Error(`unexpected request ${url.pathname}`);
  };
  t.after(() => { globalThis.fetch = originalFetch; });

  const cache = new ClonePackageCache(cacheRoot);
  const clonePackage = await exportClonePackage(target, { destination: { projectId: "project.destination", flowId: "flow.destination" }, cache });
  assert.equal(clonePackage.compatibility.verdict, "compatible");
  assert.equal(clonePackage.flowDocument.publication && (clonePackage.flowDocument.publication as Record<string, unknown>).status, "draft");
  assert.equal(clonePackage.source.origin, "https://source.example.test");
  assert.match(clonePackage.source.contentHash, /^[a-f0-9]{64}$/u);
  const reused = await exportClonePackage(target, { destination: { projectId: "project.destination.two", flowId: "flow.destination.two" }, cache });
  assert.equal(reused.idMap.find(item => item.kind === "flow")?.destinationId, "flow.destination.two");
  assert.equal(reused.compatibility.verdict, "incompatible", "registry drift must invalidate cached compatibility");
  const endpoints = requests.map(item => item.endpoint).filter(Boolean);
  assert.deepEqual(endpoints, ["projects", "list-flow-summaries", "get-flow", "inspect-flow-dependencies", "list-native-node-definitions", "projects", "list-flow-summaries", "inspect-flow-dependencies", "list-native-node-definitions"]);
  assert.equal(endpoints.filter(item => item === "get-flow").length, 1, "unchanged cached Flow content should not be fetched again");
  const forbidden = ["create-project", "create-flow", "save-flow", "publish-flow", "run-runtime-session", "delete-flow"];
  assert.equal(requests.some(item => item.endpoint && forbidden.includes(item.endpoint)), false);
  const serialized = JSON.stringify(clonePackage);
  assert.equal(serialized.includes("password-value"), false);
  assert.equal(serialized.includes("123456"), false);
  assert.equal(serialized.includes("opaque"), false);
});

test("fails before packaging when source project identity is outside web automation", async () => {
  const called: string[] = [];
  const client = {
    async login() { called.push("login"); return "login" as const; },
    async validateCurrentSession() { called.push("validate"); return { identityEndpointAvailable: true, username: "runner" }; },
    async requireProject() { called.push("project"); return { id: "project.source", name: "Wrong", description: "", domainId: "another-domain", createdAt: 1, updatedAt: 1 }; },
    async listFlowSummaries() { called.push("flows"); return []; },
    async getExactFlow() { throw new Error("must not read Flow"); },
    async inspectFlowDependencies() { throw new Error("must not inspect dependencies"); },
    async listNativeNodeDefinitions() { throw new Error("must not list definitions"); },
  };
  await assert.rejects(() => exportClonePackage(target, { destination: { projectId: "project.destination", flowId: "flow.destination" }, createClient: () => client }), /not a web-automation project/);
  assert.deepEqual(called, ["login", "validate", "project"]);
});
