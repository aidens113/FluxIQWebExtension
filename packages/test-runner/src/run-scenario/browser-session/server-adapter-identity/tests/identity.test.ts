import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { cp, mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { serverAdapterBuild } from "../../../../core-web-build/index.js";
import { assertServerAdapterIdentityMatch, expectedServerAdapterIdentity, normalizeServerAdapterArtifact, verifyRunningServerAdapterIdentity, type ServerAdapterBuildIdentity } from "../index.js";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const slot = JSON.stringify("__FLUXIQ_SERVER_IDENTITY_BEGIN__" + Buffer.from('{"fluxiqServerIdentityPlaceholder":310}').toString("base64") + "__FLUXIQ_SERVER_IDENTITY_END__");
const identity: ServerAdapterBuildIdentity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "fluxiq/web-client-gateway-server", version: "0.1.0", normalization: "module-payload-v1", artifactDigest: "a".repeat(64), sourceInputsDigest: "b".repeat(64) };
test("server identity is separate from native host and missing/legacy/wrong identity refuses before dispatch", () => {
  assert.deepEqual(assertServerAdapterIdentityMatch(identity, { ok: true, payload: { serverTransportIdentity: identity, loadedModules: [{ moduleId: "host" }] } }), identity);
  for (const candidate of [null, undefined, { ...identity, artifactDigest: "c".repeat(64) }, { ...identity, sourceInputsDigest: "c".repeat(64) }, { ...identity, moduleId: "other" }, { ...identity, extra: "private" }]) {
    let calls = 0; assert.throws(() => { assertServerAdapterIdentityMatch(identity, { ok: true, payload: { serverTransportIdentity: candidate, loadedModules: [identity] } }); calls++; }, /provider dispatch refused/); assert.equal(calls, 0);
  }
});
test("missing control and malformed/multiple executing slots refuse", async () => {
  await assert.rejects(() => verifyRunningServerAdapterIdentity(undefined, "", async () => undefined), /provider dispatch refused/);
  assert.equal(normalizeServerAdapterArtifact(slot), slot);
  for (const bad of ["", slot + slot, slot.replace("BEGIN__", "WRONG__"), slot + '\"__FLUXIQ_SERVER_IDENTITY_BEGIN__missing-end\"']) assert.throws(() => normalizeServerAdapterArtifact(bad));
});
test("complete intended inventory and canonical/staged executable freshness refuse before chat", async t => {
  for (const defect of ["source", "generator", "cache", "new-source", "new-generator", "new-cache", "omitted-key", "artifact", "reader", "missing-companion", "bad-copy"]) await t.test(defect, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "server-adapter-expected-"));
    try {
      const fixtures = { "apps/web/src/server/server.ts": "server", "apps/web/src/lib/fluxiq.ts": "registration", "apps/web/src/instrumentation.ts": "preload", "apps/web/scripts/build.mjs": "generator", "scripts/build-cache/steps.mjs": "cache", "apps/web/package.json": '{"version":"0.1.0"}', "package.json": "{}", "pnpm-lock.yaml": "lock" };
      const sources: Record<string, string> = {};
      for (const key of Object.keys(fixtures).sort()) { const bytes = fixtures[key as keyof typeof fixtures]; await mkdir(path.dirname(path.join(root, key)), { recursive: true }); await writeFile(path.join(root, key), bytes); sources[key] = hash(bytes); }
      const artifact = path.join(root, "apps/web/.server-runtime/client-gateway-server.mjs"); await mkdir(path.dirname(artifact), { recursive: true }); const code = `const embedded=${slot}; const frame=1;`; await writeFile(artifact, code);
      const stamp = { identity: { ...identity, artifactDigest: hash(normalizeServerAdapterArtifact(code)), sourceInputsDigest: hash(JSON.stringify(sources)) }, sources };
      await writeFile(`${artifact}.identity.json`, JSON.stringify(stamp)); assert.deepEqual(await expectedServerAdapterIdentity(root), stamp.identity);
      const edits: Record<string, string> = { source: "apps/web/src/server/server.ts", generator: "apps/web/scripts/build.mjs", cache: "scripts/build-cache/steps.mjs", "new-source": "apps/web/src/server/new.ts", "new-generator": "apps/web/scripts/new.mjs", "new-cache": "scripts/build-cache/new.mjs" };
      if (edits[defect]) await writeFile(path.join(root, edits[defect]!), "changed");
      if (defect === "omitted-key") { delete stamp.sources["apps/web/src/server/server.ts"]; await writeFile(`${artifact}.identity.json`, JSON.stringify(stamp)); }
      if (defect === "artifact") await writeFile(artifact, code.replace("frame=1", "frame=2"));
      if (defect === "reader") await writeFile(artifact, code + code);
      if (defect === "missing-companion") await rm(`${artifact}.identity.json`);
      if (defect === "bad-copy") {
        const copied = path.join(root, "staged/apps/web"); await mkdir(copied, { recursive: true }); await cp(path.dirname(artifact), path.join(copied, ".server-runtime"), { recursive: true });
        await writeFile(path.join(copied, ".server-runtime/client-gateway-server.mjs"), code + "changed semantics");
        await assert.rejects(() => serverAdapterBuild.validateCopy(root, copied), /provider dispatch refused/); assert.equal(await serverAdapterBuild.hasArtifacts(copied), false); return;
      }
      let calls = 0; await assert.rejects(() => verifyRunningServerAdapterIdentity({ readRuntimeBuildIdentity: async () => { calls++; return {}; } }, root, async () => undefined), /provider dispatch refused/); assert.equal(calls, 0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
test("server gate precedes project/browser/chat while host identity keeps its independent field", async () => {
  const source = await readFile(fileURLToPath(new URL("../../../../../src/run-scenario.ts", import.meta.url)), "utf8");
  const gate = source.indexOf("await verifyRunningServerAdapterIdentity("); assert.ok(gate > source.indexOf("await verifyRunningHostIdentity("));
  for (const token of ["await prepareIndependentCreationProject(", "await launchBrowser(", "const chat = buildEntry"]) assert.ok(gate < source.indexOf(token));
});
