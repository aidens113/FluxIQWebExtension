// Coverage of ProjectContext's panel path (`forPanel`) and the person's choice:
// a panel call does not fetch Core's snapshot each time, the choice wins and is
// kept per address, and following Core resumes when the choice is cleared.

import assert from "node:assert/strict";
import test from "node:test";

import type { FluxIQSession, FluxIQSettings } from "../../../shared/protocol";
import { projectChoiceStorage } from "../../projects/index";
import { CORE_PROJECT_CONTEXT_REFRESH_MS, ProjectContext } from "../project-context";

type Fetch = typeof fetch;

function snapshot(projectId: string): Response {
  const body = { ok: true, payload: { sessions: [{ sessionId: "s1", clientId: "c1", projectId }], webRuntime: { automationStudio: { activeProjectId: projectId } } } };
  return new Response(JSON.stringify(body), { status: 200, headers: { "content-type": "application/json" } });
}

function build(t: { after(fn: () => void): void }, stored: string | undefined, answers: string[]) {
  const original = globalThis.fetch;
  const asked: string[] = [];
  globalThis.fetch = (async (input: Parameters<Fetch>[0]) => {
    asked.push(String(input));
    return snapshot(answers.length > 1 ? answers.shift() as string : answers[0] as string);
  }) as Fetch;
  t.after(() => { globalThis.fetch = original; });
  const session: FluxIQSession = { clientId: "c1", sessionId: "s1", token: "t", ...(stored ? { projectId: stored } : {}) };
  const data: Record<string, unknown> = {};
  const storage = projectChoiceStorage({ get: async (key) => ({ [key]: data[key] }), set: async (items) => { Object.assign(data, items); } });
  const state = { clock: 1_000_000, changes: 0 };
  const context = new ProjectContext({
    settings: () => ({ coreApiUrl: "http://127.0.0.1:3000" }) as FluxIQSettings,
    session: () => session,
    adoptProjectId: async (projectId) => { session.projectId = projectId; },
    onProjectName: () => { state.changes++; },
    onActivity: () => undefined,
    choiceStorage: storage,
    now: () => state.clock
  });
  return { context, asked, session, state, storage };
}

const settle = () => new Promise((resolve) => setTimeout(resolve, 30));

test("after one check per lease, panel calls use the held project and fetch nothing", async (t) => {
  const h = build(t, "p1", ["p1"]);
  assert.equal(await h.context.forPanel("panel"), "p1");
  assert.equal(h.asked.length, 1);
  for (let i = 0; i < 20; i++) assert.equal(await h.context.forPanel("panel"), "p1");
  assert.equal(h.asked.length, 1);
});

test("Core's project change is followed by a background refresh, not by waiting on each call", async (t) => {
  const h = build(t, "p1", ["p1", "p2"]);
  await h.context.forPanel("panel");
  h.state.clock += CORE_PROJECT_CONTEXT_REFRESH_MS;
  assert.equal(await h.context.forPanel("panel"), "p1", "the call answers at once with the held project");
  await settle();
  assert.equal(h.session.projectId, "p2");
  assert.equal(await h.context.forPanel("panel"), "p2");
});

test("a browser with nothing held waits on Core once", async (t) => {
  const h = build(t, undefined, ["p5"]);
  assert.equal(await h.context.forPanel("panel"), "p5");
});

test("a new lease asks Core again before trusting what is held", async (t) => {
  const h = build(t, "p1", ["p1", "p3"]);
  await h.context.forPanel("panel");
  h.context.invalidate();
  assert.equal(await h.context.forPanel("panel"), "p3");
  assert.equal(h.asked.length, 2);
});

test("a chosen project applies to every call, wins over Core, and Core is not asked", async (t) => {
  const h = build(t, "p1", ["p2"]);
  await h.context.choose({ projectId: "pc", name: "Chosen" });
  assert.equal(await h.context.forPanel("panel"), "pc");
  assert.equal(await h.context.resolve("snapshot"), "pc");
  assert.equal(h.context.current(), "pc");
  assert.equal(h.context.currentName(), "Chosen");
  assert.equal(h.context.chosenBy(), "person");
  assert.equal(h.asked.length, 0);
  assert.ok(h.state.changes > 0, "the status is told");
});

test("the choice is read back by a restarted worker", async (t) => {
  const h = build(t, "p1", ["p1"]);
  await h.context.choose({ projectId: "pc", name: "Chosen" });
  const again = new ProjectContext({
    settings: () => ({ coreApiUrl: "http://127.0.0.1:3000" }) as FluxIQSettings,
    session: () => h.session,
    adoptProjectId: async () => undefined,
    onActivity: () => undefined,
    choiceStorage: h.storage
  });
  await again.loadChoice();
  assert.equal(again.chosenProject(), "pc");
  assert.equal(again.currentName(), "Chosen");
});

test("choosing null follows Core again and learns its project", async (t) => {
  const h = build(t, "p1", ["p2"]);
  await h.context.choose({ projectId: "pc" });
  await h.context.choose(null);
  assert.equal(h.context.chosenBy(), "core");
  assert.equal(await h.storage.read("http://127.0.0.1:3000"), undefined);
  await settle();
  assert.equal(h.session.projectId, "p2");
});

test("a choice made while the stored one is still being read is kept, not overwritten by the older stored value", async (t) => {
  const h = build(t, "p1", ["p1"]);
  await h.storage.write("http://127.0.0.1:3000", { projectId: "p-stored" });
  const loading = h.context.loadChoice();
  await h.context.choose({ projectId: "p-new", name: "New" });
  await loading;
  assert.equal(h.context.chosenProject(), "p-new");
});
