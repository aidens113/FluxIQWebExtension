import assert from "node:assert/strict";
import test, { type TestContext } from "node:test";
import { el, installStubDocument, stubDocument } from "../../tests/stub-dom";
import { recordedPlaceRefusal } from "../place";

function linkIn(t: TestContext, tag: string, attributes: Record<string, string> = {}): Element {
  const link = el("a", { href: "/library" }, "Open library");
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el(tag, attributes, link))));
  installStubDocument(t, document);
  assert.ok(link instanceof Element);
  return link;
}

test("an absent recorded place leaves candidates unrestricted", (t) => {
  const link = linkIn(t, "footer");
  assert.equal(recordedPlaceRefusal(undefined, link), undefined);
  assert.equal(recordedPlaceRefusal({}, link), undefined);
});

test("the recorded landmark distinguishes navigation from the same footer link", (t) => {
  assert.equal(recordedPlaceRefusal({ landmark: "navigation" }, linkIn(t, "nav")), undefined);
  assert.equal(recordedPlaceRefusal({ landmark: "navigation" }, linkIn(t, "footer")), "other-landmark");
  assert.equal(recordedPlaceRefusal({ landmark: "navigation" }, linkIn(t, "div")), "other-landmark");
});

test("a recorded named region requires that name and role, including fail-closed absence", (t) => {
  const recorded = { landmark: "region", landmarkName: "Current loans" };
  assert.equal(recordedPlaceRefusal(recorded, linkIn(t, "section", { "aria-label": "Current loans" })), undefined);
  assert.equal(recordedPlaceRefusal(recorded, linkIn(t, "section", { "aria-label": "Previous loans" })), "other-landmark");
  assert.equal(recordedPlaceRefusal(recorded, linkIn(t, "section")), "other-landmark");
  assert.equal(recordedPlaceRefusal(recorded, linkIn(t, "nav", { "aria-label": "Current loans" })), "other-landmark");
});

test("a matching landmark cannot bypass the recorded dialog gate", (t) => {
  const link = linkIn(t, "nav");
  assert.equal(recordedPlaceRefusal({ landmark: "navigation", dialog: "Account notice" }, link), "other-dialog");
});
