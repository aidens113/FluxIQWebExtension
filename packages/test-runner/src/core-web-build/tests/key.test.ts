// The build key covers every input a Core web build depends on: changing any
// single one of them yields a different key.
import assert from "node:assert/strict";
import test from "node:test";
import { coreWebBuildKey } from "../key.js";
import type { CoreWebBuildInputs } from "../types.js";

const gatewayDist = "3".repeat(64);
const contractsDist = "4".repeat(64);
const fluxiqDist = "5".repeat(64);
const base: CoreWebBuildInputs = {
  coreHead: "1".repeat(40),
  webSourceHash: "2".repeat(64),
  packageDistHashes: { "client-gateway-websocket": gatewayDist, contracts: contractsDist, fluxiq: fluxiqDist },
  nextConfig: 'export default {\n  transpilePackages: ["fluxiq"],\n  turbopack: { root: "F:\\\\" },\n};\n',
  nextVersion: "15.5.23",
};

test("the key is a stable 24-character hex digest that does not depend on package order", () => {
  const key = coreWebBuildKey(base);
  assert.match(key, /^[0-9a-f]{24}$/u);
  assert.equal(coreWebBuildKey({ ...base }), key);
  assert.equal(coreWebBuildKey({ ...base, packageDistHashes: { fluxiq: fluxiqDist, contracts: contractsDist, "client-gateway-websocket": gatewayDist } }), key);
});

test("changing any single input changes the key", () => {
  const variants: Array<[string, CoreWebBuildInputs]> = [
    ["Core HEAD", { ...base, coreHead: "6".repeat(40) }],
    ["web source", { ...base, webSourceHash: "7".repeat(64) }],
    ["client-gateway-websocket dist", { ...base, packageDistHashes: { ...base.packageDistHashes, "client-gateway-websocket": "8".repeat(64) } }],
    ["contracts dist", { ...base, packageDistHashes: { ...base.packageDistHashes, contracts: "8".repeat(64) } }],
    ["fluxiq dist", { ...base, packageDistHashes: { ...base.packageDistHashes, fluxiq: "8".repeat(64) } }],
    ["an added built package", { ...base, packageDistHashes: { ...base.packageDistHashes, extra: "9".repeat(64) } }],
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
