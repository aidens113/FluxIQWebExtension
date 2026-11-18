import assert from "node:assert/strict";
import test from "node:test";
import { createHostedPkceProtocol, type HostedPkceStoredAttempt } from "..";
import { callback, deferred, fixture, tokenResponse } from "./fixture";

for (const reason of ["cancel", "selection"] as const) for (const point of ["discovery", "installation", "trust-read", "digest", "attempt-load", "preparing", "ownership", "waiting", "navigation"] as const) test(`${reason} during ${point} cannot navigate or adopt late`, async () => {
  const t = fixture();
  const entered = deferred();
  const gate = deferred();
  const pause = async () => {
    entered.resolve();
    await gate.promise;
  };
  let protocol = t.protocol;
  if (point === "discovery") t.state.onDiscovery = async () => {
    await pause();
    return Response.json(t.state.document);
  };
  if (point === "preparing" || point === "waiting") t.state.beforeSave = async next => {
    if (next?.phase !== point) return;
    t.state.beforeSave = undefined;
    await pause();
  };
  if (point === "ownership") t.state.beforeOwn = pause;
  if (point === "navigation") t.state.beforeNavigate = pause;
  if (point === "installation") t.state.wrapBound = bound => ({ ...bound, getOrCreateInstallation: async () => {
    const installation = await bound.getOrCreateInstallation();
    await pause();
    return installation;
  } });
  if (point === "trust-read") t.state.wrapBound = bound => ({ ...bound, read: async () => {
    const trust = await bound.read();
    await pause();
    return trust;
  } });
  if (point === "attempt-load") t.state.beforeLoad = async () => {
    t.state.beforeLoad = undefined;
    await pause();
  };
  if (point === "digest") protocol = createHostedPkceProtocol({ ...t.options, crypto: {
    getRandomValues: t.options.crypto.getRandomValues.bind(t.options.crypto), subtle: { digest: async (algorithm, data) => {
      const digest = await t.options.crypto.subtle.digest(algorithm, data);
      await pause();
      return digest;
    } }
  } });
  const start = protocol.start();
  await entered.promise;
  if (reason === "cancel") await protocol.cancel();
  else t.state.current = false;
  gate.resolve();
  const result = await start;
  assert.ok(result.phase === "cancelled" || result.phase === "failed");
  assert.equal(t.state.navigations.length, 0);
  assert.equal(await t.bound.read(), null);
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});

test("cancel before exchange CAS completes prevents the token POST", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred();
  t.state.beforeSave = async next => {
    if (next?.phase !== "exchanging") return;
    t.state.beforeSave = undefined;
    entered.resolve();
    await gate.promise;
  };
  const exchange = t.protocol.observe(input);
  await entered.promise;
  await t.protocol.cancel();
  gate.resolve();
  assert.equal((await exchange).adopted, undefined);
  assert.equal(t.state.requests.filter(item => item.options.method === "POST").length, 0);
});

for (const reason of ["cancel", "selection"] as const) test(`delivered proof after ${reason} is journalled only to original audience`, async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred<Response>();
  t.state.onToken = async () => {
    entered.resolve();
    return await gate.promise;
  };
  const result = t.protocol.observe(input);
  await entered.promise;
  if (reason === "cancel") await t.protocol.cancel();
  else t.state.current = false;
  gate.resolve(Response.json(tokenResponse()));
  const outcome = await result;
  assert.equal(outcome.adopted, undefined);
  assert.equal(await t.bound.read(), null);
  const cleanup = await t.bound.pendingRevocations();
  assert.equal(cleanup.length, 1);
  assert.equal(cleanup[0]!.binding.origin, "https://core.example.test");
  assert.equal(cleanup[0]!.credential, tokenResponse().credential);
});

test("cancellation during adoption commit forgets only its exact revision durably", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred();
  t.state.wrapBound = bound => ({ ...bound, commit: async request => {
    const saved = await bound.commit(request);
    entered.resolve();
    await gate.promise;
    return saved;
  } });
  const result = t.protocol.observe(input);
  await entered.promise;
  assert.equal((await t.bound.read())?.revision, 1);
  await t.protocol.cancel();
  gate.resolve();
  assert.equal((await result).adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.getOrCreateInstallation()).revision, 2);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
});

test("newer rotation survives cancelled adoption and its predecessor is never queued", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred();
  t.state.wrapBound = bound => ({ ...bound, commit: async request => {
    const saved = await bound.commit(request);
    entered.resolve();
    await gate.promise;
    return saved;
  } });
  const result = t.protocol.observe(input);
  await entered.promise;
  const newer = tokenResponse({ credential: "synthetic-rotated-credential-".padEnd(48, "y") });
  await t.bound.commit({ expectedRevision: 1, operationId: "synthetic-newer-rotation", kind: "rotation", response: newer });
  await t.protocol.cancel();
  gate.resolve();
  const outcome = await result;
  assert.equal(outcome.failureCode, "cleanup_required");
  assert.equal(outcome.adopted, undefined);
  assert.equal((await t.bound.read())?.credential, newer.credential);
  assert.equal((await t.bound.pendingRevocations()).length, 0);
});

test("failed cleanup is explicit and never reports an unpersisted credential usable", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred<Response>();
  t.state.wrapBound = bound => ({ ...bound, queueRevocation: async () => { throw new Error("synthetic-private-revocation-storage"); } });
  t.state.onToken = async () => {
    entered.resolve();
    return await gate.promise;
  };
  const result = t.protocol.observe(input);
  await entered.promise;
  await t.protocol.cancel();
  gate.resolve(Response.json(tokenResponse()));
  const outcome = await result;
  assert.equal(outcome.failureCode, "cleanup_required");
  assert.equal(outcome.adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal(JSON.stringify(outcome).includes("synthetic-private"), false);
});

test("attempt terminal persistence failure after commit does not publish adoption", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  t.state.beforeSave = async next => {
    if (next?.phase === "terminal" && next.outcome === "adopted") throw new Error("synthetic-terminal-storage");
  };
  const outcome = await t.protocol.observe(input);
  assert.equal(outcome.adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
});

test("cross-controller cancellation during exchange also prevents adoption", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred<Response>();
  t.state.onToken = async () => {
    entered.resolve();
    return await gate.promise;
  };
  const first = t.protocol.observe(input);
  await entered.promise;
  assert.equal((await t.restart().cancel()).phase, "cancelled");
  gate.resolve(Response.json(tokenResponse()));
  assert.equal((await first).adopted, undefined);
  assert.equal(await t.bound.read(), null);
  assert.equal((await t.bound.pendingRevocations()).length, 1);
  assert.equal((t.state.attempt as HostedPkceStoredAttempt | null)?.phase, "terminal");
});

test("cancel at final private reread replaces a provisional adopted marker after cleanup", async () => {
  const t = fixture();
  await t.protocol.start();
  const input = callback(t);
  const entered = deferred();
  const gate = deferred();
  t.state.wrapBound = bound => ({ ...bound, read: async () => {
    const trust = await bound.read();
    if (t.state.attempt?.phase === "terminal" && t.state.attempt.outcome === "adopted") {
      entered.resolve();
      await gate.promise;
    }
    return trust;
  } });
  const result = t.protocol.observe(input);
  await entered.promise;
  await t.protocol.cancel();
  gate.resolve();
  const outcome = await result;
  assert.equal(outcome.adopted, undefined);
  assert.equal(outcome.phase, "cancelled");
  assert.equal(await t.bound.read(), null);
  assert.equal(t.state.attempt?.phase === "terminal" && t.state.attempt.outcome, "cancelled");
});
