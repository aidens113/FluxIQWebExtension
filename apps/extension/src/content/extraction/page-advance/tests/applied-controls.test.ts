// Coverage of `appliedControls`: what a page shows as applied -- a checked
// checkbox, a selected option -- read off the catalog fixture's filter rail
// (`./catalog-pager.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { appliedControls } from "../applied-controls";
import { FakeElement } from "../../tests/store-pager";
import { catalogPage } from "./catalog-pager";

test("a checked checkbox and a selected option are applied; unchecked ones, a search field and a selected empty choice are not", () => {
  const applied = catalogPage(1, { next: "keeps", numbers: "keep" });
  try {
    assert.deepEqual(appliedControls(document), [{ name: "format", value: "ebook" }, { name: "lang", value: "en" }]);
  } finally {
    applied.restore();
  }
  const none = catalogPage(1, { next: "keeps", numbers: "keep", shown: "nothing" });
  try {
    assert.deepEqual(appliedControls(document), [], "\"Any language\" selected, worth nothing, shows nothing applied");
  } finally {
    none.restore();
  }
});

// A single select on its first option shows nothing applied (t626).

test("a search box's select on its first option is not applied; on a later option it is", () => {
  const everything = catalogPage(1, { next: "keeps", numbers: "keep", searchIn: "everything" });
  try {
    assert.deepEqual(appliedControls(document), [{ name: "format", value: "ebook" }, { name: "lang", value: "en" }], "\"everything\", the first choice, narrows nothing");
  } finally {
    everything.restore();
  }
  const titles = catalogPage(1, { next: "keeps", numbers: "keep", searchIn: "titles" });
  try {
    assert.deepEqual(appliedControls(document), [{ name: "format", value: "ebook" }, { name: "lang", value: "en" }, { name: "in", value: "titles" }]);
  } finally {
    titles.restore();
  }
});

test("a select that takes several options counts its first option when it is selected", () => {
  const option = (value: string, selected: boolean): FakeElement => new FakeElement("option", { value, ...(selected ? { selected: "" } : {}) }, value);
  const several = new FakeElement("form", {}, "", [new FakeElement("select", { name: "genre", multiple: "" }, "", [option("poetry", true), option("drama", true), option("essays", false)])]);
  assert.deepEqual(appliedControls(several as unknown as ParentNode), [{ name: "genre", value: "poetry" }, { name: "genre", value: "drama" }]);
  const single = new FakeElement("form", {}, "", [new FakeElement("select", { name: "genre" }, "", [option("poetry", true), option("drama", false)])]);
  assert.deepEqual(appliedControls(single as unknown as ParentNode), [], "one-option select on its first option: nobody chose it");
});

test("a named radio group on its first radio is not applied; a later radio, or a radio with no name, is", () => {
  const radio = (name: string | undefined, value: string, checked: boolean): FakeElement => new FakeElement("input", { type: "radio", ...(name === undefined ? {} : { name }), value, ...(checked ? { checked: "" } : {}) });
  const rail = (checkedAt: number): FakeElement => new FakeElement("form", {}, "", [radio("year", "any", checkedAt === 0), radio("year", "recent", checkedAt === 1), radio("year", "classic", checkedAt === 2)]);
  assert.deepEqual(appliedControls(rail(0) as unknown as ParentNode), [], "\"any\", the group's first radio, narrows nothing");
  assert.deepEqual(appliedControls(rail(1) as unknown as ParentNode), [{ name: "year", value: "recent" }]);
  const unnamed = new FakeElement("div", {}, "", [radio(undefined, "large", true), radio(undefined, "small", false)]);
  assert.deepEqual(appliedControls(unnamed as unknown as ParentNode), [{ name: undefined, value: "large" }], "a radio with no name is no group");
  // Each form is its own group: a second form's first radio of the same name is its own default.
  const twoForms = new FakeElement("div", {}, "", [new FakeElement("form", {}, "", [radio("year", "any", false), radio("year", "recent", true)]), new FakeElement("form", {}, "", [radio("year", "any", true)])]);
  assert.deepEqual(appliedControls(twoForms as unknown as ParentNode), [{ name: "year", value: "recent" }]);
});
