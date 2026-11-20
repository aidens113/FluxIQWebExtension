// The discovery probe: a FluxIQ counts only for a valid discovery document that names the address it was fetched
// from. Any other answer, even HTTP 200, is not FluxIQ.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { discoveryProbe } from "../reader";

const document = (origin: string, extra: Record<string, unknown> = {}) => ({
  fluxiqDiscoveryVersion: 1,
  instance: { name: "FluxIQ", profile: "local" },
  origin,
  gatewayUrl: "ws://127.0.0.1:4877/client",
  connect: { authorizeUrl: "/connect/authorize", tokenUrl: "/api/connect/token", revokeUrl: "/api/connect/revoke", codeEntryUrl: "/connect" },
  protocols: { clientGateway: ["1.0"] },
  minimumClient: { "browser-extension": "0.1.0" },
  ...extra
});

function serving(t: TestContext, status: number, body: unknown): string[] {
  const asked: string[] = [];
  t.mock.method(globalThis, "fetch", async (url: string) => {
    asked.push(String(url));
    return { status, json: async () => (body instanceof Error ? Promise.reject(body) : body) } as unknown as Response;
  });
  return asked;
}

test("a valid discovery document at the address is FluxIQ, and its connection address is the document's", async (t) => {
  const asked = serving(t, 200, document("http://127.0.0.1:3100"));
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3100/some/page?x=1"), { found: true, gatewayUrl: "ws://127.0.0.1:4877/client" });
  assert.deepEqual(asked, ["http://127.0.0.1:3100/.well-known/fluxiq"]);
});

test("any other page that answers 200 is not FluxIQ", async (t) => {
  serving(t, 200, { hello: "world" });
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3000"), { found: false });
});

test("an answer that is not JSON, or an error status, is not FluxIQ", async (t) => {
  serving(t, 200, new Error("<html>"));
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3000"), { found: false });
  serving(t, 404, document("http://127.0.0.1:3000"));
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3000"), { found: false });
});

test("a document that names another origin than the one asked is refused, and so is one with no connection address", async (t) => {
  serving(t, 200, document("http://127.0.0.1:3999"));
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3100"), { found: false });
  serving(t, 200, document("http://127.0.0.1:3100", { gatewayUrl: "https://elsewhere.example/client" }));
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3100"), { found: false });
});

test("a network failure or an address that is not a URL is not FluxIQ", async (t) => {
  t.mock.method(globalThis, "fetch", async () => {
    throw new TypeError("failed to fetch");
  });
  assert.deepEqual(await discoveryProbe("http://127.0.0.1:3100"), { found: false });
  assert.deepEqual(await discoveryProbe("not an address"), { found: false });
});
