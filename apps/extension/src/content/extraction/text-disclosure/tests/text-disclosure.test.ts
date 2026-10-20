import assert from "node:assert/strict";
import test from "node:test";
import { assertTextDisclosed } from "..";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";

const dom = fakeShadowDom();

test("positive in-field expansion controls refuse partial text with generic repair feedback, without clicking", () => {
  for (const caption of ["See more", "Read more", "Show more text", "View full description"]) {
    const field = dom.el("p", {}, "A partial description… ", dom.el("div", { role: "button" }, caption));
    assert.throws(() => assertTextDisclosed(field, "description"), (error: unknown) => {
      const failure = (error as { failure: { code: string; actual: string } }).failure;
      assert.equal(failure.code, "web.validation.output_not_observed");
      assert.match(failure.actual, /incomplete_text.*description.*registered row-bound click/u);
      assert.match(failure.actual, /load every row first.*row-context.*without.*For Each.*optional.*registered row-bound click.*a repeat cannot hold another repeat/u);
      assert.doesNotMatch(failure.actual, /partial description/u);
      return true;
    });
  }
});

test("expanded, hidden and unrelated controls and ordinary prose do not refuse a text read", () => {
  const cases = [
    dom.el("p", {}, "See more about this topic in our book."),
    dom.el("p", {}, dom.el("span", {}, "See more")),
    dom.el("p", {}, dom.el("button", { "aria-expanded": "true" }, "See more")),
    dom.el("p", {}, dom.el("button", { hidden: "" }, "Read more")),
    dom.el("p", {}, dom.el("div", { "aria-hidden": "true" }, dom.el("button", {}, "See more"))),
    dom.el("p", {}, dom.el("button", { "aria-expanded": "false" }, "Actions")),
    dom.el("p", {}, dom.el("button", {}, "Show more comments"))
  ];
  for (const field of cases) assert.doesNotThrow(() => assertTextDisclosed(field, "description"));
  const text = dom.el("p", {}, "Whole description.");
  dom.el("article", {}, text, dom.el("button", {}, "See more"));
  assert.doesNotThrow(() => assertTextDisclosed(text, "description"));
});
