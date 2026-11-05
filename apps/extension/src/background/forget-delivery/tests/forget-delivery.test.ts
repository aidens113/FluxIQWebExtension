import assert from "node:assert/strict";
import test from "node:test";
import { deliverPendingForget, forgetWithoutSocket, type ForgetDeliveryDeps, type PendingForget } from "../forget-delivery";

// A Forget with no socket must still reach Core, or the person must be told it has not.
// Every credential here is a dummy.

const CREDENTIAL = { token: "dummy-credential", coreApiUrl: "http://localhost:3100" };
const DAY = 24 * 60 * 60_000;

function deps(answer: () => Promise<Response>, now = 1_000): ForgetDeliveryDeps & { calls: { url: string; init: RequestInit | undefined }[]; kept: () => PendingForget | undefined; setKept: (pending: PendingForget) => void; clock: { now: number } } {
  let kept: PendingForget | undefined;
  const calls: { url: string; init: RequestInit | undefined }[] = [];
  const clock = { now };
  return {
    calls, clock,
    kept: () => kept,
    setKept: (pending) => { kept = pending; },
    read: async () => kept,
    write: async (pending) => { kept = pending; },
    clear: async () => { kept = undefined; },
    fetch: (async (input: string, init?: RequestInit) => {
      calls.push({ url: String(input), init });
      return await answer();
    }) as typeof fetch,
    now: () => clock.now
  };
}

const unreachable = async (): Promise<Response> => { throw new TypeError("network"); };
const accepted = async (): Promise<Response> => new Response("{}", { status: 200 });
const serverError = async (): Promise<Response> => new Response("{}", { status: 500 });

test("tells Core at once when it can, keeping nothing", async () => {
  const made = deps(accepted);
  assert.equal(await forgetWithoutSocket(made, CREDENTIAL), true);
  assert.equal(made.kept(), undefined);
  assert.equal(made.calls[0]?.url, "http://localhost:3100/api/client-gateway/forget-pairing");
  assert.equal(made.calls[0]?.init?.method, "POST");
  assert.equal(made.calls[0]?.init?.credentials, "omit");
  assert.deepEqual(made.calls[0]?.init?.headers, { authorization: "Bearer dummy-credential" });
});

for (const [name, answer] of [["unreachable", unreachable], ["answering with an error", serverError]] as const) {
  test(`keeps it to deliver later, and says Core has not heard, when Core is ${name}`, async () => {
    const made = deps(answer);
    const info = console.info;
    console.info = () => undefined;
    try {
      assert.equal(await forgetWithoutSocket(made, CREDENTIAL), false);
    } finally {
      console.info = info;
    }
    assert.deepEqual(made.kept(), { ...CREDENTIAL, savedAtMs: 1_000 });
  });
}

test("delivers what is waiting at the next chance, then lets it go", async () => {
  const made = deps(accepted);
  made.setKept({ ...CREDENTIAL, savedAtMs: 1_000 });
  await deliverPendingForget(made);
  assert.equal(made.calls.length, 1);
  assert.equal(made.kept(), undefined);
});

test("keeps it while Core still cannot be reached", async () => {
  const made = deps(unreachable);
  made.setKept({ ...CREDENTIAL, savedAtMs: 1_000 });
  const info = console.info;
  const said: unknown[][] = [];
  console.info = (...args: unknown[]) => { said.push(args); };
  try {
    await deliverPendingForget(made);
  } finally {
    console.info = info;
  }
  assert.ok(made.kept());
  assert.ok(!JSON.stringify(said).includes("dummy-credential"), "the credential is never logged");
});

test("does not keep a credential past its own life: it has ended by itself and is dropped unsent", async () => {
  const made = deps(accepted, 1_000 + 61 * DAY);
  made.setKept({ ...CREDENTIAL, savedAtMs: 1_000 });
  await deliverPendingForget(made);
  assert.equal(made.calls.length, 0);
  assert.equal(made.kept(), undefined);
});

test("nothing waiting, nothing sent", async () => {
  const made = deps(accepted);
  await deliverPendingForget(made);
  assert.equal(made.calls.length, 0);
});
