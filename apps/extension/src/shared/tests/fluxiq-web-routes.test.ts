// The keys page of the FluxIQ web panel is Settings, at AI keys, on the configured address.

import assert from "node:assert/strict";
import test from "node:test";
import { fluxIQWebPageAddress } from "../fluxiq-web-routes";

test("the keys page is Settings at AI keys, at the root of the configured address", () => {
  assert.equal(fluxIQWebPageAddress("https://flux.example/app/?a=1#b", { kind: "keys" }), "https://flux.example/settings#ai-keys");
  assert.equal(fluxIQWebPageAddress("http://127.0.0.1:3100", { kind: "keys" }), "http://127.0.0.1:3100/settings#ai-keys");
  assert.equal(fluxIQWebPageAddress(undefined, { kind: "keys" }), "http://127.0.0.1:3000/settings#ai-keys");
});

test("only http and https addresses are opened", () => {
  assert.equal(fluxIQWebPageAddress("ftp://flux.example", { kind: "keys" }), undefined);
  assert.equal(fluxIQWebPageAddress("not an address", { kind: "keys" }), undefined);
});

test("other pages keep their paths", () => {
  assert.equal(fluxIQWebPageAddress("http://127.0.0.1:3100", { kind: "projects" }), "http://127.0.0.1:3100/projects");
  assert.equal(fluxIQWebPageAddress("http://127.0.0.1:3100", { kind: "data" }), "http://127.0.0.1:3100/data");
});
