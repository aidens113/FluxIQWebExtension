// Which events become steps, and in which words: Core's internal reads never
// show, decisions and page actions do, every row reads in words rather than
// ids, and a unit of work whose opening the relay no longer holds is known to
// be partial, so nobody counts its steps.

import assert from "node:assert/strict";
import test from "node:test";
import { ACTIVITY_RECENT_LIMIT, type ClientGatewayActivity } from "../../../../shared/activity/index";
import { activityEvent } from "../../tests/activity-fixture";
import { activityRows } from "../activity-rows";

type Detail = NonNullable<ClientGatewayActivity["detail"]>;

const decide = (sequence: number) => activityEvent(sequence, { phase: "thinking", detail: { kind: "thought", title: "Deciding the next step", status: "started" } });
const tool = (sequence: number, ref: string, status: Detail["status"], text?: string) =>
  activityEvent(sequence, { phase: "exploring", detail: { kind: "tool", title: `Using ${ref}`, ref, ...(status === undefined ? {} : { status }), ...(text === undefined ? {} : { text }) } });
const buildStarted = (sequence: number) => activityEvent(sequence, { detail: { kind: "step", title: "Build started", status: "started" } });

function titles(recent: ClientGatewayActivity[], limit = 120): string[] {
  return activityRows(recent, limit).rows.map((row) => row.title);
}

test("internal reads are not steps: state digests, the answer check and Core's own bookkeeping tools", () => {
  const recent = [
    buildStarted(1),
    tool(2, "core.state_digest", "started"),
    tool(3, "core.state_digest", "succeeded"),
    activityEvent(4, { detail: { kind: "tool", title: "Capturing a state digest", ref: "web.dom.capture_snapshot", status: "succeeded" } }),
    tool(5, "core.evidence_history", "succeeded"),
    tool(6, "core.request_check", "succeeded"),
    activityEvent(7, { detail: { kind: "check", title: "Answer check before repeating a look", status: "succeeded" } }),
    decide(8),
    tool(9, "core.run_node", "started"),
    tool(10, "core.run_node", "succeeded", "Result: web.click.succeeded")
  ];
  assert.deepEqual(titles(recent), ["Started building", "Decided the next step", "Clicked on the page"]);
});

test("each decision is its own row, done once anything after it happened", () => {
  const { rows } = activityRows([decide(1), tool(2, "web.inspect_current_page", "succeeded"), decide(3), decide(4)], 120);
  assert.deepEqual(rows.map((row) => [row.title, row.status]), [
    ["Decided the next step", "succeeded"],
    ["Looked at the page", "succeeded"],
    ["Decided the next step", "succeeded"],
    ["Deciding the next step", "started"]
  ]);
});

test("rows read in words, never as tool ids or result codes", () => {
  const recent = [
    tool(1, "core.run_node", "started"),
    tool(2, "core.run_node", "succeeded", "Result: web.inspect.succeeded"),
    tool(3, "core.run_node", "failed", "Result: web.navigate.target_not_found"),
    tool(4, "core.flow_draft", "succeeded"),
    tool(5, "acme.frobnicate", "succeeded"),
    activityEvent(6, { phase: "running", step: { index: 2, count: 4, nodeId: "node-7", label: "Open results" }, detail: { kind: "step", title: "Open results", ref: "node-7", status: "started" } }),
    activityEvent(7, { phase: "running", step: { index: 3, count: 4, nodeId: "node-8" }, detail: { kind: "step", title: "node-8", ref: "node-8", status: "started" } }),
    activityEvent(8, { phase: "verifying", detail: { kind: "check", title: "Completion check", status: "failed", text: "flow_bootstrap.missing_output, output.empty" } })
  ];
  const { rows } = activityRows(recent, 120);
  assert.deepEqual(rows.map((row) => row.title), [
    "Looked at the page",
    "Opened a page",
    "Updated the draft automation",
    "Used a tool",
    "Step 2: Open results",
    "Step 3",
    "The result didn't pass its check"
  ]);
  for (const row of rows) {
    assert.doesNotMatch(`${row.title} ${row.text ?? ""}`, /core\.|web\.|acme\.|node-\d|_/u, row.title);
  }
  const started = activityRows([tool(1, "core.run_node", "started")], 120).rows[0]!;
  assert.equal(started.title, "Working on the page", "under way, in the present");
});

test("a unit of work is partial when its opening may be gone, and whole while its opening row is here", () => {
  const long = [buildStarted(1), ...Array.from({ length: ACTIVITY_RECENT_LIMIT - 1 }, (_, index) => decide(index + 2))];
  assert.equal(activityRows(long, 120).partial.size, 0, "a full window that still holds Build started is whole");
  const slid = long.slice(1).concat(decide(ACTIVITY_RECENT_LIMIT + 1));
  assert.deepEqual([...activityRows(slid, 120).partial], ["build-1"], "the window is full and its oldest event is this build's");
  assert.deepEqual([...activityRows(long, 10).partial], ["build-1"], "rows cut by the chat's own limit");
  const run = (sequence: number, index: number) => activityEvent(sequence, {
    activityId: "run-1",
    phase: "running",
    step: { index, count: 5, nodeId: `n${index}` },
    detail: { kind: "step", title: `Open part ${index}`, status: "started" }
  });
  assert.deepEqual([...activityRows([run(1, 3), run(2, 4)], 120).partial], ["run-1"], "a run first seen at step 3");
  assert.equal(activityRows([run(1, 1), run(2, 2)], 120).partial.size, 0);
  assert.equal(activityRows([decide(1), decide(2)], 120).partial.size, 0, "a short window with nothing cut is whole");
});
