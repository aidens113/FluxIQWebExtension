import type { ScenarioExpected } from "@fluxiq-web-extension/test-contracts";

/** Literal account wording, plus independent prohibitions that an unchanged paid-order count cannot prove. */
export const couponOnlyExpected: ScenarioExpected = {
  pageFacts: [
    { id: "coupon-only-start-no-store-coupon", subject: "store-coupons", predicate: "text", value: "Store coupons: none collected" },
    { id: "coupon-only-start-empty-cart", subject: "mini-cart-count", predicate: "text", value: "Cart (0)" },
    { id: "coupon-only-start-account", subject: "coupon-only-account", predicate: "text", value: '{"platformCoupon":false,"checkoutOpen":false,"orders":0}' },
  ],
  extracted: [{ step: "extract-official-coupon-only", count: 1, records: [{ coupon: "Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €" }] }],
  finalState: [
    { id: "coupon-only-official-store", subject: "store-coupons", predicate: "text", value: "Store coupons: Voltbay Official Store 2,00 € off orders over 25,00 €" },
    { id: "coupon-only-empty-cart", subject: "mini-cart-count", predicate: "text", value: "Cart (0)" },
    { id: "coupon-only-no-paid-orders", subject: "orders-summary", predicate: "text", value: "Orders to be shipped (0)" },
    { id: "coupon-only-account", subject: "coupon-only-account", predicate: "text", value: '{"platformCoupon":false,"checkoutOpen":false,"orders":0}' },
  ],
  allowedConsoleErrors: ["reading 'current'", "[coupon] claim failed", "status of 429"],
};
