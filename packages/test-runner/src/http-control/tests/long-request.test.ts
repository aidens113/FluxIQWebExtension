import assert from "node:assert/strict";
import http from "node:http";
import type { AddressInfo } from "node:net";
import test from "node:test";
import { RunnerFailure } from "../../failure.js";
import { FluxIQControlClient, isBoundedHttpFailure } from "../index.js";

/**
 * A Flow build is answered only when it is over, which can be past the 300 s an
 * ordinary control request may wait and past undici's own 300 s headers
 * timeout. These hold a real local server's answer back for longer than the
 * ordinary cap -- shortened here to milliseconds through the client's limits --
 * and check that a long request still receives it, and still times out when
 * its own bound runs out.
 */

const SESSION = "fluxiq_session=long-request-secret-cookie";
const PASSWORD = "long-request-secret-password";
const LIMITS = { maxTimeoutMs: 200, longRequestMaxTimeoutMs: 5_000 };
const ANSWER_DELAY_MS = 600;

type Seen = { path: string; headers: http.IncomingHttpHeaders; body: string };

async function delayedCore(t: test.TestContext): Promise<{ origin: string; seen: Seen[] }> {
  const seen: Seen[] = [];
  const held = new Set<http.ServerResponse>();
  const server = http.createServer((request, response) => {
    let body = "";
    request.on("data", (chunk: Buffer) => { body += chunk.toString("utf8"); });
    request.on("end", () => {
      seen.push({ path: request.url ?? "", headers: request.headers, body });
      if (request.url === "/api/auth/login") {
        response.writeHead(200, { "content-type": "application/json", "set-cookie": `${SESSION}; Max-Age=3600; HttpOnly` });
        response.end(JSON.stringify({ ok: true }));
        return;
      }
      held.add(response);
      const timer = setTimeout(() => {
        held.delete(response);
        response.writeHead(400, { "content-type": "application/json" });
        response.end(JSON.stringify({ ok: false, error: "The build ran out of decisions." }));
      }, ANSWER_DELAY_MS);
      response.on("close", () => clearTimeout(timer));
    });
  });
  await new Promise<void>((resolve) => server.listen(0, "127.0.0.1", resolve));
  t.after(async () => {
    for (const response of held) response.destroy();
    server.closeAllConnections();
    await new Promise<void>((resolve) => server.close(() => resolve()));
  });
  return { origin: `http://127.0.0.1:${(server.address() as AddressInfo).port}`, seen };
}

async function client(origin: string): Promise<FluxIQControlClient> {
  const control = new FluxIQControlClient(origin, LIMITS);
  await control.login({ username: "runner", password: PASSWORD }, { timeoutMs: LIMITS.maxTimeoutMs });
  return control;
}

test("a long request receives an answer that arrives after the ordinary cap", async (t) => {
  const { origin, seen } = await delayedCore(t);
  const control = await client(origin);

  // The ordinary cap binds: an ordinary request cannot ask to wait this long.
  await assert.rejects(() => control.getFlow("project.one", "flow.one", { timeoutMs: 2_000 }), /between 1 and 200 milliseconds/u);

  const startedAt = Date.now();
  await assert.rejects(
    () => control.getFlow("project.one", "flow.one", { timeoutMs: 2_000, longRequest: true }),
    (error: unknown) => {
      // Core's own answer, not a bounded wait: its refusal sentence travels with the failure.
      assert.ok(error instanceof RunnerFailure);
      assert.equal(isBoundedHttpFailure(error), false);
      assert.equal(error.details?.status, 400);
      assert.equal(error.details?.reason, "The build ran out of decisions.");
      return true;
    },
  );
  assert.ok(Date.now() - startedAt >= ANSWER_DELAY_MS - 50, "the answer was waited for");
  assert.ok(ANSWER_DELAY_MS > LIMITS.maxTimeoutMs, "the answer came after the ordinary cap");

  const request = seen.find((entry) => entry.path === "/api/programs/automation-studio/get-flow");
  assert.ok(request);
  assert.equal(request.headers.cookie, SESSION);
  assert.deepEqual(JSON.parse(request.body), { projectId: "project.one", flowId: "flow.one" });
  // Not undici, whose headers timeout would cut a real build off at 300 s: it marks every request it sends.
  assert.equal(request.headers["sec-fetch-mode"], undefined);
});

test("a long request that outlives its own bound is still a bounded timeout, and names no secret", async (t) => {
  const { origin } = await delayedCore(t);
  const control = await client(origin);

  await assert.rejects(
    () => control.getFlow("project.one", "flow.one", { timeoutMs: 150, longRequest: true }),
    (error: unknown) => {
      assert.ok(error instanceof RunnerFailure);
      assert.equal(isBoundedHttpFailure(error), true);
      assert.equal(error.message, "FluxIQ HTTP operation timed out");
      assert.deepEqual(error.details, { bounded: "timeout", operationStage: "control.request", timeoutMs: 150, path: "/api/programs/automation-studio/get-flow" });
      const written = JSON.stringify({ message: error.message, details: error.details, cause: String(error.cause ?? "") });
      assert.equal(written.includes("long-request-secret"), false);
      return true;
    },
  );
  // Past its own, longer cap a long request is refused before it is sent.
  await assert.rejects(() => control.getFlow("project.one", "flow.one", { timeoutMs: 6_000, longRequest: true }), /between 1 and 5000 milliseconds/u);
});

test("a long request can be interrupted by its caller", async (t) => {
  const { origin } = await delayedCore(t);
  const control = await client(origin);
  const controller = new AbortController();
  setTimeout(() => controller.abort(), 50);
  await assert.rejects(
    () => control.getFlow("project.one", "flow.one", { timeoutMs: 2_000, longRequest: true, signal: controller.signal }),
    (error: unknown) => error instanceof RunnerFailure && error.details?.bounded === "abort",
  );
});
