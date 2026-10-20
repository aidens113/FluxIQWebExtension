// Coverage of page-capturer.ts (with request-page-capture.ts and
// hash-capture-parts.ts beneath it): a traced command's page capture becomes
// the references its result carries, every digest is the lower-case hex
// SHA-256 of the bytes uploaded under it, a digest this worker already stored
// at this Core is never uploaded again, and every failure -- the capture, an
// upload, a part that cannot be read, a wait that runs out -- is counted in
// `unavailable` rather than failing the command or going missing.

import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { TRACE_PAGE_CAPTURE_MESSAGE, type TracePageCaptureResponse } from "../../../shared/trace-page-capture";
import type { CoreApiCredentials } from "../../connection/index";
import { TracePageCapturer } from "../page-capturer";
import type { TraceArtifactUploader, TraceMessageSender, TraceUploadBounds } from "../types";

const CREDENTIALS: CoreApiCredentials = { coreApiUrl: "http://core.test", token: "pairing-token" };
const BOUNDS: TraceUploadBounds = { captureTimeoutMs: 500, uploadTimeoutMs: 500, uploadDeadlineMs: 1_000, uploadConcurrency: 2 };

const HTML = "<!doctype html><title>Shop</title><link rel=stylesheet href=/site.css><img src=/a.png>";
const CSS = "body { color: #222; }";
const PNG = Uint8Array.from([0x89, 0x50, 0x4e, 0x47, 1, 2, 3]);

const sha = (bytes: Uint8Array | string): string => createHash("sha256").update(bytes).digest("hex");
const b64 = (bytes: Uint8Array | string): string => Buffer.from(bytes).toString("base64");

function capture(overrides: Partial<Extract<TracePageCaptureResponse, { ok: true }>> = {}): TracePageCaptureResponse {
  return {
    ok: true,
    document: { html: HTML, source: "https://shop.test/" },
    resources: [
      { source: "https://shop.test/site.css", mediaType: "text/css", base64: b64(CSS) },
      { source: "https://shop.test/a.png", mediaType: "image/png", base64: b64(PNG) }
    ],
    unavailable: 0,
    ...overrides
  };
}

function sender(reply: unknown | (() => Promise<unknown>), seen: Array<{ tabId: number; message: unknown; frameId: number | undefined }> = []): TraceMessageSender {
  return async (tabId, message, frameId) => {
    seen.push({ tabId, message, frameId });
    return typeof reply === "function" ? await (reply as () => Promise<unknown>)() : reply;
  };
}

type Upload = { coreApiUrl: string; token: string | undefined; sha256: string; byteLength: number; mediaType: string; timeoutMs: number; digestOfBytes: string };

function uploader(uploads: Upload[], fail: (sha256: string) => boolean = () => false): TraceArtifactUploader {
  return async (credentials, sha256, bytes, mediaType, timeoutMs) => {
    uploads.push({ coreApiUrl: credentials.coreApiUrl, token: credentials.token, sha256, byteLength: bytes.byteLength, mediaType, timeoutMs, digestOfBytes: sha(bytes) });
    if (fail(sha256)) throw new Error("FluxIQ trace artifact upload failed (500).");
  };
}

function capturer(send: TraceMessageSender, upload: TraceArtifactUploader, credentials: () => CoreApiCredentials = () => CREDENTIALS, bounds = BOUNDS): TracePageCapturer {
  return new TracePageCapturer({ credentials, send, upload, bounds });
}

test("a capture becomes references to the document and each resource, each uploaded under its own SHA-256", async () => {
  const seen: Array<{ tabId: number; message: unknown; frameId: number | undefined }> = [];
  const uploads: Upload[] = [];
  const trace = await capturer(sender(capture({ unavailable: 2 }), seen), uploader(uploads)).capture(7);

  assert.deepEqual(seen, [{ tabId: 7, message: { type: TRACE_PAGE_CAPTURE_MESSAGE, frameId: 0 }, frameId: 0 }], "the tab's top frame is asked, once");
  assert.deepEqual(trace, {
    artifacts: [
      { sha256: sha(HTML), mediaType: "text/html", byteLength: Buffer.byteLength(HTML), role: "primary", source: "https://shop.test/" },
      { sha256: sha(CSS), mediaType: "text/css", byteLength: CSS.length, role: "resource", source: "https://shop.test/site.css" },
      { sha256: sha(PNG), mediaType: "image/png", byteLength: PNG.byteLength, role: "resource", source: "https://shop.test/a.png" }
    ],
    unavailable: 2
  });
  assert.deepEqual(uploads.map((upload) => [upload.sha256, upload.mediaType]).sort(), [[sha(HTML), "text/html"], [sha(CSS), "text/css"], [sha(PNG), "image/png"]].sort());
  for (const upload of uploads) {
    assert.match(upload.sha256, /^[0-9a-f]{64}$/u);
    assert.equal(upload.digestOfBytes, upload.sha256, "the address is the digest of the bytes sent");
    assert.equal(upload.token, "pairing-token");
    assert.equal(upload.coreApiUrl, "http://core.test");
  }
});

test("a digest already stored at this Core is referenced but not uploaded again; another Core gets its own copy", async () => {
  const uploads: Upload[] = [];
  let credentials = CREDENTIALS;
  const subject = capturer(sender(capture()), uploader(uploads), () => credentials);
  await subject.capture(7);
  const second = await subject.capture(7);
  assert.equal(uploads.length, 3, "the second command uploads nothing");
  assert.equal(second.artifacts.length, 3);
  assert.equal(second.unavailable, 0);

  credentials = { coreApiUrl: "http://other-core.test", token: "pairing-token" };
  await subject.capture(7);
  assert.equal(uploads.length, 6);
  assert.ok(uploads.slice(3).every((upload) => upload.coreApiUrl === "http://other-core.test"));
});

test("two parts with the same bytes are uploaded once and both referenced", async () => {
  const uploads: Upload[] = [];
  const trace = await capturer(sender(capture({
    resources: [
      { source: "https://shop.test/a.png", mediaType: "image/png", base64: b64(PNG) },
      { source: "https://shop.test/copy-of-a.png", mediaType: "image/png", base64: b64(PNG) }
    ]
  })), uploader(uploads)).capture(7);
  assert.equal(uploads.length, 2);
  assert.deepEqual(trace.artifacts.map((artifact) => artifact.source), ["https://shop.test/", "https://shop.test/a.png", "https://shop.test/copy-of-a.png"]);
});

test("a failed upload is left out and counted, and is tried again by the next command", async () => {
  const uploads: Upload[] = [];
  let failing = true;
  const subject = capturer(sender(capture({ unavailable: 1 })), uploader(uploads, (digest) => failing && digest === sha(CSS)));
  const first = await subject.capture(7);
  assert.deepEqual(first.artifacts.map((artifact) => artifact.sha256), [sha(HTML), sha(PNG)]);
  assert.equal(first.unavailable, 2, "the page's own count plus the failed upload");

  failing = false;
  const second = await subject.capture(7);
  assert.equal(uploads.filter((upload) => upload.sha256 === sha(CSS)).length, 2);
  assert.equal(second.artifacts.length, 3);
  assert.equal(second.unavailable, 1);
});

test("a capture that fails, is refused, is not a capture, or names no tab answers no artifacts and counts itself", async () => {
  const replies: Array<[string, TraceMessageSender]> = [
    ["the page's own refusal", sender({ ok: false, reason: "The page capture failed serializing the document: TypeError." })],
    ["no script in the frame", async () => { throw new Error("Could not establish connection. Receiving end does not exist."); }],
    ["no answer at all", sender(undefined)],
    ["another shape", sender({ ok: true, document: "not a document" })]
  ];
  for (const [label, send] of replies) {
    const uploads: Upload[] = [];
    assert.deepEqual(await capturer(send, uploader(uploads)).capture(7), { artifacts: [], unavailable: 1 }, label);
    assert.equal(uploads.length, 0, label);
  }
  const seen: Array<{ tabId: number; message: unknown; frameId: number | undefined }> = [];
  assert.deepEqual(await capturer(sender(capture(), seen), uploader([])).capture(undefined), { artifacts: [], unavailable: 1 });
  assert.equal(seen.length, 0, "no tab, no message");
});

test("a resource whose base64 cannot be read, or that is not a resource, is counted and the rest still go", async () => {
  const uploads: Upload[] = [];
  const trace = await capturer(sender({
    ...capture(),
    resources: [{ source: "https://shop.test/x.png", mediaType: "image/png", base64: "%%% not base64 %%%" }, { source: 4 }, { source: "https://shop.test/a.png", mediaType: "image/png", base64: b64(PNG) }]
  }), uploader(uploads)).capture(7);
  assert.deepEqual(trace.artifacts.map((artifact) => artifact.source), ["https://shop.test/", "https://shop.test/a.png"]);
  assert.equal(trace.unavailable, 2);
});

test("a page that does not answer in time is given up at the bound and counted", async () => {
  const started = Date.now();
  const trace = await capturer(sender(() => new Promise(() => undefined)), uploader([]), () => CREDENTIALS, { ...BOUNDS, captureTimeoutMs: 30 }).capture(7);
  assert.deepEqual(trace, { artifacts: [], unavailable: 1 });
  assert.ok(Date.now() - started < 1_000, "the wait ends at the capture bound");
});

test("uploads stop at the deadline and run no more at once than the bound; each is given at most the time left", async () => {
  const resources = Array.from({ length: 6 }, (_, index) => ({ source: `https://shop.test/${index}.png`, mediaType: "image/png", base64: b64(`image-${index}`) }));
  let inFlight = 0;
  let most = 0;
  const limits: number[] = [];
  const slow: TraceArtifactUploader = async (_credentials, _sha, _bytes, _type, timeoutMs) => {
    limits.push(timeoutMs);
    inFlight += 1;
    most = Math.max(most, inFlight);
    await new Promise((resolve) => setTimeout(resolve, 40));
    inFlight -= 1;
  };
  const bounds: TraceUploadBounds = { captureTimeoutMs: 500, uploadTimeoutMs: 1_000, uploadDeadlineMs: 60, uploadConcurrency: 2 };
  const started = Date.now();
  const trace = await capturer(sender(capture({ resources })), slow, () => CREDENTIALS, bounds).capture(7);
  assert.equal(most, 2);
  assert.ok(limits.every((limit) => limit <= bounds.uploadDeadlineMs), "no upload is given more than the deadline leaves");
  assert.ok(trace.artifacts.length >= 2 && trace.artifacts.length < 7, `some uploads ran out of time (${trace.artifacts.length} stored)`);
  assert.equal(trace.artifacts.length + trace.unavailable, 7, "every part is either referenced or counted");
  assert.ok(Date.now() - started < 1_000);
});

test("an upload that never answers is given up by the uploader's own bound and counted", async () => {
  const hanging: TraceArtifactUploader = async (_credentials, _sha, _bytes, _type, timeoutMs) => {
    await new Promise((resolve) => setTimeout(resolve, timeoutMs));
    throw new DOMException("The operation timed out.", "TimeoutError");
  };
  const trace = await capturer(sender(capture()), hanging, () => CREDENTIALS, { ...BOUNDS, uploadTimeoutMs: 20 }).capture(7);
  assert.deepEqual(trace, { artifacts: [], unavailable: 3 });
});

test("without a pairing token nothing is uploaded and every part is counted", async () => {
  const uploads: Upload[] = [];
  const trace = await capturer(sender(capture()), uploader(uploads), () => ({ coreApiUrl: "http://core.test", token: undefined })).capture(7);
  assert.deepEqual(trace, { artifacts: [], unavailable: 3 });
  assert.equal(uploads.length, 0);
});

// Per-scope records (`metadata.trace.scope`, the trace a command is recorded
// into): each trace must hold every artifact its results reference, so a
// digest stored for one scope is uploaded again for another, once per scope.

test("two scopes each upload a shared digest once; a later command in either scope uploads nothing", async () => {
  const uploads: Upload[] = [];
  const subject = capturer(sender(capture()), uploader(uploads));
  const build = await subject.capture(7, "trace-build");
  const trial = await subject.capture(7, "trace-trial");
  assert.equal(uploads.length, 6, "each scope gets the three digests");
  assert.deepEqual(uploads.slice(0, 3).map((upload) => upload.sha256).sort(), uploads.slice(3).map((upload) => upload.sha256).sort());
  assert.equal(build.artifacts.length, 3);
  assert.equal(trial.artifacts.length, 3);
  assert.equal(trial.unavailable, 0);

  await subject.capture(7, "trace-build");
  await subject.capture(7, "trace-trial");
  assert.equal(uploads.length, 6, "a scope never uploads a digest twice");
});

test("the same scope uploads a digest once across commands, and a scope is kept apart per Core", async () => {
  const uploads: Upload[] = [];
  let credentials = CREDENTIALS;
  const subject = capturer(sender(capture()), uploader(uploads), () => credentials);
  await subject.capture(7, "trace-1");
  const second = await subject.capture(7, "trace-1");
  assert.equal(uploads.length, 3);
  assert.equal(second.artifacts.length, 3);

  credentials = { coreApiUrl: "http://other-core.test", token: "pairing-token" };
  await subject.capture(7, "trace-1");
  assert.equal(uploads.length, 6, "the same scope name at another Core is another record");
});

test("a command with no scope keeps the per-Core record, apart from every scope", async () => {
  const uploads: Upload[] = [];
  const subject = capturer(sender(capture()), uploader(uploads));
  await subject.capture(7);
  await subject.capture(7, undefined);
  assert.equal(uploads.length, 3, "no scope: once per Core, as before");
  await subject.capture(7, "trace-1");
  assert.equal(uploads.length, 6, "a scope is not served by the unscoped record");
  await subject.capture(7);
  assert.equal(uploads.length, 6, "nor the unscoped record changed by a scope");
});

test("only the most recently used scopes are remembered; the oldest is dropped and uploads again", async () => {
  const uploads: Upload[] = [];
  const subject = new TracePageCapturer({ credentials: () => CREDENTIALS, send: sender(capture()), upload: uploader(uploads), bounds: BOUNDS, rememberedScopes: 2 });
  await subject.capture(7, "a");
  await subject.capture(7, "b");
  await subject.capture(7, "a");
  assert.equal(uploads.length, 6, "a used again, so b is now the oldest");
  await subject.capture(7, "c");
  assert.equal(uploads.length, 9);
  await subject.capture(7, "a");
  assert.equal(uploads.length, 9, "a was kept");
  await subject.capture(7, "b");
  assert.equal(uploads.length, 12, "b was dropped, so its digests go again");
});
