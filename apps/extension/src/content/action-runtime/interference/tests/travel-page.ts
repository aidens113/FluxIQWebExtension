// A travel-booking results page, as the clearing meets it (t656).
//
// Its sticky header holds a currency picker drawn by a custom element: a chip
// in the element's shadow root toggles a flyout beside it, and the flyout's
// close glyph is the only way out it offers. A fare-alert offer, a painted
// modal, is appended to the body and shown on the page's own timer
// (`showOffer`), and closed by its "No thanks". The results sit under both.
//
// The layout is fixed, in a 1280 by 720 view: the header is the top 80 pixels,
// the flyout hangs below the chip down to y 500 on the left, and the offer is
// centred. So the viewport probes find the header -- as a layer only while the
// flyout's close glyph is painted in it -- and the offer at the centre.

import { attachShadow, closesOnPress, h, onPress, place, toggleHidden, zonedView, type FakeElement, type FakeView } from "./fake-layer";

const FLYOUT_BOX = { x: 20, y: 80, width: 380, height: 420 };

export type TravelPage = {
  body: FakeElement;
  view: FakeView;
  header: FakeElement;
  chip: FakeElement;
  flyout: FakeElement;
  flyoutClose: FakeElement;
  offer: FakeElement;
  noThanks: FakeElement;
  results: FakeElement;
  /** Shows the fare-alert offer, as the page's timer does. */
  showOffer: () => void;
};

export function travelPage(): TravelPage {
  const flyoutClose = place(h("button", { type: "button", "aria-label": "Close" }, "×"), { box: { x: 370, y: 85, width: 20, height: 20 } });
  const currencies = place(h("ul", {}, [
    h("li", {}, [h("button", { type: "button" }, "Euro (EUR)")]),
    h("li", {}, [h("button", { type: "button" }, "Pound sterling (GBP)")])
  ]), { box: FLYOUT_BOX });
  const flyout = place(h("div", { hidden: "" }, [flyoutClose, h("p", {}, "Show prices in"), currencies]), { position: "absolute", box: FLYOUT_BOX });
  const chip = place(h("button", { type: "button" }, [h("span", {}, "Currency"), h("span", {}, "EUR")]), { box: { x: 20, y: 20, width: 150, height: 40 } });
  const picker = h("tb-currency-picker");
  attachShadow(picker, [chip, flyout]);
  onPress(chip, () => toggleHidden(flyout));
  const header = place(h("header", {}, [h("a", { href: "/" }, "Wayfarer"), picker]), { position: "sticky", box: { x: 0, y: 0, width: 1280, height: 80 } });

  const noThanks = h("button", { type: "button" }, "No thanks");
  const offer = place(h("div", { role: "dialog", "aria-modal": "true", "aria-label": "Fare alerts", hidden: "" }, [
    h("h2", {}, "Get fare alerts for this trip"),
    h("p", {}, "We email you when prices for your dates drop."),
    h("button", { type: "button" }, "Sign me up"),
    noThanks
  ]), { position: "fixed", box: { x: 440, y: 260, width: 400, height: 200 } });
  closesOnPress(noThanks, offer);

  const results = h("main", {}, [h("h1", {}, "Stays in Lisbon"), h("ul", {}, [h("li", {}, "Casa do Rio"), h("li", {}, "Hotel Alfama")])]);
  const body = h("body", {}, [header, results, offer]);
  return {
    body,
    view: zonedView([offer, currencies, header], results),
    header,
    chip,
    flyout,
    flyoutClose,
    offer,
    noThanks,
    results,
    showOffer: () => toggleHidden(offer)
  };
}
