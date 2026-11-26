// A read column written under a key that is not a legal record field key is refused naming the key, and a legal
// spelling to write instead (t1058).
//
// The case is a scripted read that wrote a column as `"group heading"`: the refusal said only
// `web.handle.malformed:extractList.fields.2`, nothing of why, and the call was sent again. Generic names only.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationExtractField } from "../../../../../actions/extraction";
import { createWebLlmExtractionHandles, type WebLlmExtractionHandleScope } from "../../../structure";
import { keptWebExtractionColumns } from "../columns";
import { webPlanSlotRefusal } from "../slot-refusal";
import { resolveWebExtractionSlot } from "../slot";

const DETECTED: Record<string, WebAutomationExtractField> = {
  div_head: { kind: "text", selector: ":scope div.head" },
  span_when: { kind: "text", selector: ":scope span.when" }
};
const HINT = "web.handle.expected.extract_list.field_key";

test("a map key with a space is refused with the invalid-key issue, the key's legal spelling, and the key hint", () => {
  assert.deepEqual(keptWebExtractionColumns({ when: "span_when", "group heading": "div_head" }, DETECTED, ["fields"]), {
    ok: false,
    issue: "web.handle.malformed",
    path: ["fields", "group heading"],
    issues: [{ code: "web.handle.field_key_invalid", valid: ["group_heading"] }],
    expected: HINT
  });
});

test("a key with only legal characters is not refused, and one that no spelling can save names no spelling", () => {
  const legal = keptWebExtractionColumns({ when: "span_when", group_heading: "div_head" }, DETECTED, ["fields"]);
  assert.equal(legal.ok, true, JSON.stringify(legal));
  const bare = keptWebExtractionColumns({ "(*)": "div_head" }, DETECTED, ["fields"]);
  assert.deepEqual(bare.ok ? undefined : bare.issues, [{ code: "web.handle.field_key_invalid" }]);
});

test("the refusal reaches the node's answer with the issue and its hint", () => {
  const scope: WebLlmExtractionHandleScope = { projectId: "project.one", flowId: "flow.one" };
  const handles = createWebLlmExtractionHandles();
  const handle = handles.reserve();
  handles.retain(scope, { handle, location: "http://127.0.0.1:4173/list/", extractList: { item: "div.row", fields: DETECTED }, itemCount: 4 });
  const slot = resolveWebExtractionSlot({ handle, fields: { "group heading": "div_head" } }, scope, handles);
  assert.equal(slot.status, "refused");
  if (slot.status !== "refused") return;
  assert.deepEqual(webPlanSlotRefusal("extractList", slot), {
    code: "web.handle.malformed", kind: "extraction", path: ["extractList", "fields", "group heading"], fits: HINT,
    issues: [{ code: "web.handle.field_key_invalid", valid: ["group_heading"] }]
  });
});
