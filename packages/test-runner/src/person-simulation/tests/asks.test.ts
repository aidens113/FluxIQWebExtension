import assert from "node:assert/strict";
import test from "node:test";
import { answerPersonAsk, pendingPersonAsks, type PersonAskControl } from "../asks.js";

type Call = { endpoint: string; payload: Record<string, unknown>; domainId: string | undefined };

const ask = (askId: string, overrides: Record<string, unknown> = {}) => ({ askId, kind: "choice", status: "pending", control: { name: null, kind: "person_check" }, createdAt: 100, ...overrides });

/** Core's conversation endpoints over a fixed set of threads, recording every call. */
function fakeCore(threads: Record<string, Array<Array<Record<string, unknown>>>>, listed: Record<string, unknown>[]): { control: PersonAskControl; calls: Call[] } {
  const calls: Call[] = [];
  return {
    calls,
    control: {
      automationStudioCall: async (endpoint, payload, _bounds, domainId) => {
        calls.push({ endpoint, payload, domainId });
        if (endpoint === "list-conversations") return { conversations: listed };
        if (endpoint === "get-conversation") {
          const pages = threads[String(payload.conversationId)] ?? [];
          const index = payload.sinceTurnId === undefined ? 0 : pages.findIndex((page) => page.some((turn) => turn.turnId === payload.sinceTurnId)) + 1;
          return { conversation: { conversation: {}, turns: pages[index] ?? [], hasMore: index < pages.length - 1 } };
        }
        if (endpoint === "answer-ask") return { ask: {} };
        throw new Error(`unexpected ${endpoint}`);
      },
    },
  };
}

const scope = { projectId: "project-1", domainId: "web-automation" };

test("only pending person-needed choices are returned, oldest first, with the stage their thread names", async () => {
  const { control, calls } = fakeCore({
    "c-flow": [[
      { turnId: "t1", ask: { ...ask("permission-1"), kind: "permission", control: null } },
      { turnId: "t2", ask: ask("build-check", { createdAt: 300 }) },
      { turnId: "t3", ask: null },
    ]],
    "c-run": [
      [{ turnId: "r1", ask: ask("old-check", { status: "answered" }) }],
      [{ turnId: "r2", ask: ask("run-check", { createdAt: 200 }) }, { turnId: "r3", ask: ask("other-choice", { control: { name: "Which one?", kind: "question" } }) }],
    ],
  }, [
    { conversationId: "c-flow", pendingAskCount: 2, subject: { kind: "flow", id: "flow-1" } },
    { conversationId: "c-idle", pendingAskCount: 0, subject: { kind: "flow", id: "flow-1" } },
    { conversationId: "c-run", pendingAskCount: 2, subject: { kind: "run", id: "run-9" } },
  ]);
  const asks = await pendingPersonAsks(control, scope);
  assert.deepEqual(asks.map(({ askId, stage, subject }) => [askId, stage, subject?.id]), [["run-check", "run", "run-9"], ["build-check", "build", "flow-1"]]);
  assert.ok(!calls.some(({ payload }) => payload.conversationId === "c-idle"), "a thread with nothing pending is not opened");
  assert.deepEqual(calls.filter(({ payload }) => payload.conversationId === "c-run").map(({ payload }) => payload.sinceTurnId ?? null), [null, "r1"], "a long thread is read a page at a time");
  assert.ok(calls.every(({ domainId, payload }) => domainId === "web-automation" && payload.projectId === "project-1"), "every call names the project and its domain, which Core holds each call to");
});

test("the answer is flat, a choice naming the option, as answer-ask takes it", async () => {
  const { control, calls } = fakeCore({}, []);
  await answerPersonAsk(control, scope, "run-check", "person_done");
  assert.deepEqual(calls, [{ endpoint: "answer-ask", payload: { projectId: "project-1", askId: "run-check", kind: "choice", value: "person_done" }, domainId: "web-automation" }]);
});
