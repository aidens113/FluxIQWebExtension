// The redaction marker a verb's validation strings use, on its own.
//
// The live proof is e2e/content/tests/redaction.spec.ts, which asserts on a
// real page that no sensitive value reaches a result. These rows pin the two
// properties that proof cannot state directly: that an ordinary field's string
// is byte-for-byte what it always was -- three specs assert those exact strings
// -- and that a withheld one carries a length and no content at any length.
// The rows after the rule below are the verbs that decide `withheld`.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { describeFieldValue } from "../value-redaction";
import type { BrowserActionCommand, BrowserActionResult, BrowserActionValidation } from "../../types";
import type { ContentActionDependencies } from "../types";

test("a value that is not withheld is quoted exactly as before", () => {
  assert.equal(describeFieldValue("Ada", false), '"Ada"');
  assert.equal(describeFieldValue("", false), '""');
  assert.equal(describeFieldValue('say "hi"', false), '"say "hi""');
});

// A one-character value is excluded from the substring check on purpose: every
// single letter of "a withheld value of 1 character" trivially "survives" it.
// The shape assertion below covers that case, and the length row covers the
// wording, so nothing about it is untested.
test("a withheld value is named by its length and never by its content", () => {
  for (const value of ["abcd", "a longer entry with spaces", "éèê", "1234-5678-9012-3456", "swordfish"]) {
    const described = describeFieldValue(value, true);
    assert.equal(described.includes(value), false, `the value survived redaction`);
    assert.match(described, /^a withheld value of \d+ characters?$/u);
    assert.ok(described.includes(String(value.length)), `the length is missing from ${described}`);
  }
});

test("the marker's shape leaks nothing beyond a length, at any length", () => {
  for (const length of [1, 2, 7, 64, 4_096]) {
    assert.match(describeFieldValue("x".repeat(length), true), /^a withheld value of \d+ characters?$/u);
  }
});

test("an empty withheld field says so, because emptiness is not a secret", () => {
  assert.equal(describeFieldValue("", true), "an empty value");
});

test("the length is worded for one character as well as many", () => {
  assert.equal(describeFieldValue("x", true), "a withheld value of 1 character");
  assert.equal(describeFieldValue("xy", true), "a withheld value of 2 characters");
});

// ---------------------------------------------------------------------------
// The value-bearing verbs withhold a control's value inside an element marked
// `data-sensitive` as they do on a marked control itself.
//
// `type`, `clear` and `select` read the field back to prove their own
// post-condition and write what they read into a validation string, which Core
// keeps at rest in the saved command attempt. Each asked only whether the
// target itself was sensitive (`isSensitiveFormControl`), while every capture
// path -- the descriptor, the snapshot, the recorder -- asks whether it is or
// sits inside a sensitive control (`isWithinSensitiveControl`,
// `sensitive-text.ts`, decision D2). A field in bigbox-retail's marked
// "Your security details" group (t730 c2) was withheld by every capture path
// and quoted by the verbs. One rule now: the verbs ask the ancestor-aware one.
//
// The page is faked at what each verb reads, on the pattern of
// `type-unsent-form.test.ts` and `select-option-label.test.ts`. Every value is
// synthetic and asserted absent, never quoted.

class FakeInputElement {}
class FakeTextAreaElement {}
class FakeSelectElement {}
class FakeHTMLElement {}

const TYPED = "SYNTHETIC_RECOVERY_PHRASE";
const HELD = "SYNTHETIC_HELD_VALUE";
const ANSWER = "SYNTHETIC_ANSWER_VALUE";

async function installPlatform(t: TestContext) {
  const scope = globalThis as unknown as Record<string, unknown>;
  const names = ["HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement", "HTMLElement", "window"] as const;
  const before = Object.fromEntries(names.map((name) => [name, scope[name]]));
  const view: Record<string, unknown> = { innerWidth: 1280, innerHeight: 800, addEventListener: () => undefined };
  view.top = view;
  Object.assign(scope, { HTMLInputElement: FakeInputElement, HTMLTextAreaElement: FakeTextAreaElement, HTMLSelectElement: FakeSelectElement, HTMLElement: FakeHTMLElement, window: view });
  t.after(() => Object.assign(scope, before));
  const [{ typeAction }, { clearAction }, { selectAction }] = await Promise.all([import("../type"), import("../clear"), import("../select")]);
  return { typeAction, clearAction, selectAction };
}

/** An element marked `data-sensitive`, the group the control sits in. */
function markedGroup(): Element {
  return { getAttribute: (name: string) => (name === "data-sensitive" ? "true" : null), parentElement: null } as unknown as Element;
}

/** An unmarked text field holding `value`, inside `parent`. */
function field(parent: Element | null, value: string): Element {
  return Object.assign(Object.create(FakeInputElement.prototype as object) as object, {
    tagName: "INPUT", type: "text", isConnected: true, value, form: null, parentElement: parent,
    getAttribute: () => null, focus: () => undefined
  }) as unknown as Element;
}

/** An unmarked select inside `parent`, offering one option that is not the one asked for; not connected, so nothing is waited for. */
function select(parent: Element | null): Element {
  const options = [{ value: "a1", index: 0, label: "", textContent: "SYNTHETIC_OFFERED_LABEL", disabled: false, matches: () => false }];
  return Object.assign(Object.create(FakeSelectElement.prototype as object) as object, {
    tagName: "SELECT", options, value: "a1", selectedIndex: 0, isConnected: false, parentElement: parent,
    getAttribute: () => null
  }) as unknown as Element;
}

/** Runs one verb against `element` and returns the validation it handed the result builder. */
async function validationOf(verb: (action: BrowserActionCommand, deps: ContentActionDependencies, startedAt: number) => BrowserActionResult | Promise<BrowserActionResult>, element: Element, action: Partial<BrowserActionCommand>): Promise<BrowserActionValidation> {
  let said: BrowserActionValidation | undefined;
  const deps = {
    resolveTarget: () => ({ element, resolution: {} }),
    checkActionability: () => ({ actionable: true, point: { x: 4, y: 4 }, detail: "the point 4,4 landed on the target" }),
    describeElement: () => ({}),
    captureSnapshot: () => ({}),
    keyboard: { typeText: (target: { value: string }, text: string) => { target.value = text; } },
    setElementValue: () => undefined,
    dispatchInputEvents: () => undefined,
    success: (command: BrowserActionCommand, startedAt: number, _message: string, validation: BrowserActionValidation): BrowserActionResult => {
      said = validation;
      return { commandId: command.commandId, actionType: command.actionType, status: "succeeded", validation, startedAt, finishedAt: startedAt };
    }
  } as unknown as ContentActionDependencies;
  await verb({ commandId: "c", actionType: "web.dom.type", ...action } as BrowserActionCommand, deps, 0);
  assert.ok(said, "the verb handed no validation to a result builder");
  return said;
}

function assertWithholds(validation: BrowserActionValidation, secret: string): void {
  assert.equal((validation as { redacted?: boolean }).redacted, true);
  assert.equal(JSON.stringify(validation).includes(secret), false, "the validation quotes the withheld value");
}

test("type: a field inside a marked group is read back by length, never quoted", async (t) => {
  const { typeAction } = await installPlatform(t);
  assertWithholds(await validationOf(typeAction, field(markedGroup(), ""), { text: TYPED }), TYPED);
  // The same field outside the group is quoted as before.
  assert.match(JSON.stringify(await validationOf(typeAction, field(null, ""), { text: "Ada" })), /Ada/u);
});

test("clear: a field inside a marked group that did not empty is described by length, never quoted", async (t) => {
  const { clearAction } = await installPlatform(t);
  assertWithholds(await validationOf(clearAction, field(markedGroup(), HELD), { actionType: "web.dom.clear" }), HELD);
});

test("select: a select inside a marked group names neither the request, its options nor its value", async (t) => {
  const { selectAction } = await installPlatform(t);
  const validation = await validationOf(selectAction, select(markedGroup()), { actionType: "web.dom.select", option: { by: "value", value: ANSWER } });
  assertWithholds(validation, ANSWER);
  assert.equal(JSON.stringify(validation).includes("SYNTHETIC_OFFERED_LABEL"), false);
});
