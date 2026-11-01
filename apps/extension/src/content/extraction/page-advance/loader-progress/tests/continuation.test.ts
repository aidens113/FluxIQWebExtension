import assert from "node:assert/strict";
import test from "node:test";
import { loadMoreContinuations } from "..";
import { asElements, el, page } from "../../../tests/selector-page";

function catalogue(form = false) {
  const rows = [el("article", { class: "record" }, "Archive A"), el("article", { class: "record" }, "Archive B")];
  const list = el("div", { id: "records" }, rows);
  const loader = el("button", { id: "loader", type: form ? "submit" : "button" }, "Show more records");
  const unrelated = el("button", { id: "reserve", type: "button" }, "Reserve");
  const section = el("section", {}, [list, ...(form ? [el("form", {}, [loader])] : [loader]), unrelated]);
  const stood = page(el("body", {}, [section]));
  return { rows, list, loader, unrelated, stood, bind: (named = loader) => loadMoreContinuations.bind(asElements([named])[0]!, "#records > article.record", asElements(rows)) };
}

test("only the current detected loader gets provenance; an authored outside control keeps only its first-press choice", () => {
  const fixture = catalogue();
  try {
    const bound = fixture.bind();
    assert.equal(bound.control, fixture.loader);
    assert.equal(loadMoreContinuations.current(bound), fixture.loader);
    assert.equal(loadMoreContinuations.state(bound), "unchanged");
    const arbitrary = fixture.bind(fixture.unrelated);
    assert.equal(arbitrary.control, fixture.unrelated);
    assert.equal(loadMoreContinuations.current(arbitrary), undefined);
    assert.equal(loadMoreContinuations.state(arbitrary), "unknown");
    assert.equal(loadMoreContinuations.current({ ...bound }), undefined);
    assert.equal(loadMoreContinuations.state({ ...bound }), "unknown");
  } finally { fixture.stood.restore(); }
});

test("semantic list growth settles the original checkpoint, while spinner rows and replacement documents do not", () => {
  const fixture = catalogue();
  try {
    const bound = fixture.bind();
    const next = el("article", { class: "record" }, "Archive C");
    next.parentElement = fixture.list;
    fixture.list.children.push(next);
    assert.equal(loadMoreContinuations.state(bound), "advanced");
    assert.equal(loadMoreContinuations.current(bound), undefined, "already-landed moves cannot get another loader");
    const replacement = page(el("body", {}, [el("section", {}, [])]));
    try { assert.equal(loadMoreContinuations.state(bound), "unknown"); } finally { replacement.restore(); }
  } finally { fixture.stood.restore(); }
  const pending = catalogue();
  try {
    const bound = pending.bind();
    const skeleton = el("article", { class: "record", "aria-hidden": "true", "data-skeleton": "" });
    skeleton.parentElement = pending.list;
    pending.list.children.push(skeleton);
    assert.equal(loadMoreContinuations.state(bound), "unknown");
  } finally { pending.stood.restore(); }
});

test("a detected submit control remains unproven for recovery", () => {
  const fixture = catalogue(true);
  try {
    const bound = fixture.bind();
    assert.equal(bound.control, fixture.loader);
    assert.equal(loadMoreContinuations.current(bound), undefined);
    assert.equal(loadMoreContinuations.state(bound), "unknown");
  } finally { fixture.stood.restore(); }
});
