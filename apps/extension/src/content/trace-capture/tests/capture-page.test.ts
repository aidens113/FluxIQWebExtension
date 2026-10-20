// The capture as the message handler answers with it: the document at its
// address, the resources carried, what could not be carried counted -- and,
// when it cannot be made, `ok: false` with a reason that names the stage and
// the error's kind but never quotes the error, which can hold page text.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { asDocument, h, installCaptureStubs, page } from "./capture-stub-page";
import type { StubImage, StubLink } from "./capture-stub-page";
import type { ResourceFetcher } from "../types";

const ORIGIN = "https://shop.test";

async function capture(t: TestContext) {
  installCaptureStubs(t);
  const { captureTracePage, TRACE_CAPTURE_BOUNDS } = await import("..");
  return { captureTracePage, bounds: TRACE_CAPTURE_BOUNDS };
}

function shopPage() {
  const link = h("link", { rel: "stylesheet", href: "/app.css" }) as StubLink;
  link.href = `${ORIGIN}/app.css`;
  const image = h("img", { src: "/i/1.jpg" }) as StubImage;
  image.currentSrc = `${ORIGIN}/i/1.jpg`;
  const foreign = h("img", { src: "https://cdn.test/2.jpg" }) as StubImage;
  foreign.currentSrc = "https://cdn.test/2.jpg";
  return page(`${ORIGIN}/s?k=earbuds`, [link], [h("h1", {}, "Results"), image, foreign]);
}

test("a capture answers with the document at its address, its resources and how many could not be carried", async (t) => {
  const { captureTracePage, bounds } = await capture(t);
  const fetchBytes: ResourceFetcher = async (address) => address.endsWith(".css")
    ? { carried: true, mediaType: "text/css", bytes: new TextEncoder().encode("h1{}") }
    : { carried: false, why: "timeout" };
  const reply = await captureTracePage(asDocument(shopPage()), bounds, fetchBytes);
  assert.ok(reply.ok, JSON.stringify(reply));
  assert.equal(reply.document.source, `${ORIGIN}/s?k=earbuds`);
  assert.ok(reply.document.html.startsWith('<!DOCTYPE html><html lang="en"><head><link rel="stylesheet" href="/app.css"></head><body><h1>Results</h1>'));
  assert.deepEqual(reply.resources, [{ source: `${ORIGIN}/app.css`, mediaType: "text/css", base64: Buffer.from("h1{}").toString("base64") }]);
  // The cross-origin image is counted by the serializer, the timed-out one by the carry.
  assert.equal(reply.unavailable, 2);
});

test("a document that cannot be serialized answers ok: false without quoting the error", async (t) => {
  const { captureTracePage, bounds } = await capture(t);
  const broken = shopPage();
  Object.defineProperty(broken, "documentElement", { get: () => { throw new RangeError("PAGE_TEXT_IN_MESSAGE"); } });
  const reply = await captureTracePage(asDocument(broken), bounds, async () => ({ carried: false, why: "failed" }));
  assert.deepEqual(reply, { ok: false, reason: "The page capture failed serializing the document: RangeError." });
});

test("a carry that throws answers ok: false too", async (t) => {
  const { captureTracePage, bounds } = await capture(t);
  const reply = await captureTracePage(asDocument(shopPage()), bounds, async () => {
    throw new Error("PAGE_TEXT_IN_MESSAGE");
  });
  assert.deepEqual(reply, { ok: false, reason: "The page capture failed carrying its resources: Error." });
});
