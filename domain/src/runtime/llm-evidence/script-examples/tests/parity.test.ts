import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import {
  automationStudioEvidenceFlowBootstrapCompletionSchema,
  renderAutomationStudioFlowScriptFormat
} from "fluxiq/automation";
import { WEB_FLOW_SCRIPT_EXAMPLES } from "../index";
import { WEB_FLOW_SCRIPT_GUIDANCE } from "../../script-guidance";

// Captured from the four public pre-extraction constants, 2026-10-31.
// These pins remain unchanged when Core removes its authored web tails.
// `state` re-pinned 2026-11-05: Core's grammar gained two generic lines and nothing else,
// its part-marking guidance and its row across a call; without them it hashes to the
// captured 7451 bytes (1f691ad3d071deee2e5271e3fd74679eae754d819282273cfb40fd3c979ba2e4).
// `loop` re-pinned 2026-11-23: Core t989 (b967bf34f) replaced one generic grammar sentence, the
// one on rows a Flow reads and `recordOutput.process`, for retained source fields and declared
// automatic processing. With that sentence put back it hashes to the captured 8977 bytes
// (206bc7dbe82a408c8a1891bb4a8174cef3e4df50a6525fc761d893dd3f99b817); the web examples are unchanged.
// `format` re-pinned 2026-11-25: Core t1037 (no look command) changed one generic grammar sentence, "the tools you
// were given while gathering evidence are for looking" to "... for reading the page". With "looking" put back it
// hashes to the 6154 bytes pinned before (71df264a2c345227a15f9bf5955ed35169619552210336e664f86b06e005ec67); the web
// examples are unchanged. The completion schema's digest below was re-pinned in the same change, for t1037's
// generic Core wording in the schema it renders (no look command, the draft the framework writes).
const pins = {
  format: { bytes: 6159, sha256: "8dd35ae3e6501e3f2a46bca8d5fa78918a1ec93e1d10fc16083cd9bb652ff2ad" },
  act: { bytes: 3916, sha256: "2290b5399c44fb4100400e88cd40394fe800258eb0484eef2438ef6250626697" },
  loop: { bytes: 9227, sha256: "d478e9807d3cf87298d30399270a15fb8219283cd7e42a6187c2c38e400c58f2" },
  state: { bytes: 8240, sha256: "634576a2df3eb868a292a4a92b5564864a0f469a75ddd704a78f9aad39fde51b" }
};

for (const section of ["format", "act", "loop", "state"] as const) {
  test(`${section}: explicit web examples reconstruct the pinned original UTF8 bytes`, () => {
    const tail = WEB_FLOW_SCRIPT_EXAMPLES[section];
    assert.ok(tail?.length);
    const rendered = renderAutomationStudioFlowScriptFormat(WEB_FLOW_SCRIPT_EXAMPLES, WEB_FLOW_SCRIPT_GUIDANCE)[section];
    assert.equal(Buffer.byteLength(rendered, "utf8"), pins[section].bytes);
    assert.equal(createHash("sha256").update(rendered, "utf8").digest("hex"), pins[section].sha256);
  });
}

test("explicit web examples preserve the entire original completion schema digest", () => {
  const schema = automationStudioEvidenceFlowBootstrapCompletionSchema(undefined, WEB_FLOW_SCRIPT_EXAMPLES, WEB_FLOW_SCRIPT_GUIDANCE);
  assert.equal(createHash("sha256").update(JSON.stringify(schema), "utf8").digest("hex"), "4f2fce81542b16102c17746384eb9f770400d863c594177a347c3d81fbc8a2b1");
});
