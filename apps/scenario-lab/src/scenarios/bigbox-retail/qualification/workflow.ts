import type { ScenarioWorkflow } from "@fluxiq-web-extension/test-contracts";
import { SITE_ROOT } from "../catalog/index.js";
import { bigboxClasses } from "../theme/index.js";
import { soapQuantityExpected } from "./expected.js";

const c = bigboxClasses("baseline", 239);
export const soapQuantityWorkflow: ScenarioWorkflow = {
  id: "ensure-soap-quantity",
  description: "Set the existing soap line to three in total, preserving line, store and other account state.",
  recordingScript: [
    { id: "soap-consent", operation: "click", target: "role:button:Accept all" },
    { id: "soap-offer", operation: "waitForState", target: 'h2:has-text("Get $10 off your first pickup order")', timeoutMs: 8000 },
    { id: "soap-decline-offer", operation: "click", target: 'a:text-is("No thanks")' },
    { id: "soap-cart", operation: "navigate", path: `${SITE_ROOT}cart` },
    { id: "soap-cart-ready", operation: "waitForState", target: `.${c.cartLayout}:not([hidden])`, timeoutMs: 5000 },
    { id: "soap-total-three", operation: "select", target: `.${c.cartGroup} select`, value: "3" },
    { id: "soap-three-committed", operation: "waitForState", target: 'h1:has-text("Cart"):has(small:text-is("(3 items)"))', timeoutMs: 5000 },
    { id: "soap-new-cart-ready", operation: "waitForState", target: `.${c.cartLayout}:not([hidden])`, timeoutMs: 5000 },
    { id: "extract-soap-quantity", operation: "extract", target: `.${c.cartGroup} > .${c.cartLine}`, fields: { item: ":scope > div > a", quantity: "select option:checked", price: ":scope > div > span:nth-of-type(2) > span" } },
    { id: "soap-ensured", operation: "checkpoint" },
  ],
  expected: soapQuantityExpected,
};
