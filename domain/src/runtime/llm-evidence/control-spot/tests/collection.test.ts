import assert from "node:assert/strict";
import test from "node:test";
import { webResetCollections, webResetResource, webTargetSpot } from "..";
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
