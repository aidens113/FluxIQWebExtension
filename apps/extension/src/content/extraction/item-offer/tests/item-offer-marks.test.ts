// What a list item offers to bring the person into its set, read as an
// "outside" mark and sent beside the rows a read left out (`../item-offer/`,
// t810). The markup is the shape of a feed's suggested post -- a bar with a
// join control above a titled, linked head -- on a hobby club's notice board:
// no task, site, item or answer of any realistic scenario.

import assert from "node:assert/strict";
import test from "node:test";
import { itemOfferMarks, offerWords } from "..";
import { extractList } from "../../list-reader";
import { rejectedSamplesFor } from "../../rejected-samples";
import { readExtractionCheckpoint, type ExtractionCheckpoint } from "../../../../shared/extraction-continuation";
import { asElements, el, type PageElement } from "../../tests/selector-page";

/** A suggested notice: a bar with a join control, then a head whose heading links the club and whose other links are not names of it. */
function suggested(club: string, control: PageElement): PageElement {
  return el("div", { class: "notice" }, [
    el("div", { class: "bar" }, [el("span", {}, "Suggested for you"), control]),
    el("div", { class: "head" }, [
      el("a", { href: "/clubs/x", "aria-hidden": "true" }, [el("img", { alt: "" })]),
      el("h3", {}, [el("span", {}, [el("a", { href: "/clubs/x" }, club)])]),
      el("a", { href: "/people/k" }, "Kim Tran"),
      el("a", { href: "/posts/1" }, "Monday 21 September 2026")
    ]),
    el("div", { class: "text" }, "Anyone know a way to keep pigeons off the beds?")
  ]);
}

test("a join control in a suggested notice is an outside mark, named by the heading's link", () => {
  const item = suggested("Urban Growers Network", el("div", { role: "button", tabindex: "0" }, "Join club"));
  assert.deepEqual(itemOfferMarks(item as unknown as Element), [{ kind: "outside", said: "Join club", entity: "Urban Growers Network" }]);
});

test("a state the offer has led to is no mark", () => {
  for (const state of ["Joined", "Following", "Unfollow", "Unsubscribe", "Leave club", "Requested", "Pending", "Member"]) {
    assert.equal(itemOfferMarks(suggested("Urban Growers Network", el("button", {}, state)) as unknown as Element), null, state);
  }
});

test("the offer words match at the start of a name, on a word boundary, in any case", () => {
  for (const name of ["Join", "join club", "FOLLOW", "Subscribe to channel", "Connect", "Add  friend", "Request to join", "Become a member"]) assert.equal(offerWords(name), true, name);
  for (const name of ["Joined", "Joint account", "Followers", "Like", "Send this to friends", "Rejoin", ""]) assert.equal(offerWords(name), false, name);
});

test("a person card's add-friend control is named by the card's one linked name, and an unclear name is left out", () => {
  const card = el("div", { class: "card" }, [
    el("a", { href: "/p/sam", "aria-hidden": "true" }, [el("img", { alt: "" })]),
    el("a", { href: "/p/sam" }, "Sam Okoro"),
    el("div", { role: "button", "aria-label": "Add friend" }, "Add friend")
  ]);
  assert.deepEqual(itemOfferMarks(card as unknown as Element), [{ kind: "outside", said: "Add friend", entity: "Sam Okoro" }]);
  const crowded = el("div", {}, [el("a", { href: "/a" }, "Ann"), el("a", { href: "/b" }, "Bo"), el("button", {}, "Follow")]);
  assert.deepEqual(itemOfferMarks(crowded as unknown as Element), [{ kind: "outside", said: "Follow" }]);
});

test("an item offering nothing has no marks", () => {
  assert.equal(itemOfferMarks(el("div", {}, [el("button", {}, "Like"), el("a", { href: "/x" }, "Read more")]) as unknown as Element), null);
});

test("the marks sit beside their rejected row, positionally, and survive a resume", () => {
  const samples = rejectedSamplesFor(true, 1, undefined)!;
  samples.note([0], { name: "A" }, undefined, [{ kind: "outside", said: "Join club", entity: "Urban Growers Network" }]);
  samples.note([0], { name: "B" }, undefined, null);
  assert.deepEqual(samples.marks(), [[[{ kind: "outside", said: "Join club", entity: "Urban Growers Network" }], null]]);
  const resumed = rejectedSamplesFor(true, 1, samples.rows(), samples.alone(), undefined, samples.marks())!;
  assert.deepEqual(resumed.marks(), samples.marks());
  assert.equal(rejectedSamplesFor(true, 1, undefined)!.marks(), undefined, "no item offered anything, so no marks are sent");
});

test("a read marks the suggested notices its condition left out, and the marks travel in its checkpoint", async () => {
  const notices = [
    { club: "Chess Circle", mine: "yes", tree: suggested("Chess Circle", el("button", {}, "Join club")) },
    { club: "Urban Growers Network", mine: "", tree: suggested("Urban Growers Network", el("div", { role: "button" }, "Join club")) },
    { club: "Harbour Council", mine: "", tree: suggested("Harbour Council", el("button", {}, "Joined")) }
  ];
  const rows = notices.map((notice) => Object.assign(notice.tree, { getAttribute: (name: string) => (name === "data-club" ? notice.club : name === "data-mine" ? notice.mine || null : null) }));
  const saved = { document: (globalThis as Record<string, unknown>).document, element: (globalThis as Record<string, unknown>).HTMLElement, input: (globalThis as Record<string, unknown>).HTMLInputElement };
  (globalThis as Record<string, unknown>).HTMLElement = class {};
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).document = { readyState: "complete", querySelectorAll: (selector: string) => (selector === ".notice" ? asElements(rows) : []), querySelector: () => null };
  try {
    const start: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };
    const outcome = await extractList({ item: ".notice", fields: { club: { kind: "attribute", attribute: "data-club" } }, where: [{ read: { kind: "attribute", attribute: "data-mine" }, is: "present" }] }, { resume: start, sampleRejected: true });
    assert.deepEqual(outcome.rejectedSamples, [[{ club: "Urban Growers Network" }, { club: "Harbour Council" }]]);
    assert.deepEqual(outcome.rejectedMarks, [[[{ kind: "outside", said: "Join club", entity: "Urban Growers Network" }], null]]);
    const checkpoint = readExtractionCheckpoint(JSON.parse(JSON.stringify({ records: [], pagesRead: 1, scrolls: 0, missingFields: [], conditions: { applied: 3, kept: 1, rejected: [2] }, rejectedSamples: outcome.rejectedSamples, rejectedSamplesAlone: outcome.rejectedSamplesAlone, rejectedMarks: outcome.rejectedMarks })));
    assert.deepEqual(checkpoint?.rejectedMarks, outcome.rejectedMarks);
    assert.equal(readExtractionCheckpoint({ records: [], pagesRead: 1, scrolls: 0, missingFields: [], rejectedSamples: [[{ club: "A" }]], rejectedMarks: [[[{ kind: "inside", said: "x" }]]] })?.rejectedMarks, undefined, "unreadable marks are dropped, never the checkpoint");
  } finally {
    Object.assign(globalThis as Record<string, unknown>, { document: saved.document, HTMLElement: saved.element, HTMLInputElement: saved.input });
  }
});

test("a notice two conditions left out together carries its mark with each list it sits in (t810)", async () => {
  const join = () => el("button", {}, "Join club");
  const notices = [
    { club: "Chess Circle", mine: "", live: "yes", tree: suggested("Chess Circle", join()) },
    { club: "Urban Growers Network", mine: "", live: "", tree: suggested("Urban Growers Network", join()) },
    { club: "Harbour Council", mine: "yes", live: "yes", tree: suggested("Harbour Council", el("button", {}, "Joined")) }
  ];
  const rows = notices.map((notice) => Object.assign(notice.tree, { getAttribute: (name: string) => (name === "data-club" ? notice.club : name === "data-mine" ? notice.mine || null : name === "data-live" ? notice.live || null : null) }));
  const saved = { document: (globalThis as Record<string, unknown>).document, element: (globalThis as Record<string, unknown>).HTMLElement, input: (globalThis as Record<string, unknown>).HTMLInputElement };
  (globalThis as Record<string, unknown>).HTMLElement = class {};
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  (globalThis as Record<string, unknown>).document = { readyState: "complete", querySelectorAll: (selector: string) => (selector === ".notice" ? asElements(rows) : []), querySelector: () => null };
  try {
    const start: ExtractionCheckpoint = { records: [], pagesRead: 0, scrolls: 0, missingFields: [], itemsSeen: 0 };
    const present = (name: string) => ({ read: { kind: "attribute" as const, attribute: name }, is: "present" as const });
    const outcome = await extractList({ item: ".notice", fields: { club: { kind: "attribute", attribute: "data-club" } }, where: [present("data-mine"), present("data-live")] }, { resume: start, sampleRejected: true });
    const mark = [{ kind: "outside", said: "Join club", entity: "Chess Circle" }];
    const other = [{ kind: "outside", said: "Join club", entity: "Urban Growers Network" }];
    const together = outcome.rejectedSamples?.flatMap((list, index) => list.slice(outcome.rejectedSamplesAlone![index]).map((row, at) => ({ row, marks: outcome.rejectedMarks?.[index]?.[outcome.rejectedSamplesAlone![index]! + at] })));
    assert.ok(together?.length, "a row both conditions rejected follows the alone lead");
    for (const entry of together ?? []) assert.deepEqual(entry.marks, other, "every row sent, alone or not, carries its marks");
    assert.deepEqual(outcome.rejectedMarks?.[0]?.[0], mark);
  } finally {
    Object.assign(globalThis as Record<string, unknown>, { document: saved.document, HTMLElement: saved.element, HTMLInputElement: saved.input });
  }
});
