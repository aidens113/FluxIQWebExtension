// The PIN dialog: focus moves in, Escape cancels, Enter submits, a refusal stays
// open saying why, and the PIN is gone from the field the moment it is sent. No
// real PIN: these are digits made up for the test.

import assert from "node:assert/strict";
import test from "node:test";
import type { ChatReauthorizeOutcome } from "@fluxiq/ui-components";
import { fake, FakeElement, withFakeDocument } from "../../tests/fake-dom";
import { showPinDialog } from "../pin-dialog";

const flush = () => new Promise<void>((resolve) => setTimeout(resolve, 0));

function open(answer: (pin: string) => Promise<ChatReauthorizeOutcome> | ChatReauthorizeOutcome) {
  const host = document.createElement("div");
  const sent: string[] = [];
  let cancelled = 0;
  showPinDialog({
    title: "Enter your PIN",
    description: "Confirming will delete or remove something. It can't be undone.",
    actionLabel: "Confirm",
    submit: async (pin) => {
      sent.push(pin);
      return answer(pin);
    },
    cancel: () => { cancelled += 1; }
  }, host);
  const root = fake(host);
  const field = root.byClass("ask-pin-field")[0]!;
  const form = root.byClass("ask-pin-form")[0]!;
  const buttons = root.byClass("ask-pin-button");
  return {
    root, field, form, cancel: buttons[0]!, confirm: buttons[1]!, sent,
    cancelled: () => cancelled,
    dialog: () => root.byClass("ask-pin")[0],
    refusal: () => root.byClass("ask-pin-refusal")[0]?.textContent,
    typeAndEnter: async (pin: string) => {
      field.value = pin;
      form.dispatch("submit", { preventDefault: () => undefined });
      await flush();
    }
  };
}

/** Which elements were given focus, in order. */
function watchFocus(): { focused: FakeElement[]; stop(): void } {
  const focused: FakeElement[] = [];
  const before = FakeElement.prototype.focus;
  FakeElement.prototype.focus = function focus(this: FakeElement) { focused.push(this); };
  return { focused, stop: () => { FakeElement.prototype.focus = before; } };
}

test("it opens as a dialog with focus on the field, saying what it is for", async () => {
  await withFakeDocument(() => {
    const watch = watchFocus();
    try {
      const view = open(() => ({ ok: true }));
      assert.equal(watch.focused.at(-1), view.field);
      assert.equal(view.dialog()?.tagName, "DIALOG");
      assert.equal(view.field.getAttribute("type"), "password");
      assert.equal(view.field.getAttribute("autocomplete"), "off");
      assert.match(view.root.textContent, /delete or remove something/u);
    } finally {
      watch.stop();
    }
  });
});

test("Enter submits the PIN once, and a success closes the dialog with the PIN gone", async () => {
  await withFakeDocument(async () => {
    const view = open(() => ({ ok: true }));
    await view.typeAndEnter("482910");
    assert.deepEqual(view.sent, ["482910"]);
    assert.equal(view.dialog(), undefined);
    assert.equal(view.field.value, "");
    assert.equal(view.cancelled(), 0);
  });
});

test("a refused PIN keeps the dialog open, says why, empties the field and focuses it for another try", async () => {
  await withFakeDocument(async () => {
    const watch = watchFocus();
    try {
      const view = open((pin) => (pin === "482910" ? { ok: true } : { ok: false, error: "That PIN isn't right." }));
      await view.typeAndEnter("111111");
      assert.ok(view.dialog(), "still open");
      assert.equal(view.refusal(), "That PIN isn't right.");
      assert.equal(view.field.value, "", "the refused PIN is not kept");
      assert.equal(watch.focused.at(-1), view.field);
      assert.equal(view.confirm.textContent, "Confirm");
      assert.equal(view.field.disabled, false);
      await view.typeAndEnter("482910");
      assert.deepEqual(view.sent, ["111111", "482910"]);
      assert.equal(view.dialog(), undefined);
    } finally {
      watch.stop();
    }
  });
});

test("the PIN leaves the field before the answer comes back, and a second Enter sends nothing", async () => {
  await withFakeDocument(async () => {
    let finish: (outcome: ChatReauthorizeOutcome) => void = () => undefined;
    const view = open(() => new Promise<ChatReauthorizeOutcome>((resolve) => { finish = resolve; }));
    view.field.value = "482910";
    view.form.dispatch("submit", { preventDefault: () => undefined });
    assert.equal(view.field.value, "");
    assert.equal(view.confirm.disabled, true);
    assert.equal(view.confirm.textContent, "Checking…");
    view.form.dispatch("submit", { preventDefault: () => undefined });
    // Escape while it is on its way changes nothing: the answer may already have landed.
    view.dialog()!.dispatch("cancel", { preventDefault: () => undefined });
    assert.ok(view.dialog());
    assert.equal(view.sent.length, 1);
    finish({ ok: true });
    await flush();
    assert.equal(view.dialog(), undefined);
  });
});

test("what is not a PIN is said at once and sends nothing", async () => {
  await withFakeDocument(async () => {
    const view = open(() => ({ ok: true }));
    for (const typed of ["", "12", "abcd", "1234567890123"]) {
      await view.typeAndEnter(typed);
      assert.equal(view.refusal(), "A PIN is 4 to 12 digits.");
      assert.equal(view.field.value, "");
    }
    assert.deepEqual(view.sent, []);
    assert.ok(view.dialog());
  });
});

test("Escape and Cancel each cancel once, send nothing and empty the field", async () => {
  await withFakeDocument(() => {
    const byEscape = open(() => ({ ok: true }));
    byEscape.field.value = "482910";
    let prevented = false;
    byEscape.dialog()!.dispatch("cancel", { preventDefault: () => { prevented = true; } });
    assert.equal(prevented, true);
    assert.equal(byEscape.cancelled(), 1);
    assert.equal(byEscape.dialog(), undefined);
    assert.equal(byEscape.field.value, "");
    assert.deepEqual(byEscape.sent, []);

    const byButton = open(() => ({ ok: true }));
    byButton.cancel.dispatch("click");
    assert.equal(byButton.cancelled(), 1);
    assert.equal(byButton.dialog(), undefined);
    assert.deepEqual(byButton.sent, []);
  });
});

test("an answer that throws is a refusal in plain words, never a stuck dialog", async () => {
  await withFakeDocument(async () => {
    const view = open(() => { throw new Error("network detail"); });
    await view.typeAndEnter("482910");
    assert.equal(view.refusal(), "That didn't go through. Try again.");
    assert.equal(view.confirm.disabled, false);
  });
});

test("nothing it does writes the PIN anywhere else", async () => {
  await withFakeDocument(async () => {
    const globals = globalThis as unknown as Record<string, unknown>;
    const before = { console: globalThis.console, localStorage: globals.localStorage, chrome: globals.chrome };
    const leaks: unknown[] = [];
    const record = (...args: unknown[]) => { leaks.push(args); };
    globalThis.console = { ...before.console, log: record, info: record, warn: record, error: record, debug: record };
    globals.localStorage = { setItem: record };
    globals.chrome = { storage: { local: { set: record } } };
    try {
      const view = open(() => ({ ok: false, error: "No." }));
      await view.typeAndEnter("482910");
      assert.doesNotMatch(view.root.textContent, /482910/u);
      for (const element of view.root.descendants()) {
        assert.ok([...element.attributes.values()].every((value) => !value.includes("482910")));
      }
      assert.deepEqual(leaks, []);
    } finally {
      globalThis.console = before.console;
      globals.localStorage = before.localStorage;
      globals.chrome = before.chrome;
    }
  });
});
