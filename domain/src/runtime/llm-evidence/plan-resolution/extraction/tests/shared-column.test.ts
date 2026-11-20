// A read field bound to the very column another field of the same read reads is
// refused when the read is written, naming both fields, unless the field says
// `sameAs` the other (t975, F23).
//
// The case is run `run-mwounh32-24f9bc6b` (social-network-feed,
// delete-stranger-requests), decide 0127: the read of the friend requests kept
// `mutuals` under the name column's key, so the read the task's "zero mutual
// friends" was judged by held each person's name twice and no mutual-friend
// count. The detected columns and the binding below are that call's, as
// recorded; the mutual-friend count was the `div_x1a4yqcp` column.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../../../structure";
import { keptWebExtractionColumns } from "../columns";
import { webPlanSlotRefusal } from "../slot-refusal";
import { resolveWebExtractionSlot } from "../slot";

const NAME = "div_x0531l50_x1r2vv8_x4q0id2_a_x0ybvghy_x130pqy_x1yfagd";
const URL_COLUMN = "a_x1cf2e2r_xu37y6r_xvzo2ll_url";
const MUTUALS = "div_x0531l50_x1r2vv8_x4q0id2_div_x1a4yqcp_xa73opb_xtlve1b";

/** The friend-request list's detected columns, as run 22 recorded them. */
const DETECTED: Record<string, WebAutomationExtractField> = {
  [URL_COLUMN]: { kind: "link", selector: ":scope a.x1cf2e2r.xu37y6r.xvzo2ll", required: true },
  [NAME]: { kind: "text", selector: ":scope a.x0ybvghy.x130pqy.x1yfagd", required: true },
  [`${NAME}_url`]: { kind: "link", selector: ":scope a.x0ybvghy.x130pqy.x1yfagd", required: true },
  [MUTUALS]: { kind: "text", selector: ":scope div.x1a4yqcp.xa73opb.xtlve1b", required: true },
  div_x0531l50_x1r2vv8_x4q0id2_span_x0gwrdxv_x1ksheh_x4q0id2: { kind: "text", selector: ":scope span.x0gwrdxv.x1ksheh.x4q0id2", required: true },
  div_x0531l50_x1r2vv8_x4q0id2_div_x1papwzz_xu37y6r_xvzo2ll: { kind: "text", selector: ":scope div.x1papwzz.xu37y6r.xvzo2ll", required: false },
  div_x0531l50_x1r2vv8_x4q0id2_div_x1507i5_x1mgzeci_xu37y6r: { kind: "text", selector: ":scope div.x1507i5.x1mgzeci.xu37y6r", required: false },
  div_x0531l50_x1r2vv8_x4q0id2_div_x07beeli_x1ksheh_x4q0id2: { kind: "text", selector: ":scope div.x07beeli.x1ksheh.x4q0id2", required: false }
};

/** Decide 0127's `fields`, as the model wrote them. */
const RECORDED = { name: NAME, url: URL_COLUMN, mutuals: NAME };

/** The columns no field of the recorded read reads: where the meant one is. */
const UNREAD = Object.keys(DETECTED).filter((key) => key !== NAME && key !== URL_COLUMN);

const SHARED = { code: `web.handle.shared_column.with.name`, field: "mutuals", valid: UNREAD };

test("run 22's read, mutuals bound to the name column, is refused at mutuals, naming name and the columns no field reads", () => {
  assert.deepEqual(keptWebExtractionColumns(RECORDED, DETECTED, ["fields"]), {
    ok: false,
    issue: "web.handle.malformed",
    path: ["fields", "mutuals"],
    issues: [SHARED],
    expected: "web.handle.expected.extract_list.same_as"
  });
  // The read the run meant resolves: the mutual-friend count is its own column.
  const meant = keptWebExtractionColumns({ name: NAME, url: URL_COLUMN, mutuals: MUTUALS }, DETECTED, ["fields"]);
  assert.equal(meant.ok, true, JSON.stringify(meant));
});

test("the refusal reaches the node's answer with its shape hint and its issue", () => {
  const scope: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };
  const handles = createWebLlmExtractionHandles();
  const handle = handles.reserve();
  handles.retain(scope, { handle, location: "http://127.0.0.1:4173/friends/requests/", extractList: { item: "div.request", fields: DETECTED }, itemCount: 8 });
  const slot = resolveWebExtractionSlot({ handle, fields: RECORDED }, scope, handles);
  assert.deepEqual(slot, { status: "refused", issue: "web.handle.malformed", path: ["fields", "mutuals"], expected: "web.handle.expected.extract_list.same_as", issues: [SHARED] });
  if (slot.status === "refused") {
    assert.deepEqual(webPlanSlotRefusal("extractList", slot), {
      code: "web.handle.malformed", kind: "extraction", path: ["extractList", "fields", "mutuals"], fits: "web.handle.expected.extract_list.same_as", issues: [SHARED]
    });
  }
});

test("a field that says sameAs the field it shares with is kept, and one naming any other field is refused at sameAs", () => {
  const same = keptWebExtractionColumns({ name: NAME, url: URL_COLUMN, label: { column: NAME, sameAs: "name" } }, DETECTED, ["fields"]);
  assert.equal(same.ok, true, JSON.stringify(same));
  if (same.ok) assert.deepEqual(same.fields.label, same.fields.name);
  assert.deepEqual(keptWebExtractionColumns({ name: NAME, url: URL_COLUMN, label: { column: NAME, sameAs: "url" } }, DETECTED, ["fields"]), {
    ok: false, issue: "web.handle.malformed", path: ["fields", "label", "sameAs"]
  });
});

test("one element read two ways -- its text and its link -- is two values, and is not refused", () => {
  const read = keptWebExtractionColumns({ name: NAME, profile: `${NAME}@href`, link: `${NAME}_url` }, DETECTED, ["fields"]);
  assert.equal(read.ok, true, JSON.stringify(read));
});
