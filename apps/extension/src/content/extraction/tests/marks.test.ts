// Marks (contract CC2): what a row carries or not that is not a text cell --
// an icon badge, an item's flag, a control's pressed, checked or selected
// state -- each a column the model can name, holding a value only on the rows
// that carry it, so the page's item filter and Core's processing of the
// stored rows keep the same rows for `where {field, is: "present"}`.
//
// The domain half -- the packet's `fieldMarks`, each item's marks and the
// handle keeping `mark` -- is
// `domain/src/runtime/llm-evidence/structure/tests/packet-type-marks.test.ts`.
// The badge tests below were `badge-column.test.ts` until t800, which folded
// them in here: a badge is a mark.
//
// An icon badge is a column the model can name and filter on.
//
// The everything store marks a Plus-eligible listing with an empty
// `<i role="img" aria-label="Brightaisle Plus">` and nothing else
// (`apps/scenario-lab/src/scenarios/everything-store/pages/results/result-card.ts`).
// Detection offered no column for it, so an instruction asking for "Brightaisle
// Plus eligible" earbuds had nothing a `where` condition could name
// (`docs/working/language-driven-flow-loop-plan/reports/t194-w3-extract-conditions.md`, Q2).
//
// The runner is Node, so the page is a stub: elements, text, attributes and the
// selectors detection itself writes -- a compound of tag, classes, attributes
// and `:nth-of-type`, joined by `>` and anchored with `:scope`. What a real
// browser does with the real store is the content harness's to prove.

import assert from "node:assert/strict";
import test from "node:test";
import { webAutomationExtractConditionHolds, webAutomationExtractListRequestValue, type WebAutomationExtractField } from "@fluxiq-web-extension/domain/client";
import { readField } from "../field-reader";
import { normalizeExtractField } from "../field-spec";
import { inferFields } from "../infer-fields";
import { itemFilterFor } from "../item-filter";
import { flagValue } from "../item-mark";
import { fakeShadowDom } from "./fake-shadow-dom";

// `isSensitiveFormControl` narrows by `instanceof` on the way into every text
// read, which is a ReferenceError under Node; no stub is one of these.
const globals = globalThis as Record<string, unknown>;
globals.HTMLInputElement ??= class {};
globals.HTMLTextAreaElement ??= class {};
globals.HTMLSelectElement ??= class {};

class StubText {
  readonly nodeType = 3;
  parentElement: StubElement | null = null;
  constructor(readonly textContent: string) {}
}

class StubElement {
  readonly nodeType = 1;
  parentElement: StubElement | null = null;
  readonly tagName: string;
  readonly childNodes: Array<StubElement | StubText> = [];
  readonly attributes: Array<{ name: string; value: string }>;

  constructor(tag: string, attributes: Record<string, string>, children: Array<StubElement | string>) {
    this.tagName = tag.toUpperCase();
    this.attributes = Object.entries(attributes).map(([name, value]) => ({ name, value }));
    for (const child of children) {
      const node = typeof child === "string" ? new StubText(child) : child;
      node.parentElement = this;
      this.childNodes.push(node);
    }
  }

  get children(): StubElement[] {
    return this.childNodes.filter((node): node is StubElement => node instanceof StubElement);
  }
  get textContent(): string {
    return this.childNodes.map((node) => node.textContent).join("");
  }
  get firstChild(): unknown {
    return this.childNodes[0] ?? null;
  }
  get classList(): string[] {
    return (this.getAttribute("class") ?? "").split(/\s+/u).filter(Boolean);
  }
  getAttribute(name: string): string | null {
    return this.attributes.find((attribute) => attribute.name === name)?.value ?? null;
  }
  hasAttribute(name: string): boolean {
    return this.getAttribute(name) !== null;
  }
  contains(other: unknown): boolean {
    for (let current = other as StubElement | null; current; current = current.parentElement) if (current === this) return true;
    return false;
  }
  querySelector(selector: string): StubElement | null {
    return this.querySelectorAll(selector)[0] ?? null;
  }
  querySelectorAll(selector: string): StubElement[] {
    const scoped = selector.startsWith(":scope");
    const steps = (scoped ? selector.replace(/^:scope\s*>\s*/u, "") : selector).split(/\s*>\s*/u).map(compound);
    return this.descendants().filter((element) => matchesChain(element, steps, scoped ? this : undefined, this));
  }
  private descendants(): StubElement[] {
    return this.children.flatMap((child) => [child, ...child.descendants()]);
  }
}

/** One compound selector: a tag or `*`, then classes, attributes and `:nth-of-type(n)`. */
type Compound = { tag?: string; classes: string[]; attributes: Array<[string, string | undefined]>; nth?: number };

function compound(text: string): Compound {
  const parsed: Compound = { classes: [], attributes: [] };
  const tag = /^[a-z*][a-z0-9-]*/u.exec(text);
  if (tag && tag[0] !== "*") parsed.tag = tag[0];
  const rest = text.slice(tag?.[0].length ?? 0);
  for (const part of rest.matchAll(/\.([\w-]+)|\[([\w-]+)(?:="((?:[^"\\]|\\.)*)")?\]|:nth-of-type\((\d+)\)/gu)) {
    if (part[1] !== undefined) parsed.classes.push(part[1]);
    else if (part[2] !== undefined) parsed.attributes.push([part[2], part[3]?.replace(/\\(.)/gu, "$1")]);
    else parsed.nth = Number(part[4]);
  }
  return parsed;
}

function matchesCompound(element: StubElement, step: Compound): boolean {
  if (step.tag !== undefined && element.tagName.toLowerCase() !== step.tag) return false;
  if (!step.classes.every((name) => element.classList.includes(name))) return false;
  if (!step.attributes.every(([name, value]) => value === undefined ? element.hasAttribute(name) : element.getAttribute(name) === value)) return false;
  if (step.nth !== undefined) {
    const siblings = element.parentElement?.children.filter((sibling) => sibling.tagName === element.tagName) ?? [];
    if (siblings.indexOf(element) + 1 !== step.nth) return false;
  }
  return true;
}

/** Whether the element ends the chain of child steps, the first step's parent being `anchor` when the selector was `:scope`-anchored. */
function matchesChain(element: StubElement, steps: Compound[], anchor: StubElement | undefined, root: StubElement): boolean {
  let current: StubElement | null = element;
  for (let index = steps.length - 1; index >= 0; index -= 1) {
    if (!current || current === root || !matchesCompound(current, steps[index] as Compound)) return false;
    current = current.parentElement;
  }
  return anchor === undefined || current === anchor;
}

function el(tag: string, attributes: Record<string, string> = {}, ...children: Array<StubElement | string>): StubElement {
  return new StubElement(tag, attributes, children);
}

const PLUS = "Brightaisle Plus";

/** A results card in the store's shape: a title link, a price, and a delivery line whose Plus badge is an empty icon with a name. */
function card(index: number, badge: StubElement | undefined): Element {
  const delivery = badge === undefined
    ? el("div", { class: "dlv" }, "$6.49 delivery ", el("b", {}, "Fri, Oct 3"))
    : el("div", { class: "dlv" }, badge, " FREE delivery ", el("b", {}, "Tomorrow"));
  return el("div", { role: "listitem", class: "card" },
    el("div", { class: "body" },
      el("h2", { class: "ttl" }, el("a", { class: "tl", href: `/p/${index}` }, el("span", {}, `Earbuds ${index}`))),
      el("div", { class: "prc" }, el("span", {}, `$${20 + index}.99`)),
      delivery)) as unknown as Element;
}

function plusBadge(name = PLUS): StubElement {
  return el("i", { class: "plus", role: "img", "aria-label": name });
}

/** Five cards, the first, third and fourth carrying the badge: 3 of 5. */
function storeRun(): Element[] {
  return [1, 2, 3, 4, 5].map((index) => card(index, [1, 3, 4].includes(index) ? plusBadge() : undefined));
}

test("an icon badge 3 of 5 cards carry is a column labelled by its constant accessible name, optional, read as that attribute", () => {
  const run = storeRun();
  const fields = inferFields(run[0] as Element, run);
  const plus = fields.find((field) => field.label === PLUS);
  assert.ok(plus, `a column is labelled ${PLUS}: ${JSON.stringify(fields.map((field) => field.label))}`);
  assert.equal(plus.key, "brightaisle_plus");
  assert.equal(plus.coverage, 0.6);
  // A badge under a name every item gives it is a mark (CC2, `item-mark/`): it reads the same, and the packet names it.
  assert.deepEqual(plus.spec, { kind: "attribute", selector: ":scope > div.body > div.dlv > i.plus", attribute: "aria-label", mark: "badge", required: false });
});

test("an accessible name that differs between items is never a label, and neither is one only a single item gives", () => {
  // A rating icon's name is the record's own value: it stays a column, under its path.
  const ratings = [1, 2, 3, 4].map((index) => card(index, el("i", { class: "stars", role: "img", "aria-label": `${index}.5 out of 5 stars` })));
  const rating = inferFields(ratings[0] as Element, ratings).find((field) => field.spec.attribute === "aria-label");
  assert.ok(rating, "the icon is still offered as a column");
  assert.equal(rating.label, "div.body > div.dlv > i.stars aria-label");
  assert.equal(rating.spec.mark, undefined, "a name per item is that item's data, never a mark");
  assert.equal(/out of 5/u.test(JSON.stringify(inferFields(ratings[0] as Element, ratings).map((field) => field.label))), false);

  // One item naming it differently among others that agree is not "the same in every item".
  const mixed = [plusBadge(), plusBadge(), plusBadge("Brightaisle Plus Fresh")].map((badge, index) => card(index, badge));
  assert.equal(inferFields(mixed[0] as Element, mixed).find((field) => field.spec.attribute === "aria-label")?.label, "div.body > div.dlv > i.plus aria-label");

  // A name seen once cannot be told from one record's value.
  const once = [card(1, plusBadge()), card(2, undefined), card(3, undefined)];
  assert.equal(inferFields(once[0] as Element, once).find((field) => field.spec.attribute === "aria-label")?.label, "div.body > div.dlv > i.plus aria-label");
});

test("an svg badge is named by its own title, and an icon hidden from assistive technology is no badge", () => {
  const verified = () => el("svg", { class: "vf" }, el("title", {}, "Verified seller"), el("path", { d: "M0 0" }));
  const run = [card(1, verified()), card(2, undefined), card(3, verified()), card(4, verified())];
  const field = inferFields(run[0] as Element, run).find((candidate) => candidate.label === "Verified seller");
  assert.ok(field, "the svg's title names the column");
  assert.deepEqual(field.spec, { kind: "text", selector: ":scope > div.body > div.dlv > svg.vf > title", mark: "badge", required: false });

  const hidden = [1, 2, 3].map((index) => card(index, el("i", { class: "plus", "aria-hidden": "true", "aria-label": PLUS })));
  assert.equal(inferFields(hidden[0] as Element, hidden).some((candidate) => candidate.spec.selector?.includes("i.plus") === true), false);
});

test("where {field: <badge key>, is: \"present\"} keeps exactly the badged items, through the domain's request reader", () => {
  const run = storeRun();
  const fields = inferFields(run[0] as Element, run);
  const title = fields.find((field) => field.spec.kind === "text" && field.spec.selector?.endsWith("a.tl > span") === true);
  assert.ok(title, "the title is a column");
  // The request as the resolver hands it to the page: the detected columns
  // under their keys, and the condition the model writes on the badge's key.
  const request = webAutomationExtractListRequestValue({
    item: "div.card",
    fields: Object.fromEntries(fields.map((field) => [field.key, field.spec])),
    where: [{ field: "brightaisle_plus", is: "present" }]
  });
  assert.ok(request, "the domain reads the request");
  assert.deepEqual(request.where, [{ field: "brightaisle_plus", is: "present" }], "the condition survives the reader unchanged");
  const filter = itemFilterFor(request);
  assert.ok(filter, "a request with a condition has a filter");
  const kept = run.filter((item) => {
    const record = Object.fromEntries(Object.entries(request.fields).map(([key, field]) => {
      const reader = normalizeExtractField(key, field as WebAutomationExtractField);
      return [key, reader === undefined ? null : readField(item, key, reader) ?? null];
    }));
    return filter(item, record).length === 0;
  });
  assert.deepEqual(kept.map((item) => readField(item, "title", { kind: "text", selector: title.spec.selector as string, required: true })), ["Earbuds 1", "Earbuds 3", "Earbuds 4"]);
});

// The badge's tests above use their own stub page; the flag's and the state's
// below use `fake-shadow-dom.ts`, which reads every selector inference writes.

const dom = fakeShadowDom();

type Post = { title: string; verified: boolean; promoted?: string; pressed: boolean };

/** A feed post: its title link, a like toggle, and maybe a named badge; the post itself may state a flag. */
function post({ title, verified, promoted, pressed }: Post): Element {
  return dom.el("article", { class: "post", ...(promoted === undefined ? {} : { "data-promoted": promoted }) },
    dom.el("a", { class: "title", href: `/posts/${title.toLowerCase().replace(/\s+/gu, "-")}/` }, title),
    ...(verified ? [dom.el("i", { class: "badge", role: "img", "aria-label": "Verified" })] : []),
    dom.el("button", { class: "like", "aria-pressed": pressed ? "true" : "false" }, "Like"));
}

function feed(): Element[] {
  return [
    post({ title: "Garden notes", verified: true, pressed: true }),
    post({ title: "Rain gauge", verified: false, promoted: "", pressed: false }),
    post({ title: "Seed swap", verified: true, pressed: false })
  ];
}

/** Each item's record as the page reads it: every field, `null` where an optional one has no value. */
function records(run: readonly Element[], fields: Record<string, WebAutomationExtractField>): Array<Record<string, string | null>> {
  return run.map((item) => Object.fromEntries(Object.entries(fields).map(([key, field]) => {
    const reader = normalizeExtractField(key, field);
    return [key, reader === undefined ? null : readField(item, key, reader) ?? null];
  })));
}

test("detection proposes the badge, the flag and the pressed state as marks, each optional and measured on the run", () => {
  const run = feed();
  const fields = inferFields(run[0]!, run);
  const badge = fields.find((field) => field.label === "Verified");
  assert.deepEqual(badge && [badge.spec, badge.coverage], [{ kind: "attribute", selector: ":scope i.badge", attribute: "aria-label", mark: "badge", required: false }, 0.67]);
  const flag = fields.find((field) => field.label === "data-promoted");
  assert.deepEqual(flag && [flag.spec, flag.coverage], [{ kind: "attribute", attribute: "data-promoted", mark: "flag", required: false }, 0.33]);
  const pressed = fields.find((field) => field.spec.mark === "state");
  assert.deepEqual(pressed && [pressed.label, pressed.spec, pressed.coverage], ["button.like (pressed)", { kind: "text", selector: ':scope button.like[aria-pressed="true"]', mark: "state", required: false }, 0.33]);
  // The toggle's own words are still a column every post fills, apart from its state.
  assert.equal(fields.some((field) => field.spec.kind === "text" && field.spec.selector === ":scope button.like" && field.spec.mark === undefined), true);
});

test("a flag reads its name where it is written empty or true, its own words where it has some, and nothing where it says false", () => {
  const read = (written: string | undefined) => flagValue(dom.el("li", written === undefined ? {} : { "data-new": written }), "data-new");
  assert.deepEqual([read(""), read("true"), read("TRUE "), read("false"), read(undefined), read("81")], ["data-new", "data-new", "data-new", undefined, undefined, "81"]);
  // Through the field reader, an optional flag the item does not state is `null`, as every field's is.
  const reader = normalizeExtractField("flag", { kind: "attribute", attribute: "data-new", mark: "flag" });
  assert.equal(readField(dom.el("li", { "data-new": "false" }), "flag", reader!), null);
  // Without the mark the same attribute reads as it always did.
  assert.equal(readField(dom.el("li", { "data-new": "" }), "plain", normalizeExtractField("plain", { kind: "attribute", attribute: "data-new" })!), "");
});

test("is: present on a mark keeps exactly the rows that carry it, on the page and under Core's judge of the stored rows alike", () => {
  const run = feed();
  const fields = Object.fromEntries(inferFields(run[0]!, run).map((field) => [field.key, field.spec as WebAutomationExtractField]));
  const marks = Object.entries(fields).filter(([, field]) => typeof field !== "string" && field.mark !== undefined).map(([key]) => key);
  assert.equal(marks.length, 3, `three marks: ${marks.join(", ")}`);
  const stored = records(run, fields);
  const expected: Record<string, boolean[]> = { verified: [true, false, true], "data-promoted": [false, true, false] };
  for (const key of marks) {
    const request = webAutomationExtractListRequestValue({ item: "article.post", fields, where: [{ field: key, is: "present" }] });
    assert.ok(request, `the domain reads the request on ${key}`);
    const filter = itemFilterFor(request);
    const onPage = run.map((item, index) => filter!(item, stored[index]!).length === 0);
    const inCore = stored.map((row) => webAutomationExtractConditionHolds(request.where![0]!, row[key] ?? undefined));
    assert.deepEqual(onPage, inCore, `the page and Core agree on ${key}`);
    assert.deepEqual(onPage, expected[key] ?? [true, false, false], `${key} keeps the rows that carry it`);
  }
});

test("a mark the page does not know refuses the field, and a mark on a kind that does not read it is left behind", () => {
  assert.throws(() => normalizeExtractField("odd", { kind: "attribute", attribute: "data-x", mark: "maybe" as "flag" }), /mark the page does not know/u);
  assert.deepEqual(normalizeExtractField("link", { kind: "link", selector: "a", mark: "state" }), { kind: "link", selector: "a", required: false });
  assert.deepEqual(normalizeExtractField("text", { kind: "text", selector: "b", mark: "flag" }), { kind: "text", selector: "b", required: false });
});

test("an item attribute every item writes with a value of its own is data, not a flag; one written only true or false is a flag", () => {
  const ids = [1, 2, 3].map((index) => dom.el("li", { "data-item-id": `i${index}` }, dom.el("span", {}, `Item ${index}`)));
  assert.equal(inferFields(ids[0]!, ids).find((field) => field.label === "data-item-id")?.spec.mark, undefined);
  const yesNo = ["true", "false", "true"].map((written, index) => dom.el("li", { "data-open": written }, dom.el("span", {}, `Item ${index}`)));
  const open = inferFields(yesNo[0]!, yesNo).find((field) => field.label === "data-open");
  assert.equal(open?.spec.mark, "flag");
  assert.deepEqual(records(yesNo, { open: open!.spec as WebAutomationExtractField }).map((row) => row.open), ["data-open", null, "data-open"]);
});
