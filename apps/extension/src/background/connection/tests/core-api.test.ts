// Coverage of callCoreProgram in core-api.ts: the one request the panel's
// relays make. It must carry the pairing token as the bearer credential and no
// cookie, return Core's payload untouched, and never put the token in anything
// it answers with.
//
// Also covers ProjectContext (project-context.ts), whose only outside call is
// core-api.ts's snapshot lookup: which project a read that names none belongs
// to. Core owns the current project; the one stored in the extension session is
// the fallback for when Core names none or cannot be asked.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";

import type { ActivityEntry, FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
import { callCoreProgram, fetchProjectIdFromCoreSnapshot } from "../core-api";
import { ProjectContext } from "../project-context";

const TOKEN = "secret-pairing-token";
const credentials = { coreApiUrl: "http://127.0.0.1:3000", token: TOKEN };

function stubFetch(t: TestContext, respond: () => Response | Promise<Response>) {
  const requests: Array<{ url: string; init: RequestInit }> = [];
  const original = globalThis.fetch;
  globalThis.fetch = (async (url: string | URL | Request, init?: RequestInit) => {
    requests.push({ url: String(url), init: init ?? {} });
    return respond();
  }) as typeof fetch;
  t.after(() => { globalThis.fetch = original; });
  return requests;
}

function json(status: number, body: unknown): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

test("posts to the program endpoint with the token as bearer and no cookie, and returns Core's payload unchanged", async (t) => {
  const payload = { conversation: { conversationId: "c-1", turns: [{ text: "Hi" }] } };
  const requests = stubFetch(t, () => json(200, { ok: true, payload }));

  const reply = await callCoreProgram(credentials, "get-conversation", { projectId: "p-1", conversationId: "c-1" });

  assert.deepEqual(reply, { ok: true, payload });
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://127.0.0.1:3000/api/programs/automation-studio/get-conversation");
  assert.equal(requests[0]?.init.method, "POST");
  assert.equal(requests[0]?.init.credentials, "omit");
  assert.deepEqual(requests[0]?.init.headers, { accept: "application/json", "content-type": "application/json", authorization: `Bearer ${TOKEN}` });
  assert.equal(requests[0]?.init.body, JSON.stringify({ projectId: "p-1", conversationId: "c-1" }));
});

test("without a token nothing is sent", async (t) => {
  const requests = stubFetch(t, () => json(200, { ok: true }));
  assert.deepEqual(await callCoreProgram({ coreApiUrl: credentials.coreApiUrl, token: undefined }, "list-conversations", {}), {
    ok: false, code: "not_paired", error: "This browser is not paired with FluxIQ yet."
  });
  assert.equal(requests.length, 0);
});

test("a 401 or 403 is refused, with Core's sentence; any other failure is failed, with Core's sentence or the status", async (t) => {
  let next: Response = json(403, { ok: false, error: "This endpoint is not available to a paired client." });
  stubFetch(t, () => next);
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "refused", httpStatus: 403, error: "This endpoint is not available to a paired client."
  });
  next = new Response("", { status: 401 });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "refused", httpStatus: 401, error: "FluxIQ refused this browser's pairing."
  });
  next = json(400, { ok: false, error: "Automation Studio project is unavailable in this domain scope." });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), {
    ok: false, code: "failed", httpStatus: 400, error: "Automation Studio project is unavailable in this domain scope."
  });
  next = new Response("<html>oops</html>", { status: 502 });
  assert.deepEqual(await callCoreProgram(credentials, "get-conversation", {}), { ok: false, code: "failed", httpStatus: 502, error: "FluxIQ answered 502." });
});

test("a project outside the paired domain is a failed call with Core's sentence, not a refused pairing", async (t) => {
  const sentence = "This project belongs to another part of FluxIQ, so this browser cannot use it.";
  stubFetch(t, () => json(403, { ok: false, error: sentence, errorCode: "authorization.project_domain" }));
  assert.deepEqual(await callCoreProgram(credentials, "run-runtime-session", { projectId: "project.other" }), {
    ok: false, code: "failed", httpStatus: 403, error: sentence
  });
});

test("an unreachable FluxIQ is unreachable, and no failure ever carries the token", async (t) => {
  stubFetch(t, () => { throw new TypeError(`fetch failed for Bearer ${TOKEN}`); });
  const reply = await callCoreProgram(credentials, "append-turn", { text: "hello" });
  assert.deepEqual(reply, { ok: false, code: "unreachable", error: "FluxIQ could not be reached." });
  assert.ok(!JSON.stringify(reply).includes(TOKEN));
});

test("an address that is not a URL is unreachable rather than a throw", async (t) => {
  const requests = stubFetch(t, () => json(200, { ok: true }));
  assert.deepEqual(await callCoreProgram({ coreApiUrl: "not a url", token: TOKEN }, "list-conversations", {}), {
    ok: false, code: "unreachable", error: "FluxIQ could not be reached."
  });
  assert.equal(requests.length, 0);
});

test("a call that runs out of time says so, rather than that FluxIQ could not be reached", async (t) => {
  stubFetch(t, () => { throw new DOMException(`The operation timed out for Bearer ${TOKEN}`, "TimeoutError"); });
  const reply = await callCoreProgram(credentials, "append-turn", { text: "hello" });
  assert.equal(reply.ok, false);
  assert.equal(!reply.ok && reply.code, "timed_out");
  assert.match(!reply.ok ? reply.error : "", /may still be working/);
  assert.ok(!JSON.stringify(reply).includes(TOKEN));
});

// ---- ProjectContext: Core's current project is authoritative ----

type ContextHarness = {
  context: ProjectContext;
  readonly session: FluxIQSession;
  readonly adopted: string[];
  readonly activity: Array<{ label: string; tone: ActivityEntry["tone"] | undefined }>;
  clock: number;
};

function projectContext(stored: string | null | undefined, options: { token?: string | null; lookupBoundMs?: number } = {}): ContextHarness {
  const session: FluxIQSession = { clientId: "client-1", sessionId: "session-1", projectId: stored };
  if (options.token !== null) session.token = options.token ?? TOKEN;
  const harness = { session, adopted: [] as string[], activity: [] as ContextHarness["activity"], clock: 1_000_000 } as ContextHarness;
  harness.context = new ProjectContext({
    settings: () => ({ coreApiUrl: credentials.coreApiUrl }) as FluxIQSettings,
    session: () => harness.session,
    adoptProjectId: async (projectId) => {
      harness.adopted.push(projectId);
      harness.session.projectId = projectId;
    },
    onActivity: (_kind, label, _detail, tone) => { harness.activity.push({ label, tone }); },
    now: () => harness.clock,
    ...(options.lookupBoundMs !== undefined ? { lookupBoundMs: options.lookupBoundMs } : {})
  });
  return harness;
}

function coreContext(activeProjectId: string | null, sessionProjectId?: string): Response {
  return json(200, {
    ok: true,
    payload: {
      sessions: [{ sessionId: "session-1", clientId: "client-1", ...(sessionProjectId ? { projectId: sessionProjectId } : {}) }],
      webRuntime: { automationStudio: { activeProjectId } }
    }
  });
}

test("a read with no project named gets Core's current project over a stale stored one, and the stored one follows it", async (t) => {
  const requests = stubFetch(t, () => coreContext("project-new"));
  const harness = projectContext("project-old");

  assert.equal(await harness.context.resolve("panel"), "project-new");
  assert.deepEqual(harness.adopted, ["project-new"]);
  assert.equal(harness.session.projectId, "project-new");
  assert.equal(harness.context.current(), "project-new");
  assert.equal(requests.length, 1);
  assert.equal(requests[0]?.url, "http://127.0.0.1:3000/api/client-gateway/snapshot");
  assert.deepEqual(harness.activity, [{ label: "Project context linked", tone: "success" }]);
});

test("Core's gateway-session binding is Core's answer too, ahead of its studio context", async (t) => {
  stubFetch(t, () => coreContext("project-studio", "project-bound"));
  const harness = projectContext("project-old");
  assert.equal(await harness.context.resolve("panel"), "project-bound");
  assert.deepEqual(harness.adopted, ["project-bound"]);
});

test("when Core names the stored project nothing is rewritten and nothing is announced", async (t) => {
  stubFetch(t, () => coreContext("project-old"));
  const harness = projectContext("project-old");
  assert.equal(await harness.context.resolve("panel"), "project-old");
  assert.deepEqual(harness.adopted, []);
  assert.deepEqual(harness.activity, []);
});

test("the stored project is used when Core names none", async (t) => {
  stubFetch(t, () => coreContext(null));
  const harness = projectContext("project-old");
  assert.equal(await harness.context.resolve("panel"), "project-old");
  assert.deepEqual(harness.adopted, []);
  assert.deepEqual(harness.activity, []);
});

test("the stored project is used, quietly, when Core cannot be reached or refuses the token", async (t) => {
  let respond: () => Response = () => { throw new TypeError("fetch failed"); };
  stubFetch(t, () => respond());
  const unreachable = projectContext("project-old");
  assert.equal(await unreachable.context.resolve("panel"), "project-old");
  assert.deepEqual(unreachable.adopted, []);
  assert.deepEqual(unreachable.activity, []);

  respond = () => new Response("", { status: 401 });
  const refused = projectContext("project-old");
  assert.equal(await refused.context.resolve("panel"), "project-old");
  assert.deepEqual(refused.adopted, []);
});

test("with nothing stored and Core unreachable there is no project, and the activity log says why", async (t) => {
  stubFetch(t, () => { throw new TypeError("fetch failed"); });
  const harness = projectContext(undefined);
  assert.equal(await harness.context.resolve("panel"), undefined);
  assert.deepEqual(harness.activity, [{ label: "Project context unavailable", tone: "warning" }]);
});

test("an unpaired browser does not ask Core and keeps its stored project", async (t) => {
  const requests = stubFetch(t, () => coreContext("project-new"));
  const harness = projectContext("project-old", { token: null });
  assert.equal(await harness.context.resolve("panel"), "project-old");
  assert.equal(requests.length, 0);
});

test("a hung Core lookup falls back to the stored project at the bound, and a later read asks afresh", async (t) => {
  let respond: () => Promise<Response> = () => new Promise<Response>(() => undefined);
  const requests = stubFetch(t, () => respond());
  const harness = projectContext("project-old", { lookupBoundMs: 20 });
  assert.equal(await harness.context.resolve("panel"), "project-old");
  assert.deepEqual(harness.adopted, []);

  respond = async () => coreContext("project-new");
  harness.clock += 20;
  assert.equal(await harness.context.resolve("panel"), "project-new");
  assert.equal(requests.length, 2);
});

test("a recording's own project wins over Core's context and Core is not asked", async (t) => {
  const requests = stubFetch(t, () => coreContext("project-new"));
  const harness = projectContext("project-old");
  harness.context.setActiveRecordingProject("project-recording");
  assert.equal(await harness.context.resolve("recording_evidence"), "project-recording");
  assert.equal(harness.context.current(), "project-recording");
  assert.equal(requests.length, 0);
});

test("a recording Core accepted with no project takes the one Core later names", async (t) => {
  stubFetch(t, () => coreContext("project-new"));
  const harness = projectContext(undefined);
  harness.context.setActiveRecordingProject(null);
  assert.equal(await harness.context.resolve("snapshot"), "project-new");
  assert.equal(harness.context.activeRecordingProject(), "project-new");
});

test("a lookup outside a recording pins nothing: when Core's context changes the next read follows it", async (t) => {
  let current = "project-a";
  stubFetch(t, () => coreContext(current));
  const harness = projectContext(undefined);
  assert.equal(await harness.context.resolve("panel"), "project-a");
  assert.equal(harness.context.activeRecordingProject(), undefined);

  current = "project-b";
  harness.clock += 60_000;
  assert.equal(await harness.context.resolve("panel"), "project-b");
  assert.equal(harness.context.current(), "project-b");
  assert.deepEqual(harness.adopted, ["project-a", "project-b"]);
});

test("reads at the same moment share one lookup, and a read just after reuses its answer", async (t) => {
  const requests = stubFetch(t, () => coreContext("project-new"));
  const harness = projectContext("project-old");
  const answers = await Promise.all([harness.context.resolve("panel"), harness.context.resolve("snapshot")]);
  assert.deepEqual(answers, ["project-new", "project-new"]);
  harness.clock += 100;
  assert.equal(await harness.context.resolve("panel"), "project-new");
  assert.equal(requests.length, 1);
  assert.deepEqual(harness.adopted, ["project-new"]);
});

// A closed session stays in Core's snapshot with its old project
// (client-gateway/service/lifecycle.ts `disconnect`). The previous run's
// session -- the one the extension stored, or the first with its client id --
// must not stand in for Core's current project.
test("a disconnected session's project is not Core's answer; Core's studio context is", async (t) => {
  stubFetch(t, () => json(200, {
    ok: true,
    payload: {
      sessions: [
        { sessionId: "session-old", clientId: "client-1", status: "disconnected", projectId: "project-old" },
        { sessionId: "session-other", clientId: "client-1", status: "disconnected", projectId: "project-older" }
      ],
      webRuntime: { automationStudio: { activeProjectId: "project-new" } }
    }
  }));
  assert.equal(await fetchProjectIdFromCoreSnapshot(credentials, { sessionId: "session-old", clientId: "client-1" }, "panel"), "project-new");
});

test("a live session's binding still wins, matched by session id or else by client id", async (t) => {
  stubFetch(t, () => json(200, {
    ok: true,
    payload: {
      sessions: [
        { sessionId: "session-old", clientId: "client-1", status: "disconnected", projectId: "project-old" },
        { sessionId: "session-live", clientId: "client-1", status: "ready", projectId: "project-bound" }
      ],
      webRuntime: { automationStudio: { activeProjectId: "project-studio" } }
    }
  }));
  assert.equal(await fetchProjectIdFromCoreSnapshot(credentials, { sessionId: "session-live", clientId: "client-1" }, "panel"), "project-bound");
  assert.equal(await fetchProjectIdFromCoreSnapshot(credentials, { sessionId: undefined, clientId: "client-1" }, "panel"), "project-bound");
});

test("the snapshot lookup carries a timeout, so a Core that never answers cannot hold the request open", async (t) => {
  const requests = stubFetch(t, () => json(200, { ok: true, payload: { sessions: [] } }));
  await fetchProjectIdFromCoreSnapshot(credentials, { sessionId: undefined, clientId: "client-1" }, "panel");
  assert.ok(requests[0]?.init.signal instanceof AbortSignal);
});
