import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import test from "node:test";
import { hostIdentitySlot, hostSourceInventory, stampHostBuildIdentity } from "../index.mjs";
const payload = Buffer.from('{"fluxiqHostIdentityPlaceholder":305}').toString("base64");
const slot = JSON.stringify(`__FLUXIQ_HOST_IDENTITY_BEGIN__${payload}__FLUXIQ_HOST_IDENTITY_END__`);
test("one normalized slot hashes all surrounding semantics and refuses malformed/multiple slots", () => {
  const code = `const identity = ${slot}; const executed = 1;`;
  assert.equal(hostIdentitySlot(code), code);
  const identity = { schema: 1, protocol: "fluxiq.module-build-identity.v1", moduleId: "@fluxiq-web-extension/domain-host", version: "0.1.0", normalization: "module-payload-v1", artifactDigest: "a".repeat(64), sourceInputsDigest: "b".repeat(64) };
  assert.equal(hostIdentitySlot(hostIdentitySlot(code, identity)), code);
  for (const malformed of ["no slot", code + code, code.replace(payload, "bad!"), code.replace(payload, Buffer.from('{}').toString('base64')), code + '"__FLUXIQ_HOST_IDENTITY_BEGIN__missing-end"']) assert.throws(() => hostIdentitySlot(malformed));
  const hash = text => createHash("sha256").update(hostIdentitySlot(text)).digest("hex");
  assert.notEqual(hash(code), hash(code.replace("executed = 1", "executed = 2")));
});
test("source inventory includes generator/cache additions and stamps independent source provenance", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "host-generator-"));
  try {
    for (const [file, text] of [["domain/src/read.ts", "reader"], ["domain/src/tests/ignored.ts", "test"], ["domain/scripts/build.mjs", "generator"], ["scripts/build-cache/steps.mjs", "cache"], ["domain/package.json", '{"version":"0.1.0"}']]) {
      await mkdir(path.dirname(path.join(root, file)), { recursive: true }); await writeFile(path.join(root, file), text);
    }
    const artifact = path.join(root, "host.mjs"); await writeFile(artifact, `const embedded = ${slot};`);
    const before = await stampHostBuildIdentity(root, artifact);
    const receipt = JSON.parse(await readFile(`${artifact}.identity.json`, "utf8"));
    assert.deepEqual(Object.keys(receipt.sources), await hostSourceInventory(root));
    assert.equal(Object.keys(receipt.sources).length, 4);
    await writeFile(path.join(root, "scripts/build-cache/new.mjs"), "cache addition");
    const after = await stampHostBuildIdentity(root, artifact);
    assert.equal(after.artifactDigest, before.artifactDigest); assert.notEqual(after.sourceInputsDigest, before.sourceInputsDigest);
    assert.ok(JSON.parse(await readFile(`${artifact}.identity.json`, "utf8")).sources["scripts/build-cache/new.mjs"]);
  } finally { await rm(root, { recursive: true, force: true }); }
});
