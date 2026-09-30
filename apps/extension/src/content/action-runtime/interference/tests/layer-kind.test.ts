// What a dialog or covering layer is, as the interference classifiers already
// recognise it (`../layer-kind.ts`): a robot check, a consent prompt, a
// rate-limit notice, or nothing this extension has a classifier for.
//
// The runner is Node, so each layer is a hand-built tree with only the members
// the three readers touch: `childNodes` and `nodeType` for the layer's own
// words (`../layer-text.ts`), and `matches`, `querySelectorAll`,
// `getClientRects`, `innerText` and `shadowRoot` for the robot-check reading
// (`../../challenge-evidence.ts`). No vendor widget is modelled, so
// what these rows prove is the reading of words. The words are the Scenario
// Lab fixtures' own, where a fixture has the layer.

import assert from "node:assert/strict";
import test from "node:test";
import { layerKind } from "../layer-kind";

const TEXT_NODE = 3;
const ELEMENT_NODE = 1;

class FakeText {
  readonly nodeType = TEXT_NODE;
  constructor(readonly textContent: string) {}
}

class FakeElement {
  readonly nodeType = ELEMENT_NODE;
  readonly shadowRoot = null;
  readonly tagName: string;
  constructor(tagName: string, readonly children: readonly (FakeElement | string)[], private readonly attributes: Readonly<Record<string, string>> = {}) {
    this.tagName = tagName.toUpperCase();
  }
  get childNodes(): Array<FakeElement | FakeText> {
    return this.children.map((child) => typeof child === "string" ? new FakeText(child) : child);
  }
  getAttribute(name: string): string | null {
    return this.attributes[name] ?? null;
  }
  matches(): boolean {
    return false;
  }
  getClientRects(): unknown[] {
    return [{}];
  }
  /** `*` for the shadow-root walk; every other selector the robot-check reader asks matches nothing modelled here. */
  querySelectorAll(selector: string): FakeElement[] {
    return selector === "*" ? this.descendants() : [];
  }
  get textContent(): string {
    return this.children.map((child) => typeof child === "string" ? child : child.textContent).join("");
  }
  get innerText(): string {
    return this.children.map((child) => typeof child === "string" ? child : ` ${child.innerText} `).join("");
  }
  private descendants(): FakeElement[] {
    return this.children.flatMap((child) => typeof child === "string" ? [] : [child, ...child.descendants()]);
  }
}

function el(tagName: string, ...children: (FakeElement | string)[]): FakeElement {
  return new FakeElement(tagName, children);
}

/** Asks with `HTMLElement` bound to the fake, as the robot-check reader's `innerText` test needs, and puts the global back. */
function kindOf(layer: FakeElement): ReturnType<typeof layerKind> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "HTMLElement");
  globals.HTMLElement = FakeElement;
  try {
    return layerKind(layer as unknown as Element);
  } finally {
    if (previous) Object.defineProperty(globals, "HTMLElement", previous);
    else delete globals.HTMLElement;
  }
}

test("the everything store's cookie banner is a consent layer", () => {
  const banner = new FakeElement("div", [
    el("p", el("strong", "Cookies and advertising choices."), " We use cookies and similar tools to provide our services, understand how customers use them, and show you relevant ads."),
    el("div", el("button", "Accept"), el("button", "Decline"), el("button", "Customize cookies"))
  ], { role: "region", "aria-label": "Cookie preferences" });
  assert.equal(kindOf(banner), "consent");
});

test("social-network-feed's too-fast notice is a rate-limit layer, its wait in a span of its own", () => {
  const notice = el("div",
    el("h2", "You're going too fast"),
    el("p", "You can try again in ", el("span", "12"), " seconds."),
    el("button", "OK"));
  assert.equal(kindOf(notice), "rate_limit");
});

test("a robot check is one, whether it clears by itself or only a person can answer it", () => {
  const selfClearing = el("div", el("h1", "Checking your browser before you continue"), el("p", "This takes a few seconds."));
  const personOnly = el("div", el("h2", "Confirm you are human"), el("p", "Press and hold the button."));
  assert.equal(kindOf(selfClearing), "robot_check");
  assert.equal(kindOf(personOnly), "robot_check");
});

test("a robot check that links a privacy notice is a robot check, not a consent prompt", () => {
  const check = el("div",
    el("p", "Please confirm you are not a robot."),
    el("a", "Privacy policy"));
  assert.equal(kindOf(check), "robot_check");
});

test("a layer no classifier recognises has no kind: a promotion, a newsletter sign-up", () => {
  const promotion = el("div", el("h2", "Spin to win!"), el("p", "Try your luck for up to 30% off today."), el("button", "No thanks, I would rather pay full price"));
  const signup = el("div", el("h2", "Get deals in your inbox"), el("button", "Subscribe"));
  assert.equal(kindOf(promotion), undefined);
  assert.equal(kindOf(signup), undefined);
});
