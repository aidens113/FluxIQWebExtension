import assert from "node:assert/strict";
import test from "node:test";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const SCRIPT = scriptedModelScriptFor("company-website-apprentices");
const decide = SCRIPT.replies.evidence_tool_decision![0]!;

function request(page: string, extra: readonly Record<string, unknown>[] = []): ScriptedModelRequest {
  const evidence = [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
  return { kind: "evidence_tool_decision", ordinal: 1, model: "m", jsonText: true, message: "", payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence } } } };
}

type Called = { decision: { kind: string; callId?: string; toolId?: string; input?: { node?: string; parameters?: Record<string, any> } } };
const decision = (page: string, extra?: readonly Record<string, unknown>[]) => (decide(request(page, extra)) as Called).decision;

test("a press takes its handle from the page as it stands, never from the script", () => {
  const first = decision('URL ~/\nt41 button "Accept all"');
  assert.equal(first.input?.parameters?.target.handle, "t41");
  assert.equal(decision('URL ~/\nt999 button "Accept all"').input?.parameters?.target.handle, "t999");
});

test("it goes to the team page, loads the grid, and reads it keeping the apprentices", () => {
  assert.equal(decision('URL ~/\nt7 link "Our team" ~/team').input?.parameters?.target.handle, "t7");
  assert.equal(decision('URL ~/team\nt9 "Gareth Pell"\nt11 button "Show more people"').callId?.startsWith("show-more"), true);
  assert.equal(decision('URL ~/team\nt9 "Gareth Pell"').input?.node, "web.output.dom-scroll");
  const page = 'URL ~/team\nt70 "Megan Ashdown"';
  assert.equal(decision(page).toolId, "web.detect_repeating_structure");
  const fields = [{ key: "h3_a", sample: "Gareth Pell" }, { key: "p_b", sample: "Managing Director" }, { key: "branch_label", sample: "Branch" }, { key: "branch", sample: "Wrenfield" }];
  const read = decision(page, [{ callId: "detect-team", toolId: "web.detect_repeating_structure", value: { extraction: "extraction.7", fields } }]);
  assert.equal(read.input?.node, "web.output.dom-extract_list");
  assert.deepEqual(read.input?.parameters?.extractList.fields, { name: "h3_a", role: "p_b", branch: "branch" });
  assert.equal(read.input?.parameters?.extractList.handle, "extraction.7");
  assert.deepEqual(read.input?.parameters?.extractList.where, [{ field: "p_b", contains: "Apprentice" }]);
});

test("once it has read, it completes, and a page it cannot read fails loudly", () => {
  assert.equal(decision('URL ~/team\nt70 "Megan Ashdown"', [{ callId: "read-team", toolId: "core.run_node", value: { ok: true } }]).kind, "complete");
  assert.throws(() => decision('URL ~/\nt1 link "Home" ~/'), /The page shows nothing matching/u);
  assert.throws(() => decide({ ...request(""), payload: { taskKind: "evidence_tool_decision", context: { evidenceLoop: { evidence: [] } } } }), /holds no page/u);
});

test("the judge is held for every attempt of the default series, twice each", () => {
  assert.ok((SCRIPT.replies.loop_verification?.length ?? 0) >= 8);
  assert.ok((SCRIPT.replies.panel_command?.length ?? 0) >= 4);
});

test("a task with no script is refused by name", () => {
  assert.throws(() => scriptedModelScriptFor("no-such-task"), /has no script for no-such-task/u);
});
