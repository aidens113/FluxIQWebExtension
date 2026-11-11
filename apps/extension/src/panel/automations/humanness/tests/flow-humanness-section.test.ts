// The open Flow's humanness on its strip: the port sends one background
// message per read or change with its fields written by name, the section reads
// the Flow when it is shown and on each opening, says the starting value it
// inherits and follows a change of it, commits a set and a clear, shows Core's
// refusal in Core's words, and stays hidden where the extension cannot read it.

import assert from "node:assert/strict";
import test from "node:test";
import { RUNTIME_MESSAGES } from "../../../../shared/constants";
import type { ExtensionStatus } from "../../../../shared/protocol";
import { fake, withFakeDocument, type FakeElement } from "../../../chat/tests/fake-dom";
import type { PanelMessage, PanelResult, PanelStore } from "../../../state";
import { createFlowHumannessSection } from "../flow-humanness-section";
import { flowHumannessPort } from "../flow-humanness-port";

const settle = () => new Promise<void>((resolve) => setTimeout(resolve, 0));
const one = (root: FakeElement, className: string): FakeElement => root.byClass(className)[0]!;
const OUT_OF_RANGE = "Humanness is a whole number from 0 to 100.";

function statusWith(humanness: number): ExtensionStatus {
  return { connectionState: "connected", settings: { humanness } } as unknown as ExtensionStatus;
}

/** Answers reads with `level` (absent: none of its own) and sets with what Core would hold, keeping the messages. */
function background(level: { humanness?: number } = {}, refuse?: PanelResult<unknown>) {
  const sent: PanelMessage[] = [];
  let held = level.humanness;
  const request = (async (message: PanelMessage) => {
    sent.push(message);
    if (message.type === RUNTIME_MESSAGES.panelFlowHumannessSet) {
      if (refuse !== undefined) return refuse;
      held = typeof message.humanness === "number" ? message.humanness : undefined;
    }
    return { ok: true, value: { ok: true, payload: held === undefined ? {} : { humanness: held } } };
  }) as PanelStore["request"];
  return { sent, request };
}

function mount(request: PanelStore["request"]) {
  const section = createFlowHumannessSection(flowHumannessPort(request));
  const root = fake(section.element);
  return { section, root, toggle: one(root, "flow-humanness-toggle"), panel: one(root, "flow-humanness-panel") };
}

test("the port reads and sets a Flow's level with one message each, the session's project standing in", async () => {
  const b = background({ humanness: 20 });
  const port = flowHumannessPort(b.request);
  assert.deepEqual(await port.read("flow-1"), { ok: true, value: { humanness: 20 } });
  assert.deepEqual(await port.set("flow-1", 45), { ok: true, value: { humanness: 45 } });
  assert.deepEqual(await port.set("flow-1", null), { ok: true, value: {} });
  assert.deepEqual(b.sent, [
    { type: RUNTIME_MESSAGES.panelFlowHumannessRead, flowId: "flow-1" },
    { type: RUNTIME_MESSAGES.panelFlowHumannessSet, flowId: "flow-1", humanness: 45 },
    { type: RUNTIME_MESSAGES.panelFlowHumannessSet, flowId: "flow-1", humanness: null }
  ]);
});

test("a Flow with no level of its own shows the starting value it uses, behind Humanness · N, and follows a change of it", async () => {
  await withFakeDocument(async () => {
    const b = background();
    const view = mount(b.request);
    assert.equal(view.root.hidden, true, "hidden until the first read");
    view.section.render(statusWith(30));
    view.section.show("flow-1");
    await settle();
    assert.equal(view.root.hidden, false);
    assert.equal(view.toggle.textContent, "Humanness · 30");
    assert.equal(view.toggle.getAttribute("aria-expanded"), "false");
    assert.equal(view.panel.hidden, true);
    view.toggle.dispatch("click");
    await settle();
    assert.equal(view.panel.hidden, false);
    assert.equal(view.toggle.getAttribute("aria-expanded"), "true");
    assert.equal(view.toggle.getAttribute("aria-controls"), view.panel.id);
    assert.equal(one(view.root, "humanness-label").textContent, "Humanness for this Flow");
    assert.match(one(view.root, "humanness-inherited").textContent, /^Uses your starting value \(30\)\./u);
    view.section.render(statusWith(65));
    assert.match(one(view.root, "humanness-inherited").textContent, /^Uses your starting value \(65\)\./u, "a change in Settings shows on the open control");
    assert.equal(view.toggle.textContent, "Humanness · 65");
    assert.deepEqual(b.sent.map((message) => message.type), [RUNTIME_MESSAGES.panelFlowHumannessRead, RUNTIME_MESSAGES.panelFlowHumannessRead], "read when shown and again on opening");
  });
});

test("moving the slider sets the Flow's own level once, and Use starting value clears it with null", async () => {
  await withFakeDocument(async () => {
    const b = background();
    const view = mount(b.request);
    view.section.render(statusWith(10));
    view.section.show("flow-1");
    await settle();
    view.toggle.dispatch("click");
    await settle();
    const range = one(view.root, "humanness-range");
    range.value = "50";
    range.dispatch("input");
    range.dispatch("change");
    await settle();
    assert.equal(view.toggle.textContent, "Humanness · 50");
    assert.equal(one(view.root, "humanness-status").textContent, "Saved.");
    one(view.root, "humanness-clear").dispatch("click");
    await settle();
    assert.equal(view.toggle.textContent, "Humanness · 10");
    assert.deepEqual(b.sent.filter((message) => message.type === RUNTIME_MESSAGES.panelFlowHumannessSet), [
      { type: RUNTIME_MESSAGES.panelFlowHumannessSet, flowId: "flow-1", humanness: 50 },
      { type: RUNTIME_MESSAGES.panelFlowHumannessSet, flowId: "flow-1", humanness: null }
    ]);
  });
});

test("Core's refusal is shown in Core's own words and the slider goes back to what is saved", async () => {
  await withFakeDocument(async () => {
    const b = background({ humanness: 20 }, { ok: false, sentence: "Something went wrong.", detail: OUT_OF_RANGE, code: "failed", coreCode: "flow.humanness_invalid" });
    const view = mount(b.request);
    view.section.show("flow-1");
    await settle();
    view.toggle.dispatch("click");
    await settle();
    const range = one(view.root, "humanness-range");
    range.value = "75";
    range.dispatch("change");
    await settle();
    assert.equal(one(view.root, "humanness-status").textContent, `Not saved. ${OUT_OF_RANGE}`);
    assert.equal(range.value, "20");
    assert.equal(view.toggle.textContent, "Humanness · 20");
  });
});

test("a read this extension cannot carry hides the section; another failed read says why inside it", async () => {
  await withFakeDocument(async () => {
    const old = mount((async () => ({ ok: false, sentence: "This extension doesn't support that yet.", unsupported: true })) as PanelStore["request"]);
    old.section.show("flow-1");
    await settle();
    assert.equal(old.root.hidden, true);
    const refused = mount((async () => ({ ok: false, sentence: "FluxIQ refused this browser's pairing.", detail: "FluxIQ refused this browser's pairing.", code: "refused" })) as PanelStore["request"]);
    refused.section.show("flow-1");
    await settle();
    assert.equal(refused.root.hidden, false);
    assert.equal(one(refused.root, "flow-humanness-problem").textContent, "I could not read this Flow's humanness. FluxIQ refused this browser's pairing.");
  });
});

test("another Flow gets its own control, and none puts the section away", async () => {
  await withFakeDocument(async () => {
    const b = background({ humanness: 40 });
    const view = mount(b.request);
    view.section.show("flow-1");
    await settle();
    view.section.show("flow-1");
    view.section.show("flow-2");
    await settle();
    assert.deepEqual(b.sent.map((message) => message.flowId), ["flow-1", "flow-2"], "the same Flow is not read again");
    assert.equal(view.root.byClass("humanness-range").length, 1);
    view.section.show(undefined);
    assert.equal(view.root.hidden, true);
    assert.equal(view.root.byClass("humanness-range").length, 0);
  });
});
