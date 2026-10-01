import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, fake, withFakeDocument } from "../../chat/tests/fake-dom";
import { createForgetConfirmation } from "../forget-confirmation";

const tick = async () => { for (let i = 0; i < 8; i++) await Promise.resolve(); };

async function fixture(body: (context: {
  root: FakeElement; open: FakeElement; cancel: FakeElement; forget: FakeElement; confirm: FakeElement;
  doc: { activeElement: FakeElement | null; visibilityState: string; focused: boolean };
  calls: () => number; finish: (success: boolean) => void; reject: () => void;
}) => Promise<void>): Promise<void> {
  await withFakeDocument(async () => {
    const doc = document as unknown as { activeElement: FakeElement | null; visibilityState: string; focused: boolean; hasFocus(): boolean; createElement(tag: string): FakeElement };
    doc.activeElement = null; doc.focused = true; doc.hasFocus = () => doc.focused;
    class FocusElement extends FakeElement {
      // A getter, as `FakeElement`'s own is (`cfecc984`): a property may not override it.
      get ownerDocument(): typeof doc { return doc; }
      get parentElement(): FakeElement | null { return this.parentNode; }
      contains(node: FakeElement): boolean { return node === this || this.descendants().includes(node); }
      hasAttribute(name: string): boolean { return this.attributes.has(name); }
      focus(): void { doc.activeElement = this; }
    }
    doc.createElement = (tag) => new FocusElement(tag);
    let count = 0;
    let finish!: (success: boolean) => void;
    let reject!: (error: Error) => void;
    const root = fake(createForgetConfirmation((() => {
      count++;
      return new Promise<boolean>((resolve, refuse) => { finish = resolve; reject = refuse; });
    }) as Parameters<typeof createForgetConfirmation>[0]).element);
    const open = root.descendants().find((node) => node.id === "forgetPairingButton")!;
    const cancel = root.descendants().find((node) => node.textContent === "Cancel" && node.tagName === "BUTTON")!;
    const forget = root.descendants().find((node) => node.textContent === "Forget" && node.tagName === "BUTTON")!;
    const confirm = root.descendants().find((node) => node.id === "forgetPairingConfirm")!;
    await body({ root, open, cancel, forget, confirm, doc, calls: () => count, finish: (success) => finish(success), reject: () => reject(new Error("private synthetic exception")) });
  });
}

test("Forget opens on Cancel and explicit Cancel restores the opener without requesting", async () => {
  await fixture(async ({ open, cancel, confirm, doc, calls }) => {
    open.focus(); open.dispatch("click");
    assert.equal(doc.activeElement, cancel);
    assert.equal(confirm.hidden, false);
    cancel.dispatch("click");
    assert.equal(confirm.hidden, true);
    assert.equal(doc.activeElement, open);
    assert.equal(calls(), 0);
  });
});

for (const outcome of ["refused", "rejected"] as const) {
  test(`Forget ${outcome} retains confirmation and supports retry without duplicate requests`, async () => {
    await fixture(async ({ root, open, cancel, forget, confirm, doc, calls, finish, reject }) => {
      open.focus(); open.dispatch("click");
      forget.focus(); forget.dispatch("click"); forget.dispatch("click");
      assert.equal(calls(), 1);
      assert.equal(cancel.disabled, true);
      if (outcome === "refused") finish(false); else reject();
      await tick();
      assert.equal(confirm.hidden, false);
      assert.equal(forget.disabled, false);
      assert.equal(doc.activeElement, forget);
      assert.equal(root.textContent.includes("private synthetic"), false);
      forget.dispatch("click");
      assert.equal(calls(), 2);
      finish(true); await tick();
      assert.equal(confirm.hidden, true);
      assert.equal(doc.activeElement, open);
    });
  });
}

for (const moved of ["field", "page", "hidden-document", "hidden-ancestor", "inert-ancestor"] as const) {
  test(`Forget success preserves focus when ownership changes: ${moved}`, async () => {
    await fixture(async ({ root, open, forget, confirm, doc, finish }) => {
      open.focus(); open.dispatch("click"); forget.focus(); forget.dispatch("click");
      const field = fake(document.createElement("input"));
      if (moved === "field") field.focus();
      if (moved === "page") doc.focused = false;
      if (moved === "hidden-document") doc.visibilityState = "hidden";
      if (moved === "hidden-ancestor") root.hidden = true;
      if (moved === "inert-ancestor") root.setAttribute("inert", "");
      const before = doc.activeElement;
      finish(true); await tick();
      assert.equal(confirm.hidden, true);
      assert.equal(doc.activeElement, before);
    });
  });
}

test("unfocused synthetic Forget activation never claims focus on completion", async () => {
  await fixture(async ({ open, forget, doc, finish }) => {
    open.focus(); open.dispatch("click");
    const field = fake(document.createElement("input")); field.focus();
    forget.dispatch("click"); finish(true); await tick();
    assert.equal(doc.activeElement, field);
  });
});
