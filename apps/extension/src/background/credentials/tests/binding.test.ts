import assert from "node:assert/strict";
import test from "node:test";
import { checkHostedCredentialBinding } from "../index";
import { discovery, fixture, response, seed } from "./fixture";

test("hosted binding requires a real instance id and exact secure discovery origin", () => {
  const document = discovery();
  for (const instance of [{ name: "Core", profile: "service" }, { ...document.instance, id: "" }]) assert.throws(() => checkHostedCredentialBinding({ ...document, instance }, document.origin), { code: "binding_invalid" });
  assert.throws(() => checkHostedCredentialBinding(document, "https://different.example.test"), { code: "binding_invalid" });
  assert.throws(() => checkHostedCredentialBinding(discovery("http://remote.example.test"), "http://remote.example.test"), { code: "binding_invalid" });
  assert.throws(() => checkHostedCredentialBinding({ ...document, gatewayUrl: "ws://remote.example.test/client" }, document.origin), { code: "binding_invalid" });
});

test("binding refuses foreign HTTP endpoints, URL credentials, wildcard and noncanonical URLs", () => {
  const document = discovery();
  for (const tokenUrl of ["https://foreign.example.test/token", "//foreign.example.test/token", "/api/connect/token#fragment"]) assert.throws(() => checkHostedCredentialBinding({ ...document, connect: { ...document.connect, tokenUrl } }, document.origin), { code: "binding_invalid" });
  for (const gatewayUrl of ["wss://person:password@core.example.test/client", "wss://*.example.test/client", "wss://CORE.EXAMPLE.TEST/client"]) assert.throws(() => checkHostedCredentialBinding({ ...document, gatewayUrl }, document.origin), { code: "binding_invalid" });
});

test("binding preserves advertised secure gateway origin and explicit loopback schemes", () => {
  const document = discovery();
  const separated = checkHostedCredentialBinding({ ...document, gatewayUrl: "wss://gateway.example.test/client" }, document.origin);
  assert.equal(separated.gatewayUrl, "wss://gateway.example.test/client");
  const local = { ...discovery("http://127.0.0.1:3000"), instance: { id: "local-instance", name: "Local", profile: "local" }, gatewayUrl: "ws://127.0.0.1:3000/client" };
  assert.equal(checkHostedCredentialBinding(local, local.origin).origin, local.origin);
  assert.ok(Object.isFrozen(separated));
});

test("independent origins and changed instance/gateway/endpoints cannot retrieve another binding's credential", async () => {
  const setup = fixture();
  const initial = await seed(setup);
  const document = discovery();
  const alternatives = [
    discovery("https://other.example.test"), discovery(document.origin, "instance-two"),
    { ...document, gatewayUrl: "wss://core.example.test/other-client" },
    { ...document, connect: { ...document.connect, tokenUrl: "/api/other-token" } }
  ];
  const ids = new Set([initial.installId]);
  for (const alternative of alternatives) {
    const binding = checkHostedCredentialBinding(alternative, alternative.origin);
    const port = setup.repository.forBinding(binding);
    assert.equal(await port.read(), null);
    const installation = await port.getOrCreateInstallation();
    ids.add(installation.installId);
    const credential = await port.commit({ operationId: "initial-commit", expectedRevision: 0, kind: "new-trust", response: response(binding) });
    assert.notEqual(credential.lineageKey, initial.lineageKey);
  }
  assert.equal(ids.size, 5);
  assert.equal((await setup.port.read())?.credential, initial.credential);
  assert.throws(() => setup.repository.forBinding({ ...setup.binding }), { code: "binding_invalid" });
});
