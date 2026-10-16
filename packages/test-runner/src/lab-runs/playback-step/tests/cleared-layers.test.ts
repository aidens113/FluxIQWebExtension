import assert from "node:assert/strict";
import test from "node:test";
import { playbackClearedLayers } from "../index.js";

test("layers at the dispatch payload's top or in the client's payload are kept as kind and word, under Core's bound", () => {
  assert.deepEqual(playbackClearedLayers({ clearedLayers: [{ kind: "promotion", control: " No\n thanks ", name: "Save 10%", wayOut: "way.1" }] }),
    { layers: [{ kind: "promotion", control: "No thanks" }], said: `cleared 1 layer: promotion "No thanks"` });
  assert.deepEqual(playbackClearedLayers({ result: { clearedLayers: [{ kind: "rate_limit", control: "OK" }, { kind: "dialog", control: "Close" }] } })?.said, `cleared 2 layers: rate_limit "OK", dialog "Close"`);
  const many = Array.from({ length: 20 }, () => ({ kind: "dialog", control: "Close" }));
  assert.equal(playbackClearedLayers({ clearedLayers: many })?.layers.length, 12);
});

test("no layers, or only ones outside Core's kinds and bound, is none", () => {
  for (const outcome of [undefined, {}, { clearedLayers: [] }, { clearedLayers: "dialog" }, { clearedLayers: [{ kind: "newer", control: "Close" }, { kind: "dialog", control: "x".repeat(41) }, { kind: "dialog", control: "   " }, null] }]) {
    assert.equal(playbackClearedLayers(outcome as Record<string, unknown> | undefined), undefined, JSON.stringify(outcome));
  }
});
