// The page's own tightest statement of a value, and the sentence that must not
// be proposed beside it.
//
// The shapes below are the everything store's own, transcribed from the card
// the failing run read (`test-runs/instances/r5/run-mudwci8d-de88aa32`): a
// rating drawn twice, a price drawn twice, and a brand line whose words are
// also the opening of the title. Only the class names are readable here; no
// rule looks at a class, and the store's are hashed per seed.
//
// The runner is Node, so the DOM is a stub: enough of `Element` for the two
// rules and the sensitive-text reader they read through. What a real browser
// does with the real store is proven by the content harness.

import assert from "node:assert/strict";
import test from "node:test";
import { readField } from "../field-reader";
import { statedMoreTightly, tightestStatedValue } from "../value-statement";

// `isSensitiveFormControl` narrows `instanceof HTMLInputElement` on the way
// into every text read. That is a ReferenceError under Node, so a stand-in
// stands on the global; no stub here is one, and only the lookup has to exist.
(globalThis as Record<string, unknown>).HTMLInputElement ??= class {};

type Spec = { tag: string; attributes?: Record<string, string>; text?: string; children?: Spec[] };

class StubElement {
  parentElement: StubElement | null = null;
  readonly children: StubElement[] = [];
  readonly tagName: string;
  private readonly attributes: Map<string, string>;
  private readonly own: string;

  constructor(spec: Spec) {
    this.tagName = spec.tag.toUpperCase();
    this.attributes = new Map(Object.entries(spec.attributes ?? {}));
    this.own = spec.text ?? "";
    for (const child of spec.children ?? []) {
      const element = new StubElement(child);
      element.parentElement = this;
      this.children.push(element);
    }
  }

  get textContent(): string {
    return this.own + this.children.map((child) => child.textContent).join("");
  }

  /** Only its presence is read, by the scan for a sensitive subtree. */
  get firstChild(): unknown {
    return this.own || this.children.length > 0 ? {} : null;
  }

  getAttribute(name: string): string | null {
    return this.attributes.get(name) ?? null;
  }

  hasAttribute(name: string): boolean {
    return this.attributes.has(name);
  }

  contains(other: unknown): boolean {
    for (let current = other as StubElement | null; current; current = current.parentElement) {
      if (current === this) return true;
    }
    return false;
  }

  /** The two selectors these rules ask for, and nothing else. */
  querySelectorAll(selector: string): StubElement[] {
    const found: StubElement[] = [];
    for (const child of this.children) {
      if (selector === "*" || child.hasAttribute("itemprop")) found.push(child);
      found.push(...child.querySelectorAll(selector));
    }
    return found;
  }

  /** The one element under this carrying `className`, as an `Element` for the rule under test. */
  at(className: string): Element {
    const found = this.querySelectorAll("*").filter((element) => element.getAttribute("class") === className);
    assert.equal(found.length, 1, `exactly one .${className}`);
    return found[0] as unknown as Element;
  }

  get element(): Element {
    return this as unknown as Element;
  }
}

function tree(spec: Spec): StubElement {
  return new StubElement(spec);
}

/**
 * The store's rating: the number a person reads, marked `aria-hidden` because
 * the star icon beside it carries the sentence a screen reader is given.
 */
function ratingCard(rating: string): StubElement {
  return tree({
    tag: "div",
    children: [{
      tag: "div",
      attributes: { class: "reviews" },
      children: [{
        tag: "span",
        attributes: { class: "stars" },
        children: [
          { tag: "span", attributes: { class: "number", "aria-hidden": "true" }, text: rating },
          { tag: "i", attributes: { class: "icon", "data-stars": "3.5" }, children: [{ tag: "span", attributes: { class: "sentence" }, text: `${rating} out of 5 stars` }] }
        ]
      }]
    }]
  });
}

/**
 * The store's price: the amount once for a screen reader, then the same amount
 * again in pieces for the eye, the pieces marked `aria-hidden`.
 */
function priceCard(): StubElement {
  return tree({
    tag: "div",
    children: [{
      tag: "span",
      attributes: { class: "price" },
      children: [
        { tag: "span", attributes: { class: "readable" }, text: "$79.99" },
        {
          tag: "span",
          attributes: { class: "visual", "aria-hidden": "true" },
          children: [
            { tag: "span", attributes: { class: "symbol" }, text: "$" },
            { tag: "span", attributes: { class: "whole" }, text: "79", children: [{ tag: "span", attributes: { class: "point" }, text: "." }] },
            { tag: "span", attributes: { class: "fraction" }, text: "99" }
          ]
        }
      ]
    }]
  });
}

test("the sentence wrapping a value is not proposed beside the value: this is the zero-matched-rows defect", () => {
  const card = ratingCard("3.7");
  assert.equal(card.at("stars").textContent, "3.73.7 out of 5 stars");
  assert.equal(statedMoreTightly(card.element, card.at("sentence")), true);
  assert.equal(statedMoreTightly(card.element, card.at("number")), false);
});

test("a value the page draws the same way twice loses neither copy, so the price columns stay", () => {
  const card = priceCard();
  for (const name of ["readable", "symbol", "whole", "point", "fraction"]) {
    assert.equal(statedMoreTightly(card.element, card.at(name)), false, name);
  }
});

test("words shared by two values are not a restatement, so a brand line does not swallow the title", () => {
  const card = tree({
    tag: "div",
    children: [
      { tag: "div", attributes: { class: "brand" }, text: "Kinetra" },
      { tag: "h2", children: [{ tag: "a", children: [{ tag: "span", attributes: { class: "title" }, text: "Kinetra Run Wireless Earbuds, Bluetooth 5.3" }] }] }
    ]
  });
  assert.equal(statedMoreTightly(card.element, card.at("title")), false);
  assert.equal(statedMoreTightly(card.element, card.at("brand")), false);
});

test("a read of the region descends to the copy the page states tightest, on both of the store's shapes", () => {
  assert.equal(tightestStatedValue(ratingCard("4.1").at("stars")), "4.1");
  const price = priceCard();
  assert.equal(price.at("price").textContent, "$79.99$79.99");
  assert.equal(tightestStatedValue(price.at("price")), "$79.99");
});

test("microdata's content is the value where the page declares one, and an element's own itemscope is left alone", () => {
  const declared = tree({ tag: "span", attributes: { itemprop: "ratingValue", content: "3.7" }, text: "3.7 out of 5 stars" });
  assert.equal(tightestStatedValue(declared.element), "3.7");

  // An element that opens an item of its own states several properties, and
  // which one a field wanted is not for this rule to guess.
  const offer = tree({
    tag: "div",
    attributes: { itemprop: "offers", itemscope: "" },
    children: [
      { tag: "meta", attributes: { itemprop: "price", content: "79.99" } },
      { tag: "meta", attributes: { itemprop: "priceCurrency", content: "USD" } },
      { tag: "span", text: "$79.99" }
    ]
  });
  assert.equal(tightestStatedValue(offer.element), undefined);
});

test("one microdata property inside a plain element is the value; two are a guess and neither is taken", () => {
  const one = tree({
    tag: "div",
    children: [{ tag: "meta", attributes: { itemprop: "ratingValue", content: "3.7" } }, { tag: "span", text: "3.7 out of 5 stars" }]
  });
  assert.equal(tightestStatedValue(one.element), "3.7");

  const two = tree({
    tag: "div",
    children: [
      { tag: "span", attributes: { itemprop: "ratingValue" }, text: "3.7" },
      { tag: "span", text: " out of " },
      { tag: "span", attributes: { itemprop: "bestRating" }, text: "5" }
    ]
  });
  assert.equal(tightestStatedValue(two.element), undefined);
});

test("aria states the value where ARIA says it does, and an aria-label phrasing something else is not a value", () => {
  const slider = tree({ tag: "div", attributes: { role: "slider", "aria-valuenow": "3.7" }, text: "3.7 out of 5 stars" });
  assert.equal(tightestStatedValue(slider.element), "3.7");

  const labelled = tree({ tag: "span", attributes: { "aria-label": "4.5" }, text: "Rated 4.5 out of 5" });
  assert.equal(tightestStatedValue(labelled.element), "4.5");

  // `(16,733)` under the label `16,733 ratings`: the label says something the
  // text does not, so it is a description rather than the value stated alone.
  const reviews = tree({ tag: "a", attributes: { "aria-label": "16,733 ratings" }, text: "(16,733)" });
  assert.equal(tightestStatedValue(reviews.element), undefined);
});

test("an element that declares nothing tighter states nothing, so the read falls back to its whole text", () => {
  assert.equal(tightestStatedValue(tree({ tag: "span", text: "Kinetra Run Wireless Earbuds" }).element), undefined);
  const delivery = tree({ tag: "div", text: "FREE delivery ", children: [{ tag: "b", text: "Thu, Sep 24" }] });
  assert.equal(tightestStatedValue(delivery.element), undefined);
});

test("a text field reads the tightest statement, which is where the value reaches the record", () => {
  const declared = tree({ tag: "span", attributes: { itemprop: "ratingValue", content: "3.7" }, text: "3.7 out of 5 stars" });
  assert.equal(readField(declared.element, "rating", { kind: "text", required: true }), "3.7");
  const plain = tree({ tag: "span", text: "3.7 out of 5 stars" });
  assert.equal(readField(plain.element, "rating", { kind: "text", required: true }), "3.7 out of 5 stars");
});
