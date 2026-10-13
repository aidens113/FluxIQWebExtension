// A name inside a read's `fields` that names none of its columns is refused
// with the name and the read's columns, as a condition's is (t497, t502).
//
// The case is lane D round 16 (`run-mv6i2akr-516b2f03`, D1): a key built by
// hand from the page *after* an act, on a read whose detection was taken before
// it, was refused `web.handle.unknown_field` with no `field` or `valid`, and
// Core told the model the list's handle was right. The detection was what was
// out of date; a fresh one was the fix. Generic names only.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../../../structure";
import { keptWebExtractionColumns } from "../columns";
import { webPlanSlotRefusal } from "../slot-refusal";
import { resolveWebExtractionSlot } from "../slot";

const HEADING = "li_xq7m2n4_h3_xb5c8d1";
const BUTTON = "li_xq7m2n4_div_xr3t6y9_xg2h5j8";
const PRICE = "li_xq7m2n4_span_xp4l7k0";
/** A column the same card shows only after an act, which this detection never saw. */
const AFTER = "li_xq7m2n4_div_xs9w1e4_xg2h5j8";

const ROW: Record<string, WebAutomationExtractField> = {
  [HEADING]: { kind: "text", selector: "li.xq7m2n4 > h3.xb5c8d1" },
  [BUTTON]: { kind: "text", selector: "li.xq7m2n4 > div.xr3t6y9.xg2h5j8" },
  [PRICE]: { kind: "text", selector: "li.xq7m2n4 > span.xp4l7k0" }
};

const COLUMNS_CHANGED = "web.handle.columns_changed";

test("a field naming no column is refused at its entry, naming it and the read's columns", () => {
  assert.deepEqual(keptWebExtractionColumns({ heading: HEADING, colour: "zebra" }, ROW, ["fields"]), {
    ok: false,
    issue: "web.handle.unknown_field",
    path: ["fields", "colour"],
    issues: [{ code: "web.handle.unknown_field", field: "zebra", valid: [HEADING, BUTTON, PRICE] }]
  });
  // The array form, an object naming its column, and a header name say the same.
  assert.deepEqual(keptWebExtractionColumns([HEADING, "zebra"], ROW, ["fields"]), {
    ok: false,
    issue: "web.handle.unknown_field",
    path: ["fields", 1],
    issues: [{ code: "web.handle.unknown_field", field: "zebra", valid: [HEADING, BUTTON, PRICE] }]
  });
  assert.deepEqual(keptWebExtractionColumns({ colour: { key: "zebra@href" } }, ROW, ["fields"]), {
    ok: false,
    issue: "web.handle.unknown_field",
    path: ["fields", "colour"],
    issues: [{ code: "web.handle.unknown_field", field: "zebra", valid: [HEADING, BUTTON, PRICE] }]
  });
});

test("a field naming a sibling of a column the detection has says the items changed since the detection", () => {
  // Same card, one part swapped: a column of these items that this detection did not find.
  assert.deepEqual(keptWebExtractionColumns({ heading: HEADING, status: AFTER }, ROW, ["fields"]), {
    ok: false,
    issue: "web.handle.unknown_field",
    path: ["fields", "status"],
    issues: [
      { code: "web.handle.unknown_field", field: AFTER, valid: [HEADING, BUTTON, PRICE] },
      { code: COLUMNS_CHANGED, field: AFTER }
    ]
  });
});

test("the slot's refusal and the plan's refusal carry the fields issues", () => {
  const scope: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };
  const handles = createWebLlmExtractionHandles();
  const handle = handles.reserve();
  handles.retain(scope, { handle, location: "http://127.0.0.1:4173/rows/", extractList: { item: "li.xq7m2n4", fields: ROW }, itemCount: 5 });
  const slot = resolveWebExtractionSlot({ handle, fields: [HEADING, PRICE, AFTER] }, scope, handles);
  const issues = [
    { code: "web.handle.unknown_field", field: AFTER, valid: [HEADING, BUTTON, PRICE] },
    { code: COLUMNS_CHANGED, field: AFTER }
  ];
  assert.deepEqual(slot, { status: "refused", issue: "web.handle.unknown_field", path: ["fields", 2], issues });
  assert.equal(slot.status, "refused");
  if (slot.status === "refused") {
    assert.deepEqual(webPlanSlotRefusal("extractList", slot), { code: "web.handle.unknown_field", kind: "extraction", path: ["extractList", "fields", 2], issues });
  }
});
