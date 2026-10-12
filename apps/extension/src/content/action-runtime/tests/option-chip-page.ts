// The crossborder marketplace's item page option pickers, built by hand for
// Node, so a saved option can be resolved against a later page view (t436).
//
// The markup is `apps/scenario-lab/src/scenarios/crossborder-marketplace/
// markup/item.ts` with seed 7342's class hashes (`reports/r4a-4-saved-chip-
// not-found.md` decoded them): each group is a `skuGroup` whose id the page
// redraws on every view, holding its label and a run of option `<div>`s. The
// colours are `swatch`es named only by `title`, with an image of no words; the
// specifications and origins are `chipOption`s named by their words. The
// chosen option of each group also carries `optionOn`. None has an id, a role,
// a tabindex or an `onclick`: the page binds them in script and the stylesheet
// gives them a pointer, written here as `style` (`../../tests/stub-dom.ts`).

import type { TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";

/** Seed 7342's hashes for the classes a saved option can carry. */
export const OPTION_CLASSES = { chipOption: "css-1354e7d", optionOn: "css-1dntdmy", swatch: "css-15cl3ai" } as const;

const COLORS = ["Space Grey", "Silver", "Mint"] as const;
const SPECS = ["4-in-1", "7-in-1", "10-in-1"] as const;
const ORIGINS = ["China", "Spain", "Poland"] as const;

/**
 * One page view: which option each group shows chosen, and the view's number,
 * which the group ids are drawn from. `unmarked` draws the options with no
 * pointer and no listener the content script can see, as a page that binds
 * them where neither reaches would: only their fingerprint can find them then.
 */
export type OptionPickerView = { view: number; color: string; spec: string; origin: string; unmarked?: boolean };

/** A fresh page, as a later visit meets it: each group's first option chosen. */
export const FRESH_VIEW: OptionPickerView = { view: 7, color: "Space Grey", spec: "4-in-1", origin: "China" };

/** Builds the pickers for `state`, installs the page, and returns every option by its value. */
export function installOptionPicker(t: TestContext, state: OptionPickerView): Map<string, Element> {
  const options = new Map<string, Element>();
  const option = (className: string, value: string, chosen: boolean, content: StubElement | string, attributes: Record<string, string> = {}): StubElement => {
    const drawn = state.unmarked ? {} : { style: "cursor:pointer" };
    const element = el("div", { class: chosen ? `${className} ${OPTION_CLASSES.optionOn}` : className, ...drawn, ...attributes }, content);
    options.set(value, element as unknown as Element);
    return element;
  };
  const group = (key: string, label: string, chosen: string, members: StubElement[]): StubElement =>
    el("div", { class: "css-skugroup", id: `fb${key}${state.view}` },
      el("div", { class: "css-skulabel" }, `${label}: `, el("b", {}, chosen)),
      el("div", { class: "css-swatches" }, ...members));
  const document = stubDocument();
  document.append(el("html", {}, el("body", {}, el("main", {}, el("div", { class: "css-iteminfo" },
    el("h1", {}, "Portable blender"),
    group("color", "Color", state.color, COLORS.map((color) => option(OPTION_CLASSES.swatch, color, color === state.color, el("img", { alt: "" }), { title: color }))),
    group("spec", "Specification", state.spec, SPECS.map((spec) => option(OPTION_CLASSES.chipOption, spec, spec === state.spec, spec))),
    group("origin", "Ships From", state.origin, ORIGINS.map((origin) => option(OPTION_CLASSES.chipOption, origin, origin === state.origin, origin))))))));
  installStubDocument(t, document);
  return options;
}
