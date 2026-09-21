import type { ListingCondition } from "../catalog/index.js";

const LABELS: Readonly<Record<ListingCondition, string>> = {
  "new": "New",
  "like-new": "Used – like new",
  good: "Used – good",
  fair: "Used – fair",
};

/** A condition as the filter and the listing page spell it, en dash and all. */
export function conditionLabel(condition: ListingCondition): string {
  return LABELS[condition];
}
