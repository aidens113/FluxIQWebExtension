import type { ExpectedFact } from "@fluxiq-web-extension/test-contracts";

/** The two readonly facts every store page carries (`pages/shell.ts`), by test id. */
const ACCOUNT = "everything-saved-cloths-account";
const CHECKOUT = "everything-checkout-session";

const CASE = `{"lineId":"L2","sku":"B0RDGAU8PM","offerId":null,"quantity":1,"selected":true}`;
const BATTERIES = `{"lineId":"L1","sku":"B0BAAA48CT","offerId":null,"quantity":1,"selected":true}`;
const SAVED = `"saved":[{"lineId":"S2","sku":"B0TWGOOSE9","offerId":null,"quantity":1,"selected":true},{"lineId":"S1","sku":"B0BAMFC24P","offerId":null,"quantity":1,"selected":true}]`;
const START = `{"cart":[${CASE},${BATTERIES}],${SAVED},"nextLine":3,"checkoutOpen":false,"orderCount":0,"newsletter":"none"}`;

/**
 * The shopper's account as literals written from `state/create.ts`, never
 * produced by the functions that render the facts: the account a run starts
 * from, and the facts that say a run left it, or its checkout, as asked.
 */
export const ACCOUNT_LITERALS = {
  start: START,
  /** The account a run starts from, as a page fact. */
  startFact: (id: string): ExpectedFact => ({ id, subject: ACCOUNT, predicate: "text", value: START }),
  /** The account a run must leave, as a final-state fact. */
  accountFact: (id: string, value: string): ExpectedFact => ({ id, subject: ACCOUNT, predicate: "text", value }),
  /** The open checkout a run must leave, or `null` for none, as a final-state fact. */
  checkoutFact: (id: string, value: string): ExpectedFact => ({ id, subject: CHECKOUT, predicate: "text", value }),
  /** The batteries line raised to three, and the descaler a new line at the top. */
  toppedUp: `{"cart":[{"lineId":"L3","sku":"B0TWDESC04","offerId":null,"quantity":1,"selected":true},${CASE},${BATTERIES.replace(`"quantity":1`, `"quantity":3`)}],${SAVED},"nextLine":4,"checkoutOpen":false,"orderCount":0,"newsletter":"none"}`,
  /** Nothing in the cart changed and no order was placed, with a checkout left open. */
  checkoutOpen: START.replace(`"checkoutOpen":false`, `"checkoutOpen":true`),
  /** Buy Now on the 1.5 L Basics kettle, to the office, standard delivery, gift card on, no trial, the Visa. */
  officeCheckout: `{"pipeline":"buy-now","lines":[{"sku":"B0BAKTL15W","offerId":null,"quantity":1,"unitCents":1999}],"addressId":"office","paymentId":"visa-4417","giftCard":true,"delivery":"standard","plusTrial":false}`,
} as const;
