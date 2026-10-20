// One resource fetched as its original bytes: the server's media type kept, a
// declared or streamed body past the bound refused, a timeout told apart from
// a failure, and no way to make it reject. `fetch` is replaced for each test
// with one answering from Node's own `Response`.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { fetchResourceBytes } from "../fetch-resource-bytes";

type FetchStub = (address: string, init: RequestInit) => Promise<Response>;

function stubFetch(t: TestContext, stub: FetchStub): Array<{ address: string; init: RequestInit }> {
  const calls: Array<{ address: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (address: string, init: RequestInit) => {
    calls.push({ address, init });
    return await stub(address, init);
  }) as typeof fetch;
  t.after(() => {
    globalThis.fetch = original;
  });
  return calls;
}

const LIMITS = { maxBytes: 1_000, timeoutMs: 1_000 };

test("the bytes come back as the server sent them, with its media type, from a same-origin cached request", async (t) => {
  const jpeg = new Uint8Array([0xff, 0xd8, 0xff, 0xe0, 1, 2, 3]);
  const calls = stubFetch(t, async () => new Response(jpeg, { headers: { "content-type": "image/jpeg " } }));
  const fetched = await fetchResourceBytes("https://shop.test/i/1.jpg", LIMITS);
  assert.deepEqual(fetched, { carried: true, mediaType: "image/jpeg", bytes: jpeg });
  assert.equal(calls[0]?.address, "https://shop.test/i/1.jpg");
  assert.equal(calls[0]?.init.credentials, "same-origin");
  assert.equal(calls[0]?.init.cache, "force-cache");
});

test("a response with no media type is carried as octet-stream", async (t) => {
  stubFetch(t, async () => {
    const response = new Response(new Uint8Array([1]));
    response.headers.delete("content-type");
    return response;
  });
  const fetched = await fetchResourceBytes("https://shop.test/x", LIMITS);
  assert.ok(fetched.carried);
  assert.equal(fetched.mediaType, "application/octet-stream");
});

test("an error status is not carried", async (t) => {
  stubFetch(t, async () => new Response("missing", { status: 404 }));
  assert.deepEqual(await fetchResourceBytes("https://shop.test/gone.png", LIMITS), { carried: false, why: "status" });
});

test("a declared length past the bound is refused before the body is read", async (t) => {
  stubFetch(t, async () => new Response(new Uint8Array(10), { headers: { "content-length": "5000" } }));
  assert.deepEqual(await fetchResourceBytes("https://shop.test/big.png", LIMITS), { carried: false, why: "too-large" });
});

test("a body that streams past the bound is abandoned", async (t) => {
  let pulled = 0;
  stubFetch(t, async () => new Response(new ReadableStream<Uint8Array>({
    pull(controller) {
      pulled += 1;
      controller.enqueue(new Uint8Array(400));
      if (pulled === 10) controller.close();
    }
  })));
  assert.deepEqual(await fetchResourceBytes("https://shop.test/stream.png", LIMITS), { carried: false, why: "too-large" });
  assert.ok(pulled < 10, "the whole body was read past the bound");
});

test("a fetch that outlasts its time is a timeout, and one that throws is a failure", async (t) => {
  stubFetch(t, async (address, init) => {
    if (address.endsWith("/throws")) throw new TypeError("Failed to fetch");
    return await new Promise<Response>((_resolve, reject) => {
      init.signal?.addEventListener("abort", () => reject(new DOMException("The operation was aborted.", "AbortError")));
    });
  });
  assert.deepEqual(await fetchResourceBytes("https://shop.test/slow", { maxBytes: 10, timeoutMs: 20 }), { carried: false, why: "timeout" });
  assert.deepEqual(await fetchResourceBytes("https://shop.test/throws", LIMITS), { carried: false, why: "failed" });
});
