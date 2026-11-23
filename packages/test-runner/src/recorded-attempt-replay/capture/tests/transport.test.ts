import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { recordedCaptureTransport } from "../transport.js";

test("concurrent and later native requests cannot replace the first capture or use a provider fallback", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "recorded-capture-transport-"));
  const wireFile = path.join(root, "wire.json");
  let attached = 0;
  let cancelled = 0;
  const position = { sourceTraceId: "trace.fixture", artifactId: "artifact.fixture", sha256: "a".repeat(64) };
  try {
    const fetch = recordedCaptureTransport({ wireFile, attach: () => {
      attached += 1;
      return position;
    }, cancel: () => { cancelled += 1; } });
    const first = fetch("https://provider-fixture.example.test", { body: "first native request" });
    await assert.rejects(() => fetch("https://provider-fixture.example.test", { body: "concurrent native request" }), { name: "AbortError" });
    assert.equal(await (await first).text(), "{");
    await assert.rejects(() => fetch("https://provider-fixture.example.test", { body: "later native request" }), { name: "AbortError" });
    assert.equal(attached, 1);
    assert.equal(cancelled, 3);
    const captured = JSON.parse(await readFile(wireFile, "utf8"));
    assert.equal(captured.request, "first native request");
    assert.deepEqual(captured.position, position);
    assert.equal(captured.status, 200);
    assert.equal(Buffer.from(captured.responseBase64, "base64").toString(), "{");
    assert.equal(JSON.parse(await readFile(`${wireFile}.extra-2.json`, "utf8")).request, "concurrent native request");
    assert.equal(JSON.parse(await readFile(`${wireFile}.extra-3.json`, "utf8")).responseBase64, null);
    const second = recordedCaptureTransport({ wireFile, attach: () => position, cancel: () => undefined });
    await assert.rejects(() => second("https://provider-fixture.example.test", { body: "replacement" }), { code: "EEXIST" });
    assert.equal(JSON.parse(await readFile(wireFile, "utf8")).request, "first native request");
  } finally { await rm(root, { recursive: true, force: true }); }
});
