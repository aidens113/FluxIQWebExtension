import assert from "node:assert/strict";
import test from "node:test";
import { checkHostedCredentialBinding } from "../index";
import { discovery, fixture, response, seed } from "./fixture";

test("pending revocations are private to exact binding and acknowledgements cannot cross bindings", async () => {
  const setup = fixture();
  await seed(setup);
  await setup.port.forget({ operationId: "forget-credential", expectedRevision: 1 });
  const otherBinding = checkHostedCredentialBinding(discovery("https://other.example.test"), "https://other.example.test");
  const other = setup.repository.forBinding(otherBinding);
  assert.deepEqual(await other.pendingRevocations(), []);
  await other.acknowledgeRevocation("forget-credential");
  assert.equal((await setup.port.pendingRevocations()).length, 1);
  await setup.port.acknowledgeRevocation("forget-credential");
  assert.deepEqual(await setup.port.pendingRevocations(), []);
  await setup.port.acknowledgeRevocation("forget-credential");
});

test("a known unadopted credential is queued durably and exact replay never recreates acknowledged work", async () => {
  const setup = fixture();
  const credential = response(setup.binding).credential;
  const request = { operationId: "cancelled-attempt", credential };
  const first = await setup.port.queueRevocation(request);
  assert.equal(first?.credential, credential);
  assert.deepEqual(await setup.port.queueRevocation(request), first);
  await assert.rejects(setup.port.queueRevocation({ ...request, credential: "different-unadopted-credential".padEnd(48, "z") }), { code: "operation_conflict" });
  await setup.repository.close();
  const reopened = setup.reopen().forBinding(setup.binding);
  assert.deepEqual(await reopened.pendingRevocations(), [first]);
  await reopened.acknowledgeRevocation(request.operationId);
  assert.equal(await reopened.queueRevocation(request), null);
  assert.deepEqual(await reopened.pendingRevocations(), []);
  assert.equal(await reopened.read(), null);
});

test("forget and queue mutation identities cannot be reused with another intent", async () => {
  const setup = fixture();
  const initial = await seed(setup);
  await assert.rejects(setup.port.queueRevocation({ operationId: "initial-commit", credential: initial.credential }), { code: "operation_conflict" });
  await assert.rejects(setup.port.forget({ operationId: "initial-commit", expectedRevision: 1 }), { code: "operation_conflict" });
  assert.deepEqual(await setup.port.read(), initial);
});
