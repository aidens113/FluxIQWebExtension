import assert from "node:assert/strict";
import test from "node:test";
import type { PersonHandOff } from "../hand-off-record.js";
import type { PersonAskControl } from "../asks.js";
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
  assert.deepEqual({ ...handOff, secondsWaited: undefined }, { askId: "check-1", stage: "build", subject: { kind: "flow", id: "flow-1" }, scenarioId: "everything-store", check: "type-the-characters", did: "cleared", cleared: true, answer: "person_done", secondsWaited: undefined, note: null });
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
