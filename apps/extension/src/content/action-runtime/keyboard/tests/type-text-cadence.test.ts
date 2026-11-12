// Typing at a person's cadence (`../type-text.ts`, W2 H3). Without gaps -- as at
// humanness 0 -- typing is synchronous and returns nothing, exactly as before.
// With them, the same characters go in with an awaited pause before each one
// after the first: the same events, in the same order, to the same final value.
// Number and date controls keep their whole-value path either way.
//
// The page is faked at what the keyboard reads: an input's value accessor,
// selection, type and read-only state, and the events dispatched on it.

import assert from "node:assert/strict";
import { test, type TestContext } from "node:test";
import { typeText } from "../type-text";

class FakeHTMLElement {
  readonly isContentEditable = false;
  focus(): void {}
}

/** A text input recording every event dispatched on it, as its type and key or data. */
class FakeInput extends FakeHTMLElement {
  type = "text";
  readOnly = false;
  disabled = false;
  selectionStart: number | null = null;
  selectionEnd: number | null = null;
  readonly events: string[] = [];
  #value = "";

  get value(): string {
    return this.#value;
  }
  set value(next: string) {
    this.#value = next;
  }
  setSelectionRange(start: number, end: number): void {
    this.selectionStart = start;
    this.selectionEnd = end;
  }
  dispatchEvent(event: Event & { key?: string; data?: string }): boolean {
    this.events.push(`${event.type}${event.key ? `:${event.key}` : ""}${event.data ? `:${event.data}` : ""}`);
    return true;
  }
}

class FakeTextArea extends FakeHTMLElement {}

class FakeKeyboardEvent extends Event {
  readonly key: string;
  constructor(type: string, init: { key: string } & EventInit) {
    super(type, init);
    this.key = init.key;
  }
}

class FakeInputEvent extends Event {
  readonly data: string | undefined;
  constructor(type: string, init: { data?: string } & EventInit = {}) {
    super(type, init);
    this.data = init.data;
  }
}

/** The platform's own timer, taken once, so a page installed twice never wraps a fake. */
const platformSetTimeout = globalThis.setTimeout;

/** The DOM globals the keyboard reads, and a record of the timers it sets. */
function installPage(t: TestContext): { timers: number[] } {
  const scope = globalThis as unknown as Record<string, unknown>;
  const names = ["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "KeyboardEvent", "InputEvent", "document", "setTimeout"] as const;
  const had = Object.fromEntries(names.map((name) => [name, Object.prototype.hasOwnProperty.call(scope, name) ? scope[name] : undefined]));
  const timers: number[] = [];
  Object.assign(scope, {
    HTMLElement: FakeHTMLElement,
    HTMLInputElement: FakeInput,
    HTMLTextAreaElement: FakeTextArea,
    KeyboardEvent: FakeKeyboardEvent,
    InputEvent: FakeInputEvent,
    document: { createElement: () => new FakeInput() },
    setTimeout: (callback: () => void, ms?: number) => {
      timers.push(ms ?? 0);
      return platformSetTimeout(callback, ms);
    }
  });
  t.after(() => {
    for (const name of names) {
      if (had[name] === undefined) delete scope[name];
      else scope[name] = had[name];
    }
  });
  return { timers };
}

function input(type = "text", value = "old"): FakeInput {
  const field = new FakeInput();
  field.type = type;
  field.value = value;
  return field;
}

test("without gaps, typing is synchronous, returns nothing and sets no timer", (t) => {
  const { timers } = installPage(t);
  const field = input();
  const returned = typeText(field as unknown as Element, "hey");
  assert.equal(returned, undefined);
  assert.equal(field.value, "hey");
  assert.deepEqual(field.events, [
    "beforeinput", "input",
    "keydown:h", "beforeinput:h", "input:h", "keyup:h",
    "keydown:e", "beforeinput:e", "input:e", "keyup:e",
    "keydown:y", "beforeinput:y", "input:y", "keyup:y",
    "change"
  ]);
  assert.deepEqual(timers, []);
});

test("with gaps, the same events in the same order reach the same value, with an awaited pause before each later character", async (t) => {
  const { timers } = installPage(t);
  const plain = input();
  typeText(plain as unknown as Element, "hello");
  const paced = input();
  const typing = typeText(paced as unknown as Element, "hello", [4, 0, 6, 3]);
  assert.ok(typing instanceof Promise, "typing with gaps is awaited");
  // Only the clearing and the first character before the first pause.
  assert.deepEqual(paced.events, ["beforeinput", "input", "keydown:h", "beforeinput:h", "input:h", "keyup:h"]);
  await typing;
  assert.equal(paced.value, "hello");
  assert.equal(paced.value, plain.value);
  assert.deepEqual(paced.events, plain.events);
  assert.deepEqual(timers, [4, 6, 3], "a gap of 0 sets no timer");
});

test("a number or date control commits its whole value at once, with or without gaps", (t) => {
  installPage(t);
  for (const type of ["number", "date"]) {
    const value = type === "number" ? "250" : "2026-11-10";
    const plain = input(type, "");
    const paced = input(type, "");
    assert.equal(typeText(plain as unknown as Element, value), undefined);
    assert.equal(typeText(paced as unknown as Element, value, [5, 5, 5]), undefined, "no cadence for a whole-value control");
    assert.equal(paced.value, value);
    assert.deepEqual(paced.events, plain.events);
  }
});
