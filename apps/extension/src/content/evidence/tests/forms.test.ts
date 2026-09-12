// The joint between the forms producer and the domain's sensitivity decision,
// in one process: the real `formEvidence()` over a control, and the real
// `createWebAutomationStateFromSnapshot()` over what it produced.
//
// This test exists because each half of the fix it covers is provably inert on
// its own, and two earlier workers measured that rather than argued it. Carrying
// `autocomplete` from the producer changes no output until the projection asks
// the rule with it; asking the rule with it changes no output until the producer
// sends it. A test that hand-writes the wire payload proves the second half and
// silently passes with the first half reverted, which is precisely the failure
// mode this plan keeps hitting -- so the payload here is produced, not written.
//
// What is under test is the *independence* of the two checks. A payment field is
// a plain `text` input marked `billing cc-number`: its `controlType` says
// nothing, so before this the only thing standing between it and a persisted,
// replayed artefact was the producer's own `sensitive` flag -- one check, one
// point of failure, and that exact token list has slipped past a copy of the
// rule twice in this plan. Each row below removes the producer's verdict from
// the wire, modelling a producer that is stale, regressed, or simply older than
// the domain reading it, and requires the value to be withheld anyway.
//
// The DOM is a stub because this runner is Node; the producer on real pages is
// covered by `e2e/content/tests/evidence.spec.ts`. No captured value appears
// here: the control's contents are a synthetic string named for what it stands
// for, and every row asserts its absence rather than quoting it.

import assert from "node:assert/strict";
import test from "node:test";
import { createWebAutomationStateFromSnapshot } from "@fluxiq-web-extension/domain/client";
import { formEvidence } from "../forms";
import type { FormControlEvidence } from "../types";

/** The ordinary way a page marks a card number, and the form that has leaked one twice. */
const CARD_AUTOCOMPLETE = "billing cc-number";
/** What the control holds. Never a real secret, and asserted absent rather than quoted. */
const CONTROL_CONTENTS = "synthetic-value-the-producer-should-have-withheld";

// ---------------------------------------------------------------------------
// A DOM small enough to read, big enough for the producer to walk.

type MutableGlobal = Record<string, unknown>;

class StubElement {
  readonly parentElement: Element | null = null;
  readonly children: readonly Element[] = [];
  readonly textContent = "";
  readonly isContentEditable = false;
  readonly labels: undefined;
  protected readonly attributeMap: Map<string, string>;

  constructor(readonly tagName: string, readonly id: string, attributes: Record<string, string>) {
    this.attributeMap = new Map(Object.entries(attributes));
  }

  getAttribute(name: string): string | null {
    return this.attributeMap.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributeMap.has(name);
  }

  closest(): Element | null {
    return null;
  }

  matches(): boolean {
    return false;
  }
}

class StubInput extends StubElement {
  constructor(id: string, attributes: Record<string, string>, readonly value: string) {
    super("INPUT", id, attributes);
  }

  /** What `HTMLInputElement.type` reflects, which is where the rule's other half looks. */
  get type(): string {
    return this.attributeMap.get("type") ?? "text";
  }
}

class StubForm extends StubElement {
  constructor(id: string, attributes: Record<string, string>, readonly elements: readonly Element[]) {
    super("FORM", id, attributes);
  }
}

const BROWSER_GLOBALS = ["document", "CSS", "HTMLElement", "HTMLInputElement", "HTMLButtonElement", "HTMLSelectElement", "HTMLTextAreaElement"] as const;

/**
 * Runs `read` with a one-form document in place and puts the globals back.
 *
 * Every test file in this package is imported into one Node process, so a
 * global left behind here would reach another file's tests. Install and restore
 * are synchronous around a synchronous call, so nothing can interleave between
 * them.
 */
function withStubbedPage<T>(controls: Element[], read: () => T): T {
  const globals = globalThis as unknown as MutableGlobal;
  const saved = new Map(BROWSER_GLOBALS.map((name) => [name, globals[name]]));
  globals.HTMLElement = StubElement;
  globals.HTMLInputElement = StubInput;
  globals.HTMLButtonElement = class StubButton {};
  globals.HTMLSelectElement = class StubSelect {};
  globals.HTMLTextAreaElement = class StubTextArea {};
  globals.CSS = { escape: (value: string) => value };
  globals.document = {
    forms: [new StubForm("pay", { "aria-label": "Payment" }, controls)],
    documentElement: null,
    getElementById: () => null,
    querySelectorAll: () => []
  };
  try {
    return read();
  } finally {
    for (const [name, value] of saved) globals[name] = value;
  }
}

/** A filled-in text input carrying whatever markup the row is about. */
function textInput(attributes: Record<string, string>): Element {
  return new StubInput("field", { "aria-label": "Card number", name: "field", ...attributes }, CONTROL_CONTENTS) as unknown as Element;
}

/** The real producer's description of one control. */
function producedControl(element: Element): FormControlEvidence {
  const forms = withStubbedPage([element], () => formEvidence()) ?? [];
  const described = forms[0]?.controls[0];
  assert.ok(described, "the producer described no control");
  return described;
}

/** The wire as it looks when the producer's verdict does not arrive. */
function withoutProducerVerdict(described: FormControlEvidence): FormControlEvidence {
  const stripped: FormControlEvidence = { ...described };
  delete stripped.sensitive;
  return stripped;
}

type ProjectedControl = Record<string, unknown>;

/** The real domain projection's version of that control, and the state it sits in. */
function project(control: FormControlEvidence): { control: ProjectedControl; serialized: string } {
  const state = createWebAutomationStateFromSnapshot({
    url: "https://shop.test/checkout",
    title: "Checkout",
    viewport: { width: 1280, height: 720, scrollX: 0, scrollY: 0 },
    interactiveElements: [],
    evidence: { forms: [{ selector: "form#pay", label: "Payment", controlCount: 1, controls: [control] }] }
  } as unknown as Parameters<typeof createWebAutomationStateFromSnapshot>[0], { timestamp: 40, sourceId: "tab:9" });
  const collection = (state.namespaces.web?.values ?? {})["evidence.forms"]?.value as unknown as { items: Array<{ controls: ProjectedControl[] }> } | undefined;
  const projected = collection?.items[0]?.controls[0];
  assert.ok(projected, "the projection wrote no control");
  return { control: projected, serialized: JSON.stringify(state) };
}

// ---------------------------------------------------------------------------

test("the producer puts the token list on the wire whole, beside its own verdict", () => {
  const described = producedControl(textInput({ autocomplete: CARD_AUTOCOMPLETE }));
  assert.equal(described.autocomplete, CARD_AUTOCOMPLETE);
  assert.equal(described.sensitive, true, "the producer's own check must not have been traded away for the new one");
  // The control type is the reason the second check needs the attribute: a card
  // field is an ordinary text input, and nothing else about it says otherwise.
  assert.equal(described.controlType, "text");
  assert.equal(described.hasValue, true);
});

test("a card field whose producer verdict never arrives is still withheld, because the domain reads the tokens itself", () => {
  const described = producedControl(textInput({ autocomplete: CARD_AUTOCOMPLETE }));
  const projected = project(withoutProducerVerdict(described));
  assert.equal(projected.control.sensitive, true);
  assert.equal(projected.control.hasValue, undefined, "a sensitive control must not report whether it holds a value");
  assert.equal(projected.serialized.includes(CONTROL_CONTENTS), false);
});

// A character bound on the attribute would be a bound on a security predicate,
// and slicing `billing cc-number` to `billing cc-nu` matches nothing. The
// producer bounds by whole tokens and the projection reads what arrives raw, so
// the deciding token survives however far into the attribute the page put it.
test("the deciding token survives a page that buries it past every text bound", () => {
  const padding = Array.from({ length: 4 }, (_, index) => `section-${String(index).repeat(50)}`).join(" ");
  const buried = `${padding} ${CARD_AUTOCOMPLETE}`;
  assert.ok(buried.length > 250, "the row is pointless unless the token sits past the 200-character text bound");
  const described = producedControl(textInput({ autocomplete: buried }));
  assert.equal(described.autocomplete, buried, "no token may be cut, and none may be dropped");
  assert.equal(project(withoutProducerVerdict(described)).control.sensitive, true);
});

test("an ordinary field loses nothing: the second check protects secrets, not every control", () => {
  const described = producedControl(textInput({ autocomplete: "billing street-address" }));
  assert.equal(described.sensitive, undefined);
  const projected = project(described);
  assert.equal(projected.control.sensitive, undefined);
  assert.equal(projected.control.hasValue, true);
});

// The producer's flag is kept rather than replaced: the two checks read
// different things and fail in different ways, so both must fail before a value
// escapes. This row is the flag's half, with nothing on the wire for the
// domain's own reading to work from.
test("a control the domain's reading cannot recognise is still protected by the producer's flag", () => {
  const described = producedControl(textInput({ "data-sensitive": "true", autocomplete: "off" }));
  assert.equal(described.sensitive, true);
  const projected = project(described);
  assert.equal(projected.control.sensitive, true);
  assert.equal(projected.control.hasValue, undefined);
});

test("what the control holds never leaves the page, on either side of the wire", () => {
  const described = producedControl(textInput({ autocomplete: CARD_AUTOCOMPLETE }));
  assert.equal(JSON.stringify(described).includes(CONTROL_CONTENTS), false);
  assert.equal(project(described).serialized.includes(CONTROL_CONTENTS), false);
});
