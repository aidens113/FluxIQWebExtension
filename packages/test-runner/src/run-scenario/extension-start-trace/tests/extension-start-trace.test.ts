import assert from "node:assert/strict";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { EXTENSION_START_SIDECAR_FILENAME, ExtensionStartTrace, screenText, screenUrl, writeExtensionStartSidecar } from "../index.js";

test("a kept string loses secrets, pairing codes, long opaque strings and every URL beyond its origin", () => {
  const text = screenText("pair 482913 with s3cret-value at http://127.0.0.1:5173/scenarios/x?q=private token abcdefghijklmnopqrstuvwxyz0123456789ABCD", ["s3cret-value"]);
  assert.ok(!text.includes("482913"), "the reference code is gone");
  assert.ok(!text.includes("s3cret-value"), "the run's secret is gone");
  assert.ok(!text.includes("/scenarios/x") && !text.includes("private"), "the page path and query are gone");
  assert.ok(text.includes("http://127.0.0.1:5173"), "the origin stays, so a reader knows which server");
  assert.ok(!text.includes("abcdefghijklmnopqrstuvwxyz0123456789ABCD"), "a long opaque string is gone");
  assert.ok(screenText("x".repeat(1000), []).length <= 301);
});

test("an extension URL keeps its path under a placeholder id; anything else keeps its origin", () => {
  assert.equal(screenUrl("chrome-extension://ohopmogionjhhhihncamjlajnppdpgee/sidepanel/index.html?x=1"), "chrome-extension://<extension>/sidepanel/index.html");
  assert.equal(screenUrl("http://localhost:9/a/b?c"), "http://localhost:9");
  assert.equal(screenUrl("about:blank"), "about:blank");
  assert.equal(screenUrl("not a url"), "[unparsed-url]");
});

test("a timed step is marked when it starts and when it ends, with its duration and a screened description", async () => {
  let clock = 1_000;
  const trace = new ExtensionStartTrace({ secrets: ["tok-secret"], now: () => clock });
  const value = await trace.timed("connect", async () => { clock += 250; return { state: "pairing tok-secret" }; }, result => ({ connectionState: result.state }));
  assert.deepEqual(value, { state: "pairing tok-secret" });
  await assert.rejects(trace.timed("approve", async () => { clock += 5; throw new Error("refused 123456"); }));
  assert.deepEqual(trace.entries(), [
    { atMs: 0, source: "lab", event: "connect.start" },
    { atMs: 250, source: "lab", event: "connect.done", detail: { ms: 250, connectionState: "pairing [REDACTED]" } },
    { atMs: 250, source: "lab", event: "approve.start" },
    { atMs: 255, source: "lab", event: "approve.failed", detail: { ms: 5, error: "refused [code]" } },
  ]);
});

test("the sidecar is written beside a finalized bundle only, and is withheld whole if anything sensitive reached it", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "t174-w7-trace-"));
  try {
    const trace = new ExtensionStartTrace({ secrets: [] });
    trace.mark("launched", { note: "carries later-secret" });
    await assert.rejects(writeExtensionStartSidecar({ runDirectory: path.join(root, ".staging-run-x"), runId: "run-x", trace, secrets: [] }), /staging/u);

    const written = await writeExtensionStartSidecar({ runDirectory: root, runId: "run-x", trace, secrets: [] });
    assert.equal(path.basename(written), EXTENSION_START_SIDECAR_FILENAME);
    const clean = JSON.parse(await readFile(written, "utf8"));
    assert.equal(clean.published, false);
    assert.equal(clean.entries[0].event, "launched");

    // A secret the trace was not told about, but the writer is: the whole file is withheld rather than written.
    await writeExtensionStartSidecar({ runDirectory: root, runId: "run-x", trace, secrets: ["later-secret"] });
    const withheld = JSON.parse(await readFile(written, "utf8"));
    assert.equal(withheld.withheld, "redaction_failed");
    assert.deepEqual(withheld.entries, []);
  } finally {
    await rm(root, { recursive: true, force: true });
  }
});
