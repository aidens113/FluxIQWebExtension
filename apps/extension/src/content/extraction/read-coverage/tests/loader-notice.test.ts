// The notice a list's loader wrote where the next part would have come
// (`../loader-notice.ts`): the element itself, for the moves that wait it out.

import assert from "node:assert/strict";
import test from "node:test";
import { loaderNoticeOf } from "../loader-notice";
import { asElements, el, page } from "../../tests/selector-page";

test("the notice under the list is the element found, and a list with none finds none", () => {
  const items = [1, 2].map((index) => el("li", { class: "card" }, `Item ${index}`));
  const notice = el("div", { class: "notice" }, [el("p", {}, "Please wait a few moments before you try again."), el("p", {}, "Try again in 4s")]);
  const body = el("body", {}, [el("main", {}, [el("ul", {}, items), notice])]);
  const stood = page(body);
  try {
    assert.equal(loaderNoticeOf(asElements(items)), notice as unknown as Element);
  } finally {
    stood.restore();
  }
  const quiet = [el("li", {}, "Item")];
  const stoodQuiet = page(el("body", {}, [el("main", {}, [el("ul", {}, quiet), el("p", {}, "Showing 1 of 1")])]));
  try {
    assert.equal(loaderNoticeOf(asElements(quiet)), undefined);
  } finally {
    stoodQuiet.restore();
  }
});
