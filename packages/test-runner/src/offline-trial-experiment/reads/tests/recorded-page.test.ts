// Which page a recorded read read: the primary snapshot its result's trace
// references name, by address path and digest. Anything else is not the page.

import assert from "node:assert/strict";
import test from "node:test";
import { recordedPage } from "../recorded-page.js";

const primary = { role: "primary", sha256: "f".repeat(64), mediaType: "text/html", source: "http://127.0.0.1:4100/scenarios/job-board/jobs?q=x#top" };

test("the primary reference names the page by path and digest", () => {
  const result = { status: "succeeded", metadata: { trace: { artifacts: [{ role: "resource", sha256: "a".repeat(64), mediaType: "text/css", source: "http://127.0.0.1:4100/s.css" }, primary], unavailable: 0 } } };
  assert.deepEqual(recordedPage(result), { urlPath: "/scenarios/job-board/jobs", snapshot: "f".repeat(64) });
});

test("no references, two primaries or a primary with no address name no page, or no path", () => {
  assert.deepEqual(recordedPage({ status: "succeeded" }), { urlPath: null, snapshot: null });
  assert.deepEqual(recordedPage(null), { urlPath: null, snapshot: null });
  assert.deepEqual(recordedPage({ metadata: { trace: { artifacts: [primary, primary] } } }), { urlPath: null, snapshot: null });
  assert.deepEqual(recordedPage({ metadata: { trace: { artifacts: [{ ...primary, source: undefined }] } } }), { urlPath: null, snapshot: "f".repeat(64) });
  assert.deepEqual(recordedPage({ metadata: { trace: { artifacts: [{ ...primary, source: "not a url" }] } } }), { urlPath: null, snapshot: "f".repeat(64) });
});
