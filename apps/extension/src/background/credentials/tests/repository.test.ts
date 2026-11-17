import assert from "node:assert/strict";
import test from "node:test";
import { fixture, response, seed } from "./fixture";

test("credentials and install identity survive close/reopen with no active credential before adoption", async () => {
  const setup = fixture();
  assert.equal(await setup.port.read(), null);
  const installation = await setup.port.getOrCreateInstallation();
  assert.equal(installation.revision, 0);
  const adopted = await seed(setup);
  await setup.repository.close();
  await assert.rejects(setup.port.read(), { code: "repository_closed" });
  const reopened = setup.reopen().forBinding(setup.binding);
  assert.deepEqual(await reopened.getOrCreateInstallation(), { installId: installation.installId, revision: 1 });
  assert.deepEqual(await reopened.read(), adopted);
});

test("independent connections serialize competing installation creation and compare-and-swap", async () => {
  const setup = fixture();
  const ports = Array.from({ length: 6 }, () => setup.reopen().forBinding(setup.binding));
  const installations = await Promise.all(ports.map(port => port.getOrCreateInstallation()));
  assert.equal(new Set(installations.map(identity => identity.installId)).size, 1);
  const results = await Promise.allSettled(ports.map((port, index) => port.commit({ operationId: `competing-${index}`, expectedRevision: 0, kind: "new-trust", response: response(setup.binding, { credential: `synthetic-${index}-`.padEnd(48, "x") }) })));
  assert.equal(results.filter(result => result.status === "fulfilled").length, 1);
  for (const result of results) if (result.status === "rejected") assert.equal(result.reason.code, "revision_conflict");
  assert.equal((await setup.port.read())?.revision, 1);
});

test("the same logical commit is idempotent but operation id reuse binds exact payload and revision", async () => {
  const setup = fixture();
  await setup.port.getOrCreateInstallation();
  const request = { operationId: "logical-commit", expectedRevision: 0, kind: "new-trust" as const, response: response(setup.binding) };
  const [first, second] = await Promise.all([setup.port.commit(request), setup.port.commit(request)]);
  assert.deepEqual(second, first);
  await assert.rejects(setup.port.commit({ ...request, response: response(setup.binding, { credential: "different-synthetic-credential".padEnd(48, "y") }) }), { code: "operation_conflict" });
  await assert.rejects(setup.port.commit({ ...request, expectedRevision: 1 }), { code: "operation_conflict" });
  await assert.rejects(setup.port.commit({ ...request, kind: "rotation" }), { code: "operation_conflict" });
  assert.deepEqual(await setup.port.read(), first);
});

test("rotation keeps exact owner/workspace/client lineage and new trust receives fresh lineage", async () => {
  const setup = fixture();
  const first = await seed(setup);
  for (const patch of [{ connectedClientId: "other-client" }, { user: { userId: "other-user", displayName: "Other", email: "other@example.test" } }, { workspace: { workspaceId: "other-workspace", name: "Other" } }]) {
    await assert.rejects(setup.port.commit({ operationId: "bad-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding, patch) }), { code: "identity_mismatch" });
  }
  const rotated = await setup.port.commit({ operationId: "valid-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding, { credential: "rotated-credential".padEnd(48, "r") }) });
  assert.equal(rotated.lineageId, first.lineageId);
  assert.equal(rotated.lineageKey, first.lineageKey);
  const next = await setup.port.commit({ operationId: "fresh-consent", expectedRevision: 2, kind: "new-trust", response: response(setup.binding, { connectedClientId: "new-client", workspace: { workspaceId: "new-workspace", name: "New" } }) });
  assert.notEqual(next.lineageId, first.lineageId);
  assert.notEqual(next.lineageKey, first.lineageKey);
  await assert.rejects(setup.port.commit({ operationId: "initial-commit", expectedRevision: 0, kind: "new-trust", response: response(setup.binding) }), { code: "revision_conflict" });
});

test("expiry and malformed responses are distinct failures, and gateway response must match the pin", async () => {
  const setup = fixture();
  await seed(setup);
  setup.state.now = 20_000;
  await assert.rejects(setup.port.read(), { code: "credential_expired" });
  await assert.rejects(setup.port.commit({ operationId: "expired-grant", expectedRevision: 1, kind: "new-trust", response: response(setup.binding) }), { code: "credential_expired" });
  setup.state.now = 1_000;
  for (const patch of [{ credential: "short" }, { credentialExpiresAt: Number.MAX_SAFE_INTEGER + 1 }, { gatewayUrl: "wss://foreign.example.test/client" }]) await assert.rejects(setup.port.commit({ operationId: "invalid-grant", expectedRevision: 1, kind: "new-trust", response: response(setup.binding, patch) }), { code: "credential_invalid" });
});

test("forget atomically queues private revocation and keeps tombstone revision against late writes", async () => {
  const setup = fixture();
  const first = await seed(setup);
  const forgotten = await setup.port.forget({ operationId: "forget-credential", expectedRevision: 1 });
  assert.deepEqual(forgotten, { installId: first.installId, revision: 2 });
  assert.equal(await setup.port.read(), null);
  assert.deepEqual(await setup.port.forget({ operationId: "forget-credential", expectedRevision: 1 }), forgotten);
  const pending = await setup.port.pendingRevocations();
  assert.equal(pending.length, 1);
  assert.equal(pending[0]?.credential, first.credential);
  await setup.repository.close();
  const reopened = setup.reopen().forBinding(setup.binding);
  assert.equal((await reopened.pendingRevocations()).length, 1);
  await assert.rejects(reopened.commit({ operationId: "late-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding) }), { code: "revision_conflict" });
  const next = await reopened.commit({ operationId: "new-consent", expectedRevision: 2, kind: "new-trust", response: response(setup.binding) });
  assert.notEqual(next.lineageId, first.lineageId);
  await assert.rejects(reopened.forget({ operationId: "forget-credential", expectedRevision: 1 }), { code: "revision_conflict" });
  assert.equal((await reopened.read())?.revision, 3);
});
