import assert from "node:assert/strict";
import test from "node:test";

import { scrollElementIntoView } from "../scroll-element-into-view";

// t774, round 6 (`run-mvrj7qg8-c20c132e`, 00039 and 00056): the scenario page was left scrolled sideways, its left
// navigation cut off and its right rail drawn over the feed. Centring a target both ways scrolled the page across for
// any target near a side; a target is brought to the middle of the viewport vertically, and across only as far as it must.
test("brings a target to the vertical centre and across only as far as it must", () => {
  const seen: unknown[] = [];
  scrollElementIntoView({ scrollIntoView: (options: unknown) => { seen.push(options); } } as unknown as Element);
  assert.deepEqual(seen, [{ block: "center", inline: "nearest", behavior: "instant" }]);
});
