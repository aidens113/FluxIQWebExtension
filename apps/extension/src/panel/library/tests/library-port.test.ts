// The library's port over the panel messages, against t866's wire shapes (`project-part.ts`,
// `subflow-card.ts`): a card as Core lists it, with its hashes, and the answers of get and run. The background is a
// scripted `request`.

import assert from "node:assert/strict";
import test from "node:test";
import type { PanelMessage, PanelResult, PanelStore } from "../../state";
import { createPartsLibraryPort } from "../library-port";

const DIGEST = `sha256:${"a".repeat(64)}`;

/** `AutomationStudioSubflowCard`, as t866's `list-project-parts` returns it. */
const card = (partId: string, extra: Record<string, unknown> = {}) => ({
  partId, version: 2, name: "Apply the filters", purpose: "Narrows a list to what was asked for.",
  sites: ["https://shop.example"],
  inputs: [{ id: "category", name: "Category", required: true }, { id: "sort", name: "Sort order", required: false }],
  outputs: [{ id: "count", name: "Results found", required: true }],
  fixedValues: ["in stock"], lastingClasses: ["create_new"],
  startCheck: { digest: DIGEST, conditions: 2, says: "The shop's search page is open." },
  endCheck: { digest: DIGEST, conditions: 1 },
  calls: [{ partId: "pick-size", version: 1 }],
  shapeHash: DIGEST,
  trust: { tier: "provisional", counts: { judgedYes: 1, zeroModelRuns: 0, failures: 1 }, lastFailureAtMs: 1_700_000_000_000 },
  ...extra
});

function setup(reply: PanelResult<unknown>) {
  const sent: PanelMessage[] = [];
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    return reply;
  }) as PanelStore["request"];
  return { sent, port: createPartsLibraryPort(request) };
}

const payload = (value: unknown): PanelResult<unknown> => ({ ok: true, value: { ok: true, payload: value } });

test("lists with only the fields given, and reads the cards without their hashes", async () => {
  const { sent, port } = setup(payload({ parts: [card("apply-filters"), { name: "No id" }], nextCursor: "c2", hasMore: true }));
  const answer = await port.list({ projectId: "p1", text: "  filters ", limit: 25, cursor: null });
  assert.deepEqual(sent, [{ type: "fluxiq.panel.listParts", projectId: "p1", query: "filters", limit: 25 }]);
  assert.ok(answer.ok && !answer.value.refused);
  if (!answer.ok || answer.value.refused) return;
  assert.equal(answer.value.parts.length, 1, "a card that cannot be read is left out, not guessed");
  assert.deepEqual(answer.value.parts[0], {
    partId: "apply-filters", version: 2, name: "Apply the filters", purpose: "Narrows a list to what was asked for.", sites: ["https://shop.example"],
    inputs: [{ id: "category", name: "Category", required: true }, { id: "sort", name: "Sort order", required: false }],
    outputs: [{ id: "count", name: "Results found", required: true }],
    fixedValues: ["in stock"], lastingClasses: ["create_new"],
    startCheck: { conditions: 2, says: "The shop's search page is open." }, endCheck: { conditions: 1 },
    calls: [{ partId: "pick-size", version: 1 }],
    trust: { tier: "provisional", counts: { judgedYes: 1, zeroModelRuns: 0, failures: 1 }, lastFailureAtMs: 1_700_000_000_000 }
  });
  assert.equal(JSON.stringify(answer.value).includes("sha256"), false, "no digest or hash reaches the screen");
  assert.equal(answer.value.nextCursor, "c2");
  assert.equal(answer.value.hasMore, true);
});

test("sends nothing it was not given when listing", async () => {
  const { sent, port } = setup(payload({ parts: [], nextCursor: null, hasMore: false }));
  await port.list({ projectId: "p1" });
  assert.deepEqual(sent, [{ type: "fluxiq.panel.listParts", projectId: "p1" }]);
});

test("reads one part with its steps, what it calls nested, and who calls it, and leaves the versions behind", async () => {
  const { sent, port } = setup(payload({
    card: card("apply-filters"),
    steps: [{ label: "Open the filters", lastingClasses: [] }, { label: "Press Apply", lastingClasses: ["modify_existing", "bogus"] }],
    calls: [{ partId: "pick-size", version: 1, name: "Pick a size", calls: [{ partId: "open-menu", version: 3, name: "Open the menu", calls: [] }] }],
    versions: [{ version: 2, createdAtMs: 1, trust: { tier: "provisional" } }],
    callers: [{ kind: "flow", flowId: "f1", nodeId: "n1", version: 2 }, { kind: "part", partId: "browse", callerVersion: 1, nodeId: "n2", version: 2 }, { kind: "other" }]
  }));
  const answer = await port.read({ projectId: "p1", partId: "apply-filters", version: 2 });
  assert.deepEqual(sent, [{ type: "fluxiq.panel.getPart", projectId: "p1", partId: "apply-filters", version: 2 }]);
  assert.ok(answer.ok && !answer.value.refused);
  if (!answer.ok || answer.value.refused || !("detail" in answer.value)) return;
  const { detail } = answer.value;
  assert.deepEqual(detail.steps, [{ label: "Open the filters", lastingClasses: [] }, { label: "Press Apply", lastingClasses: ["modify_existing"] }]);
  assert.deepEqual(detail.calls, [{ partId: "pick-size", version: 1, name: "Pick a size", calls: [{ partId: "open-menu", version: 3, name: "Open the menu", calls: [] }] }]);
  assert.deepEqual(detail.callers, [{ kind: "flow" }, { kind: "part", partId: "browse" }]);
  assert.equal("versions" in detail, false);
});

test("runs with the person's values, the classes they allowed and the repeat they accepted, and sends nothing lasting by default", async () => {
  const { sent, port } = setup(payload({ runId: "r1", status: "succeeded", outputs: { count: 14 }, rows: { runId: "r1", datasets: [{ datasetId: "d1", rowCount: 14 }, { datasetId: "d2", rowCount: 2 }] }, acts: ["create_new"], modelCalls: 0 }));
  await port.run({ projectId: "p1", partId: "apply-filters", inputs: { category: "Kettles" } });
  const answer = await port.run({ projectId: "p1", partId: "apply-filters", version: 2, inputs: { category: "Kettles" }, permitted: ["create_new"], acknowledgedRepeat: true });
  assert.deepEqual(sent, [
    { type: "fluxiq.panel.runPart", projectId: "p1", partId: "apply-filters", inputs: { category: "Kettles" } },
    { type: "fluxiq.panel.runPart", projectId: "p1", partId: "apply-filters", inputs: { category: "Kettles" }, version: 2, permittedConsequences: ["create_new"], acknowledgedRepeat: true }
  ]);
  assert.deepEqual(answer.ok && answer.value, { refused: false, status: "succeeded", outputs: { count: 14 }, rowCount: 16, acts: ["create_new"] });
});

test("a run that stopped says where, in the words Core gave", async () => {
  const { port } = setup(payload({ runId: "r2", status: "stopped", outputs: {}, stoppedAt: { stepLabel: "Apply filter", reason: "The list never loaded." }, acts: [], modelCalls: 0 }));
  const answer = await port.run({ projectId: "p1", partId: "apply-filters", inputs: {} });
  assert.deepEqual(answer.ok && answer.value, { refused: false, status: "stopped", outputs: {}, rowCount: 0, stoppedAt: { stepLabel: "Apply filter", reason: "The list never loaded." }, acts: [] });
});

test("a refusal is a value with a closed code, for list, read and run alike, and an unknown code is read as unavailable", async () => {
  for (const method of ["list", "read", "run"] as const) {
    const { port } = setup(payload({ refused: true, code: "part.act_not_allowed", message: "It would spend money.", classes: ["move_money", "bogus"] }));
    const answer = await (method === "list" ? port.list({ projectId: "p" }) : method === "read" ? port.read({ projectId: "p", partId: "x" }) : port.run({ projectId: "p", partId: "x", inputs: {} }));
    assert.deepEqual(answer, { ok: true, value: { refused: true, code: "part.act_not_allowed", message: "It would spend money.", classes: ["move_money"] } }, method);
  }
  const { port } = setup(payload({ refused: true, code: "something.new", message: "Hm." }));
  assert.deepEqual(await port.read({ projectId: "p", partId: "x" }), { ok: true, value: { refused: true, code: "parts.unavailable", message: "Hm." } });
});

test("a failed request is a failed result with its words, and an answer that cannot be read says so", async () => {
  const failed = setup({ ok: false, sentence: "FluxIQ is not reachable.", code: "unreachable" });
  assert.deepEqual(await failed.port.list({ projectId: "p" }), { ok: false, sentence: "FluxIQ is not reachable.", code: "unreachable" });
  const odd = setup(payload({ unexpected: true }));
  for (const answer of [await odd.port.list({ projectId: "p" }), await odd.port.read({ projectId: "p", partId: "x" }), await odd.port.run({ projectId: "p", partId: "x", inputs: {} })]) {
    assert.deepEqual(answer, { ok: false, sentence: "FluxIQ answered in a way this panel could not read." });
  }
});
