import { createServer, request } from "node:http";
import { readFile, stat } from "node:fs/promises";
import path from "node:path";
import { expect, test } from "@playwright/test";
import { assertProbeAllocation, createProbeAllocation, removeProbeAllocation } from "../allocation/index.js";
import { probeEnvironment } from "../environment.js";
import { nativeProbeEvidence } from "../evidence/index.js";
import { startNativeProxy } from "../proxy/index.js";
import { writeNativeProbeExtension } from "../extension/index.js";
import { closeProbeResources } from "../close.js";
import { finishNativeProbe } from "../finish.js";
import type { ProbeEvidence } from "../model.js";
import { spawn } from "node:child_process";
import { once } from "node:events";

test("synchronous cleanup throws still attempt every subsequent owned resource", async () => {
  const allocation = await createProbeAllocation();
  const calls: string[] = [];
  try {
    await expect(closeProbeResources({
      allocation,
      context: {
        close() {
          calls.push("context");
          throw new Error("synthetic private failure");
        }
      },
      browser: { isConnected: () => true, async close() { calls.push("transport"); } },
      proxy: {
        close() {
          calls.push("proxy");
          throw new Error("synthetic private failure");
        }
      }
    })).rejects.toThrow("native_auth_probe.browser_close.cleanup");
    expect(calls).toEqual(["context", "transport", "proxy"]);
  } finally {
    await removeProbeAllocation(allocation);
  }
});

test("failed partial browser setup retains its allocation and never contradicts cleanup failure", async () => {
  const allocation = await createProbeAllocation();
  const evidence: ProbeEvidence[] = [nativeProbeEvidence("cleanup", { cleanupVerified: false, profileIdle: false })];
  let fixtureClosed = false;
  try {
    expect(await finishNativeProbe({ allocation, evidence, fixture: { async close() { fixtureClosed = true; } } })).toBe(false);
    expect(fixtureClosed).toBe(true);
    expect((await stat(allocation.root)).isDirectory()).toBe(true);
    expect(evidence.some(value => value.values.cleanupVerified === true)).toBe(false);
    expect(evidence.at(-1)?.values.cleanupVerified).toBe(false);
  } finally {
    await removeProbeAllocation(allocation);
  }
});

test("allocation removal refuses a currently live process naming its exact profile", async () => {
  const allocation = await createProbeAllocation();
  const child = spawn(process.execPath, ["-e", "process.stdout.write('ready'); setInterval(() => {}, 1000);", "--", `--user-data-dir=${allocation.profile}`], { windowsHide: true, env: await probeEnvironment(process.env), stdio: ["ignore", "pipe", "ignore"] });
  const stopped = once(child, "exit");
  try {
    if (!child.stdout) throw new Error("probe.child_missing");
    await once(child.stdout, "data");
    await expect(removeProbeAllocation(allocation)).rejects.toThrow("native_auth_probe.process_survived");
    expect((await stat(allocation.root)).isDirectory()).toBe(true);
  } finally {
    child.kill();
    await stopped;
    await removeProbeAllocation(allocation);
  }
});

test("cleanup attempts transport, process proof and proxy after context close rejects", async () => {
  const allocation = await createProbeAllocation();
  const calls: string[] = [];
  try {
    const result = closeProbeResources({
      allocation,
      context: {
        async close() {
          calls.push("context");
          throw new Error("synthetic private failure");
        }
      },
      browser: {
        isConnected: () => true,
        async close() { calls.push("transport"); }
      },
      proxy: { async close() { calls.push("proxy"); } }
    });
    await expect(result).rejects.toThrow("native_auth_probe.browser_close.cleanup");
    expect(calls).toEqual(["context", "transport", "proxy"]);
  } finally {
    await removeProbeAllocation(allocation);
  }
});

test("closed evidence excludes callback, payload, boot, text and invalid fields", () => {
  expect(nativeProbeEvidence("pending", { nativeMatches: 1, isolated: "present", pending: true, callback: "sensitive", boot: "opaque", payload: { secret: true }, outcome: "raw exception", bytes: Infinity })).toEqual({ case: "pending", values: { pending: true, nativeMatches: 1, isolated: "present" } });
});

test("browser environment reuses provider-secret stripping and disables protocol logs", async () => {
  expect(await probeEnvironment({ PATH: "retained", CLAUDE_API_KEY: "synthetic", openai_api_key: "synthetic", DEBUG: "pw:*", PWDEBUG: "1" })).toEqual({ PATH: "retained" });
});

test("allocation stays in the ignored owned directory and refuses redirected paths", async () => {
  const allocation = await createProbeAllocation();
  try {
    await assertProbeAllocation(allocation);
    expect(allocation.root).toContain(path.join("apps", "extension", "test-results", "native-auth-feasibility-owned"));
    await expect(assertProbeAllocation({ ...allocation, profile: path.dirname(allocation.profile) })).rejects.toThrow("native_auth_probe.allocation");
    await expect(assertProbeAllocation({ ...allocation, root: path.dirname(allocation.root) })).rejects.toThrow("native_auth_probe.allocation");
  } finally {
    await removeProbeAllocation(allocation);
  }
  await expect(stat(allocation.root)).rejects.toMatchObject({ code: "ENOENT" });
});

test("generated probe preserves current production content bytes and limits authority", async () => {
  const allocation = await createProbeAllocation();
  try {
    const configuration = { ordinaryUrl: "http://127.0.0.1:41001/scenarios/company-website/", alternateUrl: "http://127.0.0.1:41002/scenarios/company-website/booking-widget" };
    const artifact = await writeNativeProbeExtension(allocation, configuration);
    expect(artifact.contentSha256).toMatch(/^[0-9a-f]{64}$/u);
    const manifest = JSON.parse(await readFile(path.join(allocation.extension, "manifest.json"), "utf8"));
    expect(manifest.permissions).toEqual(["identity", "tabs", "scripting", "storage"]);
    expect(manifest.host_permissions).toEqual(["<all_urls>"]);
    expect(manifest.content_scripts.every((script: { run_at: string }) => script.run_at === "document_start")).toBe(true);
    expect(await readFile(path.join(allocation.extension, "content.js"))).toEqual(await readFile(new URL("../../../dist/chrome/content/index.js", import.meta.url)));
  } finally {
    await removeProbeAllocation(allocation);
  }
});

test("startup proxy forwards exact fixture origin and refuses every other destination before connecting", async () => {
  let targetCalls = 0;
  const fixture = createServer((_request, response) => {
    targetCalls += 1;
    response.end("fixture");
  });
  await new Promise<void>(resolve => fixture.listen(0, "127.0.0.1", resolve));
  const address = fixture.address();
  if (!address || typeof address === "string") throw new Error("fixture.listen");
  const origin = `http://127.0.0.1:${address.port}`;
  const proxy = await startNativeProxy({ ordinaryUrl: `${origin}/scenarios/company-website/`, alternateUrl: `${origin}/scenarios/company-website/booking-widget` });
  const through = (destination: string, method = "GET") => new Promise<number>((resolve, reject) => {
    const outgoing = request(proxy.origin, { path: destination, method }, response => {
      response.resume();
      response.on("end", () => resolve(response.statusCode ?? 0));
    });
    outgoing.on("connect", (response, socket) => {
      socket.destroy();
      resolve(response.statusCode ?? 0);
    });
    outgoing.on("error", reject);
    outgoing.end();
  });
  try {
    expect(await through(`${origin}/scenarios/company-website/`)).toBe(200);
    expect(await through(`http://localhost:${address.port}/scenarios/company-website/`)).toBe(403);
    expect(await through("http://127.0.0.1:1/")).toBe(403);
    expect(await through("http://192.0.2.1/")).toBe(403);
    expect(await through("aaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa.chromiumapp.org:443", "CONNECT")).toBe(403);
    expect(targetCalls).toBe(1);
    expect(proxy.counts()).toEqual({ forwarded: 1, denied: 4, nativeCallbackRequests: 1, connectionResets: 0, transportFailures: 0 });
  } finally {
    await proxy.close();
    await new Promise<void>((resolve, reject) => fixture.close(error => error ? reject(error) : resolve()));
  }
});
