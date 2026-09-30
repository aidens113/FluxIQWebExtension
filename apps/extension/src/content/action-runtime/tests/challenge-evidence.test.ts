// T1 coverage of challenge-evidence.ts's page reading: which pages are a robot
// check a person has to answer, and which are ordinary pages that mention one.
//
// The runner is Node, so the page is a hand-built tree with only the members
// the reader touches: `matches`, `querySelectorAll` for `*` and the heading
// list, `getClientRects`, `textContent`, `innerText` and `shadowRoot`. No
// vendor widget is modelled, so every selector list other than the headings
// matches nothing; what these rows prove is the reading of words. What a real
// page's layout does to `innerText` is the content harness's to prove.

import assert from "node:assert/strict";
import { test } from "node:test";
import { challengeIn } from "../challenge-evidence";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "LEGEND"]);
const BLOCK_TAGS = new Set(["BODY", "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "LEGEND"]);

class FakeElement {
  readonly shadowRoot = null;
  readonly tagName: string;
  constructor(tagName: string, readonly children: readonly (FakeElement | string)[]) {
    this.tagName = tagName.toUpperCase();
  }
  matches(): boolean {
    return false;
  }
  getClientRects(): unknown[] {
    return [{}];
  }
  querySelectorAll(selector: string): FakeElement[] {
    const all = this.descendants();
    if (selector === "*") return all;
    if (selector.startsWith("h1, h2")) return all.filter((element) => HEADING_TAGS.has(element.tagName));
    return [];
  }
  get textContent(): string {
    return this.children.map((child) => typeof child === "string" ? child : child.textContent).join("");
  }
  /** Blocks on their own lines, as a painted page's `innerText` gives them. */
  get innerText(): string {
    const text = this.children.map((child) => typeof child === "string" ? child : child.innerText).join("");
    return BLOCK_TAGS.has(this.tagName) ? `\n${text}\n` : text;
  }
  private descendants(): FakeElement[] {
    return this.children.flatMap((child) => typeof child === "string" ? [] : [child, ...child.descendants()]);
  }
}

function el(tagName: string, ...children: (FakeElement | string)[]): FakeElement {
  return new FakeElement(tagName, children);
}

/** Reads `body` with `HTMLElement` bound to the fake, and puts the global back. */
function pageChallenge(body: FakeElement): ReturnType<typeof challengeIn> {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "HTMLElement");
  globals.HTMLElement = FakeElement;
  try {
    return challengeIn(body as unknown as Element, "page");
  } finally {
    if (previous) Object.defineProperty(globals, "HTMLElement", previous);
    else delete globals.HTMLElement;
  }
}

/**
 * The crossborder marketplace's traffic screen, as `markup/verify.ts` serves it
 * in place of a results page: no heading, no label, the words in paragraphs
 * and the check in a bare `<span>`. Live runs 15 and 17 navigated onto it and
 * were told the navigation succeeded.
 */
const TRAFFIC_SCREEN = el("body",
  el("div",
    el("div", "farbazaar"),
    el("p", el("b", "Sorry, we have detected unusual traffic from your network.")),
    el("p", "To continue shopping, please confirm you are not a robot."),
    el("div", el("i"), el("span", "I'm not a robot")),
    el("p", "Reference: MFSMBJ40-FB")));

test("a bare interstitial that asks whether the reader is a robot is a robot check, though it has no heading", () => {
  assert.equal(pageChallenge(TRAFFIC_SCREEN), "captcha");
});

test("a robot check stated in a heading is still one, however long the page", () => {
  const page = el("body", el("h1", "Please verify you are human"), el("p", "x".repeat(5_000)));
  assert.equal(pageChallenge(page), "captcha");
});

test("an ordinary page that mentions a robot check in its prose is not one", () => {
  // A help article: the words are there, but in a page of prose, not an
  // interstitial. A page is read in full only when it is small enough to be
  // nothing else.
  const article = el("body",
    el("h1", "Why am I asked to prove I'm human?"),
    el("p", "Some sites show a box that says I'm not a robot before you can continue. "),
    el("p", "Pressing it runs a check in the background. ".repeat(40)));
  assert.equal(pageChallenge(article), undefined);
});

test("a small ordinary page is not a robot check", () => {
  const page = el("body", el("h1", "Your basket"), el("p", "Your basket is empty."), el("div", "Continue shopping"));
  assert.equal(pageChallenge(page), undefined);
});
