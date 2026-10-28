// What stands over a pager or Load more control (`../layer-over-control.ts`):
// a modal dialog the page paints, an inert part of the page, and nothing when
// the control works inside the dialog itself.

import assert from "node:assert/strict";
import test from "node:test";
import { layerOverControl } from "../layer-over-control";
import { PageElement, page } from "../../../tests/selector-page";

/** An element that has a box, as the layer reading asks of a painted one. */
class Drawn extends PageElement {
  getClientRects(): unknown[] {
    return [{}];
  }
}

const drawn = (tag: string, attributes: Record<string, string> = {}, content: string | PageElement[] = []): PageElement => new Drawn(tag, attributes, content);

function on<T>(body: PageElement, read: () => T): T {
  const stood = page(body);
  try {
    return read();
  } finally {
    stood.restore();
  }
}

test("a control on a page with an open modal dialog beside it is covered", () => {
  const next = drawn("a", { href: "/page/2" }, "Next");
  const dialog = drawn("div", { role: "dialog", "aria-modal": "true" }, [drawn("p", {}, "Spin to win")]);
  const body = drawn("body", {}, [drawn("main", {}, [next]), dialog]);
  assert.match(on(body, () => layerOverControl(next as unknown as Element)) ?? "", /dialog/u);
});

test("a control in an inert part of the page is covered", () => {
  const next = drawn("a", { href: "/page/2" }, "Next");
  const body = drawn("body", {}, [drawn("main", { inert: "" }, [next])]);
  assert.match(on(body, () => layerOverControl(next as unknown as Element)) ?? "", /inert/u);
});

test("a control inside the open dialog is not covered by it, and a plain page covers nothing", () => {
  const next = drawn("button", {}, "Next");
  const inside = drawn("body", {}, [drawn("div", { role: "dialog", "aria-modal": "true" }, [next])]);
  assert.equal(on(inside, () => layerOverControl(next as unknown as Element)), undefined);
  const plain = drawn("a", { href: "/page/2" }, "Next");
  assert.equal(on(drawn("body", {}, [drawn("main", {}, [plain])]), () => layerOverControl(plain as unknown as Element)), undefined);
});
