import assert from "node:assert/strict";
import test from "node:test";
import type { PersonHandOff } from "../hand-off-record.js";
import type { PersonAskControl } from "../asks.js";
import type { PersonPermissionAnswer } from "../permission-answer.js";
import { startPersonSimulation } from "../simulation.js";
import { FakeTab, TYPED_CHECK } from "./fake-person.js";

type Answer = { askId: unknown; kind: unknown; value: unknown };

/** Core with a build waiting on one person-needed ask and a permission ask nobody here may answer. */
function waitingCore(options: { refuseAnswer?: boolean } = {}): { control: PersonAskControl; answers: Answer[] } {
  const answers: Answer[] = [];
  const pending = () => [
    ...(answers.some(({ askId }) => askId === "check-1") ? [] : [{ turnId: "t1", ask: { askId: "check-1", kind: "choice", status: "pending", control: { name: null, kind: "person_check" }, createdAt: Date.now() - 1_500 } }]),
    { turnId: "t2", ask: { askId: "permission-1", kind: "permission", status: "pending", control: null, createdAt: Date.now() } },
  ];
  return {
    answers,
    control: {
      automationStudioCall: async (endpoint, payload) => {
        if (endpoint === "list-conversations") return { conversations: [{ conversationId: "c-flow", pendingAskCount: pending().length, subject: { kind: "flow", id: "flow-1" } }] };
        if (endpoint === "get-conversation") return { conversation: { turns: pending(), hasMore: false } };
        if (endpoint === "answer-ask") {
          if (options.refuseAnswer) throw new Error("Automation Studio call failed: answer-ask");
          answers.push({ askId: payload.askId, kind: payload.kind, value: payload.value });
          return { ask: {} };
        }
        throw new Error(`unexpected ${endpoint}`);
      },
    },
  };
}

const until = async (condition: () => boolean) => { for (let tries = 0; tries < 400 && !condition(); tries += 1) await new Promise((resolve) => setTimeout(resolve, 5)); };

test("the Lab answers a person-needed ask once, after clearing the check, and leaves every other ask alone", async () => {
  const { control, answers } = waitingCore();
  const store = new FakeTab(["Enter the characters you see below"], (step, tab) => { if (step === "press Continue shopping") tab.load([]); });
  const published: PersonHandOff[] = [];
  const person = startPersonSimulation({
    control, scope: { projectId: "project-1", domainId: "web-automation" }, scenarioId: "everything-store", module: TYPED_CHECK,
    expected: { person: "completes", required: true, because: "The store answers every page with its check until a person passes it." },
    tabs: () => [store], readState: async () => ({ image: 0, wrong: 0 }), onHandOff: async (handOff) => { published.push(handOff); }, pollMs: 5, lookForMs: 50,
  });
  await until(() => answers.length > 0);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const snapshot = await person.stop();
  assert.deepEqual(answers, [{ askId: "check-1", kind: "choice", value: "person_done" }], "answered once, and the permission never");
  assert.equal(snapshot.handOffs.length, 1);
  const [handOff] = snapshot.handOffs;
  assert.deepEqual({ ...handOff, secondsWaited: undefined }, { askId: "check-1", stage: "build", subject: { kind: "flow", id: "flow-1" }, scenarioId: "everything-store", check: "type-the-characters", did: "cleared", cleared: true, answer: "person_done", via: "core", secondsWaited: undefined, note: null }, "answered through Core: this thread is a Flow's, not the chat's");
  assert.ok(handOff!.secondsWaited >= 1.5, "waited from the ask being raised");
  assert.deepEqual(published, snapshot.handOffs);
  assert.deepEqual([snapshot.playable, snapshot.pollFailures, snapshot.expected?.required], [true, 0, true]);
});

test("with no check on screen the Lab presses Stop, and an answer that does not reach Core is recorded as none", async () => {
  const { control, answers } = waitingCore();
  const person = startPersonSimulation({ control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "everything-store", module: TYPED_CHECK, expected: null, tabs: () => [new FakeTab([])], readState: async () => ({}), pollMs: 5, lookForMs: 20 });
  await until(() => answers.length > 0);
  const snapshot = await person.stop();
  assert.deepEqual(answers[0]?.value, "person_stop");
  assert.equal(snapshot.handOffs[0]?.did, "no-check-visible");

  const refusing = waitingCore({ refuseAnswer: true });
  const stuck = startPersonSimulation({ control: refusing.control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "everything-store", module: TYPED_CHECK, expected: null, tabs: () => [new FakeTab([])], readState: async () => ({}), pollMs: 5, lookForMs: 20 });
  await new Promise((resolve) => setTimeout(resolve, 120));
  const record = await stuck.stop();
  assert.equal(record.handOffs.length, 1, "an ask is played once, even when its answer failed");
  assert.equal(record.handOffs[0]?.answer, null);
  assert.match(record.handOffs[0]?.note ?? "", /the answer did not reach Core: Automation Studio call failed: answer-ask/u);
});

test("a thread Core cannot list is counted and retried, not thrown", async () => {
  let listed = 0;
  const control: PersonAskControl = { automationStudioCall: async () => { listed += 1; throw new Error("Automation Studio call failed: list-conversations"); } };
  const person = startPersonSimulation({ control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "bigbox-retail", module: null, expected: null, tabs: () => [], readState: async () => ({}), pollMs: 5 });
  await until(() => listed >= 3);
  const snapshot = await person.stop();
  assert.ok(snapshot.pollFailures >= 3);
  assert.equal(snapshot.lastPollFailure, "Automation Studio call failed: list-conversations");
  assert.deepEqual([snapshot.playable, snapshot.handOffs.length], [false, 0]);
});

type PermissionAsk = { askId: string; missing: string[]; control: string | null; subject?: { kind: string; id: string } };

/** Core with permission asks waiting, each pending until answered, and nothing else. */
function permissionCore(raised: PermissionAsk[]): { control: PersonAskControl; answers: Answer[] } {
  const answers: Answer[] = [];
  const pending = (subjectKind: string) => raised
    .filter(({ askId, subject }) => (subject?.kind ?? "flow") === subjectKind && !answers.some((answer) => answer.askId === askId))
    .map(({ askId, missing, control }, index) => ({ turnId: `t-${askId}`, ask: { askId, kind: "permission", status: "pending", missing, control: { name: control, kind: "button" }, createdAt: Date.now() - 1_000 + index } }));
  return {
    answers,
    control: {
      automationStudioCall: async (endpoint, payload) => {
        if (endpoint === "list-conversations") return { conversations: [{ conversationId: "c-flow", pendingAskCount: pending("flow").length, subject: { kind: "flow", id: "flow-1" } }, { conversationId: "c-run", pendingAskCount: pending("run").length, subject: { kind: "run", id: "run-1" } }] };
        if (endpoint === "get-conversation") return { conversation: { turns: pending(payload.conversationId === "c-run" ? "run" : "flow"), hasMore: false } };
        if (endpoint === "answer-ask") { answers.push({ askId: payload.askId, kind: payload.kind, value: payload.value }); return { ask: {} }; }
        throw new Error(`unexpected ${endpoint}`);
      },
    },
  };
}

const PLACE_ORDER = { consequence: "move_money", control: "Place order" } as const;

test("given the task's point, the person allows the act there and refuses it anywhere else, each answer recorded apart from the hand-offs", async () => {
  const { control, answers } = permissionCore([
    { askId: "request-cookies", missing: ["create_new"], control: "Accept all" },
    { askId: "request-order", missing: ["move_money"], control: "  place ORDER " },
    { askId: "request-run", missing: ["move_money"], control: "Place order", subject: { kind: "run", id: "run-1" } },
    // Money on a control Core left unnamed (run-munzbfbj-2fb8947d, the cart page): the person cannot tell it is the task's act.
    { askId: "request-unnamed", missing: ["move_money"], control: null },
  ]);
  const published: PersonPermissionAnswer[] = [];
  const person = startPersonSimulation({ control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "bigbox-retail", module: null, expected: null, tabs: () => [], readState: async () => ({}), permissions: { point: PLACE_ORDER }, onPermissionAnswer: async (answer) => { published.push(answer); }, pollMs: 5 });
  await until(() => answers.length >= 4);
  await new Promise((resolve) => setTimeout(resolve, 30));
  const snapshot = await person.stop();
  assert.deepEqual(answers.map(({ askId, kind, value }) => [askId, kind, value]).sort(), [["request-cookies", "deny", undefined], ["request-order", "grant", undefined], ["request-run", "grant", undefined], ["request-unnamed", "deny", undefined]], "each answered once, grant or deny with no value");
  assert.deepEqual(snapshot.handOffs, [], "a permission is no hand-off, so the hand-off invariant scores nothing new");
  const byAsk = Object.fromEntries(snapshot.permissionAnswers.map((entry) => [entry.askId, { ...entry, secondsWaited: undefined }]));
  assert.deepEqual(byAsk["request-order"], { askId: "request-order", stage: "build", missing: ["move_money"], control: "  place ORDER ", verdict: "at_declared_point", reason: null, answer: "grant", via: "core", secondsWaited: undefined, note: null });
  assert.deepEqual(byAsk["request-cookies"], { askId: "request-cookies", stage: "build", missing: ["create_new"], control: "Accept all", verdict: "elsewhere", reason: "class_not_missing", answer: "deny", via: "core", secondsWaited: undefined, note: "not the task's permission point (class_not_missing)" });
  assert.deepEqual([byAsk["request-run"]?.stage, byAsk["request-run"]?.verdict, byAsk["request-run"]?.answer], ["run", "at_declared_point", "grant"], "a repair's ask during the run is answered by the same rule");
  assert.deepEqual([byAsk["request-unnamed"]?.verdict, byAsk["request-unnamed"]?.answer, byAsk["request-unnamed"]?.note], ["at_declared_point", "deny", "Core named no control, so the person cannot tell it is the task's act and refuses it"]);
  assert.ok(snapshot.permissionAnswers.every(({ secondsWaited }) => secondsWaited >= 0.9), "waited from the ask being raised");
  assert.deepEqual(published, snapshot.permissionAnswers);
});

test("with no point declared every permission is refused, and a task that says to ask first leaves the question for Core", async () => {
  const undeclared = permissionCore([{ askId: "request-order", missing: ["move_money"], control: "Place order" }]);
  const refusing = startPersonSimulation({ control: undeclared.control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "bigbox-retail", module: null, expected: null, tabs: () => [], readState: async () => ({}), permissions: { point: undefined }, pollMs: 5 });
  await until(() => undeclared.answers.length > 0);
  const refused = await refusing.stop();
  assert.deepEqual(undeclared.answers.map(({ kind }) => kind), ["deny"]);
  assert.deepEqual([refused.permissionAnswers[0]?.reason, refused.permissionAnswers[0]?.answer], ["no_point_declared", "deny"]);

  const askFirst = permissionCore([{ askId: "request-submit", missing: ["send_or_publish"], control: "Submit application" }]);
  const waiting = startPersonSimulation({ control: askFirst.control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "job-board", module: null, expected: null, tabs: () => [], readState: async () => ({}), permissions: { point: { consequence: "send_or_publish", control: "Submit application", askFirst: true } }, pollMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 60));
  const left = await waiting.stop();
  assert.deepEqual(askFirst.answers, [], "nothing is answered");
  assert.equal(left.permissionAnswers.length, 1, "the ask is recorded once, however many looks saw it pending");
  assert.deepEqual([left.permissionAnswers[0]?.verdict, left.permissionAnswers[0]?.answer], ["at_declared_point", null]);
});

test("without the task's point the person leaves permission asks alone and records none", async () => {
  const { control, answers } = permissionCore([{ askId: "request-order", missing: ["move_money"], control: "Place order" }]);
  const person = startPersonSimulation({ control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "bigbox-retail", module: null, expected: null, tabs: () => [], readState: async () => ({}), pollMs: 5 });
  await new Promise((resolve) => setTimeout(resolve, 40));
  const snapshot = await person.stop();
  assert.deepEqual(answers, []);
  assert.deepEqual(snapshot.permissionAnswers, []);
});

/**
 * A build started from the extension's chat asks in the chat, which is the
 * project's own thread, and the person at the panel answers it there. A run's
 * question on its own thread is still answered through Core, as before.
 */
test("an ask on the extension's chat thread is answered in the chat, and any other through Core, each recorded with where", async () => {
  const answers: Answer[] = [];
  const raised = [
    { askId: "request-chat", thread: "c-chat", subject: { kind: "project", id: "p" } },
    { askId: "request-run", thread: "c-run", subject: { kind: "run", id: "run-1" } },
  ];
  const pending = (thread: string) => raised
    .filter((ask) => ask.thread === thread && !answers.some((answer) => answer.askId === ask.askId))
    .map(({ askId }) => ({ turnId: `t-${askId}`, ask: { askId, kind: "permission", status: "pending", missing: ["move_money"], control: { name: "Place order", kind: "button" }, createdAt: Date.now() - 1_000 } }));
  const control: PersonAskControl = {
    automationStudioCall: async (endpoint, payload) => {
      if (endpoint === "list-conversations") return { conversations: raised.map(({ thread, subject }) => ({ conversationId: thread, pendingAskCount: pending(thread).length, subject })) };
      if (endpoint === "get-conversation") return { conversation: { turns: pending(String(payload.conversationId)), hasMore: false } };
      if (endpoint === "answer-ask") { answers.push({ askId: payload.askId, kind: payload.kind, value: payload.value }); return { ask: {} }; }
      throw new Error(`unexpected ${endpoint}`);
    },
  };
  const pressed: Array<{ askId: string; answer: unknown }> = [];
  const person = startPersonSimulation({
    control, scope: { projectId: "p", domainId: "web-automation" }, scenarioId: "bigbox-retail", module: null, expected: null, tabs: () => [], readState: async () => ({}),
    permissions: { point: PLACE_ORDER },
    answerInChat: async (ask, answer) => {
      if (ask.subject?.kind !== "project") return false;
      pressed.push({ askId: ask.askId, answer });
      // What pressing Allow in the panel does: the extension's relay answers the ask in Core.
      answers.push({ askId: ask.askId, kind: answer.kind, value: undefined });
      return true;
    },
    pollMs: 5,
  });
  await until(() => answers.length >= 2);
  const snapshot = await person.stop();
  assert.deepEqual(pressed, [{ askId: "request-chat", answer: { kind: "grant" } }], "only the chat's own question is pressed in the chat");
  const byAsk = Object.fromEntries(snapshot.permissionAnswers.map((entry) => [entry.askId, entry]));
  assert.deepEqual([byAsk["request-chat"]?.stage, byAsk["request-chat"]?.answer, byAsk["request-chat"]?.via], ["build", "grant", "chat"]);
  assert.deepEqual([byAsk["request-run"]?.stage, byAsk["request-run"]?.answer, byAsk["request-run"]?.via], ["run", "grant", "core"]);
});
