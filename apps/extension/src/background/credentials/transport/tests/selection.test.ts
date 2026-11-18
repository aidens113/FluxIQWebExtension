import assert from "node:assert/strict";
import test from "node:test";
import { createHostedCredentialTokenStorage } from "../index";
import { response } from "../../tests/fixture";
import { adapterFixture, deferred, repositoryWithPorts } from "./fixture";

test("selection must be current before a credential can escape and after a read resolves", async () => {
  const setup = await adapterFixture();
  setup.selection.current = false;
  await assert.rejects(setup.adapter.read(), { code: "selection_changed" });
  setup.selection.current = true;
  const repository = repositoryWithPorts(setup.repository, { read: async () => {
    const snapshot = await setup.port.read();
    setup.selection.current = false;
    return snapshot;
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  await assert.rejects(adapter.read(), { code: "selection_changed" });
});

test("a newer read generation invalidates an older pending read", async () => {
  const setup = await adapterFixture();
  const entered = deferred();
  const release = deferred();
  let reads = 0;
  const repository = repositoryWithPorts(setup.repository, { read: async () => {
    const first = ++reads === 1;
    const snapshot = await setup.port.read();
    if (first) {
      entered.resolve();
      await release.promise;
    }
    return snapshot;
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  const stale = assert.rejects(adapter.read(), { code: "selection_changed" });
  await entered.promise;
  assert.equal(await adapter.read(), setup.snapshot.credential);
  release.resolve();
  await stale;
});

test("selection changed while hashing the message cannot start a credential commit", async () => {
  const setup = await adapterFixture();
  await setup.adapter.read();
  const refused = assert.rejects(setup.adapter.write(setup.grant.credential, setup.metadata), { code: "selection_changed" });
  setup.selection.current = false;
  await refused;
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("selection changed after the pre-commit read preserves the old credential", async () => {
  const setup = await adapterFixture();
  let reads = 0;
  const repository = repositoryWithPorts(setup.repository, { read: async () => {
    const snapshot = await setup.port.read();
    if (++reads === 2) setup.selection.current = false;
    return snapshot;
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  await adapter.read();
  await assert.rejects(adapter.write(setup.grant.credential, setup.metadata), { code: "selection_changed" });
  assert.deepEqual(await setup.port.read(), setup.snapshot);
});

test("a committed rotation cannot activate after its selection changes", async () => {
  const setup = await adapterFixture();
  const repository = repositoryWithPorts(setup.repository, { commit: async input => {
    const snapshot = await setup.port.commit(input);
    setup.selection.current = false;
    return snapshot;
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  await adapter.read();
  await assert.rejects(adapter.write(setup.grant.credential, setup.metadata), { code: "selection_changed" });
  assert.equal((await setup.port.read())?.credential, setup.grant.credential);
  assert.equal((await setup.port.read())?.revision, 2);
});

test("selection changed after the final durable reread refuses ready", async () => {
  const setup = await adapterFixture();
  let reads = 0;
  const repository = repositoryWithPorts(setup.repository, { read: async () => {
    const snapshot = await setup.port.read();
    if (++reads === 3) setup.selection.current = false;
    return snapshot;
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  await adapter.read();
  await assert.rejects(adapter.write(setup.grant.credential, setup.metadata), { code: "selection_changed" });
  assert.equal((await setup.port.read())?.revision, 2);
});

test("a newer hello read cannot let an earlier pending write publish", async () => {
  const setup = await adapterFixture();
  const entered = deferred();
  const release = deferred();
  const repository = repositoryWithPorts(setup.repository, { commit: async input => {
    entered.resolve();
    await release.promise;
    return setup.port.commit(input);
  } });
  const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
  await adapter.read();
  const refusal = assert.rejects(adapter.write(setup.grant.credential, setup.metadata), { code: "selection_changed" });
  await entered.promise;
  await adapter.read();
  release.resolve();
  await refusal;
  assert.equal((await setup.port.read())?.revision, 2);
});

test("a newer committed credential or lineage refuses the prior write's final activation", async () => {
  for (const kind of ["rotation", "new-trust"] as const) {
    const setup = await adapterFixture();
    const repository = repositoryWithPorts(setup.repository, { commit: async input => {
      const result = await setup.port.commit(input);
      await setup.port.commit({ operationId: "superseding-commit", expectedRevision: result.revision, kind, response: response(setup.binding, { credential: "superseding-credential".padEnd(48, "s"), credentialExpiresAt: 40_000 }) });
      return result;
    } });
    const adapter = createHostedCredentialTokenStorage({ repository, snapshot: setup.snapshot, isCurrent: setup.isCurrent });
    await adapter.read();
    await assert.rejects(adapter.write(setup.grant.credential, setup.metadata), { code: kind === "rotation" ? "credential_changed" : "trust_changed" });
    assert.equal((await setup.port.read())?.revision, 3);
  }
});
