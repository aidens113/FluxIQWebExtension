// T1 coverage of the label/value list read as one record, on fake elements
// built exactly as the job board's applicant-tracking confirmation emits its
// receipt (`apps/scenario-lab/src/scenarios/job-board/ats/embed-pages.ts`,
// `renderConfirmation`). Naming the list on a page needs a document, so the
// caller's namer is stubbed; which list a pick on a real page lands on is
// `infer-list.ts`'s and needs a browser.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../../field-reader";
import { fakeShadowDom } from "../../tests/fake-shadow-dom";
import { keyValueRecord } from "../key-value-record";

const dom = fakeShadowDom();

const NAMED = { container: "main.tl", item: { selector: "main.tl > dl.tl-receipt", confidence: 0.75 } };
const name = (): typeof NAMED => NAMED;

/** `<main class="tl">` holding the heading, the note, the receipt and the closing line, as `renderConfirmation` writes them. */
function confirmationPage(): { main: Element; receipt: Element } {
  const receipt = dom.el(
    "dl",
    { class: "tl-receipt" },
    dom.el("dt", {}, "Role"),
    dom.el("dd", {}, "Senior Product Designer"),
    dom.el("dt", {}, "Company"),
    dom.el("dd", {}, "Quillmark"),
    dom.el("dt", {}, "Reference"),
    dom.el("dd", { "data-testid": "application-reference" }, "TL-ABCD-EFGH"),
    dom.el("dt", {}, "Submitted"),
    dom.el("dd", {}, "1 October 2026")
  );
  const main = dom.el(
    "main",
    { class: "tl" },
    dom.el("h1", {}, "Thank you for applying, Ada!"),
    dom.el("p", {}, "Your application for Senior Product Designer at Quillmark has been received."),
    receipt,
    dom.el("p", {}, "Keep your reference for any questions about this application.")
  );
  return { main, receipt };
}

test("the receipt is one record with a field per pair, each labelled by its term and read from its value", () => {
  const { receipt } = confirmationPage();
  const proposal = keyValueRecord(receipt, name);
  assert.ok(proposal);
  assert.deepEqual(
    { container: proposal.container, item: proposal.item, itemCount: proposal.itemCount, confidence: proposal.confidence, pagination: proposal.pagination },
    { container: "main.tl", item: "main.tl > dl.tl-receipt", itemCount: 1, confidence: 0.75, pagination: undefined }
  );
  assert.deepEqual(proposal.fields, [
    { key: "role", label: "Role", spec: { kind: "text", selector: ":scope > dd:nth-of-type(1)", required: true }, coverage: 1 },
    { key: "company", label: "Company", spec: { kind: "text", selector: ":scope > dd:nth-of-type(2)", required: true }, coverage: 1 },
    { key: "reference", label: "Reference", spec: { kind: "text", selector: ":scope > dd:nth-of-type(3)", required: true }, coverage: 1 },
    { key: "submitted", label: "Submitted", spec: { kind: "text", selector: ":scope > dd:nth-of-type(4)", required: true }, coverage: 1 }
  ]);
  const read = Object.fromEntries(proposal.fields.map((field) => [field.key, readField(receipt, field.key, { kind: "text", selector: field.spec.selector ?? "", required: true })]));
  assert.deepEqual(read, { role: "Senior Product Designer", company: "Quillmark", reference: "TL-ABCD-EFGH", submitted: "1 October 2026" });
});

test("pairs wrapped one to a div are read through their wrapper, and a second value of one term is not a field", () => {
  const list = dom.el(
    "dl",
    {},
    dom.el("div", {}, dom.el("dt", {}, "Item"), dom.el("dd", {}, "Speckled moon jar")),
    dom.el("div", {}, dom.el("dt", {}, "Price"), dom.el("dd", {}, "€68.00"), dom.el("dd", {}, "incl. VAT"))
  );
  const proposal = keyValueRecord(list, name);
  assert.deepEqual(proposal?.fields.map((field) => [field.key, field.spec.selector]), [
    ["item", ":scope > div:nth-of-type(1) > dd"],
    ["price", ":scope > div:nth-of-type(2) > dd"]
  ]);
  const read = proposal?.fields.map((field) => readField(list, field.key, { kind: "text", selector: field.spec.selector ?? "", required: true }));
  assert.deepEqual(read, ["Speckled moon jar", "€68.00"]);
  const bare = dom.el("dl", {}, dom.el("dt", {}, "Authors"), dom.el("dd", {}, "Ada"), dom.el("dd", {}, "Grace"), dom.el("dt", {}, "Year"), dom.el("dd", {}, "1843"));
  assert.deepEqual(keyValueRecord(bare, name)?.fields.map((field) => [field.label, field.spec.selector]), [
    ["Authors", ":scope > dd:nth-of-type(1)"],
    ["Year", ":scope > dd:nth-of-type(3)"]
  ]);
});

test("one pair, a list that is not a dl, and a dl of bare values propose nothing", () => {
  const notRecords: Array<[string, Element]> = [
    ["a dl with one pair", dom.el("dl", {}, dom.el("dt", {}, "Role"), dom.el("dd", {}, "Designer"))],
    ["a ul", dom.el("ul", {}, dom.el("li", {}, "Role"), dom.el("li", {}, "Designer"), dom.el("li", {}, "Company"), dom.el("li", {}, "Quillmark"))],
    ["a dl of bare dd", dom.el("dl", {}, dom.el("dd", {}, "Designer"), dom.el("dd", {}, "Quillmark"), dom.el("dd", {}, "TL-ABCD-EFGH"))],
    ["a term with no value", dom.el("dl", {}, dom.el("dt", {}, "Role"), dom.el("dt", {}, "Company"), dom.el("dd", {}, "Quillmark"), dom.el("dt", {}, "Year"), dom.el("dd", {}, "2026"))],
    ["a trailing term", dom.el("dl", {}, dom.el("dt", {}, "Role"), dom.el("dd", {}, "Designer"), dom.el("dt", {}, "Company"), dom.el("dd", {}, "Quillmark"), dom.el("dt", {}, "Year"))],
    ["something else among the pairs", dom.el("dl", {}, dom.el("dt", {}, "Role"), dom.el("dd", {}, "Designer"), dom.el("p", {}, "Note"), dom.el("dt", {}, "Company"), dom.el("dd", {}, "Quillmark"))],
    ["wrapped and bare pairs mixed", dom.el("dl", {}, dom.el("div", {}, dom.el("dt", {}, "Role"), dom.el("dd", {}, "Designer")), dom.el("dt", {}, "Company"), dom.el("dd", {}, "Quillmark"))]
  ];
  for (const [why, list] of notRecords) assert.equal(keyValueRecord(list, name), undefined, why);
});

test("a list the page cannot name on its own is not proposed", () => {
  assert.equal(keyValueRecord(confirmationPage().receipt, () => undefined), undefined);
});
