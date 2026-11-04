// The port the panel gives the chat, and the watch that tells it when a task is at
// work: no dialog means no way to reach one, and work in progress refuses a dialog
// even for a question drawn before it began.

import assert from "node:assert/strict";
import test from "node:test";
import type { ChatReauthorizeRequest } from "@fluxiq/ui-components";
import { createAskPort } from "../ask-port";
import { createWorkWatch } from "../work-watch";

const request = (): ChatReauthorizeRequest & { cancels: number } => {
  const made = { title: "t", description: "d", actionLabel: "a", cancels: 0, submit: async () => ({ ok: true as const }), cancel() { made.cancels += 1; } };
  return made;
};
const panelCommand = { askId: "panel-command.1", kind: "confirm", status: "pending", parks: false, consequences: ["delete"] };

test("with no dialog the port offers none, so the chat sends that question to FluxIQ", () => {
  const port = createAskPort({ working: () => false, surface: () => "sidepanel" });
  assert.equal(port.reauthorize, undefined);
  assert.equal(port.present(panelCommand)?.note, "This panel can't take your PIN.");
});

test("with a dialog, a press while no task works opens it; a press once work has begun opens nothing", () => {
  let working = false;
  const shown: ChatReauthorizeRequest[] = [];
  const port = createAskPort({ working: () => working, surface: () => "sidepanel", pinDialog: (made) => shown.push(made) });
  const first = request();
  port.reauthorize!(first);
  assert.deepEqual(shown, [first]);
  working = true;
  const second = request();
  port.reauthorize!(second);
  assert.equal(shown.length, 1);
  assert.equal(second.cancels, 1);
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
