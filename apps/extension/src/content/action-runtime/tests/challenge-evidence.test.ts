// T1 coverage of challenge-evidence.ts's page reading: which pages are a robot
// check a person has to answer, which are a check that clears by itself, and
// which are ordinary pages that mention one.
//
// The runner is Node, so the page is a hand-built tree with only the members
// the reader touches: `matches`, `querySelectorAll` for `*`, the heading list,
// the check regions and the disabled controls, `getClientRects`,
// `textContent`, `innerText` and `shadowRoot`. No vendor widget is modelled, so
// every other selector list matches nothing; what these rows prove is the
// reading of words and of where they stand. What a real page's layout does to
// `innerText` is the content harness's to prove.
//
// The check pages below are written from the Scenario Lab fixtures' own markup
// (`apps/scenario-lab/src/scenarios/*`), word for word where the words decide
// the reading; the reader itself knows no fixture.

import assert from "node:assert/strict";
import { test } from "node:test";
import { challengeIn, robotCheckIn } from "../challenge-evidence";

const HEADING_TAGS = new Set(["H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "LEGEND"]);
const BLOCK_TAGS = new Set(["BODY", "DIV", "P", "H1", "H2", "H3", "H4", "H5", "H6", "LABEL", "LEGEND", "SECTION", "BUTTON"]);
const REGION_ROLES = new Set(["dialog", "alertdialog", "alert", "status"]);

class FakeElement {
  readonly shadowRoot = null;
  readonly tagName: string;
  constructor(tagName: string, readonly children: readonly (FakeElement | string)[], readonly attributes: Readonly<Record<string, string>> = {}) {
    this.tagName = tagName.toUpperCase();
  }
  matches(): boolean {
    return false;
  }
  getClientRects(): unknown[] {
    return this.attributes.hidden === undefined ? [{}] : [];
  }
  querySelectorAll(selector: string): FakeElement[] {
    const all = this.descendants();
    if (selector === "*") return all;
    if (selector.startsWith("h1, h2")) return all.filter((element) => HEADING_TAGS.has(element.tagName));
    // The check regions: a dialog, an alert or status region, a live region.
    if (selector.startsWith("dialog[open]")) {
      return all.filter((element) => REGION_ROLES.has(element.attributes.role ?? "") || element.attributes["aria-modal"] === "true" || element.attributes["aria-live"] !== undefined);
    }
    // The disabled controls.
    if (selector.startsWith("button:disabled")) return all.filter((element) => element.tagName === "BUTTON" && element.attributes.disabled !== undefined);
    return [];
  }
  get textContent(): string {
    return this.children.map((child) => typeof child === "string" ? child : child.textContent).join("");
  }
  /** Blocks on their own lines, as a painted page's `innerText` gives them; a hidden element paints nothing. */
  get innerText(): string {
    if (this.attributes.hidden !== undefined) return "";
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

/** An element with attributes: a role, `aria-modal`, `disabled`, `hidden`. */
function withAttributes(tagName: string, attributes: Record<string, string>, ...children: (FakeElement | string)[]): FakeElement {
  return new FakeElement(tagName, children, attributes);
}

/** Runs a read with `HTMLElement` bound to the fake, and puts the global back. */
function withFakeHtmlElement<T>(read: () => T): T {
  const globals = globalThis as unknown as Record<string, unknown>;
  const previous = Object.getOwnPropertyDescriptor(globals, "HTMLElement");
  globals.HTMLElement = FakeElement;
  try {
    return read();
  } finally {
    if (previous) Object.defineProperty(globals, "HTMLElement", previous);
    else delete globals.HTMLElement;
  }
}

function pageChallenge(body: FakeElement): ReturnType<typeof challengeIn> {
  return withFakeHtmlElement(() => challengeIn(body as unknown as Element, "page"));
}

function dialogChallenge(dialog: FakeElement): ReturnType<typeof challengeIn> {
  return withFakeHtmlElement(() => challengeIn(dialog as unknown as Element, "dialog"));
}

function pageRobotCheck(body: FakeElement): ReturnType<typeof robotCheckIn> {
  return withFakeHtmlElement(() => robotCheckIn(body as unknown as Element, "page"));
}

/** Ordinary page content, long enough that the page is no interstitial. */
function longContent(): FakeElement {
  return el("div", el("h2", "Results"), el("p", "Listing details and prices for everything on this page. ".repeat(40)));
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
  assert.equal(pageRobotCheck(article), undefined);
});

test("a small ordinary page is not a robot check", () => {
  const page = el("body", el("h1", "Your basket"), el("p", "Your basket is empty."), el("div", "Continue shopping"));
  assert.equal(pageChallenge(page), undefined);
});

// Who clears a check. FluxIQ never presses, types into, solves or reloads one,
// so a check that lifts by itself is waited out and every other one is the
// person's. The line is drawn from the words a visitor reads.

test("a box that asks the visitor to confirm they are not a robot is only a person's to answer", () => {
  assert.equal(pageRobotCheck(TRAFFIC_SCREEN), "person_only");
});

/** bigbox-retail's `pages/robot-check-page.ts`: a hold button, and a countdown that checks again by itself. */
const HOLD_WITH_COUNTDOWN = el("body",
  el("div", el("div",
    el("h1", "Robot or human?"),
    el("p", "Activate and hold the button to confirm that you're human. Thank you!"),
    el("div", el("span"), el("span", "Press & Hold")),
    el("p", "Having trouble? We'll check your browser again automatically in ", el("span", "8"), " seconds."),
    el("p", "Reference ID: 7F3K-QX"))));

test("a hold check that says it will check again automatically clears by itself", () => {
  assert.equal(pageRobotCheck(HOLD_WITH_COUNTDOWN), "self_clearing");
  // A missing target on it is not handed to the person: it is waited out, by
  // the navigation that met it or by the retry a missing target is given.
  assert.equal(pageChallenge(HOLD_WITH_COUNTDOWN), undefined);
});

test("'Robot or human?' with no countdown is a robot check only a person can answer, which it was not before", () => {
  const page = el("body", el("h1", "Robot or human?"), el("p", "Activate and hold the button to confirm that you're human."));
  assert.equal(pageRobotCheck(page), "person_only");
  assert.equal(pageChallenge(page), "captcha");
});

test("a 'Checking your browser before you continue' page clears by itself: auction-marketplace's", () => {
  const card = el("div",
    el("h1", "Checking your browser before you continue"),
    el("div"),
    el("p", "We saw unusual activity from your network. This takes about five seconds, or you can continue now."),
    el("button", "Continue"));
  assert.equal(pageRobotCheck(el("body", el("div", card))), "self_clearing");
  assert.equal(dialogChallenge(card), "captcha", "drawn as a layer, it is one the interference defence never presses through");
});

test("a checking cover drawn in an alert region over a long feed is read, though the page is no interstitial: local-classifieds'", () => {
  const cover = withAttributes("div", { role: "alert" },
    el("div"), el("strong", "Checking your browser before you continue"), el("span", "This usually takes a few seconds."));
  const page = el("body", longContent(), el("section", el("div", "Listing card ".repeat(200)), cover));
  assert.equal(pageRobotCheck(page), "self_clearing");
});

test("the same feed without the cover is no check", () => {
  const page = el("body", longContent(), el("section", el("div", "Listing card ".repeat(200))));
  assert.equal(pageRobotCheck(page), undefined);
});

/** company-website's quote drawer: a modal dialog whose verify box is drawn over the form after "Send request". */
function quoteDrawer(verify: FakeElement | undefined): FakeElement {
  const box = verify ?? withAttributes("div", { hidden: "" });
  return el("body", longContent(), withAttributes("section", { role: "dialog", "aria-modal": "true" },
    el("div", el("h2", "Get a free quote")),
    el("form", el("fieldset", el("legend", el("strong", "Almost done")), el("p", "Step 3 of 3. We reply within one working day.")), box),
    el("div", el("button", "Back"), el("button", "Send request"))));
}

test("a quote form's modal that says it is checking the visitor clears by itself, for now", () => {
  const checking = el("div", el("div", el("span"), el("p", "Checking you are human…"), el("p", "Protected by Shieldline")));
  assert.equal(pageRobotCheck(quoteDrawer(checking)), "self_clearing");
});

test("the same modal once it asks the visitor to confirm they are human is the person's, and it was not a check before", () => {
  const confirm = el("div", el("div", el("div", el("span"), " Confirm you are human"), el("p", "Protected by Shieldline")));
  assert.equal(pageRobotCheck(quoteDrawer(confirm)), "person_only");
  assert.equal(pageChallenge(quoteDrawer(confirm)), "captcha");
});

test("the quote form before it is sent is no check", () => {
  assert.equal(pageRobotCheck(quoteDrawer(undefined)), undefined);
});

/** everything-store's soft check: a disabled "Checking your browser..." button that unlocks, and a page that passes by itself. */
test("a soft browser check with a disabled 'Checking your browser' button clears by itself", () => {
  const page = el("body", el("div", el("div",
    el("p", "brightaisle"),
    el("h4", "Click the button below to continue shopping"),
    el("p", "We're checking that your browser is set up to shop securely. This only takes a moment."),
    withAttributes("button", { disabled: "" }, "Checking your browser…"))));
  assert.equal(pageRobotCheck(page), "self_clearing");
});

test("the soft check once its button unlocks still says it is checking, so it is still waited out", () => {
  const page = el("body", el("div", el("div",
    el("h4", "Click the button below to continue shopping"),
    el("p", "We're checking that your browser is set up to shop securely. This only takes a moment."),
    el("button", "Continue shopping"))));
  assert.equal(pageRobotCheck(page), "self_clearing");
});

test("characters to read from a picture are always the person's, whatever else the page says", () => {
  const page = el("body", el("div", el("div",
    el("h4", "Enter the characters you see below"),
    el("p", "Sorry, we just need to make sure you're not a robot. For best results, please make sure your browser is accepting cookies."),
    el("p", "Checking your browser again automatically is not possible here."),
    el("label", "Type characters"))));
  assert.equal(pageRobotCheck(page), "person_only");
});

test("a disabled 'Checking availability' button on an ordinary page is no check", () => {
  const page = el("body", longContent(), withAttributes("button", { disabled: "" }, "Checking availability…"));
  assert.equal(pageRobotCheck(page), undefined);
});

test("a page that says it will redirect automatically in a few seconds is no check", () => {
  const page = el("body", el("h1", "Thanks, your message was sent"), el("p", "You will be redirected automatically in 5 seconds."));
  assert.equal(pageRobotCheck(page), undefined);
});

test("an ordinary status region is read and is no check", () => {
  const page = el("body", longContent(), withAttributes("div", { role: "status" }, "Added to basket"));
  assert.equal(pageRobotCheck(page), undefined);
});
