// The one refusal the tab gate gives. It is a plain error, so every path that
// already reports a browser failure to Core and the model reports this one the
// same way; a path that turns failures into a domain record reads it with
// `instanceof` and says it as a refusal rather than a browser fault.
//
// The message never carries the page's address or title: those are exactly what
// the gate keeps from leaving the browser.

import { OWN_PAGE_REFUSAL_MESSAGE } from "../../shared/own-pages";

export class OwnPageRefusal extends Error {
  /** What the model and the person read, word for word, wherever the gate refuses. */
  static readonly MESSAGE = OWN_PAGE_REFUSAL_MESSAGE;

  constructor(readonly tabId: number | undefined) {
    super(`${OwnPageRefusal.MESSAGE}: ${tabId === undefined ? "the address" : `tab ${tabId}`} is a FluxIQ page, so nothing was sent to it.`);
    this.name = "OwnPageRefusal";
  }
}
