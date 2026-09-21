import { DELIVERY_DATES } from "../catalog/index.js";

/**
 * The signed-in shopper's account: who she is, where she ships, how she pays,
 * and the delivery options checkout offers. Portland, Oregon collects no sales
 * tax, so no order here carries any.
 */
export const ACCOUNT = {
  firstName: "Dana",
  name: "Dana Whitfield",
  deliverTo: "Portland 97214",
  addresses: {
    home: { label: "Home", line: "Dana Whitfield, 418 Larkspur Ave Apt 3B, Portland, OR 97214" },
    office: { label: "Office", line: "Dana Whitfield, Northgate Dental, 2100 N Vancouver Ave Suite 200, Portland, OR 97227" },
  },
  payments: {
    "visa-4417": "Visa ending in 4417",
    "store-card-0932": "Brightaisle Store Card ending in 0932",
    "checking-7781": "Checking account ending in 7781",
  },
  giftCardCents: 1240,
  plusMonthlyCents: 1499,
  delivery: {
    "brightaisle-day": { label: "FREE Brightaisle Day Delivery", date: DELIVERY_DATES.brightaisleDay, costCents: 0, note: "Fewer boxes, fewer trips: everything arrives together." },
    standard: { label: "FREE Standard Delivery", date: DELIVERY_DATES.standard, costCents: 0, note: "" },
    "one-day": { label: "One-Day Delivery", date: DELIVERY_DATES.oneDay, costCents: 999, note: "Free with a Brightaisle Plus trial." },
  },
} as const;
