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
import { webAutomationExtractListRequestValue, type WebAutomationExtractField } from "@fluxiq-web-extension/domain/client";
import { readField } from "../field-reader";
import { normalizeExtractField } from "../field-spec";
import { inferFields } from "../infer-fields";
import { itemFilterFor } from "../item-filter";

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
  assert.deepEqual(plus.spec, { kind: "attribute", selector: ":scope > div.body > div.dlv > i.plus", attribute: "aria-label", required: false });
});

test("an accessible name that differs between items is never a label, and neither is one only a single item gives", () => {
  // A rating icon's name is the record's own value: it stays a column, under its path.
  const ratings = [1, 2, 3, 4].map((index) => card(index, el("i", { class: "stars", role: "img", "aria-label": `${index}.5 out of 5 stars` })));
  const rating = inferFields(ratings[0] as Element, ratings).find((field) => field.spec.attribute === "aria-label");
  assert.ok(rating, "the icon is still offered as a column");
  assert.equal(rating.label, "div.body > div.dlv > i.stars aria-label");
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
  assert.deepEqual(field.spec, { kind: "text", selector: ":scope > div.body > div.dlv > svg.vf > title", required: false });

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
