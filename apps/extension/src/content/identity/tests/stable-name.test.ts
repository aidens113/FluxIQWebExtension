// The rules of reading a name by the part that does not change
// (`stable-name.ts`), one at a time.
//
// The whole resolution -- the store chooser's chip found with another store
// chosen, and the buttons it must not reach -- is in
// `action-runtime/tests/store-chooser-replay.test.ts`. These rows pin what the
// reading itself will and will not say, because each rule is what keeps it from
// being a way round the veto's exact-agreement rule (`corroboration.ts`).
//
// The runner is Node, so a control is a hand-built node with the members the
// name, the fingerprint and the reading ask for, and the globals those modules
// name are installed for each row and put back after it.

import assert from "node:assert/strict";
import test from "node:test";
import { stableNameReading } from "../stable-name";
import { vetoCandidate } from "../veto";
import type { RecordedIdentity } from "../score";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class Text {
  readonly nodeType = TEXT_NODE;
  readonly childNodes: never[] = [];
  parentElement: Control | null = null;
  constructor(readonly nodeValue: string) {}
  get textContent(): string {
    return this.nodeValue;
  }
}

class Control {
  readonly nodeType = ELEMENT_NODE;
  readonly childNodes: Array<Control | Text> = [];
  readonly classList: string[] = [];
  readonly isContentEditable = false;
  readonly id = "";
  parentElement: Control | null = null;
  constructor(readonly localName: string, private readonly attributes: Record<string, string>, children: Array<Control | string>) {
    for (const child of children) {
      const node = typeof child === "string" ? new Text(child) : child;
      node.parentElement = this;
      this.childNodes.push(node);
    }
  }
  get tagName(): string {
    return this.localName.toUpperCase();
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  get firstChild(): Control | Text | null {
    return this.childNodes[0] ?? null;
  }
  get children(): Control[] {
    return this.childNodes.filter((node): node is Control => node instanceof Control);
  }
  get previousElementSibling(): null {
    return null;
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  hasAttribute(name: string): boolean {
    return name in this.attributes;
  }
  closest(): null {
    return null;
  }
  querySelectorAll(): Control[] {
    return this.children.flatMap((child) => [child, ...child.querySelectorAll()]);
  }
  getBoundingClientRect(): { x: number; y: number; width: number; height: number; top: number; bottom: number } {
    return { x: 10, y: 10, width: 120, height: 24, top: 10, bottom: 34 };
  }
}

const globals = globalThis as unknown as Record<string, unknown>;
const installed: Record<string, unknown> = {
  Node: { TEXT_NODE, ELEMENT_NODE },
  HTMLElement: Control,
  HTMLInputElement: class {},
  HTMLSelectElement: class {},
  HTMLTextAreaElement: class {},
  window: { innerHeight: 800 }
};

/**
 * A row with the globals installed for it alone and put back after it. Every
 * test bundle runs in one process, so a hook at the top of the file would
 * install them around every other file's tests too.
 */
function row(name: string, body: () => void): void {
  test(name, (t) => {
    const previous = new Map(Object.keys(installed).map((key) => [key, Object.getOwnPropertyDescriptor(globals, key)] as const));
    for (const [key, value] of Object.entries(installed)) Object.defineProperty(globals, key, { value, configurable: true, writable: true });
    t.after(() => {
      for (const [key, descriptor] of previous) {
        if (descriptor) Object.defineProperty(globals, key, descriptor);
        else delete globals[key];
      }
    });
    body();
  });
}

function button(attributes: Record<string, string>, ...children: Array<Control | string>): Element {
  return new Control("button", attributes, children) as unknown as Element;
}
function span(text: string): Control {
  return new Control("span", {}, [text]);
}

/** A recorded button named `name` by its content, the way a created node carries it. */
function recorded(name: string): RecordedIdentity {
  return { tagName: "button", role: "button", accessibleName: name, selector: "button" };
}

row("the chip, another store chosen: the label is kept and the store's run is the part that changed", () => {
  const chip = button({}, span("Pickup or delivery?"), span("Millbrook Crossing Supercenter"));
  const reading = stableNameReading(recorded("Pickup or delivery?Carden Falls Supercenter"), chip);
  assert.equal(reading?.stable, "Pickup or delivery?");
  assert.equal(reading?.recorded.accessibleName, "Pickup or delivery?");
  assert.equal(reading?.candidate.fingerprint.accessibleName, "Pickup or delivery?");
  // And the reading is decided by the veto's own rules, which accept it.
  assert.equal(reading && vetoCandidate(reading.recorded, reading.candidate).refusedBecause, undefined);
});

row("whitespace between the runs is the name's, and does not move where a run begins", () => {
  const cart = button({}, span("Cart"), " ", span("3 items"));
  assert.equal(stableNameReading(recorded("Cart 1 item"), cart)?.stable, "Cart");
});

row("a changing part at the front keeps what follows it", () => {
  const count = button({}, span("5"), span(" items in your basket"));
  assert.equal(stableNameReading(recorded("2 items in your basket"), count)?.stable, "items in your basket");
});

row("a name in one run has no part to keep: a shorter or longer label is a different action", () => {
  assert.equal(stableNameReading(recorded("Delete"), button({}, "Delete workspace")), undefined);
  assert.equal(stableNameReading(recorded("Save changes"), button({}, "Save")), undefined);
});

row("the recording must have held something else where the run is: a missing part is not a changed one", () => {
  assert.equal(stableNameReading(recorded("Pickup or delivery?"), button({}, span("Pickup or delivery?"), span("Millbrook"))), undefined);
});

row("an unchanged name has no reading; the veto already accepts it", () => {
  assert.equal(stableNameReading(recorded("Pickup or delivery?Millbrook"), button({}, span("Pickup or delivery?"), span("Millbrook"))), undefined);
});

row("what is kept must be words, not a glyph or a number", () => {
  assert.equal(stableNameReading(recorded("×Carden Falls"), button({}, span("×"), span("Millbrook"))), undefined);
  assert.equal(stableNameReading(recorded("No.4"), button({}, span("No."), span("7"))), undefined, "two letters are not words enough");
  // A price that changed beside a word that did not is a reading, and the word is what is kept.
  assert.equal(stableNameReading(recorded("$4.99 each"), button({}, span("$5.49"), span(" each")))?.stable, "each");
});

row("a part that changed within a run, rather than a whole run, is not read", () => {
  assert.equal(stableNameReading(recorded("Pickup at Carden Falls"), button({}, span("Pickup at Millbrook"), span("Change"))), undefined);
});

row("runs that fit the recording in two places read as neither", () => {
  // "OpenNowClose" is "Open" then something other than "Close", and also
  // something other than "Open" then "Close": two different parts to keep, so
  // there is no one stable part to decide on.
  assert.equal(stableNameReading(recorded("OpenNowClose"), button({}, span("Open"), span("Close"))), undefined);
  // One place, however many runs: only the middle run can have changed here.
  assert.equal(stableNameReading(recorded("AlphaBetaAlpha"), button({}, span("Alpha"), span("Gamma"), span("Alpha")))?.stable, "Alpha Alpha");
});

row("an authored name is not built from runs, so no run of it can be the part that changed", () => {
  const labelled = button({ "aria-label": "Choose a store" }, span("Pickup or delivery?"), span("Millbrook"));
  assert.equal(stableNameReading(recorded("Pickup or delivery?Carden Falls"), labelled), undefined);
});
