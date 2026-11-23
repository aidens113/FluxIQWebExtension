// The offline read proof's model-visible projection is the production read
// writer itself: a reproduced read's raw rows go through it unchanged, and the
// raw payload it was given is never rewritten. Synthetic values only.

import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { webOfflineReadModelResult } from "../model-result";

const rawLink = "http://127.0.0.1:4100/scenarios/everything-store/item?x=1#detail";

function frozenPayload(): JsonObject {
  const row = Object.freeze({ title: "Fixture", link: rawLink, external: "https://external.invalid/item", note: null });
  return Object.freeze({ url: "http://127.0.0.1:4100/scenarios/everything-store/list", extracted: Object.freeze([row]) }) as unknown as JsonObject;
}

test("a read is projected as the model is shown it: same-origin links from the stated origin", () => {
  const result = webOfflineReadModelResult(frozenPayload(), {});
  assert.ok(result !== undefined && result !== null && typeof result === "object" && !Array.isArray(result));
  assert.equal(result.origin, "http://127.0.0.1:4100");
  assert.deepEqual(result.extracted, [{ title: "Fixture", link: "/scenarios/everything-store/item?x=1#detail", external: "https://external.invalid/item", note: null }]);
});

test("the raw payload keeps its absolute links after projection", () => {
  const payload = frozenPayload();
  webOfflineReadModelResult(payload, {});
  const rows = payload.extracted as JsonObject[];
  assert.equal(rows[0]?.link, rawLink);
});

test("no payload projects to no read", () => {
  assert.equal(webOfflineReadModelResult(undefined, {}), undefined);
});
