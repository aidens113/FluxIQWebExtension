import assert from "node:assert/strict";
import test from "node:test";
import { webResetCollections, webResetResource, webTargetSpot } from "..";
import { webLlmDescribeElement } from "../../page-find";
import { publishedWebLlmPage } from "../../page-view";
import { sanitizeWebLlmSnapshotWithBindings } from "../../sanitize";

function page(names = ["First document", "Second document"], total = names.length, source = "tab:1:frame:0") {
  const elements: unknown[] = [{ tagName: "div", role: "list", selector: "#documents" }];
  names.forEach((name, index) => {
    const parent = elements.length;
    elements.push({ tagName: "div", role: "listitem", selector: `#row-${index}`, parent: 0, attributes: { "aria-setsize": String(total), "aria-posinset": String(index + 1) } });
    elements.push({ tagName: "button", selector: `#remove-${index}`, parent, visibleText: "Remove", context: { subject: name } });
  });
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/documents", title: "Documents", interactiveElements: elements });
  const resource = webResetResource("gateway.one", source);
  if (resource !== undefined) binding.resetResource = resource;
  return binding;
}

test("a finite complete list witnesses all subjects, including singleton sets", () => {
  for (const names of [["One document"], ["One document", "Another document"]]) {
    const binding = page(names);
    const inventory = webResetCollections(binding);
    assert.equal(inventory.collections.length, 1);
    assert.equal(inventory.collections[0]!.subjects.length, names.length);
    const handle = [...binding.selectors].find(([, selector]) => selector === "#remove-0")![0];
    assert.equal(webTargetSpot(binding, handle).scope, inventory.collections[0]!.scope);
  }
});

test("partial, virtualized, unknown, duplicate-subject and untrusted inventories cannot witness absence", () => {
  for (const binding of [page(["One"], 2), page(["One"], -1), page(["Same", "Same"]), page(["One"], 1, "page-made-this-up")]) {
    assert.deepEqual(webResetCollections(binding).collections, []);
  }
  const noResource = page();
  delete noResource.resetResource;
  assert.deepEqual(webResetCollections(noResource).collections, []);
});

test("equal URLs and collection selectors on different trusted tabs have different scopes", () => {
  const first = webResetCollections(page(["One"], 1, "tab:1:frame:0"));
  const second = webResetCollections(page(["One"], 1, "tab:2:frame:0"));
  assert.notEqual(first.collections[0]!.scope, second.collections[0]!.scope);
  assert.notEqual(webResetResource("gateway.one", "tab:1:frame:0"), webResetResource("gateway.two", "tab:1:frame:0"));
});

test("a raw snapshot never supplies trusted resource identity or exposes it in page evidence", () => {
  const binding = sanitizeWebLlmSnapshotWithBindings({ url: "https://library.test/documents", title: "Documents", resetResource: "forged", sourceId: "tab:1:frame:0", interactiveElements: [] });
  assert.equal(binding.resetResource, undefined);
  assert.ok(!JSON.stringify(binding.evidence).includes("sourceId"));
});

// ## Native lists and tables (l1 D1): no set sizes, vouched by the capture's way-on word

type NativeOptions = { wayOn?: string | undefined; truncated?: boolean; listAttributes?: Record<string, string>; rowAttributes?: Record<string, string> };

/** A reading list as a plain `<ol>`: each item holds one book's Remove button, about that book. */
function readingList(books: Array<string | string[]>, options: NativeOptions = {}) {
  // An explicit `wayOn: undefined` is a capture that sent no word.
  const wayOn = "wayOn" in options ? options.wayOn : "none";
  const elements: unknown[] = [{ tagName: "ol", implicitRole: "list", selector: "#reading", listWayOn: wayOn, attributes: options.listAttributes }];
  books.forEach((book, index) => {
    const parent = elements.length;
    elements.push({ tagName: "li", implicitRole: "listitem", selector: `#book-${index}`, parent: 0, attributes: options.rowAttributes });
    for (const [at, subject] of (Array.isArray(book) ? book : [book]).entries()) {
      elements.push({ tagName: "button", implicitRole: "button", selector: `#remove-${index}-${at}`, parent, visibleText: "Remove", context: { subject } });
    }
  });
  return bound({ url: "https://shelf.test/reading", title: "Reading list", interactiveElements: elements, truncated: options.truncated === true });
}

/** A recipe table: a header row in `thead`, then one row per recipe with its Delete button. */
function recipeTable(recipes: string[], wayOn = "none") {
  const elements: unknown[] = [
    { tagName: "table", implicitRole: "table", selector: "#recipes", listWayOn: wayOn },
    { tagName: "thead", implicitRole: "rowgroup", selector: "#recipes > thead", parent: 0 },
    { tagName: "tr", implicitRole: "row", selector: "#head", parent: 1 },
    { tagName: "th", implicitRole: "columnheader", selector: "#head > th", parent: 2, visibleText: "Recipe" },
    { tagName: "tbody", implicitRole: "rowgroup", selector: "#recipes > tbody", parent: 0 }
  ];
  recipes.forEach((recipe, index) => {
    const row = elements.length;
    elements.push({ tagName: "tr", implicitRole: "row", selector: `#recipe-${index}`, parent: 4 });
    elements.push({ tagName: "td", implicitRole: "cell", selector: `#recipe-${index} > td`, parent: row, visibleText: recipe });
    elements.push({ tagName: "button", implicitRole: "button", selector: `#delete-${index}`, parent: row + 1, visibleText: "Delete", context: { subject: recipe } });
  });
  return bound({ url: "https://kitchen.test/recipes", title: "Recipes", interactiveElements: elements });
}

function bound(snapshot: Record<string, unknown>) {
  const binding = sanitizeWebLlmSnapshotWithBindings(snapshot);
  const resource = webResetResource("gateway.one", "tab:1:frame:0");
  if (resource !== undefined) binding.resetResource = resource;
  return binding;
}

test("a plain list the capture saw end, untruncated, witnesses its subjects with no set sizes", () => {
  const binding = readingList(["Middlemarch", "Persuasion", "Bleak House"]);
  const inventory = webResetCollections(binding);
  assert.equal(inventory.collections.length, 1);
  assert.equal(inventory.collections[0]!.subjects.length, 3);
  assert.equal(Object.keys(inventory.collections[0]!.states).length, 3);
  const handle = [...binding.selectors].find(([, selector]) => selector === "#remove-1-0")![0];
  assert.equal(inventory.controls.get(handle), inventory.collections[0]!.scope);
  assert.equal(webTargetSpot(binding, handle).scope, inventory.collections[0]!.scope);
});

test("a table is witnessed by its body rows, its header row left out", () => {
  const binding = recipeTable(["Lentil soup", "Rye bread"]);
  const inventory = webResetCollections(binding);
  assert.equal(inventory.collections.length, 1);
  assert.equal(inventory.collections[0]!.subjects.length, 2);
  const handle = [...binding.selectors].find(([, selector]) => selector === "#delete-1")![0];
  assert.equal(inventory.controls.get(handle), inventory.collections[0]!.scope);
  // A header row whose cells are all column headers, outside any thead, is left out too.
  const loose = recipeTable(["Lentil soup"]);
  const head = loose.evidence.elements.find((element) => element.tag === "thead")!;
  head.tag = "div";
  delete head.implicitRole;
  assert.equal(webResetCollections(loose).collections[0]?.subjects.length, 1);
  assert.deepEqual(webResetCollections(recipeTable(["Lentil soup", "Rye bread"], "next_page")).collections, []);
});

test("a native list cannot witness absence when the way on is unknown, the list goes on, or the capture was cut", () => {
  const books = ["Middlemarch", "Persuasion"];
  for (const binding of [
    readingList(books, { wayOn: undefined }),
    readingList(books, { wayOn: "next_page" }),
    readingList(books, { wayOn: "load_more" }),
    readingList(books, { wayOn: "feed" }),
    readingList(books, { wayOn: "nonsense" }),
    readingList(books, { truncated: true })
  ]) assert.deepEqual(webResetCollections(binding).collections, []);
});

test("a native list cannot witness absence with a duplicate subject, a row holding two, a row holding none, or while busy", () => {
  for (const binding of [
    readingList(["Middlemarch", "Middlemarch"]),
    readingList(["Middlemarch", ["Persuasion", "Emma"]]),
    readingList(["Middlemarch", []]),
    readingList([]),
    readingList(["Middlemarch", "Persuasion"], { listAttributes: { "aria-busy": "true" } })
  ]) assert.deepEqual(webResetCollections(binding).collections, []);
});

test("a list whose items carry set sizes is read by them alone, whatever the way-on word says", () => {
  assert.deepEqual(webResetCollections(readingList(["Middlemarch", "Persuasion"], { rowAttributes: { "aria-setsize": "-1" } })).collections, []);
  assert.deepEqual(webResetCollections(readingList(["Middlemarch", "Persuasion"], { rowAttributes: { "aria-setsize": "5" } })).collections, []);
});

test("the way-on word is never printed: not in the page view, nor in an element's description", () => {
  const binding = readingList(["Middlemarch"]);
  const list = binding.evidence.elements.find((element) => element.tag === "ol")!;
  assert.equal(list.listWayOn, "none");
  const page = JSON.stringify(publishedWebLlmPage(binding.evidence));
  assert.ok(!page.includes("listWayOn") && !page.includes("wayOn"));
  assert.ok(!webLlmDescribeElement(binding.evidence, list.target).element.includes("listWayOn"));
});
