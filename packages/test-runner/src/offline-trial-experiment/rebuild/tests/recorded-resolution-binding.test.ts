import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioCandidateFingerprint } from "fluxiq/automation-studio";
import type { JsonObject } from "fluxiq/core";
import type { CoreAuthoring } from "../core-authoring.js";
import { recordedResolutionBinding, type ResolutionRequest } from "../recorded-resolution-binding.js";
import type { RecordedResolution } from "../../types.js";

const canonical = (value: unknown): string => JSON.stringify(automationStudioCandidateFingerprint.snapshot(value));
const CLICK = "web.output.dom-click";
const READ = "web.output.dom-extract_list";

/** A condition reader that canonicalises each condition by adding a mark, as a stand-in for the domain's. */
const conditions: CoreAuthoring["extractionConditions"] = (where) => {
  const list = Array.isArray(where) ? where : [where];
  if (list.some((entry) => (entry as JsonObject).field === "unknown")) return { ok: false, issue: "web.handle.unknown_field", path: ["where"] };
  return { ok: true, where: list.map((entry) => ({ ...(entry as JsonObject), read: true })) };
};

const click: RecordedResolution = { nodeDefinitionId: CLICK, written: { target: { handle: "t5" }, timeoutMs: 10 }, resolved: { element: { tag: "div" }, selector: "body > div", timeoutMs: 10 } };
const writtenRead: JsonObject = {
  extractList: { handle: "extraction.1", fields: { group: "col_a" }, where: [{ field: "group", equals: ["x"] }] },
  recordOutput: { datasetId: "d", schema: { fields: [] } },
};
const read: RecordedResolution = {
  nodeDefinitionId: READ, written: writtenRead,
  resolved: { extractList: { item: "li", fields: { group: { selector: "a" } }, where: [{ field: "group", equals: ["x"], read: true }] }, recordOutput: { datasetId: "d", process: { minRows: 0 }, schema: { fields: [] } } },
};

function binding(resolutions: readonly RecordedResolution[] = [click, read]) {
  return recordedResolutionBinding({ resolutions, runsNodes: { arrival: "n" }, conditions, canonical });
}
const ask = (seam: ReturnType<typeof binding>, request: ResolutionRequest) => seam.binding.resolvePlanNodeParameters({ writtenByModel: true, ...request });

test("a step written as a recorded one gets that step's resolution, and a literal step and Core's own questions are unchanged", async () => {
  const seam = binding();
  assert.deepEqual(await ask(seam, { nodeDefinitionId: CLICK, parameters: { timeoutMs: 10, target: { handle: "t5" } } }), { status: "resolved", parameters: click.resolved });
  assert.deepEqual(await ask(seam, { nodeDefinitionId: "web.output.browser-navigate", parameters: { url: "http://example.test/" } }), { status: "unchanged" });
  assert.deepEqual(await seam.binding.resolvePlanNodeParameters({ nodeDefinitionId: CLICK, parameters: { target: { handle: "t9" } } }), { status: "unchanged" });
  assert.equal(seam.binding.runsNodes && (seam.binding.runsNodes as { arrival: string }).arrival, "n");
  assert.deepEqual(seam.unresolved(), []);
});

test("a handle the record does not hold is refused as unknown, with the paths that differ from the nearest recorded step", async () => {
  const seam = binding();
  assert.deepEqual(await ask(seam, { nodeDefinitionId: CLICK, parameters: { target: { handle: "t6" }, timeoutMs: 10 } }), { status: "refused", issueCodes: ["web.handle.unknown"] });
  assert.deepEqual(await ask(seam, { nodeDefinitionId: READ, parameters: { ...writtenRead, extractList: { ...(writtenRead.extractList as JsonObject), fields: { group: "col_a", text: "col_b" } } } }), { status: "refused", issueCodes: ["web.handle.unknown"] });
  assert.deepEqual(seam.unresolved().map((step) => [step.nodeDefinitionId, step.differingPaths]), [[CLICK, ["target.handle"]], [READ, ["extractList.fields.text"]]]);
});

test("a read differing only in its where clause is resolved with the clause the condition reader gives", async () => {
  const seam = binding();
  const written = { ...writtenRead, extractList: { ...(writtenRead.extractList as JsonObject), where: [{ field: "group", is: "present" }] } };
  const answer = await ask(seam, { nodeDefinitionId: READ, parameters: written });
  assert.equal(answer.status, "resolved");
  const resolved = (answer as { parameters: JsonObject }).parameters;
  assert.deepEqual((resolved.extractList as JsonObject).where, [{ field: "group", is: "present", read: true }]);
  assert.deepEqual((resolved.extractList as JsonObject).item, "li");
  // An empty clause leaves the request without one, as the domain does.
  const empty = await ask(seam, { nodeDefinitionId: READ, parameters: { ...writtenRead, extractList: { ...(writtenRead.extractList as JsonObject), where: [] } } });
  assert.equal(Object.hasOwn(((empty as { parameters: JsonObject }).parameters.extractList as JsonObject), "where"), false);
  // A clause the reader refuses is refused, never guessed at.
  assert.equal((await ask(seam, { nodeDefinitionId: READ, parameters: { ...writtenRead, extractList: { ...(writtenRead.extractList as JsonObject), where: [{ field: "unknown" }] } } })).status, "refused");
});

test("the where seam stands in only when the reader gives back the recorded read's own clause", async () => {
  const drifted: RecordedResolution = { ...read, resolved: { ...read.resolved, extractList: { ...(read.resolved.extractList as JsonObject), where: [{ field: "group", equals: ["x"] }] } } };
  const seam = binding([drifted]);
  const written = { ...writtenRead, extractList: { ...(writtenRead.extractList as JsonObject), where: [{ field: "group", is: "present" }] } };
  assert.equal((await ask(seam, { nodeDefinitionId: READ, parameters: written })).status, "refused");
  assert.match(seam.unresolved()[0]!.reason, /condition reader does not give back/);
});

test("a read differing only in its Core-side record processing carries that processing as written", async () => {
  const seam = binding();
  const written = { ...writtenRead, recordOutput: { ...(writtenRead.recordOutput as JsonObject), process: { limit: 3 } } };
  const answer = await ask(seam, { nodeDefinitionId: READ, parameters: written });
  assert.equal(answer.status, "resolved");
  const resolved = (answer as { parameters: JsonObject }).parameters;
  assert.deepEqual((resolved.recordOutput as JsonObject).process, { limit: 3 });
  assert.deepEqual((resolved.extractList as JsonObject).where, (read.resolved.extractList as JsonObject).where);
});
