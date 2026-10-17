import type { ScenarioStep } from "@fluxiq-web-extension/test-contracts";

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
  ];
}

/** The scripted Sort by combobox, opened and set to the option the sort menu labels `label`; `choice` names the second step. */
export const sortBy = (prefix: string, label: string, choice: string): ScenarioStep[] => [
  { id: `${prefix}-open-sort`, operation: "click", target: "role:combobox:Sort by" },
  { id: `${prefix}-${choice}`, operation: "click", target: `role:option:${label}` },
];

export const sortCheapestFirst = (prefix: string): ScenarioStep[] => sortBy(prefix, "Price: lowest first", "cheapest-first");

/** Ticks each condition the folded Item condition filter offers by the label it shows, after opening it. */
export const conditions = (prefix: string, labels: readonly string[]): ScenarioStep[] => [
  { id: `${prefix}-open-condition`, operation: "click", target: "role:button:Item condition" },
  ...labels.map((label, index): ScenarioStep => ({ id: `${prefix}-condition-${index}`, operation: "check", target: `role:checkbox:${label}`, value: true })),
];

/** One of the two bare price boxes, named only by its placeholder, applied on Enter. */
export const priceBound = (prefix: string, box: "Min" | "Max", value: number): ScenarioStep[] => [
  { id: `${prefix}-type-${box.toLowerCase()}-price`, operation: "type", target: `input[placeholder="${box}"]`, value: String(value) },
  { id: `${prefix}-apply-${box.toLowerCase()}-price`, operation: "press", target: `input[placeholder="${box}"]`, value: "Enter" },
];
