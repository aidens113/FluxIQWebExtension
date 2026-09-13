import { identifierPolicies, type IdentifierPolicy } from "../../identifier-policy/index.js";
import { storefrontOrder, type DeliveryOptionId } from "./order.js";
import { withDerived, type StorefrontCheckoutState } from "./state.js";

/**
 * One operation per control the shopper can work, plus `decline-next-payment`,
 * which is the variant's arm.
 *
 * `submit-payment` takes no payload and reads none. A real store posts the card
 * to its gateway; this one decides from `payment.gateway`, so the fixture never
 * has to hold a card-shaped value to behave like a checkout that can decline.
 *
 * An operation that does not fit the current step leaves the state untouched,
 * so a page driven out of order cannot invent an outcome.
 */
export function mutateStorefrontCheckoutState(state: StorefrontCheckoutState, operation: string, payload: unknown): StorefrontCheckoutState {
  if (operation === "decline-next-payment") return armedDecline(state);
  // What the store's own front end calls once the payment provider reports a
  // result: it reads the order back from the server rather than believing the
  // message the frame sent it. It changes nothing.
  if (operation === "read-order") return state;
  if (operation === "submit-payment") return submitPayment(state);
  if (!isRecord(payload)) return state;
  if (operation === "set-identifiers") return setIdentifiers(state, payload.policy);
  if (operation === "set-consent") return setConsent(state, payload.choice);
  if (operation === "toggle-chat" && typeof payload.open === "boolean") {
    return withDerived({ ...state, support: { chatOpen: payload.open } });
  }
  if (operation === "apply-promotion" && typeof payload.code === "string") return applyPromotion(state, payload.code);
  if (operation === "confirm-cart" && state.step === "cart") return withDerived({ ...state, step: "address" });
  if (operation === "lookup-address" && typeof payload.postcode === "string") return lookupAddress(state, payload.postcode);
  if (operation === "choose-address" && typeof payload.addressId === "string") return chooseAddress(state, payload.addressId);
  if (operation === "confirm-address" && state.step === "address" && state.address.chosenId !== null) {
    return withDerived({ ...state, step: "delivery" });
  }
  if (operation === "choose-delivery" && isDeliveryOptionId(payload.optionId)) return chooseDelivery(state, payload.optionId);
  if (operation === "confirm-delivery" && state.step === "delivery" && state.delivery.optionId !== null) {
    return withDerived({ ...state, step: "payment" });
  }
  return state;
}

/**
 * The arm returns the checkout to its first rendering with the gateway set to
 * decline, rather than setting a flag on whatever the recording left behind.
 * The recording ends on a placed order, so an arm that only flipped the
 * gateway would leave the armed run staring at a confirmation panel it never
 * produced -- and would make the variant's page facts, which describe the
 * armed rendering as first loaded, false.
 */
function armedDecline(state: StorefrontCheckoutState): StorefrontCheckoutState {
  return withDerived({
    step: "cart",
    // The identifier policy is a property of the rendering, not of the run, so
    // arming a payment outcome does not reach for it.
    identifiers: state.identifiers,
    consent: "pending",
    promotion: { entered: null, applied: false },
    address: { postcode: "", lookups: 0, suggestionIds: [], chosenId: null },
    delivery: { optionId: null, calculations: 0 },
    payment: { gateway: "decline", attempts: 0, outcome: "pending" },
    support: { chatOpen: false },
    order: { reference: state.order.reference, placed: false },
  });
}

/** Approves or declines by the armed gateway; the order is placed only on approval. */
function submitPayment(state: StorefrontCheckoutState): StorefrontCheckoutState {
  if (state.step !== "payment") return state;
  const approved = state.payment.gateway === "approve";
  return withDerived({
    ...state,
    step: approved ? "confirmed" : "payment",
    payment: { ...state.payment, attempts: state.payment.attempts + 1, outcome: approved ? "approved" : "declined" },
    order: { ...state.order, placed: approved },
  });
}

/**
 * Arms an identifier policy and returns the checkout to its first rendering,
 * because the policy changes what every control on the page carries and a
 * recording made half under one and half under the other would describe no
 * page that exists. An unknown policy leaves the state alone.
 */
function setIdentifiers(state: StorefrontCheckoutState, policy: unknown): StorefrontCheckoutState {
  if (!isIdentifierPolicy(policy)) return state;
  return withDerived({
    step: "cart",
    identifiers: policy,
    consent: "pending",
    promotion: { entered: null, applied: false },
    address: { postcode: "", lookups: 0, suggestionIds: [], chosenId: null },
    delivery: { optionId: null, calculations: 0 },
    payment: { ...state.payment, attempts: 0, outcome: "pending" },
    support: { chatOpen: false },
    order: { reference: state.order.reference, placed: false },
  });
}

function isIdentifierPolicy(value: unknown): value is IdentifierPolicy {
  return typeof value === "string" && (identifierPolicies as readonly string[]).includes(value);
}

function setConsent(state: StorefrontCheckoutState, choice: unknown): StorefrontCheckoutState {
  if (choice !== "all" && choice !== "essential") return state;
  return withDerived({ ...state, consent: choice === "all" ? "accepted" : "essential-only" });
}

function applyPromotion(state: StorefrontCheckoutState, code: string): StorefrontCheckoutState {
  const entered = code.trim().slice(0, 24);
  if (!entered) return state;
  return withDerived({ ...state, promotion: { entered, applied: entered.toUpperCase() === storefrontOrder.promotion.code } });
}

/** A lookup always counts, whether or not the book has the postcode; a chosen address does not survive one. */
function lookupAddress(state: StorefrontCheckoutState, postcode: string): StorefrontCheckoutState {
  const entered = postcode.trim().toUpperCase().slice(0, 12);
  const suggestions: readonly { id: string }[] = addressesFor(entered);
  return withDerived({
    ...state,
    address: { postcode: entered, lookups: state.address.lookups + 1, suggestionIds: suggestions.map(({ id }) => id), chosenId: null },
  });
}

function chooseAddress(state: StorefrontCheckoutState, addressId: string): StorefrontCheckoutState {
  if (!state.address.suggestionIds.includes(addressId)) return state;
  return withDerived({ ...state, address: { ...state.address, chosenId: addressId } });
}

function chooseDelivery(state: StorefrontCheckoutState, optionId: DeliveryOptionId): StorefrontCheckoutState {
  if (state.step !== "delivery") return state;
  return withDerived({ ...state, delivery: { optionId, calculations: state.delivery.calculations + 1 } });
}

/** The address book, read by postcode; an unknown postcode has no entry rather than an empty one. */
export function addressesFor(postcode: string): readonly { id: string; line1: string; line2: string; city: string; region: string }[] {
  const book: Record<string, readonly { id: string; line1: string; line2: string; city: string; region: string }[]> = storefrontOrder.addressBook;
  return book[postcode] ?? [];
}

function isDeliveryOptionId(value: unknown): value is DeliveryOptionId {
  return storefrontOrder.deliveryOptions.some(option => option.id === value);
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}
