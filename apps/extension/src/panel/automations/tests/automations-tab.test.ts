import assert from "node:assert/strict";
import test from "node:test";
import { SIMPLE_PANEL_MESSAGES as M } from "../../../shared/protocol";
import type { PanelMessage, PanelResult } from "../../state";
import { statusWith } from "../../tests/status-fixture";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createAutomationsTab } from "../automations-tab";
import type { AutomationRowView } from "../controller";

// Focus semantics are local to this suite; the shared chat fake remains unchanged.
async function withFocusedDocument(body: (doc: { activeElement: FakeElement; focusCalls: FakeElement[] }) => Promise<void>): Promise<void> {
  await withFakeDocument(async () => {
    const doc = document as unknown as { createElement(tag: string): FakeElement; activeElement: FakeElement; focusCalls: FakeElement[] };
    const make = doc.createElement;
    const bodyElement = new FakeElement("body");
    doc.activeElement = bodyElement;
    doc.focusCalls = [];
    doc.createElement = (tag) => {
      const element = make(tag);
      element.focus = () => { doc.activeElement = element; doc.focusCalls.push(element); };
      const remove = element.removeChild.bind(element);
      element.removeChild = (node) => {
        if (node === doc.activeElement || (node instanceof FakeElement && node.descendants().includes(doc.activeElement))) doc.activeElement = bodyElement;
        remove(node);
      };
      return element;
    };
    await body(doc);
  });
}

function setup() {
  let flows = [{ flowId: "a", name: "Alpha", updatedAt: 3 }, { flowId: "b", name: "Beta", updatedAt: 2 }, { flowId: "c", name: "Gamma", updatedAt: 1 }];
  const chosen: AutomationRowView[] = [];
  const connected = statusWith({ connectionState: "connected" });
  const request = async <T>(message: PanelMessage): Promise<PanelResult<T>> => {
    assert.equal(message.type, M.listAutomations);
    return { ok: true, value: { payload: { flows, runs: [] } } as T };
  };
  const tab = createAutomationsTab({ surface: "sidepanel", store: { request, current: () => connected, subscribe: () => () => undefined } }, {
    choose: (row) => chosen.push(row), review: document.createElement("div"), newAutomation: document.createElement("div")
  });
  tab.element.hidden = false;
  tab.render(connected);
  const refresh = async () => { tab.setActive(false); tab.setActive(true); await Promise.resolve(); await Promise.resolve(); };
  const root = fake(tab.element);
  return { tab, root, chosen, refresh, rows: () => root.byClass("automation-row"), setFlows: (next: typeof flows) => { flows = next; } };
}

test("working changes and unchanged refresh retain row/button identity, focus and scroll", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    const buttons = view.rows();
    const rows = buttons.map((button) => button.parentNode);
    buttons[1]!.focus();
    const list = view.root.byClass("automations-list")[0]!;
    list.scrollTop = 123;
    view.tab.setWorking(true);
    await view.refresh();
    assert.deepEqual(view.rows(), buttons);
    assert.deepEqual(view.rows().map((button) => button.parentNode), rows);
    assert.equal(doc.activeElement, buttons[1]);
    assert.equal(doc.focusCalls.length, 1, "unchanged refresh never detaches/refocuses the button");
    assert.equal(list.scrollTop, 123);
  } finally { view.tab.setActive(false); }
}));

test("refresh updates the same button and activation uses the latest row", async () => withFocusedDocument(async () => {
  const view = setup();
  try {
    await view.refresh();
    const button = view.rows()[0]!;
    view.setFlows([{ flowId: "a", name: "Renamed", updatedAt: 4 }]);
    await view.refresh();
    assert.equal(view.rows()[0], button);
    assert.equal(button.getAttribute("title"), "Open Renamed in the chat");
    assert.match(button.textContent, /Renamed/u);
    button.dispatch("click");
    assert.equal(view.chosen[0]?.name, "Renamed");
    assert.equal(view.chosen[0]?.flowId, "a");
  } finally { view.tab.setActive(false); }
}));

test("reordering preserves focused row and button identities", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    const [a, b, c] = view.rows();
    b!.focus();
    view.setFlows([{ flowId: "c", name: "Gamma", updatedAt: 5 }, { flowId: "b", name: "Beta", updatedAt: 4 }, { flowId: "a", name: "Alpha", updatedAt: 3 }]);
    await view.refresh();
    assert.deepEqual(view.rows(), [c, b, a]);
    assert.equal(doc.activeElement, b);
  } finally { view.tab.setActive(false); }
}));

test("removing a focused row chooses the next surviving row then previous", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    const [a, b, c] = view.rows();
    b!.focus();
    view.setFlows([{ flowId: "a", name: "Alpha", updatedAt: 3 }, { flowId: "c", name: "Gamma", updatedAt: 1 }]);
    await view.refresh();
    assert.equal(doc.activeElement, c);
    view.setFlows([{ flowId: "a", name: "Alpha", updatedAt: 3 }]);
    await view.refresh();
    assert.equal(doc.activeElement, a);
  } finally { view.tab.setActive(false); }
}));

test("removing the last focused row moves to the visible named empty message", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    view.rows()[0]!.focus();
    view.setFlows([]);
    await view.refresh();
    assert.match(doc.activeElement.textContent, /No automations yet/u);
    assert.equal(doc.activeElement.hidden, false);
    assert.equal(doc.activeElement.getAttribute("tabindex"), "-1");
  } finally { view.tab.setActive(false); }
}));

test("background refresh leaves external focus alone and hidden rows do not claim focus", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    const external = fake(document.createElement("button"));
    external.focus();
    view.setFlows([{ flowId: "b", name: "Beta", updatedAt: 4 }]);
    await view.refresh();
    assert.equal(doc.activeElement, external);
    view.rows()[0]!.focus();
    view.tab.element.hidden = true;
    const focusCount = doc.focusCalls.length;
    view.setFlows([]);
    await view.refresh();
    assert.equal(doc.focusCalls.length, focusCount, "hidden panel refresh does not move focus");
  } finally { view.tab.setActive(false); }
}));


test("connection loss moves row focus to the visible named heading", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    view.rows()[0]!.focus();
    view.tab.render(statusWith({ connectionState: "disconnected" }));
    assert.equal(doc.activeElement.tagName, "H2");
    assert.equal(doc.activeElement.textContent, "Your automations");
    assert.equal(doc.activeElement.getAttribute("tabindex"), "-1");
  } finally { view.tab.setActive(false); }
}));

test("new rows provide a removal fallback and hidden-document updates do not move focus", async () => withFocusedDocument(async (doc) => {
  const view = setup();
  try {
    await view.refresh();
    view.rows()[0]!.focus();
    view.setFlows([{ flowId: "d", name: "Delta", updatedAt: 4 }]);
    await view.refresh();
    assert.equal(doc.activeElement, view.rows()[0]);
    assert.match(doc.activeElement.textContent, /Delta/u);
    Object.defineProperty(document, "visibilityState", { configurable: true, value: "hidden" });
    const focusCount = doc.focusCalls.length;
    view.setFlows([]);
    await view.refresh();
    assert.equal(doc.focusCalls.length, focusCount);
  } finally { view.tab.setActive(false); }
}));
