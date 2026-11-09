import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";
import { RESULTS } from "./results.js";

/**
 * Every filter change starts the feed over, and the feed asks for its second
 * batch by itself as soon as the first is in. That request is built when its
 * wait ends, from whatever the address says by then, and its answer is thrown
 * away if the feed has started over again meanwhile. A person changing the next
 * filter while the last list is still being fetched therefore makes the first
 * request of the *new* list, the one that is meant to fail once, be spent on an
 * answer nobody reads; the new list then loads without ever showing Try again.
 *
 * So a person lets the list settle before touching the next filter: the grey
 * cards that stand in while a batch loads are gone (and no "Checking your
 * browser" is up), or the second batch has failed and Try again is showing,
 * where the grey cards stay. Nothing here waits for a fixed time.
 */
const FEED_SETTLED = `${RESULTS}:not(:has([role="alert"])):not(:has(> div:nth-child(2) > *)), :text("Try again") >> nth=0`;

/** Waits until the feed has stopped fetching for the filter just applied. */
export const feedSettled = (prefix: string, after: string): ScenarioStep => ({
  id: `${prefix}-${after}-results-settled`, operation: "waitForState", target: FEED_SETTLED, timeoutMs: 20000,
});

/**
 * The radius picker is a web component with its own shadow root, and its
 * Apply swallows the first press after the select changes, so a script
 * presses it twice and then waits for the chip to say the new radius.
 */
export function radius(from: number, to: number, prefix: string): ScenarioStep[] {
  return [
    { id: `${prefix}-open-radius`, operation: "click", target: `role:button:Kelford · Within ${from} mi` },
    { id: `${prefix}-choose-radius`, operation: "select", target: "role:combobox:Radius", value: String(to) },
    { id: `${prefix}-apply-radius`, operation: "click", target: "role:button:Apply" },
    { id: `${prefix}-apply-radius-again`, operation: "click", target: "role:button:Apply" },
    { id: `${prefix}-radius-applied`, operation: "waitForState", target: `role:button:Kelford · Within ${to} mi`, timeoutMs: 4000 },
    feedSettled(prefix, "radius"),
  ];
}

/** The scripted Sort by combobox, opened and set to the option the sort menu labels `label`; `choice` names the second step. */
export const sortBy = (prefix: string, label: string, choice: string): ScenarioStep[] => [
  { id: `${prefix}-open-sort`, operation: "click", target: "role:combobox:Sort by" },
  { id: `${prefix}-${choice}`, operation: "click", target: `role:option:${label}` },
  feedSettled(prefix, "sort"),
];

export const sortCheapestFirst = (prefix: string): ScenarioStep[] => sortBy(prefix, "Price: lowest first", "cheapest-first");

/** Ticks each condition the folded Item condition filter offers by the label it shows, after opening it. */
export const conditions = (prefix: string, labels: readonly string[]): ScenarioStep[] => [
  { id: `${prefix}-open-condition`, operation: "click", target: "role:button:Item condition" },
  ...labels.flatMap((label, index): ScenarioStep[] => [
    { id: `${prefix}-condition-${index}`, operation: "check", target: `role:checkbox:${label}`, value: true },
    feedSettled(prefix, `condition-${index}`),
  ]),
];

/** One of the two bare price boxes, named only by its placeholder, applied on Enter. */
export const priceBound = (prefix: string, box: "Min" | "Max", value: number): ScenarioStep[] => [
  { id: `${prefix}-type-${box.toLowerCase()}-price`, operation: "type", target: `input[placeholder="${box}"]`, value: String(value) },
  { id: `${prefix}-apply-${box.toLowerCase()}-price`, operation: "press", target: `input[placeholder="${box}"]`, value: "Enter" },
  feedSettled(prefix, `${box.toLowerCase()}-price`),
];
