import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  automationStudioEvidenceFlowBootstrapCompletionSchema,
  renderAutomationStudioFlowScriptFormat
} from "fluxiq/automation-studio";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";

// Captured from the four public pre-extraction constants, 2026-10-31.
// These pins remain unchanged when Core removes its authored web tails.
const pins = {
  format: { bytes: 6154, sha256: "71df264a2c345227a15f9bf5955ed35169619552210336e664f86b06e005ec67" },
  act: { bytes: 3916, sha256: "2290b5399c44fb4100400e88cd40394fe800258eb0484eef2438ef6250626697" },
  loop: { bytes: 8808, sha256: "6713cc27611efe0e4b941492cfbf3b82c95ad43a01851e53c8f85503f20323bd" },
  state: { bytes: 7451, sha256: "1f691ad3d071deee2e5271e3fd74679eae754d819282273cfb40fd3c979ba2e4" }
};

for (const section of ["format", "act", "loop", "state"] as const) {
  test(`${section}: explicit web examples reconstruct the pinned original UTF8 bytes`, () => {
    const tail = WEB_FLOW_SCRIPT_EXAMPLES[section];
    assert.ok(tail?.length);
    const rendered = renderAutomationStudioFlowScriptFormat(WEB_FLOW_SCRIPT_EXAMPLES)[section];
    assert.equal(Buffer.byteLength(rendered, "utf8"), pins[section].bytes);
    assert.equal(createHash("sha256").update(rendered, "utf8").digest("hex"), pins[section].sha256);
  });
}

test("explicit web examples preserve the entire original completion schema digest", () => {
  const schema = automationStudioEvidenceFlowBootstrapCompletionSchema(undefined, WEB_FLOW_SCRIPT_EXAMPLES);
  assert.equal(createHash("sha256").update(JSON.stringify(schema), "utf8").digest("hex"), "02c766712576f5d8a7bf6cf539e951644b0fa8b3a3978293fadeb3e8cc529147");
});
