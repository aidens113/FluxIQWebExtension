import assert from "node:assert/strict";
import test from "node:test";
import { forceCloseDatabase } from "fake-indexeddb";
import { createHostedCredentialRepository } from "../index";
import { deferred, fixture, response, seed } from "./fixture";
import { rawStore } from "./raw-store";

test("a credential is returned only after its strict transaction completes", async () => {
  const setup = fixture();
  await setup.port.getOrCreateInstallation();
  let completed = false;
  setup.state.onTransaction = transaction => {
    assert.equal(transaction.durability, "strict");
    transaction.addEventListener("complete", () => { completed = true; });
  };
  await setup.port.commit({ operationId: "durable-commit", expectedRevision: 0, kind: "new-trust", response: response(setup.binding) });
  assert.equal(completed, true);
});

test("abort after binding and mutation writes rolls everything back and returns no credential", async () => {
  const setup = fixture();
  const initial = await seed(setup);
  setup.state.onTransaction = transaction => {
    if (transaction.mode !== "readwrite") return;
    const original = transaction.objectStore.bind(transaction);
    const patched = new WeakSet<IDBObjectStore>();
    transaction.objectStore = name => {
      const store = original(name);
      if (name === "mutations" && !patched.has(store)) {
        patched.add(store);
        const add = store.add.bind(store);
        store.add = (value, key) => {
          const request = add(value, key);
          request.addEventListener("success", () => transaction.abort());
          return request;
        };
      }
      return store;
    };
  };
  await assert.rejects(setup.port.commit({ operationId: "aborted-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding, { credential: "synthetic-rotation".padEnd(48, "r") }) }), { code: "storage_unavailable" });
  delete setup.state.onTransaction;
  assert.deepEqual(await setup.port.read(), initial);
  assert.equal((await rawStore(setup.factory, setup.databaseName, "mutations")).length, 1);
  await setup.port.commit({ operationId: "aborted-rotation", expectedRevision: 1, kind: "rotation", response: response(setup.binding, { credential: "synthetic-rotation".padEnd(48, "r") }) });
  assert.equal((await setup.port.read())?.revision, 2);
});

test("repository closure during an accepted write prevents returning a usable snapshot", async () => {
  const setup = fixture();
  await setup.port.getOrCreateInstallation();
  const entered = deferred();
  setup.state.onTransaction = () => entered.resolve();
  const refusal = assert.rejects(setup.port.commit({ operationId: "closing-commit", expectedRevision: 0, kind: "new-trust", response: response(setup.binding) }), { code: "repository_closed" });
  await entered.promise;
  await setup.repository.close();
  await refusal;
  await assert.rejects(setup.port.read(), { code: "repository_closed" });
});

test("unexpected database closure refuses new work with safe storage failure", async () => {
  const setup = fixture();
  await setup.port.getOrCreateInstallation();
  const database = setup.state.opened!;
  const closed = new Promise<void>(resolve => database.addEventListener("close", () => resolve(), { once: true }));
  // This fake helper's published declaration takes a constructor; its implementation takes a database.
  Reflect.apply(forceCloseDatabase, undefined, [database]);
  await closed;
  await assert.rejects(setup.port.commit({ operationId: "closed-database", expectedRevision: 0, kind: "new-trust", response: response(setup.binding) }), { code: "storage_unavailable" });
  await assert.rejects(setup.port.read(), { code: "storage_unavailable" });
});

test("corrupt stored credential and wrong audience are errors rather than silent absence", async () => {
  const setup = fixture();
  await seed(setup);
  await rawStore(setup.factory, setup.databaseName, "bindings", rows => rows.map(row => ({ ...row, credential: { ...(row.credential as object), credential: "short" } })));
  await assert.rejects(setup.port.read(), { code: "record_invalid" });
  await rawStore(setup.factory, setup.databaseName, "bindings", rows => rows.map(row => ({ ...row, credential: null, binding: { ...(row.binding as object), instanceId: "foreign-instance" } })));
  await assert.rejects(setup.port.getOrCreateInstallation(), { code: "record_invalid" });
});

test("fixed storage errors retain no supplied credential or raw cause, and receipt history contains only payload hashes", async () => {
  const setup = fixture();
  const adopted = await seed(setup);
  const receipts = await rawStore(setup.factory, setup.databaseName, "mutations");
  assert.equal(JSON.stringify(receipts).includes(adopted.credential), false);
  const hostile = createHostedCredentialRepository({ indexedDB: { open: () => { throw new Error(adopted.credential); } } as unknown as IDBFactory });
  try {
    await assert.rejects(hostile.forBinding(setup.binding).getOrCreateInstallation(), error => {
      const value = error as Error & { code: string; cause?: unknown };
      assert.equal(value.code, "storage_unavailable");
      assert.equal(value.message, "The bound credential request could not be completed.");
      assert.equal(value.cause, undefined);
      assert.equal(JSON.stringify(value).includes(adopted.credential), false);
      return true;
    });
  } finally {
    await hostile.close();
  }
});

test("callers cannot mutate revision or credential identity after a commit starts", async () => {
  const setup = fixture();
  await setup.port.getOrCreateInstallation();
  const grant = response(setup.binding);
  const request = { operationId: "snapshot-commit", expectedRevision: 0, kind: "new-trust" as const, response: grant };
  const pending = setup.port.commit(request);
  request.expectedRevision = 99;
  grant.user.userId = "forged-user";
  grant.credential = "forged-credential".padEnd(48, "f");
  const result = await pending;
  assert.equal(result.revision, 1);
  assert.equal(result.userId, "user-one");
  assert.notEqual(result.credential, grant.credential);
});

test("unexpected input exceptions cannot escape with a credential-bearing message", async () => {
  const setup = fixture();
  const initial = await seed(setup);
  const malformed = { get kind() { throw new Error(initial.credential); } };
  await assert.rejects(Reflect.apply(setup.port.commit, undefined, [malformed]), error => {
    assert.equal((error as Error).message, "The bound credential request could not be completed.");
    assert.equal(JSON.stringify(error).includes(initial.credential), false);
    return true;
  });
  assert.deepEqual(await setup.port.read(), initial);
});
