// What the fact judge may read of a page, and nothing more.
//
// The judge (`judge.ts`) decides `true`, `false` or `unknown` from these
// answers alone, so every rule about what a claim means is testable without a
// browser, and the one implementation that reads a live document
// (`dom-page.ts`) holds no rule of its own: it only answers these questions,
// by the same reads `web.dom.assert` judges its claims by.
//
// Every value-bearing answer distinguishes "sensitive" from "nothing": a
// sensitive control's text, value or checked state is never read, so the judge
// answers its claim `unknown` rather than comparing with an empty string.

import type { WebAutomationFactDocument, WebAutomationFactElement, WebAutomationFactTarget, WebAutomationLayerKind } from "@fluxiq-web-extension/domain/client";

/** The document being read: its address, how far it is parsed, and its identity. */
export type FactDocument = { url: string; readyState: NonNullable<WebAutomationFactDocument["readyState"]>; timeOrigin?: number | undefined };

/** An element as the judge holds it: opaque, passed back to the page to be read. */
export type FactElement = { readonly element: unknown };

/** What a target resolved to on this page. */
export type FactResolution =
  | { outcome: "found"; element: FactElement }
  | { outcome: "not_found" }
  | { outcome: "ambiguous" };

/** A value read off the page, or the reason it was not. */
export type FactReading = { read: string } | { withheld: "sensitive" } | { withheld: "no_state" };

/** One open dialog, as page evidence describes it: its kind when a classifier named it, and its accessible name. */
export type FactDialog = { kind?: WebAutomationLayerKind | undefined; name?: string | undefined };

export type FactPage = {
  document(): FactDocument;
  resolve(target: WebAutomationFactTarget): FactResolution;
  /** Every element the selector matches in the target's scope. */
  count(target: WebAutomationFactTarget & { selector: string }): number;
  visible(element: FactElement): boolean;
  enabled(element: FactElement): boolean;
  /** The element's shown text, or the whole page's when no element is given. */
  text(element?: FactElement): FactReading;
  /** A field's values: what it holds, and for a choice, the chosen option's label too. */
  values(element: FactElement): { read: string[] } | { withheld: "sensitive" } | { withheld: "no_state" };
  /** `undefined` when the element shows no such state. */
  checked(element: FactElement): boolean | "sensitive" | undefined;
  selected(element: FactElement): boolean | undefined;
  describe(element: FactElement): WebAutomationFactElement;
  dialogs(): FactDialog[];
};
