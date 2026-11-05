// The tasks screen as the panel mounts it: none without a port, the port's tasks for the
// connected project, Open in chat as a thread target, and a restored task bringing the tab forward.

import assert from "node:assert/strict";
import test from "node:test";
import { createFakeTasksMemory, createFakeTasksPort, fake, fakeTasks, withFakeDocument } from "@fluxiq/ui-components/testing";
import type { ChatTarget } from "../../chat";
import type { PanelContext } from "../../shell";
import { statusWith } from "../../tests/status-fixture";
import { createTasksPanel } from "../create-tasks-panel";

const NOW = Date.now();
const connected = statusWith({ connectionState: "connected", paired: true, projectId: "project-1" });
const store = { request: async () => ({ ok: false as const, sentence: "unused" }), current: () => connected, subscribe: () => () => undefined };
const context = { surface: "sidepanel", store } as unknown as PanelContext;

function host() {
  const calls: string[] = [];
  const targets: ChatTarget[] = [];
  return { calls, targets, host: { openInChat: (target: ChatTarget) => targets.push(target), showChat: () => calls.push("chat"), showAutomations: () => calls.push("automations") } };
}

const settle = async (): Promise<void> => { for (let turn = 0; turn < 8; turn++) await new Promise<void>((resolve) => setTimeout(resolve, 0)); };

test("without a port the build's own tasks port is used, so the screen is there", async () => withFakeDocument(async () => {
  const scope = globalThis as { chrome?: unknown };
  const before = scope.chrome;
  scope.chrome = { runtime: { onMessage: { addListener: () => undefined, removeListener: () => undefined } } };
  try {
    assert.notEqual(createTasksPanel(context, {}, host().host), undefined);
  } finally {
    scope.chrome = before;
  }
}));

test("with a port it lists the connected project's tasks and opens one in the chat as a thread", async () => withFakeDocument(async () => {
  const port = createFakeTasksPort({ tasks: Object.values(fakeTasks(NOW)) });
  const shell = host();
  const screen = createTasksPanel(context, { tasks: { port, results: port.results }, taskMemory: createFakeTasksMemory() }, shell.host);
  assert.notEqual(screen, undefined);
  screen!.setActive(true);
  await settle();
  const root = fake(screen!.element);
  assert.ok(root.byClass("task-row").length >= 9);
  const row = root.querySelectorAll("button").find((button) => button.getAttribute("data-key") === "row:task-deals")!;
  row.dispatch("click");
  await settle();
  root.querySelectorAll("button").find((button) => button.getAttribute("data-key") === "open-in-chat")!.dispatch("click");
  assert.deepEqual(shell.targets, [{ kind: "thread", conversationId: "conv-deals", projectId: "project-1" }]);
  assert.deepEqual(shell.calls, ["chat"]);
}));

test("a task that was open when the panel closed brings the Automations tab forward", async () => withFakeDocument(async () => {
  const port = createFakeTasksPort({ tasks: Object.values(fakeTasks(NOW)) });
  const shell = host();
  const screen = createTasksPanel(context, { tasks: { port, results: port.results }, taskMemory: createFakeTasksMemory({ projectId: "project-1", taskId: "task-jobs" }) }, shell.host)!;
  screen.restore();
  await settle();
  assert.deepEqual(shell.calls, ["automations"]);
  assert.equal(screen.isOpen(), true);
}));
