// The port the panel gives the chat, and the watch that tells it when a task is at
// work: the port offers no PIN dialog, so the one question that needs a PIN goes to
// FluxIQ, and work in progress leaves it only Cancel.

import assert from "node:assert/strict";
import test from "node:test";
import { createAskPort } from "../ask-port";
import { createWorkWatch } from "../work-watch";

const panelCommand = { askId: "panel-command.1", kind: "confirm", status: "pending", parks: false, consequences: ["delete"] };

test("the port offers no PIN dialog, so the chat sends that question to FluxIQ", () => {
  const port = createAskPort({ working: () => false, surface: () => "sidepanel" });
  assert.equal(port.reauthorize, undefined);
  assert.equal(port.present(panelCommand)?.note, "This panel can't take your PIN.");
});

test("a question that needs a PIN, once a task is at work, leaves only Cancel", () => {
  const port = createAskPort({ working: () => true, surface: () => "sidepanel" });
  assert.deepEqual(port.present(panelCommand)?.actions.map((action) => action.label), ["Cancel"]);
});

test("the surface is the one the panel mounted on", () => {
  const person = { askId: "person-needed.1", kind: "choice", status: "pending", parks: true, options: [{ id: "person_done", label: "Continue" }], control: { kind: "person_check" } };
  const target = globalThis as unknown as { document?: unknown };
  const before = target.document;
  target.document = { documentElement: { dataset: { surface: "popup" } } };
  try {
    assert.match(createAskPort({ working: () => false }).present(person)?.description ?? "", /This window closes/u);
  } finally {
    target.document = before;
  }
  assert.equal(createAskPort({ working: () => false }).present(person)?.description, "");
});

test("the watch says working until it hears otherwise, and follows each state", async () => {
  let listener: (state: unknown) => void = () => undefined;
  const idle = { display: null };
  const watch = createWorkWatch({
    read: async () => ({ ok: true, value: { state: idle } }),
    subscribe: (heard) => {
      listener = heard;
      return () => undefined;
    }
  });
  assert.equal(watch.working(), true, "not knowing opens no dialog");
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(watch.working(), false);
  listener({ display: { working: true, outcome: null } });
  assert.equal(watch.working(), true);
  listener({ display: { working: false, outcome: "waiting" } });
  assert.equal(watch.working(), true, "a task waiting on the person is still in the middle");
  listener({ display: { working: false, outcome: "done" } });
  assert.equal(watch.working(), false);
});

test("a failed read leaves it working, and a push heard first is not overwritten by the older read", async () => {
  const failed = createWorkWatch({ read: async () => ({ ok: false, sentence: "no" }), subscribe: () => () => undefined });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(failed.working(), true);

  let finish: (value: { ok: true; value: { state: unknown } }) => void = () => undefined;
  let listener: (state: unknown) => void = () => undefined;
  const raced = createWorkWatch({
    read: () => new Promise((resolve) => { finish = resolve; }),
    subscribe: (heard) => {
      listener = heard;
      return () => undefined;
    }
  });
  listener({ display: null });
  finish({ ok: true, value: { state: { display: { working: true } } } });
  await new Promise((resolve) => setTimeout(resolve, 0));
  assert.equal(raced.working(), false);
});
