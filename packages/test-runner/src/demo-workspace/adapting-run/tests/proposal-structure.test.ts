// Core's structural record for a repair it checked without running, read from
// the adaptation's metadata. The Lab's control client does not carry that
// metadata, so the lanes read it here, and only the two facts they judge.

import assert from "node:assert/strict";
import test from "node:test";
import { readTargetProposalStructure } from "../proposal-structure.js";

const control = (adaptation: unknown) => ({
  calls: [] as unknown[],
  async automationStudioCall(endpoint: string, payload: unknown) { this.calls.push([endpoint, payload]); return { adaptation }; },
});

test("the resolution and each structural check's status are read, and nothing else", async () => {
  const client = control({ metadata: { targetResolution: "resolved", structuralChecks: [{ check: "target_resolution", status: "passed", detail: "private text" }], target: { selector: "x" } } });
  const structure = await readTargetProposalStructure(client, "project.one", "flow.one", "adaptation.one");
  assert.deepEqual(structure, { targetResolution: "resolved", structuralCheckStatuses: ["passed"] });
  assert.deepEqual(client.calls, [["get-flow-adaptation", { projectId: "project.one", flowId: "flow.one", adaptationId: "adaptation.one" }]]);
});

test("missing or malformed metadata reads as no resolution and no checks", async () => {
  assert.deepEqual(await readTargetProposalStructure(control({}), "p", "f", "a"), { structuralCheckStatuses: [] });
  assert.deepEqual(await readTargetProposalStructure(control({ metadata: { targetResolution: 7, structuralChecks: "passed" } }), "p", "f", "a"), { structuralCheckStatuses: [] });
  assert.deepEqual(await readTargetProposalStructure(control({ metadata: { structuralChecks: [{ status: "passed" }, { status: 3 }, null] } }), "p", "f", "a"), { structuralCheckStatuses: ["passed", "invalid", "invalid"] });
});
