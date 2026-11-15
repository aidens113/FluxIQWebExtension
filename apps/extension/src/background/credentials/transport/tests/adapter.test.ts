import assert from "node:assert/strict";
import test from "node:test";
import { checkHostedCredentialBinding } from "../../binding";
import { createHostedCredentialTokenStorage } from "../index";
import { discovery, response } from "../../tests/fixture";
import { adapterFixture } from "./fixture";

test("hosted read and rotation use the durable exact trust, server expiry and original lineage", async () => {
  const setup = await adapterFixture();
  assert.equal(await setup.adapter.read(), setup.snapshot.credential);
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  const rotated = (await setup.port.read())!;
  assert.equal(rotated.credential, setup.grant.credential);
  assert.equal(rotated.expiresAtMs, 30_000);
  assert.equal(rotated.revision, 2);
  assert.equal(rotated.lineageId, setup.snapshot.lineageId);
  assert.equal(rotated.lineageKey, setup.snapshot.lineageKey);
  assert.equal(rotated.connectedClientId, setup.snapshot.connectedClientId);
  assert.deepEqual(await setup.port.pendingRevocations(), []);
  assert.equal(await setup.adapter.read(), rotated.credential);
});

test("hosted write requires a completed hello read and actual metadata", async () => {
  const setup = await adapterFixture();
  await assert.rejects(setup.adapter.write(setup.grant.credential, setup.metadata), { code: "hello_required" });
  await setup.adapter.read();
  await assert.rejects(setup.adapter.write(setup.grant.credential), { code: "metadata_missing" });
  for (const patch of [{ user: undefined }, { workspace: undefined }, { credentialExpiresAt: undefined }, { credentialExpiresAt: Number.MAX_SAFE_INTEGER + 1 }, { messageId: "" }, { messageId: "x".repeat(257) }, { messageId: "contains\ncontrol" }, { sessionId: "" }, { projectId: 2 }, { gatewayUrl: "wss://foreign.example.test/client" }]) {
    await assert.rejects(Reflect.apply(setup.adapter.write, setup.adapter, [setup.grant.credential, { ...setup.metadata, ...patch }]), { code: "metadata_invalid" });
  }
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("wrong ready user/workspace and expired server metadata cannot change the prior credential", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await assert.rejects(setup.adapter.write(setup.grant.credential, { ...setup.metadata, user: { ...setup.metadata.user!, userId: "foreign-user" } }), { code: "trust_changed" });
  await assert.rejects(setup.adapter.write(setup.grant.credential, { ...setup.metadata, workspace: { ...setup.metadata.workspace!, workspaceId: "foreign-workspace" } }), { code: "trust_changed" });
  await assert.rejects(setup.adapter.write(setup.grant.credential, { ...setup.metadata, credentialExpiresAt: setup.state.now }), { code: "credential_expired" });
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("a replaced trust lineage or constructor identity is refused without returning a token", async () => {
  const setup = await adapterFixture();
  for (const patch of [{ userId: "foreign-user" }, { workspaceId: "foreign-workspace" }, { connectedClientId: "foreign-client" }, { installId: "foreign-install" }, { lineageId: "foreign-lineage" }, { lineageKey: "foreign-key" }]) {
    const adapter = createHostedCredentialTokenStorage({ repository: setup.repository, snapshot: { ...setup.snapshot, ...patch }, isCurrent: setup.isCurrent });
    await assert.rejects(adapter.read(), { code: "trust_changed" });
  }
  await setup.port.commit({ operationId: "fresh-new-trust", expectedRevision: 1, kind: "new-trust", response: response(setup.binding) });
  await assert.rejects(setup.adapter.read(), { code: "trust_changed" });
});

test("foreign binding/gateway cannot borrow the current trust snapshot", async () => {
  const setup = await adapterFixture();
  const document = discovery();
  const binding = checkHostedCredentialBinding({ ...document, gatewayUrl: "wss://separate.example.test/client" }, document.origin);
  const adapter = createHostedCredentialTokenStorage({ repository: setup.repository, snapshot: { ...setup.snapshot, binding }, isCurrent: setup.isCurrent });
  await assert.rejects(adapter.read(), { code: "trust_changed" });
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("metadata and expected revision are snapshotted before async hashing", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  const metadata = structuredClone(setup.metadata);
  const writing = setup.adapter.write(setup.grant.credential, metadata);
  metadata.user!.userId = "late-user";
  metadata.workspace!.workspaceId = "late-workspace";
  Reflect.set(metadata, "messageId", "late-message");
  await writing;
  assert.equal((await setup.port.read())?.userId, setup.snapshot.userId);
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  assert.equal((await setup.port.read())?.revision, 2);
});

test("closed storage and unexpected input/guard exceptions expose fixed errors only", async () => {
  const setup = await adapterFixture();
  assert.throws(() => createHostedCredentialTokenStorage({ repository: setup.repository, snapshot: setup.snapshot, isCurrent: () => { throw new Error(setup.snapshot.credential); } }), { code: "selection_changed" });
  await setup.adapter.read();
  const metadata = { get messageId() { throw new Error(setup.snapshot.credential); } };
  await assert.rejects(Reflect.apply(setup.adapter.write, setup.adapter, [setup.grant.credential, metadata]), error => {
    assert.equal((error as Error).message, "The selected hosted credential could not be used or stored.");
    assert.equal(JSON.stringify(error).includes(setup.snapshot.credential), false);
    assert.equal((error as Error).cause, undefined);
    return true;
  });
  await setup.repository.close();
  await assert.rejects(setup.adapter.read(), { code: "repository_closed" });
});
