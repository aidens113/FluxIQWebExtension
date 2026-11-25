// A detection declares, per list it issued a handle for, the list's key as a read of it carries one and whether the
// list shows a way to another page (t1032). Run-mwv5m906-5e999159's detection said `pagination: "none"`, and Core's
// result header said the read's paging was not yet checked, because nothing tied the packet's words to the read.
// A garden centre's plant list, made up; no scenario's site.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationStructureDetection } from "../../../../extraction";
import { webAutomationExtractListAnswered } from "../../../../output-nodes";
import { splitDetectedStructure } from "../packet";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

function plants(pagination?: Detected["proposal"]["pagination"]): Detected {
  const proposal: Detected["proposal"] = {
    container: "main > ul.plants",
    item: "main > ul.plants > li.plant",
    itemCount: 6,
    fields: [
      { key: "name", label: "h3.name", spec: { kind: "text", selector: ":scope h3.name", required: true }, coverage: 1 },
      { key: "height", label: "span.height", spec: { kind: "text", selector: ":scope span.height", required: false }, coverage: 1 }
    ],
    confidence: 0.7
  };
  if (pagination !== undefined) proposal.pagination = pagination;
  return { ok: true, proposal };
}

function split(detection: Detected) {
  const result = splitDetectedStructure({ detection, handle: "extraction.1", recordHandle: undefined, location: "https://garden.example/plants", target: undefined, frameId: undefined, frameUrlPath: undefined, firstItem: undefined });
  assert.ok(result, "the run has readable fields");
  return result;
}

/** The key a read of the binding's list carries, as the read node stamps it on its answer. */
function readKey(item: string): unknown {
  return (webAutomationExtractListAnswered({ extractList: { item } }, { extracted: [] }) as { listKey?: unknown }).listKey;
}

test("a list with no pager is declared to show none, under the key a read of it carries", () => {
  const { packet, binding } = split(plants());
  assert.equal(packet.pagination, "none");
  assert.deepEqual(packet.listPaging, [{ listKey: readKey(binding.extractList.item), pages: false }]);
});

test("a list with a pager is declared to show one", () => {
  const { packet, binding } = split(plants({ next: "a.next", maxPages: 5 }));
  assert.notEqual(packet.pagination, "none");
  assert.deepEqual(packet.listPaging, [{ listKey: readKey(binding.extractList.item), pages: true }]);
});
