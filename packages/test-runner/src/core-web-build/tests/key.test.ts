// The build key covers every input a Core web build depends on: changing any
// single one of them yields a different key.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import test from "node:test";
import { coreWebBuildKey } from "../key.js";
import type { CoreWebBuildInputs } from "../types.js";

const gatewayDist = "3".repeat(64);
const contractsDist = "4".repeat(64);
const fluxiqDist = "5".repeat(64);
const base: CoreWebBuildInputs = {
  lockfileHash: "1".repeat(64),
  webSourceHash: "2".repeat(64),
  serverAdapterSourcesHash: "0".repeat(64),
  packageHashes: { "client-gateway-websocket": gatewayDist, contracts: contractsDist, fluxiq: fluxiqDist },
  nextConfig: 'export default {\n  transpilePackages: ["fluxiq"],\n  turbopack: { root: "F:\\\\" },\n};\n',
  nextVersion: "15.5.23",
};

test("the key is a stable 24-character hex digest that does not depend on package order", () => {
  const key = coreWebBuildKey(base);
  assert.match(key, /^[0-9a-f]{24}$/u);
  assert.equal(coreWebBuildKey({ ...base }), key);
  assert.equal(coreWebBuildKey({ ...base, packageHashes: { fluxiq: fluxiqDist, contracts: contractsDist, "client-gateway-websocket": gatewayDist } }), key);
});

test("changing any single input changes the key", () => {
  const variants: Array<[string, CoreWebBuildInputs]> = [
    ["Core lockfile", { ...base, lockfileHash: "6".repeat(64) }],
    ["web source", { ...base, webSourceHash: "7".repeat(64) }],
    ["gateway server sources", { ...base, serverAdapterSourcesHash: "a".repeat(64) }],
    ["client-gateway-websocket dist", { ...base, packageHashes: { ...base.packageHashes, "client-gateway-websocket": "8".repeat(64) } }],
    ["contracts dist", { ...base, packageHashes: { ...base.packageHashes, contracts: "8".repeat(64) } }],
    ["fluxiq dist", { ...base, packageHashes: { ...base.packageHashes, fluxiq: "8".repeat(64) } }],
    ["an added built package", { ...base, packageHashes: { ...base.packageHashes, extra: "9".repeat(64) } }],
    ["generated Next config", { ...base, nextConfig: base.nextConfig.replace("F:", "G:") }],
    ["Next version", { ...base, nextVersion: "15.5.24" }],
  ];
  const key = coreWebBuildKey(base);
  const keys = new Set([key]);
  for (const [name, inputs] of variants) {
    const changed = coreWebBuildKey(inputs);
    assert.notEqual(changed, key, name);
    keys.add(changed);
  }
  assert.equal(keys.size, variants.length + 1, "every variant has a key of its own");
});

test("no input set yields the key a layout-2 build was published under", () => {
  // Layout 2 staged Core's tsconfig verbatim, so its panels compiled Core from
  // source and served the unstamped runtime identity placeholder (t342, B1).
  // Core's tsconfig did not change with the fix, so without a new layout the
  // broken panel already published under the old key would be reused.
  const layoutTwo = createHash("sha256").update(JSON.stringify({
    layout: 2,
    lockfileHash: base.lockfileHash,
    webSourceHash: base.webSourceHash,
    packages: Object.keys(base.packageHashes).sort().map(name => [name, base.packageHashes[name]]),
    nextConfig: base.nextConfig,
    nextVersion: base.nextVersion,
  })).digest("hex").slice(0, 24);
  assert.notEqual(coreWebBuildKey(base), layoutTwo);
});

test("the key material is pinned at layout 3", () => {
  // 3: the staged tsconfig drops Core's source aliases, so the panel reads the
  // stamped dist; and the gateway server is keyed by its sources, not by
  // whether a run has generated its artifact yet.
  const expected = createHash("sha256").update(JSON.stringify({
    layout: 3,
    lockfileHash: base.lockfileHash,
    webSourceHash: base.webSourceHash,
    serverAdapterSourcesHash: base.serverAdapterSourcesHash,
    packages: Object.keys(base.packageHashes).sort().map(name => [name, base.packageHashes[name]]),
    nextConfig: base.nextConfig,
    nextVersion: base.nextVersion,
  })).digest("hex").slice(0, 24);
  assert.equal(coreWebBuildKey(base), expected);
});
