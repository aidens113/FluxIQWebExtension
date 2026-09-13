import type { IdentifierPolicy } from "../../identifier-policy/index.js";
import { formatMoney, storefrontOrder, type DeliveryOptionId } from "./order.js";

/** The four accordion steps, plus the confirmation panel that replaces them. */
export type CheckoutStep = "cart" | "address" | "delivery" | "payment" | "confirmed";

/**
 * Server-side state and the fixture's oracle (`/__control/final-state`).
 *
 * Nothing a shopper types into a card, security-code, gift-card or password
 * field is here, and no mutation accepts one: `submit-payment` ignores its
 * payload entirely. That is deliberate. This fixture exists to find out what
 * the *extension* does with card-shaped values, so the fixture's own oracle
 * must never be able to hold one -- if a synthetic card number turns up in
 * captured evidence, the page is the only place it can have come from.
 *
 * `totals` and `status` are derived from the rest by `withDerived`, so the
 * page, the mutation responses and the manifest's `finalState` facts all read
 * one source.
 */
export type StorefrontCheckoutState = {
  step: CheckoutStep;
  /**
   * How much of the page's identifier surface this rendering keeps. `set-identifiers`
   * arms it and nothing else changes: the same markup, the same script, the same
   * behaviour, with the attributes a production build removes taken out of it.
   * It exists so a recording can be made against the page a build ships rather
   * than the page its author wrote -- see `identifier-policy/policies.ts`.
   */
  identifiers: IdentifierPolicy;
  /** `pending` until the consent banner is answered; the banner overlays the page until then. */
  consent: "pending" | "accepted" | "essential-only";
  promotion: { entered: string | null; applied: boolean };
  address: { postcode: string; lookups: number; suggestionIds: string[]; chosenId: string | null };
  delivery: { optionId: DeliveryOptionId | null; calculations: number };
  /**
   * `gateway` is what the payment attempt will do, decided server-side rather
   * than by the digits typed into the frame. The recording therefore replays
   * unchanged in both the approved and the declined case, which is what the
   * variant contract requires: a variant never changes the recording.
   */
  payment: { gateway: "approve" | "decline"; attempts: number; outcome: "pending" | "approved" | "declined" };
  support: { chatOpen: boolean };
  order: { reference: string; placed: boolean };
  totals: { itemsCents: number; discountCents: number; deliveryCents: number; totalCents: number };
  /**
   * Every string the page and the mutation responses display, derived from
   * the facts above so the markup, the client updates and the manifest facts
   * cannot drift apart.
   */
  status: {
    progress: string; promotion: string; deliveryOption: string; deliveryEstimate: string;
    payment: string; subtotal: string; discount: string; deliveryCost: string; total: string;
  };
};

type StorefrontCheckoutFacts = Omit<StorefrontCheckoutState, "totals" | "status">;

const STEP_NUMBER: Record<CheckoutStep, number> = { cart: 1, address: 2, delivery: 3, payment: 4, confirmed: 4 };

export function createStorefrontCheckoutState(seed: number): StorefrontCheckoutState {
  return withDerived({
    step: "cart",
    identifiers: "as-authored",
    consent: "pending",
    promotion: { entered: null, applied: false },
    address: { postcode: "", lookups: 0, suggestionIds: [], chosenId: null },
    delivery: { optionId: null, calculations: 0 },
    payment: { gateway: "approve", attempts: 0, outcome: "pending" },
    support: { chatOpen: false },
    order: { reference: orderReference(seed), placed: false },
  });
}

/** `NLO-00042-7731`: stable for a seed, so a reload never renumbers an order. */
export function orderReference(seed: number): string {
  return `NLO-${String(Math.abs(seed) % 100_000).padStart(5, "0")}-7731`;
}

/** Recomputes every derived total and status line from the facts above. */
export function withDerived(facts: StorefrontCheckoutFacts): StorefrontCheckoutState {
  const itemsCents = storefrontOrder.items.reduce((total, item) => total + item.unitCents * item.quantity, 0);
  const discountCents = facts.promotion.applied ? Math.round((itemsCents * storefrontOrder.promotion.percentOff) / 100) : 0;
  const option = storefrontOrder.deliveryOptions.find(candidate => candidate.id === facts.delivery.optionId);
  const deliveryCents = option?.costCents ?? 0;
  const totalCents = itemsCents - discountCents + deliveryCents;
  return {
    ...facts,
    totals: { itemsCents, discountCents, deliveryCents, totalCents },
    status: {
      progress: `Step ${STEP_NUMBER[facts.step]} of 4`,
      promotion: facts.promotion.applied
        ? `${storefrontOrder.promotion.code} applied (-${formatMoney(discountCents)})`
        : facts.promotion.entered === null ? "No promotion applied" : "That code is not valid on these items",
      deliveryOption: option ? `${option.label} - ${formatMoney(option.costCents)}` : "Choose a delivery speed",
      deliveryEstimate: option?.estimate ?? "",
      payment: paymentStatus(facts.payment.outcome),
      subtotal: formatMoney(itemsCents),
      discount: `-${formatMoney(discountCents)}`,
      deliveryCost: option ? formatMoney(deliveryCents) : "Not chosen yet",
      total: formatMoney(totalCents),
    },
  };
}

function paymentStatus(outcome: StorefrontCheckoutState["payment"]["outcome"]): string {
  if (outcome === "approved") return "Payment approved";
  if (outcome === "declined") return "Your card issuer declined this payment (code 51)";
  return "No payment taken yet";
}
