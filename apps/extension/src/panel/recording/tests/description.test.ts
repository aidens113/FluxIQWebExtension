import assert from "node:assert/strict";
import test from "node:test";
import { FakeElement, withFakeDocument } from "../../chat/tests/fake-dom";
import { requestRecordingDescription } from "../description";

test("description collection keeps blank drafts editable and cancellation starts nothing", async () => {
  await withFakeDocument(async () => {
    const doc = document as unknown as { body: FakeElement; createElement(tag: string): FakeElement };
    class DialogElement extends FakeElement {
      showModal(): void { this.open = true; }
      close(): void { this.open = false; }
    }
    doc.body = new FakeElement("body");
    doc.createElement = (tag) => new DialogElement(tag);
    const pending = requestRecordingDescription(new FakeElement("section") as unknown as HTMLElement);
    const form = doc.body.descendants().find((node) => node.tagName === "FORM")!;
    const input = doc.body.descendants().find((node) => node.tagName === "TEXTAREA")!;
    form.dispatch("submit", { preventDefault() {} });
    assert.match(form.textContent, /Describe this recording/);
    input.value = "  Demonstration of opening a reference document.  ";
    form.dispatch("submit", { preventDefault() {} });
    assert.equal(await pending, "Demonstration of opening a reference document.");
    assert.equal(doc.body.children.length, 0);
    const cancelled = requestRecordingDescription(new FakeElement("section") as unknown as HTMLElement);
    doc.body.descendants().find((node) => node.textContent === "Cancel")!.dispatch("click");
    assert.equal(await cancelled, undefined);
  });
});
