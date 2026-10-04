import assert from "node:assert/strict";
import test from "node:test";
import type { Page } from "@playwright/test";
import { extensionViewPanelDriver, pagePanelDriver } from "../panel-driver.js";

function view(state: { project: string; scope: string; disabled?: boolean; parked?: boolean }) {
  const events: Array<{ type: string; detail: unknown }> = [];
  const panel = {
    location: { pathname: "/sidepanel/index.html" },
    CustomEvent: class { constructor(readonly type: string, readonly options: { detail: unknown }) {} get detail() { return this.options.detail; } },
    dispatchEvent(event: { type: string; detail: { projectId: string } }) { events.push({ type: event.type, detail: event.detail }); state.project = event.detail.projectId; return true; },
    document: { querySelector(selector: string) {
      if (selector.includes("Chat with FluxIQ")) return { getAttribute(name: string) { return name.endsWith("scope-state") ? state.scope : state.project; }, querySelector(selector: string) { return selector === ".composer-draft-review" ? { hidden: !state.parked } : { disabled: state.disabled ?? false, readOnly: false }; } };
      if (selector.includes("textarea")) return { disabled: state.disabled ?? false, readOnly: false };
      return null;
    } }
  };
  return { panel, events };
}

test("sidepanel project setup dispatches only exact navigation and reads actual empty-ready scope without sending", async () => {
  const { panel, events } = view({ project: "project.old", scope: "ready" });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { extension: { getViews: () => [panel] } } });
  try {
    const control = { evaluate: async (fn: (value: unknown) => unknown, value: unknown) => fn(value) } as unknown as Page;
    const driver = extensionViewPanelDriver(control, "sidepanel/index.html");
    const result = await driver.selectProject("project.new", 10);
    assert.deepEqual(events, [{ type: "fluxiq:chat-project", detail: { projectId: "project.new" } }]);
    assert.deepEqual(result, { projectId: "project.new", scopeState: "ready", composerAvailable: true, composerEnabled: true });
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("a parked foreign draft blocks setup before the editable textarea can be overwritten", async () => {
  const { panel } = view({ project: "project.new", scope: "ready", parked: true });
  const previous = Object.getOwnPropertyDescriptor(globalThis, "chrome");
  Object.defineProperty(globalThis, "chrome", { configurable: true, value: { extension: { getViews: () => [panel] } } });
  try {
    const control = { evaluate: async (fn: (value: unknown) => unknown, value: unknown) => fn(value) } as unknown as Page;
    const driver = extensionViewPanelDriver(control, "sidepanel/index.html");
    assert.equal((await driver.projectScope()).composerEnabled, false);
    await assert.rejects(driver.selectProject("project.new", 10), /Timed out/);
  } finally {
    if (previous) Object.defineProperty(globalThis, "chrome", previous); else Reflect.deleteProperty(globalThis, "chrome");
  }
});

test("page driver fails before send on actual scope error and requires a mounted project receiver", async () => {
  const page = { evaluate: async (_fn: unknown, value: { action: string }) => value.action === "navigate" ? undefined : { projectId: "project.new", scopeState: "error", composerAvailable: true, composerEnabled: false } } as unknown as Page;
  await assert.rejects(pagePanelDriver(page).selectProject("project.new", 10), /not ready|error/);
});

test("trusted page driver dispatches the same window event and reads the mounted owner without requiring an enabled empty Send", async () => {
  const { panel, events } = view({ project: "project.old", scope: "ready" });
  const page = { evaluate: async (fn: (value: unknown) => unknown, value: unknown) => {
    const saved = new Map<string, PropertyDescriptor | undefined>();
    for (const name of ["document", "CustomEvent", "dispatchEvent"] as const) {
      saved.set(name, Object.getOwnPropertyDescriptor(globalThis, name));
      Object.defineProperty(globalThis, name, { configurable: true, value: panel[name] });
    }
    try { return fn(value); }
    finally { for (const [name, property] of saved) { if (property) Object.defineProperty(globalThis, name, property); else Reflect.deleteProperty(globalThis, name); } }
  } } as unknown as Page;
  assert.equal((await pagePanelDriver(page).selectProject("project.new", 100)).scopeState, "ready");
  assert.deepEqual(events, [{ type: "fluxiq:chat-project", detail: { projectId: "project.new" } }]);
});
