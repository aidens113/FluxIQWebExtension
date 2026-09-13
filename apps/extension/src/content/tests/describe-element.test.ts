// `readElementValue` withholds a file input's value, which is the chosen file's
// local name: every capture path -- the element descriptor, the snapshot, the
// recorder's `dom.input` and the `dom.change` listener -- reads values through
// it, so this one rule keeps the name on the page (P5's optional hardening,
// decided with open question 2).
//
// The runner is Node, so the element classes are stubs installed before the
// module loads and removed afterwards, because every test bundle runs in one
// process. What only a real page proves -- that Chromium's `C:\fakepath\` value
// never reaches a recorded change -- is the content harness's.

import assert from "node:assert/strict";
import test from "node:test";

type Describe = typeof import("../describe-element");

const STUB_GLOBALS = ["HTMLElement", "HTMLInputElement", "HTMLTextAreaElement", "HTMLSelectElement"] as const;

class StubElement {
  readonly attributes = new Map<string, string>();
  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }
}
class StubHTMLElement extends StubElement {
  isContentEditable = false;
}
class StubInput extends StubHTMLElement {
  constructor(public type: string, public value: string) {
    super();
  }
}
class StubTextArea extends StubHTMLElement {}
class StubSelect extends StubHTMLElement {}

/** Runs `body` with the stub element classes installed, and puts every global back. */
async function withStubPage(body: (loaded: Describe) => void): Promise<void> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = new Map(STUB_GLOBALS.map((name) => [name, Object.getOwnPropertyDescriptor(globals, name)]));
  Object.assign(globals, {
    HTMLElement: StubHTMLElement,
    HTMLInputElement: StubInput,
    HTMLTextAreaElement: StubTextArea,
    HTMLSelectElement: StubSelect
  });
  try {
    body(await import("../describe-element"));
  } finally {
    for (const [name, descriptor] of previous) {
      if (descriptor) Object.defineProperty(globals, name, descriptor);
      else delete globals[name];
    }
  }
}

const asElement = (stub: StubElement): Element => stub as unknown as Element;

test("a file input yields no value, so the chosen file's local name never leaves the page", async () => {
  await withStubPage(({ readElementValue }) => {
    assert.equal(readElementValue(asElement(new StubInput("file", "C:\\fakepath\\expense-receipts.csv"))), undefined);
    // The property is lowercase in a browser; the rule does not depend on it.
    assert.equal(readElementValue(asElement(new StubInput("FILE", "C:\\fakepath\\expense-receipts.csv"))), undefined);
  });
});

test("the withholding is targeted: a text input's value is still read", async () => {
  await withStubPage(({ readElementValue }) => {
    assert.equal(readElementValue(asElement(new StubInput("text", "Ada"))), "Ada");
  });
});
