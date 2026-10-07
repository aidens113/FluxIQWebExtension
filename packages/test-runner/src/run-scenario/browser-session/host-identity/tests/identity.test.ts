import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { assertHostIdentityMatch, expectedHostIdentity, normalizeHostArtifact, verifyRunningHostIdentity, type HostBuildIdentity } from "../index.js";
const hash = (text: string) => createHash("sha256").update(text).digest("hex");
const slot = JSON.stringify("__FLUXIQ_HOST_IDENTITY_BEGIN__" + Buffer.from('{"fluxiqHostIdentityPlaceholder":305}').toString("base64") + "__FLUXIQ_HOST_IDENTITY_END__");
const identity: HostBuildIdentity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "@fluxiq-web-extension/domain-host", version: "0.1.0", normalization: "module-payload-v1", artifactDigest: "a".repeat(64), sourceInputsDigest: "b".repeat(64) };
test("missing, stale, duplicate and malformed loaded module refuse before chat/provider", () => {
  assert.deepEqual(assertHostIdentityMatch(identity, { ok: true, payload: { loadedModules: [identity] } }), identity);
  for (const loadedModules of [undefined, [], [identity, identity], [{ ...identity, artifactDigest: "c".repeat(64) }], [{ ...identity, sourceInputsDigest: "c".repeat(64) }], [{ ...identity, page: "private" }]]) {
    let chat = 0; assert.throws(() => { assertHostIdentityMatch(identity, { ok: true, payload: { loadedModules } }); chat++; }, /provider dispatch refused/); assert.equal(chat, 0);
  }
});
test("missing authenticated control cannot request identity or dispatch", async () => { await assert.rejects(() => verifyRunningHostIdentity(undefined, "", "", async () => undefined), /provider dispatch refused/); });
test("normalized host slot rejects missing, malformed and duplicate slots; reader code stays hashed", () => {
  assert.equal(normalizeHostArtifact(slot), slot);
  for (const invalid of ["", slot + slot, slot.replace("BEGIN__", "WRONG__"), slot + '\"__FLUXIQ_HOST_IDENTITY_BEGIN__missing-end\"']) assert.throws(() => normalizeHostArtifact(invalid));
  assert.notEqual(hash(normalizeHostArtifact(slot + "real=1")), hash(normalizeHostArtifact(slot + "real=2")));
});
test("complete inventory/source/artifact freshness refuses every unbuilt input change", async t => {
  for (const defect of ["source", "generator", "cache", "artifact", "new-source", "new-generator", "new-cache", "omitted-key", "missing-stamp", "bad-slot"]) await t.test(defect, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lab-host-identity-"));
    try {
      const inputs = { "domain/src/read.ts": "source", "domain/scripts/build.mjs": "generator", "scripts/build-cache/steps.mjs": "cache", "domain/package.json": '{"version":"0.1.0"}' };
      const sources: Record<string, string> = {};
      for (const key of Object.keys(inputs).sort()) { await mkdir(path.dirname(path.join(root, key)), { recursive: true }); const bytes = inputs[key as keyof typeof inputs]; await writeFile(path.join(root, key), bytes); sources[key] = hash(bytes); }
      const host = path.join(root, "host.mjs"); await writeFile(host, slot + ";const readerSemantics=1;");
      const expected = { ...identity, artifactDigest: hash(normalizeHostArtifact(await readFile(host, "utf8"))), sourceInputsDigest: hash(JSON.stringify(sources)) };
      const receipt = { identity: expected, sources }; await writeFile(`${host}.identity.json`, JSON.stringify(receipt));
      assert.deepEqual(await expectedHostIdentity(root, host), expected);
      const edits: Record<string, string> = { source: "domain/src/read.ts", generator: "domain/scripts/build.mjs", cache: "scripts/build-cache/steps.mjs", artifact: "host.mjs", "new-source": "domain/src/new.ts", "new-generator": "domain/scripts/new.mjs", "new-cache": "scripts/build-cache/new.mjs" };
      if (edits[defect]) await writeFile(path.join(root, edits[defect]!), "changed");
      if (defect === "omitted-key") { delete receipt.sources["domain/src/read.ts"]; await writeFile(`${host}.identity.json`, JSON.stringify(receipt)); }
      if (defect === "missing-stamp") await rm(`${host}.identity.json`);
      if (defect === "bad-slot") await writeFile(host, slot + slot);
      let chats = 0;
      await assert.rejects(async () => { await verifyRunningHostIdentity({ readRuntimeBuildIdentity: async () => { chats++; return {}; } }, root, host, async () => undefined); }, /provider dispatch refused/);
      assert.equal(chats, 0);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});
test("host gate precedes project/browser/chat and copies the companion stamp to each Lab instance", async () => {
  const root = fileURLToPath(new URL("../../../../../../..", import.meta.url));
  const source = await readFile(path.join(root, "packages/test-runner/src/run-scenario.ts"), "utf8");
  const gate = source.indexOf("await verifyRunningHostIdentity(");
  assert.ok(gate > source.indexOf("await verifyRunningCoreIdentity("));
  for (const token of ["await prepareIndependentCreationProject(", "await launchBrowser(", "const chat = buildEntry"]) assert.ok(gate < source.indexOf(token));
  const launcher = await readFile(path.join(root, "scripts/lab/run-lab.mjs"), "utf8");
  assert.ok(launcher.includes('await copyFile(`${paths.sharedHostModule}.identity.json`, `${paths.hostModule}.identity.json`)'));
});
