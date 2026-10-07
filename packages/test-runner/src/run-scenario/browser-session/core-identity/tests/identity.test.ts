import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import os from "node:os";
import { fileURLToPath } from "node:url";
import test from "node:test";
import { assertRuntimeIdentityMatch, expectedRuntimeIdentity, normalizeRuntimeIdentityReader, screenRuntimeIdentity, verifyRunningCoreIdentity, requiresCoreRuntimeIdentity } from "../index.js";

const identity = { schema: 1, protocol: "fluxiq.core-runtime-identity.v1", version: "0.7.0", normalization: "reader-payload-v1", artifactDigest: "a".repeat(64) } as const;
const expected = { identity, reachedInputs: ["packages/fluxiq/dist/core/index.js"], reachedInputsDigest: "b".repeat(64) };
test("matching actual runtime identity allows dispatch and screens arbitrary data", () => {
  assert.doesNotThrow(() => assertRuntimeIdentityMatch(expected, { ok: true, payload: { identity, reachedInputsDigest: expected.reachedInputsDigest } }));
  assert.deepEqual(screenRuntimeIdentity({ ...identity, token: "private", page: "private" }), identity);
});
for (const field of ["artifactDigest", "version", "normalization", "protocol", "schema", "reachedInputsDigest"]) test(`actual ${field} mismatch refuses before provider dispatch`, () => {
  let dispatches = 0;
  const payload = { identity: { ...identity, ...(field === "reachedInputsDigest" ? {} : { [field]: "different" }) }, reachedInputsDigest: field === "reachedInputsDigest" ? "c".repeat(64) : expected.reachedInputsDigest };
  assert.throws(() => { assertRuntimeIdentityMatch(expected, { ok: true, payload }); dispatches++; }, /provider dispatch refused/);
  assert.equal(dispatches, 0);
});
test("missing/legacy/failed runtime identity refuses", () => {
  for (const reply of [null, {}, { ok: false }, { ok: true, payload: { identity: {}, reachedInputsDigest: expected.reachedInputsDigest } }]) assert.throws(() => assertRuntimeIdentityMatch(expected, reply));
});
test("missing authenticated control refuses without a request", async () => { await assert.rejects(() => verifyRunningCoreIdentity(undefined, "", "", async () => undefined), /provider dispatch refused/); });
test("live and Flow lanes lacking control cannot reach chat; offline recording skips only without paid capability", async () => {
  for (const [live, flowLane] of [[true, false], [false, true], [true, true]]) {
    let chat = 0;
    await assert.rejects(async () => {
      if (requiresCoreRuntimeIdentity(live!, flowLane!, undefined)) await verifyRunningCoreIdentity(undefined, "", "", async () => undefined);
      chat++;
    }, /provider dispatch refused/);
    assert.equal(chat, 0);
  }
  assert.equal(requiresCoreRuntimeIdentity(false, false, undefined), false);
  assert.equal(requiresCoreRuntimeIdentity(false, false, {}), true);
});

test("disk source, artifact and surrounding reader changes refuse; payload-only normalization is precise", async () => {
  const root = await mkdtemp(path.join(os.tmpdir(), "lab-core-stamp-"));
  const reader = "packages/fluxiq/dist/runtime/build-identity/read.js", source = "packages/fluxiq/src/core/index.ts", artifact = "packages/fluxiq/dist/core/index.js";
  const code = '/* core-runtime-identity:start */\nconst embedded = \'{"fluxiqRuntimeIdentityPlaceholder":302}\';\n/* core-runtime-identity:end */\nconst real = 1;';
  const hash = (text: string) => createHash("sha256").update(text).digest("hex");
  try {
    for (const [file, bytes] of [[reader, code], [source, "source"], [artifact, "executed"]]) { await mkdir(path.dirname(path.join(root, file!)), { recursive: true }); await writeFile(path.join(root, file!), bytes!); }
    const contractSource = "packages/contracts/src/index.ts", contractArtifact = "packages/contracts/dist/index.js";
    for (const [file, bytes] of [[contractSource, "contract-source"], [contractArtifact, "contract-artifact"], ["packages/contracts/package.json", "{}"], ["packages/fluxiq/package.json", "{}"]]) {
      await mkdir(path.dirname(path.join(root, file!)), { recursive: true }); await writeFile(path.join(root, file!), bytes!);
    }
    const artifacts = { [artifact]: hash("executed"), [reader]: hash(normalizeRuntimeIdentityReader(code)), [contractArtifact]: hash("contract-artifact") };
    const artifactDigest = hash(JSON.stringify(Object.entries(artifacts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
    const stamp = { identity: { ...identity, artifactDigest, artifacts }, sources: { [source]: hash("source"), [contractSource]: hash("contract-source"), "packages/contracts/package.json": hash("{}"), "packages/fluxiq/package.json": hash("{}") } };
    await writeFile(path.join(root, "packages/fluxiq/dist/runtime-build-identity.json"), JSON.stringify(stamp));
    await writeFile(path.join(root, "build-info.json"), JSON.stringify({ inputs: { [`../!FluxIQ/${artifact}`]: artifacts[artifact] } }));
    const wanted = await expectedRuntimeIdentity(root, root);
    assert.equal(wanted.identity.artifactDigest, artifactDigest);
    for (const file of [source, artifact, reader]) {
      const before = await readFile(path.join(root, file), "utf8");
      await writeFile(path.join(root, file), before + "\nchanged executed semantics");
      await assert.rejects(() => expectedRuntimeIdentity(root, root), /provider dispatch refused/);
      await writeFile(path.join(root, file), before);
    }
    await writeFile(path.join(root, reader), code.replace('{"fluxiqRuntimeIdentityPlaceholder":302}', '{"payloadOnly":true}'));
    await expectedRuntimeIdentity(root, root);
    await writeFile(path.join(root, reader), code + code);
    await assert.rejects(() => expectedRuntimeIdentity(root, root), /provider dispatch refused/);
  } finally { await rm(root, { recursive: true, force: true }); }
});
test("complete inventory refuses added source, added artifact and omitted source key", async (t) => {
  for (const defect of ["added-source", "added-artifact", "omitted-source-key"]) await t.test(defect, async () => {
    const root = await mkdtemp(path.join(os.tmpdir(), "lab-core-inventory-"));
    const reader = "packages/fluxiq/dist/runtime/build-identity/read.js";
    const code = '/* core-runtime-identity:start */\nconst embedded = \'{"fluxiqRuntimeIdentityPlaceholder":302}\';\n/* core-runtime-identity:end */';
    const hash = (text: string) => createHash("sha256").update(text).digest("hex");
    const sources: Record<string, string> = {}, artifacts: Record<string, string> = {};
    try {
      for (const pkg of ["contracts", "fluxiq"]) {
        for (const [file, bytes] of [[`packages/${pkg}/src/index.ts`, "source"], [`packages/${pkg}/dist/index.js`, "artifact"], [`packages/${pkg}/package.json`, '{"version":"0.7.0"}']]) {
          await mkdir(path.dirname(path.join(root, file!)), { recursive: true }); await writeFile(path.join(root, file!), bytes!);
          (file!.includes("/dist/") ? artifacts : sources)[file!] = hash(bytes!);
        }
      }
      await mkdir(path.dirname(path.join(root, reader)), { recursive: true }); await writeFile(path.join(root, reader), code);
      artifacts[reader] = hash(normalizeRuntimeIdentityReader(code));
      // A malformed synthetic receipt is constructed here; actual generated stamps are untouched.
      if (defect === "omitted-source-key") delete sources["packages/contracts/src/index.ts"];
      const artifactDigest = hash(JSON.stringify(Object.entries(artifacts).sort(([a], [b]) => a < b ? -1 : a > b ? 1 : 0)));
      await writeFile(path.join(root, "packages/fluxiq/dist/runtime-build-identity.json"), JSON.stringify({ identity: { ...identity, artifactDigest, artifacts }, sources }));
      await writeFile(path.join(root, "build-info.json"), JSON.stringify({ inputs: { "../!FluxIQ/packages/fluxiq/dist/index.js": artifacts["packages/fluxiq/dist/index.js"] } }));
      if (defect !== "omitted-source-key") {
        await expectedRuntimeIdentity(root, root);
        const added = defect === "added-source" ? "packages/contracts/src/added.ts" : "packages/fluxiq/dist/added.js";
        await writeFile(path.join(root, added), "new unlisted input");
      }
      await assert.rejects(() => expectedRuntimeIdentity(root, root), /provider dispatch refused/);
    } finally { await rm(root, { recursive: true, force: true }); }
  });
});

test("Core gate precedes project setup, browser, chat and direct provider dispatch", async () => {
  const source = await readFile(fileURLToPath(new URL("../../../../../src/run-scenario.ts", import.meta.url)), "utf8");
  const check = source.indexOf("await verifyRunningCoreIdentity(");
  assert.ok(check > source.indexOf("topology.control?.recordProviderFailuresTo"));
  for (const token of ["await prepareIndependentCreationProject(", "await launchBrowser(", "const chat = buildEntry", 'type: "fluxiq.startRecording"']) assert.ok(check < source.indexOf(token));
});
