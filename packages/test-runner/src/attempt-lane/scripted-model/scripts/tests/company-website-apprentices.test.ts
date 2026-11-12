import assert from "node:assert/strict";
import test from "node:test";
import { automationStudioLlmEvidenceCurrentView } from "fluxiq/automation";
import type { JsonObject } from "fluxiq/core";
import { scriptedModelScriptFor, type ScriptedModelRequest } from "../../index.js";

const SCRIPT = scriptedModelScriptFor("company-website-apprentices");
const decide = SCRIPT.replies.evidence_tool_decision![0]!;

function request(page: string, extra: readonly Record<string, unknown>[] = []): ScriptedModelRequest {
  const evidence = extra.some((entry) => entry.toolId === "core.current_view") ? extra : [...extra, { callId: "core.current_view", toolId: "core.current_view", value: { groups: [{ group: "top", callId: "x", value: { page } }] } }];
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
  assert.equal(decision('URL ~/team\nt9 "Dafydd Rees"\nt19 "Ewan Halloran"\nt29 "Owen Castellane"\nt31 button "Show more people"').callId?.startsWith("show-more"), true);
  assert.equal(decision('URL ~/team\nt9 "Dafydd Rees"').input?.node, "web.output.dom-scroll");
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
  assert.equal(decision('URL ~/team\nt70 "Megan Ashdown"', [{ callId: "read-team", toolId: "core.run_node", value: {
    ok: true, node: "web.output.dom-extract_list", status: "succeeded", read: { extracted: [{ name: "A real apprentice" }] },
  } }]).kind, "complete");
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

test("successive batch scrolls advance from the current position as the grid grows", () => {
  let scrollY = 0;
  for (const page of ['URL ~/team\nt9 "Dafydd Rees"', 'URL ~/team\nt9 "Dafydd Rees"\nt19 "Ewan Halloran"']) {
    const next = decision(page);
    assert.equal(next.input?.node, "web.output.dom-scroll");
    const parameters = next.input!.parameters!;
    // The real content action treats legacy y as absolute, and scroll.mode=by as a delta.
    scrollY = parameters.scroll?.mode === "by" ? scrollY + parameters.scroll.y : parameters.y;
  }
  assert.equal(scrollY, 8000, "the next batch's sentinel lies below the first scroll position");
});

test("an outstanding batch is awaited by its actual text before another scroll", () => {
  const first = decision('URL ~/team\nt9 "Gareth Pell"');
  assert.equal(first.input?.node, "web.output.dom-wait_for_text");
  assert.equal(first.input?.parameters?.text, "Dafydd Rees");
  const page = 'URL ~/team\nt9 "Dafydd Rees"';
  const moved = decision(page);
  const pending = decision(page, [{ callId: moved.callId!, toolId: "core.run_node", value: { ok: true } }]);
  assert.equal(pending.input?.node, "web.output.dom-wait_for_text", "an unchanged snapshot is not another scroll request");
  assert.equal(pending.input?.parameters?.text, "Ewan Halloran");
  assert.equal(pending.input?.parameters?.wait?.condition, "visible");
  const laterPage = `${page}\nt19 "Ewan Halloran"`;
  const laterMove = decision(laterPage);
  const laterPending = decision(laterPage, [{ callId: laterMove.callId!, toolId: "core.run_node", value: { ok: true } }]);
  assert.equal(laterPending.input?.node, "web.output.dom-wait_for_text");
  assert.equal(laterPending.input?.parameters?.text, "Owen Castellane");
  const finalPending = decision(`${laterPage}\nt29 "Owen Castellane"`);
  assert.equal(finalPending.input?.node, "web.output.dom-wait_for_text");
  assert.equal(finalPending.input?.parameters?.text, "Megan Ashdown");
});

test("a read call without successful nonempty extraction is repaired before completion", () => {
  const page = 'URL ~/team\nt70 "Megan Ashdown"';
  const structure = { callId: "detect-team", toolId: "web.detect_repeating_structure", value: { extraction: "old", fields: [] } };
  for (const value of [
    { ok: false, code: "target_stale" },
    { ok: true },
    { ok: true, node: "web.output.dom-extract_list", status: "failed", read: { extracted: [{ name: "Partial" }] } },
    { ok: true, node: "web.output.dom-extract_list", status: "succeeded", read: { extracted: [] } },
  ]) {
    const repaired = decision(page, [structure, { callId: "read-team", toolId: "core.run_node", value }]);
    assert.equal(repaired.kind, "tool_call");
    assert.equal(repaired.toolId, "web.detect_repeating_structure", "reacquire the current structure after the unsuccessful read");
  }
  const completed = decision(page, [{ callId: "read-team", toolId: "core.run_node", value: {
    ok: true, node: "web.output.dom-extract_list", status: "succeeded", read: { extracted: [{ name: "A real apprentice" }] },
  } }]);
  assert.equal(completed.kind, "complete");
  const freshStructure = { callId: "detect-team-retry-1", toolId: "web.detect_repeating_structure", value: {
    extraction: "fresh", fields: [{ key: "h3", sample: "Megan Ashdown" }, { key: "p", sample: "Apprentice" }, { key: "branch", sample: "Wrenfield" }],
  } };
  const repaired = decision(page, [{ callId: "read-team", toolId: "core.run_node", value: { ok: false } }, freshStructure]);
  assert.equal(repaired.input?.node, "web.output.dom-extract_list");
  assert.equal(repaired.input?.parameters?.extractList.handle, "fresh");
});

function projectedRead(value: JsonObject): readonly Record<string, unknown>[] {
  const projected = automationStudioLlmEvidenceCurrentView([
    { callId: "read-team", toolId: "core.run_node", value },
    { callId: "newer-page", toolId: "core.run_node", value: { page: 'URL ~/team\nt70 "Megan Ashdown"' } },
  ], ["page", "read.extracted", "read.rejectedRows", "read.rejectedRowsNote"]);
  return [...projected.history, ...(projected.currentView ? [projected.currentView] : [])];
}

test("a successful read completes from Core's matching held-row view after a newer page observation", () => {
  const evidence = projectedRead({
    ok: true, node: "web.output.dom-extract_list", status: "succeeded", read: { extracted: [{ name: "A real apprentice" }] },
  });
  assert.deepEqual((evidence[0]!.value as { read: unknown }).read, {
    extracted: { "core.view_reference": { callId: "read-team", group: "holder:read" } },
  });
  assert.equal(decision("", evidence).kind, "complete");
});

test("a held-row reference cannot complete a read with missing or mismatched source evidence", () => {
  const success = { ok: true, node: "web.output.dom-extract_list", status: "succeeded", read: { extracted: [{ name: "A real apprentice" }] } };
  const changed = (mutate: (evidence: Record<string, any>[]) => void) => {
    const evidence = structuredClone(projectedRead(success)) as Record<string, any>[];
    mutate(evidence);
    return evidence;
  };
  const cases = [
    changed((evidence) => { evidence[0]!.value.ok = false; }),
    changed((evidence) => { evidence[0]!.value.node = "web.output.dom-capture_snapshot"; }),
    changed((evidence) => { evidence[0]!.value.status = "failed"; }),
    changed((evidence) => { delete evidence[0]!.value.read; }),
    changed((evidence) => { evidence[0]!.value.read.extracted["core.view_reference"].callId = "another-read"; }),
    changed((evidence) => { evidence[0]!.value.read.extracted["core.view_reference"].group = "top"; }),
    changed((evidence) => { evidence.at(-1)!.value.groups = evidence.at(-1)!.value.groups.filter((group: { holder?: string }) => group.holder !== "read"); }),
    changed((evidence) => { evidence.at(-1)!.value.groups.find((group: { holder?: string }) => group.holder === "read").callId = "another-read"; }),
    changed((evidence) => { evidence.at(-1)!.value.groups.find((group: { holder?: string }) => group.holder === "read").group = "holder:other"; }),
    changed((evidence) => { evidence.at(-1)!.value.groups.find((group: { holder?: string }) => group.holder === "read").holder = "other"; }),
    projectedRead({ ...success, read: { extracted: [] } }),
  ];
  for (const evidence of cases) {
    const next = decision('URL ~/team\nt70 "Megan Ashdown"', evidence);
    assert.equal(next.kind, "tool_call");
    assert.equal(next.toolId, "web.detect_repeating_structure");
  }
});
