// Carrying a capture's resources: in document order, as base64 of the bytes
// fetched or of a frame document's UTF-8, each bound respected, and every
// resource left out counted rather than dropped silently.

import assert from "node:assert/strict";
import test from "node:test";
import { carryResources } from "../carry-resources";
import type { FetchedResource, ResourceFetcher, TraceCaptureBounds, TraceResourceReference } from "../types";

const BOUNDS: TraceCaptureBounds = { resourceBytes: 100, totalResourceBytes: 250, fetchTimeoutMs: 1_000, captureDeadlineMs: 5_000, fetchConcurrency: 3 };

const fetchOf = (source: string): TraceResourceReference => ({ kind: "fetch", source });
const base64 = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString("base64");

/** A fetcher answering each address from `answers`, as `fetchResourceBytes` would. */
function fetcher(answers: Record<string, FetchedResource>, seen: Array<{ address: string; maxBytes: number; timeoutMs: number }> = []): ResourceFetcher {
  return async (address, limits) => {
    seen.push({ address, ...limits });
    await new Promise((resolve) => setTimeout(resolve, 1));
    return answers[address] ?? { carried: false, why: "failed" };
  };
}

const bytes = (length: number, fill = 7): Uint8Array => new Uint8Array(length).fill(fill);

test("resources come back in document order, as base64 of their bytes or of a frame's UTF-8", async () => {
  const frame: TraceResourceReference = { kind: "inline", source: "https://shop.test/frame", mediaType: "text/html; charset=utf-8", text: "<p>café</p>" };
  const result = await carryResources([fetchOf("https://shop.test/a.png"), frame, fetchOf("https://shop.test/b.css")], BOUNDS, fetcher({
    "https://shop.test/a.png": { carried: true, mediaType: "image/png", bytes: bytes(10, 1) },
    "https://shop.test/b.css": { carried: true, mediaType: "text/css; charset=utf-8", bytes: new TextEncoder().encode("a{}") }
  }));
  assert.deepEqual(result, {
    resources: [
      { source: "https://shop.test/a.png", mediaType: "image/png", base64: base64(bytes(10, 1)) },
      { source: "https://shop.test/frame", mediaType: "text/html; charset=utf-8", base64: base64("<p>café</p>") },
      { source: "https://shop.test/b.css", mediaType: "text/css; charset=utf-8", base64: base64("a{}") }
    ],
    unavailable: 0
  });
});

test("a failed fetch, one past the per-resource bound and one past the total are each counted, not carried", async () => {
  const seen: Array<{ address: string; maxBytes: number; timeoutMs: number }> = [];
  const result = await carryResources(
    ["one", "two", "three", "four", "five"].map((name) => fetchOf(`https://shop.test/${name}`)),
    { ...BOUNDS, fetchConcurrency: 1 },
    fetcher({
      "https://shop.test/one": { carried: true, mediaType: "image/jpeg", bytes: bytes(100) },
      "https://shop.test/two": { carried: false, why: "status" },
      "https://shop.test/three": { carried: true, mediaType: "image/jpeg", bytes: bytes(101) },
      "https://shop.test/four": { carried: true, mediaType: "image/jpeg", bytes: bytes(100) },
      "https://shop.test/five": { carried: true, mediaType: "image/jpeg", bytes: bytes(60) }
    }, seen)
  );
  assert.deepEqual(result.resources.map((resource) => resource.source), ["https://shop.test/one", "https://shop.test/four"]);
  assert.equal(result.unavailable, 3);
  // Each fetch is told how much room is left: the per-resource bound, then what the total still allows.
  assert.deepEqual(seen.map((entry) => entry.maxBytes), [100, 100, 100, 100, 50]);
  assert.ok(seen.every((entry) => entry.timeoutMs <= BOUNDS.fetchTimeoutMs));
});

test("a frame document past a bound is counted like any resource", async () => {
  const frame: TraceResourceReference = { kind: "inline", source: "https://shop.test/frame", mediaType: "text/html", text: "x".repeat(101) };
  const result = await carryResources([frame], BOUNDS, fetcher({}));
  assert.deepEqual(result, { resources: [], unavailable: 1 });
});

test("nothing is fetched once the deadline has passed; every resource left is counted", async () => {
  const seen: Array<{ address: string; maxBytes: number; timeoutMs: number }> = [];
  const result = await carryResources([fetchOf("https://shop.test/a"), fetchOf("https://shop.test/b")], { ...BOUNDS, captureDeadlineMs: 0 }, fetcher({}, seen));
  assert.deepEqual(result, { resources: [], unavailable: 2 });
  assert.equal(seen.length, 0);
});

test("no more fetches run at once than the bound allows", async () => {
  let inFlight = 0;
  let most = 0;
  const slow: ResourceFetcher = async () => {
    inFlight += 1;
    most = Math.max(most, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 5));
    inFlight -= 1;
    return { carried: true, mediaType: "image/png", bytes: bytes(1) };
  };
  const references = Array.from({ length: 10 }, (_, index) => fetchOf(`https://shop.test/${index}.png`));
  const result = await carryResources(references, BOUNDS, slow);
  assert.equal(result.resources.length, 10);
  assert.equal(most, BOUNDS.fetchConcurrency);
});

test("no references carry nothing and count nothing", async () => {
  assert.deepEqual(await carryResources([], BOUNDS, fetcher({})), { resources: [], unavailable: 0 });
});

/** Room for real stylesheet text; the byte bounds themselves are covered above. */
const ROOMY: TraceCaptureBounds = { ...BOUNDS, resourceBytes: 10_000, totalResourceBytes: 50_000 };

test("each CSS url() a carried stylesheet refers to and the capture does not carry is counted once", async () => {
  const css = [
    "@import url(\"https://shop.test/theme.css\");",
    "@font-face { font-family: Shop; src: url(\"fonts/shop.woff2\") format(\"woff2\"), url('fonts/shop.woff') format(\"woff\"); }",
    ".hero { background: url(../img/hero.jpg); }",
    ".logo { background-image: url( https://shop.test/a.png ); }",
    ".again { background: url(/img/hero.jpg); }",
    ".inline { background: url(data:image/png;base64,AAAA); mask: url(#clip); }",
    ".remote { background: url(https://cdn.other.test/bg.png); }"
  ].join("\n");
  const result = await carryResources(
    [fetchOf("https://shop.test/css/site.css"), fetchOf("https://shop.test/a.png"), fetchOf("https://shop.test/theme.css")],
    ROOMY,
    fetcher({
      "https://shop.test/css/site.css": { carried: true, mediaType: "text/css; charset=utf-8", bytes: new TextEncoder().encode(css) },
      "https://shop.test/a.png": { carried: true, mediaType: "image/png", bytes: bytes(10, 1) },
      "https://shop.test/theme.css": { carried: true, mediaType: "text/css", bytes: new TextEncoder().encode("body { cursor: url(cursor.cur), auto; }") }
    })
  );
  assert.equal(result.resources.length, 3);
  // Uncarried: shop.woff2, shop.woff, /img/hero.jpg (written twice, counted once), the other origin's
  // bg.png, and theme.css's cursor. Carried a.png, the @import, data: and #fragment are not counted.
  assert.equal(result.unavailable, 5);
});

test("a carried frame document's url() references count too; a stylesheet left out is counted only as itself", async () => {
  const frame: TraceResourceReference = {
    kind: "inline",
    source: "https://shop.test/frames/promo.html",
    mediaType: "text/html; charset=utf-8",
    text: "<style>.p { background: url('promo.png'); }</style><div style=\"background:url(&quot;x.gif&quot;)\"></div>"
  };
  const result = await carryResources([frame, fetchOf("https://shop.test/big.css")], ROOMY, fetcher({
    "https://shop.test/big.css": { carried: true, mediaType: "text/css", bytes: new TextEncoder().encode(`.a{background:url(never.png)}${" ".repeat(ROOMY.resourceBytes)}`) }
  }));
  assert.deepEqual(result.resources.map((resource) => resource.source), ["https://shop.test/frames/promo.html"]);
  // promo.png from the frame's style, the frame's inline style's x.gif (the entity-quoted address
  // reads as written), and big.css itself (past the per-resource bound, so its own url() is never read).
  assert.equal(result.unavailable, 3);
});

test("an image or a stylesheet with no url() adds nothing to the count", async () => {
  const result = await carryResources([fetchOf("https://shop.test/plain.css"), fetchOf("https://shop.test/pic.png")], ROOMY, fetcher({
    "https://shop.test/plain.css": { carried: true, mediaType: "text/css", bytes: new TextEncoder().encode("a { color: red; }") },
    "https://shop.test/pic.png": { carried: true, mediaType: "image/png", bytes: new TextEncoder().encode("url(not-css.png)") }
  }));
  assert.equal(result.unavailable, 0);
});
