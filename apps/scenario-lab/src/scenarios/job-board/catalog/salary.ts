import type { Salary } from "../types.js";

/** A yearly salary line. `min` or `max` is `null` when the line states only the other bound. */
export function yearly(text: string, min: number | null, max: number | null, currency: Salary["currency"] = "GBP"): Salary {
  return { text, period: "year", currency, min, max };
}

/** A day rate, which a yearly salary question cannot be answered from. */
export function daily(text: string, min: number, max: number): Salary {
  return { text, period: "day", currency: "GBP", min, max };
}

/** No figure at all: `text` is what the card shows instead, empty when it shows nothing. */
export function unstated(text = ""): Salary {
  return { text, period: "none", currency: null, min: null, max: null };
}
