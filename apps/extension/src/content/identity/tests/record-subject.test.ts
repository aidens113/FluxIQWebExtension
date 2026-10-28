// What a save is about when it sits beside other controls rather than beside
// its item's name (t778, from t772 w11).
//
// The job board's pane draws a job's title as an `h2` in its head, and below
// it a bar of actions: the employer's "Apply on company site" link and the
// heart that saves the job. The heart is no row of any list, so its subject is
// the title of the nearest part around it (`record.ts` `nearestTitle`). That
// part was the actions bar, whose only "title" was the Apply link, so every
// save on the board was about "Apply on company site": three saves of three
// jobs declared one subject, and Core could not tell whose row each was until
// its undo landed (rerun round 6 slot 2, `run-mvrj7qg9-b6dc94f6`).
//
// The rule these rows hold: a part that holds nothing but controls is a bar of
// them, and a link in it is one of its actions, never the name of what the
// controls act on; and a link that acts on the page itself -- a `#` or
// `javascript:` address, a link that says it is a button, a download -- is
// never anything's title. The markup is the board's own shape, written here
// with the shared stub document.

import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";
import { recordSubject } from "../record";

const TITLES = ["Senior Rust Engineer", "Rust Engineer", "Rust Engineer, Settlement Systems"] as const;

function install(t: TestContext, ...children: StubElement[]): void {
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, ...children)));
  installStubDocument(t, document);
}

const asElement = (element: StubElement): Element => element as unknown as Element;
const subjectOf = (element: StubElement): string | undefined => recordSubject(asElement(element));

/** The heart's drawing: shapes, no words. */
const drawing = (): StubElement => el("svg", { viewBox: "0 0 24 24" }, el("path", { d: "M12 21l-1-1C5 15 2 12 2 8a5 5 0 0 1 10-2 5 5 0 0 1 10 2c0 4-3 7-9 12z" }));

/** A job's pane, as `board/pane.ts` draws it: title, company, meta lines, then the apply link and the heart side by side. */
function pane(title: string, key: string): { pane: StubElement; heart: StubElement; apply: StubElement } {
  const apply = el("a", { class: "k3a", href: `/scenarios/job-board/rc/clk?jk=${key}`, target: "_blank", rel: "noopener" }, "Apply on company site", el("svg", { viewBox: "0 0 24 24" }, el("path", { d: "M14 4h6v6" })));
  const heart = el("span", { class: "k9h" }, drawing());
  const head = el("div", { class: "k1p" },
    el("h2", { class: "k2t" }, title),
    el("div", { class: "k4c" }, el("a", { href: "#" }, "Saltmarsh Games"), " ", el("span", {}, "4.1 ★")),
    el("div", { class: "k5m" }, "London"),
    el("div", { class: "k5m" }, "£70,000 a year · Full-time"),
    el("div", { class: "k6a" }, apply, heart));
  const body = el("div", { class: "k7b" }, el("h3", {}, "Job details"), el("p", {}, "Pay: £70,000 a year"), el("h3", {}, "Full job description"), el("p", {}, "Build settlement services in Rust."));
  return { pane: el("div", { class: "k8r", "data-jk": key }, head, body), heart, apply };
}

/** One result card, as `board/card.ts` draws it: the title links to the job, the heart beside it. */
function card(title: string, key: string): StubElement {
  return el("li", { class: "c1" }, el("article", { class: "c2", "data-jk": key },
    el("div", { class: "c3" }, el("h2", { class: "c4" }, el("a", { href: `/scenarios/job-board/viewjob?jk=${key}` }, title)), el("span", { class: "k9h" }, drawing())),
    el("div", { class: "c5" }, el("span", {}, "Saltmarsh Games"), el("span", {}, "Remote in UK"))));
}

test("a job's own page: the heart beside the apply link is about the job's title, never the apply link", (t) => {
  const { pane: page, heart } = pane(TITLES[1], "f2ab");
  install(t, el("main", {}, page));
  assert.equal(subjectOf(heart), TITLES[1]);
});

test("three jobs saved from the results page's pane are about three different jobs", (t) => {
  const subjects = TITLES.map((title, index) => {
    const { pane: open, heart } = pane(title, `k${index}`);
    install(t, el("main", {}, el("ol", {}, ...TITLES.map((each, at) => card(each, `k${at}`))), el("div", { class: "k0" }, open)));
    return subjectOf(heart);
  });
  assert.deepEqual(subjects, [...TITLES]);
});

test("the save on the pane and the unsave on My jobs are about the same job", (t) => {
  const { pane: page, heart } = pane(TITLES[2], "79bd");
  const unsaves = TITLES.map(() => el("span", { class: "k9h k9o", role: "button", tabindex: "0", "aria-label": "Unsave job" }, drawing()));
  const rows = TITLES.map((title, index) => el("li", { class: "s1", "data-jk": `k${index}` },
    el("a", { href: `/scenarios/job-board/viewjob?jk=k${index}` }, title), el("span", {}, "Saltmarsh Games"), el("span", {}, "Remote in UK"), el("span", { class: "s2" }, "Saved today"), unsaves[index]!));
  install(t, el("main", {}, page), el("section", {}, el("h1", {}, "My jobs"), el("ol", {}, ...rows)));
  assert.equal(subjectOf(heart), TITLES[2]);
  assert.equal(subjectOf(unsaves[2]!), TITLES[2]);
});

test("a link that acts on the page itself is never a row's title: a '#' Share, a link that is a button, a script address", (t) => {
  const saves = TITLES.map(() => el("button", { class: "v1" }, "Save"));
  const rows = TITLES.map((title, index) => el("li", { class: "r1" },
    el("a", { href: "#", class: "r2" }, "Share"),
    el("a", { href: "/apply", role: "button" }, "Apply now"),
    el("a", { href: "javascript:void(0)" }, "Report"),
    el("a", { href: `/item/${index}` }, title),
    saves[index]!));
  install(t, el("ul", {}, ...rows));
  assert.deepEqual(saves.map(subjectOf), [...TITLES]);
});

test("a lone control is still about the item link beside it where the part says more than its controls", (t) => {
  // A saved list's one line: the item's link, its price, and Move to cart -- the link names the item.
  const move = el("button", {}, "Move to cart");
  install(t, el("main", {}, el("h1", {}, "Your basket"), el("section", {}, el("h2", {}, "Saved for later"), el("div", { class: "saved" }, el("a", { href: "/p/9" }, "Beeswax Wraps, Set of 3"), el("span", {}, "$12.00"), move))));
  assert.equal(subjectOf(move), "Beeswax Wraps, Set of 3");
});
