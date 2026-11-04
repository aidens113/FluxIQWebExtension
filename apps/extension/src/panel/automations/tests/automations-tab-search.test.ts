// The Automations tab with tasks and a library: one search box over all of them, a Tasks /
// Library switch that tells the match count of the part not showing, and an open task taking
// the whole tab. Without either the tab is the plain list.

import assert from "node:assert/strict";
import test from "node:test";
import { createFakeTasksMemory, createFakeTasksPort, fakeTasks } from "@fluxiq/ui-components/testing";
import { createTasksScreen } from "@fluxiq/ui-components";
import { AUTOMATION_PANEL_MESSAGES as M } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createAutomationsTab, type AutomationsTabHooks } from "../automations-tab";

const NOW = Date.now();
async function withView(options: { tasks?: boolean; library?: boolean }, body: (view: ReturnType<typeof setup>) => Promise<void>): Promise<void> {
  await withFakeDocument(async () => {
    const view = setup(options);
    try {
      await settle();
      await body(view);
    } finally {
      view.tab.setActive(false);
    }
  });
}

const settle = async (): Promise<void> => { for (let turn = 0; turn < 10; turn++) await new Promise<void>((resolve) => setTimeout(resolve, 0)); };

function setup(options: { tasks?: boolean; library?: boolean } = {}) {
  const connected = statusWith({ connectionState: "connected", paired: true, projectId: "project-1" });
  const flows = [{ flowId: "a", name: "Order the groceries", updatedAt: 3 }, { flowId: "b", name: "Copy bike listings", updatedAt: 2 }];
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    assert.equal(message.type, M.listAutomations);
    return { ok: true, value: { payload: { flows, runs: [] } } as T };
  };
  const port = createFakeTasksPort({ tasks: Object.values(fakeTasks(NOW)) });
  const libraryCalls: string[] = [];
  let libraryListener: (count: number | null) => void = () => undefined;
  const hooks: AutomationsTabHooks = {
    choose: () => undefined,
    review: document.createElement("div"),
    newAutomation: document.createElement("div"),
    ...(options.tasks === false ? {} : { tasks: createTasksScreen({ port, results: port.results, memory: createFakeTasksMemory(), projectId: () => "project-1", now: () => NOW, debounceMs: 0 }) }),
    ...(options.library === false ? {} : { library: {
      element: document.createElement("div"),
      search: (text: string) => { libraryCalls.push(`search:${text}`); },
      setActive: (active: boolean) => { libraryCalls.push(`active:${active}`); },
      onMatches: (listener: (count: number | null) => void) => { libraryListener = listener; }
    } })
  };
  const tab = createAutomationsTab({ surface: "sidepanel", store: { request, current: () => connected, subscribe: () => () => undefined } }, hooks);
  tab.element.hidden = false;
  tab.render(connected);
  tab.setActive(true);
  const root = fake(tab.element);
  const search = root.querySelectorAll("input")[0]!;
  const type = async (text: string): Promise<void> => {
    search.value = text;
    search.dispatch("input");
    await settle();
  };
  const segmentButtons = (): FakeElement[] => root.byClass("segment-button");
  return { tab, root, type, libraryCalls, libraryMatches: (count: number | null) => libraryListener(count), segmentButtons, rows: () => root.byClass("automation-row") };
}

test("without tasks or a library the tab has no search box and no switch", async () => withFakeDocument(async () => {
  const connected = statusWith({ connectionState: "connected", paired: true });
  const request = async <T>(): Promise<PanelResult<T>> => ({ ok: true, value: { payload: { flows: [], runs: [] } } as T });
  const tab = createAutomationsTab({ surface: "sidepanel", store: { request, current: () => connected, subscribe: () => () => undefined } }, { choose: () => undefined, review: document.createElement("div"), newAutomation: document.createElement("div") });
  const root = fake(tab.element);
  assert.equal(root.querySelectorAll("input").length, 0);
  assert.equal(root.byClass("segment-button").length, 0);
}));

test("with tasks and a library: a search box, both segments, tasks first, then the automations", async () => withView({}, async (view) => {
  const input = view.root.querySelectorAll("input")[0]!;
  assert.equal(input.getAttribute("aria-label"), "Search tasks, automations and subflows");
  assert.deepEqual(view.segmentButtons().map((button) => button.textContent), ["Tasks", "Library"]);
  assert.equal(view.segmentButtons()[0]!.getAttribute("aria-pressed"), "true");
  assert.ok(view.root.byClass("task-row").length >= 9, "the tasks are listed");
  assert.equal(view.rows().length, 2, "the existing automations rows stay");
  assert.deepEqual(view.root.byClass("automations-pane").map((pane) => pane.hidden), [false, true]);
}));

test("one search reaches tasks, automations and the library, and the part not showing tells its count", async () => withView({}, async (view) => {
  await view.type("bike");
  assert.deepEqual(view.libraryCalls.filter((call) => call.startsWith("search:")), ["search:bike"]);
  assert.deepEqual(view.rows().map((row) => row.textContent.includes("Copy bike listings")), [true]);
  view.libraryMatches(2);
  assert.equal(view.segmentButtons()[1]!.textContent, "Library (2)");
  assert.equal(view.segmentButtons()[1]!.getAttribute("aria-label"), "Library, 2 matches");
  assert.match(view.segmentButtons()[0]!.textContent, /^Tasks$/u, "the showing segment tells no count");
  await view.segmentButtons()[1]!.dispatch("click");
  assert.equal(view.segmentButtons()[0]!.textContent, "Tasks (2)", "one task and one automation match 'bike'");
  assert.deepEqual(view.root.byClass("automations-pane").map((pane) => pane.hidden), [true, false]);
  assert.ok(view.libraryCalls.includes("active:true"));
  await view.type("zzz");
  view.segmentButtons()[0]!.dispatch("click");
  assert.match(view.root.byClass("card-line").map((line) => line.textContent).join("|"), /No automations match \u201czzz\u201d\./u);
  await view.type("");
  assert.equal(view.rows().length, 2);
}));

test("an open task takes the whole tab, and showTasks gives the list back", async () => withView({}, async (view) => {
  view.root.querySelectorAll("button").find((button) => button.getAttribute("data-key") === "row:task-jobs")!.dispatch("click");
  await settle();
  const controls = view.root.byClass("automations-controls")[0]!;
  const group = view.root.byClass("automations-group")[0]!;
  assert.equal(controls.hidden, true);
  assert.equal(group.hidden, true);
  assert.equal(view.root.byClass("task-title")[0]!.textContent, "Collect the new job posts every morning");
  view.tab.showTasks();
  await settle();
  assert.equal(controls.hidden, false);
  assert.equal(group.hidden, false);
  assert.equal(view.root.byClass("task-title").length, 0);
}));

test("tasks alone: the box and the list, with no Library switch", async () => withView({ library: false }, async (view) => {
  assert.equal(view.segmentButtons().length, 0);
  assert.equal(view.root.querySelectorAll("input").length, 1);
}));
