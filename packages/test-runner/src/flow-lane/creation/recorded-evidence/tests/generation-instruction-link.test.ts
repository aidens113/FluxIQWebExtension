import assert from "node:assert/strict";
import test from "node:test";
import { RunnerFailure } from "../../../../failure.js";
import { assertGenerationInstructionLinksRecording, assertLinks } from "../generation-instruction-link.js";

const generation = (linked: unknown) => ({ instructionId: "i1", tags: ["generation"], scope: { kind: "flow" }, linkedRecordingIds: linked });
const fact = (run: () => void) => {
  try { run(); } catch (error) { return error instanceof RunnerFailure ? error.details?.fact : `not a runner failure: ${String(error)}`; }
  return "held";
};

test("holds when the Flow's one generation instruction links exactly the recording", () => {
  assert.equal(fact(() => assertLinks({ payload: { instructions: [generation(["rec.mine"]), { tags: ["runtime"], scope: { kind: "flow" }, linkedRecordingIds: [] }] } }, "rec.mine")), "held");
});

test("fails instruction.linked for no link, another link, an extra link, no generation instruction, or two", () => {
  for (const linked of [[], ["rec.other"], ["rec.mine", "rec.other"], undefined]) assert.equal(fact(() => assertLinks({ payload: { instructions: [generation(linked)] } }, "rec.mine")), "instruction.linked");
  assert.equal(fact(() => assertLinks({ payload: { instructions: [] } }, "rec.mine")), "instruction.linked");
  assert.equal(fact(() => assertLinks({ payload: { instructions: [generation(["rec.mine"]), generation(["rec.mine"])] } }, "rec.mine")), "instruction.linked");
});

test("asks Core for the Flow's instruction set in the project's domain", async () => {
  const calls: unknown[][] = [];
  await assertGenerationInstructionLinksRecording({
    async automationStudioCall(...args) {
      calls.push(args);
      return { payload: { instructions: [generation(["rec.mine"])] } };
    },
  }, { projectId: "p1", flowId: "f1", domainId: "d1" }, "rec.mine");
  assert.equal(calls[0]![0], "get-flow-instruction-set");
  assert.deepEqual(calls[0]![1], { projectId: "p1", flowId: "f1" });
  assert.equal(calls[0]![3], "d1");
});
