import assert from "node:assert/strict";
import test from "node:test";
import { webcrypto } from "node:crypto";
import { FLUXIQ_CONNECT_CLIENT_ID, connectAuthorizeRequestSchema } from "@fluxiq/contracts/platform";
import { createPkceChallenge, createPkceMaterial } from "../crypto";
import { createHostedPkceProtocol } from "..";
import { deferred, discovery, fixture, tokenResponse, waiting } from "./fixture";

test("S256 uses the fixed RFC PKCE vector and independent entropy", async () => {
  assert.equal(await createPkceChallenge("dBjftJeZ4CVP-mB92K27uhbUJU1p1r_wW1gFWFOEjXk", webcrypto as unknown as Crypto), "E9Melhoa2OwvFrEMTJguCHaoeK1t8URWbuGJSstw-cM");
  const material = createPkceMaterial(webcrypto as unknown as Crypto);
  assert.equal(new Set(Object.values(material)).size, 3);
  assert.ok([material.state, material.verifier].every(value => /^[A-Za-z0-9_-]{43}$/u.test(value)));
  assert.match(material.attemptId, /^attempt\.[A-Za-z0-9_-]{43}$/u);
});

test("attempt identity accepts every random leading byte without revealing state or verifier", () => {
  let calls = 0;
  const crypto = { ...webcrypto, getRandomValues: (bytes: Uint8Array) => {
    calls += 1;
    assert.equal(bytes.length, 32);
    bytes.fill(calls === 3 ? 255 : calls);
    return bytes;
  } } as unknown as Crypto;
  const material = createPkceMaterial(crypto);
  assert.match(material.attemptId, /^attempt\.[A-Za-z0-9_-]{43}$/u);
  assert.equal(calls, 3);
  assert.equal(material.attemptId.includes(material.state), false);
  assert.equal(material.attemptId.includes(material.verifier), false);
});

test("start persists blank ownership before navigation and emits actual authorize schema only", async () => {
  const t = fixture();
  const result = await t.protocol.start();
  assert.equal(result.phase, "waiting");
  assert.deepEqual(Object.keys(result).sort(), ["attemptId", "phase"]);
  assert.deepEqual(t.state.events, ["preparing", "blank", "owned", "waiting", "navigate"]);
  const record = waiting(t);
  assert.equal(t.authenticationTabs.owns(12, record.attemptId), true);
  const url = new URL(t.state.navigations[0]!.url);
  const fields = connectAuthorizeRequestSchema.parse(Object.fromEntries(url.searchParams));
  assert.equal(fields.client_id, FLUXIQ_CONNECT_CLIENT_ID);
  assert.equal(fields.redirect_uri, "https://core.example.test/connect/done");
  assert.equal(fields.client_install_id, record.installId);
  assert.equal(fields.state, record.state);
  assert.equal(fields.code_challenge, await createPkceChallenge(record.verifier, t.options.crypto));
  assert.equal(url.href.includes(record.verifier), false);
  assert.equal(JSON.stringify(result).includes(record.state), false);
  assert.equal(t.state.requests[0]!.options.credentials, "omit");
});

const unsupported: { name: string; change: (document: ReturnType<typeof discovery>) => unknown; code: string }[] = [
  { name: "missing capability", change: value => ({ ...value, connect: { ...value.connect, flows: undefined } }), code: "unsupported_server" },
  { name: "disabled PKCE", change: value => ({ ...value, connect: { ...value.connect, flows: { authorizationCodePkce: false, referenceCode: true } } }), code: "unsupported_server" },
  { name: "no stable instance", change: value => ({ ...value, instance: { name: "Core", profile: "service" } }), code: "unsupported_server" },
  { name: "foreign origin", change: value => ({ ...value, origin: "https://other.example.test" }), code: "discovery_invalid" },
  { name: "local profile", change: value => ({ ...value, instance: { ...value.instance, profile: "local" } }), code: "unsupported_server" },
  { name: "unsupported gateway", change: value => ({ ...value, protocols: { clientGateway: ["9.9"] } }), code: "unsupported_server" },
  { name: "missing extension minimum", change: value => ({ ...value, minimumClient: {} }), code: "client_incompatible" },
  { name: "minimum newer", change: value => ({ ...value, minimumClient: { "browser-extension": "1.2.4" } }), code: "client_incompatible" }
];
for (const item of unsupported) test(`start refuses ${item.name} without creating a tab`, async () => {
  const t = fixture();
  t.state.document = item.change(discovery());
  assert.equal((await t.protocol.start()).failureCode, item.code);
  assert.equal(t.state.events.includes("blank"), false);
});

test("selection is copied and permanently retires when its generation changes", async () => {
  const t = fixture();
  t.selection.origin = "https://other.example.test";
  assert.equal((await t.protocol.start()).phase, "waiting");
  assert.equal(t.state.requests[0]!.url, "https://core.example.test/.well-known/fluxiq");
  t.state.current = false;
  assert.equal((await t.protocol.restore()).failureCode, "selection_changed");
  t.state.current = true;
  assert.equal((await t.protocol.restore()).failureCode, "selection_changed");
});

test("failed ownership cannot navigate and never creates trust", async () => {
  const t = fixture();
  t.state.ownershipFail = true;
  assert.equal((await t.protocol.start()).failureCode, "ownership_unavailable");
  assert.equal(t.state.navigations.length, 0);
  assert.equal(await t.bound.read(), null);
});

test("cancellation progresses while createBlank awaits and blocks late navigation", async () => {
  const t = fixture();
  const entered = deferred();
  const gate = deferred();
  t.state.beforeBlank = async () => {
    entered.resolve();
    await gate.promise;
  };
  const start = t.protocol.start();
  await entered.promise;
  assert.equal((await t.protocol.cancel()).phase, "cancelled");
  gate.resolve();
  assert.equal((await start).phase, "cancelled");
  assert.equal(t.state.navigations.length, 0);
  assert.equal(t.state.attempt?.phase, "terminal");
  assert.equal(JSON.stringify(t.state.attempt).includes('"verifier"'), false);
});

test("existing trust requires explicit transition and invalid config throws fixed error", async () => {
  const t = fixture();
  await t.bound.getOrCreateInstallation();
  await t.bound.commit({ operationId: "synthetic-existing", expectedRevision: 0, kind: "new-trust", response: tokenResponse() });
  assert.equal((await t.protocol.start()).failureCode, "trust_transition_required");
  assert.throws(() => createHostedPkceProtocol({ ...t.options, selection: { ...t.selection, origin: "https://core.example.test/path" } }), { message: "hosted_pkce.configuration_invalid" });
});
