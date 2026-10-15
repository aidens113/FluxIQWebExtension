// Coverage of `appliedControls`: what a page shows as applied -- a checked
// checkbox, a selected option -- read off the catalog fixture's filter rail
// (`./catalog-pager.ts`).

import assert from "node:assert/strict";
import test from "node:test";
import { appliedControls } from "../applied-controls";
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
