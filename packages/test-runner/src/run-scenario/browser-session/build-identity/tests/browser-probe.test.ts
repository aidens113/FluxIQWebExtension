import assert from "node:assert/strict";
import { createServer } from "node:http";
import { cp, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import type { RunningTopology } from "../../../../coordinator.js";
import { launchBrowser } from "../../launch-browser.js";
import { verifyRunningBuildIdentity } from "../index.js";

// Real production bundles, persistent owned profile, no Core or model provider.
test("production background/content match and deliberate mismatches are screened before dispatch", { timeout: 180_000, skip: process.env.FLUXIQ_IDENTITY_BROWSER_PROBE !== "1" }, async (t) => {
  const source = process.env.FLUXIQ_IDENTITY_EXTENSION_PATH ?? fileURLToPath(new URL("../../../../../../../apps/extension/dist/e2e-chromium", import.meta.url));
  const root = await mkdtemp(path.join(tmpdir(), "fluxiq-identity-probe-"));
  const extensionPath = path.join(root, "extension");
  const server = createServer((_request, response) => { response.setHeader("Content-Type", "text/html"); response.end("<!doctype html><html><body><button>Identity fixture</button></body></html>"); });
  await new Promise<void>(resolve => server.listen(0, "127.0.0.1", resolve));
  const address = server.address();
  assert.ok(address && typeof address === "object");
  const origin = `http://127.0.0.1:${address.port}`;
  const profile = path.join(root, "profile");
  try {
    for (const mismatch of ["none", "background", "content", "disk"]) {
      await cp(source, extensionPath, { recursive: true, force: true });
      const stampPath = path.join(extensionPath, "build-info.json");
      const stamp = JSON.parse(await readFile(stampPath, "utf8")) as { identity: { inputsDigest: string } };
      const original = stamp.identity.inputsDigest;
      const changed = original === "d".repeat(64) ? "e".repeat(64) : "d".repeat(64);
      if (mismatch === "disk") { stamp.identity.inputsDigest = changed; await writeFile(stampPath, JSON.stringify(stamp)); }
      else if (mismatch !== "none") {
        const file = path.join(extensionPath, mismatch, "index.js");
        await writeFile(file, (await readFile(file, "utf8")).replaceAll(original, changed));
      }
      const topology = { allocation: { browserProfileDir: profile }, scenarioOrigin: origin, fluxiqOrigin: "http://127.0.0.1:1", gatewayUrl: "ws://127.0.0.1:2/client" } as unknown as RunningTopology;
      const { context } = await launchBrowser(topology, extensionPath);
      try {
        const worker = context.serviceWorkers()[0] ?? await context.waitForEvent("serviceworker", { timeout: 20_000 });
        const control = await context.newPage();
        await control.goto(`chrome-extension://${new URL(worker.url()).hostname}/sidepanel/index.html`);
        if (mismatch === "none") {
          const cdp = await context.newCDPSession(control);
          const version = await cdp.send("Browser.getVersion");
          t.diagnostic(`Browser ${version.product}; target e2e-chromium; persistent owned profile; no Core/provider; bundle ${original}`);
          await cdp.detach();
        }
        const fixture = await context.newPage();
        await fixture.goto(origin);
        const reports: unknown[] = [];
        let dispatches = 0;
        const dispatch = async () => { await verifyRunningBuildIdentity(control, extensionPath, fixture.url(), async identity => { reports.push(identity); }); dispatches++; };
        if (mismatch === "none") { await dispatch(); assert.equal(dispatches, 1); }
        else { await assert.rejects(dispatch, /provider dispatch refused/); assert.equal(dispatches, 0); }
        assert.equal((reports.at(-1) as { verified: boolean }).verified, mismatch === "none");
      } finally { await context.close(); }
    }
  } finally {
    await new Promise<void>((resolve, reject) => server.close(error => error ? reject(error) : resolve()));
    await rm(root, { recursive: true, force: true });
  }
});
