// The bigbox store chooser, built by hand for Node, so a resolution can be run
// against the page a dry run and a playback actually meet.
//
// The markup is `apps/scenario-lab/src/scenarios/bigbox-retail/shell/store-picker.ts`
// with its hashed classes left off -- nothing on the created node's path reads
// a class: the header's `vr-fulfillment-picker` holds an open shadow root with
// the chip (a button of two spans, the label and the chosen store's name) and
// the flyout, whose cards each hold the store's name, address and hours and an
// identical "Set as my store" button -- except the chosen store's card, which
// holds "Your store" and no button. A hidden flyout is `hidden`, so its buttons
// have no box.
//
// The runner is Node, so the page is built on the hand-built document of
// `../../tests/stub-dom.ts`. `installStoreChooser` installs the page and the
// globals the content script names for one test and puts them back after it.

import type { TestContext } from "node:test";
import { el, installStubDocument, stubDocument, type StubElement } from "../../tests/stub-dom";

/** The chooser's four stores, in the order the fixture lists them. */
export const STORE_CARDS = [
  { id: "2291", name: "Carden Falls Supercenter", address: "1400 Orchard Pkwy, Carden Falls", distance: "2.1 mi", hours: "Open until 11pm" },
  { id: "5510", name: "Carden Falls Neighborhood Market", address: "212 W Mill St, Carden Falls", distance: "3.4 mi", hours: "Open until 10pm" },
  { id: "1187", name: "Millbrook Crossing Supercenter", address: "88 Ferris Rd, Millbrook", distance: "9.8 mi", hours: "Open 24 hours" },
  { id: "4419", name: "Millbrook Crossing Neighborhood Market", address: "17 Canal St, Millbrook", distance: "10.6 mi", hours: "Open until 10pm" }
] as const;

export type StoreCard = (typeof STORE_CARDS)[number];

export type StoreChooser = {
  host: Element;
  chip: Element;
  /** Each store's "Set as my store", by store id; the chosen store has none. */
  setButtons: Map<string, Element>;
};

export type StoreChooserState = {
  /** The chosen store's id. */
  chosen: string;
  /** Whether the flyout is open. */
  open: boolean;
  /** The cards, in the order the page lists them. The fixture's own order when absent. */
  order?: readonly StoreCard[];
  /** Replaces the chip with another control, to show what the stable-name reading refuses. */
  chip?: () => StubElement;
  /** Extra controls at the root's top level, beside the chip. */
  beside?: () => StubElement[];
};

/** The chip as the fixture renders it: the label, then the chosen store's name, one span each. */
export function chipButton(label: string, state: string): StubElement {
  return el("button", { type: "button" }, el("span", {}, label), el("span", {}, state));
}

/** A button whose name is one run of text. */
export function plainButton(text: string): StubElement {
  return el("button", { type: "button" }, text);
}

/** Builds the page for `state`, installs it and the globals the resolver reads, and restores both after the test. */
export function installStoreChooser(t: TestContext, state: StoreChooserState): StoreChooser {
  const document = stubDocument();
  const host = el("vr-fulfillment-picker");
  document.append(el("html", {}, el("body", {}, el("header", {}, el("div", {}, host)))));
  const root = host.attachShadow();
  const chosen = STORE_CARDS.find((card) => card.id === state.chosen);
  if (!chosen) throw new Error(`no store ${state.chosen}`);
  const chip = state.chip?.() ?? chipButton("Pickup or delivery?", chosen.name);
  const setButtons = new Map<string, Element>();
  const cards = (state.order ?? STORE_CARDS).map((card) => {
    const control = card.id === chosen.id ? el("span", {}, "Your store") : el("button", { type: "button" }, "Set as my store");
    if (control.localName === "button") setButtons.set(card.id, control as unknown as Element);
    return el("li", {}, el("strong", {}, card.name), el("div", {}, `${card.address} · ${card.distance}`), el("div", {}, card.hours), control);
  });
  const flyout = el("div", state.open ? {} : { hidden: "" },
    el("div", {}, "×"),
    el("div", {}, el("div", {}, "Pickup"), el("div", {}, "Delivery")),
    el("p", {}, `Stores near ${chosen.address.split(", ").at(-1) ?? ""}`),
    el("ul", {}, ...cards));
  root.append(el("style", {}, ":host{display:block}"), chip, ...(state.beside?.() ?? []), flyout);

  installStubDocument(t, document);
  return { host: host as unknown as Element, chip: chip as unknown as Element, setButtons };
}
