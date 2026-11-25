import assert from "node:assert/strict";
import test from "node:test";
import { readScriptedModelRequest } from "../index.js";

const DECIDER = { taskKind: "evidence_tool_decision", context: {} };
const JUDGE = { taskKind: "loop_verification", outputSchema: { type: "object" } };

test("a judge that continues the decider is read as the judge's task, not as a chat turn (t1038)", () => {
  const body = JSON.stringify({
    model: "claude-haiku-5-5",
    stream: true,
    tools: [{ name: "complete", description: "Finishes the task." }],
    messages: [
      { role: "user", content: [{ type: "text", text: JSON.stringify(DECIDER) }, { type: "text", text: `\n\n${JSON.stringify(JUDGE)}` }] },
      { role: "system", content: "The conversation above is the attempt's own record of deciding." }
    ]
  });
  const read = readScriptedModelRequest(body, () => 1);
  assert.equal(read.kind, "loop_verification");
  assert.deepEqual(read.payload, JUDGE);
});

test("a decision's own request still reads its last user turn", () => {
  const body = JSON.stringify({ model: "claude-haiku-5-5", stream: true, messages: [{ role: "user", content: JSON.stringify(DECIDER) }] });
  assert.equal(readScriptedModelRequest(body, () => 1).kind, "evidence_tool_decision");
});
