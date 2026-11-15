import assert from "node:assert/strict";
import test from "node:test";
import { createHostedCredentialTokenStorage } from "../index";
import { response } from "../../tests/fixture";
import { rawStore } from "../../tests/raw-store";
import { adapterFixture } from "./fixture";

test("exact ready replay is verified by the durable receipt in both original and recreated adapters", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  const snapshot = (await setup.port.read())!;
  await setup.repository.close();
  const repository = setup.reopen();
  const recreated = createHostedCredentialTokenStorage({ repository, snapshot, isCurrent: setup.isCurrent });
  assert.equal(await recreated.read(), setup.grant.credential);
  await recreated.write(setup.grant.credential, setup.metadata);
  assert.equal((await repository.forBinding(setup.binding).read())?.revision, 2);
  const receipts = await rawStore(setup.factory, setup.databaseName, "mutations");
  assert.equal(receipts.length, 2);
  assert.match(receipts[1]!.operationId as string, /^ready-[a-f0-9]{64}$/u);
});

test("same message id cannot be reused for different credential, expiry or summary payload", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  const snapshot = (await setup.port.read())!;
  const conflicts = [
    { token: "different-synthetic-credential".padEnd(48, "d"), metadata: setup.metadata },
    { token: setup.grant.credential, metadata: { ...setup.metadata, credentialExpiresAt: 40_000 } },
    { token: setup.grant.credential, metadata: { ...setup.metadata, user: { ...setup.metadata.user!, displayName: "Changed display" } } }
  ];
  for (const conflict of conflicts) await assert.rejects(setup.adapter.write(conflict.token, conflict.metadata), { code: "operation_conflict" });
  assert.deepEqual(await setup.port.read(), snapshot);
});

test("token equality with another message id cannot invent a successful prior commit", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  await assert.rejects(setup.adapter.write(setup.grant.credential, { ...setup.metadata, messageId: "different-message" }), { code: "revision_conflict" });
  assert.equal((await setup.port.read())?.revision, 2);
});

test("hello revision CAS prevents a late adapter write from overwriting a newer rotation", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  const external = await setup.port.commit({ operationId: "external-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding, { credential: "external-rotation-credential".padEnd(48, "e"), credentialExpiresAt: 40_000 }) });
  await assert.rejects(setup.adapter.write(setup.grant.credential, setup.metadata), { code: "revision_conflict" });
  assert.deepEqual(await setup.port.read(), external);
});

test("a frame predating Forget cannot resurrect trust or confirm an old receipt", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  await setup.port.forget({ operationId: "forget-rotated-trust", expectedRevision: 2 });
  await assert.rejects(setup.adapter.write(setup.grant.credential, setup.metadata), { code: "trust_changed" });
  assert.equal(await setup.port.read(), null);
});

test("transaction abort refuses adapter persistence and keeps its original durable credential", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  setup.state.onTransaction = transaction => {
    if (transaction.mode !== "readwrite") return;
    const request = transaction.objectStore("bindings").get("unused-test-key");
    request.addEventListener("success", () => transaction.abort());
  };
  await assert.rejects(setup.adapter.write(setup.grant.credential, setup.metadata), { code: "storage_unavailable" });
  delete setup.state.onTransaction;
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("a distinct rotation needs a fresh hello read while an exact duplicate may replay", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  await setup.adapter.write(setup.grant.credential, setup.metadata);
  const token = "next-hello-credential".padEnd(48, "n");
  const metadata = { ...setup.metadata, messageId: "ready-next-hello", sessionId: "wire.next-hello", credentialExpiresAt: 40_000 };
  await assert.rejects(setup.adapter.write(token, metadata), { code: "revision_conflict" });
  assert.equal((await setup.port.read())?.revision, 2);
  await setup.adapter.read();
  await setup.adapter.write(token, metadata);
  assert.equal((await setup.port.read())?.revision, 3);
});
