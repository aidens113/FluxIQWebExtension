// A list whose section links to more says so (t195 w22e). Circleway's Friends
// home shows four of eight friend requests under a header whose "See all"
// opens the rest; the top bar's badge says 4, and live run 36 read the four
// cards as the whole list (`run-muq3uozx-3153564b`, cause 11).
//
// What these rows prove, on a detection answer written from
// `renderFriendsHome`'s markup: the packet carries the page's `continues` with
// its label, its path and one closed sentence saying what the link means; the
// handle's binding never follows it; and a detection without one shows none.

import assert from "node:assert/strict";
import test from "node:test";
import type { WebAutomationStructureDetection } from "../../../../extraction";
import { splitDetectedStructure } from "../packet";

type Detected = Extract<WebAutomationStructureDetection, { ok: true }>;

/** The four request cards of the Friends home, as the page proposes them, with the section's link to more when given. */
function friendRequests(continues?: Detected["continues"]): Detected {
  return {
    ok: true,
    continues,
    proposal: {
      container: "div.x1center > div.x1grid:nth-of-type(2)",
      item: "div.x1center > div.x1grid:nth-of-type(2) > div.x1card",
      itemCount: 4,
      fields: [
        { key: "name", label: "a.x1name", spec: { kind: "text", selector: ":scope a.x1name", required: true }, coverage: 1 },
        { key: "mutual", label: "div.x1mutual", spec: { kind: "text", selector: ":scope div.x1mutual", required: false }, coverage: 1 }
      ],
      confidence: 0.6
    }
  };
}

function split(detection: Detected) {
  const result = splitDetectedStructure({
    detection,
    handle: "extraction.1",
    recordHandle: undefined,
    location: "http://circleway.test/circleway/friends/",
    target: undefined,
    frameId: undefined,
    frameUrlPath: undefined
  });
  assert.ok(result, "the run has readable fields");
  return result;
}

test("a run whose section links to more is shown with the link and the sentence saying the list may be partial", () => {
  const { packet, binding } = split(friendRequests({ label: "See all", path: "/circleway/friends/requests/" }));
  assert.deepEqual(packet.continues, {
    label: "See all",
    path: "/circleway/friends/requests/",
    note: 'this section links to more items ("See all"); the list here may be partial -- open it to read every item'
  });
  assert.equal(packet.pagination, "none", "the link is a hint, not the list's pagination");
  assert.equal(binding.extractList.paginate, undefined, "the read never follows it by itself");
  assert.equal(JSON.stringify(binding).includes("/circleway/friends/requests/"), false);
});

test("a button carries its label without a path, and a run with no such link shows none", () => {
  assert.deepEqual(split(friendRequests({ label: "Show more" })).packet.continues, {
    label: "Show more",
    note: 'this section links to more items ("Show more"); the list here may be partial -- open it to read every item'
  });
  assert.equal("continues" in split(friendRequests()).packet, false);
});
