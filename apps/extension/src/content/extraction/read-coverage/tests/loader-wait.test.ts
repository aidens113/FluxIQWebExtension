// T1 coverage of where a list's loader is looked for asking to wait
// (`../loader-wait.ts`): after the last item inside the list's own container,
// and after the container and a few of its ancestors, never inside an item.

import assert from "node:assert/strict";
import test from "node:test";
import { loaderAskedToWait } from "../loader-wait";
import { asElements, el, page, type PageElement } from "../../tests/selector-page";

const WAIT = "Please wait a few moments before you try again.";

function cards(): PageElement[] {
  return [1, 2, 3].map((index) => el("li", { class: "card" }, [el("a", { href: `/item/${index}` }, `Item ${index}`)]));
}

function on<T>(body: PageElement, read: () => T): T {
  const stood = page(body);
  try {
    return read();
  } finally {
    stood.restore();
  }
}

test("a notice after the list's last item, inside its own container, is the loader asking to wait", () => {
  const items = cards();
  const body = el("body", {}, [el("ul", {}, [...items, el("li", { class: "notice" }, WAIT)])]);
  assert.equal(on(body, () => loaderAskedToWait(asElements(items))), true);
});

test("a notice a few levels out from the list, beside a wrapper of it, is the loader asking to wait", () => {
  const items = cards();
  const body = el("body", {}, [el("main", {}, [el("section", {}, [el("div", {}, [el("ul", {}, items)])]), el("div", {}, "Too many requests. Try again in 30 seconds.")])]);
  assert.equal(on(body, () => loaderAskedToWait(asElements(items))), true);
});

test("a wait written inside an item, or before the list, is not the loader's", () => {
  const inside = cards();
  inside[1]!.children.push(el("span", {}, WAIT));
  assert.equal(on(el("body", {}, [el("ul", {}, inside)]), () => loaderAskedToWait(asElements(inside))), false);
  const before = cards();
  assert.equal(on(el("body", {}, [el("main", {}, [el("p", {}, WAIT), el("ul", {}, before)])]), () => loaderAskedToWait(asElements(before))), false);
});
