import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createTopBar } from "../top-bar";
import type { ShellTab } from "../screen-state";

async function setup(body: (view: ReturnType<typeof mounted>) => void) {
  await withFakeDocument(() => {
    const doc = document as unknown as { createElement(tag: string): FakeElement; activeElement?: FakeElement };
    const make = doc.createElement;
    doc.createElement = (tag) => {
      const el = make(tag);
      el.focus = () => { doc.activeElement = el; };
      Object.assign(el, { classList: { toggle: (name: string, on: boolean) => {
        const names = new Set(el.className.split(/\s+/u).filter(Boolean));
        if (on) names.add(name); else names.delete(name);
        el.className = [...names].join(" ");
      } } });
      return el;
    };
    body(mounted(doc));
  });
}

function mounted(doc: { activeElement?: FakeElement }) {
  const chosen: ShellTab[] = [];
  const bar = createTopBar({ onTab: (tab) => { chosen.push(tab); bar.showScreen(tab); }, onGear: () => {}, record: document.createElement("button"), openFluxIQ: document.createElement("button") });
  const tabs = fake(bar.element).byClass("top-tab");
  bar.showScreen("chat");
  function key(index: number, key: string, flags: Record<string, unknown> = {}) {
    let prevented = false;
    tabs[index]!.dispatch("keydown", { key, preventDefault: () => { prevented = true; }, ...flags });
    return prevented;
  }
  return { bar, tabs, chosen, doc, key };
}

test("plain arrows wrap and Home/End select, focus and maintain roving tab state", async () => setup(({ tabs, chosen, doc, key }) => {
  for (const [index, name, expected] of [[0, "ArrowRight", 1], [1, "ArrowRight", 0], [0, "ArrowLeft", 1], [1, "Home", 0], [0, "End", 1]] as const) {
    assert.equal(key(index, name), true);
    assert.equal(doc.activeElement, tabs[expected]);
    assert.equal(chosen.at(-1), expected === 0 ? "chat" : "automations");
    assert.equal(tabs[expected]!.getAttribute("aria-selected"), "true");
    assert.equal((tabs[expected] as unknown as HTMLButtonElement).tabIndex, 0);
    assert.equal((tabs[1 - expected] as unknown as HTMLButtonElement).tabIndex, -1);
  }
}));

test("modified and composing navigation keys are unconsumed and never change tab/focus", async () => setup(({ tabs, chosen, doc, key }) => {
  tabs[0]!.focus();
  for (const name of ["ArrowLeft", "ArrowRight", "Home", "End"]) {
    for (const flag of ["altKey", "ctrlKey", "metaKey", "shiftKey", "isComposing"]) assert.equal(key(0, name, { [flag]: true }), false, `${flag} ${name}`);
    assert.equal(key(0, name, { keyCode: 229 }), false);
  }
  assert.deepEqual(chosen, []);
  assert.equal(doc.activeElement, tabs[0]);
}));

test("Settings/gated screens keep a reachable tab; Enter/Space stay native", async () => setup(({ bar, tabs, chosen, key }) => {
  for (const screen of ["settings", "getting-started"] as const) {
    bar.showScreen(screen);
    assert.deepEqual(tabs.map((tab) => tab.getAttribute("aria-selected")), ["false", "false"]);
    assert.deepEqual(tabs.map((tab) => (tab as unknown as HTMLButtonElement).tabIndex), [0, -1]);
  }
  assert.equal(key(0, "Enter"), false);
  assert.equal(key(0, " "), false);
  assert.deepEqual(chosen, []);
  tabs[1]!.dispatch("click");
  assert.deepEqual(chosen, ["automations"]);
  assert.equal(tabs[1]!.getAttribute("aria-selected"), "true");
}));
