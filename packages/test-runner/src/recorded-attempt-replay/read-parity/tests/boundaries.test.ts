import assert from "node:assert/strict";
import test from "node:test";
import type { JsonObject } from "fluxiq/core";
import { compareRecordedReadBoundaries } from "../boundaries.js";

const url = "http://127.0.0.1:4100/scenarios/everything-store/list";
const original: JsonObject = { url, extracted: [{ title: "Fixture", link: "http://127.0.0.1:4100/scenarios/everything-store/item?x=1#detail", note: null }] };
const canonical = { origin: "http://127.0.0.1:4100", extracted: [{ title: "Fixture", link: "/scenarios/everything-store/item?x=1#detail", note: null }] };
const schema = { schemaVersion: "0.1", fields: ["title", "link", "note"].map(id => ({ id, label: id, valueType: "string", required: false })) };
const check = (actualPayload = structuredClone(original), canonicalRead: unknown = structuredClone(canonical)) => compareRecordedReadBoundaries({ actualPayload, originalPayload: original, canonicalRead, parameters: {}, recordedUrl: url, currentDerivedSchema: schema });

test("raw native and model-visible rows each match their authentic original boundary", () => {
  const comparison = check();
  assert.equal(comparison.rawNativeRowsMatch, true);
  assert.equal(comparison.modelProjectedRowsMatch, true);
  assert.equal(comparison.projectionContextMatches, true);
  assert.equal(comparison.boundariesPassed, true);
  assert.notDeepEqual(original.extracted, canonical.extracted);
});

test("a raw link change is refused even when production projection still matches canonical rows", () => {
  const changed = { url: "http://127.0.0.1:4200/scenarios/everything-store/list", extracted: [{ title: "Fixture", link: "http://127.0.0.1:4200/scenarios/everything-store/item?x=1#detail", note: null }] };
  const comparison = check(changed);
  assert.equal(comparison.rawNativeRowsMatch, false);
  assert.equal(comparison.modelProjectedRowsMatch, true);
  assert.equal(comparison.projectionContextMatches, false);
  assert.equal(comparison.boundariesPassed, false);
});

test("changed canonical cells or origin never pass merely because raw native rows match", () => {
  const changedCell = check(structuredClone(original), { ...canonical, extracted: [{ ...canonical.extracted[0], title: "Changed" }] });
  assert.equal(changedCell.rawNativeRowsMatch, true);
  assert.equal(changedCell.modelProjectedRowsMatch, false);
  assert.equal(changedCell.boundariesPassed, false);
  const changedOrigin = check(structuredClone(original), { ...canonical, origin: "http://127.0.0.1:4200" });
  assert.equal(changedOrigin.rawNativeRowsMatch, true);
  assert.equal(changedOrigin.modelProjectedRowsMatch, true);
  assert.equal(changedOrigin.projectionContextMatches, false);
  assert.equal(changedOrigin.boundariesPassed, false);
});

test("missing context remains unavailable and schema validity cannot replace either equality", () => {
  const noContext = check(structuredClone(original), { extracted: canonical.extracted });
  assert.equal(noContext.projectionContextMatches, null);
  assert.equal(noContext.boundariesPassed, false);
  const changedRaw = check({ ...original, extracted: [{ ...canonical.extracted[0], title: "Changed" }] });
  assert.equal(changedRaw.rawComparison.currentSchema, "valid");
  assert.equal(changedRaw.rawNativeRowsMatch, false);
  assert.equal(changedRaw.boundariesPassed, false);
  const noSchema = compareRecordedReadBoundaries({ actualPayload: original, originalPayload: original, canonicalRead: canonical, parameters: {}, recordedUrl: url });
  assert.equal(noSchema.rawNativeRowsMatch, true);
  assert.equal(noSchema.modelProjectedRowsMatch, true);
  assert.equal(noSchema.boundariesPassed, false);
});

test("a link-free read states no origin on either side and still checks its address; one side's origin alone fails", () => {
  const plain = { url, extracted: [{ title: "Fixture", note: null }] };
  const plainCanonical = { extracted: [{ title: "Fixture", note: null }] };
  const plainSchema = { schemaVersion: "0.1", fields: ["title", "note"].map(id => ({ id, label: id, valueType: "string", required: false })) };
  const compare = (actualPayload: JsonObject, canonicalRead: unknown) => compareRecordedReadBoundaries({ actualPayload, originalPayload: plain, canonicalRead, parameters: {}, recordedUrl: url, currentDerivedSchema: plainSchema });
  const same = compare(structuredClone(plain), structuredClone(plainCanonical));
  assert.equal(same.projectionContextMatches, true);
  assert.equal(same.boundariesPassed, true);
  assert.equal(compare(structuredClone(plain), { ...plainCanonical, origin: "http://127.0.0.1:4100" }).projectionContextMatches, false);
  assert.equal(compare({ ...structuredClone(plain), url: "http://127.0.0.1:4100/scenarios/everything-store/other" }, structuredClone(plainCanonical)).projectionContextMatches, false);
});
