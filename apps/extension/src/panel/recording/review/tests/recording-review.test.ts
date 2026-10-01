import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../../chat/tests/fake-dom";
import { statusWith } from "../../../tests/status-fixture";
import { SIMPLE_PANEL_MESSAGES } from "../../../../shared/protocol";
import { createRecordingReview } from "../recording-review";

const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };
const generated = (suffix = "1") => ({ ok: true, value: { ok: true, payload: { result: { proposal: { id: `p${suffix}` }, flow: { id: `f${suffix}`, name: "Synthetic automation", nodes: [{ label: "Synthetic step" }] } } } } });

async function fixture(body: (context: {
  root: FakeElement; doc: { activeElement: FakeElement | null; visibilityState: string; focused: boolean; body: FakeElement };
  button(name: string): FakeElement; offer(): void; recording(): void; render(): void;
  calls: Array<Record<string, unknown>>; finish(value: unknown, index?: number): void; build(): void;
}) => Promise<void>): Promise<void> {
  await withFakeDocument(async () => {
    const doc = document as unknown as { activeElement: FakeElement | null; visibilityState: string; focused: boolean; body: FakeElement; hasFocus(): boolean; createElement(tag: string): FakeElement };
    doc.activeElement = null; doc.focused = true; doc.hasFocus = () => doc.focused;
    class FocusElement extends FakeElement {
      readonly ownerDocument = doc;
      focusCalls = 0;
      get parentElement(): FakeElement | null { return this.parentNode; }
      get isConnected(): boolean { return this === doc.body || doc.body?.descendants().includes(this) === true; }
      contains(node: FakeElement): boolean { return node === this || this.descendants().includes(node); }
      hasAttribute(name: string): boolean { return this.attributes.has(name); }
      focus(): void { this.focusCalls++; doc.activeElement = this; }
      removeChild(node: Parameters<FakeElement["removeChild"]>[0]): void {
        if (doc.activeElement && node instanceof FakeElement && (node === doc.activeElement || node.descendants().includes(doc.activeElement))) doc.activeElement = doc.body;
        super.removeChild(node);
      }
      replaceChildren(...nodes: Parameters<FakeElement["append"]>): void {
        for (const child of [...this.childNodes]) this.removeChild(child);
        this.append(...nodes);
      }
    }
    doc.createElement = (tag) => new FocusElement(tag);
    doc.body = new FocusElement("body"); doc.activeElement = doc.body;
    const target = globalThis as unknown as { setTimeout: typeof setTimeout; clearTimeout: typeof clearTimeout };
    const beforeTimeout = target.setTimeout, beforeClear = target.clearTimeout;
    let timer: (() => void) | undefined;
    target.setTimeout = ((callback: () => void) => { timer = callback; return 1; }) as unknown as typeof setTimeout;
    target.clearTimeout = (() => { timer = undefined; }) as typeof clearTimeout;
    const calls: Array<Record<string, unknown>> = [];
    const replies: Array<(value: unknown) => void> = [];
    const request = (message: Record<string, unknown>) => { calls.push(message); return new Promise((done) => { replies.push(done); }); };
    try {
      const review = createRecordingReview({ store: { request } } as unknown as Parameters<typeof createRecordingReview>[0]);
      const root = fake(review.element); doc.body.append(root);
      const status = (recordingState: "recording" | "idle") => review.render(statusWith({ recordingState, paired: true, connectionState: "connected" }));
      await body({ root, doc, calls, finish: (value, index = replies.length - 1) => replies[index]!(value), build: () => { const callback = timer; timer = undefined; callback?.(); },
        button: (name) => root.descendants().find((node) => node.tagName === "BUTTON" && node.textContent === name)!,
        offer: () => { status("recording"); status("idle"); }, recording: () => status("recording"), render: () => status("idle") });
    } finally { target.setTimeout = beforeTimeout; target.clearTimeout = beforeClear; }
  });
}

test("Done remains the same focused node across analyzing, building and completion", async () => {
  await fixture(async ({ root, button, offer, doc, finish, build }) => {
    offer(); const done = button("Done");
    button("Turn this recording into an automation").dispatch("click");
    assert.ok(button("Done") === done);
    done.focus(); build();
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done);
    finish(generated()); await tick();
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done);
    assert.equal(root.getAttribute("aria-busy"), "false");
  });
});
test("focused disappearing Generate moves only to the visible local Done", async () => {
  await fixture(async ({ button, offer, doc }) => {
    offer(); const generate = button("Turn this recording into an automation"), done = button("Done");
    generate.focus(); generate.dispatch("click");
    assert.ok(doc.activeElement === done); assert.equal(done.disabled, false);
  });
});

test("Done retains identity, focus and one handler through Test and Save", async () => {
  await fixture(async ({ root, button, offer, finish, doc, calls }) => {
    offer(); button("Turn this recording into an automation").dispatch("click");
    finish(generated()); await tick();
    const done = button("Done"); done.focus();
    const testButton = button("Test the generated automation"); testButton.dispatch("click");
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done); assert.equal(root.getAttribute("aria-busy"), "true");
    assert.deepEqual(calls[1], { type: SIMPLE_PANEL_MESSAGES.testGeneratedAutomation, proposalId: "p1", flowId: "f1" });
    testButton.dispatch("click"); assert.equal(calls.length, 2);
    finish({ ok: true, value: { payload: { runSummary: { status: "succeeded" }, interventionCount: 1 } } }); await tick();
    assert.ok(button("Done") === done); assert.equal(root.getAttribute("aria-busy"), "false");
    button("Save").dispatch("click");
    assert.deepEqual(calls[2], { type: SIMPLE_PANEL_MESSAGES.saveGeneratedAutomation, proposalId: "p1", flowId: "f1" });
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done);
    finish({ ok: true, value: {} }); await tick();
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done);
    assert.equal(done.listeners.get("click")?.length, 1); assert.equal(done.disabled, false);
    done.dispatch("click"); assert.equal(root.hidden, true); assert.equal(calls.length, 3);
  });
});

for (const action of ["Test the generated automation", "Save"]) {
  test(`focused disappearing ${action} moves to retained Done`, async () => {
    await fixture(async ({ button, offer, finish, doc, root }) => {
      offer(); button("Turn this recording into an automation").dispatch("click"); finish(generated()); await tick();
      const done = button("Done"), chosen = button(action); chosen.focus(); chosen.dispatch("click");
      assert.ok(doc.activeElement === done); assert.ok(button("Done") === done); assert.equal(done.disabled, false);
      assert.equal(root.getAttribute("aria-busy"), "true");
    });
  });
}

test("a failed generation has current retry copy and Generate handler", async () => {
  await fixture(async ({ button, offer, finish, calls }) => {
    offer(); const old = button("Turn this recording into an automation"); old.dispatch("click");
    finish({ ok: false, sentence: "Synthetic generation refusal" }); await tick();
    const retry = button("Try again"); assert.ok(retry); assert.equal(retry.disabled, false); assert.equal(retry.className, "primary-button");
    old.dispatch("click"); assert.equal(calls.length, 1);
    retry.dispatch("click"); retry.dispatch("click"); assert.equal(calls.length, 2);
    assert.deepEqual(calls[1], { type: SIMPLE_PANEL_MESSAGES.generateFromRecording });
    finish(generated("2")); await tick(); button("Save").dispatch("click");
    assert.deepEqual(calls[2], { type: SIMPLE_PANEL_MESSAGES.saveGeneratedAutomation, proposalId: "p2", flowId: "f2" });
  });
});

test("passive redraw preserves retained focus without a focus call", async () => {
  await fixture(async ({ button, offer, render, build, finish, doc }) => {
    offer(); button("Turn this recording into an automation").dispatch("click");
    const done = button("Done") as FakeElement & { focusCalls: number }; done.focus();
    render(); build(); finish(generated()); await tick(); render();
    assert.ok(doc.activeElement === done); assert.equal(done.focusCalls, 1); assert.ok(button("Done") === done);
  });
});

for (const moved of ["external-field", "inactive-document", "hidden-document"] as const) {
  test(`disappearing action never reclaims ${moved} focus`, async () => {
    await fixture(async ({ button, offer, doc }) => {
      offer(); const generate = button("Turn this recording into an automation"), done = button("Done") as FakeElement & { focusCalls: number };
      generate.focus();
      const field = fake(document.createElement("input")); doc.body.append(field);
      if (moved === "external-field") field.focus();
      if (moved === "inactive-document") doc.focused = false;
      if (moved === "hidden-document") doc.visibilityState = "hidden";
      generate.dispatch("click");
      assert.equal(done.focusCalls, 0);
      if (moved === "external-field") assert.ok(doc.activeElement === field);
    });
  });
}

for (const hidden of ["hidden", "inert", "aria-hidden", "display", "visibility", "detached"] as const) {
  test(`hidden or detached review does not claim focus or activate: ${hidden}`, async () => {
    await fixture(async ({ root, button, offer, doc, calls }) => {
      offer(); const generate = button("Turn this recording into an automation"), done = button("Done") as FakeElement & { focusCalls: number };
      const ancestor = fake(document.createElement("section")); doc.body.append(ancestor); ancestor.append(root);
      generate.focus();
      if (hidden === "hidden") ancestor.hidden = true;
      if (hidden === "inert") ancestor.setAttribute("inert", "");
      if (hidden === "aria-hidden") ancestor.setAttribute("aria-hidden", "true");
      if (hidden === "display") ancestor.style.display = "none";
      if (hidden === "visibility") ancestor.style.visibility = "hidden";
      if (hidden === "detached") root.remove();
      generate.dispatch("click");
      assert.equal(done.focusCalls, 0); assert.equal(calls.length, 0);
    });
  });
}

test("focus acquired by another field during removal remains there", async () => {
  await fixture(async ({ button, offer, doc }) => {
    offer(); const generate = button("Turn this recording into an automation");
    const field = fake(document.createElement("input")); doc.body.append(field);
    const parent = generate.parentNode!, remove = parent.removeChild.bind(parent);
    parent.removeChild = (node) => { remove(node); if (node === generate) field.focus(); };
    generate.focus(); generate.dispatch("click");
    assert.ok(doc.activeElement === field);
  });
});

test("dismiss hides review, clears its timer and ignores old replies/controls", async () => {
  await fixture(async ({ root, button, offer, doc, build, finish, calls }) => {
    offer(); const oldDone = button("Done"); button("Turn this recording into an automation").dispatch("click");
    oldDone.focus(); oldDone.dispatch("click");
    assert.equal(root.hidden, true); assert.ok(doc.activeElement === doc.body);
    build(); finish(generated(), 0); await tick(); assert.equal(root.hidden, true);
    offer(); const done = button("Done"); assert.ok(done !== oldDone);
    oldDone.dispatch("click"); assert.equal(root.hidden, false); assert.equal(calls.length, 1);
    button("Turn this recording into an automation").dispatch("click");
    finish(generated("fresh"), 1); await tick(); button("Save").dispatch("click");
    assert.deepEqual(calls[2], { type: SIMPLE_PANEL_MESSAGES.saveGeneratedAutomation, proposalId: "pfresh", flowId: "ffresh" });
  });
});

test("new recording fences old generation response without taking external focus", async () => {
  await fixture(async ({ root, button, offer, recording, finish, doc }) => {
    offer(); button("Turn this recording into an automation").dispatch("click");
    const field = fake(document.createElement("input")); doc.body.append(field); field.focus();
    recording(); assert.equal(root.hidden, true);
    finish(generated()); await tick();
    assert.equal(root.hidden, true); assert.ok(doc.activeElement === field);
  });
});

test("old reply arriving during a fresh review cannot replace its preview or handlers", async () => {
  await fixture(async ({ root, button, offer, finish, calls, doc }) => {
    offer(); button("Turn this recording into an automation").dispatch("click"); button("Done").dispatch("click");
    offer(); button("Turn this recording into an automation").dispatch("click");
    const done = button("Done"); done.focus();
    finish(generated("obsolete"), 0); await tick();
    assert.equal(root.getAttribute("aria-busy"), "true"); assert.equal(button("Save"), undefined); assert.ok(doc.activeElement === done);
    finish(generated("current"), 1); await tick();
    assert.ok(button("Done") === done); button("Save").dispatch("click");
    assert.deepEqual(calls[2], { type: SIMPLE_PANEL_MESSAGES.saveGeneratedAutomation, proposalId: "pcurrent", flowId: "fcurrent" });
  });
});

test("unsupported completion retains Done focus and shows existing FluxIQ fallback", async () => {
  await fixture(async ({ root, button, offer, finish, doc }) => {
    offer(); button("Turn this recording into an automation").dispatch("click");
    const done = button("Done"); done.focus();
    finish({ ok: false, sentence: "Synthetic unsupported", unsupported: true }); await tick();
    assert.ok(button("Done") === done); assert.ok(doc.activeElement === done);
    assert.equal(root.byClass("open-fluxiq")[0]?.hidden, false);
    assert.equal(root.getAttribute("aria-busy"), "false");
  });
});
