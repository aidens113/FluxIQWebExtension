import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { bigboxClasses } from "../theme/index.js";

const c = bigboxClasses("baseline", 239);

/**
 * Reads the cart page's lines, every fulfilment group in the order the page
 * draws them, as item, quantity and the price of one. The quantity is the
 * line's selected option and the price the figure before "each".
 */
export function cartReadStep(id: string): ScenarioStep {
  return { id, operation: "extract", target: `.${c.cartGroup} > .${c.cartLine}`, fields: { item: ":scope > div > a", quantity: "select option:checked", price: ":scope > div > span:nth-of-type(2) > span" } };
}
