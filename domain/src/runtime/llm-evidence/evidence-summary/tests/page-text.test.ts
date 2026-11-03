import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, readdirSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { AutomationStudioNativeNodeRuntime, automationStudioLlmStepLogTool } from "fluxiq/automation";
import { createWebAutomationOutputNodeImplementationBundle, createWebAutomationOutputNodeManifest } from "../../../../output-nodes";
import { webLlmEvidencePageText, webLlmEvidenceSummary } from "../index";

const PAGE = "page https://shop.example/cart\n[b1] button \"Checkout\"";

test("evidence that carries no page answers nothing", () => {
  for (const evidence of [undefined, null, 7, "page", [], {}, { ok: true }, { value: { rows: [{ title: "Kettle" }] } }]) {
    assert.equal(webLlmEvidencePageText(evidence), undefined, JSON.stringify(evidence));
  }
});

test("a page field that is not a string is not a page, and the search goes on beneath it", () => {
  assert.equal(webLlmEvidencePageText({ page: 3 }), undefined);
  assert.equal(webLlmEvidencePageText({ page: null }), undefined);
  assert.equal(webLlmEvidencePageText({ page: { schemaVersion: "web-llm-page.v3", url: "https://shop.example/cart" } }), undefined);
  assert.equal(webLlmEvidencePageText({ page: { page: PAGE } }), PAGE);
});

test("the canonical page view is found where a tool's result nests it", () => {
  assert.equal(webLlmEvidencePageText({ ok: true, value: { page: { schemaVersion: "web-llm-page.v3", page: PAGE } } }), PAGE);
  assert.equal(webLlmEvidencePageText({ ok: true, page: PAGE }), PAGE);
  assert.equal(webLlmEvidencePageText({ page: PAGE }), PAGE);
  assert.equal(webLlmEvidencePageText({ page: "" }), "", "an empty string is still the page the evidence named");
});

test("of competing pages the shallowest wins, whichever comes first in the object", () => {
  const deepFirst = { value: { page: { page: "deep" } }, page: "shallow" };
  const shallowFirst = { page: "shallow", value: { page: { page: "deep" } } };
  assert.equal(webLlmEvidencePageText(deepFirst), "shallow");
  assert.equal(webLlmEvidencePageText(shallowFirst), "shallow");
  assert.equal(webLlmEvidencePageText({ a: { b: { page: "deeper" } }, c: { page: "nearer" } }), "nearer");
  assert.equal(webLlmEvidencePageText({ a: { page: "first" }, b: { page: "second" } }), "first", "at one depth, the first in order");
});

test("an array is searched member by member, each member one level down", () => {
  assert.equal(webLlmEvidencePageText([{ page: "first" }, { page: "second" }]), "first");
  assert.equal(webLlmEvidencePageText([{ rows: [] }, { page: "second" }]), "second");
  assert.equal(webLlmEvidencePageText({ results: [{ value: { page: "in a list" } }] }), "in a list");
  assert.equal(webLlmEvidencePageText([[{ page: "nested list" }]]), "nested list");
  const arrayWithPageField = Object.assign([{ page: "member" }], { page: "on the array itself" });
  assert.equal(webLlmEvidencePageText(arrayWithPageField), "member", "an array's own named field is not read");
});

test("the search stops at four levels", () => {
  assert.equal(webLlmEvidencePageText({ a: { b: { c: { page: "level four" } } } }), "level four");
  assert.equal(webLlmEvidencePageText({ a: { b: { c: { d: { page: "level five" } } } } }), undefined);
  assert.equal(webLlmEvidencePageText([[[{ page: "level four" }]]]), "level four");
  assert.equal(webLlmEvidencePageText([[[[{ page: "level five" }]]]]), undefined);
});

test("a registered web bundle is what gives Core's step log its page.txt", async () => {
  const directory = mkdtempSync(path.join(tmpdir(), "fluxiq-web-page-text-"));
  try {
    const bundle = createWebAutomationOutputNodeImplementationBundle();
    assert.equal(bundle.llmEvidenceSummary, webLlmEvidenceSummary);
    new AutomationStudioNativeNodeRuntime().register(createWebAutomationOutputNodeManifest(), bundle);
    const evidence = { ok: true, value: { page: { schemaVersion: "web-llm-page.v3", page: PAGE } } };
    const run = automationStudioLlmStepLogTool(async (_request: { callId: string; toolId: string }) => ({ kind: "llm_evidence_tool_execution" as const, evidence, effectApplied: false, resultCode: "web.inspect.succeeded" }), { FLUXIQ_LLM_STEP_LOG_DIR: directory });
    await run({ callId: "c1", toolId: "core:run_node" });
    const step = readdirSync(directory).find((name) => /^\d{4}-tool-/u.test(name));
    assert.ok(step);
    assert.equal(readFileSync(path.join(directory, step, "page.txt"), "utf8"), PAGE);
  } finally {
    rmSync(directory, { recursive: true, force: true });
  }
});
