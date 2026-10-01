// T1 coverage of a run's own section linking to more of it (`section-link.ts`,
// t195 w22e), on stub trees shaped like Circleway's Friends home
// (`apps/scenario-lab/src/scenarios/social-network-feed/markup/friends.ts`,
// `renderFriendsHome`): the main column is a header holding "Friend requests"
// and a "See all" link, the grid of four request cards, then a second header
// and grid for "People you may know". Live run 36 read the four cards as the
// whole list of eight (`run-muq3uozx-3153564b`, cause 11).

import assert from "node:assert/strict";
import test from "node:test";
import { sectionContinuation } from "..";
import { FakeElement } from "../../tests/store-pager";

/** Runs `body` with the one browser name the label reader asks about defined. */
function withElementNames<T>(body: () => T): T {
  const saved = (globalThis as Record<string, unknown>).HTMLInputElement;
  (globalThis as Record<string, unknown>).HTMLInputElement = class {};
  try {
    return body();
  } finally {
    (globalThis as Record<string, unknown>).HTMLInputElement = saved;
  }
}

const el = (tag: string, attributes: Record<string, string> = {}, text = "", children: FakeElement[] = []) => new FakeElement(tag, attributes, text, children);
const asElements = (items: FakeElement[]) => items as unknown as Element[];
const asElement = (element: FakeElement) => element as unknown as Element;

/** One request card as the Friends home draws it: photo link, name link, mutual line, sent time, Confirm and Delete. */
function requestCard(name: string, inside: FakeElement[] = []): FakeElement {
  return el("div", { role: "listitem" }, "", [
    el("a", { href: "/circleway/people/x/", "aria-hidden": "true" }),
    el("div", {}, "", [
      el("a", { href: "/circleway/people/x/" }, name),
      el("div", {}, "3 mutual friends"),
      el("span", {}, "2d"),
      el("div", { role: "button", "aria-label": "Confirm" }, "Confirm"),
      el("div", { role: "button", "aria-label": "Delete" }, "Delete"),
      ...inside
    ])
  ]);
}

function suggestionCard(name: string): FakeElement {
  return el("div", { role: "listitem" }, "", [el("a", { href: "/circleway/people/y/" }, name), el("div", { role: "button", "aria-label": "Add friend" }, "Add friend")]);
}

/** The Friends home's main column; `requestsHeader` replaces the requests header's link when given. */
function friendsHome(options: { requestsLink?: FakeElement | null; requests?: FakeElement[] } = {}) {
  const requests = options.requests ?? ["Ana Ruiz", "Ben Okafor", "Cleo Park", "Dev Shah"].map((name) => requestCard(name));
  const requestsLink = options.requestsLink === undefined ? el("a", { href: "/circleway/friends/requests/" }, "See all") : options.requestsLink;
  const grid = el("div", { role: "list" }, "", requests);
  const suggestions = ["Eli Moss", "Fay Lin", "Gus Tan"].map(suggestionCard);
  el("div", { role: "main" }, "", [
    el("div", {}, "", [el("h2", {}, "Friend requests"), ...(requestsLink ? [requestsLink] : [])]),
    grid,
    el("div", {}, "", [el("h2", {}, "People you may know"), el("a", { href: "/circleway/friends/suggestions/" }, "See all")]),
    el("div", { role: "list" }, "", suggestions)
  ]);
  return { requests, grid, suggestions };
}

test("a See all link in the run's own section header, outside the cards, says the list continues there", () => withElementNames(() => {
  const { requests, grid } = friendsHome();
  assert.deepEqual(sectionContinuation(asElements(requests), asElement(grid), []), { label: "See all", path: "/circleway/friends/requests/" });
}));

test("the next section's See all is not this run's: each grid is answered with its own header's link", () => withElementNames(() => {
  const { suggestions } = friendsHome({ requestsLink: null });
  const grid = suggestions[0]!.parentElement!;
  assert.deepEqual(sectionContinuation(asElements(suggestions), asElement(grid), []), { label: "See all", path: "/circleway/friends/suggestions/" });
  const home = friendsHome({ requestsLink: null });
  assert.equal(sectionContinuation(asElements(home.requests), asElement(home.grid), []), undefined, "the requests' header has no link, and the suggestions' is past it");
}));

test("a See all inside an item is that item's, never the list's", () => withElementNames(() => {
  const requests = ["Ana Ruiz", "Ben Okafor", "Cleo Park", "Dev Shah"].map((name) => requestCard(name, [el("a", { href: "/circleway/people/x/friends/" }, "See all")]));
  const { grid } = friendsHome({ requestsLink: null, requests });
  assert.equal(sectionContinuation(asElements(requests), asElement(grid), []), undefined);
}));

test("a section with no such link, or a link whose label only begins with the phrase, says nothing", () => withElementNames(() => {
  const plain = friendsHome({ requestsLink: el("a", { href: "/circleway/friends/requests/sent/" }, "View sent requests") });
  assert.equal(sectionContinuation(asElements(plain.requests), asElement(plain.grid), []), undefined);
  const counted = friendsHome({ requestsLink: el("a", { href: "/circleway/friends/requests/" }, "See all 8 requests") });
  assert.equal(sectionContinuation(asElements(counted.requests), asElement(counted.grid), []), undefined);
}));

test("the run's own Show more pagination is how it continues, not a hint that it does", () => withElementNames(() => {
  const showMore = el("button", {}, "Show more");
  const { requests, grid } = friendsHome({ requestsLink: null });
  grid.parentElement!.children.splice(2, 0, showMore);
  showMore.parentElement = grid.parentElement;
  assert.equal(sectionContinuation(asElements(requests), asElement(grid), [asElement(showMore)]), undefined);
  // The same button, when it is not the run's pagination, is a section link: a button carries no path.
  assert.deepEqual(sectionContinuation(asElements(requests), asElement(grid), []), { label: "Show more" });
}));

test("a section wrapping its own heading and list is found from the list however deep it sits, and a link to another origin carries no path", () => withElementNames(() => {
  const items = ["one", "two", "three"].map((name) => el("li", {}, name));
  const list = el("ul", {}, "", items);
  el("main", {}, "", [
    el("section", {}, "", [el("h2", {}, "Orders"), el("div", {}, "", [el("div", {}, "", [list])]), el("a", { href: "https://elsewhere.test/orders" }, "View all ›")]),
    el("section", {}, "", [el("h2", {}, "Returns"), el("a", { href: "/returns" }, "See all")])
  ]);
  assert.deepEqual(sectionContinuation(asElements(items), asElement(list), []), { label: "View all ›" });
}));
